import type { EventItem } from '../../data/types';
import { compareEvents, fromKey, fullDateLabel } from '../../lib/dates';
import { PlusIcon } from '../../ui/icons';
import { EventRow, eventColor } from './EventChip';

interface Props {
  dateKey: string;
  events: EventItem[];
  categoryColors: Map<number, string>;
  onAdd: () => void;
  onEdit: (event: EventItem) => void;
}

/** Panel pod siatką: pełna data wybranego dnia, jego wydarzenia i dodawanie. */
export function DayPanel({ dateKey, events, categoryColors, onAdd, onEdit }: Props) {
  const sorted = events.slice().sort(compareEvents);

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-3">
      <h2 className="text-ink shrink-0 pb-2 text-lg font-bold">
        {fullDateLabel(fromKey(dateKey))}
      </h2>

      {/*
        Lista ma naturalną wysokość, żeby przycisk dodawania trzymał się tuż pod
        datą. Dopiero gdy wydarzeń jest dużo, lista kurczy się i zaczyna przewijać.
      */}
      <ul className="flex min-h-0 shrink flex-col gap-1 overflow-y-auto">
        {sorted.map((event) => (
          <li key={event.id}>
            <EventRow
              event={event}
              color={eventColor(event, categoryColors)}
              onClick={() => onEdit(event)}
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onAdd}
        className="bg-surface rounded-app text-muted mt-2 flex w-full shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium"
      >
        <PlusIcon className="h-5 w-5" />
        Nowe wydarzenie
      </button>
    </div>
  );
}
