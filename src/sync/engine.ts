import { db } from '../data/db';
import type {
  Category,
  Checklist,
  EventItem,
  Habit,
  Member,
  MoneyCategory,
  MoneyEntry,
  SavingsGoal,
  SyncShadow,
  Task,
} from '../data/types';
import {
  isUid,
  validCategory,
  validChecklist,
  validChecklistItem,
  validEvent,
  validHabit,
  validMoneyCategory,
  validMoneyEntry,
  validSavingsGoal,
  validTask,
} from '../data/validate';
import { decryptText, deriveCipherKey, deriveToken, encryptText, randomId } from './crypto';
import { PUSH_BATCH, type SyncTransport } from './transport';

/**
 * Silnik wspólnych kalendarzy. Każdy kalendarz synchronizuje się osobno.
 *
 * Wspólny kalendarz to jedna kategoria — i wszystko, co do niej należy:
 * wydarzenia, zadania (z podzadaniami), nawyki (z odhaczeniami) i listy
 * (z pozycjami), a do tego lista członków. Pozostałe kategorie są prywatne.
 *
 * Silnik nie śledzi pojedynczych zapisów. Przy każdej synchronizacji
 * porównuje rekordy kalendarza z „cieniem” — treścią ostatnio uzgodnioną
 * z serwerem:
 * 1. pobiera zmiany innych osób i nakłada je tam, gdzie lokalnie nic się
 *    nie zmieniło (lokalna zmiana wygrywa i za chwilę zostanie wysłana),
 * 2. wysyła rekordy, których treść różni się od cienia, a dla rekordów, które
 *    lokalnie zniknęły — „nagrobek”.
 * Dzięki temu żadna istniejąca funkcja zapisu nie musi wiedzieć o synchronizacji.
 */

/** Rodzaj rekordu: jedna litera w treści wysyłanej na serwer. */
type Letter = 'c' | 'e' | 'm' | 't' | 'h' | 'd' | 'l' | 'i' | 'u' | 'k' | 's' | 'x';

const KIND_BY_LETTER = {
  c: 'kategoria',
  e: 'wydarzenie',
  m: 'czlonek',
  t: 'zadanie',
  h: 'nawyk',
  d: 'odhaczenie',
  l: 'lista',
  i: 'pozycja',
  u: 'budzet',
  k: 'kategoria-pieniedzy',
  s: 'skarbonka',
  x: 'wpis',
} as const satisfies Record<Letter, SyncShadow['kind']>;

const LETTER_BY_KIND = Object.fromEntries(
  Object.entries(KIND_BY_LETTER).map(([letter, kind]) => [kind, letter]),
) as Record<SyncShadow['kind'], Letter>;

const LETTERS = new Set<string>(Object.keys(KIND_BY_LETTER));

/** Treść rekordu po rozszyfrowaniu. Pola sprawdzają walidatory przy nakładaniu. */
type Payload = { k: Letter; uid: string; del?: true } & Record<string, unknown>;

/**
 * Wersja formatu rekordów. Podbijamy ją przy każdym nowym rodzaju rekordu:
 * 1 — wydarzenia, kategoria, członkowie; 2 — także zadania, nawyki, listy;
 * 3 — także budżet (ustawienia, kategorie pieniędzy, wpisy, skarbonki).
 */
export const SYNC_FORMAT = 3;

/** Stały identyfikator rekordu z ustawieniami budżetu — budżet jest jeden. */
const BUDGET_UID = 'ustawieniabudzetu';

/** Najdłuższe imię członka. */
export const MAX_MEMBER_NAME = 40;

/** Stała kolejność pól i brak pustych — ta sama treść daje zawsze ten sam tekst. */
function canonical(payload: Record<string, unknown>): string {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) if (value !== undefined) clean[key] = value;
  return JSON.stringify(clean);
}

export function cleanMemberName(name: unknown): string {
  return typeof name === 'string' ? name.trim().slice(0, MAX_MEMBER_NAME) : '';
}

// ── Odhaczenia nawyków ────────────────────────────────────────────────────
// Odhaczenie nie ma własnego identyfikatora — jest jedno na nawyk i dzień.
// Stały `uid` z nawyku i daty sprawia, że gdy dwie osoby odhaczą ten sam
// dzień, powstaje jeden rekord, a nie dwa.

