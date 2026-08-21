import { normalizeLayout, type Layout } from '../app/tabs';
import { useLayoutStore } from '../app/layoutStore';
import { normalizeAllSections, type AllSections } from '../app/sections';
import { useSectionsStore } from '../app/sectionsStore';
import { APP_VERSION } from '../app/version';
import { toKey } from '../lib/dates';
import { useThemeStore } from '../theme/store';
import {
  keepValid,
  sanitizeTheme,
  sanitizeThemeList,
  validCategory,
  validChecklist,
  validChecklistItem,
  validEvent,
  validHabit,
  validHabitEntry,
  validNote,
  validTask,
} from './validate';
import type { Theme } from '../theme/types';
import { db } from './db';
import type {
  Category,
  Checklist,
  ChecklistItem,
  EventItem,
  Habit,
  HabitEntry,
  Note,
  Task,
} from './types';
import { currentDict } from '../i18n';

/**
 * Kopia zapasowa całej aplikacji. Przy PWA to jedyne zabezpieczenie przed
 * utratą danych — skasowanie ikony z ekranu początkowego kasuje też bazę.
 */

const FORMAT = 'planer-kaskowy';
// Wersja 3 dokłada listy. Pliki w wersji 2 i 1 dalej się wczytują —
// brakujące sekcje wchodzą jako puste.
const FORMAT_VERSION = 3;

export interface BackupFile {
  aplikacja: string;
  /** Wersja formatu pliku — decyduje o tym, czy da się go wczytać. */
  wersja: number;
  /**
   * Wersja aplikacji, która zapisała kopię. Nie wpływa na wczytywanie —
   * służy do tego, żeby po latach dało się powiedzieć, skąd plik pochodzi.
   */
  wersjaAplikacji: string;
  zapisano: string;
  dane: {
    categories: Category[];
    events: EventItem[];
    tasks: Task[];
    habits: Habit[];
    habitEntries: HabitEntry[];
    notes: Note[];
    lists: Checklist[];
    listItems: ChecklistItem[];
  };
  motyw: {
    aktualny: Theme;
    zapisane: Theme[];
  };
  uklad: Layout;
  sekcje: AllSections;
}

export async function buildBackup(): Promise<BackupFile> {
  const [categories, events, tasks, habits, habitEntries, notes, lists, listItems] =
    await Promise.all([
      db.categories.toArray(),
      db.events.toArray(),
      db.tasks.toArray(),
      db.habits.toArray(),
      db.habitEntries.toArray(),
      db.notes.toArray(),
      db.lists.toArray(),
      db.listItems.toArray(),
    ]);

  const { theme, saved } = useThemeStore.getState();
  const { order, hidden, calendarTasks } = useLayoutStore.getState();
  const { sekcje } = useSectionsStore.getState();

  return {
    aplikacja: FORMAT,
    wersja: FORMAT_VERSION,
    wersjaAplikacji: APP_VERSION,
    zapisano: new Date().toISOString(),
    dane: { categories, events, tasks, habits, habitEntries, notes, lists, listItems },
    motyw: { aktualny: theme, zapisane: saved },
    uklad: { order, hidden, calendarTasks },
    sekcje,
  };
}

export async function exportToJson(): Promise<string> {
  return JSON.stringify(await buildBackup(), null, 2);
}

/**
 * Nazwa pliku z datą, żeby kolejne kopie się nie nadpisywały.
 * Data jest lokalna, nie UTC — inaczej kopia zrobiona w Polsce przed drugą
 * w nocy dostawałaby nazwę z wczorajszym dniem.
 */
export function backupFilename(now = new Date()): string {
  return `planer-kaskowy-${toKey(now)}.json`;
}

export interface ParsedBackup {
  backup: BackupFile;
  /** Ile rekordów odrzucono jako uszkodzone przy wczytywaniu pliku. */
  skipped: number;
}

export interface BackupSummary {
  categories: number;
  events: number;
  tasks: number;
  habits: number;
  habitEntries: number;
  notes: number;
  lists: number;
}

export function summarize(backup: BackupFile): BackupSummary {
  return {
    categories: backup.dane.categories.length,
    events: backup.dane.events.length,
    tasks: backup.dane.tasks.length,
    habits: backup.dane.habits.length,
    habitEntries: backup.dane.habitEntries.length,
    notes: backup.dane.notes.length,
    lists: backup.dane.lists.length,
  };
}

/**
 * Sprawdza, czy wczytany plik jest kopią z tej aplikacji.
 * Rzuca zrozumiałym komunikatem zamiast pozwalać na wgranie czegokolwiek.
 */
