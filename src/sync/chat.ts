import { db } from '../data/db';
import type { ChatKey, ChatMessage, ChatPhoto, Member } from '../data/types';
import { isUid } from '../data/validate';
import {
  decryptText,
  deriveCipherKey,
  derivePairKey,
  deriveToken,
  encryptText,
  isChatPub,
  newChatKeyPair,
  randomId,
} from './crypto';
import { SyncError, type SyncTransport } from './transport';

/**
 * Czat we wspólnym kalendarzu — osobny kanał obok rekordów kalendarza.
 *
 * Każda wiadomość jest zaszyfrowana kluczem kalendarza (serwer jej nie czyta).
 * Rozmowa 1:1 ma w środku drugą warstwę: klucz pary (ECDH), którego nie znają
 * pozostali członkowie — widzą tylko, kto pisał do kogo, nie co. Klucze publiczne
 * członkowie ogłaszają na tym samym czacie (`t: 'k'`).
 *
 * Zdjęcia NIE są szyfrowane: leżą na serwerze, w wiadomości jest tylko ich id.
 * Użytkownik widzi o tym ostrzeżenie przy dodawaniu zdjęcia.
 */

/** Rozmowa całego kalendarza; inaczej `rozmowa` to uid drugiej osoby. */
export const GROUP = 'g';
export const MAX_CHAT_TEXT = 4000;
export const MAX_CHAT_PHOTOS = 3;

type Outer =
  | { t: 'k'; od: string; pub: string }
  | { t: 'g'; od: string; tekst: string; zdjecia: ChatPhoto[] }
  | { t: 'p'; od: string; do: string; c: string };

const PHOTO_ID = /^[A-Za-z0-9_-]{22}$/;

function cleanPhotos(value: unknown): ChatPhoto[] {
  if (!Array.isArray(value)) return [];
  const photos: ChatPhoto[] = [];
  for (const raw of value.slice(0, MAX_CHAT_PHOTOS)) {
    const p = raw as Record<string, unknown> | null;
    if (p && typeof p.id === 'string' && PHOTO_ID.test(p.id) && (p.typ === 'image/jpeg' || p.typ === 'image/png')) {
      photos.push({ id: p.id, typ: p.typ });
    }
  }
  return photos;
}

const cleanText = (value: unknown): string | null =>
  typeof value === 'string' && value.length <= MAX_CHAT_TEXT ? value : null;

/** Zewnętrzna warstwa (po odszyfrowaniu kluczem kalendarza) → wiadomość albo null. */
export function parseOuter(text: string): Outer | null {
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object' || !isUid(v.od)) return null;
  if (v.t === 'k' && isChatPub(v.pub)) return { t: 'k', od: v.od, pub: v.pub };
  if (v.t === 'g') {
    const tekst = cleanText(v.tekst);
    const zdjecia = cleanPhotos(v.zdjecia);
    if (tekst === null || (!tekst && !zdjecia.length)) return null;
    return { t: 'g', od: v.od, tekst, zdjecia };
  }
  if (v.t === 'p' && isUid(v.do) && v.do !== v.od && typeof v.c === 'string' && v.c.length < 40_000) {
    return { t: 'p', od: v.od, do: v.do, c: v.c };
  }
  return null;
}

/** Wnętrze wiadomości 1:1 (po odszyfrowaniu kluczem pary). */
export function parseInner(text: string): { tekst: string; zdjecia: ChatPhoto[] } | null {
  try {
    const v = JSON.parse(text) as Record<string, unknown>;
    const tekst = cleanText(v?.tekst);
    const zdjecia = cleanPhotos(v?.zdjecia);
    if (tekst === null || (!tekst && !zdjecia.length)) return null;
    return { tekst, zdjecia };
  } catch {
    return null;
  }
}

interface Context {
  token: string;
  cipherKey: CryptoKey;
  memberId: string;
  chatSeq: number;
}

async function context(space: string): Promise<Context | null> {
  const state = await db.syncState.get(space);
  if (!state) return null;
  return {
    token: await deriveToken(state.key),
    cipherKey: await deriveCipherKey(state.key),
    memberId: state.memberId,
    chatSeq: state.chatSeq ?? 0,
  };
}

/** Własna para kluczy w tym kalendarzu — tworzona przy pierwszym czacie. */
export async function ensureChatKey(space: string, memberId: string): Promise<ChatKey> {
  const existing = await db.chatKeys.get(space);
  if (existing && existing.memberId === memberId) return existing;
  const { privateKey, pub } = await newChatKeyPair();
  const key: ChatKey = { space, memberId, privateKey, pub, announced: false };
  await db.chatKeys.put(key);
  return key;
}

const pairCache = new Map<string, CryptoKey>();

async function pairKey(space: string, me: ChatKey, peer: string): Promise<CryptoKey | null> {
  const p = await db.chatPeers.get(`${space}:${peer}`);
  if (!p) return null;
  const cacheKey = `${space}|${me.pub}|${peer}|${p.pub}`;
  let key = pairCache.get(cacheKey);
  if (!key) {
    key = await derivePairKey(me.privateKey, p.pub, space, me.memberId, peer);
    pairCache.set(cacheKey, key);
  }
  return key;
}

