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
import type { Locale } from 'date-fns';
import type { Dict } from '../i18n/pl';
import { slavicForm } from '../i18n/plural';

/**
 * Język nazw miesięcy i dni tygodnia. Trzymany w module, a nie przekazywany
 * do każdej funkcji — dzięki temu setki wywołań `format` w komponentach
 * zostają bez zmian, a przełączenie języka jest jednym przypisaniem.
 */
let activeLocale: Locale = pl;

export function setDateLocale(locale: Locale): void {
  activeLocale = locale;
}

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
  return format(date, 'LLL', { locale: activeLocale }).toUpperCase().replace('.', '');
}

/** Pełna data pod siatką, np. 'niedz., 6 wrz 2026'. */
export function fullDateLabel(date: Date): string {
  return format(date, 'EEE, d MMM yyyy', { locale: activeLocale });
}

export function monthYearLabel(date: Date): string {
  return format(date, 'LLLL yyyy', { locale: activeLocale });
}

/** Krótki termin przy zadaniu, np. '12 sie'. */
export function shortDateLabel(key: string): string {
  return format(fromKey(key), 'd MMM', { locale: activeLocale });
}

/** Data w skrócie z kropką, np. '21.08' — używana przy terminach zadań. */
export function dotDateLabel(key: string): string {
  return format(fromKey(key), 'dd.MM');
}

export type DueTone = 'zwykly' | 'blisko' | 'zalegly';

export interface DueInfo {
  text: string;
  tone: DueTone;
  /** Ile dni dzieli dzisiaj od terminu; ujemne znaczy po terminie. */
  days: number;
}

/**
 * Podpis terminu zadania: sama data mówi mało, więc dokładamy odległość
 * w dniach. Bliskie terminy mają własne słowa, bo "za 0 dni" nikt tak nie mówi.
 */
export function dueInfo(dueKey: string, t: Dict, today = toKey(new Date())): DueInfo {
  const days = differenceInCalendarDays(fromKey(dueKey), fromKey(today));
  const date = dotDateLabel(dueKey);
  // Odmiana idzie przez regułę słowiańską także dla angielskiego i portugalskiego:
  // tam formy „few” i „many” są identyczne, więc wynik wychodzi ten sam.
  const dni = (n: number) => `${n} ${t.daty.dzien[slavicForm(n)]}`;

  if (days < 0) {
    const late = Math.abs(days);
    return { text: t.daty.poTerminie(date, dni(late)), tone: 'zalegly', days };
  }
  if (days === 0) return { text: t.wspolne.dzis.toLowerCase(), tone: 'blisko', days };
  if (days === 1) return { text: t.daty.jutro, tone: 'blisko', days };
  // Przy odległych terminach odliczanie w dniach przestaje cokolwiek wnosić.
  if (days > 30) return { text: t.daty.doDnia(date), tone: 'zwykly', days };
  return {
    text: t.daty.doDniaZa(date, dni(days)),
    tone: days <= 3 ? 'blisko' : 'zwykly',
    days,
  };
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

/**
 * Wszystkie dni jednego miesiąca kalendarzowego, od pierwszego do ostatniego.
 * Nawyk liczony miesiącami dostaje pasek dokładnie tej długości — 28, 30 albo
 * 31 pól, zależnie od miesiąca, zamiast sztywnego okna czterech tygodni.
 */
export function monthDays(month: Date): string[] {
  return eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }).map(toKey);
}

/** Sama nazwa miesiąca z rokiem, np. 'sierpień 2026' — nagłówek paska nawyku. */
export function monthNameLabel(month: Date): string {
  return format(month, 'LLLL yyyy', { locale: activeLocale });
}

/**
 * Numery dni do podpisania pod paskiem miesiąca. Trzydziestu jeden liczb nie da
 * się przeczytać na telefonie, więc zostają co piąta i zawsze ostatni dzień —
 * tyle wystarczy, żeby trafić wzrokiem w konkretną datę.
 */
export function monthScale(keys: string[]): number[] {
  const last = keys.length;
  const marks: number[] = [];
  for (let day = 1; day <= last; day += 5) marks.push(day);
  // Ostatni dzień zawsze podpisany, ale bez zlepiania się z poprzednim numerem.
  if (marks[marks.length - 1] !== last) {
    if (last - (marks[marks.length - 1] ?? 0) < 3) marks.pop();
    marks.push(last);
  }
  return marks;
}

/** Kolejne dni licząc od podanego, jako klucze. */
export function daysFrom(start: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) keys.push(toKey(addDaysSafe(start, i)));
  return keys;
}

/** Siedem dni tygodnia, w którym leży podany dzień — od poniedziałku. */
export function weekDays(base = new Date()): string[] {
  return daysFrom(startOfWeek(base, WEEK_OPTIONS), 7);
}

/** Zakres tygodnia w podpisie, np. '17–23 sie'. */
export function weekRangeLabel(keys: string[]): string {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) return '';
  const from = fromKey(first);
  const to = fromKey(last);
  const sameMonth = from.getMonth() === to.getMonth();
  const left = sameMonth ? format(from, 'd') : format(from, 'd MMM', { locale: activeLocale });
  return `${left}–${format(to, 'd MMM', { locale: activeLocale })}`;
}

/** Skrót dnia tygodnia bez kropki, np. 'pon'. */
export function weekdayShort(key: string): string {
  return format(fromKey(key), 'EEE', { locale: activeLocale }).replace('.', '');
}

/** Dzień miesiąca jako liczba, do kafelków z datami. */
export function dayOfMonth(key: string): number {
  return fromKey(key).getDate();
}

/** Podpis dnia w nagłówku sekcji, np. 'wtorek, 18 sie'. */
export function dayHeadingLabel(key: string): string {
  return format(fromKey(key), 'EEEE, d MMM', { locale: activeLocale });
}

/** Dzień poprzedzający podany klucz. */
export function previousDay(key: string): string {
  const day = fromKey(key);
  day.setDate(day.getDate() - 1);
  return toKey(day);
}

/**
 * Nagłówki kolumn siatki: poniedziałek → niedziela, jedną literą.
 *
 * Liczone z bieżącego języka, a nie wpisane na sztywno — po angielsku muszą
 * wyjść M T W T F S S, a po serbsku П У С Ч П С Н. Za punkt odniesienia służy
 * dowolny poniedziałek; date-fns podaje formę „najwęższą”, my ją tylko
 * podnosimy do wielkiej litery.
 */
const PONIEDZIALEK_ODNIESIENIA = new Date(2026, 0, 5);

export function weekdayInitials(): string[] {
  return daysFrom(PONIEDZIALEK_ODNIESIENIA, 7).map((key) =>
    format(fromKey(key), 'EEEEE', { locale: activeLocale }).toUpperCase(),
  );
}

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
