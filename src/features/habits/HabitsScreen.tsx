import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { entriesBetween, indexEntries, setHabitValue } from '../../data/habits';
import type { Habit } from '../../data/types';
import { lastDays, toKey } from '../../lib/dates';
import { tap } from '../../platform/haptics';
import { Screen } from '../../ui/Screen';
import { SettingsButton } from '../../ui/SettingsButton';
import { PlusIcon } from '../../ui/icons';
import { HabitCard } from './HabitCard';
import { HabitSheet } from './HabitSheet';

/** Cztery tygodnie historii na pasku pod każdym nawykiem. */
const STRIP_DAYS = 28;

export function HabitsScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [editing, setEditing] = useState<Habit | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const todayKey = useMemo(() => toKey(new Date()), []);
  const strip = useMemo(() => lastDays(STRIP_DAYS), []);

  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray());
  const entries = useLiveQuery(
    () => entriesBetween(strip[0]!, strip[strip.length - 1]!),
    [strip],
  );

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());

  const categoryColors = useMemo(() => {
    const map = new Map<number, string>();
    for (const category of categories ?? []) if (category.id) map.set(category.id, category.color);
    return map;
  }, [categories]);

  const byHabit = useMemo(() => indexEntries(entries ?? []), [entries]);

  const active = (habits ?? []).filter((habit) => !habit.archived);

  return (
    <Screen
      title="Nawyki"
      action={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
            aria-label="Nowy nawyk"
            className="text-muted active:text-ink -m-2 p-2"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
          <SettingsButton onClick={onOpenSettings} />
        </div>
      }
    >
      <ul className="flex flex-col gap-2">
        {active.map((habit) => (
          <li key={habit.id}>
            <HabitCard
              habit={habit}
              color={
                (habit.categoryId ? categoryColors.get(habit.categoryId) : undefined) ??
                'var(--c-accent)'
              }
              days={byHabit.get(habit.id!)}
              strip={strip}
              todayKey={todayKey}
              onSetValue={(value) => {
                tap();
                void setHabitValue(habit.id!, todayKey, value);
              }}
              onEdit={() => {
                setEditing(habit);
                setSheetOpen(true);
              }}
            />
          </li>
        ))}
      </ul>

      {habits !== undefined && active.length === 0 && (
        <p className="text-muted py-10 text-center text-sm">
          Brak nawyków. Dodaj pierwszy plusem u góry.
        </p>
      )}

      <HabitSheet
        open={sheetOpen}
        habit={editing}
        categories={categories ?? []}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}