const HABIT_UID_LENGTH = 22;

function entryUid(habitUid: string, date: string): string {
  return `${habitUid}d${date.replace(/-/g, '')}`;
}

function parseEntryUid(uid: string): { habitUid: string; date: string } | null {
  const digits = uid.slice(HABIT_UID_LENGTH + 1);
  if (uid.length !== HABIT_UID_LENGTH + 9 || !/^\d{8}$/.test(digits)) return null;
  return {
    habitUid: uid.slice(0, HABIT_UID_LENGTH),
    date: `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`,
  };
}

// ── Przynależność do kalendarza ──────────────────────────────────────────

/** `uid` kategorii, jeśli należy do kalendarza; w przeciwnym razie null. */
async function sharedCategoryUid(space: string, categoryId: number | undefined): Promise<string | null> {
  if (categoryId === undefined) return null;
  const category = await db.categories.get(categoryId);
  return category?.space === space && category.uid ? category.uid : null;
}

/**
 * Zadanie należy do kalendarza, gdy jest w jego kategorii, a podzadanie —
 * gdy należy do niego zadanie nadrzędne. Zwraca, czym je opisać.
 */
async function taskLinks(
  space: string,
  task: Task,
): Promise<{ cat?: string; parent?: string } | null> {
  if (task.parentId !== undefined) {
    const parent = await db.tasks.get(task.parentId);
    if (!parent?.uid || parent.parentId !== undefined) return null;
    if (!(await sharedCategoryUid(space, parent.categoryId))) return null;
    const cat = await sharedCategoryUid(space, task.categoryId);
    return { parent: parent.uid, ...(cat ? { cat } : {}) };
  }
  const cat = await sharedCategoryUid(space, task.categoryId);
  return cat ? { cat } : null;
}

/** `uid` wspólnej kategorii, do której przypięty jest budżet — albo null. */
async function budgetCategoryUid(space: string): Promise<string | null> {
  const settings = await db.budgetSettings.get('budzet');
  return sharedCategoryUid(space, settings?.categoryId);
}

// ── Treść rekordów ───────────────────────────────────────────────────────

const categoryJson = (c: Category) => canonical({ k: 'c', uid: c.uid, name: c.name, color: c.color });

const memberJson = (m: Member) =>
  canonical({ k: 'm', uid: m.uid, name: m.name, joinedAt: m.joinedAt, by: m.by });

const eventJson = (e: EventItem, cat: string) =>
  canonical({
    k: 'e',
    uid: e.uid,
    cat,
    title: e.title,
    date: e.date,
    allDay: e.allDay,
    startTime: e.startTime,
    endTime: e.endTime,
    note: e.note,
    series: e.seriesId !== undefined ? String(e.seriesId) : undefined,
    repeat: e.repeat,
    createdAt: e.createdAt,
  });

const taskJson = (t: Task, links: { cat?: string; parent?: string }) =>
  canonical({
    k: 't',
    uid: t.uid,
    cat: links.cat,
    parent: links.parent,
    title: t.title,
    note: t.note,
    done: t.done,
    doneAt: t.doneAt,
    starred: t.starred,
    quick: t.quick,
    startDate: t.startDate,
    dueDate: t.dueDate,
    series: t.seriesId !== undefined ? String(t.seriesId) : undefined,
    repeat: t.repeat,
    order: t.order,
    createdAt: t.createdAt,
  });

const habitJson = (h: Habit, cat: string) =>
  canonical({
    k: 'h',
    uid: h.uid,
    cat,
    name: h.name,
    kind: h.kind,
    target: h.target,
    unit: h.unit,
    period: h.period,
    archived: h.archived,
    order: h.order,
    createdAt: h.createdAt,
  });

const entryJson = (habitUid: string, date: string, value: number) =>
  canonical({ k: 'd', uid: entryUid(habitUid, date), habit: habitUid, date, value });

const listJson = (l: Checklist, cat: string) =>
  canonical({ k: 'l', uid: l.uid, cat, name: l.name, note: l.note, order: l.order, createdAt: l.createdAt });

