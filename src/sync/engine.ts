import { db } from '../data/db';
import type { Category, EventItem, Member, SyncShadow } from '../data/types';
import { isUid, validCategory, validEvent } from '../data/validate';
import { decryptText, deriveCipherKey, deriveToken, encryptText, randomId } from './crypto';
import { PUSH_BATCH, type SyncTransport } from './transport';

/**
 * Silnik wspólnych kalendarzy. Każdy kalendarz synchronizuje się osobno.
 *
 * Nie śledzi pojedynczych zapisów. Przy każdej synchronizacji porównuje
 * rekordy kalendarza z „cieniem” — treścią ostatnio uzgodnioną z serwerem:
 * 1. pobiera zmiany innych osób i nakłada je tam, gdzie lokalnie nic się
 *    nie zmieniło (lokalna zmiana wygrywa i za chwilę zostanie wysłana),
 * 2. wysyła rekordy, których treść różni się od cienia, a dla rekordów, które
 *    lokalnie zniknęły — „nagrobek”.
 * Dzięki temu żadna istniejąca funkcja zapisu nie musi wiedzieć o synchronizacji.
 *
 * Kalendarz składa się z: jednej kategorii, jej wydarzeń i listy członków.
 */

type CategoryPayload = { k: 'c'; uid: string; name: string; color: string };
type EventPayload = {
  k: 'e';
  uid: string;
  cat: string;
  title: string;
  date: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  note?: string;
  series?: string;
  repeat?: EventItem['repeat'];
  createdAt: number;
};
type MemberPayload = { k: 'm'; uid: string; name: string; joinedAt: number; by?: string };
type Tombstone = { k: 'c' | 'e' | 'm'; uid: string; del: true };
type Payload = CategoryPayload | EventPayload | MemberPayload | Tombstone;
type Letter = Payload['k'];

const KIND_BY_LETTER = { c: 'kategoria', e: 'wydarzenie', m: 'czlonek' } as const;
const LETTER_BY_KIND = { kategoria: 'c', wydarzenie: 'e', czlonek: 'm' } as const;

/** Najdłuższe imię członka. */
export const MAX_MEMBER_NAME = 40;

/** Stała kolejność pól i brak pustych — ta sama treść daje zawsze ten sam tekst. */
function canonical(payload: Payload): string {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) if (value !== undefined) clean[key] = value;
  return JSON.stringify(clean);
}

function categoryPayload(category: Category): string {
  return canonical({ k: 'c', uid: category.uid!, name: category.name, color: category.color });
}

function eventPayload(event: EventItem, catUid: string): string {
  return canonical({
    k: 'e',
    uid: event.uid!,
    cat: catUid,
    title: event.title,
    date: event.date,
    allDay: event.allDay,
    startTime: event.startTime,
    endTime: event.endTime,
    note: event.note,
    series: event.seriesId !== undefined ? String(event.seriesId) : undefined,
    repeat: event.repeat,
    createdAt: event.createdAt,
  });
}

function memberPayload(member: Member): string {
  return canonical({
    k: 'm',
    uid: member.uid,
    name: member.name,
    joinedAt: member.joinedAt,
    by: member.by,
  });
}

/** Rekordy kalendarza w obecnym stanie, z gotową treścią do porównania. */
async function localSet(space: string): Promise<Map<string, SyncShadow>> {
  const out = new Map<string, SyncShadow>();
  const put = (uid: string, kind: SyncShadow['kind'], json: string) =>
    out.set(uid, { uid, space, kind, json });

  const categories = (await db.categories.where('space').equals(space).toArray()).filter(
    (c) => c.uid,
  );
  const uidById = new Map<number, string>();
  for (const category of categories) {
    uidById.set(category.id!, category.uid!);
    put(category.uid!, 'kategoria', categoryPayload(category));
  }
  if (uidById.size > 0) {
    const events = await db.events.where('categoryId').anyOf([...uidById.keys()]).toArray();
    for (const event of events) {
      if (event.uid) put(event.uid, 'wydarzenie', eventPayload(event, uidById.get(event.categoryId!)!));
    }
  }
  for (const member of await db.members.where('space').equals(space).toArray()) {
    put(member.uid, 'czlonek', memberPayload(member));
  }
  return out;
}

