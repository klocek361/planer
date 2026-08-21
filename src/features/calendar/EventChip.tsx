import type { EventItem } from '../../data/types';
import { isDarkColor } from '../../theme/color';
import { useT } from '../../i18n';
import { RepeatIcon } from '../../ui/icons';

/** Kolor kategorii albo neutralna szarość, gdy wydarzenie nie ma przypisania. */
export function eventColor(event: EventItem, colors: Map<number, string>): string {
  return (event.categoryId ? colors.get(event.categoryId) : undefined) ?? 'var(--c-text-muted)';
}

/**
 * Podpis na wypełnionym pasku. Kolory kategorii ustawia użytkowniczka, więc
 * tekst dobiera się do jasności tła zamiast być na sztywno biały. Wydarzenie
 * bez kategorii dostaje tło aplikacji jako kolor liter — neutralna szarość
 * jest w każdym motywie na tyle średnia, że to zawsze się czyta.
 */
function readableOn(color: string): string {
  if (!color.startsWith('#')) return 'var(--c-bg)';
  return isDarkColor(color) ? '#FFFFFF' : '#1A1A18';
}

/**
 * Wydarzenie w komórce siatki. Całodniowe dostaje pełny pasek w kolorze
 * kategorii, bo zajmuje cały dzień; wydarzenie z godzinami tylko kreskę przy
 * tytule. Dzięki temu jednym spojrzeniem widać, co trzyma cały dzień, a co
 * jest punktem w grafiku.
 */
export function EventChip({ event, color }: { event: EventItem; color: string }) {
  if (event.allDay) {
    return (
      <div
        className="truncate rounded-[3px] px-1 py-px text-[0.625rem] leading-tight font-medium"
        style={{
          backgroundColor: color,
          color: readableOn(color),
        }}
        title={event.title}
      >
        {event.title}
      </div>
    );
  }

  return (
    <div className="text-ink flex items-center gap-1 pl-0.5 text-[0.625rem] leading-tight">
      <span
        className="h-2.5 w-[2px] shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="truncate" title={event.title}>
        {event.title}
      </span>
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
  const { t } = useT();
  const time = event.allDay
    ? t.wspolne.calyDzien
    : [event.startTime, event.endTime].filter(Boolean).join('–');

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-app flex w-full items-center gap-3 border-l-3 px-3 py-2.5 text-left"
      style={{
        borderLeftColor: color,
        // Całodniowe wyraźniej wybarwione, godzinowe ledwie muśnięte kolorem —
        // ta sama zasada co w siatce, tylko w większej skali.
        backgroundColor: `color-mix(in srgb, ${color} ${event.allDay ? 26 : 8}%, transparent)`,
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="text-ink flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{event.title}</span>
          {event.seriesId !== undefined && (
            <RepeatIcon className="text-muted h-3.5 w-3.5 shrink-0" />
          )}
        </span>
        {event.note && <span className="text-muted block truncate text-xs">{event.note}</span>}
      </span>
      <span className="text-muted shrink-0 text-xs tabular-nums">{time}</span>
    </button>
  );
}
