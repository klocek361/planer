import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import {
  buildTaskTree,
  groupByCategory,
  groupByDaySections,
  toggleTask,
  updateTask,
  type TaskNode,
} from '../../data/tasks';
import type { Category, Task } from '../../data/types';
import {
  dayHeadingLabel,
  dayOfMonth,
  daysFrom,
  dotDateLabel,
  fromKey,
  toKey,
  weekdayShort,
} from '../../lib/dates';
import { useT } from '../../i18n';
import { tap } from '../../platform/haptics';
import { Screen } from '../../ui/Screen';
import { SettingsButton } from '../../ui/SettingsButton';
import { PlusIcon } from '../../ui/icons';
import { TaskRow } from './TaskRow';
import { TaskSheet } from './TaskSheet';

type Mode = 'lista' | 'kategorie' | 'dni';

const MODES: Mode[] = ['lista', 'kategorie', 'dni'];

/** Pasek dat: kilka dni wstecz, żeby dało się cofnąć bez szukania. */
const STRIP_BACK = 3;
const STRIP_LENGTH = 45;

/** Zaznaczenie zastępujące konkretny dzień. */
type SpecialDay = 'zalegle' | 'bez-terminu' | null;

export function TasksScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useT();
  const modeLabel: Record<Mode, string> = {
    lista: t.zadania.trybWszystkie,
    kategorie: t.zadania.trybKategorie,
    dni: t.zadania.trybDni,
  };

  const [mode, setMode] = useState<Mode>('lista');
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [parentId, setParentId] = useState<number | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);

  const todayKey = useMemo(() => toKey(new Date()), []);
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [special, setSpecial] = useState<SpecialDay>(null);

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());
  const tasks = useLiveQuery(() => db.tasks.toArray());

  const categoryById = useMemo(() => {
    const map = new Map<number, Category>();
    for (const category of categories ?? []) if (category.id) map.set(category.id, category);
    return map;
  }, [categories]);

  const tree = useMemo(() => buildTaskTree(tasks ?? []), [tasks]);
  const open = useMemo(() => tree.filter(({ task }) => !task.done), [tree]);
  const done = useMemo(() => tree.filter(({ task }) => task.done), [tree]);

  const overdue = useMemo(
    () => open.filter(({ task }) => task.dueDate !== undefined && task.dueDate < todayKey),
    [open, todayKey],
  );
  const undated = useMemo(() => open.filter(({ task }) => task.dueDate === undefined), [open]);

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const { task } of open) {
      if (!task.dueDate) continue;
      map.set(task.dueDate, (map.get(task.dueDate) ?? 0) + 1);
    }
    return map;
  }, [open]);

  const strip = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - STRIP_BACK);
    return daysFrom(start, STRIP_LENGTH);
  }, []);

  const dayNodes = useMemo(() => {
    if (special === 'zalegle') return overdue;
    if (special === 'bez-terminu') return undated;
    return open.filter(({ task }) => task.dueDate === selectedDay);
  }, [special, overdue, undated, open, selectedDay]);

  const openNew = () => {
    setEditing(null);
    setParentId(undefined);
    setSheetOpen(true);
  };

  const openSubtask = (id: number) => {
    setEditing(null);
    setParentId(id);
    setSheetOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setParentId(undefined);
    setSheetOpen(true);
  };

  const toggle = (task: Task) => {
    tap();
    void toggleTask(task.id!, !task.done);
  };

  const toggleStar = (task: Task) => {
    tap();
    void updateTask(task.id!, { starred: !task.starred });
  };

  const renderNodes = (nodes: TaskNode[], options?: { hideCategory?: boolean; hideDueDate?: boolean }) => (
    <ul className="flex flex-col gap-1">
      {nodes.map(({ task, subtasks }) => (
        <li key={task.id} className="flex flex-col">
          <TaskRow
            task={task}
            categoryName={task.categoryId ? categoryById.get(task.categoryId)?.name : undefined}
            categoryColor={task.categoryId ? categoryById.get(task.categoryId)?.color : undefined}
            hideCategory={options?.hideCategory}
            hideDueDate={options?.hideDueDate}
            onToggle={() => toggle(task)}
            onToggleStar={() => toggleStar(task)}
            onEdit={() => openEdit(task)}
            onAddSubtask={() => openSubtask(task.id!)}
          />
          {subtasks.map((subtask) => (
            <TaskRow
              key={subtask.id}
              task={subtask}
              categoryName={
                subtask.categoryId ? categoryById.get(subtask.categoryId)?.name : undefined
              }
              categoryColor={
                subtask.categoryId ? categoryById.get(subtask.categoryId)?.color : undefined
              }
              hideCategory={options?.hideCategory}
              hideDueDate={options?.hideDueDate}
              nested
              onToggle={() => toggle(subtask)}
              onToggleStar={() => toggleStar(subtask)}
              onEdit={() => openEdit(subtask)}
            />
          ))}
        </li>
      ))}
    </ul>
  );

  const sekcjeDni = useMemo(() => groupByDaySections(open, todayKey), [open, todayKey]);

  // Jutro liczymy raz — nagłówek „JUTRO” ma się pojawić dokładnie na jednym dniu.
  const jutroKey = useMemo(() => {
    const dzien = fromKey(todayKey);
    dzien.setDate(dzien.getDate() + 1);
    return toKey(dzien);
  }, [todayKey]);

  /**
   * Podpis sekcji dnia. Dzisiaj i jutro dostają słowo, bo tak się o nich mówi;
   * dalsze dni sam skrót dnia tygodnia z datą, żeby nagłówek został krótki.
   */
  const dayHeading = (key: string) => {
    const stempel = `${weekdayShort(key)} ${dotDateLabel(key)}`;
    if (key === todayKey) return `${t.wspolne.dzis} · ${stempel}`;
    if (key === jutroKey) return `${t.daty.jutro} · ${stempel}`;
    return stempel;
  };

  const groups = useMemo(
    () => groupByCategory(open, categories ?? []),
    [open, categories],
  );

  return (
    <Screen
      title={t.zakladki.zadania}
      action={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openNew}
            aria-label={t.zadania.noweZadanie}
            className="text-muted active:text-ink -m-2 p-2"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
          <SettingsButton onClick={onOpenSettings} />
        </div>
      }
    >
      <div className="bg-surface rounded-app mb-3 flex gap-1 p-1">
        {MODES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            aria-pressed={mode === item}
            className={`rounded-app flex-1 py-1.5 text-sm font-medium transition-colors ${
              mode === item ? 'bg-bg text-ink' : 'text-muted'
            }`}
          >
            {modeLabel[item]}
          </button>
        ))}
      </div>

      {mode === 'dni' && (
        <DayStrip
          days={strip}
          todayKey={todayKey}
          selected={special === null ? selectedDay : null}
          counts={countsByDay}
          onSelect={(key) => {
            tap();
            setSpecial(null);
            setSelectedDay(key);
          }}
          overdueCount={overdue.length}
          undatedCount={undated.length}
          special={special}
          onSpecial={(value) => {
            tap();
            setSpecial((current) => (current === value ? null : value));
          }}
        />
      )}

      {mode === 'lista' && (
        <div className="flex flex-col gap-4">
          {sekcjeDni.map((sekcja) => (
            <section key={sekcja.kind === 'dzien' ? sekcja.key : sekcja.kind}>
              <GroupHeading
                label={
                  sekcja.kind === 'zalegle'
                    ? t.zadania.zalegle
                    : sekcja.kind === 'bez-terminu'
                      ? t.zadania.bezTerminu
                      : dayHeading(sekcja.key!)
                }
                count={sekcja.nodes.length}
              />
              {renderNodes(sekcja.nodes, { hideDueDate: true })}
            </section>
          ))}
        </div>
      )}

      {mode === 'kategorie' && (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.category?.id ?? 'bez-kategorii'}>
              <GroupHeading
                label={group.category?.name ?? t.zadania.bezKategorii}
                color={group.category?.color}
                count={group.nodes.length}
              />
              {renderNodes(group.nodes, { hideCategory: true })}
            </section>
          ))}
        </div>
      )}

      {mode === 'dni' && (
        <section>
          <GroupHeading
            label={
              special === 'zalegle'
                ? t.zadania.zalegle
                : special === 'bez-terminu'
                  ? t.zadania.bezTerminu
                  : dayHeadingLabel(selectedDay)
            }
            count={dayNodes.length}
          />
          {renderNodes(dayNodes, { hideDueDate: special === null })}
          {dayNodes.length === 0 && (
            <p className="text-muted py-6 text-center text-sm">
              {special === null ? t.zadania.dzienWolny : t.zadania.pusto}
            </p>
          )}
        </section>
      )}

      {tasks !== undefined && open.length === 0 && mode !== 'dni' && (
        <p className="text-muted py-10 text-center text-sm">
          {t.zadania.brakZadan}
        </p>
      )}

      {done.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowDone((value) => !value)}
            className="text-muted w-full py-2 text-center text-sm"
          >
            {showDone ? t.zadania.ukryjZrobione : t.zadania.zrobione(done.length)}
          </button>
          {showDone && renderNodes(done)}
        </div>
      )}

      <TaskSheet
        open={sheetOpen}
        task={editing}
        parentId={parentId}
        categories={categories ?? []}
        defaultDueDate={mode === 'dni' && special === null ? selectedDay : undefined}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}

