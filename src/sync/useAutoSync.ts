import { useEffect } from 'react';
import Dexie from 'dexie';
import { db } from '../data/db';
import { httpTransport, syncAvailable } from '../platform/sync';
import { syncAll } from './engine';
import { SyncError } from './transport';

/** Co ile synchronizować, gdy aplikacja jest otwarta i nic się nie dzieje. */
const INTERVAL_MS = 45_000;
/** Po lokalnej zmianie chwilę czekamy, żeby seria edycji poszła jednym razem. */
const DEBOUNCE_MS = 2_000;

/** Synchronizacja wszystkich kalendarzy z zapisem błędu każdego do pokazania w ustawieniach. */
export async function syncAndRecord(): Promise<void> {
  if (!syncAvailable() || (await db.syncState.count()) === 0) return;
  await syncAll(httpTransport(), async (space, err) => {
    const code = err instanceof SyncError ? err.code : 'serwer';
    await db.syncState.update(space, { lastError: code });
  });
}

/**
 * Synchronizacja w tle: przy starcie, co 45 s przy otwartej aplikacji,
 * po powrocie do niej, po odzyskaniu internetu i chwilę po każdej zmianie
 * wydarzeń lub kategorii.
 */
export function useAutoSync(): void {
  useEffect(() => {
    if (!syncAvailable()) return;

    let busyUntil = 0;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (document.visibilityState !== 'visible') return;
      busyUntil = Number.POSITIVE_INFINITY;
      try {
        await syncAndRecord();
      } finally {
        // Zapisy samej synchronizacji też wywołują zdarzenie zmiany — dajemy
        // im chwilę, żeby nie wywołały kolejnej synchronizacji w kółko.
        busyUntil = Date.now() + 1_000;
      }
    };

    const onMutated = (parts: Record<string, unknown>) => {
      if (Date.now() < busyUntil) return;
      const touched = Object.keys(parts).some((key) => /\/(events|categories|members)\//.test(key));
      if (!touched) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => void run(), DEBOUNCE_MS);
    };

    const onWake = () => void run();

    void run();
    const interval = setInterval(onWake, INTERVAL_MS);
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', onWake);
    Dexie.on('storagemutated', onMutated);

    return () => {
      clearInterval(interval);
      clearTimeout(debounce);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('online', onWake);
      Dexie.on('storagemutated').unsubscribe(onMutated);
    };
  }, []);
}
