import { useEffect, useState } from 'react';
import { addTask, deleteTask, updateTask } from '../../data/tasks';
import { PRIORITY_LABELS, type Category, type Priority, type Task } from '../../data/types';
import { Button } from '../../ui/Button';
import { CategoryPicker } from '../../ui/CategoryChip';
import { Sheet } from '../../ui/Sheet';
import { TrashIcon } from '../../ui/icons';

interface Props {
  open: boolean;
  /** Zadanie do edycji albo null, gdy dodajemy nowe. */
  task: Task | null;
  /** Ustawione, gdy dodajemy podzadanie do wskazanego zadania. */
  parentId?: number;
  categories: Category[];
  onClose: () => void;
}

const PRIORITIES: Priority[] = [0, 1, 2];

export function TaskSheet({ open, task, parentId, categories, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>(0);
  const [dueDate, setDueDate] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? '');
    setPriority(task?.priority ?? 0);
    setDueDate(task?.dueDate ?? '');
    setCategoryId(task?.categoryId);
  }, [open, task]);

  const trimmed = title.trim();

  const save = async () => {
    if (!trimmed) return;
    const draft = {
      title: trimmed,
      priority,
      dueDate: dueDate || undefined,
      categoryId,
    };
    if (task?.id) await updateTask(task.id, draft);
    else await addTask({ ...draft, parentId });
    onClose();
  };

  const remove = async () => {
    if (task?.id) await deleteTask(task.id);
    onClose();
  };

  const heading = task ? 'Edytuj zadanie' : parentId ? 'Nowe podzadanie' : 'Nowe zadanie';

  return (
    <Sheet open={open} title={heading} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">Co jest do zrobienia</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="np. Kupić prezent"
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">Ważność</span>
          <div className="flex gap-2">
            {PRIORITIES.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setPriority(level)}
                aria-pressed={priority === level}
                className={`rounded-app flex-1 px-3 py-2 text-sm ${
                  priority === level ? 'bg-selected text-selected-ink' : 'bg-surface text-ink'
                }`}
              >
                {PRIORITY_LABELS[level]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">Termin</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
          />
          {dueDate && (
            <button
              type="button"
              onClick={() => setDueDate('')}
              className="text-muted self-start text-xs underline"
            >
              Usuń termin
            </button>
          )}
        </label>

        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={!trimmed} onClick={save}>
            Zapisz
          </Button>
          {task && (
            <Button variant="danger" aria-label="Usuń zadanie" onClick={remove} className="px-4">
              <TrashIcon className="h-5 w-5" />
            </Button>
          )}
        </div>

        {task && task.parentId === undefined && (
          <p className="text-muted -mt-2 text-xs">
            Usunięcie zadania kasuje też jego podzadania.
          </p>
        )}
      </div>
    </Sheet>
  );
}
