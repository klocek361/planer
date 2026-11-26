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

export interface ChatRecord {
  seq: number;
  uid: string;
  blob: string;
  /** Czas zapisu na serwerze (ms). */
  created: number;
}

export interface ChatPullResult {
  messages: ChatRecord[];
  seq: number;
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
  /** Czat: dopisuje zaszyfrowaną wiadomość, zwraca jej numer i czas zapisu. */
  chatPush(spaceId: string, token: string, uid: string, blob: string): Promise<{ seq: number; created: number }>;
  /** Czat: wiadomości o numerze większym niż `since`. */
  chatPull(spaceId: string, token: string, since: number): Promise<ChatPullResult>;
  /** Czat: zaszyfrowane zdjęcie (iv ‖ szyfrogram w base64) → jego id. */
  chatSealedPhotoPut(spaceId: string, token: string, szyfr: string): Promise<string>;
  /** Czat: zaszyfrowane zdjęcie → base64. */
  chatSealedPhotoGet(spaceId: string, token: string, id: string): Promise<string>;
  /** Czat: zdjęcie sprzed 1.16.0 (nieszyfrowane) → { typ, dane } (base64). */
  chatPhotoGet(spaceId: string, token: string, id: string): Promise<{ typ: string; dane: string }>;
}

export type SyncErrorCode =
  | 'brak-przestrzeni'
  | 'odmowa'
  | 'zly-kod'
  | 'limit'
  | 'siec'
  | 'serwer'
  /** Czat 1:1: druga osoba nie ogłosiła jeszcze klucza (starsza wersja aplikacji). */
  | 'brak-klucza';

export class SyncError extends Error {
  constructor(public readonly code: SyncErrorCode) {
    super(code);
  }
}

/** Ile rekordów wysyłamy jednym zapytaniem. */
export const PUSH_BATCH = 100;
