import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { entriesBetween, indexEntries, setHabitValue } from '../../data/habits';
import type { Habit } from '../../data/types';
import {
  addMonths,
  lastDays,
  monthDays,
  monthNameLabel,
  startOfMonth,
  toKey,
} from '../../lib/dates';
import { tap } from '../../platform/haptics';
import { Screen } from '../../ui/Screen';
import { SettingsButton } from '../../ui/SettingsButton';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../../ui/icons';
import { HabitCard } from './HabitCard';
import { HabitSheet } from './HabitSheet';

/**
 * Szerokość paska historii nawyku liczonego ciągle. Pasek zaczyna się w dniu
 * założenia i zapełnia w prawo; po czterech tygodniach okno zaczyna się
 * przesuwać. Nawyki liczone miesiącami mają pasek długi na cały miesiąc.
 */
const STRIP_DAYS = 28;

export function HabitsScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [editing, setEditing] = useState<Habit | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const todayKey = useMemo(() => toKey(new Date()), []);
  const strip = useMemo(() => lastDays(STRIP_DAYS), []);
  const monthKeys = useMemo(() => monthDays(month), [month]);

  // Jedno zapytanie na oba tryby — zakres obejmuje i przesuwane okno, i cały
  // oglądany miesiąc, żeby przełączanie miesięcy nie mnożyło zapytań.
  const range = useMemo(() => {
    const all = [...strip, ...monthKeys].sort();
    return { from: all[0]!, to: all[all.length - 1]! };
  }, [strip, monthKeys]);

  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray());
  const entries = useLiveQuery(() => entriesBetween(range.from, range.to), [range]);
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());

  const categoryColors = useMemo(() => {
    const map = new Map<number, string>();
    for (const category of categories ?? []) if (category.id) map.set(category.id, category.color);
    return map;
  }, [categories]);

  const byHabit = useMemo(() => indexEntries(entries ?? []), [entries]);

  const active = (habits ?? []).filter((habit) => !habit.archived);
  // Strzałki miesiąca pojawiają się tylko wtedy, gdy jest co nimi przewijać.
  const anyMonthly = active.some((habit) => habit.period === 'miesiac');
  const thisMonth = useMemo(() => startOfMonth(new Date()), []);
  const isCurrentMonth = toKey(month) === toKey(thisMonth);

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
      {anyMonthly && (
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, -1))}
            aria-label="Poprzedni miesiąc"
            className="text-muted active:text-ink -m-1.5 p-1.5"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setMonth(thisMonth)}
            disabled={isCurrentMonth}
            className={`text-sm font-medium ${isCurrentMonth ? 'text-muted' : 'text-accent'}`}
          >
            {monthNameLabel(month)}
          </button>

          <button
            type="button"
            onClick={() => setMonth(addMonths(month, 1))}
            aria-label="Następny miesiąc"
            className="text-muted active:text-ink -m-1.5 p-1.5"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      )}

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
              stripDays={STRIP_DAYS}
              month={month}
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
