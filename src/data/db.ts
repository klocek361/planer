import Dexie, { type Table } from 'dexie';
import { DEFAULT_CATEGORY_COLORS } from '../theme/presets';
import type {
  Category,
  Checklist,
  ChecklistItem,
  EventItem,
  Habit,
  HabitEntry,
  Member,
  Note,
  SyncShadow,
  SyncState,
  Task,
} from './types';

export class PlanerDB extends Dexie {
  categories!: Table<Category, number>;
  events!: Table<EventItem, number>;
  tasks!: Table<Task, number>;
  habits!: Table<Habit, number>;
  habitEntries!: Table<HabitEntry, number>;
  notes!: Table<Note, number>;
  lists!: Table<Checklist, number>;
  listItems!: Table<ChecklistItem, number>;
  syncState!: Table<SyncState, string>;
  syncShadow!: Table<SyncShadow, string>;
  members!: Table<Member, string>;

  /** Nazwa bazy do podmiany tylko w testach przejścia między wersjami. */
  constructor(name = 'planer-kaskowy') {
    super(name);

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

    // Wersja 6: wspólny kalendarz. Kategorie i wydarzenia dostają indeks
    // globalnego `uid`, a dwie nowe tabele trzymają stan synchronizacji:
    // `syncState` — przynależność do wspólnej przestrzeni (jeden wiersz),
    // `syncShadow` — ostatnio uzgodniona z serwerem treść każdego rekordu.
    this.version(6).stores({
      categories: '++id, order, uid',
      events: '++id, date, categoryId, seriesId, uid',
      syncState: '&id',
      syncShadow: '&uid',
    });

    // Wersja 7: kilka wspólnych kalendarzy i lista członków. Kategoria
    // wskazuje swój kalendarz polem `space` zamiast flagi `shared`, stan
    // synchronizacji ma wiersz na każdy kalendarz, a cienie znają swój kalendarz.
    this.version(7)
      .stores({
        categories: '++id, order, uid, space',
        syncShadow: '&uid, space',
        members: '&uid, space',
      })
      .upgrade(async (tx) => {
        const states = tx.table('syncState');
        const old = (await states.get('stan')) as
          | { spaceId: string; key: string; lastSeq: number; lastSyncAt?: number }
          | undefined;
        if (old) {
          await states.delete('stan');
          await states.put({
            id: old.spaceId,
            key: old.key,
            lastSeq: old.lastSeq,
            lastSyncAt: old.lastSyncAt,
            memberId: randomMemberId(),
          });
        }
        await tx
          .table('categories')
          .toCollection()
          .modify((category: Record<string, unknown>) => {
            if (category.shared && old) category.space = old.spaceId;
            delete category.shared;
          });
        await tx
          .table('syncShadow')
          .toCollection()
          .modify((shadow: Record<string, unknown>) => {
            if (old) shadow.space = old.spaceId;
          });
      });

    // Wersja 8: wspólna kategoria obejmuje wszystko — zadania, nawyki
    // z odhaczeniami i listy z pozycjami dostają globalny `uid`. Listy dostają
    // też indeks kategorii, żeby dało się szybko znaleźć te wspólne.
    this.version(8).stores({
      tasks: '++id, done, dueDate, categoryId, parentId, order, seriesId, uid',
      habits: '++id, order, archived, categoryId, uid',
      lists: '++id, order, categoryId, uid',
      listItems: '++id, listId, [listId+done], order, uid',
    });

    // Uruchamiane raz, przy pierwszym otwarciu aplikacji na danym telefonie.
    this.on('populate', () => {
      void this.categories.bulkAdd(STARTER_CATEGORIES);
    });
  }
}

/** Losowy identyfikator członka — ten sam zapis co `randomId` z `sync/crypto`. */
function randomMemberId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const STARTER_NAMES = ['Praca', 'Zdrowie', 'Dom', 'Rodzina', 'Nauka', 'Inne'];

const STARTER_CATEGORIES: Category[] = STARTER_NAMES.map((name, i) => ({
  name,
  color: DEFAULT_CATEGORY_COLORS[i % DEFAULT_CATEGORY_COLORS.length]!,
  order: i,
}));

export const db = new PlanerDB();
