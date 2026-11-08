/**
 * Model danych całej aplikacji. Wszystko trzymane lokalnie w IndexedDB —
 * nic nie wychodzi poza telefon.
 *
 * Daty zapisujemy jako tekst 'RRRR-MM-DD', a godziny jako 'GG:MM'. Dzięki temu
 * są niezależne od strefy czasowej i sortują się leksykograficznie, co upraszcza
 * zapytania do bazy.
 */

export interface Category {
  id?: number;
  name: string;
  /** Kolor w zapisie HEX, np. '#7E8E62'. */
  color: string;
  order: number;
  /**
   * Globalny identyfikator, nadawany kategorii dopiero przy współdzieleniu.
   * Lokalne `id` różni się między telefonami, `uid` jest wspólne.
   */
  uid?: string;
  /** Kategoria należy do wspólnego kalendarza i synchronizuje się z drugą osobą. */
  shared?: boolean;
}

/** Co ile powtarza się wydarzenie z serii. */
export type RepeatFreq = 'dzien' | 'tydzien' | 'dwa-tygodnie' | 'miesiac';

/** Dopuszczalne reguły powtarzania — do sprawdzania wczytywanych kopii. */
export const REPEAT_FREQS: RepeatFreq[] = ['dzien', 'tydzien', 'dwa-tygodnie', 'miesiac'];

export interface Repeat {
  freq: RepeatFreq;
  /** Ile razy wydarzenie ma się pojawić, licząc z pierwszym terminem. */
  count: number;
}

/** Górna granica jednej serii — dość na rok co tydzień, a baza nie puchnie. */
export const MAX_REPEAT_COUNT = 60;

export interface EventItem {
  id?: number;
  title: string;
  /** 'RRRR-MM-DD' */
  date: string;
  allDay: boolean;
  /** 'GG:MM' — tylko gdy allDay jest false. */
  startTime?: string;
  endTime?: string;
  categoryId?: number;
  note?: string;
  /**
   * Wspólny znacznik wszystkich terminów jednej serii. Każde powtórzenie jest
   * osobnym wpisem — dzięki temu pojedynczy termin da się przesunąć lub
   * skasować bez ruszania reszty.
   */
  seriesId?: number;
  /** Reguła, z której seria powstała — pokazywana przy edycji. */
  repeat?: Repeat;
  createdAt: number;
  /** Globalny identyfikator wydarzenia ze wspólnej kategorii (patrz `Category.uid`). */
  uid?: string;
}

export interface Task {
  id?: number;
  title: string;
  done: boolean;
  doneAt?: number;
  /**
   * Początek zadania trwającego kilka dni, 'RRRR-MM-DD'. Puste przy zwykłym
   * zadaniu — wtedy liczy się sam termin. Nigdy nie jest późniejsze niż
   * `dueDate`; wczytywanie kopii pilnuje tego osobno.
   */
  startDate?: string;
  /** Ważne zadanie — oznaczane gwiazdką. Dwa poziomy: z gwiazdką albo bez. */
  starred: boolean;
  /**
   * Szybkie zadanie, na około 5 minut. Pokazywane z piorunkiem i zawsze na
   * górze listy. Brak pola znaczy zwykłe zadanie — starsze dane go nie mają.
   */
  quick?: boolean;
  /** 'RRRR-MM-DD' — termin, czyli ostatni dzień na wykonanie. */
  dueDate?: string;
  categoryId?: number;
  /** Ustawione dla podzadania — wskazuje zadanie nadrzędne. */
  parentId?: number;
  /**
   * Wspólny znacznik wszystkich powtórzeń jednego zadania cyklicznego.
   * Tak samo jak przy wydarzeniach: każde powtórzenie jest osobnym zadaniem,
   * więc jedno da się odhaczyć, przesunąć albo skasować bez ruszania reszty.
   */
  seriesId?: number;
  /** Reguła, z której seria powstała — pokazywana przy edycji. */
  repeat?: Repeat;
  order: number;
  createdAt: number;
}

export type HabitKind = 'tak-nie' | 'licznik';

/**
 * Sposób liczenia postępu nawyku.
 * - 'ciagly' — pasek biegnie od dnia założenia, bez oglądania się na kalendarz.
 * - 'miesiac' — pasek to jeden konkretny miesiąc, dzień po dniu; pierwszego
 *   licznik startuje od zera.
 */
export type HabitPeriod = 'ciagly' | 'miesiac';

export interface Habit {
  id?: number;
  name: string;
  kind: HabitKind;
  /** Cel dzienny. Dla nawyku tak-nie zawsze 1, dla licznika np. 8 szklanek. */
  target: number;
  /** Jednostka pokazywana przy liczniku, np. 'szklanek'. */
  unit?: string;
  /** Jak liczymy postęp — wybierane przy zakładaniu nawyku. */
  period: HabitPeriod;
  categoryId?: number;
  order: number;
  archived: boolean;
  createdAt: number;
}

export interface HabitEntry {
  id?: number;
  habitId: number;
  /** 'RRRR-MM-DD' */
  date: string;
  /** Dla tak-nie: 0 albo 1. Dla licznika: liczba wykonań danego dnia. */
  value: number;
}

/**
 * Lista do odhaczania — zakupy, spakowanie się, cokolwiek wielokrotnego użytku.
 * Notatka jest opcjonalna i służy za miejsce na to, czego nie da się odhaczyć.
 */
export interface Checklist {
  id?: number;
  name: string;
  note?: string;
  categoryId?: number;
  order: number;
  createdAt: number;
}

export interface ChecklistItem {
  id?: number;
  listId: number;
  text: string;
  done: boolean;
  order: number;
  createdAt: number;
}

export interface Note {
  id?: number;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Przynależność telefonu do wspólnego kalendarza. Jeden wiersz o id 'stan'.
 * Klucz szyfrujący zostaje wyłącznie na tym telefonie.
 */
export interface SyncState {
  id: 'stan';
  /** Identyfikator przestrzeni na serwerze — pierwsza część linku. */
  spaceId: string;
  /** Klucz szyfrujący, base64url — druga część linku. Nigdy nie idzie na serwer. */
  key: string;
  /** Numer ostatniej pobranej zmiany; następne pobranie zaczyna się za nim. */
  lastSeq: number;
  /** Kiedy ostatnio udało się zsynchronizować (ms). */
  lastSyncAt?: number;
  /** Ostatni błąd, do pokazania w ustawieniach. Pusty, gdy wszystko działa. */
  lastError?: string;
}

/**
 * Ostatnio uzgodniona z serwerem treść rekordu. Porównanie z nią mówi, co się
 * zmieniło lokalnie od poprzedniej synchronizacji — bez śledzenia każdego zapisu.
 */
export interface SyncShadow {
  uid: string;
  kind: 'kategoria' | 'wydarzenie';
  /** Treść rekordu w postaci wysyłanej na serwer (przed szyfrowaniem). */
  json: string;
}
