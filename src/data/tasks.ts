import { db } from './db';
import type { Priority, Task } from './types';

export interface TaskDraft {
  title: string;
  priority: Priority;
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

  if (a.priority !== b.priority) return b.priority - a.priority;
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