const itemJson = (
  i: { uid?: string; text: string; done: boolean; order: number; createdAt: number },
  listUid: string,
) =>
  canonical({
    k: 'i',
    uid: i.uid,
    list: listUid,
    text: i.text,
    done: i.done,
    order: i.order,
    createdAt: i.createdAt,
  });

const moneyCategoryJson = (c: MoneyCategory) =>
  canonical({ k: 'k', uid: c.uid, kind: c.kind, name: c.name, color: c.color, goal: c.goal, order: c.order });

const goalJson = (g: SavingsGoal) =>
  canonical({
    k: 's',
    uid: g.uid,
    name: g.name,
    target: g.target,
    deadline: g.deadline,
    order: g.order,
    createdAt: g.createdAt,
  });

async function entryJsonLocal(e: MoneyEntry): Promise<string> {
  const cat = e.categoryId !== undefined ? (await db.moneyCategories.get(e.categoryId))?.uid : undefined;
  const goal = e.goalId !== undefined ? (await db.savingsGoals.get(e.goalId))?.uid : undefined;
  return canonical({
    k: 'x',
    uid: e.uid,
    kind: e.kind,
    amount: e.amount,
    date: e.date,
    cat,
    goal,
    note: e.note,
    paidBy: e.paidBy,
    createdAt: e.createdAt,
  });
}

/** Obecna treść jednego rekordu kalendarza albo null, gdy lokalnie go nie ma. */
async function localJson(space: string, letter: Letter, uid: string): Promise<string | null> {
  switch (letter) {
    case 'c': {
      const c = await db.categories.where('uid').equals(uid).first();
      return c?.space === space ? categoryJson(c) : null;
    }
    case 'm': {
      const m = await db.members.get(uid);
      return m?.space === space ? memberJson(m) : null;
    }
    case 'e': {
      const e = await db.events.where('uid').equals(uid).first();
      const cat = e ? await sharedCategoryUid(space, e.categoryId) : null;
      return e && cat ? eventJson(e, cat) : null;
    }
    case 't': {
      const t = await db.tasks.where('uid').equals(uid).first();
      const links = t ? await taskLinks(space, t) : null;
      return t && links ? taskJson(t, links) : null;
    }
    case 'h': {
      const h = await db.habits.where('uid').equals(uid).first();
      const cat = h ? await sharedCategoryUid(space, h.categoryId) : null;
      return h && cat ? habitJson(h, cat) : null;
    }
    case 'd': {
      const parsed = parseEntryUid(uid);
      if (!parsed) return null;
      const h = await db.habits.where('uid').equals(parsed.habitUid).first();
      if (!h || !(await sharedCategoryUid(space, h.categoryId))) return null;
      const entry = await db.habitEntries.where('[habitId+date]').equals([h.id!, parsed.date]).first();
      return entry && entry.value > 0 ? entryJson(parsed.habitUid, parsed.date, entry.value) : null;
    }
    case 'l': {
      const l = await db.lists.where('uid').equals(uid).first();
      const cat = l ? await sharedCategoryUid(space, l.categoryId) : null;
      return l && cat ? listJson(l, cat) : null;
    }
    case 'i': {
      const i = await db.listItems.where('uid').equals(uid).first();
      if (!i) return null;
      const l = await db.lists.get(i.listId);
      return l?.uid && (await sharedCategoryUid(space, l.categoryId)) ? itemJson(i, l.uid) : null;
    }
    case 'u': {
      const cat = await budgetCategoryUid(space);
      const settings = await db.budgetSettings.get('budzet');
      return cat && settings ? canonical({ k: 'u', uid: BUDGET_UID, cat, currency: settings.currency }) : null;
    }
    case 'k': {
      if (!(await budgetCategoryUid(space))) return null;
      const c = await db.moneyCategories.where('uid').equals(uid).first();
      return c ? moneyCategoryJson(c) : null;
    }
    case 's': {
      if (!(await budgetCategoryUid(space))) return null;
      const g = await db.savingsGoals.where('uid').equals(uid).first();
      return g ? goalJson(g) : null;
    }
    case 'x': {
      if (!(await budgetCategoryUid(space))) return null;
      const e = await db.moneyEntries.where('uid').equals(uid).first();
      return e ? entryJsonLocal(e) : null;
    }
  }
}

