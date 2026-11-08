import { db } from '../data/db';
import { isUid } from '../data/validate';
import { DEFAULT_CATEGORY_COLORS } from '../theme/presets';
import {
  decryptText,
  deriveToken,
  encryptText,
  inviteMaterial,
  newInviteCode,
  newSpaceSecret,
  normalizeInviteCode,
  randomId,
} from './crypto';
import { cleanMemberName, syncSpace } from './engine';
import { SyncError, type SyncTransport } from './transport';

/**
 * Wspólne kalendarze: zakładanie, zapraszanie kodem, dołączanie, imię członka,
 * wychodzenie i odcięcie wszystkich. Każdy kalendarz ma osobny wiersz
 * w `syncState`, osobną kategorię i osobną listę członków.
 */

/** Najdłuższa nazwa wspólnego kalendarza. */
export const MAX_CALENDAR_NAME = 60;

/** Treść zaproszenia — szyfrowana kluczem wyprowadzonym z 8-cyfrowego kodu. */
interface InvitePayload {
  space: string;
  key: string;
  /** Członek, który wystawił kod. */
  by: string;
}

async function tokenFor(space: string): Promise<{ token: string; memberId: string }> {
  const state = await db.syncState.get(space);
  if (!state) throw new SyncError('brak-przestrzeni');
  return { token: await deriveToken(state.key), memberId: state.memberId };
}

/** Wszystko, co telefon wie o kalendarzu — do sprzątania po wyjściu lub nieudanym wejściu. */
async function forget(space: string): Promise<void> {
  await db.transaction('rw', [db.categories, db.members, db.syncShadow, db.syncState], async () => {
    // Kategoria zostaje jako zwykła, prywatna — razem z wydarzeniami.
    await db.categories
      .where('space')
      .equals(space)
      .modify((category) => {
        delete category.space;
      });
    await db.members.where('space').equals(space).delete();
    await db.syncShadow.where('space').equals(space).delete();
    await db.syncState.delete(space);
  });
}

/**
 * Zakłada wspólny kalendarz o podanej nazwie. Kalendarz to nowa kategoria —
 * wydarzenia dodaje się do niej jak do każdej innej. Zwraca id kalendarza.
 */
export async function createSpace(
  transport: SyncTransport,
  calendarName: string,
  myName: string,
): Promise<string> {
  const name = calendarName.trim().slice(0, MAX_CALENDAR_NAME);
  const me = cleanMemberName(myName);
  if (!name || !me) throw new SyncError('odmowa');

  const secret = newSpaceSecret();
  await transport.create(secret.spaceId, await deriveToken(secret.key));

  const memberId = randomId();
  await db.transaction('rw', [db.categories, db.members, db.syncState], async () => {
    const count = await db.categories.count();
    await db.categories.add({
      name,
      color: DEFAULT_CATEGORY_COLORS[count % DEFAULT_CATEGORY_COLORS.length]!,
      order: count,
      space: secret.spaceId,
    });
    await db.members.put({ uid: memberId, space: secret.spaceId, name: me, joinedAt: Date.now() });
    await db.syncState.put({ id: secret.spaceId, key: secret.key, lastSeq: 0, memberId });
  });
  await syncSpace(transport, secret.spaceId);
  return secret.spaceId;
}

/**
 * Wystawia nowy kod zaproszenia: 8 cyfr, jednorazowy, ważny 24 h. Poprzedni
 * kod tego kalendarza przestaje działać. Zwraca kod.
 */
export async function createInvite(transport: SyncTransport, space: string): Promise<string> {
  const state = await db.syncState.get(space);
  if (!state) throw new SyncError('brak-przestrzeni');

  const code = newInviteCode();
  const material = await inviteMaterial(code);
  const payload: InvitePayload = { space, key: state.key, by: state.memberId };
  const blob = await encryptText(material.key, JSON.stringify(payload));
  const expires = await transport.putInvite(space, await deriveToken(state.key), material.lookup, blob);
  await db.syncState.update(space, { inviteCode: code, inviteExpires: expires });
  return code;
}

/** Unieważnia aktywny kod — gdy trafił w niepowołane ręce albo nie jest już potrzebny. */
export async function revokeInvite(transport: SyncTransport, space: string): Promise<void> {
  const { token } = await tokenFor(space);
  await transport.deleteInvite(space, token);
  await db.syncState.update(space, { inviteCode: undefined, inviteExpires: undefined });
}

/**
 * Dołącza kodem do cudzego kalendarza i od razu pobiera jego zawartość.
 * Kod działa raz — serwer oddaje zaproszenie i natychmiast je kasuje.
 */
