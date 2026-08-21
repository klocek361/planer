import { addMonths, fromKey, toKey } from '../lib/dates';
import { db } from './db';
import { MAX_REPEAT_COUNT, type EventItem, type Repeat } from './types';

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
  await db.events.bulkAdd(
    seriesDates(draft.date, repeat).map((date) => ({
      ...draft,
      date,
      seriesId,
      repeat,
      createdAt,
    })),
  );
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
 * Wydarzenia z podanego zakresu dni. Klucze dat są tekstem 'RRRR-MM-DD',
 * więc porównanie zakresu działa wprost na indeksie.
 */
export function eventsBetween(from: string, to: string): Promise<EventItem[]> {
  return db.events.where('date').between(from, to, true, true).toArray();
}

/** Grupuje wydarzenia po dniu, żeby siatka nie filtrowała listy przy każdej komórce. */
export function groupByDate(events: EventItem[]): Map<string, EventItem[]> {
  const map = new Map<string, EventItem[]>();
  for (const event of events) {
    const list = map.get(event.date);
    if (list) list.push(event);
    else map.set(event.date, [event]);
  }
  return map;
}