/** Nadaje `uid` kategorii kalendarza i jej wydarzeniom, które jeszcze go nie mają. */
async function ensureUids(space: string): Promise<void> {
  await db.transaction('rw', db.categories, db.events, async () => {
    const categories = await db.categories.where('space').equals(space).toArray();
    for (const category of categories) {
      if (!category.uid) await db.categories.update(category.id!, { uid: randomId() });
    }
    const ids = categories.map((c) => c.id!);
    if (ids.length === 0) return;
    const events = await db.events.where('categoryId').anyOf(ids).toArray();
    for (const event of events) {
      if (!event.uid) await db.events.update(event.id!, { uid: randomId() });
    }
  });
}

function parsePayload(text: string): Payload | null {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    if (!(value.k === 'c' || value.k === 'e' || value.k === 'm') || !isUid(value.uid)) return null;
    return value as unknown as Payload;
  } catch {
    return null;
  }
}

/** Kolejność nakładania: kategorie i członkowie, potem wydarzenia, usunięcia kategorii na końcu. */
function applyOrder(p: Payload): number {
  if (p.k === 'c') return 'del' in p ? 2 : 0;
  if (p.k === 'm') return 0;
  return 1;
}

async function currentLocalJson(space: string, uid: string, kind: Letter): Promise<string | null> {
  if (kind === 'm') {
    const member = await db.members.get(uid);
    return member?.space === space ? memberPayload(member) : null;
  }
  if (kind === 'c') {
    const category = await db.categories.where('uid').equals(uid).first();
    return category?.space === space ? categoryPayload(category) : null;
  }
  const event = await db.events.where('uid').equals(uid).first();
  if (!event || event.categoryId === undefined) return null;
  const category = await db.categories.get(event.categoryId);
  return category?.space === space && category.uid ? eventPayload(event, category.uid) : null;
}

export function cleanMemberName(name: unknown): string {
  return typeof name === 'string' ? name.trim().slice(0, MAX_MEMBER_NAME) : '';
}

/** Nakłada jedną zmianę z serwera, chyba że lokalna zmiana ma pierwszeństwo. */
async function applyRemote(space: string, payload: Payload, json: string): Promise<void> {
  const shadow = await db.syncShadow.get(payload.uid);
  const local = await currentLocalJson(space, payload.uid, payload.k);

  // Lokalnie zmienione albo usunięte od ostatniej synchronizacji — wygrywa
  // lokalna wersja, wyślemy ją za chwilę. Rekord nigdy nieuzgodniony (brak
  // cienia) przyjmuje wersję z serwera.
  const dirty = shadow !== undefined && local !== shadow.json;
  if (dirty) return;

  if ('del' in payload) {
    if (payload.k === 'm') {
      await db.members.delete(payload.uid);
    } else if (payload.k === 'e') {
      await db.events.where('uid').equals(payload.uid).delete();
    } else {
      const category = await db.categories.where('uid').equals(payload.uid).first();
      if (category?.space === space) {
        // Wspólne wydarzenia znikają razem z kategorią, prywatne tylko się odpinają.
        await db.events.where('categoryId').equals(category.id!).and((e) => !!e.uid).delete();
        await db.events.where('categoryId').equals(category.id!).modify({ categoryId: undefined });
        await db.tasks.where('categoryId').equals(category.id!).modify({ categoryId: undefined });
        await db.habits.where('categoryId').equals(category.id!).modify({ categoryId: undefined });
        await db.categories.delete(category.id!);
      }
    }
    await db.syncShadow.delete(payload.uid);
    return;
  }

  if (payload.k === 'm') {
    const name = cleanMemberName(payload.name);
    if (!name || typeof payload.joinedAt !== 'number') return;
    await db.members.put({
      uid: payload.uid,
      space,
      name,
      joinedAt: payload.joinedAt,
      ...(isUid(payload.by) ? { by: payload.by } : {}),
    });
  } else if (payload.k === 'c') {
    const valid = validCategory({ name: payload.name, color: payload.color, order: 0 });
    if (!valid) return;
    const existing = await db.categories.where('uid').equals(payload.uid).first();
    if (existing) {
      await db.categories.update(existing.id!, { name: valid.name, color: valid.color, space });
    } else {
      await db.categories.add({
        name: valid.name,
        color: valid.color,
        order: await db.categories.count(),
        uid: payload.uid,
        space,
      });
    }
  } else {
    const category = await db.categories.where('uid').equals(payload.cat).first();
    // Wydarzenie z nieznanej kategorii pomijamy bez cienia — wróci przy
    // następnej pełnej synchronizacji, gdy kategoria już dotrze.
    if (category?.space !== space) return;
    const series = payload.series !== undefined ? Number(payload.series) : undefined;
    const valid = validEvent({
      title: payload.title,
      date: payload.date,
      allDay: payload.allDay,
      startTime: payload.startTime,
      endTime: payload.endTime,
      note: payload.note,
      categoryId: category.id,
      seriesId: Number.isSafeInteger(series) ? series : undefined,
      repeat: payload.repeat,
      createdAt: payload.createdAt,
      uid: payload.uid,
    });
    if (!valid) return;
    const existing = await db.events.where('uid').equals(payload.uid).first();
    if (existing) await db.events.update(existing.id!, { ...valid, id: existing.id });
    else await db.events.add(valid);
  }

  const after = await currentLocalJson(space, payload.uid, payload.k);
  await db.syncShadow.put({ uid: payload.uid, space, kind: KIND_BY_LETTER[payload.k], json: after ?? json });
}