async function push(transport: SyncTransport, space: string, ctx: Context, payload: Outer) {
  const uid = randomId();
  const blob = await encryptText(ctx.cipherKey, JSON.stringify(payload));
  return { uid, ...(await transport.chatPush(space, ctx.token, uid, blob)) };
}

/** Odszyfrowuje wiadomości 1:1 czekające na klucz drugiej osoby. */
async function retryLocked(space: string, me: ChatKey): Promise<void> {
  const locked = await db.chatMessages.where('space').equals(space).filter((m) => !!m.szyfr).toArray();
  for (const m of locked) {
    const key = await pairKey(space, me, m.rozmowa);
    const text = key ? await decryptText(key, m.szyfr!) : null;
    const inner = text ? parseInner(text) : null;
    if (!inner) continue;
    const { szyfr: _, ...rest } = m;
    await db.chatMessages.put({ ...rest, tekst: inner.tekst, zdjecia: inner.zdjecia });
  }
}

/**
 * Synchronizacja czatu jednego kalendarza: ogłasza własny klucz (raz), pobiera
 * nowe wiadomości i odszyfrowuje te, które są dla tego telefonu. Zwraca liczbę
 * nowych wiadomości.
 */
export async function syncChat(transport: SyncTransport, space: string): Promise<number> {
  const ctx = await context(space);
  if (!ctx) return 0;
  const me = await ensureChatKey(space, ctx.memberId);
  if (!me.announced) {
    await push(transport, space, ctx, { t: 'k', od: ctx.memberId, pub: me.pub });
    await db.chatKeys.update(space, { announced: true });
    me.announced = true;
  }

  let since = ctx.chatSeq;
  const records: { seq: number; uid: string; created: number; payload: Outer }[] = [];
  for (;;) {
    const page = await transport.chatPull(space, ctx.token, since);
    for (const r of page.messages) {
      const text = await decryptText(ctx.cipherKey, r.blob);
      const payload = text ? parseOuter(text) : null;
      if (payload) records.push({ seq: r.seq, uid: r.uid, created: r.created, payload });
    }
    if (!page.more || page.seq <= since) {
      since = Math.max(since, page.seq);
      break;
    }
    since = page.seq;
  }
  records.sort((a, b) => a.seq - b.seq);

  // Najpierw klucze (nowszy zastępuje starszy), potem wiadomości.
  for (const r of records) {
    if (r.payload.t === 'k') {
      await db.chatPeers.put({ id: `${space}:${r.payload.od}`, space, member: r.payload.od, pub: r.payload.pub });
    }
  }
  const messages: ChatMessage[] = [];
  for (const r of records) {
    const p = r.payload;
    const base = { uid: r.uid, space, seq: r.seq, created: r.created, od: p.od };
    if (p.t === 'g') {
      messages.push({ ...base, rozmowa: GROUP, tekst: p.tekst, zdjecia: p.zdjecia });
    } else if (p.t === 'p' && (p.do === ctx.memberId || p.od === ctx.memberId)) {
      const peer = p.od === ctx.memberId ? p.do : p.od;
      const key = await pairKey(space, me, peer);
      const text = key ? await decryptText(key, p.c) : null;
      const inner = text ? parseInner(text) : null;
      messages.push(
        inner
          ? { ...base, rozmowa: peer, tekst: inner.tekst, zdjecia: inner.zdjecia }
          : { ...base, rozmowa: peer, tekst: '', zdjecia: [], szyfr: p.c },
      );
    }
    // Rozmowy 1:1 innych osób: nie dla tego telefonu — nic nie zapisujemy.
  }

  // Kalendarz mógł zostać opuszczony w trakcie — wtedy nic nie zapisujemy.
  if (!(await db.syncState.get(space))) return 0;
  if (messages.length) await db.chatMessages.bulkPut(messages);
  await db.syncState.update(space, { chatSeq: since });
  await retryLocked(space, me);
  return messages.length;
}

/** Czat wszystkich kalendarzy po kolei; błąd jednego nie zatrzymuje reszty. */
export async function syncAllChats(transport: SyncTransport): Promise<void> {
  for (const state of await db.syncState.toArray()) {
    try {
      await syncChat(transport, state.id);
    } catch {
      // Brak sieci albo starszy serwer — spróbujemy przy następnej okazji.
    }
  }
}

/**
 * Wysyła wiadomość: `rozmowa` = GROUP (cały kalendarz) albo uid drugiej osoby.
 * `zdjecia` — JPEG/PNG w base64, wysyłane NIEZASZYFROWANE przed wiadomością.
 */
