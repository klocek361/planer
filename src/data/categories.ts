import { db } from './db';
import type { Category } from './types';

export async function addCategory(name: string, color: string): Promise<void> {
  const count = await db.categories.count();
  await db.categories.add({ name: name.trim(), color, order: count });
}

export async function updateCategory(id: number, changes: Partial<Category>): Promise<void> {
  await db.categories.update(id, changes);
}

/**
 * Usuwa kategorię i odpina ją od wszystkiego, co się do niej odwoływało.
 * Bez tego wydarzenia i zadania zostałyby ze wskaźnikiem na nieistniejący wpis
 * i straciły kolor.
 */
export async function deleteCategory(id: number): Promise<void> {
  await db.transaction('rw', db.categories, db.events, db.tasks, db.habits, async () => {
    await db.events.where('categoryId').equals(id).modify({ categoryId: undefined });
    await db.tasks.where('categoryId').equals(id).modify({ categoryId: undefined });
    await db.habits.where('categoryId').equals(id).modify({ categoryId: undefined });
    await db.categories.delete(id);
  });
}

/** Przesuwa kategorię o jedną pozycję w górę lub w dół listy. */
export async function moveCategory(id: number, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const all = await db.categories.orderBy('order').toArray();
    const index = all.findIndex((c) => c.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= all.length) return;

    const a = all[index]!;
    const b = all[target]!;
    await db.categories.update(a.id!, { order: b.order });
    await db.categories.update(b.id!, { order: a.order });
  });
}
