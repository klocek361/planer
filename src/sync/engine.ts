import { db } from '../data/db';
import type { Category, EventItem, SyncShadow } from '../data/types';
import { isUid, validCategory, validEvent } from '../data/validate';
import { decryptText, deriveCipherKey, deriveToken, encryptText, randomId } from './crypto';
import { PUSH_BATCH, type SyncTransport } from './transport';

/**
 * Silnik wspólnego kalendarza.
 *
 * Nie śledzi pojedynczych zapisów. Przy każdej synchronizacji porównuje
 * wspólne rekordy z „cieniem” — treścią ostatnio uzgodnioną z serwerem:
 * 1. pobiera zmiany drugiej osoby i nakłada je tam, gdzie lokalnie nic się
 *    nie zmieniło (lokalna zmiana wygrywa i za chwilę zostanie wysłana),
 * 2. wysyła rekordy, których treść różni się od cienia, a dla rekordów, które
 *    lokalnie zniknęły ze wspólnych kategorii — „nagrobek”.
 * Dzięki temu żadna istniejąca funkcja zapisu nie musi wiedzieć o synchronizacji.
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
type Tombstone = { k: 'c' | 'e'; uid: string; del: true };
type Payload = CategoryPayload | EventPayload | Tombstone;

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

/** Wspólne rekordy w obecnym stanie, z gotową treścią do porównania. */
async function localSharedSet(): Promise<Map<string, SyncShadow>> {
  const out = new Map<string, SyncShadow>();
  const categories = (await db.categories.toArray()).filter((c) => c.shared && c.uid);
  const uidById = new Map<number, string>();
  for (const category of categories) {
    uidById.set(category.id!, category.uid!);
    out.set(category.uid!, { uid: category.uid!, kind: 'kategoria', json: categoryPayload(category) });
  }
  if (uidById.size === 0) return out;

  const events = await db.events.where('categoryId').anyOf([...uidById.keys()]).toArray();
  for (const event of events) {
    if (!event.uid) continue;
    const json = eventPayload(event, uidById.get(event.categoryId!)!);
    out.set(event.uid, { uid: event.uid, kind: 'wydarzenie', json });
  }
  return out;
}

