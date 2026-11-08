/**
 * Umowa między silnikiem synchronizacji a serwerem. Silnik zna tylko ten
 * interfejs — prawdziwe połączenie HTTP siedzi w `platform/sync.ts`, a testy
 * podstawiają serwer w pamięci.
 *
 * Serwer widzi wyłącznie: id przestrzeni, token, `uid` rekordów i zaszyfrowane
 * bloki. Numer `seq` nadaje serwer — rośnie z każdym zapisem w przestrzeni.
 */

export interface RemoteRecord {
  uid: string;
  seq: number;
  blob: string;
}

export interface PullResult {
  records: RemoteRecord[];
  /** Najwyższy numer zmiany w odpowiedzi — od niego zaczyna się następne pobranie. */
  seq: number;
  /** Serwer ma jeszcze więcej zmian — trzeba dopytać. */
  more: boolean;
}

export interface SyncTransport {
  create(spaceId: string, token: string): Promise<void>;
  push(spaceId: string, token: string, records: { uid: string; blob: string }[]): Promise<void>;
  pull(spaceId: string, token: string, since: number): Promise<PullResult>;
  /** Zamyka przestrzeń: kasuje dane na serwerze, stary klucz przestaje działać. */
  close(spaceId: string, token: string): Promise<void>;
  /**
   * Wystawia zaproszenie (jednorazowe, 24 h). Poprzednie zaproszenie tej
   * przestrzeni przestaje działać. Zwraca, do kiedy nowe jest ważne (ms).
   */
  putInvite(spaceId: string, token: string, lookup: string, blob: string): Promise<number>;
  /** Unieważnia aktywne zaproszenie przestrzeni. */
  deleteInvite(spaceId: string, token: string): Promise<void>;
  /** Odbiera zaproszenie — serwer oddaje je raz i od razu kasuje. */
  takeInvite(lookup: string): Promise<string>;
}

export type SyncErrorCode =
  | 'brak-przestrzeni'
  | 'odmowa'
  | 'zly-kod'
  | 'limit'
  | 'siec'
  | 'serwer';

export class SyncError extends Error {
  constructor(public readonly code: SyncErrorCode) {
    super(code);
  }
}

/** Ile rekordów wysyłamy jednym zapytaniem. */
export const PUSH_BATCH = 100;
