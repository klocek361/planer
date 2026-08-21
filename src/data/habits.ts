import { habitStrip, monthDays, previousDay, toKey } from '../lib/dates';
import { db } from './db';
import type { Habit, HabitEntry, HabitKind, HabitPeriod } from './types';

export interface HabitDraft {
  name: string;
  kind: HabitKind;
  target: number;
  unit?: string;
  period: HabitPeriod;
  categoryId?: number;
}

export async function addHabit(draft: HabitDraft): Promise<void> {
  const count = await db.habits.count();
  await db.habits.add({
    ...draft,
    name: draft.name.trim(),
    // Nawyk typu tak-nie zawsze ma cel równy 1 — licznik trzyma własny.
    target: draft.kind === 'tak-nie' ? 1 : Math.max(1, draft.target),
    order: count,
    archived: false,
    createdAt: Date.now(),
  });
}

export async function updateHabit(id: number, changes: Partial<Habit>): Promise<void> {
  const next = { ...changes };
  if (next.kind === 'tak-nie') next.target = 1;
  if (next.target !== undefined) next.target = Math.max(1, next.target);
  await db.habits.update(id, next);
}

/** Usuwa nawyk razem z całą jego historią. */
export async function deleteHabit(id: number): Promise<void> {
  await db.transaction('rw', db.habits, db.habitEntries, async () => {
    await db.habitEntries.where('habitId').equals(id).delete();
    await db.habits.delete(id);
  });
}

/** Ustawia wartość na dany dzień, tworząc wpis albo kasując go przy zerze. */
export async function setHabitValue(habitId: number, date: string, value: number): Promise<void> {
  const clamped = Math.max(0, Math.round(value));
  await db.transaction('rw', db.habitEntries, async () => {
    const existing = await db.habitEntries.where('[habitId+date]').equals([habitId, date]).first();

    if (clamped === 0) {
      if (existing?.id) await db.habitEntries.delete(existing.id);
      return;
    }
    if (existing?.id) await db.habitEntries.update(existing.id, { value: clamped });
    else await db.habitEntries.add({ habitId, date, value: clamped });
  });
}

export function entriesBetween(from: string, to: string): Promise<HabitEntry[]> {
  return db.habitEntries.where('date').between(from, to, true, true).toArray();
}

/** Wpisy ułożone jako nawyk → dzień → wartość. */
export function indexEntries(entries: HabitEntry[]): Map<number, Map<string, number>> {
  const byHabit = new Map<number, Map<string, number>>();
  for (const entry of entries) {
    let days = byHabit.get(entry.habitId);
    if (!days) {
      days = new Map();
      byHabit.set(entry.habitId, days);
    }
    days.set(entry.date, entry.value);
  }
  return byHabit;
}

export function isDayComplete(habit: Habit, value: number | undefined): boolean {
  return (value ?? 0) >= habit.target;
}

/**
 * Stan pojedynczego pola na pasku nawyku.
 * - 'przed'    — dzień sprzed założenia nawyku; nie liczy się do niczego.
 * - 'zrobiony' — cel osiągnięty.
 * - 'pusty'    — dzień minął, celu nie ma.
 * - 'przyszly' — jeszcze przed nami.
 */
export type DayState = 'przed' | 'zrobiony' | 'pusty' | 'przyszly';

export interface HabitWindow {
  /** Wszystkie pola paska, od lewej do prawej. */
  keys: string[];
  /** Dni, które już minęły i wliczają się do statystyk. */
  tracked: string[];
  /** Stan każdego pola, w tej samej kolejności co `keys`. */
  states: DayState[];
}

/**
 * Okno paska nawyku dla wybranego trybu liczenia.
 *
 * Tryb 'ciagly' biegnie od dnia założenia i przesuwa się dopiero, gdy historia
 * przerośnie szerokość paska. Tryb 'miesiac' pokazuje jeden konkretny miesiąc
 * w całości — dni sprzed założenia nawyku zostają puste, ale widoczne, żeby
 * numeracja dni zgadzała się z kalendarzem.
 */
export function habitWindow(
  habit: Habit,
  options: { stripDays: number; month: Date; todayKey: string; days?: Map<string, number> },
): HabitWindow {
  const { stripDays, month, todayKey, days } = options;
  const createdKey = toKey(new Date(habit.createdAt));

  const keys =
    habit.period === 'miesiac' ? monthDays(month) : habitStrip(habit.createdAt, stripDays);

  const tracked = keys.filter((key) => key <= todayKey && key >= createdKey);

  const states = keys.map((key): DayState => {
    if (key > todayKey) return 'przyszly';
    if (key < createdKey) return 'przed';
    return isDayComplete(habit, days?.get(key)) ? 'zrobiony' : 'pusty';
  });

  return { keys, tracked, states };
}

/**
 * Długość aktualnej serii — ile dni pod rząd cel był osiągnięty.
 * Dzisiejszy dzień jeszcze nie zerwał serii, jeśli po prostu nie został
 * odhaczony, więc przy pustym dzisiaj liczymy od wczoraj.
 */
export function currentStreak(
  habit: Habit,
  days: Map<string, number> | undefined,
  today = toKey(new Date()),
): number {
  if (!days) return 0;

  let cursor = isDayComplete(habit, days.get(today)) ? today : previousDay(today);
  let streak = 0;

  while (isDayComplete(habit, days.get(cursor))) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

/** Ile dni z podanego okresu miało cel osiągnięty. */
export function completedCount(
  habit: Habit,
  days: Map<string, number> | undefined,
  keys: string[],
): number {
  if (!days) return 0;
  return keys.filter((key) => isDayComplete(habit, days.get(key))).length;
}

export async function moveHabit(id: number, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.habits, async () => {
    const all = await db.habits.orderBy('order').toArray();
    const index = all.findIndex((h) => h.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= all.length) return;

    const a = all[index]!;
    const b = all[target]!;
    await db.habits.update(a.id!, { order: b.order });
    await db.habits.update(b.id!, { order: a.order });
  });
}
