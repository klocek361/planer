export type TabId = 'przeglad' | 'kalendarz' | 'zadania' | 'listy' | 'nawyki';

/** Kolejność, w jakiej zakładki pojawiają się w świeżo zainstalowanej aplikacji. */
export const DEFAULT_TAB_ORDER: TabId[] = [
  'przeglad',
  'kalendarz',
  'zadania',
  'listy',
  'nawyki',
];

/** Jak zadania z terminem pokazują się w siatce kalendarza. */
export type CalendarTasks = 'nazwy' | 'licznik';

export interface Layout {
  /** Kolejność zakładek na dolnym pasku. */
  order: TabId[];
  /** Zakładki wyłączone — zostają w ustawieniach, znikają z paska. */
  hidden: TabId[];
  /** Sposób pokazywania zadań w siatce miesiąca. */
  calendarTasks: CalendarTasks;
}

export const DEFAULT_LAYOUT: Layout = {
  order: DEFAULT_TAB_ORDER,
  hidden: [],
  calendarTasks: 'nazwy',
};

const isTabId = (value: unknown): value is TabId =>
  typeof value === 'string' && (DEFAULT_TAB_ORDER as string[]).includes(value);

/**
 * Doprowadza układ do stanu używalnego: zna tylko istniejące zakładki, każdą
 * dokładnie raz, dokłada te dodane w nowszej wersji aplikacji i nie pozwala
 * schować wszystkiego — pasek bez ani jednej zakładki byłby ślepym zaułkiem.
 */
export function normalizeLayout(input: unknown): Layout {
  const record =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};

  const rawOrder = Array.isArray(record.order) ? record.order : [];
  const order: TabId[] = [];
  for (const item of rawOrder) {
    if (isTabId(item) && !order.includes(item)) order.push(item);
  }
  for (const tab of DEFAULT_TAB_ORDER) {
    if (!order.includes(tab)) order.push(tab);
  }

  const rawHidden = Array.isArray(record.hidden) ? record.hidden : [];
  const hidden: TabId[] = [];
  for (const item of rawHidden) {
    if (isTabId(item) && !hidden.includes(item)) hidden.push(item);
  }
  // Ostatnia widoczna zakładka zostaje na pasku, choćby plik mówił inaczej.
  while (hidden.length >= order.length) hidden.pop();

  const calendarTasks: CalendarTasks = record.calendarTasks === 'licznik' ? 'licznik' : 'nazwy';

  return { order, hidden, calendarTasks };
}

/**
 * Zakładki widoczne na pasku, w ustawionej kolejności. Bierze tylko te dwa
 * pola układu, których faktycznie potrzebuje — dzięki temu wywołania nie muszą
 * przepisywać reszty ustawień tylko po to, żeby spełnić typ.
 */
export function visibleTabs(layout: Pick<Layout, 'order' | 'hidden'>): TabId[] {
  return layout.order.filter((tab) => !layout.hidden.includes(tab));
}