export async function sendChat(
  transport: SyncTransport,
  space: string,
  rozmowa: string,
  tekst: string,
  zdjecia: string[] = [],
): Promise<ChatMessage> {
  const text = tekst.trim();
  if (text.length > MAX_CHAT_TEXT || zdjecia.length > MAX_CHAT_PHOTOS || (!text && !zdjecia.length)) {
    throw new SyncError('odmowa');
  }
  const ctx = await context(space);
  if (!ctx) throw new SyncError('brak-przestrzeni');
  let me = await ensureChatKey(space, ctx.memberId);
  if (!me.announced) {
    await syncChat(transport, space);
    me = (await db.chatKeys.get(space)) ?? me;
  }
  const key = rozmowa === GROUP ? null : await pairKey(space, me, rozmowa);
  if (rozmowa !== GROUP && !key) throw new SyncError('brak-klucza');

  const photos: ChatPhoto[] = [];
  for (const dane of zdjecia) photos.push(await transport.chatPhotoPut(space, ctx.token, dane));

  const payload: Outer = key
    ? { t: 'p', od: ctx.memberId, do: rozmowa, c: await encryptText(key, JSON.stringify({ tekst: text, zdjecia: photos })) }
    : { t: 'g', od: ctx.memberId, tekst: text, zdjecia: photos };
  const sent = await push(transport, space, ctx, payload);
  const message: ChatMessage = {
    uid: sent.uid,
    space,
    seq: sent.seq,
    rozmowa,
    od: ctx.memberId,
    tekst: text,
    zdjecia: photos,
    created: sent.created,
  };
  await db.chatMessages.put(message);
  return message;
}

/** Zdjęcie z czatu jako adres data: (zgodny z polityką img-src 'self' data:). */
export async function chatPhotoUrl(transport: SyncTransport, space: string, id: string): Promise<string> {
  const ctx = await context(space);
  if (!ctx) throw new SyncError('brak-przestrzeni');
  const photo = await transport.chatPhotoGet(space, ctx.token, id);
  if (photo.typ !== 'image/jpeg' && photo.typ !== 'image/png') throw new SyncError('serwer');
  return `data:${photo.typ};base64,${photo.dane}`;
}

/** Zaznacza rozmowę jako przeczytaną do jej najnowszej wiadomości. */
export async function markChatRead(space: string, rozmowa: string): Promise<void> {
  const last = await db.chatMessages.where('[space+rozmowa]').equals([space, rozmowa]).reverse().sortBy('seq');
  const seq = last[0]?.seq ?? 0;
  const id = `${space}:${rozmowa}`;
  if (((await db.chatRead.get(id))?.seq ?? 0) < seq) await db.chatRead.put({ id, seq });
}

/** Wszystko o czacie kalendarza — po wyjściu z niego albo odcięciu wszystkich. */
export async function forgetChat(space: string): Promise<void> {
  await db.transaction('rw', [db.chatMessages, db.chatPeers, db.chatKeys, db.chatRead], async () => {
    await db.chatMessages.where('space').equals(space).delete();
    await db.chatPeers.where('space').equals(space).delete();
    await db.chatKeys.delete(space);
    await db.chatRead.where('id').startsWith(`${space}:`).delete();
  });
}

// ── Lista rozmów (jak w komunikatorze) ───────────────────────────────────

export interface ChatThread {
  space: string;
  /** GROUP albo uid drugiej osoby. */
  rozmowa: string;
  nazwa: string;
  grupa: boolean;
  ostatnia: ChatMessage | null;
  nieprzeczytane: number;
  /** Da się pisać: grupa zawsze, 1:1 — gdy druga osoba ogłosiła klucz. */
  mozna: boolean;
}

export interface ChatSection {
  space: string;
  nazwa: string;
  watki: ChatThread[];
}

/**
 * Sekcja na każdy wspólny kalendarz: najpierw rozmowa całego kalendarza, potem
 * członkowie (bez siebie) — ci z nowszą wiadomością wyżej, reszta po imieniu.
 */
export function buildSections(
  spaces: { id: string; nazwa: string; memberId: string }[],
  members: Member[],
  peers: Set<string>,
  messages: ChatMessage[],
  reads: Map<string, number>,
): ChatSection[] {
  return spaces.map((space) => {
    const own = messages.filter((m) => m.space === space.id);
    const thread = (rozmowa: string, nazwa: string, grupa: boolean): ChatThread => {
      const list = own.filter((m) => m.rozmowa === rozmowa);
      const read = reads.get(`${space.id}:${rozmowa}`) ?? 0;
      const ostatnia = list.reduce<ChatMessage | null>((a, m) => (!a || m.seq > a.seq ? m : a), null);
      return {
        space: space.id,
        rozmowa,
        nazwa,
        grupa,
        ostatnia,
        nieprzeczytane: list.filter((m) => m.seq > read && m.od !== space.memberId).length,
        mozna: grupa || peers.has(`${space.id}:${rozmowa}`),
      };
    };
    const ludzie = members
      .filter((m) => m.space === space.id && m.uid !== space.memberId)
      .map((m) => thread(m.uid, m.name, false))
      .sort((a, b) => (b.ostatnia?.seq ?? 0) - (a.ostatnia?.seq ?? 0) || a.nazwa.localeCompare(b.nazwa));
    return { space: space.id, nazwa: space.nazwa, watki: [thread(GROUP, space.nazwa, true), ...ludzie] };
  });
}
