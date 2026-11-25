import { addMonths, daysApart, fromKey, shiftKey, toKey } from '../lib/dates';
import { db } from './db';
import { MAX_EVENT_DAYS, MAX_REPEAT_COUNT, type EventItem, type Repeat } from './types';

export type EventDraft = Omit<EventItem, 'id' | 'createdAt' | 'seriesId'>;

/**
 * Kolejne terminy serii, licząc od pierwszego. Przy powtarzaniu co miesiąc
 * date-fns cofa dzień do końca miesiąca, więc seria z 31 stycznia trafia
 * na 28 lutego zamiast wyskakiwać na marzec.
 */
export function seriesDates(startKey: string, repeat: Repeat): string[] {
  const count = Math.min(MAX_REPEAT_COUNT, Math.max(1, Math.round(repeat.count)));
  const start = fromKey(startKey);
  const keys: string[] = [];

  for (let i = 0; i < count; i += 1) {
    if (repeat.freq === 'miesiac') {
      keys.push(toKey(addMonths(start, i)));
      continue;
    }
    const step = repeat.freq === 'dzien' ? 1 : repeat.freq === 'tydzien' ? 7 : 14;
    const day = new Date(start);
    day.setDate(day.getDate() + i * step);
    keys.push(toKey(day));
  }
  return keys;
}

/**
 * Dodaje wydarzenie, a przy podanej regule — całą serię naraz.
 * Każdy termin jest osobnym wpisem spiętym wspólnym seriesId.
 */
export async function addEvent(draft: EventDraft, repeat?: Repeat): Promise<void> {
  const createdAt = Date.now();

  if (!repeat || repeat.count < 2) {
    await db.events.add({ ...draft, createdAt });
    return;
  }

  const seriesId = createdAt;
  // Wydarzenie wielodniowe w serii: każde powtórzenie trwa tyle samo dni.
  const span = draft.endDate ? daysApart(draft.date, draft.endDate) : 0;
  await db.events.bulkAdd(
    seriesDates(draft.date, repeat).map((date) => ({
      ...draft,
      date,
      ...(span > 0 ? { endDate: shiftKey(date, span) } : {}),
      seriesId,
      repeat,
      createdAt,
    })),
  );
}

/**
 * Kopia wydarzenia na inny dzień — z tytułem, godzinami, kategorią
 * i notatką, ale jako osobne wydarzenie: bez serii i bez globalnego `uid`
 * (we wspólnym kalendarzu dostanie własny). Wielodniowe zachowuje długość.
 */
export async function copyEvent(event: EventItem, date: string): Promise<number> {
  const span = event.endDate ? daysApart(event.date, event.endDate) : 0;
  const { id: _id, uid: _uid, seriesId: _series, repeat: _repeat, endDate: _end, createdAt: _at, ...rest } = event;
  return db.events.add({
    ...rest,
    date,
    ...(span > 0 ? { endDate: shiftKey(date, span) } : {}),
    createdAt: Date.now(),
  });
}

/** Ostatni dzień wydarzenia — przy jednodniowym to samo, co `date`. */
export const eventLastDay = (event: EventItem): string => event.endDate ?? event.date;

/** Czy wydarzenie trwa w podanym dniu. */
export const eventCoversDay = (event: EventItem, key: string): boolean =>
  event.date <= key && key <= eventLastDay(event);

/**
 * Dni z podanego zakresu, w które trwa wydarzenie. Wielodniowe — każdy dzień
 * przycięty do zakresu; bez zakresu — wszystkie dni wydarzenia.
 */
export function eventDays(event: EventItem, from?: string, to?: string): string[] {
  const last = eventLastDay(event);
  const first = from !== undefined && event.date < from ? from : event.date;
  const end = to !== undefined && last > to ? to : last;
  const days: string[] = [];
  for (let key = first; key <= end && days.length < MAX_EVENT_DAYS; key = shiftKey(key, 1)) days.push(key);
  return days;
}

/** Zmiana obejmująca wszystkie terminy serii — poza samą datą. */
export async function updateSeries(
  seriesId: number,
  changes: Partial<Omit<EventItem, 'date' | 'id' | 'seriesId'>>,
): Promise<void> {
  await db.events.where('seriesId').equals(seriesId).modify(changes);
}

export async function deleteSeries(seriesId: number): Promise<void> {
  await db.events.where('seriesId').equals(seriesId).delete();
}

export async function updateEvent(id: number, changes: Partial<EventItem>): Promise<void> {
  await db.events.update(id, changes);
}

export async function deleteEvent(id: number): Promise<void> {
  await db.events.delete(id);
}

/**
 * Wydarzenia, które trwają choćby jeden dzień z podanego zakresu. Klucze dat
 * są tekstem 'RRRR-MM-DD', więc porównanie działa wprost na indeksie.
 * Wielodniowe mogło zacząć się przed zakresem, więc indeks przeglądamy od
 * `MAX_EVENT_DAYS` dni wcześniej, a resztę rozstrzyga koniec wydarzenia.
 */
export async function eventsBetween(from: string, to: string): Promise<EventItem[]> {
  const earliest = shiftKey(from, -(MAX_EVENT_DAYS - 1));
  const found = await db.events.where('date').between(earliest, to, true, true).toArray();
  return found.filter((event) => eventLastDay(event) >= from);
}

/**
 * Grupuje wydarzenia po dniu, żeby siatka nie filtrowała listy przy każdej
 * komórce. Wielodniowe trafia do każdego swojego dnia (w podanym zakresie).
 */
export function groupByDate(events: EventItem[], from?: string, to?: string): Map<string, EventItem[]> {
  const map = new Map<string, EventItem[]>();
  for (const event of events) {
    for (const key of eventDays(event, from, to)) {
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
  }
  return map;
}
