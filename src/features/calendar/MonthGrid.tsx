import type { EventItem } from '../../data/types';
import { WEEKDAY_LABELS, compareEvents, type GridDay } from '../../lib/dates';
import { EventChip, eventColor } from './EventChip';

/** Ile wydarzeń mieści się w komórce, zanim pojawi się licznik reszty. */
const MAX_CHIPS = 3;

interface Props {
  days: GridDay[];
  eventsByDate: Map<string, EventItem[]>;
  categoryColors: Map<number, string>;
  selectedKey: string;
  onSelect: (day: GridDay) => void;
}

/**
 * Siatka miesiąca bez linii — dni trzyma na miejscu sam rytm odstępów.
 * To główne źródło lekkości tego układu.
 */
export function MonthGrid({
  days,
  eventsByDate,
  categoryColors,
  selectedKey,
  onSelect,
}: Props) {
  return (
    <div className="flex shrink-0 flex-col">
      <div className="grid shrink-0 grid-cols-7 pb-1">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className={`text-center text-xs font-medium ${
              index >= 5 ? 'text-weekend' : 'text-muted'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/*
        Wiersze mają własną, spokojną wysokość zamiast rozpychać się na cały
        ekran — inaczej kafelek zaznaczonego dnia robi się wysoką pigułką.
        Miara jest w rem, więc rośnie razem z ustawionym rozmiarem pisma.
      */}
      <div className="grid grid-cols-7 gap-px">
        {days.map((day) => {
          const isSelected = day.key === selectedKey;
          const events = (eventsByDate.get(day.key) ?? []).slice().sort(compareEvents);
          const visible = events.slice(0, MAX_CHIPS);
          const hidden = events.length - visible.length;

          return (
            <button
              key={day.key}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={isSelected}
              className={`rounded-app flex min-h-20 flex-col items-stretch overflow-hidden px-0.5 pt-1 pb-0.5 text-left transition-colors ${
                isSelected ? 'bg-selected' : day.isToday ? 'bg-surface-alt' : ''
              }`}
            >
              <span
                className={`shrink-0 pb-0.5 text-center text-[0.9375rem] leading-none font-semibold tabular-nums ${
                  isSelected
                    ? 'text-selected-ink'
                    : !day.inMonth
                      ? 'text-faint'
                      : day.isWeekend
                        ? 'text-weekend'
                        : 'text-ink'
                }`}
              >
                {day.dayOfMonth}
              </span>

              <span className={`flex flex-col gap-px ${day.inMonth ? '' : 'opacity-45'}`}>
                {visible.map((event) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    color={eventColor(event, categoryColors)}
                  />
                ))}
                {hidden > 0 && (
                  <span
                    className={`pl-1 text-[0.5625rem] leading-tight ${
                      isSelected ? 'text-selected-ink' : 'text-muted'
                    }`}
                  >
                    +{hidden}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