/** Wszystkie rekordy kalendarza w obecnym stanie, z gotową treścią do porównania. */
async function localSet(space: string): Promise<Map<string, SyncShadow>> {
  const out = new Map<string, SyncShadow>();
  const put = (letter: Letter, uid: string, json: string) =>
    out.set(uid, { uid, space, kind: KIND_BY_LETTER[letter], json });

  const categories = (await db.categories.where('space').equals(space).toArray()).filter((c) => c.uid);
  const catIds = categories.map((c) => c.id!);
  const catUid = new Map(categories.map((c) => [c.id!, c.uid!]));
  for (const c of categories) put('c', c.uid!, categoryJson(c));
  for (const m of await db.members.where('space').equals(space).toArray()) put('m', m.uid, memberJson(m));
  if (catIds.length === 0) return out;

  for (const e of await db.events.where('categoryId').anyOf(catIds).toArray()) {
    if (e.uid) put('e', e.uid, eventJson(e, catUid.get(e.categoryId!)!));
  }

  const parents = (await db.tasks.where('categoryId').anyOf(catIds).toArray()).filter(
    (t) => t.uid && t.parentId === undefined,
  );
  for (const t of parents) put('t', t.uid!, taskJson(t, { cat: catUid.get(t.categoryId!)! }));
  if (parents.length > 0) {
    const parentUid = new Map(parents.map((t) => [t.id!, t.uid!]));
    for (const t of await db.tasks.where('parentId').anyOf([...parentUid.keys()]).toArray()) {
      if (!t.uid) continue;
      const cat = t.categoryId !== undefined ? catUid.get(t.categoryId) : undefined;
      put('t', t.uid, taskJson(t, { parent: parentUid.get(t.parentId!)!, ...(cat ? { cat } : {}) }));
    }
  }

  const habits = (await db.habits.where('categoryId').anyOf(catIds).toArray()).filter((h) => h.uid);
  for (const h of habits) {
    put('h', h.uid!, habitJson(h, catUid.get(h.categoryId!)!));
    for (const entry of await db.habitEntries.where('habitId').equals(h.id!).toArray()) {
      if (entry.value > 0) put('d', entryUid(h.uid!, entry.date), entryJson(h.uid!, entry.date, entry.value));
    }
  }

  const lists = (await db.lists.where('categoryId').anyOf(catIds).toArray()).filter((l) => l.uid);
  for (const l of lists) {
    put('l', l.uid!, listJson(l, catUid.get(l.categoryId!)!));
    for (const item of await db.listItems.where('listId').equals(l.id!).toArray()) {
      if (item.uid) put('i', item.uid, itemJson(item, l.uid!));
    }
  }

  // Budżet — w całości, gdy jest przypięty do kategorii tego kalendarza.
  const budgetCat = await budgetCategoryUid(space);
  if (budgetCat) {
    const settings = (await db.budgetSettings.get('budzet'))!;
    put('u', BUDGET_UID, canonical({ k: 'u', uid: BUDGET_UID, cat: budgetCat, currency: settings.currency }));
    for (const c of await db.moneyCategories.toArray()) if (c.uid) put('k', c.uid, moneyCategoryJson(c));
    for (const g of await db.savingsGoals.toArray()) if (g.uid) put('s', g.uid, goalJson(g));
    for (const e of await db.moneyEntries.toArray()) if (e.uid) put('x', e.uid, await entryJsonLocal(e));
  }
  return out;
}

