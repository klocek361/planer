import Dexie, { type Table } from 'dexie';
import { DEFAULT_CATEGORY_COLORS } from '../theme/presets';
import type {
  Category,
  Checklist,
  ChecklistItem,
  EventItem,
  Habit,
  HabitEntry,
  Note,
  Task,
} from './types';

class PlanerDB extends Dexie {
  categories!: Table<Category, number>;
  events!: Table<EventItem, number>;
  tasks!: Table<Task, number>;
  habits!: Table<Habit, number>;
  habitEntries!: Table<HabitEntry, number>;
  notes!: Table<Note, number>;
  lists!: Table<Checklist, number>;
  listItems!: Table<ChecklistItem, number>;

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

    // Wersja 2: trzy poziomy ważności zadania zastąpiła gwiazdka, a wydarzenia
    // dostały znacznik serii. Migracja przenosi stare dane bez pytania —
    // "Ważne" i "Pilne" stają się gwiazdką, "Zwykłe" zostaje bez niej.
    this.version(2)
      .stores({
        events: '++id, date, categoryId, seriesId',
      })
      .upgrade(async (tx) => {
        await tx
          .table('tasks')
          .toCollection()
          .modify((task: Record<string, unknown>) => {
            const priority = typeof task.priority === 'number' ? task.priority : 0;
            task.starred = priority > 0;
            delete task.priority;
          });
      });

    // Wersja 3: nawyk dostał tryb liczenia. Wszystko, co powstało wcześniej,
    // liczyło się od dnia założenia — czyli dokładnie tryb 'ciagly'.
    this.version(3).upgrade(async (tx) => {
      await tx
        .table('habits')
        .toCollection()
        .modify((habit: Record<string, unknown>) => {
          if (habit.period !== 'miesiac') habit.period = 'ciagly';
        });
    });

    // Wersja 4: zadania dostają serie, tak jak wcześniej wydarzenia. Sam
    // indeks wystarczy — istniejące zadania po prostu nie należą do żadnej.
    this.version(4).stores({
      tasks: '++id, done, dueDate, categoryId, parentId, order, seriesId',
    });

    // Wersja 5: listy do odhaczania. Nowe tabele, więc nic nie trzeba migrować.
    this.version(5).stores({
      lists: '++id, order',
      listItems: '++id, listId, [listId+done], order',
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
