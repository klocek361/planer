import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { randomQuote } from '../../app/quotes';
import { db } from '../../data/db';
import { entriesBetween, indexEntries, setHabitValue } from '../../data/habits';
import type { Category, Habit } from '../../data/types';
import {
  addMonths,
  lastDays,
  monthDays,
  monthNameLabel,
  startOfMonth,
  toKey,
} from '../../lib/dates';
import { useT } from '../../i18n';
import { tap } from '../../platform/haptics';
import { FONT_STACKS } from '../../theme/catalog';
import { SettingsButton } from '../../ui/SettingsButton';
import { SoftScreen } from '../../ui/SoftScreen';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '../../ui/icons';
import { HabitRow } from './HabitRow';
import { HabitSheet } from './HabitSheet';

/**
 * Ile dni historii pobieramy. Kropki pokazują tydzień, wynik okresu 28 dni,
 * ale seria może być dłuższa — rok wystarcza z zapasem, a wpisów jest mało.
 */
const HISTORY_DAYS = 366;

/**
 * Nawyki w układzie „miękkim”: karteczka z sentencją, nawyki pogrupowane
 * po kategoriach, przy każdym kółko z postępem dnia i kropki ostatnich dni.
 */
export function HabitsScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useT();
  const [editing, setEditing] = useState<Habit | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [quote, setQuote] = useState<string | null>(() => randomQuote());

  const todayKey = useMemo(() => toKey(new Date()), []);
  const history = useMemo(() => lastDays(HISTORY_DAYS), []);
  const monthKeys = useMemo(() => monthDays(month), [month]);

  // Jedno zapytanie na wszystko — zakres obejmuje i historię do serii,
  // i cały oglądany miesiąc, żeby przełączanie miesięcy nie mnożyło zapytań.
  const range = useMemo(() => {
    const all = [history[0]!, todayKey, monthKeys[0]!, monthKeys[monthKeys.length - 1]!].sort();
    return { from: all[0]!, to: all[all.length - 1]! };
  }, [history, todayKey, monthKeys]);

  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray());
  const entries = useLiveQuery(() => entriesBetween(range.from, range.to), [range]);
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());

  const byHabit = useMemo(() => indexEntries(entries ?? []), [entries]);
  const active = useMemo(() => (habits ?? []).filter((habit) => !habit.archived), [habits]);

  // Grupy w kolejności kategorii z ustawień; nawyki bez kategorii na końcu.
  const groups = useMemo(() => {
    const out: { category?: Category; habits: Habit[] }[] = [];
    for (const category of categories ?? []) {
      const list = active.filter((habit) => habit.categoryId === category.id);
      if (list.length > 0) out.push({ category, habits: list });
    }
    const known = new Set((categories ?? []).map((c) => c.id));
    const rest = active.filter((habit) => !habit.categoryId || !known.has(habit.categoryId));
    if (rest.length > 0) out.push({ habits: rest });
    return out;
  }, [active, categories]);

  // Strzałki miesiąca pojawiają się tylko wtedy, gdy jest co nimi przewijać.
  const anyMonthly = active.some((habit) => habit.period === 'miesiac');
  const thisMonth = useMemo(() => startOfMonth(new Date()), []);
  const isCurrentMonth = toKey(month) === toKey(thisMonth);

  const openNew = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  return (
    <SoftScreen
      title={t.zakladki.nawyki}
      actions={<SettingsButton onClick={onOpenSettings} />}
      fab={{ label: t.nawyki.nowyNawyk, onClick: openNew }}
    >
      {quote && (
        <div
          className="bg-surface mt-1 mb-6 flex items-start gap-3 px-4 py-3.5 shadow-[0_1px_12px_rgba(0,0,0,0.04)]"
          style={{ borderRadius: 'calc(var(--r-app) * 1.1)' }}
        >
          <p
            className="text-muted min-w-0 flex-1 text-[1.0625rem] leading-snug italic"
            style={{ fontFamily: FONT_STACKS.literata }}
          >
            {quote}
          </p>
          <button
            type="button"
            onClick={() => setQuote(null)}
            aria-label={t.wspolne.zamknij}
            className="text-faint active:text-ink -m-1 shrink-0 p-1"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {anyMonthly && (
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, -1))}
            aria-label={t.wspolne.poprzedniMiesiac}
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
            aria-label={t.wspolne.nastepnyMiesiac}
            className="text-muted active:text-ink -m-1.5 p-1.5"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <section key={group.category?.id ?? 'bez'}>
            <h2 className="text-muted pb-1 text-sm">
              {group.category?.name ?? t.zadania.bezKategorii}
              <span className="text-faint"> · {group.habits.length}</span>
            </h2>
            <ul>
              {group.habits.map((habit) => (
                <li key={habit.id}>
                  <HabitRow
                    habit={habit}
                    color={group.category?.color ?? 'var(--c-accent)'}
                    days={byHabit.get(habit.id!)}
                    todayKey={todayKey}
                    month={month}
                    size="duzy"
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
          </section>
        ))}
      </div>

      {habits !== undefined && active.length === 0 && (
        <p className="text-muted py-10 text-center text-sm">{t.nawyki.brakNawykow}</p>
      )}

      <HabitSheet
        open={sheetOpen}
        habit={editing}
        categories={categories ?? []}
        onClose={() => setSheetOpen(false)}
      />
    </SoftScreen>
  );
}