/** Nadaje `uid` wszystkiemu, co należy do kalendarza, a jeszcze go nie ma. */
async function ensureUids(space: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.categories,
      db.events,
      db.tasks,
      db.habits,
      db.lists,
      db.listItems,
      db.budgetSettings,
      db.moneyCategories,
      db.moneyEntries,
      db.savingsGoals,
    ],
    async () => {
      const categories = await db.categories.where('space').equals(space).toArray();
      for (const c of categories) if (!c.uid) await db.categories.update(c.id!, { uid: randomId() });
      const ids = categories.map((c) => c.id!);
      if (ids.length === 0) return;

      const give = async <T extends { id?: number; uid?: string }>(
        rows: T[],
        update: (id: number, uid: string) => Promise<unknown>,
      ) => {
        for (const row of rows) if (!row.uid) await update(row.id!, randomId());
      };

      await give(await db.events.where('categoryId').anyOf(ids).toArray(), (id, uid) =>
        db.events.update(id, { uid }),
      );
      const parents = (await db.tasks.where('categoryId').anyOf(ids).toArray()).filter(
        (t) => t.parentId === undefined,
      );
      await give(parents, (id, uid) => db.tasks.update(id, { uid }));
      await give(await db.tasks.where('parentId').anyOf(parents.map((t) => t.id!)).toArray(), (id, uid) =>
        db.tasks.update(id, { uid }),
      );
      await give(await db.habits.where('categoryId').anyOf(ids).toArray(), (id, uid) =>
        db.habits.update(id, { uid }),
      );
      const lists = await db.lists.where('categoryId').anyOf(ids).toArray();
      await give(lists, (id, uid) => db.lists.update(id, { uid }));
      await give(await db.listItems.where('listId').anyOf(lists.map((l) => l.id!)).toArray(), (id, uid) =>
        db.listItems.update(id, { uid }),
      );
      if (await budgetCategoryUid(space)) {
        await give(await db.moneyCategories.toArray(), (id, uid) => db.moneyCategories.update(id, { uid }));
        await give(await db.savingsGoals.toArray(), (id, uid) => db.savingsGoals.update(id, { uid }));
        await give(await db.moneyEntries.toArray(), (id, uid) => db.moneyEntries.update(id, { uid }));
      }
    },
  );
}

function parsePayload(text: string): Payload | null {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    if (typeof value.k !== 'string' || !LETTERS.has(value.k) || !isUid(value.uid)) return null;
    return value as Payload;
  } catch {
    return null;
  }
}

/**
 * Kolejność nakładania: najpierw kategoria, członkowie i ustawienia budżetu,
 * potem to, co wisi bezpośrednio na nich, potem to, co wisi na tamtym
 * (podzadania, odhaczenia, pozycje list, wpisy), a usunięcie kategorii
 * i odpięcie budżetu na samym końcu.
 */
function applyOrder(p: Payload): number {
  if (p.k === 'c') return p.del ? 3 : 0;
  // Odpięcie budżetu też na końcu — wcześniej wpisy budżetu wyglądałyby na
  // lokalnie zmienione i ich usunięcia zostałyby pominięte.
  if (p.k === 'u') return p.del ? 3 : 0;
  if (p.k === 'm') return 0;
  if (p.k === 'h' || p.k === 'l' || p.k === 'k' || p.k === 's') return 1;
  if (p.k === 't') return p.parent ? 2 : 1;
  return 2;
}

/** Usuwa z kategorii wszystko, co było wspólne; prywatne rzeczy tylko odpina. */
async function dropSharedCategory(category: Category): Promise<void> {
  const id = category.id!;
  await db.events.where('categoryId').equals(id).and((e) => !!e.uid).delete();
  const tasks = await db.tasks.where('categoryId').equals(id).and((t) => !!t.uid).toArray();
  await db.tasks.where('parentId').anyOf(tasks.map((t) => t.id!)).and((t) => !!t.uid).delete();
  await db.tasks.bulkDelete(tasks.map((t) => t.id!));
  const habits = await db.habits.where('categoryId').equals(id).and((h) => !!h.uid).toArray();
  await db.habitEntries.where('habitId').anyOf(habits.map((h) => h.id!)).delete();
  await db.habits.bulkDelete(habits.map((h) => h.id!));
  const lists = await db.lists.where('categoryId').equals(id).and((l) => !!l.uid).toArray();
  await db.listItems.where('listId').anyOf(lists.map((l) => l.id!)).delete();
  await db.lists.bulkDelete(lists.map((l) => l.id!));

  // Budżet przypięty do tej kategorii: wspólne wpisy znikają, budżet się odpina.
  const settings = await db.budgetSettings.get('budzet');
  if (settings?.categoryId === id) {
    await db.moneyEntries.filter((e) => !!e.uid).delete();
    await db.savingsGoals.filter((g) => !!g.uid).delete();
    await db.moneyCategories.filter((c) => !!c.uid).delete();
    await db.budgetSettings.put({ id: 'budzet', currency: settings.currency });
  }

  await db.events.where('categoryId').equals(id).modify({ categoryId: undefined });
  await db.tasks.where('categoryId').equals(id).modify({ categoryId: undefined });
  await db.habits.where('categoryId').equals(id).modify({ categoryId: undefined });
  await db.lists.where('categoryId').equals(id).modify({ categoryId: undefined });
  await db.categories.delete(id);
}

