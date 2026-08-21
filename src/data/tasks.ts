import { db } from './db';
import type { Category, Task } from './types';

export interface TaskDraft {
  title: string;
  starred: boolean;
  dueDate?: string;
  categoryId?: number;
  parentId?: number;
}

export async function addTask(draft: TaskDraft): Promise<void> {
  const count = await db.tasks.count();
  await db.tasks.add({
    ...draft,
    title: draft.title.trim(),
    done: false,
    order: count,
    createdAt: Date.now(),
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
