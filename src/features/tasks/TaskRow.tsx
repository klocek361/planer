import type { Task } from '../../data/types';
import { PRIORITY_LABELS } from '../../data/types';
import { isPastDay, shortDateLabel } from '../../lib/dates';
import { CheckIcon, PlusIcon } from '../../ui/icons';

interface Props {
  task: Task;
  categoryName?: string;
  categoryColor?: string;
  /** Podzadania rysujemy z wcięciem i drobniejszym tekstem. */
  nested?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onAddSubtask?: () => void;
}

export function TaskRow({
  task,
  categoryName,
  categoryColor,
  nested = false,
  onToggle,
  onEdit,
  onAddSubtask,
}: Props) {
  const overdue = task.dueDate !== undefined && !task.done && isPastDay(task.dueDate);

  const meta: { text: string; className: string; dot?: string }[] = [];
  if (categoryName) meta.push({ text: categoryName, className: 'text-muted', dot: categoryColor });
  if (task.dueDate) {
    meta.push({
      text: shortDateLabel(task.dueDate),
      className: overdue ? 'text-weekend font-medium' : 'text-muted',
    });
  }
  if (task.priority > 0) {
    meta.push({
      text: PRIORITY_LABELS[task.priority],
      className: task.priority === 2 ? 'text-weekend' : 'text-muted',
    });
  }

  return (
    <div className={`flex items-start gap-3 ${nested ? 'pl-8' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={task.done}
        aria-label={task.done ? `Odznacz ${task.title}` : `Odhacz ${task.title}`}
        className={`mt-2 flex shrink-0 items-center justify-center rounded-full border transition-colors ${
          nested ? 'h-5 w-5' : 'h-6 w-6'
        } ${task.done ? 'bg-selected border-transparent' : 'border-line'}`}
      >
        {task.done && <CheckIcon className="text-selected-ink h-3.5 w-3.5" />}
      </button>

      <button type="button" onClick={onEdit} className="min-w-0 flex-1 py-1.5 text-left">
        <span
          className={`block truncate ${nested ? 'text-sm' : 'text-[0.9375rem]'} ${
            task.done ? 'text-faint line-through' : 'text-ink font-medium'
          }`}
        >
          {task.title}
        </span>

        {meta.length > 0 && !task.done && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-0.5 text-xs">
            {meta.map((item, index) => (
              <span key={index} className={`flex items-center gap-1 ${item.className}`}>
                {item.dot && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.dot }}
                    aria-hidden="true"
                  />
                )}
                {item.text}
              </span>
            ))}
          </span>
        )}
      </button>

      {onAddSubtask && !task.done && (
        <button
          type="button"
          onClick={onAddSubtask}
          aria-label={`Dodaj podzadanie do ${task.title}`}
          className="text-faint active:text-ink mt-1.5 shrink-0 p-1"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
