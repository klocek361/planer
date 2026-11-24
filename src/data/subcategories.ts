import { db } from './db';
import type { Subcategory } from './types';
import { MAX_SUBCATEGORY_NAME } from './validate';

/**
 * Podkategorie wspólnych kalendarzy. Należą do jednej kategorii (kalendarza);
 * zadanie i wydarzenie wskazują je polem `subcategoryId` obok `categoryId`.
 */

export async function addSubcategory(categoryId: number, name: string, color: string): Promise<number> {
  const order = await db.subcategories.where('categoryId').equals(categoryId).count();
  return db.subcategories.add({
    categoryId,
    name: name.trim().slice(0, MAX_SUBCATEGORY_NAME),
    color,
    order,
  });
}

export async function updateSubcategory(id: number, changes: { name?: string; color?: string }): Promise<void> {
  await db.subcategories.update(id, {
    ...(changes.name !== undefined ? { name: changes.name.trim().slice(0, MAX_SUBCATEGORY_NAME) } : {}),
    ...(changes.color !== undefined ? { color: changes.color } : {}),
  });
}

/** Usuwa podkategorię. Zadania i wydarzenia zostają w kalendarzu, tylko bez niej. */
export async function deleteSubcategory(id: number): Promise<void> {
  await db.transaction('rw', db.subcategories, db.tasks, db.events, async () => {
    await clearSubcategory(id);
    await db.subcategories.delete(id);
  });
}

/** Odpina podkategorię od zadań i wydarzeń (bez indeksu — przegląd całej tabeli). */
export async function clearSubcategory(id: number): Promise<void> {
  await db.tasks.filter((t) => t.subcategoryId === id).modify({ subcategoryId: undefined });
  await db.events.filter((e) => e.subcategoryId === id).modify({ subcategoryId: undefined });
}

/** Podkategoria wpisu — tylko gdy należy do jego kategorii. */
export function subcategoryOf(
  item: { categoryId?: number; subcategoryId?: number },
  subcategories: Map<number, Subcategory>,
): Subcategory | undefined {
  const sub = item.subcategoryId !== undefined ? subcategories.get(item.subcategoryId) : undefined;
  return sub && sub.categoryId === item.categoryId ? sub : undefined;
}

/**
 * Nazwa i kolor do pokazania przy zadaniu albo wydarzeniu: „Dom · Koty”
 * w kolorze podkategorii, a bez niej — to, co dała sama kategoria.
 */
export function withSubcategory(
  item: { categoryId?: number; subcategoryId?: number },
  base: { name?: string; color?: string },
  subcategories: Map<number, Subcategory>,
): { name?: string; color?: string } {
  const sub = subcategoryOf(item, subcategories);
  if (!sub || !base.name) return base;
  return { name: `${base.name} · ${sub.name}`, color: sub.color };
}
