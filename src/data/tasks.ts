import { fromKey, toKey } from '../lib/dates';
import { db } from './db';
import { MAX_REPEAT_COUNT, type Category, type Repeat, type Task } from './types';
import { addMonths } from 'date-fns';

export interface TaskDraft {
  title: string;
  starred: boolean;
  /** Początek zadania wielodniowego; bez niego zadanie ma sam termin. */
  startDate?: string;
  dueDate?: string;
  categoryId?: number;
  parentId?: number;
}

/**
 * Kolejne terminy serii, licząc od pierwszego. Miesięczny krok idzie przez
 * `addMonths`, więc 31 stycznia trafia na koniec lutego zamiast wyciekać na
 * marzec — to samo zachowanie co przy seriach wydarzeń.
 */
export function taskSeriesDates(startKey: string, repeat: Repeat): string[] {
  const count = Math.min(MAX_REPEAT_COUNT, Math.max(1, Math.round(repeat.count)));
  const start = fromKey(startKey);
  const keys: string[] = [];

  for (let i = 0; i < count; i += 1) {
    if (repeat.freq === 'miesiac') {
      keys.push(toKey(addMonths(start, i)));
      continue;
    }
    const step = repeat.freq === 'dzien' ? 1 : repeat.freq === 'tydzien' ? 7 : 14;
    const day = new Date(start);
    day.setDate(day.getDate() + i * step);
    keys.push(toKey(day));
  }
  return keys;
}

/** Ile dni trwa zadanie — żeby powtórzenia zachowały tę samą długość. */
function dlugoscWDniach(draft: TaskDraft): number {
  if (!draft.startDate || !draft.dueDate) return 0;
  return Math.round(
    (fromKey(draft.dueDate).getTime() - fromKey(draft.startDate).getTime()) / 86_400_000,
  );
}

/**
 * Dodaje zadanie, a przy podanej regule — całą serię naraz.
 * Powtarzać da się tylko zadanie z terminem: bez daty nie ma czego przesuwać.
 */
export async function addTask(draft: TaskDraft, repeat?: Repeat): Promise<void> {
  const count = await db.tasks.count();
  const createdAt = Date.now();
  const wspolne = { ...draft, title: draft.title.trim(), done: false };

  if (!repeat || repeat.count < 2 || !draft.dueDate) {
    await db.tasks.add({ ...wspolne, order: count, createdAt });
    return;
  }

  const seriesId = createdAt;
  const dlugosc = dlugoscWDniach(draft);

  await db.tasks.bulkAdd(
    taskSeriesDates(draft.dueDate, repeat).map((dueDate, i) => {
      // Zadanie wielodniowe zachowuje swoją długość w każdym powtórzeniu.
      const start = fromKey(dueDate);
      start.setDate(start.getDate() - dlugosc);
      return {
        ...wspolne,
        startDate: draft.startDate ? toKey(start) : undefined,
        dueDate,
        seriesId,
        repeat,
        order: count + i,
        createdAt,
      };
    }),
  );
}

/** Zmiana obejmująca całą serię; terminy zostają nietknięte. */
export async function updateTaskSeries(
  seriesId: number,
  changes: Partial<Omit<Task, 'id' | 'seriesId' | 'dueDate' | 'startDate'>>,
): Promise<void> {
  await db.tasks.where('seriesId').equals(seriesId).modify(changes);
}

/** Kasuje całą serię razem z podzadaniami każdego powtórzenia. */
export async function deleteTaskSeries(seriesId: number): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    const wSerii = await db.tasks.where('seriesId').equals(seriesId).toArray();
    const identyfikatory = wSerii.map((task) => task.id!).filter((id) => id !== undefined);
    await db.tasks.where('parentId').anyOf(identyfikatory).delete();
    await db.tasks.bulkDelete(identyfikatory);
  });
}

export async function updateTask(id: number, changes: Partial<Task>): Promise<void> {
  await db.tasks.update(id, changes);
}

