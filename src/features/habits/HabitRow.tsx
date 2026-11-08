import { useMemo } from 'react';
import type { Habit } from '../../data/types';
import { currentStreak, habitWindow, isDayComplete } from '../../data/habits';
import { fromKey, previousDay, toKey } from '../../lib/dates';
import { useT } from '../../i18n';
import { CheckIcon } from '../../ui/icons';

type Dot = 'zrobiony' | 'czesciowo' | 'pusty' | 'przyszly' | 'przed';

interface Props {
  habit: Habit;
  color: string;
  /** Historia nawyku: dzień → wartość. */
  days: Map<string, number> | undefined;
  todayKey: string;
  /** Duży wiersz (zakładka Nawyki) albo zwarty (karta w Przeglądzie). */
  size: 'duzy' | 'maly';
  /** Miesiąc pokazywany przez nawyki liczone miesiącami (tylko duży wiersz). */
  month?: Date;
  onSetValue: (value: number) => void;
  onEdit?: () => void;
}

const WEEK = 7;
/** Okres, z którego liczymy wynik „18/28 dni” u nawyków liczonych ciągle. */
const PERIOD = 28;

/** Ostatnie 7 dni, od najstarszego do dziś. */
function lastWeek(todayKey: string): string[] {
  const keys = [todayKey];
  while (keys.length < WEEK) keys.unshift(previousDay(keys[0]!));
  return keys;
}

function dotColor(dot: Dot, color: string): string {
  if (dot === 'zrobiony') return color;
  if (dot === 'czesciowo') return `color-mix(in srgb, ${color} 45%, transparent)`;
  if (dot === 'pusty') return 'color-mix(in srgb, var(--c-text-faint) 55%, transparent)';
  return 'color-mix(in srgb, var(--c-text-faint) 22%, transparent)';
}

/** Pierwszy znak nazwy — w środku kółka, gdy nawyk dziś jeszcze nie odhaczony. */
function initial(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '';
}

/**
 * Nawyk jako wiersz: kółko z postępem dnia (dotknięcie odhacza albo dolicza),
 * nazwa i kropki ostatnich dni. Nazwa otwiera edycję.
 */
export function HabitRow({ habit, color, days, todayKey, size, month, onSetValue, onEdit }: Props) {
  const { t, plural, pluralWord } = useT();
  const big = size === 'duzy';
  const counter = habit.kind === 'licznik';
  const value = days?.get(todayKey) ?? 0;
  const done = isDayComplete(habit, value);
  const progress = Math.min(1, value / Math.max(1, habit.target));
  // Odhaczony licznik nic już nie przyjmuje — cofnąć się da minusem
  // w zakładce Nawyki, a nie przypadkowym stuknięciem w kółko.
  const spent = counter && done;
  const next = counter ? value + 1 : done ? 0 : 1;

  const dots = useMemo(() => {
    const createdKey = toKey(new Date(habit.createdAt));
    const keys =
      big && habit.period === 'miesiac' && month
        ? habitWindow(habit, { stripDays: WEEK, month, todayKey, days }).keys
        : lastWeek(todayKey);
    return keys.map((key): { key: string; dot: Dot } => {
      if (key > todayKey) return { key, dot: 'przyszly' };
      if (key < createdKey) return { key, dot: 'przed' };
      const v = days?.get(key) ?? 0;
      if (isDayComplete(habit, v)) return { key, dot: 'zrobiony' };
      return { key, dot: v > 0 ? 'czesciowo' : 'pusty' };
    });
  }, [big, habit, month, todayKey, days]);

  // Seria i wynik okresu — tylko w dużym wierszu, w Przeglądzie byłyby szumem.
  const stats = useMemo(() => {
    if (!big) return null;
    const window = habitWindow(habit, { stripDays: PERIOD, month: month ?? new Date(), todayKey, days });
    const doneDays = window.states.filter((state) => state === 'zrobiony').length;
    return {
      streak: currentStreak(habit, days, todayKey),
      period: `${doneDays}/${window.tracked.length} ${pluralWord(window.tracked.length, t.daty.dzien)}`,
    };
  }, [big, habit, month, todayKey, days, pluralWord, t.daty.dzien]);

  const unit = habit.unit?.trim().toLowerCase();
  const ring = big ? 52 : 30;
  const stroke = big ? 3 : 2;
  const radius = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={`flex items-center ${big ? 'gap-4 py-2' : 'gap-3 py-1'}`}>
      <button
        type="button"
        disabled={spent}
        onClick={() => onSetValue(next)}
        aria-pressed={done}
        aria-label={done ? t.nawyki.odznacz(habit.name) : t.nawyki.odhacz(habit.name)}
        className="relative flex shrink-0 items-center justify-center"
        style={{ width: ring, height: ring }}
      >
        <svg width={ring} height={ring} className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle
            cx={ring / 2}
            cy={ring / 2}
            r={radius}
            fill="none"
            stroke="color-mix(in srgb, var(--c-text-faint) 30%, transparent)"
            strokeWidth={stroke}
          />
          <circle
            cx={ring / 2}
            cy={ring / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-300"
          />
        </svg>
        {done ? (
          <span
            className="flex items-center justify-center rounded-full"
            style={{ width: ring - stroke * 4, height: ring - stroke * 4, backgroundColor: color }}
          >
            <CheckIcon className={`text-white ${big ? 'h-5 w-5' : 'h-3.5 w-3.5'}`} />
          </span>
        ) : (
          <span className={`text-muted font-medium ${big ? 'text-base' : 'text-[0.6875rem]'}`}>
            {counter && value > 0 ? value : initial(habit.name)}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onEdit}
        disabled={!onEdit}
        className={`min-w-0 flex-1 text-left ${big ? '' : 'flex items-center gap-3'}`}
      >
        <span
          className={`text-ink block truncate ${big ? 'text-[1.0625rem]' : 'min-w-0 flex-1 text-sm'}`}
        >
          {habit.name}
        </span>
        <span
          className={`flex shrink-0 items-center ${big ? 'gap-1.5 pt-1.5' : 'gap-1'}`}
        >
          {dots.map(({ key, dot }) => (
            <span
              key={key}
              className={`rounded-full ${big ? (dots.length > WEEK ? 'h-1.5 w-1.5' : 'h-2 w-2') : 'h-1.5 w-1.5'}`}
              style={{
                backgroundColor: dotColor(dot, color),
                outline: big && key === todayKey ? '1px solid var(--c-text-muted)' : 'none',
                outlineOffset: '1px',
              }}
              title={fromKey(key).toLocaleDateString()}
              aria-hidden="true"
            />
          ))}
          {big && counter && (
            <span className="text-muted pl-1.5 text-xs tabular-nums">
              {value}/{habit.target}
              {unit ? ` ${unit}` : ''}
            </span>
          )}
        </span>
      </button>

      {!big && counter && (
        <span className="text-muted shrink-0 text-xs tabular-nums">
          {value}/{habit.target}
        </span>
      )}

      {stats && (
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          {stats.streak > 0 && (
            <span className="text-accent text-sm font-semibold tabular-nums">
              🔥 {plural(stats.streak, t.daty.dzien)}
            </span>
          )}
          <span className="text-muted text-[0.6875rem] tabular-nums">{stats.period}</span>
        </span>
      )}
      {big && counter && value > 0 && (
        <button
          type="button"
          onClick={() => onSetValue(value - 1)}
          aria-label={t.nawyki.odejmij(habit.name)}
          className="bg-bg text-ink h-8 w-8 shrink-0 rounded-full text-lg leading-none"
        >
          −
        </button>
      )}
    </div>
  );
}
