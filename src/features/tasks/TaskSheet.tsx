import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import {
  MAX_NEW_SUBTASKS,
  addSubtasks,
  addTask,
  deleteTask,
  splitLines,
  deleteTaskSeries,
  taskSeriesDates,
  updateTask,
  updateTaskSeries,
} from '../../data/tasks';
import { MAX_REPEAT_COUNT, type Category, type RepeatFreq, type Task } from '../../data/types';
import { dotDateLabel } from '../../lib/dates';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { CategoryPicker, SubcategoryPicker } from '../../ui/CategoryChip';
import { ConfirmDialog } from '../../ui/Confirm';
import { Sheet } from '../../ui/Sheet';
import { BoltIcon, StarIcon, TrashIcon } from '../../ui/icons';

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

/** 'brak' to zadanie pojedyncze — reszta to reguły powtarzania. */
type RepeatChoice = 'brak' | RepeatFreq;

const REPEAT_CHOICES: RepeatChoice[] = ['brak', 'dzien', 'tydzien', 'dwa-tygodnie', 'miesiac'];

/** Czy zmiana dotyczy jednego zadania, czy całej serii. */
type Scope = 'to' | 'seria';

const DEFAULT_COUNT = 4;

export function TaskSheet({
  open,
  task: taskProp,
  parentId: parentProp,
  categories,
  defaultDueDate,
  onClose,
}: Props) {
  const { t } = useT();
  const task = taskProp;
  const parentId = parentProp;
  // Podzadania wpisywane od razu pod zadaniem — zawsze z jednym pustym polem na końcu.
  const [subtasks, setSubtasks] = useState<string[]>(['']);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [starred, setStarred] = useState(false);
  const [quick, setQuick] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [subcategoryId, setSubcategoryId] = useState<number | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [repeat, setRepeat] = useState<RepeatChoice>('brak');
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [scope, setScope] = useState<Scope>('to');

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? '');
    setNote(task?.note ?? '');
    setStarred(task?.starred ?? false);
    setQuick(task?.quick ?? false);
    setStartDate(task?.startDate ?? '');
    setDueDate(task?.dueDate ?? defaultDueDate ?? '');
    setCategoryId(task?.categoryId);
    setSubcategoryId(task?.subcategoryId);
    setRepeat('brak');
    setCount(DEFAULT_COUNT);
    setScope('to');
    setSubtasks(['']);
  }, [open, task, defaultDueDate]);

  // Sekcja podzadań: tylko przy zadaniu nadrzędnym (nowym albo edytowanym).
  const withSubtasks = parentId === undefined && (task === null || task.parentId === undefined);
  const existingSubtasks = useLiveQuery(
    () => (task?.id !== undefined ? db.tasks.where('parentId').equals(task.id).sortBy('order') : []),
    [task?.id],
    [],
  );

  const repeatLabel: Record<RepeatChoice, string> = {
    brak: t.kalendarz.raz,
    dzien: t.kalendarz.codziennie,
    tydzien: t.kalendarz.coTydzien,
    'dwa-tygodnie': t.kalendarz.coDwaTygodnie,
    miesiac: t.kalendarz.coMiesiac,
  };

  const trimmed = title.trim();
  // Zakres bez terminu nie ma sensu, a początek po terminie to pomyłka.
  const zakresValid = !startDate || !dueDate || startDate <= dueDate;
  const canSave = trimmed.length > 0 && zakresValid;

  const inSeries = task?.seriesId !== undefined;
  const wholeSeries = inSeries && scope === 'seria';

  // Podgląd ostatniego terminu — „co tydzień, 6 razy” nic nie mówi o tym,
  // dokąd seria sięga.
  const lastDate = useMemo(() => {
    if (repeat === 'brak' || count < 2 || !dueDate) return null;
    const keys = taskSeriesDates(dueDate, { freq: repeat, count });
    return keys[keys.length - 1] ?? null;
  }, [repeat, count, dueDate]);

  const saveDraft = async () => {
    if (!canSave) return;
    const draft = {
      title: trimmed,
      note: note.trim() || undefined,
      starred,
      quick,
      startDate: dueDate && startDate ? startDate : undefined,
      dueDate: dueDate || undefined,
      categoryId,
      subcategoryId: categoryId !== undefined ? subcategoryId : undefined,
    };

    if (task?.id) {
      if (wholeSeries) {
        // Terminy zostają nietknięte — inaczej wszystkie powtórzenia wskoczyłyby
        // na ten sam dzień.
        const { dueDate: _pominiety, startDate: _pominietyStart, ...bezDat } = draft;
        await updateTaskSeries(task.seriesId!, bezDat);
      } else {
        await updateTask(task.id, draft);
      }
      if (withSubtasks) await addSubtasks(task.id, subtasks);
    } else {
      await addTask(
        { ...draft, parentId },
        repeat === 'brak' ? undefined : { freq: repeat, count: Math.max(2, count) },
        withSubtasks ? subtasks : [],
      );
    }
    setSubtasks(['']);
  };

  const save = async () => {
    if (!canSave) return;
    await saveDraft();
    onClose();
  };

  const remove = async () => {
    setConfirmOpen(false);
    if (task?.id === undefined) return;
    if (wholeSeries) await deleteTaskSeries(task.seriesId!);
    else await deleteTask(task.id);
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

        {withSubtasks && (
          <SubtaskInputs rows={subtasks} onChange={setSubtasks} existing={existingSubtasks.map((s) => s.title)} />
        )}

        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.zadania.notatka}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.zadania.notatkaPrzyklad}
            rows={2}
            maxLength={500}
            className="bg-surface rounded-app text-ink resize-none px-3 py-2.5 text-base"
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

        <button
          type="button"
          onClick={() => setQuick((value) => !value)}
          aria-pressed={quick}
          className="bg-surface rounded-app flex items-center justify-between px-3 py-2.5 text-left"
        >
          <span className="text-ink text-sm font-medium">{t.zadania.naPiecMinut}</span>
          <BoltIcon
            className={`h-6 w-6 ${quick ? 'text-accent' : 'text-faint'}`}
            filled={quick}
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

        {/*
          Powtarzanie ustawiamy tylko przy zakładaniu i tylko dla zadania
          z terminem — bez daty nie ma czego przesuwać. Zmiana reguły
          istniejącej serii to w praktyce nowa seria.
        */}
        {!task && dueDate && (
          <div className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">{t.zadania.powtarzanie}</span>
            <div className="flex flex-wrap gap-1.5">
              {REPEAT_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setRepeat(choice)}
                  aria-pressed={repeat === choice}
                  className={`rounded-app px-3 py-1.5 text-sm ${
                    repeat === choice ? 'bg-selected text-selected-ink' : 'bg-surface text-ink'
                  }`}
                >
                  {repeatLabel[choice]}
                </button>
              ))}
            </div>

            {repeat !== 'brak' && (
              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2">
                  <span className="text-muted text-xs font-medium">{t.kalendarz.ileRazy}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={MAX_REPEAT_COUNT}
                    value={count}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setCount(
                        Number.isFinite(value)
                          ? Math.min(MAX_REPEAT_COUNT, Math.max(2, Math.round(value)))
                          : DEFAULT_COUNT,
                      );
                    }}
                    className="bg-surface rounded-app text-ink w-20 px-3 py-2 text-base tabular-nums"
                  />
                </label>
                {lastDate && (
                  <span className="text-muted text-xs">
                    {t.kalendarz.ostatniRaz(dotDateLabel(lastDate))}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {inSeries && (
          <div className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">{t.zadania.naleziDoSerii}</span>
            <div className="flex gap-2">
              {(
                [
                  { id: 'to' as const, label: t.zadania.tegoZadania },
                  { id: 'seria' as const, label: t.zadania.calejSerii },
                ]
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setScope(option.id)}
                  aria-pressed={scope === option.id}
                  className={`rounded-app flex-1 px-3 py-2 text-sm ${
                    scope === option.id ? 'bg-selected text-selected-ink' : 'bg-surface text-ink'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <CategoryPicker
          categories={categories}
          value={categoryId}
          onChange={(id) => {
            setCategoryId(id);
            setSubcategoryId(undefined);
          }}
        />
        <SubcategoryPicker categoryId={categoryId} value={subcategoryId} onChange={setSubcategoryId} />

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

        {wholeSeries && (
          <p className="text-muted -mt-2 text-xs">{t.zadania.uwagaSeria}</p>
        )}

        {task && task.parentId === undefined && (
          <p className="text-muted -mt-2 text-xs">
            {t.zadania.uwagaPodzadania}
          </p>
        )}

        <ConfirmDialog
          open={confirmOpen}
          title={
            wholeSeries
              ? t.zadania.pytanieSeria(task?.title ?? '')
              : t.zadania.pytanieZadanie(task?.title ?? '')
          }
          message={
            wholeSeries
              ? t.zadania.opisSeria
              : task?.parentId === undefined
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

/**
 * Podzadania wpisywane pod zadaniem: pole za polem, zawsze jedno puste na końcu.
 * Enter przechodzi do następnego, wklejone linie rozbijają się na osobne podzadania.
 */
function SubtaskInputs({
  rows,
  onChange,
  existing,
}: {
  rows: string[];
  onChange: (rows: string[]) => void;
  existing: string[];
}) {
  const { t } = useT();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const focusNext = useRef<number | null>(null);

  // Po dodaniu wiersza (Enter, wklejenie) kursor ląduje w nowym polu.
  useEffect(() => {
    if (focusNext.current === null) return;
    inputs.current[focusNext.current]?.focus();
    focusNext.current = null;
  });

  const withTrailingEmpty = (list: string[]) => {
    const filled = list.slice(0, MAX_NEW_SUBTASKS);
    return filled.length < MAX_NEW_SUBTASKS && filled.at(-1) !== '' ? [...filled, ''] : filled;
  };

  const setRow = (i: number, value: string) => {
    const next = rows.slice();
    next[i] = value;
    onChange(withTrailingEmpty(next));
  };

  const removeRow = (i: number) => onChange(withTrailingEmpty(rows.filter((_, j) => j !== i)));

  const paste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/\r?\n/.test(text)) return; // jedna linia — zwykłe wklejenie
    e.preventDefault();
    const lines = splitLines(text);
    const before = rows.slice(0, i);
    const current = rows[i]?.trim() ? [rows[i]!] : [];
    const after = rows.slice(i + 1).filter((r) => r.trim());
    focusNext.current = Math.min(before.length + current.length + lines.length, MAX_NEW_SUBTASKS - 1);
    onChange(withTrailingEmpty([...before, ...current, ...lines, ...after]));
  };

  const enter = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!rows[i]?.trim()) return;
    focusNext.current = i + 1;
    if (i + 1 >= rows.length) onChange(withTrailingEmpty(rows));
    else inputs.current[i + 1]?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted text-xs font-medium">{t.zadania.podzadania}</span>
      {existing.length > 0 && (
        <ul className="text-muted flex flex-col gap-1 pl-1 text-sm">
          {existing.map((title, i) => (
            <li key={i} className="truncate">
              • {title}
            </li>
          ))}
        </ul>
      )}
      {rows.map((value, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="border-line h-4 w-4 shrink-0 rounded-full border" aria-hidden="true" />
          <input
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={value}
            onChange={(e) => setRow(i, e.target.value)}
            onKeyDown={(e) => enter(i, e)}
            onPaste={(e) => paste(i, e)}
            placeholder={i === 0 && existing.length === 0 ? t.zadania.podzadaniePrzyklad : ''}
            aria-label={t.zadania.podzadania}
            enterKeyHint="next"
            maxLength={200}
            className="bg-surface rounded-app text-ink min-w-0 flex-1 px-3 py-2 text-base"
          />
          {value.trim() !== '' && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label={t.zadania.usunPodzadanie}
              className="text-muted active:text-ink -m-1 p-1 text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <p className="text-muted text-xs">{t.zadania.podzadaniaOpis}</p>
    </div>
  );
}