/** Nadaje `uid` wspólnym kategoriom i ich wydarzeniom, które jeszcze go nie mają. */
async function ensureUids(): Promise<void> {
  await db.transaction('rw', db.categories, db.events, async () => {
    const shared = (await db.categories.toArray()).filter((c) => c.shared);
    for (const category of shared) {
      if (!category.uid) await db.categories.update(category.id!, { uid: randomId() });
    }
    const ids = shared.map((c) => c.id!);
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
    if ((value.k !== 'c' && value.k !== 'e') || !isUid(value.uid)) return null;
    return value as unknown as Payload;
  } catch {
    return null;
  }
}

/** Kolejność nakładania: najpierw kategorie, potem wydarzenia, usunięcia kategorii na końcu. */
function applyOrder(p: Payload): number {
  if (p.k === 'c') return 'del' in p ? 2 : 0;
  return 1;
}

async function currentLocalJson(uid: string, kind: 'c' | 'e'): Promise<string | null> {
  if (kind === 'c') {
    const category = await db.categories.where('uid').equals(uid).first();
    return category?.shared ? categoryPayload(category) : null;
  }
  const event = await db.events.where('uid').equals(uid).first();
  if (!event || event.categoryId === undefined) return null;
  const category = await db.categories.get(event.categoryId);
  return category?.shared && category.uid ? eventPayload(event, category.uid) : null;
}

/** Nakłada jedną zmianę z serwera, chyba że lokalna zmiana ma pierwszeństwo. */
async function applyRemote(payload: Payload, json: string): Promise<void> {
  const shadow = await db.syncShadow.get(payload.uid);
  const local = await currentLocalJson(payload.uid, payload.k);

  // Lokalnie zmienione albo usunięte od ostatniej synchronizacji — wygrywa
  // lokalna wersja, wyślemy ją za chwilę. Rekord nigdy nieuzgodniony (brak
  // cienia) przyjmuje wersję z serwera.
  const dirty = shadow !== undefined && local !== shadow.json;
  if (dirty) return;

  if ('del' in payload) {
    if (payload.k === 'e') {
      await db.events.where('uid').equals(payload.uid).delete();
    } else {
      const category = await db.categories.where('uid').equals(payload.uid).first();
      if (category) {
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

  if (payload.k === 'c') {
    const valid = validCategory({ name: payload.name, color: payload.color, order: 0 });
    if (!valid) return;
    const existing = await db.categories.where('uid').equals(payload.uid).first();
    if (existing) {
      await db.categories.update(existing.id!, { name: valid.name, color: valid.color, shared: true });
    } else {
      await db.categories.add({
        name: valid.name,
        color: valid.color,
        order: await db.categories.count(),
        uid: payload.uid,
        shared: true,
      });
    }
  } else {
    const category = await db.categories.where('uid').equals(payload.cat).first();
    // Wydarzenie z nieznanej kategorii pomijamy bez cienia — wróci przy
    // następnej pełnej synchronizacji, gdy kategoria już dotrze.
    if (!category?.shared) return;
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

  const after = await currentLocalJson(payload.uid, payload.k);
  await db.syncShadow.put({
    uid: payload.uid,
    kind: payload.k === 'c' ? 'kategoria' : 'wydarzenie',
    json: after ?? json,
  });
}

let running: Promise<void> | null = null;

/**
 * Jedna pełna synchronizacja. Równoległe wywołania czekają na trwającą,
 * zamiast startować drugą.
 */
export function syncNow(transport: SyncTransport): Promise<void> {
  if (!running) {
    running = runSync(transport).finally(() => {
      running = null;
    });
  }
  return running;
}

async function runSync(transport: SyncTransport): Promise<void> {
  const state = await db.syncState.get('stan');
  if (!state) return;

  const token = await deriveToken(state.key);
  const cipherKey = await deriveCipherKey(state.key);

  await ensureUids();

  // 1. Pobranie zmian drugiej osoby.
  let since = state.lastSeq;
  const incoming: { payload: Payload; json: string }[] = [];
  for (;;) {
    const page = await transport.pull(state.spaceId, token, since);
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
    [db.categories, db.events, db.tasks, db.habits, db.syncShadow],
    async () => {
      for (const { payload, json } of incoming) await applyRemote(payload, json);
    },
  );
  await db.syncState.update('stan', { lastSeq: since });

  // 2. Wysłanie lokalnych zmian.
  const current = await localSharedSet();
  const shadows = await db.syncShadow.toArray();
  const outgoing: { uid: string; text: string; shadow: SyncShadow | null }[] = [];

  for (const record of current.values()) {
    const shadow = shadows.find((s) => s.uid === record.uid);
    if (shadow?.json !== record.json) outgoing.push({ uid: record.uid, text: record.json, shadow: record });
  }
  for (const shadow of shadows) {
    if (current.has(shadow.uid)) continue;
    const k = shadow.kind === 'kategoria' ? 'c' : 'e';
    outgoing.push({ uid: shadow.uid, text: canonical({ k, uid: shadow.uid, del: true }), shadow: null });
  }

  for (let i = 0; i < outgoing.length; i += PUSH_BATCH) {
    const batch = outgoing.slice(i, i + PUSH_BATCH);
    const records = await Promise.all(
      batch.map(async (item) => ({ uid: item.uid, blob: await encryptText(cipherKey, item.text) })),
    );
    await transport.push(state.spaceId, token, records);
    await db.transaction('rw', db.syncShadow, async () => {
      for (const item of batch) {
        if (item.shadow) await db.syncShadow.put(item.shadow);
        else await db.syncShadow.delete(item.uid);
      }
    });
  }

  await db.syncState.update('stan', { lastSyncAt: Date.now(), lastError: undefined });
}
