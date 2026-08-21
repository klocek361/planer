import type { Task } from '../../data/types';
import { dueInfo, type DueTone } from '../../lib/dates';
import { useT } from '../../i18n';
import { CheckIcon, PlusIcon, StarIcon } from '../../ui/icons';

interface Props {
  task: Task;
  categoryName?: string;
  categoryColor?: string;
  /** Podzadania rysujemy z wcięciem i drobniejszym tekstem. */
  nested?: boolean;
  /** W widoku pogrupowanym po kategorii jej nazwa przy zadaniu tylko powtarza nagłówek. */
  hideCategory?: boolean;
  /** Tak samo z terminem w widoku dnia — data stoi już w nagłówku. */
  hideDueDate?: boolean;
  onToggle: () => void;
  onToggleStar: () => void;
  onEdit: () => void;
  onAddSubtask?: () => void;
}

const DUE_CLASS: Record<DueTone, string> = {
  zwykly: 'text-muted',
  blisko: 'text-ink font-medium',
  zalegly: 'text-weekend font-medium',
};

export function TaskRow({
  task,
  categoryName,
  categoryColor,
  nested = false,
  hideCategory = false,
  hideDueDate = false,
  onToggle,
  onToggleStar,
  onEdit,
  onAddSubtask,
}: Props) {
  const { t } = useT();
  const meta: { text: string; className: string; dot?: string }[] = [];
  if (categoryName && !hideCategory) {
    meta.push({ text: categoryName, className: 'text-muted', dot: categoryColor });
  }
  if (task.dueDate && !hideDueDate) {
    const due = dueInfo(task.dueDate, t);
    meta.push({ text: due.text, className: DUE_CLASS[due.tone] });
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

      {/*
        Gwiazdka jest zawsze pod palcem, a nie schowana w formularzu — oznaczenie
        czegoś jako ważne ma być jednym dotknięciem, tak jak odhaczenie.
      */}
      {!task.done && (
        <button
          type="button"
          onClick={onToggleStar}
          aria-pressed={task.starred}
          aria-label={
          task.starred
            ? t.zadania.zdejmijGwiazdke(task.title)
            : t.zadania.dodajGwiazdke(task.title)
        }
          className={`mt-1.5 shrink-0 p-1 ${task.starred ? 'text-star' : 'text-faint'}`}
        >
          <StarIcon className={nested ? 'h-4 w-4' : 'h-[1.125rem] w-[1.125rem]'} filled={task.starred} />
        </button>
      )}

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
