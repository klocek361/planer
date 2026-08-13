import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  backupFilename,
  exportToJson,
  parseBackup,
  restoreBackup,
  summarize,
  type ParsedBackup,
} from '../../data/backup';
import { db } from '../../data/db';
import { pickTextFile, saveTextFile } from '../../platform/files';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';

export function BackupScreen({ onBack }: { onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [restored, setRestored] = useState(false);

  const counts = useLiveQuery(async () => ({
    categories: await db.categories.count(),
    events: await db.events.count(),
    tasks: await db.tasks.count(),
    habits: await db.habits.count(),
    habitEntries: await db.habitEntries.count(),
  }));

  const doExport = async () => {
    setError(null);
    setBusy(true);
    try {
      await saveTextFile(backupFilename(), await exportToJson());
    } catch {
      setError('Nie udało się zapisać pliku.');
    } finally {
      setBusy(false);
    }
  };

  const doPick = async () => {
    setError(null);
    setRestored(false);
    const json = await pickTextFile();
    if (json === null) return;
    try {
      setPending(parseBackup(json));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się odczytać pliku.');
    }
  };

  const doRestore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreBackup(pending.backup);
      setPending(null);
      setRestored(true);
    } catch {
      setError('Nie udało się wgrać kopii.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Kopia zapasowa" onBack={onBack}>
      <div
        className="rounded-app mb-5 px-3 py-2.5 text-xs"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--c-weekend) 12%, transparent)',
          color: 'var(--c-weekend)',
        }}
      >
        Dane są tylko na tym telefonie. Usunięcie ikony z ekranu początkowego kasuje je
        bezpowrotnie — rób kopię co jakiś czas.
      </div>

      {counts && (
        <p className="text-muted pb-5 text-sm">
          W aplikacji jest teraz: {counts.events} wydarzeń, {counts.tasks} zadań, {counts.habits}{' '}
          nawyków ({counts.habitEntries} odhaczeń) i {counts.categories} kategorii.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button variant="primary" disabled={busy} onClick={doExport}>
          Zapisz kopię do pliku
        </Button>
        <p className="text-muted pb-3 text-xs">
          Na iPhonie otworzy się okno udostępniania — wybierz „Zapisz w Plikach”, żeby kopia
          trafiła na iCloud Drive.
        </p>

        <Button disabled={busy} onClick={doPick}>
          Wgraj kopię z pliku
        </Button>
        <p className="text-muted text-xs">
          Wgranie zastąpi wszystko, co jest teraz w aplikacji.
        </p>
      </div>

      {error && (
        <p className="text-weekend pt-4 text-sm" role="alert">
          {error}
        </p>
      )}

      {restored && (
        <p className="text-muted pt-4 text-sm" role="status">
          Kopia została wgrana.
        </p>
      )}

      <Sheet open={pending !== null} title="Wgrać tę kopię?" onClose={() => setPending(null)}>
        {pending && (
          <div className="flex flex-col gap-4">
            <p className="text-muted text-sm">
              {pending.backup.zapisano
                ? `Kopia z dnia ${new Date(pending.backup.zapisano).toLocaleDateString('pl-PL')}.`
                : 'Kopia bez daty zapisu.'}{' '}
              Zawiera:
            </p>
            <ul className="text-ink flex flex-col gap-1 text-sm">
              {Object.entries(summarize(pending.backup)).map(([key, value]) => (
                <li key={key} className="flex justify-between">
                  <span className="text-muted">{TABLE_LABELS[key] ?? key}</span>
                  <span className="tabular-nums">{value}</span>
                </li>
              ))}
            </ul>
            {pending.skipped > 0 && (
              <p className="text-weekend text-xs">
                {pending.skipped}{' '}
                {pending.skipped === 1 ? 'wpis był uszkodzony i został' : 'wpisów było uszkodzonych i zostało'}{' '}
                pominiętych. Reszta kopii nadaje się do wgrania.
              </p>
            )}

            <p className="text-weekend text-xs">
              Wszystko, co jest teraz w aplikacji, zostanie zastąpione.
            </p>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" disabled={busy} onClick={doRestore}>
                Wgraj i zastąp
              </Button>
              <Button onClick={() => setPending(null)}>Anuluj</Button>
            </div>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}

const TABLE_LABELS: Record<string, string> = {
  categories: 'Kategorie',
  events: 'Wydarzenia',
  tasks: 'Zadania',
  habits: 'Nawyki',
  habitEntries: 'Odhaczenia nawyków',
  notes: 'Notatki',
};
