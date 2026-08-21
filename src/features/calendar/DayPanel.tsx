import type { EventItem, Task } from '../../data/types';
import { compareEvents, fromKey, fullDateLabel } from '../../lib/dates';
import { useT } from '../../i18n';
import { PlusIcon } from '../../ui/icons';
import { TaskRow } from '../tasks/TaskRow';
import { EventRow, eventColor } from './EventChip';

interface Props {
  dateKey: string;
  events: EventItem[];
  /** Zadania z terminem na ten dzień, odhaczone również. */
  tasks: Task[];
  categoryColors: Map<number, string>;
  categoryNames: Map<number, string>;
  onAdd: () => void;
  onEdit: (event: EventItem) => void;
  onToggleTask: (task: Task) => void;
  onStarTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
}

/**
 * Panel pod siatką: pełna data wybranego dnia, jego wydarzenia i zadania.
 * Tu nazwy nie są przycinane — jeśli w komórce coś się nie zmieściło, to jest
 * miejsce, w którym da się to przeczytać w całości.
 *
 * Panel rośnie do naturalnej wysokości; przewija się cały ekran kalendarza,
 * a nie sama lista. Przy powiększonym piśmie własne przewijanie listy kończyło
 * się tym, że nie było już czego przewijać — na listę nie zostawało miejsca.
 */
export function DayPanel({
  dateKey,
  events,
  tasks,
  categoryColors,
  categoryNames,
  onAdd,
  onEdit,
  onToggleTask,
  onStarTask,
  onEditTask,
}: Props) {
  const { t } = useT();
  const sorted = events.slice().sort(compareEvents);

  return (
    <div className="flex flex-col pt-3">
      <h2 className="text-ink pb-2 text-lg font-bold">
        {fullDateLabel(fromKey(dateKey))}
      </h2>

      <ul className="flex flex-col gap-1">
        {sorted.map((event) => (
          <li key={`w-${event.id}`}>
            <EventRow
              event={event}
              color={eventColor(event, categoryColors)}
              onClick={() => onEdit(event)}
            />
          </li>
        ))}

        {tasks.map((task) => (
          <li key={`z-${task.id}`}>
            <TaskRow
              task={task}
              categoryName={task.categoryId ? categoryNames.get(task.categoryId) : undefined}
              categoryColor={task.categoryId ? categoryColors.get(task.categoryId) : undefined}
              // Termin stoi już w nagłówku panelu, więc przy zadaniu tylko dubluje.
              hideDueDate
              onToggle={() => onToggleTask(task)}
              onToggleStar={() => onStarTask(task)}
              onEdit={() => onEditTask(task)}
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onAdd}
        className="bg-surface rounded-app text-muted mt-2 flex w-full items-center gap-2 px-4 py-3 text-sm font-medium"
      >
        <PlusIcon className="h-5 w-5" />
        {t.kalendarz.noweWydarzenie}
      </button>
    </div>
  );
}