/** Usuwa zadanie razem z jego podzadaniami — inaczej zostałyby sierotami. */
export async function deleteTask(id: number): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    await db.tasks.where('parentId').equals(id).delete();
    await db.tasks.delete(id);
  });
}

/**
 * Odhacza zadanie. Zaznaczenie zadania nadrzędnego domyka też jego podzadania —
 * inaczej zostałaby lista z odhaczonym rodzicem i otwartymi dziećmi.
 * Odznaczenie nie odwraca tego automatycznie.
 */
export async function toggleTask(id: number, done: boolean): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    await db.tasks.update(id, { done, doneAt: done ? Date.now() : undefined });
    if (done) {
      await db.tasks
        .where('parentId')
        .equals(id)
        .modify({ done: true, doneAt: Date.now() });
    }
  });
}

/** Klucz sortujący brak terminu na koniec listy. */
const NO_DUE_DATE = '￿';

/**
 * Kolejność: najpierw niezrobione, potem według terminu (najbliższy pierwszy,
 * bez terminu na końcu), a przy równym terminie ważniejsze wyżej.
 */
export function compareTasks(a: Task, b: Task): number {
  if (a.done !== b.done) return a.done ? 1 : -1;

  const aDue = a.dueDate ?? NO_DUE_DATE;
  const bDue = b.dueDate ?? NO_DUE_DATE;
  if (aDue !== bDue) return aDue < bDue ? -1 : 1;

  if (a.starred !== b.starred) return a.starred ? -1 : 1;
  return a.order - b.order;
}

/**
 * Pierwszy dzień, w którym zadanie zajmuje miejsce w kalendarzu. Zadanie bez
 * daty początku zajmuje wyłącznie dzień terminu.
 */
export function taskStart(task: Task): string | undefined {
  return task.startDate ?? task.dueDate;
}

/** Czy zadanie przypada na dany dzień — z uwzględnieniem zadań wielodniowych. */
export function coversDay(task: Task, key: string): boolean {
  const from = taskStart(task);
  return from !== undefined && task.dueDate !== undefined && from <= key && key <= task.dueDate;
}

/** Czy zadanie zahacza o podany zakres dni. */
export function overlapsRange(task: Task, from: string, to: string): boolean {
  const start = taskStart(task);
  return start !== undefined && task.dueDate !== undefined && start <= to && task.dueDate >= from;
}

/**
 * Dni z podanego zakresu, na które przypada zadanie. Dla zadania wielodniowego
 * to każdy dzień jego trwania, przycięty do oglądanego okna.
 */
export function taskDays(task: Task, from: string, to: string): string[] {
  if (!overlapsRange(task, from, to)) return [];
  const start = taskStart(task)!;
  const pierwszy = start < from ? from : start;
  const ostatni = task.dueDate! < to ? task.dueDate! : to;

  const dni: string[] = [];
  // Liczymy przez fromKey/toKey, a nie przez toISOString — ten drugi podaje
  // datę w czasie UTC i przy naszej strefie potrafi przesunąć dzień.
  const kursor = fromKey(pierwszy);
  let klucz = pierwszy;
  while (klucz <= ostatni) {
    dni.push(klucz);
    kursor.setDate(kursor.getDate() + 1);
    klucz = toKey(kursor);
  }
  return dni;
}

export interface TaskNode {
  task: Task;
  subtasks: Task[];
}

/** Układa płaską listę w pary rodzic → podzadania, każde posortowane. */
export function buildTaskTree(tasks: Task[]): TaskNode[] {
  const children = new Map<number, Task[]>();
  const roots: Task[] = [];

  for (const task of tasks) {
    if (task.parentId === undefined) {
      roots.push(task);
      continue;
    }
    const list = children.get(task.parentId);
    if (list) list.push(task);
    else children.set(task.parentId, [task]);
  }

  return roots
    .sort(compareTasks)
    .map((task) => ({
      task,
      subtasks: (children.get(task.id!) ?? []).slice().sort(compareTasks),
    }));
}

