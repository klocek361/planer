import { useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { entriesBetween, indexEntries, isDayComplete, setHabitValue } from '../../data/habits';
import { compareTasks, toggleTask, updateTask } from '../../data/tasks';
import type { Category, EventItem, Habit, Task } from '../../data/types';
import {
  compareEvents,
  dayHeadingLabel,
  toKey,
  weekDays,
  weekRangeLabel,
} from '../../lib/dates';
import { tap } from '../../platform/haptics';
import { Screen } from '../../ui/Screen';
import { SettingsButton } from '../../ui/SettingsButton';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from '../../ui/icons';
import { EventRow, eventColor } from '../calendar/EventChip';
import { TaskRow } from '../tasks/TaskRow';
import { TaskSheet } from '../tasks/TaskSheet';

interface Props {
  onOpenSettings: () => void;
}

/** Przesuwa datę o podaną liczbę dni, nie ruszając oryginału. */
function shiftDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Ekran otwierający aplikację: ile jest do zrobienia dziś, co dziś wypada
 * i jak wygląda reszta tygodnia. Nic się tu nie zakłada — wszystko prowadzi
 * do tych samych arkuszy edycji, co pozostałe zakładki.
 */
export function OverviewScreen({ onOpenSettings }: Props) {
  const [weekBase, setWeekBase] = useState(() => new Date());
  const [editing, setEditing] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const todayKey = useMemo(() => toKey(new Date()), []);
  const week = useMemo(() => weekDays(weekBase), [weekBase]);
  const weekFrom = week[0]!;
  const weekTo = week[week.length - 1]!;

  // Zakres pobierania obejmuje i dzisiaj, i oglądany tydzień — przy cofaniu się
  // do minionych tygodni dzisiejsze liczniki muszą dalej działać.
  const range = useMemo(() => {
    const keys = [todayKey, weekFrom, weekTo].sort();
    return { from: keys[0]!, to: keys[keys.length - 1]! };
  }, [todayKey, weekFrom, weekTo]);

  const events = useLiveQuery(
    () => db.events.where('date').between(range.from, range.to, true, true).toArray(),
    [range],
  );
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());
  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray());
  const habitEntries = useLiveQuery(() => entriesBetween(todayKey, todayKey), [todayKey]);

  const categoryList: Category[] = categories ?? [];

  const categoryColors = useMemo(() => {
    const map = new Map<number, string>();
    for (const category of categoryList) if (category.id) map.set(category.id, category.color);
    return map;
  }, [categoryList]);

  const categoryNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const category of categoryList) if (category.id) map.set(category.id, category.name);
    return map;
  }, [categoryList]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const event of events ?? []) {
      const list = map.get(event.date);
      if (list) list.push(event);
      else map.set(event.date, [event]);
    }
    for (const list of map.values()) list.sort(compareEvents);
    return map;
  }, [events]);

  // Przegląd pokazuje tylko zadania główne — podzadania rozwijają się dopiero
  // w zakładce Zadania, tutaj byłyby szumem.
  const openTasks = useMemo(
    () => (tasks ?? []).filter((task) => !task.done && task.parentId === undefined),
    [tasks],
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of openTasks) {
      if (!task.dueDate) continue;
      const list = map.get(task.dueDate);
      if (list) list.push(task);
      else map.set(task.dueDate, [task]);
    }
    for (const list of map.values()) list.sort(compareTasks);
    return map;
  }, [openTasks]);

  const todayTasks = tasksByDay.get(todayKey) ?? [];
  const todayEvents = eventsByDay.get(todayKey) ?? [];
  const overdue = useMemo(
    () => openTasks.filter((task) => task.dueDate !== undefined && task.dueDate < todayKey),
    [openTasks, todayKey],
  );

  // Zrobione dziś liczymy z pełnej listy, nie z `openTasks` — te są już odhaczone.
  const doneToday = useMemo(
    () => (tasks ?? []).filter((task) => task.done && task.dueDate === todayKey).length,
    [tasks, todayKey],
  );
  const todayTotal = todayTasks.length + doneToday;

  const activeHabits = useMemo(
    () => (habits ?? []).filter((habit) => !habit.archived),
    [habits],
  );
  const habitValues = useMemo(() => indexEntries(habitEntries ?? []), [habitEntries]);
  const habitsDone = activeHabits.filter((habit) =>
    isDayComplete(habit, habitValues.get(habit.id!)?.get(todayKey)),
  ).length;

  const isThisWeek = week.includes(todayKey);

  const openTask = (task: Task) => {
    setEditing(task);
    setSheetOpen(true);
  };

  const taskRow = (task: Task, hideDueDate: boolean) => (
    <TaskRow
      task={task}
      categoryName={task.categoryId ? categoryNames.get(task.categoryId) : undefined}
      categoryColor={task.categoryId ? categoryColors.get(task.categoryId) : undefined}
      hideDueDate={hideDueDate}
      onToggle={() => {
        tap();
        void toggleTask(task.id!, !task.done);
      }}
      onToggleStar={() => void updateTask(task.id!, { starred: !task.starred })}
      onEdit={() => openTask(task)}
    />
  );

  return (
    <Screen title="Przegląd" action={<SettingsButton onClick={onOpenSettings} />}>
      <div className="flex flex-col gap-6 pt-1">
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label="Na dziś"
            value={`${doneToday}/${todayTotal}`}
            ratio={todayTotal === 0 ? 0 : doneToday / todayTotal}
          />
          <StatCard label="Wydarzenia" value={String(todayEvents.length)} />
          <StatCard label="Zaległe" value={String(overdue.length)} alert={overdue.length > 0} />
        </div>

        <Section title="Dziś" hint={dayHeadingLabel(todayKey)}>
          {todayEvents.length === 0 && todayTasks.length === 0 && activeHabits.length === 0 ? (
            <p className="text-muted py-4 text-center text-sm">Dziś nic nie zaplanowano.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {todayEvents.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {todayEvents.map((event) => (
                    <li key={event.id}>
                      <EventRow
                        event={event}
                        color={eventColor(event, categoryColors)}
                        onClick={() => undefined}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {todayTasks.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {todayTasks.map((task) => (
                    <li key={task.id}>{taskRow(task, true)}</li>
                  ))}
                </ul>
              )}

              {activeHabits.length > 0 && (
                <div className="flex flex-col gap-2">
                  <SubHeading text={`Nawyki ${habitsDone}/${activeHabits.length}`} />
                  <ul className="flex flex-col gap-1">
                    {activeHabits.map((habit) => (
                      <li key={habit.id}>
                        <HabitTick
                          habit={habit}
                          color={
                            (habit.categoryId ? categoryColors.get(habit.categoryId) : undefined) ??
                            'var(--c-accent)'
                          }
                          value={habitValues.get(habit.id!)?.get(todayKey) ?? 0}
                          todayKey={todayKey}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Section>

        <Section
          title="Ten tydzień"
          hint={weekRangeLabel(week)}
          nav={
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setWeekBase(shiftDays(weekBase, -7))}
                aria-label="Poprzedni tydzień"
                className="text-muted active:text-ink -m-1.5 p-1.5"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              {!isThisWeek && (
                <button
                  type="button"
                  onClick={() => setWeekBase(new Date())}
                  className="text-accent px-1 text-xs font-medium"
                >
                  Dziś
                </button>
              )}
              <button
                type="button"
                onClick={() => setWeekBase(shiftDays(weekBase, 7))}
                aria-label="Następny tydzień"
                className="text-muted active:text-ink -m-1.5 p-1.5"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          }
        >
          <ul className="flex flex-col gap-4">
            {week.map((key) => {
              const dayEvents = eventsByDay.get(key) ?? [];
              const dayTasks = tasksByDay.get(key) ?? [];
              if (dayEvents.length === 0 && dayTasks.length === 0) return null;

              return (
                <li key={key} className="flex flex-col gap-1.5">
                  <SubHeading text={dayHeadingLabel(key)} strong={key === todayKey} />
                  {dayEvents.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      color={eventColor(event, categoryColors)}
                      onClick={() => undefined}
                    />
                  ))}
                  {dayTasks.map((task) => (
                    <div key={task.id}>{taskRow(task, true)}</div>
                  ))}
                </li>
              );
            })}
          </ul>

          {week.every(
            (key) => (eventsByDay.get(key) ?? []).length === 0 && (tasksByDay.get(key) ?? []).length === 0,
          ) && <p className="text-muted py-4 text-center text-sm">W tym tygodniu pusto.</p>}
        </Section>
      </div>

      <TaskSheet
        open={sheetOpen}
        task={editing}
        categories={categoryList}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}

/** Kafelek licznika. Pasek postępu pojawia się tylko tam, gdzie coś znaczy. */
function StatCard({
  label,
  value,
  ratio,
  alert = false,
}: {
  label: string;
  value: string;
  ratio?: number;
  alert?: boolean;
}) {
  return (
    <div className="bg-surface rounded-app flex flex-col gap-1.5 px-3 py-2.5">
      <span
        className={`text-2xl leading-none font-semibold tabular-nums ${
          alert ? 'text-weekend' : 'text-ink'
        }`}
      >
        {value}
      </span>
      <span className="text-muted text-[0.6875rem] leading-tight">{label}</span>
      {ratio !== undefined && (
        <span className="bg-bg h-1 overflow-hidden rounded-full">
          <span
            className="bg-accent block h-full rounded-full transition-[width]"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </span>
      )}
    </div>
  );
}

function Section({
  title,
  hint,
  nav,
  children,
}: {
  title: string;
  hint?: string;
  nav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-ink text-lg leading-none font-semibold">
          {title}
          {hint && <span className="text-muted ml-2 text-xs font-normal">{hint}</span>}
        </h2>
        {nav}
      </div>
      {children}
    </section>
  );
}

function SubHeading({ text, strong = false }: { text: string; strong?: boolean }) {
  return (
    <span
      className={`text-[0.6875rem] font-medium tracking-wide uppercase ${
        strong ? 'text-ink' : 'text-muted'
      }`}
    >
      {text}
    </span>
  );
}

/** Nawyk w skrócie: nazwa i jedno dotknięcie, bez paska historii. */
function HabitTick({
  habit,
  color,
  value,
  todayKey,
}: {
  habit: Habit;
  color: string;
  value: number;
  todayKey: string;
}) {
  const done = isDayComplete(habit, value);
  const counter = habit.kind === 'licznik';
  const next = counter ? value + 1 : done ? 0 : 1;
  // Odhaczony licznik nic już nie przyjmuje. Cofać się da w zakładce Nawyki,
  // gdzie jest minus — z ekranu podsumowania nie powinno dać się jednym
  // przypadkowym stuknięciem skasować ośmiu wcześniejszych.
  const spent = counter && done;

  return (
    <button
      type="button"
      disabled={spent}
      onClick={() => {
        tap();
        void setHabitValue(habit.id!, todayKey, next);
      }}
      aria-pressed={done}
      className="flex w-full items-center gap-3 py-1 text-left"
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors"
        style={{
          backgroundColor: done ? color : 'transparent',
          borderColor: done ? color : 'var(--c-border)',
        }}
      >
        {done && <CheckIcon className="h-3.5 w-3.5 text-white" />}
      </span>
      <span className="text-ink min-w-0 flex-1 truncate text-sm">{habit.name}</span>
      {habit.kind === 'licznik' && (
        <span className="text-muted shrink-0 text-xs tabular-nums">
          {value}/{habit.target}
        </span>
      )}
    </button>
  );
}