async function applyDelete(space: string, p: Payload): Promise<void> {
  switch (p.k) {
    case 'c': {
      const category = await db.categories.where('uid').equals(p.uid).first();
      if (category?.space === space) await dropSharedCategory(category);
      return;
    }
    case 'm':
      await db.members.delete(p.uid);
      return;
    case 'e':
      await db.events.where('uid').equals(p.uid).delete();
      return;
    case 't': {
      const task = await db.tasks.where('uid').equals(p.uid).first();
      if (!task) return;
      await db.tasks.where('parentId').equals(task.id!).and((t) => !!t.uid).delete();
      await db.tasks.delete(task.id!);
      return;
    }
    case 'h': {
      const habit = await db.habits.where('uid').equals(p.uid).first();
      if (!habit) return;
      await db.habitEntries.where('habitId').equals(habit.id!).delete();
      await db.habits.delete(habit.id!);
      return;
    }
    case 'd': {
      const parsed = parseEntryUid(p.uid);
      const habit = parsed ? await db.habits.where('uid').equals(parsed.habitUid).first() : undefined;
      if (habit && parsed) {
        await db.habitEntries.where('[habitId+date]').equals([habit.id!, parsed.date]).delete();
      }
      return;
    }
    case 'l': {
      const list = await db.lists.where('uid').equals(p.uid).first();
      if (!list) return;
      await db.listItems.where('listId').equals(list.id!).delete();
      await db.lists.delete(list.id!);
      return;
    }
    case 'i':
      await db.listItems.where('uid').equals(p.uid).delete();
      return;
    case 'u': {
      // Ktoś odpiął budżet od kalendarza — u nas też przestaje być wspólny.
      const settings = await db.budgetSettings.get('budzet');
      if (settings && (await budgetCategoryUid(space))) {
        await db.budgetSettings.put({ id: 'budzet', currency: settings.currency });
      }
      return;
    }
    case 'k': {
      const c = await db.moneyCategories.where('uid').equals(p.uid).first();
      if (!c) return;
      await db.moneyEntries
        .where('categoryId')
        .equals(c.id!)
        .modify((entry) => {
          delete entry.categoryId;
        });
      await db.moneyCategories.delete(c.id!);
      return;
    }
    case 's': {
      const g = await db.savingsGoals.where('uid').equals(p.uid).first();
      if (!g) return;
      await db.moneyEntries.where('goalId').equals(g.id!).delete();
      await db.savingsGoals.delete(g.id!);
      return;
    }
    case 'x':
      await db.moneyEntries.where('uid').equals(p.uid).delete();
      return;
  }
}

/** Lokalne id wspólnej kategorii o podanym `uid` albo undefined. */
async function localCategoryId(space: string, uid: unknown): Promise<number | undefined> {
  if (typeof uid !== 'string') return undefined;
  const category = await db.categories.where('uid').equals(uid).first();
  return category?.space === space ? category.id : undefined;
}

const seriesNumber = (value: unknown) => {
  const n = typeof value === 'string' ? Number(value) : NaN;
  return Number.isSafeInteger(n) ? n : undefined;
};

/** Wstawia albo podmienia rekord znaleziony po `uid`, zachowując lokalne id. */
async function upsertByUid<T extends { id?: number }>(
  table: { where(index: string): { equals(v: string): { first(): Promise<T | undefined> } } } & {
    update(id: number, changes: Partial<T>): Promise<number>;
    add(item: T): Promise<number>;
  },
  uid: string,
  value: T,
): Promise<void> {
  const existing = await table.where('uid').equals(uid).first();
  if (existing?.id !== undefined) await table.update(existing.id, { ...value, id: existing.id });
  else await table.add(value);
}

