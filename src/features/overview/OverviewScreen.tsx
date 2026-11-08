import { useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { randomQuote } from '../../app/quotes';
import { db } from '../../data/db';
import { entriesBetween, indexEntries, setHabitValue } from '../../data/habits';
import { compareTasks, taskDays, toggleTask, updateTask } from '../../data/tasks';
import type { Category, EventItem, Habit, Task } from '../../data/types';
import { compareEvents, lastDays, longDayLabel, toKey, weekdayWithDay } from '../../lib/dates';
import { useT } from '../../i18n';
import { useVisibleSections } from '../../app/sectionsStore';
import { SectionsSheet } from '../../ui/SectionsSheet';
import { tap } from '../../platform/haptics';
import { FONT_STACKS } from '../../theme/catalog';
import { SettingsButton } from '../../ui/SettingsButton';
import { SoftCard, SoftScreen } from '../../ui/SoftScreen';
import { BoltIcon, MoreIcon } from '../../ui/icons';
import { EventRow, eventColor } from '../calendar/EventChip';
import { HabitRow } from '../habits/HabitRow';
import { TaskRow } from '../tasks/TaskRow';
import { TaskSheet } from '../tasks/TaskSheet';

interface Props {
  onOpenSettings: () => void;
}

/** Ile dni do przodu sięga zakładka „wkrótce”. */
const SOON_DAYS = 14;

type Tab = 'dzis' | 'wkrotce';
type SoonMode = 'dni' | 'obszary';

/** Kolejne dni od jutra. */
function nextDays(todayKey: string, count: number): string[] {
  const out: string[] = [];
  const day = new Date(`${todayKey}T12:00:00`);
  for (let i = 0; i < count; i += 1) {
    day.setDate(day.getDate() + 1);
    out.push(toKey(day));
  }
  return out;
}

/** Zawartość jednej karty: wydarzenia, nawyki i zadania. */
interface Bucket {
  events: EventItem[];
  habits: Habit[];
  tasks: Task[];
}

const emptyBucket = (): Bucket => ({ events: [], habits: [], tasks: [] });
const isEmpty = (b: Bucket) => b.events.length + b.habits.length + b.tasks.length === 0;

/**
 * Ekran otwierający aplikację: data i sentencja, a pod nimi „dziś” — karty
 * po kategoriach z wydarzeniami, nawykami i zadaniami — oraz „wkrótce”,
 * czyli najbliższe dwa tygodnie po dniach albo po obszarach.
 */
export function OverviewScreen({ onOpenSettings }: Props) {
  const { t } = useT();
  const [editing, setEditing] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sekcjeOpen, setSekcjeOpen] = useState(false);
  const [quote] = useState(() => randomQuote());
  const [onlyQuick, setOnlyQuick] = useState(false);
  const [soonMode, setSoonMode] = useState<SoonMode>('dni');

  // Które bloki ekranu pokazać: „dziś” i „ten tydzień” to teraz dwie zakładki.
  const widoczneSekcje = useVisibleSections('przeglad');
  const tabs = (['dzis', 'wkrotce'] as Tab[]).filter((tab) =>
    widoczneSekcje.includes(tab === 'dzis' ? 'dzis' : 'tydzien'),
  );
  const [tabChoice, setTab] = useState<Tab>('dzis');
  const tab = tabs.includes(tabChoice) ? tabChoice : tabs[0];
  const nazwaSekcji = (id: string) =>
    id === 'liczniki' ? t.sekcje.liczniki : id === 'dzis' ? t.sekcje.dzis : t.sekcje.tydzien;

  const todayKey = useMemo(() => toKey(new Date()), []);
  const soonKeys = useMemo(() => nextDays(todayKey, SOON_DAYS), [todayKey]);
  const lastKey = soonKeys[soonKeys.length - 1]!;
  const week = useMemo(() => lastDays(7), []);

  const events = useLiveQuery(
    () => db.events.where('date').between(todayKey, lastKey, true, true).toArray(),
    [todayKey, lastKey],
  );
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());
  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray());
  const habitEntries = useLiveQuery(() => entriesBetween(week[0]!, todayKey), [week, todayKey]);

  const categoryList: Category[] = categories ?? [];
  const categoryById = useMemo(
    () => new Map(categoryList.filter((c) => c.id).map((c) => [c.id!, c])),
    [categoryList],
  );
  const categoryColors = useMemo(
    () => new Map(categoryList.filter((c) => c.id).map((c) => [c.id!, c.color])),
    [categoryList],
  );

  // Przegląd pokazuje tylko zadania główne — podzadania rozwijają się
  // w zakładce Zadania. Filtr „⚡ 5 min” zostawia same szybkie.
  const openTasks = useMemo(
    () =>
      (tasks ?? []).filter(
        (task) => !task.done && task.parentId === undefined && (!onlyQuick || task.quick),
      ),
    [tasks, onlyQuick],
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of openTasks) {
      for (const key of taskDays(task, todayKey, lastKey)) {
        const list = map.get(key);
        if (list) list.push(task);
        else map.set(key, [task]);
      }
    }
    for (const list of map.values()) list.sort(compareTasks);
    return map;
  }, [openTasks, todayKey, lastKey]);

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

  const overdue = useMemo(
    () => openTasks.filter((task) => task.dueDate !== undefined && task.dueDate < todayKey),
    [openTasks, todayKey],
  );
  const activeHabits = useMemo(() => (habits ?? []).filter((h) => !h.archived), [habits]);
  const habitValues = useMemo(() => indexEntries(habitEntries ?? []), [habitEntries]);

  // Liczniki nad zakładkami liczą zawsze wszystko, niezależnie od filtra.
  const allOpen = (tasks ?? []).filter((task) => !task.done && task.parentId === undefined);
  const doneToday = (tasks ?? []).filter((task) => task.done && task.dueDate === todayKey).length;
  const todayOpen = allOpen.filter((task) => taskDays(task, todayKey, todayKey).length > 0).length;
  const todayTotal = todayOpen + doneToday;
  const overdueAll = allOpen.filter((task) => task.dueDate !== undefined && task.dueDate < todayKey);

  /** Rozkłada zawartość na karty kategorii; bez kategorii na końcu. */
  const byCategory = (bucket: Bucket) => {
    const map = new Map<number, Bucket>();
    const get = (id: number | undefined) => {
      const key = id !== undefined && categoryById.has(id) ? id : 0;
      let b = map.get(key);
      if (!b) map.set(key, (b = emptyBucket()));
      return b;
    };
    for (const event of bucket.events) get(event.categoryId).events.push(event);
    for (const habit of bucket.habits) get(habit.categoryId).habits.push(habit);
    for (const task of bucket.tasks) get(task.categoryId).tasks.push(task);
    const order = [...categoryList.map((c) => c.id!), 0];
    return order
      .filter((id) => map.has(id))
      .map((id) => ({ category: categoryById.get(id), bucket: map.get(id)! }));
  };

  const today: Bucket = {
    events: onlyQuick ? [] : (eventsByDay.get(todayKey) ?? []),
    habits: onlyQuick ? [] : activeHabits,
    // Zaległe na górze dnia — to one najbardziej czekają.
    tasks: [...overdue, ...(tasksByDay.get(todayKey) ?? []).filter((t) => !overdue.includes(t))],
  };

  const soonByDay = soonKeys.map((key) => ({
    key,
    bucket: {
      events: onlyQuick ? [] : (eventsByDay.get(key) ?? []),
      habits: [],
      tasks: tasksByDay.get(key) ?? [],
    },
  }));
  const soonAll: Bucket = emptyBucket();
  const seenTasks = new Set<number>();
  for (const { bucket } of soonByDay) {
    soonAll.events.push(...bucket.events);
    for (const task of bucket.tasks) {
      if (!seenTasks.has(task.id!)) {
        seenTasks.add(task.id!);
        soonAll.tasks.push(task);
      }
    }
  }

  const openTask = (task: Task | null) => {
    setEditing(task);
    setSheetOpen(true);
  };

  const taskRow = (task: Task, hideDueDate: boolean, hideCategory: boolean) => (
    <TaskRow
      task={task}
      categoryName={task.categoryId ? categoryById.get(task.categoryId)?.name : undefined}
      categoryColor={task.categoryId ? categoryColors.get(task.categoryId) : undefined}
      hideDueDate={hideDueDate}
      hideCategory={hideCategory}
      onToggle={() => {
        tap();
        void toggleTask(task.id!, !task.done);
      }}
      onToggleStar={() => void updateTask(task.id!, { starred: !task.starred })}
      onEdit={() => openTask(task)}
    />
  );

  const rows = (bucket: Bucket, opts: { hideDueDate: boolean; hideCategory: boolean; dated?: boolean }) => (
    <ul className="flex flex-col gap-1.5">
      {bucket.events.map((event) => (
        <li key={`e${event.id}`}>
          {opts.dated && (
            <span className="text-muted block text-[0.6875rem]">{weekdayWithDay(event.date)}</span>
          )}
          <EventRow event={event} color={eventColor(event, categoryColors)} onClick={() => undefined} />
        </li>
      ))}
      {bucket.habits.map((habit) => (
        <li key={`h${habit.id}`}>
          <HabitRow
            habit={habit}
            color={(habit.categoryId ? categoryColors.get(habit.categoryId) : undefined) ?? 'var(--c-accent)'}
            days={habitValues.get(habit.id!)}
            todayKey={todayKey}
            size="maly"
            onSetValue={(value) => {
              tap();
              void setHabitValue(habit.id!, todayKey, value);
            }}
          />
        </li>
      ))}
      {bucket.tasks.map((task) => (
        <li key={`t${task.id}`}>{taskRow(task, opts.hideDueDate, opts.hideCategory)}</li>
      ))}
    </ul>
  );

  const categoryCard = (category: Category | undefined, body: ReactNode, key: string | number) => (
    <SoftCard key={key}>
      <h3 className="text-ink flex items-center gap-2.5 pb-2 text-[1.0625rem] font-semibold">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: category?.color ?? 'var(--c-text-faint)' }}
          aria-hidden="true"
        />
        <span className="truncate">{category?.name ?? t.zadania.bezKategorii}</span>
      </h3>
      {body}
    </SoftCard>
  );

  const emptyText = (text: string) => <p className="text-muted py-8 text-center text-sm">{text}</p>;

  let content: ReactNode = null;
  if (tab === 'dzis') {
    const cards = byCategory(today);
    content =
      cards.length === 0
        ? emptyText(t.przeglad.nicNaDzis)
        : cards.map(({ category, bucket }) =>
            categoryCard(category, rows(bucket, { hideDueDate: true, hideCategory: true }), category?.id ?? 0),
          );
  } else if (tab === 'wkrotce') {
    const switcher = (
      <div className="flex items-center gap-2 pb-1 text-sm">
        {(['dni', 'obszary'] as SoonMode[]).map((mode, i) => (
          <span key={mode} className="flex items-center gap-2">
            {i > 0 && <span className="text-faint">·</span>}
            <button
              type="button"
              onClick={() => setSoonMode(mode)}
              aria-pressed={soonMode === mode}
              className={soonMode === mode ? 'text-ink font-semibold' : 'text-muted'}
            >
              {mode === 'dni' ? t.przeglad.poDniach : t.przeglad.poObszarach}
            </button>
          </span>
        ))}
      </div>
    );
    let cards: ReactNode;
    if (soonMode === 'dni') {
      const days = soonByDay.filter(({ bucket }) => !isEmpty(bucket));
      cards =
        days.length === 0
          ? emptyText(t.przeglad.nicWkrotce)
          : days.map(({ key, bucket }) => (
              <SoftCard key={key}>
                <h3 className="text-muted pb-2 text-xs font-semibold tracking-[0.18em] uppercase">
                  {weekdayWithDay(key)}
                </h3>
                {rows(bucket, { hideDueDate: true, hideCategory: false })}
              </SoftCard>
            ));
    } else {
      const areas = byCategory(soonAll);
      cards =
        areas.length === 0
          ? emptyText(t.przeglad.nicWkrotce)
          : areas.map(({ category, bucket }) =>
              categoryCard(
                category,
                rows(bucket, { hideDueDate: false, hideCategory: true, dated: true }),
                category?.id ?? 0,
              ),
            );
    }
    content = (
      <>
        {switcher}
        {cards}
      </>
    );
  }

  return (
    <SoftScreen
      actions={
        <>
          <button
            type="button"
            onClick={() => setSekcjeOpen(true)}
            aria-label={t.sekcje.otworz}
            className="text-muted active:text-ink -m-2 p-2"
          >
            <MoreIcon className="h-6 w-6" />
          </button>
          <SettingsButton onClick={onOpenSettings} />
        </>
      }
      fab={{ label: t.zadania.noweZadanie, onClick: () => openTask(null) }}
    >
      <header className="pt-2 pb-6">
        <p className="text-muted text-sm first-letter:uppercase">{longDayLabel(todayKey)}</p>
        <p
          className="text-ink pt-1.5 text-[1.625rem] leading-[1.25]"
          style={{ fontFamily: FONT_STACKS.literata }}
        >
          {quote}
        </p>
      </header>

      {widoczneSekcje.includes('liczniki') && (
        <div className="grid grid-cols-3 gap-2 pb-6">
          <StatCard
            label={t.przeglad.naDzis}
            value={`${doneToday}/${todayTotal}`}
            ratio={todayTotal === 0 ? 0 : doneToday / todayTotal}
          />
          <StatCard label={t.przeglad.wydarzenia} value={String((eventsByDay.get(todayKey) ?? []).length)} />
          <StatCard label={t.przeglad.zalegle} value={String(overdueAll.length)} alert={overdueAll.length > 0} />
        </div>
      )}

      {tabs.length > 0 && (
        <div className="flex items-center gap-6 pb-5">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              aria-pressed={tab === item}
              className={`relative pb-2 text-[1.0625rem] lowercase ${tab === item ? 'text-ink' : 'text-muted'}`}
            >
              {item === 'dzis' ? t.wspolne.dzis : t.przeglad.wkrotce}
              {tab === item && (
                <span className="bg-ink absolute bottom-0 left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-full" />
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              tap();
              setOnlyQuick((value) => !value);
            }}
            aria-pressed={onlyQuick}
            aria-label={t.zadania.tylkoSzybkie}
            className={`ml-auto flex items-center gap-1 pb-2 text-sm ${onlyQuick ? 'text-accent font-semibold' : 'text-muted'}`}
          >
            <BoltIcon className="h-4 w-4" filled={onlyQuick} />
            {t.zadania.piecMin}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">{content}</div>

      <SectionsSheet
        open={sekcjeOpen}
        owner="przeglad"
        label={nazwaSekcji}
        onClose={() => setSekcjeOpen(false)}
      />

      <TaskSheet
        open={sheetOpen}
        task={editing}
        categories={categoryList}
        defaultDueDate={editing ? undefined : todayKey}
        onClose={() => setSheetOpen(false)}
      />
    </SoftScreen>
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
    <div
      className="bg-surface flex flex-col gap-1.5 px-3 py-2.5 shadow-[0_1px_12px_rgba(0,0,0,0.04)]"
      style={{ borderRadius: 'calc(var(--r-app) * 1.1)' }}
    >
      <span className={`text-2xl leading-none font-semibold tabular-nums ${alert ? 'text-weekend' : 'text-ink'}`}>
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