export interface CategoryGroup {
  /** Brak kategorii oznaczamy pustym wpisem na końcu listy. */
  category?: Category;
  nodes: TaskNode[];
}

/**
 * Układa zadania w bloki kategorii, w kolejności ustawionej w ustawieniach.
 * Puste kategorie odpadają, a zadania bez przypisania lądują na końcu, żeby
 * nie rozbijały rytmu nazwanych bloków.
 */
export function groupByCategory(nodes: TaskNode[], categories: Category[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  const byId = new Map<number, TaskNode[]>();
  const loose: TaskNode[] = [];

  for (const node of nodes) {
    const id = node.task.categoryId;
    if (id === undefined) {
      loose.push(node);
      continue;
    }
    const list = byId.get(id);
    if (list) list.push(node);
    else byId.set(id, [node]);
  }

  for (const category of categories.slice().sort((a, b) => a.order - b.order)) {
    const list = category.id !== undefined ? byId.get(category.id) : undefined;
    if (list?.length) {
      groups.push({ category, nodes: list });
      byId.delete(category.id!);
    }
  }

  // Zadania wskazujące na skasowaną kategorię też muszą się gdzieś zmieścić.
  for (const list of byId.values()) loose.push(...list);

  if (loose.length) groups.push({ nodes: loose.sort((a, b) => compareTasks(a.task, b.task)) });
  return groups;
}

export type DaySectionKind = 'zalegle' | 'dzien' | 'bez-terminu';

export interface DaySection {
  kind: DaySectionKind;
  /** Dzień sekcji — tylko dla `kind === 'dzien'`. */
  key?: string;
  nodes: TaskNode[];
}

/**
 * Dzieli listę zadań na sekcje dnia: zaległe, kolejne dni, na końcu te bez
 * terminu. Zadanie trwające kilka dni ląduje pod dniem dzisiejszym, jeśli
 * właśnie trwa — bo wtedy jest do zrobienia teraz, a nie dopiero w dniu,
 * w którym mija termin.
 */
export function groupByDaySections(nodes: TaskNode[], todayKey: string): DaySection[] {
  const zalegle: TaskNode[] = [];
  const bezTerminu: TaskNode[] = [];
  const dni = new Map<string, TaskNode[]>();

  for (const node of nodes) {
    const due = node.task.dueDate;
    if (!due) {
      bezTerminu.push(node);
      continue;
    }
    if (due < todayKey) {
      zalegle.push(node);
      continue;
    }
    const key = coversDay(node.task, todayKey) ? todayKey : due;
    const lista = dni.get(key);
    if (lista) lista.push(node);
    else dni.set(key, [node]);
  }

  const sekcje: DaySection[] = [];
  if (zalegle.length) {
    sekcje.push({ kind: 'zalegle', nodes: zalegle.sort((a, b) => compareTasks(a.task, b.task)) });
  }
  for (const [key, lista] of [...dni.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    sekcje.push({ kind: 'dzien', key, nodes: lista.sort((a, b) => compareTasks(a.task, b.task)) });
  }
  if (bezTerminu.length) {
    sekcje.push({
      kind: 'bez-terminu',
      nodes: bezTerminu.sort((a, b) => compareTasks(a.task, b.task)),
    });
  }
  return sekcje;
}

export interface DayGroup {
  /** 'RRRR-MM-DD' */
  key: string;
  nodes: TaskNode[];
}

/** Zadania z terminem, pogrupowane po dniach i ułożone od najwcześniejszego. */
export function groupByDay(nodes: TaskNode[]): DayGroup[] {
  const byDay = new Map<string, TaskNode[]>();
  for (const node of nodes) {
    const key = node.task.dueDate;
    if (!key) continue;
    const list = byDay.get(key);
    if (list) list.push(node);
    else byDay.set(key, [node]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, list]) => ({ key, nodes: list }));
}
