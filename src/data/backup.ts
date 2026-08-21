import { normalizeLayout, type Layout } from '../app/tabs';
import { useLayoutStore } from '../app/layoutStore';
import { toKey } from '../lib/dates';
import { useThemeStore } from '../theme/store';
import {
  keepValid,
  sanitizeTheme,
  sanitizeThemeList,
  validCategory,
  validEvent,
  validHabit,
  validHabitEntry,
  validNote,
  validTask,
} from './validate';
import type { Theme } from '../theme/types';
import { db } from './db';
import type { Category, EventItem, Habit, HabitEntry, Note, Task } from './types';

/**
 * Kopia zapasowa całej aplikacji. Przy PWA to jedyne zabezpieczenie przed
 * utratą danych — skasowanie ikony z ekranu początkowego kasuje też bazę.
 */

const FORMAT = 'planer-kaskowy';
const FORMAT_VERSION = 2;

export interface BackupFile {
  aplikacja: string;
  wersja: number;
  zapisano: string;
  dane: {
    categories: Category[];
    events: EventItem[];
    tasks: Task[];
    habits: Habit[];
    habitEntries: HabitEntry[];
    notes: Note[];
  };
  motyw: {
    aktualny: Theme;
    zapisane: Theme[];
  };
  uklad: Layout;
}

export async function buildBackup(): Promise<BackupFile> {
  const [categories, events, tasks, habits, habitEntries, notes] = await Promise.all([
    db.categories.toArray(),
    db.events.toArray(),
    db.tasks.toArray(),
    db.habits.toArray(),
    db.habitEntries.toArray(),
    db.notes.toArray(),
  ]);

  const { theme, saved } = useThemeStore.getState();
  const { order, hidden, calendarTasks } = useLayoutStore.getState();

  return {
    aplikacja: FORMAT,
    wersja: FORMAT_VERSION,
    zapisano: new Date().toISOString(),
    dane: { categories, events, tasks, habits, habitEntries, notes },
    motyw: { aktualny: theme, zapisane: saved },
    uklad: { order, hidden, calendarTasks },
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
}

export function summarize(backup: BackupFile): BackupSummary {
  return {
    categories: backup.dane.categories.length,
    events: backup.dane.events.length,
    tasks: backup.dane.tasks.length,
    habits: backup.dane.habits.length,
    habitEntries: backup.dane.habitEntries.length,
    notes: backup.dane.notes.length,
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
    return fail('To nie jest plik kopii zapasowej — nie udało się go odczytać.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return fail('Plik ma nieznaną zawartość.');
  }

  const candidate = parsed as Record<string, unknown>;

  if (candidate.aplikacja !== FORMAT) {
    return fail('Ten plik nie pochodzi z Planera Kaśkowego.');
  }
  if (typeof candidate.wersja !== 'number' || candidate.wersja > FORMAT_VERSION) {
    return fail('Kopia pochodzi z nowszej wersji aplikacji. Zaktualizuj aplikację i spróbuj ponownie.');
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

  const skipped =
    categories.skipped +
    events.skipped +
    tasks.skipped +
    habits.skipped +
    habitEntries.skipped +
    notes.skipped;

  const motyw =
    typeof candidate.motyw === 'object' && candidate.motyw !== null
      ? (candidate.motyw as Record<string, unknown>)
      : {};

  return {
    backup: {
      aplikacja: FORMAT,
      wersja: candidate.wersja,
      zapisano: typeof candidate.zapisano === 'string' ? candidate.zapisano : '',
      dane: {
        categories: categories.kept,
        events: events.kept,
        tasks: tasks.kept,
        habits: habits.kept,
        habitEntries: habitEntries.kept,
        notes: notes.kept,
      },
      motyw: {
        aktualny: sanitizeTheme(motyw.aktualny),
        zapisane: sanitizeThemeList(motyw.zapisane),
      },
      // Kopie w formacie 1 nie znały układu zakładek — wtedy wchodzi domyślny.
      uklad: normalizeLayout(candidate.uklad),
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
    [db.categories, db.events, db.tasks, db.habits, db.habitEntries, db.notes],
    async () => {
      await Promise.all([
        db.categories.clear(),
        db.events.clear(),
        db.tasks.clear(),
        db.habits.clear(),
        db.habitEntries.clear(),
        db.notes.clear(),
      ]);
      await Promise.all([
        db.categories.bulkAdd(backup.dane.categories),
        db.events.bulkAdd(backup.dane.events),
        db.tasks.bulkAdd(backup.dane.tasks),
        db.habits.bulkAdd(backup.dane.habits),
        db.habitEntries.bulkAdd(backup.dane.habitEntries),
        db.notes.bulkAdd(backup.dane.notes),
      ]);
    },
  );

  if (backup.motyw?.aktualny) {
    useThemeStore.getState().replaceAll(backup.motyw.aktualny, backup.motyw.zapisane ?? []);
  }
  useLayoutStore.getState().replaceAll(normalizeLayout(backup.uklad));
}
