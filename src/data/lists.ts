import { db } from './db';
import type { Checklist, ChecklistItem } from './types';

export interface ChecklistDraft {
  name: string;
  note?: string;
  categoryId?: number;
}

export async function addChecklist(draft: ChecklistDraft): Promise<number> {
  const count = await db.lists.count();
  return db.lists.add({
    ...draft,
    name: draft.name.trim(),
    note: draft.note?.trim() || undefined,
    order: count,
    createdAt: Date.now(),
  });
}

export async function updateChecklist(
  id: number,
  changes: Partial<Checklist>,
): Promise<void> {
  const next = { ...changes };
  if (typeof next.name === 'string') next.name = next.name.trim();
  if (typeof next.note === 'string') next.note = next.note.trim() || undefined;
  await db.lists.update(id, next);
}

/** Kasuje listę razem ze wszystkimi jej pozycjami. */
export async function deleteChecklist(id: number): Promise<void> {
  await db.transaction('rw', db.lists, db.listItems, async () => {
    await db.listItems.where('listId').equals(id).delete();
    await db.lists.delete(id);
  });
}

export async function moveChecklist(id: number, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.lists, async () => {
    const all = await db.lists.orderBy('order').toArray();
    const index = all.findIndex((lista) => lista.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= all.length) return;

    const a = all[index]!;
    const b = all[target]!;
    await db.lists.update(a.id!, { order: b.order });
    await db.lists.update(b.id!, { order: a.order });
  });
}

/**
 * Dopisuje pozycję na koniec listy. Pusty tekst jest pomijany — przy dopisywaniu
 * z klawiatury łatwo o przypadkowe zatwierdzenie niczego.
 */
export async function addItem(listId: number, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const count = await db.listItems.where('listId').equals(listId).count();
  await db.listItems.add({
    listId,
    text: trimmed,
    done: false,
    order: count,
    createdAt: Date.now(),
  });
}

export async function updateItem(id: number, changes: Partial<ChecklistItem>): Promise<void> {
  const next = { ...changes };
  if (typeof next.text === 'string') next.text = next.text.trim();
  await db.listItems.update(id, next);
}

export async function toggleItem(id: number, done: boolean): Promise<void> {
  await db.listItems.update(id, { done });
}

export async function deleteItem(id: number): Promise<void> {
  await db.listItems.delete(id);
}

/**
 * Zdejmuje odhaczenie ze wszystkich pozycji. Bez tego lista zakupów byłaby
 * jednorazowa — a chodzi o to, żeby tę samą listę odhaczać co tydzień.
 */
export async function uncheckAll(listId: number): Promise<void> {
  await db.listItems.where('listId').equals(listId).modify({ done: false });
}

/** Kasuje wszystkie odhaczone pozycje listy. */
export async function clearDone(listId: number): Promise<void> {
  await db.transaction('rw', db.listItems, async () => {
    const zrobione = await db.listItems.where('listId').equals(listId).toArray();
    await db.listItems.bulkDelete(
      zrobione.filter((pozycja) => pozycja.done).map((pozycja) => pozycja.id!),
    );
  });
}

export interface ListCounts {
  done: number;
  total: number;
  /** Kilka pierwszych nieodhaczonych pozycji — podgląd w spisie list. */
  preview: string[];
}

/** Podsumowanie listy do spisu: ile odhaczone i co jeszcze zostało. */
export function summarizeList(items: ChecklistItem[], previewCount = 3): ListCounts {
  const done = items.filter((pozycja) => pozycja.done).length;
  const preview = items
    .filter((pozycja) => !pozycja.done)
    .sort((a, b) => a.order - b.order)
    .slice(0, previewCount)
    .map((pozycja) => pozycja.text);
  return { done, total: items.length, preview };
}

/** Pozycje w kolejności dopisywania — odhaczone osobno, żeby zeszły na dół. */
export function splitItems(items: ChecklistItem[]): {
  open: ChecklistItem[];
  done: ChecklistItem[];
} {
  const posortowane = items.slice().sort((a, b) => a.order - b.order);
  return {
    open: posortowane.filter((pozycja) => !pozycja.done),
    done: posortowane.filter((pozycja) => pozycja.done),
  };
}
