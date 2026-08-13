import { toKey } from '../lib/dates';
import { useThemeStore } from '../theme/store';
import type { Theme } from '../theme/types';
import { db } from './db';
import type { Category, EventItem, Habit, HabitEntry, Note, Task } from './types';

/**
 * Kopia zapasowa całej aplikacji. Przy PWA to jedyne zabezpieczenie przed
 * utratą danych — skasowanie ikony z ekranu początkowego kasuje też bazę.
 */

const FORMAT = 'planer-kaskowy';
const FORMAT_VERSION = 1;

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

  return {
    aplikacja: FORMAT,
    wersja: FORMAT_VERSION,
    zapisano: new Date().toISOString(),
    dane: { categories, events, tasks, habits, habitEntries, notes },
    motyw: { aktualny: theme, zapisane: saved },
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
export function parseBackup(json: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return fail('To nie jest plik kopii zapasowej — nie udało się go odczytać.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return fail('Plik ma nieznaną zawartość.');
  }

  const candidate = parsed as Partial<BackupFile>;

  if (candidate.aplikacja !== FORMAT) {
    return fail('Ten plik nie pochodzi z Planera Kaśkowego.');
  }
  if (typeof candidate.wersja !== 'number' || candidate.wersja > FORMAT_VERSION) {
    return fail('Kopia pochodzi z nowszej wersji aplikacji. Zaktualizuj aplikację i spróbuj ponownie.');
  }

  const dane = candidate.dane;
  if (typeof dane !== 'object' || dane === null) {
    return fail('W pliku brakuje sekcji z danymi.');
  }

  const tables = ['categories', 'events', 'tasks', 'habits', 'habitEntries', 'notes'] as const;
  for (const table of tables) {
    if (!Array.isArray(dane[table])) {
      return fail(`W pliku brakuje danych: ${table}.`);
    }
  }

  return candidate as BackupFile;
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
}