/** Nakłada jeden rekord z serwera; rekord, którego nie da się zrozumieć, pomija. */
async function applyUpsert(space: string, p: Payload): Promise<void> {
  switch (p.k) {
    case 'c': {
      const valid = validCategory({ name: p.name, color: p.color, order: 0 });
      if (!valid) return;
      const existing = await db.categories.where('uid').equals(p.uid).first();
      if (existing) {
        await db.categories.update(existing.id!, { name: valid.name, color: valid.color, space });
      } else {
        await db.categories.add({
          name: valid.name,
          color: valid.color,
          order: await db.categories.count(),
          uid: p.uid,
          space,
        });
      }
      return;
    }
    case 'm': {
      const name = cleanMemberName(p.name);
      if (!name || typeof p.joinedAt !== 'number') return;
      await db.members.put({
        uid: p.uid,
        space,
        name,
        joinedAt: p.joinedAt,
        ...(isUid(p.by) ? { by: p.by } : {}),
      });
      return;
    }
    case 'e': {
      const categoryId = await localCategoryId(space, p.cat);
      if (categoryId === undefined) return;
      const valid = validEvent({ ...p, categoryId, seriesId: seriesNumber(p.series), id: undefined });
      if (valid) await upsertByUid(db.events, p.uid, { ...valid, uid: p.uid });
      return;
    }
    case 't': {
      const categoryId = await localCategoryId(space, p.cat);
      let parentId: number | undefined;
      if (typeof p.parent === 'string') {
        parentId = (await db.tasks.where('uid').equals(p.parent).first())?.id;
        if (parentId === undefined) return;
      } else if (categoryId === undefined) {
        return;
      }
      const valid = validTask({
        ...p,
        categoryId,
        parentId,
        seriesId: seriesNumber(p.series),
        id: undefined,
      });
      if (valid) await upsertByUid(db.tasks, p.uid, { ...valid, uid: p.uid });
      return;
    }
    case 'h': {
      const categoryId = await localCategoryId(space, p.cat);
      if (categoryId === undefined) return;
      const valid = validHabit({ ...p, categoryId, id: undefined });
      if (valid) await upsertByUid(db.habits, p.uid, { ...valid, uid: p.uid });
      return;
    }
    case 'd': {
      const parsed = parseEntryUid(p.uid);
      if (!parsed || typeof p.value !== 'number') return;
      const habit = await db.habits.where('uid').equals(parsed.habitUid).first();
      if (!habit || !(await sharedCategoryUid(space, habit.categoryId))) return;
      const value = Math.min(habit.target, Math.max(0, Math.round(p.value)));
      const existing = await db.habitEntries.where('[habitId+date]').equals([habit.id!, parsed.date]).first();
      if (value === 0) {
        if (existing?.id) await db.habitEntries.delete(existing.id);
      } else if (existing?.id) {
        await db.habitEntries.update(existing.id, { value });
      } else {
        await db.habitEntries.add({ habitId: habit.id!, date: parsed.date, value });
      }
      return;
    }
    case 'l': {
      const categoryId = await localCategoryId(space, p.cat);
      if (categoryId === undefined) return;
      const valid = validChecklist({ ...p, categoryId, id: undefined });
      if (valid) await upsertByUid(db.lists, p.uid, { ...valid, uid: p.uid });
      return;
    }
    case 'u': {
      const categoryId = await localCategoryId(space, p.cat);
      if (categoryId === undefined || typeof p.currency !== 'string' || !/^[A-Z]{3}$/.test(p.currency)) return;
      await db.budgetSettings.put({ id: 'budzet', currency: p.currency, categoryId });
      return;
    }
    case 'k': {
      if (!(await budgetCategoryUid(space))) return;
      const valid = validMoneyCategory({ ...p, id: undefined });
      if (valid) await upsertByUid(db.moneyCategories, p.uid, { ...valid, uid: p.uid });
      return;
    }
    case 's': {
      if (!(await budgetCategoryUid(space))) return;
      const valid = validSavingsGoal({ ...p, id: undefined });
      if (valid) await upsertByUid(db.savingsGoals, p.uid, { ...valid, uid: p.uid });
      return;
    }
    case 'x': {
      if (!(await budgetCategoryUid(space))) return;
      let categoryId: number | undefined;
      let goalId: number | undefined;
      if (typeof p.cat === 'string') {
        categoryId = (await db.moneyCategories.where('uid').equals(p.cat).first())?.id;
        if (categoryId === undefined) return;
      }
      if (typeof p.goal === 'string') {
        goalId = (await db.savingsGoals.where('uid').equals(p.goal).first())?.id;
        if (goalId === undefined) return;
      }
      const valid = validMoneyEntry({ ...p, categoryId, goalId, id: undefined });
      if (valid) await upsertByUid(db.moneyEntries, p.uid, { ...valid, uid: p.uid });
      return;
    }
    case 'i': {
      const list = typeof p.list === 'string' ? await db.lists.where('uid').equals(p.list).first() : undefined;
      if (!list?.id || !(await sharedCategoryUid(space, list.categoryId))) return;
      const valid = validChecklistItem({ ...p, listId: list.id, id: undefined });
      if (valid) await upsertByUid(db.listItems, p.uid, { ...valid, uid: p.uid });
      return;
    }
  }
}

