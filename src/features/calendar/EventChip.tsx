import type { EventItem } from '../../data/types';

/** Kolor kategorii albo neutralna szarość, gdy wydarzenie nie ma przypisania. */
export function eventColor(event: EventItem, colors: Map<number, string>): string {
  return (event.categoryId ? colors.get(event.categoryId) : undefined) ?? 'var(--c-text-muted)';
}

/**
 * Wydarzenie w komórce siatki: wąski pasek koloru z lewej i bardzo delikatne
 * tło w tym samym odcieniu. Kolor ma być czytelny, ale nie ma krzyczeć.
 */
export function EventChip({ event, color }: { event: EventItem; color: string }) {
  return (
    <div
      className="truncate rounded-r-[3px] border-l-2 py-px pr-0.5 pl-1 text-[0.625rem] leading-tight"
      style={{
        borderLeftColor: color,
        backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
      }}
      title={event.title}
    >
      {event.title}
    </div>
  );
}

/** Wydarzenie na liście pod siatką — z godziną i miejscem na dotknięcie. */
export function EventRow({
  event,
  color,
  onClick,
}: {
  event: EventItem;
  color: string;
  onClick: () => void;
}) {
  const time = event.allDay
    ? 'cały dzień'
    : [event.startTime, event.endTime].filter(Boolean).join('–');

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-app flex w-full items-center gap-3 border-l-3 px-3 py-2.5 text-left"
      style={{
        borderLeftColor: color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="text-ink block truncate text-sm font-medium">{event.title}</span>
        {event.note && <span className="text-muted block truncate text-xs">{event.note}</span>}
      </span>
      <span className="text-muted shrink-0 text-xs tabular-nums">{time}</span>
    </button>
  );
}
