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
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { fullDateLabel } from '../../lib/dates';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';

export function BackupScreen({ onBack }: { onBack: () => void }) {
  const { t, plural } = useT();
  // Nazwy tabel w podsumowaniu kopii — klucz to nazwa tabeli w bazie.
  const tableLabels: Record<string, string> = {
    categories: t.kopia.liczby.kategorie,
    events: t.kopia.liczby.wydarzenia,
    tasks: t.kopia.liczby.zadania,
    habits: t.kopia.liczby.nawyki,
    habitEntries: t.kopia.liczby.odhaczenia,
    notes: t.kopia.liczby.notatki,
    lists: t.kopia.liczby.listy,
  };

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
      setError(t.kopia.bledyZapisu);
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
      setError(err instanceof Error ? err.message : t.kopia.bledyOdczytu);
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
      setError(t.kopia.bledyWgrania);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t.kopia.tytul} onBack={onBack}>
      <div
        className="rounded-app mb-5 px-3 py-2.5 text-xs"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--c-weekend) 12%, transparent)',
          color: 'var(--c-weekend)',
        }}
      >
        {t.kopia.ostrzezenieDane}
      </div>

      {counts && (
        <p className="text-muted pb-5 text-sm">
          {t.kopia.stanAplikacji(
            [
              plural(counts.events, t.daty.wydarzenie),
              plural(counts.tasks, t.daty.zadanie),
              plural(counts.habits, t.daty.nawyk),
              plural(counts.habitEntries, t.daty.odhaczenie),
              plural(counts.categories, t.daty.kategoria),
            ].join(', '),
          )}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button variant="primary" disabled={busy} onClick={doExport}>
          {t.kopia.zapiszDoPliku}
        </Button>
        <p className="text-muted pb-3 text-xs">
          {t.kopia.wskazowkaZapisu}
        </p>

        <Button disabled={busy} onClick={doPick}>
          {t.kopia.wgrajZPliku}
        </Button>
        <p className="text-muted text-xs">
          {t.kopia.wskazowkaWgrania}
        </p>
      </div>

      {error && (
        <p className="text-weekend pt-4 text-sm" role="alert">
          {error}
        </p>
      )}

      {restored && (
        <p className="text-muted pt-4 text-sm" role="status">
          {t.kopia.wgrano}
        </p>
      )}

      <Sheet open={pending !== null} title={t.kopia.pytanie} onClose={() => setPending(null)}>
        {pending && (
          <div className="flex flex-col gap-4">
            <p className="text-muted text-sm">
              {pending.backup.zapisano
                ? t.kopia.zDnia(fullDateLabel(new Date(pending.backup.zapisano)))
                : t.kopia.bezDaty}{' '}
              {t.kopia.zawiera}
            </p>
            <ul className="text-ink flex flex-col gap-1 text-sm">
              {Object.entries(summarize(pending.backup)).map(([key, value]) => (
                <li key={key} className="flex justify-between">
                  <span className="text-muted">{tableLabels[key] ?? key}</span>
                  <span className="tabular-nums">{value}</span>
                </li>
              ))}
            </ul>
            {pending.skipped > 0 && (
              <p className="text-weekend text-xs">
                {t.kopia.uszkodzone(pending.skipped)} {t.kopia.resztaDobra}
              </p>
            )}

            <p className="text-weekend text-xs">
              {t.kopia.ostrzezenie}
            </p>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" disabled={busy} onClick={doRestore}>
                {t.kopia.wgrajIZastap}
              </Button>
              <Button onClick={() => setPending(null)}>{t.wspolne.anuluj}</Button>
            </div>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}


