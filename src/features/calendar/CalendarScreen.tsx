import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'motion/react';
import { db } from '../../data/db';
import { eventsBetween, groupByDate } from '../../data/events';
import { compareTasks, toggleTask, updateTask } from '../../data/tasks';
import type { EventItem, Task } from '../../data/types';
import { useLayoutStore } from '../../app/layoutStore';
import {
  addMonths,
  buildMonthGrid,
  monthGridRange,
  monthLabel,
  monthYearLabel,
  startOfMonth,
  toKey,
  type GridDay,
} from '../../lib/dates';
import { useT } from '../../i18n';
import { tap } from '../../platform/haptics';
import { SettingsButton } from '../../ui/SettingsButton';
import { TaskSheet } from '../../features/tasks/TaskSheet';
import { DayPanel } from './DayPanel';
import { EventSheet } from './EventSheet';
import { MonthGrid } from './MonthGrid';

/** Minimalny przesuw palca uznawany za gest zmiany miesiąca. */
const SWIPE_THRESHOLD = 55;

export function CalendarScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useT();
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [selectedKey, setSelectedKey] = useState(() => toKey(today));
  const [direction, setDirection] = useState(1);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);

  const taskMode = useLayoutStore((state) => state.calendarTasks);

  const days = useMemo(() => buildMonthGrid(month), [month]);
  const range = useMemo(() => monthGridRange(month), [month]);

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());
  const events = useLiveQuery(() => eventsBetween(range.from, range.to), [range.from, range.to]);
  // Zadania z terminem w oglądanym miesiącu — indeks po dueDate robi z tego
  // jedno tanie zapytanie, tak samo jak przy wydarzeniach.
  const tasks = useLiveQuery(
    () => db.tasks.where('dueDate').between(range.from, range.to, true, true).toArray(),
    [range.from, range.to],
  );

  const categoryColors = useMemo(() => {
    const map = new Map<number, string>();
    for (const category of categories ?? []) if (category.id) map.set(category.id, category.color);
    return map;
  }, [categories]);

  const categoryNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const category of categories ?? []) if (category.id) map.set(category.id, category.name);
    return map;
  }, [categories]);

  const eventsByDate = useMemo(() => groupByDate(events ?? []), [events]);
  const selectedEvents = eventsByDate.get(selectedKey) ?? [];

  // W siatce pokazujemy tylko zadania otwarte — kalendarz służy planowaniu,
  // a odhaczone zadanie zajmowałoby miejsce, nic już nie mówiąc.
  // Panel pod siatką dostaje wszystkie, żeby dało się je odznaczyć.
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks ?? []) {
      if (task.done || task.parentId !== undefined || !task.dueDate) continue;
      const list = map.get(task.dueDate);
      if (list) list.push(task);
      else map.set(task.dueDate, [task]);
    }
    for (const list of map.values()) list.sort(compareTasks);
    return map;
  }, [tasks]);

  const selectedTasks = useMemo(
    () =>
      (tasks ?? [])
        .filter((task) => task.dueDate === selectedKey && task.parentId === undefined)
        .sort(compareTasks),
    [tasks, selectedKey],
  );

  const goToMonth = (offset: number) => {
    setDirection(offset);
    setMonth((current) => addMonths(current, offset));
  };

  const selectDay = (day: GridDay) => {
    tap();
    setSelectedKey(day.key);
    // Kliknięcie dnia z sąsiedniego miesiąca przenosi na ten miesiąc.
    if (!day.inMonth) {
      setDirection(day.date > month ? 1 : -1);
      setMonth(startOfMonth(day.date));
    }
  };

  const backToToday = () => {
    tap();
    const start = startOfMonth(today);
    setDirection(start < month ? -1 : 1);
    setMonth(start);
    setSelectedKey(toKey(today));
  };

  // Siatka ma wjeżdżać przy zmianie miesiąca, ale nie przy starcie aplikacji —
  // animowanie pierwszego renderu wyglądałoby jak zacinka przy każdym otwarciu.
  const hasMounted = useRef(false);
  useEffect(() => {
    hasMounted.current = true;
  }, []);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    const end = e.changedTouches[0];
    touchStart.current = null;
    if (!start || !end) return;

    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    // Gest musi być wyraźnie poziomy, żeby nie kolidował z przewijaniem listy.
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    goToMonth(dx < 0 ? 1 : -1);
  };

  const showTodayButton = month.getTime() !== startOfMonth(today).getTime();
  const showYear = month.getFullYear() !== today.getFullYear();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="pt-safe px-safe shrink-0">
        <div className="flex items-center justify-between gap-3 pb-1">
          <h1
            className="text-ink text-4xl leading-none font-bold tracking-tight"
            aria-label={monthYearLabel(month)}
          >
            {monthLabel(month)}
            {showYear && (
              <span className="text-muted pl-2 text-lg font-semibold">{month.getFullYear()}</span>
            )}
          </h1>
          <div className="flex items-center gap-1">
            {showTodayButton && (
              <button
                type="button"
                onClick={backToToday}
                className="border-line text-ink rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase"
              >
                {t.wspolne.dzisiaj}
              </button>
            )}
            <SettingsButton onClick={onOpenSettings} />
          </div>
        </div>
      </header>

      <div
        className="px-safe shrink-0"
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={handleTouchEnd}
      >
        <motion.div
          key={toKey(month)}
          initial={hasMounted.current ? { opacity: 0, x: direction * 18 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          <MonthGrid
            days={days}
            eventsByDate={eventsByDate}
            tasksByDate={tasksByDate}
            categoryColors={categoryColors}
            taskMode={taskMode}
            selectedKey={selectedKey}
            onSelect={selectDay}
          />
        </motion.div>
      </div>

      <div className="px-safe flex min-h-0 flex-1 flex-col pb-2">
        <DayPanel
          dateKey={selectedKey}
          events={selectedEvents}
          tasks={selectedTasks}
          categoryColors={categoryColors}
          categoryNames={categoryNames}
          onAdd={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
          onEdit={(event) => {
            setEditing(event);
            setSheetOpen(true);
          }}
          onToggleTask={(task) => {
            tap();
            void toggleTask(task.id!, !task.done);
          }}
          onStarTask={(task) => void updateTask(task.id!, { starred: !task.starred })}
          onEditTask={(task) => {
            setEditingTask(task);
            setTaskSheetOpen(true);
          }}
        />
      </div>

      <EventSheet
        open={sheetOpen}
        dateKey={selectedKey}
        event={editing}
        categories={categories ?? []}
        onClose={() => setSheetOpen(false)}
      />

      <TaskSheet
        open={taskSheetOpen}
        task={editingTask}
        categories={categories ?? []}
        onClose={() => setTaskSheetOpen(false)}
      />
    </div>
  );
}
