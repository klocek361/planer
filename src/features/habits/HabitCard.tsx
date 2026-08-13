import type { Habit } from '../../data/types';
import { completedCount, currentStreak, isDayComplete } from '../../data/habits';
import { CheckIcon } from '../../ui/icons';

interface Props {
  habit: Habit;
  color: string;
  /** Historia nawyku: dzień → wartość. */
  days: Map<string, number> | undefined;
  /** Klucze dni pokazywanych na pasku, od najstarszego do dzisiaj. */
  strip: string[];
  todayKey: string;
  onSetValue: (value: number) => void;
  onEdit: () => void;
}

export function HabitCard({
  habit,
  color,
  days,
  strip,
  todayKey,
  onSetValue,
  onEdit,
}: Props) {
  const todayValue = days?.get(todayKey) ?? 0;
  const done = isDayComplete(habit, todayValue);
  const streak = currentStreak(habit, days, todayKey);
  const doneInStrip = completedCount(habit, days, strip);

  return (
    <div className="bg-surface rounded-app flex flex-col gap-2.5 px-3 py-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          <span className="text-ink block truncate text-[0.9375rem] font-medium">
            {habit.name}
          </span>
          <span className="text-muted block text-xs">
            {streak > 0 ? `seria ${streak} ${streak === 1 ? 'dzień' : 'dni'}` : 'brak serii'}
            {' · '}
            {doneInStrip}/{strip.length} dni
          </span>
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

      {habit.unit && habit.kind === 'licznik' && (
        <span className="text-faint -mt-2 text-xs">{habit.unit}</span>
      )}

      {/* Pasek ostatnich tygodni — nasycenie odpowiada postępowi danego dnia. */}
      <div className="flex gap-[3px]">
        {strip.map((key) => {
          const value = days?.get(key) ?? 0;
          const ratio = Math.min(1, value / habit.target);
          return (
            <span
              key={key}
              title={key}
              className="h-4 flex-1 rounded-[2px]"
              style={{
                backgroundColor:
                  ratio === 0
                    ? 'color-mix(in srgb, var(--c-text-faint) 35%, transparent)'
                    : `color-mix(in srgb, ${color} ${Math.round(25 + ratio * 75)}%, transparent)`,
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
