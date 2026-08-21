import { useMemo } from 'react';
import type { Habit } from '../../data/types';
import { currentStreak, habitWindow, isDayComplete, type DayState } from '../../data/habits';
import { monthNameLabel, monthScale } from '../../lib/dates';
import { CheckIcon } from '../../ui/icons';

interface Props {
  habit: Habit;
  color: string;
  /** Historia nawyku: dzień → wartość. */
  days: Map<string, number> | undefined;
  /** Ile pól ma pasek w trybie ciągłym. */
  stripDays: number;
  /** Miesiąc pokazywany przez nawyki liczone miesiącami. */
  month: Date;
  todayKey: string;
  onSetValue: (value: number) => void;
  onEdit: () => void;
}

/** Tło pola paska. Osobno, bo trzy tryby wyglądu robią się nieczytelne w JSX. */
function fieldBackground(state: DayState, ratio: number, color: string): string {
  if (state === 'przyszly' || state === 'przed') {
    return 'color-mix(in srgb, var(--c-text-faint) 18%, transparent)';
  }
  if (ratio === 0) return 'color-mix(in srgb, var(--c-text-faint) 35%, transparent)';
  return `color-mix(in srgb, ${color} ${Math.round(25 + ratio * 75)}%, transparent)`;
}

export function HabitCard({
  habit,
  color,
  days,
  stripDays,
  month,
  todayKey,
  onSetValue,
  onEdit,
}: Props) {
  const byMonth = habit.period === 'miesiac';

  const strip = useMemo(
    () => habitWindow(habit, { stripDays, month, todayKey, days }),
    [habit, stripDays, month, todayKey, days],
  );

  // Podpisy pod paskiem tylko w trybie miesięcznym — w ciągłym numer dnia
  // miesiąca nic nie znaczy, bo pasek nie trzyma się kalendarza.
  const scale = useMemo(
    () => (byMonth ? monthScale(strip.keys) : []),
    [byMonth, strip.keys],
  );

  const todayValue = days?.get(todayKey) ?? 0;
  const done = isDayComplete(habit, todayValue);
  const streak = currentStreak(habit, days, todayKey);
  const doneSoFar = strip.states.filter((state) => state === 'zrobiony').length;

  const meta = [
    streak > 0 ? `seria ${streak} ${streak === 1 ? 'dzień' : 'dni'}` : 'brak serii',
    `${doneSoFar}/${strip.tracked.length} ${strip.tracked.length === 1 ? 'dzień' : 'dni'}`,
  ];
  if (habit.kind === 'licznik' && habit.unit) meta.push(habit.unit.toLowerCase());

  return (
    <div className="bg-surface rounded-app flex flex-col gap-2.5 px-3 py-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          <span className="text-ink block truncate text-[0.9375rem] font-medium">
            {habit.name}
          </span>
          <span className="text-muted block truncate text-xs">{meta.join(' · ')}</span>
        </button>

        {habit.kind === 'tak-nie' ? (
          <button
            type="button"
            onClick={() => onSetValue(done ? 0 : 1)}
            aria-pressed={done}
            aria-label={done ? `Odznacz ${habit.name}` : `Odhacz ${habit.name}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors"
            style={{
              backgroundColor: done ? color : 'transparent',
              borderColor: done ? color : 'var(--c-border)',
            }}
          >
            {done && <CheckIcon className="h-5 w-5 text-white" />}
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <StepButton
              label={`Odejmij od ${habit.name}`}
              disabled={todayValue === 0}
              onClick={() => onSetValue(todayValue - 1)}
            >
              −
            </StepButton>
            <span
              className="min-w-14 text-center text-sm font-semibold tabular-nums"
              style={{ color: done ? color : 'var(--c-text)' }}
            >
              {todayValue}/{habit.target}
            </span>
            <StepButton
              label={`Dodaj do ${habit.name}`}
              onClick={() => onSetValue(todayValue + 1)}
            >
              +
            </StepButton>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {byMonth && (
          <span className="text-faint text-[0.625rem] leading-none">
            {monthNameLabel(month)}
          </span>
        )}

        <div className={byMonth ? 'flex gap-[2px]' : 'flex gap-[3px]'}>
          {strip.keys.map((key, index) => {
            const state = strip.states[index]!;
            const value = days?.get(key) ?? 0;
            const ratio = Math.min(1, value / habit.target);
            const flat = state === 'przyszly' || state === 'przed';

            return (
              <span
                key={key}
                title={key}
                className={`h-4 flex-1 ${flat ? 'rounded-full' : 'rounded-[2px]'}`}
                style={{
                  // Dni przyszłe i te sprzed założenia nawyku to ledwie widoczna
                  // kreska — od razu widać, że pasek dopiero się zapełnia,
                  // a nie że dni wypadły.
                  backgroundColor: fieldBackground(state, ratio, color),
                  transform: flat ? 'scaleY(0.28)' : 'none',
                  outline: key === todayKey ? '1.5px solid var(--c-text-muted)' : 'none',
                  outlineOffset: '1px',
                }}
              />
            );
          })}
        </div>

        {byMonth && (
          <div className="relative h-3">
            {scale.map((day) => (
              <span
                key={day}
                className="text-faint absolute top-0 -translate-x-1/2 text-[0.5625rem] leading-none tabular-nums"
                // Środek pola dnia: pola dzielą szerokość równo, więc n-te leży
                // w (n - 0,5)/liczba dni całej szerokości.
                style={{ left: `${((day - 0.5) / strip.keys.length) * 100}%` }}
              >
                {day}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StepButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="bg-bg text-ink h-9 w-9 rounded-full text-lg leading-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
