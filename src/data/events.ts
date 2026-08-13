import { db } from './db';
import type { EventItem } from './types';

export type EventDraft = Omit<EventItem, 'id' | 'createdAt'>;

export async function addEvent(draft: EventDraft): Promise<void> {
  await db.events.add({ ...draft, createdAt: Date.now() });
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
