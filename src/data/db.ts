import Dexie, { type Table } from 'dexie';
import { DEFAULT_CATEGORY_COLORS } from '../theme/presets';
import type { Category, EventItem, Habit, HabitEntry, Note, Task } from './types';

class PlanerDB extends Dexie {
  categories!: Table<Category, number>;
  events!: Table<EventItem, number>;
  tasks!: Table<Task, number>;
  habits!: Table<Habit, number>;
  habitEntries!: Table<HabitEntry, number>;
  notes!: Table<Note, number>;

  constructor() {
    super('planer-kaskowy');

    // Po przecinkach wypisane są indeksy — pola, po których wyszukujemy.
    // '++id' oznacza klucz nadawany automatycznie.
    this.version(1).stores({
      categories: '++id, order',
      events: '++id, date, categoryId',
      tasks: '++id, done, dueDate, categoryId, parentId, order',
      habits: '++id, order, archived, categoryId',
      habitEntries: '++id, habitId, date, [habitId+date]',
      notes: '++id, updatedAt',
    });

    // Uruchamiane raz, przy pierwszym otwarciu aplikacji na danym telefonie.
    this.on('populate', () => {
      void this.categories.bulkAdd(STARTER_CATEGORIES);
    });
  }
}

const STARTER_NAMES = ['Praca', 'Zdrowie', 'Dom', 'Rodzina', 'Nauka', 'Inne'];

const STARTER_CATEGORIES: Category[] = STARTER_NAMES.map((name, i) => ({
  name,
  color: DEFAULT_CATEGORY_COLORS[i % DEFAULT_CATEGORY_COLORS.length]!,
  order: i,
}));

export const db = new PlanerDB();
