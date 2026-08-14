import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { pl } from 'date-fns/locale';

/** Tydzień zaczyna się w poniedziałek. */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

/** Zawsze sześć wierszy — dzięki temu siatka nie skacze między miesiącami. */
const GRID_WEEKS = 6;

export const KEY_FORMAT = 'yyyy-MM-dd';

/** Zamienia datę na klucz 'RRRR-MM-DD' używany w bazie. */
export function toKey(date: Date): string {
  return format(date, KEY_FORMAT);
}

export function fromKey(key: string): Date {
  return parse(key, KEY_FORMAT, new Date());
}

/** Skrót miesiąca wielkimi literami, np. 'SIE'. */
export function monthLabel(date: Date): string {
  return format(date, 'LLL', { locale: pl }).toUpperCase().replace('.', '');
}

/** Pełna data pod siatką, np. 'niedz., 6 wrz 2026'. */
export function fullDateLabel(date: Date): string {
  return format(date, 'EEE, d MMM yyyy', { locale: pl });
}

export function monthYearLabel(date: Date): string {
  return format(date, 'LLLL yyyy', { locale: pl });
}

/** Krótki termin przy zadaniu, np. '12 sie'. */
export function shortDateLabel(key: string): string {
  return format(fromKey(key), 'd MMM', { locale: pl });
}

/** Czy podany dzień już minął — do wyróżniania zaległych terminów. */
export function isPastDay(key: string): boolean {
  return key < toKey(new Date());
}

/** Klucze ostatnich `count` dni, od najstarszego do dzisiaj włącznie. */
export function lastDays(count: number, today = new Date()): string[] {
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    keys.push(toKey(day));
  }
  return keys;
}

/**
 * Dni paska nawyku. Pasek zaczyna się w dniu założenia nawyku i zapełnia się
 * w prawo, dzień po dniu — jak pasek postępu. Dopiero gdy historia przekroczy
 * szerokość paska, okno zaczyna się przesuwać, żeby kończyć się na dzisiaj.
 *
 * Dzięki temu świeżo dodany nawyk nie wygląda jak pusty rząd z jednym
 * znaczkiem doklejonym na samym końcu.
 */
export function habitStrip(createdAt: number, count: number, today = new Date()): string[] {
  const created = new Date(createdAt);
  // Zabezpieczenie przed datą założenia z przyszłości (np. po zmianie zegara).
  const startCandidate = created > today ? today : created;
  const elapsed = differenceInCalendarDays(today, startCandidate) + 1;
  const start = elapsed >= count ? addDaysSafe(today, -(count - 1)) : startCandidate;

  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) keys.push(toKey(addDaysSafe(start, i)));
  return keys;
}

/** Dzień poprzedzający podany klucz. */
export function previousDay(key: string): string {
  const day = fromKey(key);
  day.setDate(day.getDate() - 1);
  return toKey(day);
}

/** Nagłówki kolumn: poniedziałek → niedziela. */
export const WEEKDAY_LABELS = ['P', 'W', 'Ś', 'C', 'P', 'S', 'N'] as const;

export interface GridDay {
  date: Date;
  key: string;
  dayOfMonth: number;
  /** Czy dzień należy do wyświetlanego miesiąca, czy do sąsiedniego. */
  inMonth: boolean;
  isWeekend: boolean;
  isToday: boolean;
}

/** Buduje 42 dni siatki dla podanego miesiąca. */
export function buildMonthGrid(month: Date): GridDay[] {
  const first = startOfWeek(startOfMonth(month), WEEK_OPTIONS);
  const days = eachDayOfInterval({ start: first, end: addDaysSafe(first, GRID_WEEKS * 7 - 1) });

  return days.map((date) => {
    const weekday = date.getDay();
    return {
      date,
      key: toKey(date),
      dayOfMonth: date.getDate(),
      inMonth: isSameMonth(date, month),
      isWeekend: weekday === 0 || weekday === 6,
      isToday: isToday(date),
    };
  });
}

function addDaysSafe(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Zakres kluczy obejmujący całą siatkę — do jednego zapytania o wydarzenia. */
export function monthGridRange(month: Date): { from: string; to: string } {
  const grid = buildMonthGrid(month);
  return { from: grid[0]!.key, to: grid[grid.length - 1]!.key };
}

export { addMonths, endOfMonth, startOfMonth };

/** Sortuje wydarzenia: całodniowe na górze, potem według godziny rozpoczęcia. */
export function compareEvents(
  a: { allDay: boolean; startTime?: string },
  b: { allDay: boolean; startTime?: string },
): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return (a.startTime ?? '').localeCompare(b.startTime ?? '');
}