export async function joinWithCode(
  transport: SyncTransport,
  codeText: string,
  myName: string,
): Promise<string> {
  const code = normalizeInviteCode(codeText);
  const me = cleanMemberName(myName);
  if (!code || !me) throw new SyncError('zly-kod');

  const material = await inviteMaterial(code);
  const blob = await transport.takeInvite(material.lookup);
  const text = await decryptText(material.key, blob);
  let invite: InvitePayload | null = null;
  try {
    const value = JSON.parse(text ?? '') as Partial<InvitePayload>;
    if (
      typeof value.space === 'string' &&
      /^[A-Za-z0-9_-]{22}$/.test(value.space) &&
      typeof value.key === 'string' &&
      /^[A-Za-z0-9_-]{43}$/.test(value.key) &&
      isUid(value.by)
    ) {
      invite = value as InvitePayload;
    }
  } catch {
    invite = null;
  }
  if (!invite) throw new SyncError('zly-kod');

  // Już należymy do tego kalendarza — kod się zużył, ale nic nie dublujemy.
  if (await db.syncState.get(invite.space)) return invite.space;

  const memberId = randomId();
  await db.transaction('rw', db.members, db.syncState, async () => {
    await db.members.put({
      uid: memberId,
      space: invite.space,
      name: me,
      joinedAt: Date.now(),
      by: invite.by,
    });
    await db.syncState.put({ id: invite.space, key: invite.key, lastSeq: 0, memberId });
  });

  try {
    await syncSpace(transport, invite.space);
  } catch (err) {
    await forget(invite.space);
    throw err;
  }
  return invite.space;
}

/** Zmienia imię tego telefonu w jednym kalendarzu. Inni zobaczą je po synchronizacji. */
export async function setMyName(space: string, name: string): Promise<void> {
  const state = await db.syncState.get(space);
  const clean = cleanMemberName(name);
  if (!state || !clean) return;
  const existing = await db.members.get(state.memberId);
  await db.members.put({
    uid: state.memberId,
    space,
    name: clean,
    joinedAt: existing?.joinedAt ?? Date.now(),
    ...(existing?.by ? { by: existing.by } : {}),
  });
}

/**
 * Opuszcza kalendarz: znika z listy członków u innych, a u siebie zachowuje
 * kategorię i wydarzenia jako prywatne. Brak sieci nie blokuje wyjścia.
 */
export async function leaveSpace(transport: SyncTransport, space: string): Promise<void> {
  const state = await db.syncState.get(space);
  if (!state) return;
  try {
    await db.members.delete(state.memberId);
    await syncSpace(transport, space);
  } catch {
    // Nie udało się powiadomić innych — wyjście i tak ma się udać.
  }
  await forget(space);
}

/**
 * Odcina wszystkich: kalendarz dostaje nowy klucz i nowe miejsce na serwerze,
 * stare zostaje skasowane. Pozostałych trzeba zaprosić nowym kodem.
 * Zwraca nowe id kalendarza.
 */
export async function rotateKey(transport: SyncTransport, space: string): Promise<string> {
  const old = await db.syncState.get(space);
  if (!old) throw new SyncError('brak-przestrzeni');

  // Najpierw dociągamy ostatnie zmiany, żeby nic nie zginęło.
  await syncSpace(transport, space);

  const secret = newSpaceSecret();
  await transport.create(secret.spaceId, await deriveToken(secret.key));
  await db.transaction(
    'rw',
    [db.categories, db.members, db.syncShadow, db.syncState],
    async () => {
      await db.categories.where('space').equals(space).modify({ space: secret.spaceId });
      await db.members
        .where('space')
        .equals(space)
        .and((m) => m.uid !== old.memberId)
        .delete();
      await db.members.where('space').equals(space).modify({ space: secret.spaceId });
      await db.syncShadow.where('space').equals(space).delete();
      await db.syncState.delete(space);
      await db.syncState.put({
        id: secret.spaceId,
        key: secret.key,
        lastSeq: 0,
        memberId: old.memberId,
      });
    },
  );
  await syncSpace(transport, secret.spaceId);

  try {
    await transport.close(space, await deriveToken(old.key));
  } catch {
    // Stary kalendarz i tak nie ma już nikogo z kluczem; brak sieci przy
    // zamykaniu nie powinien cofać całej wymiany.
  }
  return secret.spaceId;
}

/**
 * Po wgraniu kopii zapasowej lokalne dane mogą być starsze niż na serwerze.
 * Zerujemy postęp: następna synchronizacja pobierze wszystko od nowa i przyjmie
 * wersję z serwera, a wyśle tylko to, czego serwer jeszcze nie zna.
 */
export async function resetSyncProgress(): Promise<void> {
  await db.transaction('rw', db.syncState, db.syncShadow, db.categories, async () => {
    await db.syncShadow.clear();
    await db.syncState.toCollection().modify({ lastSeq: 0 });
    // Kategoria z kopii może wskazywać kalendarz, do którego telefon już nie
    // należy — wtedy wraca jako zwykła, prywatna.
    const joined = new Set((await db.syncState.toArray()).map((s) => s.id));
    await db.categories
      .filter((c) => c.space !== undefined && !joined.has(c.space))
      .modify((category) => {
        delete category.space;
      });
  });
}