/** Nakłada jedną zmianę z serwera, chyba że lokalna zmiana ma pierwszeństwo. */
async function applyRemote(space: string, payload: Payload): Promise<void> {
  const shadow = await db.syncShadow.get(payload.uid);
  const local = await localJson(space, payload.k, payload.uid);

  // Lokalnie zmienione albo usunięte od ostatniej synchronizacji — wygrywa
  // lokalna wersja, wyślemy ją za chwilę. Rekord nigdy nieuzgodniony (brak
  // cienia) przyjmuje wersję z serwera.
  if (shadow !== undefined && local !== shadow.json) return;

  if (payload.del) {
    await applyDelete(space, payload);
    await db.syncShadow.delete(payload.uid);
    return;
  }

  await applyUpsert(space, payload);
  const after = await localJson(space, payload.k, payload.uid);
  // Rekord, którego nie dało się nałożyć (np. brak rodzica), nie dostaje
  // cienia — wróci przy następnej pełnej synchronizacji.
  if (after === null) return;
  await db.syncShadow.put({ uid: payload.uid, space, kind: KIND_BY_LETTER[payload.k], json: after });
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

  // 1. Pobranie zmian innych osób. Po zmianie formatu — od początku, bo
  // starsza wersja mogła pominąć rekordy, których nie rozumiała. Cienie
  // zostają, więc to, co już się zgadza, nie zmieni się ani nie wróci.
  let since = state.format === SYNC_FORMAT ? state.lastSeq : 0;
  const incoming: Payload[] = [];
  for (;;) {
    const page = await transport.pull(space, token, since);
    for (const record of page.records) {
      const text = await decryptText(cipherKey, record.blob);
      const payload = text ? parsePayload(text) : null;
      if (payload && payload.uid === record.uid) incoming.push(payload);
    }
    // Serwer, który mówi „jest więcej”, ale nie posuwa numeru dalej, zapętliłby
    // nas w nieskończoność — wtedy przerywamy i spróbujemy przy następnej okazji.
    if (!page.more || page.seq <= since) {
      since = Math.max(since, page.seq);
      break;
    }
    since = page.seq;
  }

  incoming.sort((a, b) => applyOrder(a) - applyOrder(b));
  await db.transaction(
    'rw',
    [
      db.categories,
      db.events,
      db.tasks,
      db.habits,
      db.habitEntries,
      db.lists,
      db.listItems,
      db.members,
      db.syncShadow,
      db.budgetSettings,
      db.moneyCategories,
      db.moneyEntries,
      db.savingsGoals,
    ],
    async () => {
      for (const payload of incoming) await applyRemote(space, payload);
    },
  );
  // Kalendarz mógł zostać w międzyczasie opuszczony — wtedy nic nie zapisujemy.
  if (!(await db.syncState.get(space))) return;
  await db.syncState.update(space, { lastSeq: since, format: SYNC_FORMAT });

  // 2. Wysłanie lokalnych zmian.
  const current = await localSet(space);
  const shadows = await db.syncShadow.where('space').equals(space).toArray();
  const shadowByUid = new Map(shadows.map((s) => [s.uid, s]));
  const outgoing: { uid: string; text: string; shadow: SyncShadow | null }[] = [];

  for (const record of current.values()) {
    if (shadowByUid.get(record.uid)?.json !== record.json) {
      outgoing.push({ uid: record.uid, text: record.json, shadow: record });
    }
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
