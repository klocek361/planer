import type { CalendarTasks } from '../../app/tabs';
import type { EventItem, Task } from '../../data/types';
import { WEEKDAY_LABELS, compareEvents, type GridDay } from '../../lib/dates';
import { useT } from '../../i18n';
import { EventChip, eventColor } from './EventChip';

/** Ile wpisów mieści się w komórce, zanim pojawi się licznik reszty. */
const MAX_CHIPS = 3;

interface Props {
  days: GridDay[];
  eventsByDate: Map<string, EventItem[]>;
  /** Zadania z terminem, po dniach. Puste, gdy tryb to sam licznik. */
  tasksByDate: Map<string, Task[]>;
  categoryColors: Map<number, string>;
  /** Nazwy zadań w komórce czy sama kropka z liczbą. */
  taskMode: CalendarTasks;
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
  tasksByDate,
  categoryColors,
  taskMode,
  selectedKey,
  onSelect,
}: Props) {
  const showNames = taskMode === 'nazwy';

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
          const tasks = tasksByDate.get(day.key) ?? [];

          // Wydarzenia mają pierwszeństwo w komórce — mają godzinę i miejsce,
          // więc przegapienie ich kosztuje więcej niż przegapienie zadania.
          const visibleEvents = events.slice(0, MAX_CHIPS);
          const visibleTasks = showNames
            ? tasks.slice(0, MAX_CHIPS - visibleEvents.length)
            : [];
          const hidden =
            events.length -
            visibleEvents.length +
            (showNames ? tasks.length - visibleTasks.length : 0);

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
                {visibleEvents.map((event) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    color={eventColor(event, categoryColors)}
                  />
                ))}

                {visibleTasks.map((task) => (
                  <TaskChip
                    key={task.id}
                    task={task}
                    selected={isSelected}
                    // Pełna nazwa przepływa tylko w zaznaczonym dniu — gdyby
                    // jechały wszystkie, siatka byłaby nie do czytania.
                    flowing={isSelected}
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

                {!showNames && tasks.length > 0 && (
                  <TaskCount count={tasks.length} selected={isSelected} />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Zadanie w komórce. Kółeczko zamiast paska koloru — od pierwszego spojrzenia
 * odróżnia to, co jest do odhaczenia, od tego, co po prostu wypada tego dnia.
 */
function TaskChip({
  task,
  selected,
  flowing,
}: {
  task: Task;
  selected: boolean;
  flowing: boolean;
}) {
  const ink = selected ? 'text-selected-ink' : 'text-ink';

  return (
    <span className={`flex items-center gap-1 pl-0.5 text-[0.625rem] leading-tight ${ink}`}>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full border ${
          selected ? 'border-current' : 'border-muted'
        }`}
        aria-hidden="true"
      />
      {flowing ? (
        <span className="okienko-plyniecia min-w-0 flex-1">
          <span className="plynie">{task.title}</span>
        </span>
      ) : (
        <span className="truncate" title={task.title}>
          {task.title}
        </span>
      )}
    </span>
  );
}

/** Sama liczba zadań na dany dzień — dla trybu, w którym siatka ma zostać lekka. */
function TaskCount({ count, selected }: { count: number; selected: boolean }) {
  const { t, plural } = useT();

  return (
    <span
      className={`flex items-center gap-1 pl-1 text-[0.625rem] leading-tight font-medium tabular-nums ${
        selected ? 'text-selected-ink' : 'text-ink'
      }`}
      title={t.kalendarzEkran.zadanTegoDnia(plural(count, t.daty.zadanie))}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? 'bg-current' : 'bg-accent'}`}
        aria-hidden="true"
      />
      {count}
    </span>
  );
}
