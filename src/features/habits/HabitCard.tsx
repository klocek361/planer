import { useMemo } from 'react';
import type { Habit } from '../../data/types';
import { completedCount, currentStreak, isDayComplete } from '../../data/habits';
import { habitStrip } from '../../lib/dates';
import { CheckIcon } from '../../ui/icons';

interface Props {
  habit: Habit;
  color: string;
  /** Historia nawyku: dzień → wartość. */
  days: Map<string, number> | undefined;
  /** Ile pól ma pasek historii. */
  stripDays: number;
  todayKey: string;
  onSetValue: (value: number) => void;
  onEdit: () => void;
}

export function HabitCard({
  habit,
  color,
  days,
  stripDays,
  todayKey,
  onSetValue,
  onEdit,
}: Props) {
  // Pasek zaczyna się w dniu założenia nawyku i rośnie w prawo. Pola za dzisiaj
  // to miejsca czekające na kolejne dni — rysujemy je ledwie widocznie.
  const strip = useMemo(
    () => habitStrip(habit.createdAt, stripDays),
    [habit.createdAt, stripDays],
  );
  const tracked = useMemo(() => strip.filter((key) => key <= todayKey), [strip, todayKey]);

  const todayValue = days?.get(todayKey) ?? 0;
  const done = isDayComplete(habit, todayValue);
  const streak = currentStreak(habit, days, todayKey);
  const doneSoFar = completedCount(habit, days, tracked);

  const meta = [
    streak > 0 ? `seria ${streak} ${streak === 1 ? 'dzień' : 'dni'}` : 'brak serii',
    `${doneSoFar}/${tracked.length} ${tracked.length === 1 ? 'dzień' : 'dni'}`,
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

      <div className="flex gap-[3px]">
        {strip.map((key) => {
          const future = key > todayKey;
          const value = days?.get(key) ?? 0;
          const ratio = Math.min(1, value / habit.target);

          return (
            <span
              key={key}
              title={key}
              className={`h-4 flex-1 ${future ? 'rounded-full' : 'rounded-[2px]'}`}
              style={{
                // Przyszłe dni to ledwie widoczna kreska, żeby było jasne,
                // że pasek dopiero się zapełnia, a nie że dni wypadły.
                backgroundColor: future
                  ? 'color-mix(in srgb, var(--c-text-faint) 18%, transparent)'
                  : ratio === 0
                    ? 'color-mix(in srgb, var(--c-text-faint) 35%, transparent)'
                    : `color-mix(in srgb, ${color} ${Math.round(25 + ratio * 75)}%, transparent)`,
                transform: future ? 'scaleY(0.28)' : 'none',
                outline: key === todayKey ? '1.5px solid var(--c-text-muted)' : 'none',
                outlineOffset: '1px',
              }}
            />
          );
        })}
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
