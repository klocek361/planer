import { db } from './db';
import { MAX_DAY_NOTE } from './validate';

/**
 * Notatki dnia we wspólnych kalendarzach: jedna na kalendarz i dzień,
 * widoczna dla wszystkich członków. Pusty tekst usuwa notatkę.
 */
export async function saveDayNote(categoryId: number, date: string, text: string): Promise<void> {
  const clean = text.trim().slice(0, MAX_DAY_NOTE);
  await db.transaction('rw', db.dayNotes, db.categories, db.syncState, async () => {
    const existing = await db.dayNotes.where('[categoryId+date]').equals([categoryId, date]).first();
    if (!clean) {
      if (existing?.id !== undefined) await db.dayNotes.delete(existing.id);
      return;
    }
    if (existing?.text === clean) return;
    const category = await db.categories.get(categoryId);
    const state = category?.space ? await db.syncState.get(category.space) : undefined;
    const note = {
      categoryId,
      date,
      text: clean,
      ...(state ? { by: state.memberId } : {}),
      updatedAt: Date.now(),
    };
    if (existing?.id !== undefined) await db.dayNotes.put({ ...note, id: existing.id });
    else await db.dayNotes.add(note);
  });
}
