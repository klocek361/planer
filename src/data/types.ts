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
}

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
  createdAt: number;
}

export type Priority = 0 | 1 | 2;

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'Zwykłe',
  1: 'Ważne',
  2: 'Pilne',
};

export interface Task {
  id?: number;
  title: string;
  done: boolean;
  doneAt?: number;
  priority: Priority;
  /** 'RRRR-MM-DD' — termin. Celowo NIE pokazujemy zadań w kalendarzu. */
  dueDate?: string;
  categoryId?: number;
  /** Ustawione dla podzadania — wskazuje zadanie nadrzędne. */
  parentId?: number;
  order: number;
  createdAt: number;
}

export type HabitKind = 'tak-nie' | 'licznik';

export interface Habit {
  id?: number;
  name: string;
  kind: HabitKind;
  /** Cel dzienny. Dla nawyku tak-nie zawsze 1, dla licznika np. 8 szklanek. */
  target: number;
  /** Jednostka pokazywana przy liczniku, np. 'szklanek'. */
  unit?: string;
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

export interface Note {
  id?: number;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}
