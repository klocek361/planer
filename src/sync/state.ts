import { db } from '../data/db';
import { buildJoinLink, deriveToken, newSpaceSecret, parseJoinLink, type SpaceSecret } from './crypto';
import { syncNow } from './engine';
import { SyncError, type SyncTransport } from './transport';

/**
 * Dołączanie do wspólnego kalendarza, wychodzenie z niego i wymiana linku.
 * Wszystko, co trzeba zapamiętać, siedzi w tabeli `syncState` (jeden wiersz).
 */

async function enter(secret: SpaceSecret): Promise<void> {
  await db.transaction('rw', db.syncState, db.syncShadow, async () => {
    await db.syncShadow.clear();
    await db.syncState.put({ id: 'stan', spaceId: secret.spaceId, key: secret.key, lastSeq: 0 });
  });
}

/** Tworzy przestrzeń dla wybranych kategorii i zwraca link do wysłania. */
export async function createSpace(
  transport: SyncTransport,
  categoryIds: number[],
  base: string,
): Promise<string> {
  const secret = newSpaceSecret();
  await transport.create(secret.spaceId, await deriveToken(secret.key));
  await db.transaction('rw', db.categories, async () => {
    for (const id of categoryIds) await db.categories.update(id, { shared: true });
  });
  await enter(secret);
  await syncNow(transport);
  return buildJoinLink(base, secret);
}

/**
 * Dołącza do przestrzeni z wklejonego linku i od razu pobiera wspólne
 * kategorie. Zły albo zamknięty link nie zostawia po sobie śladu.
 */
export async function joinSpace(transport: SyncTransport, text: string): Promise<void> {
  const secret = parseJoinLink(text);
  if (!secret) throw new SyncError('odmowa');
  await enter(secret);
  try {
    await syncNow(transport);
  } catch (err) {
    await db.transaction('rw', db.syncState, db.syncShadow, async () => {
      await db.syncState.clear();
      await db.syncShadow.clear();
    });
    throw err;
  }
}

/** Link obecnej przestrzeni — do ponownego wysłania. */
export async function currentLink(base: string): Promise<string | null> {
  const state = await db.syncState.get('stan');
  return state ? buildJoinLink(base, { spaceId: state.spaceId, key: state.key }) : null;
}

/** Przestaje synchronizować. Lokalne kopie zostają jako zwykłe kategorie. */
export async function leaveSpace(): Promise<void> {
  await db.transaction('rw', db.categories, db.syncState, db.syncShadow, async () => {
    await db.categories.toCollection().modify((category) => {
      delete category.shared;
    });
    await db.syncState.clear();
    await db.syncShadow.clear();
  });
}

/**
 * Nowy link: zakłada świeżą przestrzeń, przenosi do niej wspólne dane i zamyka
 * starą. Kto miał stary link, traci dostęp — nowy wysyłamy tylko zaufanym.
 */
export async function rotateLink(transport: SyncTransport, base: string): Promise<string> {
  const old = await db.syncState.get('stan');
  if (!old) throw new SyncError('brak-przestrzeni');

  // Najpierw dociągamy ostatnie zmiany ze starej przestrzeni, żeby nic nie zginęło.
  await syncNow(transport);

  const secret = newSpaceSecret();
  await transport.create(secret.spaceId, await deriveToken(secret.key));
  await enter(secret);
  await syncNow(transport);

  try {
    await transport.close(old.spaceId, await deriveToken(old.key));
  } catch {
    // Stara przestrzeń i tak nie ma już nikogo z nowym linkiem; brak sieci
    // przy zamykaniu nie powinien cofać całej wymiany.
  }
  return buildJoinLink(base, secret);
}

/** Włącza lub wyłącza współdzielenie kategorii. Wyłączenie usuwa ją u drugiej osoby. */
export async function setCategoryShared(id: number, shared: boolean): Promise<void> {
  if (shared) await db.categories.update(id, { shared: true });
  else {
    await db.categories
      .where('id')
      .equals(id)
      .modify((category) => {
        delete category.shared;
      });
  }
}

/**
 * Po wgraniu kopii zapasowej lokalne dane mogą być starsze niż na serwerze.
 * Zerujemy postęp: następna synchronizacja pobierze wszystko od nowa i przyjmie
 * wersję z serwera, a wyśle tylko to, czego serwer jeszcze nie zna.
 */
export async function resetSyncProgress(): Promise<void> {
  const state = await db.syncState.get('stan');
  if (!state) return;
  await db.transaction('rw', db.syncState, db.syncShadow, async () => {
    await db.syncShadow.clear();
    await db.syncState.update('stan', { lastSeq: 0 });
  });
}