const running = new Map<string, Promise<void>>();

/**
 * Jedna pełna synchronizacja jednego kalendarza. Równoległe wywołania dla tego
 * samego kalendarza czekają na trwającą, zamiast startować drugą.
 */
export function syncSpace(transport: SyncTransport, space: string): Promise<void> {
  let current = running.get(space);
  if (!current) {
    current = runSync(transport, space).finally(() => running.delete(space));
    running.set(space, current);
  }
  return current;
}

/** Synchronizuje wszystkie kalendarze po kolei. Błąd jednego nie zatrzymuje reszty. */
export async function syncAll(
  transport: SyncTransport,
  onError: (space: string, err: unknown) => Promise<void> | void,
): Promise<void> {
  for (const state of await db.syncState.toArray()) {
    try {
      await syncSpace(transport, state.id);
    } catch (err) {
      await onError(state.id, err);
    }
  }
}

async function runSync(transport: SyncTransport, space: string): Promise<void> {
  const state = await db.syncState.get(space);
  if (!state) return;

  const token = await deriveToken(state.key);
  const cipherKey = await deriveCipherKey(state.key);

  await ensureUids(space);

  // 1. Pobranie zmian innych osób.
  let since = state.lastSeq;
  const incoming: { payload: Payload; json: string }[] = [];
  for (;;) {
    const page = await transport.pull(space, token, since);
    for (const record of page.records) {
      const text = await decryptText(cipherKey, record.blob);
      const payload = text ? parsePayload(text) : null;
      if (payload && payload.uid === record.uid) incoming.push({ payload, json: canonical(payload) });
    }
    // Serwer, który mówi „jest więcej”, ale nie posuwa numeru dalej, zapętliłby
    // nas w nieskończoność — wtedy przerywamy i spróbujemy przy następnej okazji.
    if (!page.more || page.seq <= since) {
      since = Math.max(since, page.seq);
      break;
    }
    since = page.seq;
  }

  incoming.sort((a, b) => applyOrder(a.payload) - applyOrder(b.payload));
  await db.transaction(
    'rw',
    [db.categories, db.events, db.tasks, db.habits, db.members, db.syncShadow],
    async () => {
      for (const { payload, json } of incoming) await applyRemote(space, payload, json);
    },
  );
  // Kalendarz mógł zostać w międzyczasie opuszczony — wtedy nic nie zapisujemy.
  if (!(await db.syncState.get(space))) return;
  await db.syncState.update(space, { lastSeq: since });

  // 2. Wysłanie lokalnych zmian.
  const current = await localSet(space);
  const shadows = await db.syncShadow.where('space').equals(space).toArray();
  const outgoing: { uid: string; text: string; shadow: SyncShadow | null }[] = [];

  for (const record of current.values()) {
    const shadow = shadows.find((s) => s.uid === record.uid);
    if (shadow?.json !== record.json) outgoing.push({ uid: record.uid, text: record.json, shadow: record });
  }
  for (const shadow of shadows) {
    if (current.has(shadow.uid)) continue;
    const k = LETTER_BY_KIND[shadow.kind];
    outgoing.push({ uid: shadow.uid, text: canonical({ k, uid: shadow.uid, del: true }), shadow: null });
  }

  for (let i = 0; i < outgoing.length; i += PUSH_BATCH) {
    const batch = outgoing.slice(i, i + PUSH_BATCH);
    const records = await Promise.all(
      batch.map(async (item) => ({ uid: item.uid, blob: await encryptText(cipherKey, item.text) })),
    );
    await transport.push(space, token, records);
    await db.transaction('rw', db.syncShadow, async () => {
      for (const item of batch) {
        if (item.shadow) await db.syncShadow.put(item.shadow);
        else await db.syncShadow.delete(item.uid);
      }
    });
  }

  await db.syncState.update(space, { lastSyncAt: Date.now(), lastError: undefined });
}
