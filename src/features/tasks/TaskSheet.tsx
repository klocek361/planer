import { useEffect, useState } from 'react';
import { addTask, deleteTask, updateTask } from '../../data/tasks';
import type { Category, Task } from '../../data/types';
import { useT } from '../../i18n';
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
  const { t } = useT();
  const [title, setTitle] = useState('');
  const [starred, setStarred] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? '');
    setStarred(task?.starred ?? false);
    setStartDate(task?.startDate ?? '');
    setDueDate(task?.dueDate ?? defaultDueDate ?? '');
    setCategoryId(task?.categoryId);
  }, [open, task, defaultDueDate]);

  const trimmed = title.trim();
  // Zakres bez terminu nie ma sensu, a początek po terminie to pomyłka.
  const zakresValid = !startDate || !dueDate || startDate <= dueDate;
  const canSave = trimmed.length > 0 && zakresValid;

  const save = async () => {
    if (!canSave) return;
    const draft = {
      title: trimmed,
      starred,
      startDate: dueDate && startDate ? startDate : undefined,
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

  const heading = task
    ? t.zadania.edytujZadanie
    : parentId
      ? t.zadania.nowePodzadanie
      : t.zadania.noweZadanie;

  return (
    <Sheet open={open} title={heading} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.zadania.coDoZrobienia}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.zadania.nazwaPrzyklad}
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
          />
        </label>

        <button
          type="button"
          onClick={() => setStarred((value) => !value)}
          aria-pressed={starred}
          className="bg-surface rounded-app flex items-center justify-between px-3 py-2.5 text-left"
        >
          <span className="text-ink text-sm font-medium">{t.zadania.wazne}</span>
          <StarIcon
            className={`h-6 w-6 ${starred ? 'text-star' : 'text-faint'}`}
            filled={starred}
          />
        </button>

        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">
            {startDate ? t.zadania.koniec : t.zadania.termin}
          </span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
          />
          {dueDate && (
            <button
              type="button"
              onClick={() => {
                setDueDate('');
                setStartDate('');
              }}
              className="text-muted self-start text-xs underline"
            >
              {t.zadania.usunTermin}
            </button>
          )}
        </label>

        {/*
          Zakres pojawia się dopiero po ustawieniu terminu — data początku bez
          końca nie mówi nic o tym, ile czasu zostało.
        */}
        {dueDate && (
          <>
            <button
              type="button"
              onClick={() => setStartDate(startDate ? '' : dueDate)}
              aria-pressed={startDate !== ''}
              className="bg-surface rounded-app flex items-center justify-between px-3 py-2.5 text-left"
            >
              <span className="text-ink text-sm font-medium">{t.zadania.wielodniowe}</span>
              <span
                className={`h-5 w-5 rounded-full border ${
                  startDate ? 'bg-selected border-transparent' : 'border-line'
                }`}
                aria-hidden="true"
              />
            </button>

            {startDate !== '' && (
              <label className="flex flex-col gap-2">
                <span className="text-muted text-xs font-medium">{t.zadania.poczatek}</span>
                <input
                  type="date"
                  value={startDate}
                  max={dueDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
                />
              </label>
            )}
          </>
        )}

        {!zakresValid && (
          <p className="text-weekend -mt-3 text-xs">{t.zadania.zlyZakres}</p>
        )}

        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={!canSave} onClick={save}>
            {t.wspolne.zapisz}
          </Button>
          {task && (
            <Button variant="danger" aria-label={t.zadania.usunZadanie} onClick={() => setConfirmOpen(true)} className="px-4">
              <TrashIcon className="h-5 w-5" />
            </Button>
          )}
        </div>

        {task && task.parentId === undefined && (
          <p className="text-muted -mt-2 text-xs">
            {t.zadania.uwagaPodzadania}
          </p>
        )}

        <ConfirmDialog
          open={confirmOpen}
          title={t.zadania.pytanieZadanie(task?.title ?? '')}
          message={
            task?.parentId === undefined
              ? t.zadania.opisZPodzadaniami
              : t.wspolne.nieodwracalne
          }
          onConfirm={remove}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    </Sheet>
  );
}
