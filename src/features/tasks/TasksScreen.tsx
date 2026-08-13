import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { buildTaskTree, toggleTask } from '../../data/tasks';
import type { Task } from '../../data/types';
import { tap } from '../../platform/haptics';
import { Screen } from '../../ui/Screen';
import { SettingsButton } from '../../ui/SettingsButton';
import { PlusIcon } from '../../ui/icons';
import { TaskRow } from './TaskRow';
import { TaskSheet } from './TaskSheet';

type Filter = 'do-zrobienia' | 'zrobione';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'do-zrobienia', label: 'Do zrobienia' },
  { id: 'zrobione', label: 'Zrobione' },
];

export function TasksScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [filter, setFilter] = useState<Filter>('do-zrobienia');
  const [editing, setEditing] = useState<Task | null>(null);
  const [parentId, setParentId] = useState<number | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());
  const tasks = useLiveQuery(() => db.tasks.toArray());

  const categoryById = useMemo(() => {
    const map = new Map<number, { name: string; color: string }>();
    for (const category of categories ?? []) {
      if (category.id) map.set(category.id, { name: category.name, color: category.color });
    }
    return map;
  }, [categories]);

  // Filtr działa na zadaniach nadrzędnych — podzadania zawsze idą razem z rodzicem.
  const tree = useMemo(() => {
    const all = buildTaskTree(tasks ?? []);
    return all.filter(({ task }) => (filter === 'zrobione' ? task.done : !task.done));
  }, [tasks, filter]);

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

  return (
    <Screen
      title="Zadania"
      action={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openNew}
            aria-label="Nowe zadanie"
            className="text-muted active:text-ink -m-2 p-2"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
          <SettingsButton onClick={onOpenSettings} />
        </div>
      }
    >
      <div className="bg-surface rounded-app mb-3 flex gap-1 p-1">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
            className={`rounded-app flex-1 py-1.5 text-sm font-medium transition-colors ${
              filter === item.id ? 'bg-bg text-ink' : 'text-muted'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-1">
        {tree.map(({ task, subtasks }) => {
          const category = task.categoryId ? categoryById.get(task.categoryId) : undefined;
          return (
            <li key={task.id} className="flex flex-col">
              <TaskRow
                task={task}
                categoryName={category?.name}
                categoryColor={category?.color}
                onToggle={() => toggle(task)}
                onEdit={() => openEdit(task)}
                onAddSubtask={() => openSubtask(task.id!)}
              />
              {subtasks.map((subtask) => {
                const subcategory = subtask.categoryId
                  ? categoryById.get(subtask.categoryId)
                  : undefined;
                return (
                  <TaskRow
                    key={subtask.id}
                    task={subtask}
                    categoryName={subcategory?.name}
                    categoryColor={subcategory?.color}
                    nested
                    onToggle={() => toggle(subtask)}
                    onEdit={() => openEdit(subtask)}
                  />
                );
              })}
            </li>
          );
        })}
      </ul>

      {tasks !== undefined && tree.length === 0 && (
        <p className="text-muted py-10 text-center text-sm">
          {filter === 'zrobione'
            ? 'Nic jeszcze nie odhaczone.'
            : 'Brak zadań. Dodaj pierwsze plusem u góry.'}
        </p>
      )}

      <TaskSheet
        open={sheetOpen}
        task={editing}
        parentId={parentId}
        categories={categories ?? []}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}