export function parseBackup(json: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return fail(currentDict().kopia.bladNieplik);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return fail(currentDict().kopia.bladZawartosc);
  }

  const candidate = parsed as Record<string, unknown>;

  if (candidate.aplikacja !== FORMAT) {
    return fail(currentDict().kopia.bladObcy);
  }
  if (typeof candidate.wersja !== 'number' || candidate.wersja > FORMAT_VERSION) {
    return fail(currentDict().kopia.bladNowsza);
  }

  const dane =
    typeof candidate.dane === 'object' && candidate.dane !== null
      ? (candidate.dane as Record<string, unknown>)
      : null;
  if (!dane) return fail('W pliku brakuje sekcji z danymi.');

  const tables = ['categories', 'events', 'tasks', 'habits', 'habitEntries', 'notes'] as const;
  for (const table of tables) {
    if (!Array.isArray(dane[table])) {
      return fail(`W pliku brakuje danych: ${table}.`);
    }
  }

  // Zawartość pliku jest sprawdzana rekord po rekordzie. Uszkodzone wpisy
  // odpadają pojedynczo, żeby z częściowo popsutej kopii dało się odzyskać resztę.
  const categories = keepValid(dane.categories as unknown[], validCategory);
  const events = keepValid(dane.events as unknown[], validEvent);
  const tasks = keepValid(dane.tasks as unknown[], validTask);
  const habits = keepValid(dane.habits as unknown[], validHabit);
  const habitEntries = keepValid(dane.habitEntries as unknown[], validHabitEntry);
  const notes = keepValid(dane.notes as unknown[], validNote);
  // Kopie sprzed wprowadzenia list nie mają tych sekcji — wchodzą jako puste.
  const lists = keepValid((dane.lists ?? []) as unknown[], validChecklist);
  const listItems = keepValid((dane.listItems ?? []) as unknown[], validChecklistItem);

  const skipped =
    categories.skipped +
    events.skipped +
    tasks.skipped +
    habits.skipped +
    habitEntries.skipped +
    notes.skipped +
    lists.skipped +
    listItems.skipped;

  const motyw =
    typeof candidate.motyw === 'object' && candidate.motyw !== null
      ? (candidate.motyw as Record<string, unknown>)
      : {};

  return {
    backup: {
      aplikacja: FORMAT,
      wersja: candidate.wersja,
      // Starsze kopie nie zapisywały wersji aplikacji.
      wersjaAplikacji:
        typeof candidate.wersjaAplikacji === 'string' ? candidate.wersjaAplikacji : '',
      zapisano: typeof candidate.zapisano === 'string' ? candidate.zapisano : '',
      dane: {
        categories: categories.kept,
        events: events.kept,
        tasks: tasks.kept,
        habits: habits.kept,
        habitEntries: habitEntries.kept,
        notes: notes.kept,
        lists: lists.kept,
        listItems: listItems.kept,
      },
      motyw: {
        aktualny: sanitizeTheme(motyw.aktualny),
        zapisane: sanitizeThemeList(motyw.zapisane),
      },
      // Kopie w formacie 1 nie znały układu zakładek — wtedy wchodzi domyślny.
      uklad: normalizeLayout(candidate.uklad),
      // Kopie sprzed wprowadzenia sekcji wchodzą z układem domyślnym.
      sekcje: normalizeAllSections(candidate.sekcje),
    },
    skipped,
  };
}

function fail(message: string): never {
  throw new Error(message);
}

/**
 * Wgrywa kopię, zastępując obecną zawartość. Wszystko dzieje się w jednej
 * transakcji — przerwany import nie zostawi bazy w połowie podmienionej.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.categories,
      db.events,
      db.tasks,
      db.habits,
      db.habitEntries,
      db.notes,
      db.lists,
      db.listItems,
    ],
    async () => {
      await Promise.all([
        db.categories.clear(),
        db.events.clear(),
        db.tasks.clear(),
        db.habits.clear(),
        db.habitEntries.clear(),
        db.notes.clear(),
        db.lists.clear(),
        db.listItems.clear(),
      ]);
      await Promise.all([
        db.categories.bulkAdd(backup.dane.categories),
        db.events.bulkAdd(backup.dane.events),
        db.tasks.bulkAdd(backup.dane.tasks),
        db.habits.bulkAdd(backup.dane.habits),
        db.habitEntries.bulkAdd(backup.dane.habitEntries),
        db.notes.bulkAdd(backup.dane.notes),
        db.lists.bulkAdd(backup.dane.lists),
        db.listItems.bulkAdd(backup.dane.listItems),
      ]);
    },
  );

  if (backup.motyw?.aktualny) {
    useThemeStore.getState().replaceAll(backup.motyw.aktualny, backup.motyw.zapisane ?? []);
  }
  useLayoutStore.getState().replaceAll(normalizeLayout(backup.uklad));
  useSectionsStore.getState().replaceAll(backup.sekcje);
}