/** Nagłówek bloku — nazwa kategorii albo data, zawsze z licznikiem zadań. */
function GroupHeading({ label, color, count }: { label: string; color?: string; count: number }) {
  return (
    <div className="flex items-center gap-2 pt-1 pb-1.5">
      {color && (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}
      <h2 className="text-muted min-w-0 flex-1 truncate text-xs font-semibold tracking-wide uppercase">
        {label}
      </h2>
      <span className="text-faint shrink-0 text-xs tabular-nums">{count}</span>
    </div>
  );
}

interface StripProps {
  days: string[];
  todayKey: string;
  /** null, gdy wybrane jest zaznaczenie specjalne zamiast konkretnego dnia. */
  selected: string | null;
  counts: Map<string, number>;
  onSelect: (key: string) => void;
  overdueCount: number;
  undatedCount: number;
  special: SpecialDay;
  onSpecial: (value: Exclude<SpecialDay, null>) => void;
}

/**
 * Pasek dat do przeklikiwania. Przewija się poziomo, a wybrany dzień sam
 * wjeżdża na środek — inaczej po powrocie do zakładki trzeba by go szukać.
 */
function DayStrip({
  days,
  todayKey,
  selected,
  counts,
  onSelect,
  overdueCount,
  undatedCount,
  special,
  onSpecial,
}: StripProps) {
  const { t } = useT();
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [selected]);

  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {days.map((key) => {
          const isSelected = key === selected;
          const count = counts.get(key) ?? 0;
          return (
            <button
              key={key}
              ref={isSelected ? activeRef : undefined}
              type="button"
              onClick={() => onSelect(key)}
              aria-pressed={isSelected}
              className={`rounded-app flex w-12 shrink-0 flex-col items-center gap-0.5 py-1.5 transition-colors ${
                isSelected ? 'bg-selected' : key === todayKey ? 'bg-surface-alt' : 'bg-surface'
              }`}
            >
              <span
                className={`text-[0.625rem] leading-none ${
                  isSelected ? 'text-selected-ink' : 'text-muted'
                }`}
              >
                {weekdayShort(key)}
              </span>
              <span
                className={`text-base leading-none font-semibold tabular-nums ${
                  isSelected ? 'text-selected-ink' : 'text-ink'
                }`}
              >
                {dayOfMonth(key)}
              </span>
              <span
                className={`h-1 w-1 rounded-full ${count > 0 ? '' : 'opacity-0'}`}
                style={{
                  backgroundColor: isSelected ? 'var(--c-selected-text)' : 'var(--c-accent)',
                }}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <FilterChip
          label={t.zadania.zalegle}
          count={overdueCount}
          active={special === 'zalegle'}
          onClick={() => onSpecial('zalegle')}
        />
        <FilterChip
          label={t.zadania.bezTerminu}
          count={undatedCount}
          active={special === 'bez-terminu'}
          onClick={() => onSpecial('bez-terminu')}
        />
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-app flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-selected text-selected-ink' : 'bg-surface text-muted'
      }`}
    >
      {label} <span className="tabular-nums">{count}</span>
    </button>
  );
}
