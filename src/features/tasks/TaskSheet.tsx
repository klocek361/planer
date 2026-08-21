import { useEffect, useState } from 'react';
import { addTask, deleteTask, updateTask } from '../../data/tasks';
import type { Category, Task } from '../../data/types';
import { Button } from '../../ui/Button';
import { CategoryPicker } from '../../ui/CategoryChip';
import { ConfirmDialog } from '../../ui/Confirm';
import { Sheet } from '../../ui/Sheet';
import { StarIcon, TrashIcon } from '../../ui/icons';

interface Props {
  open: boolean;
  /** Zadanie do edycji albo null, gdy dodajemy nowe. */
  task: Task | null;
  /** Ustawione, gdy dodajemy podzadanie do wskazanego zadania. */
  parentId?: number;
  categories: Category[];
  /** Termin wpisany z góry — gdy zadanie dodajemy z widoku konkretnego dnia. */
  defaultDueDate?: string;
  onClose: () => void;
}

export function TaskSheet({
  open,
  task,
  parentId,
  categories,
  defaultDueDate,
  onClose,
}: Props) {
  const [title, setTitle] = useState('');
  const [starred, setStarred] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? '');
    setStarred(task?.starred ?? false);
    setDueDate(task?.dueDate ?? defaultDueDate ?? '');
    setCategoryId(task?.categoryId);
  }, [open, task, defaultDueDate]);

  const trimmed = title.trim();

  const save = async () => {
    if (!trimmed) return;
    const draft = {
      title: trimmed,
      starred,
      dueDate: dueDate || undefined,
      categoryId,
    };
    if (task?.id) await updateTask(task.id, draft);
    else await addTask({ ...draft, parentId });
    onClose();
  };

  const remove = async () => {
    setConfirmOpen(false);
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

        <button
          type="button"
          onClick={() => setStarred((value) => !value)}
          aria-pressed={starred}
          className="bg-surface rounded-app flex items-center justify-between px-3 py-2.5 text-left"
        >
          <span className="text-ink text-sm font-medium">Ważne</span>
          <StarIcon
            className={`h-6 w-6 ${starred ? 'text-star' : 'text-faint'}`}
            filled={starred}
          />
        </button>

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
            <Button variant="danger" aria-label="Usuń zadanie" onClick={() => setConfirmOpen(true)} className="px-4">
              <TrashIcon className="h-5 w-5" />
            </Button>
          )}
        </div>

        {task && task.parentId === undefined && (
          <p className="text-muted -mt-2 text-xs">
            Usunięcie zadania kasuje też jego podzadania.
          </p>
        )}

        <ConfirmDialog
          open={confirmOpen}
          title={`Usunąć zadanie „${task?.title ?? ''}”?`}
          message={
            task?.parentId === undefined
              ? 'Zniknie razem ze swoimi podzadaniami. Tego nie da się cofnąć.'
              : 'Tego nie da się cofnąć.'
          }
          onConfirm={remove}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    </Sheet>
  );
}
