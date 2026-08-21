/**
 * Sprawdza warstwę danych na udawanej bazie IndexedDB w Node.
 * Uruchamiane przez `npm run check`. Wyłapuje rzeczy niewidoczne na zrzucie
 * ekranu — brakujące indeksy, błędy w transakcjach, gubione powiązania.
 */
import 'fake-indexeddb/auto';
import { db } from '../src/data/db';
import {
  backupFilename,
  buildBackup,
  parseBackup,
  restoreBackup,
  summarize,
} from '../src/data/backup';
import { READABLE_CONTRAST, contrastRatio, isDarkColor } from '../src/theme/color';
import { DEFAULT_THEME, PRESETS } from '../src/theme/presets';
import {
  addCategory,
  deleteCategory,
  moveCategory,
  updateCategory,
} from '../src/data/categories';
import { eventsBetween, groupByDate } from '../src/data/events';
import { addTask, buildTaskTree, deleteTask, toggleTask } from '../src/data/tasks';
import {
  addHabit,
  completedCount,
  currentStreak,
  deleteHabit,
  habitWindow,
  isDayComplete,
  setHabitValue,
} from '../src/data/habits';
import {
  buildMonthGrid,
  compareEvents,
  dueInfo,
  fullDateLabel,
  habitStrip,
  lastDays,
  monthDays,
  monthGridRange,
  monthLabel,
  monthScale,
} from '../src/lib/dates';
import { seriesDates } from '../src/data/events';
import {
  coversDay,
  deleteTaskSeries,
  groupByCategory,
  groupByDay,
  taskDays,
  taskSeriesDates,
  updateTaskSeries,
} from '../src/data/tasks';
import { rangeInfo } from '../src/lib/dates';
import { validTask } from '../src/data/validate';
import { DEFAULT_TAB_ORDER, normalizeLayout, visibleTabs } from '../src/app/tabs';
import { pl as slownikPl } from '../src/i18n/pl';
import { srLatn } from '../src/i18n/srLatn';
import { srCyrl } from '../src/i18n/srCyrl';
import { en as slownikEn } from '../src/i18n/en';
import { pt as slownikPt } from '../src/i18n/pt';
import { slavicForm } from '../src/i18n/plural';
import { setDateLocale, weekdayInitials } from '../src/lib/dates';
import { enGB, pl as plDate, pt as ptDate, sr as srDate } from 'date-fns/locale';
import type { Habit } from '../src/data/types';

const problems: string[] = [];
function check(label: string, condition: boolean) {
  console.log(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) problems.push(label);
}

await db.open();

// 1. Zasiew przy pierwszym uruchomieniu
const seeded = await db.categories.orderBy('order').toArray();
check(`zasiew tworzy 6 kategorii (jest ${seeded.length})`, seeded.length === 6);
check(
  'kategorie mają kolejność 0..5',
  seeded.every((c, i) => c.order === i),
);
check(
  'każda kategoria ma kolor HEX',
  seeded.every((c) => /^#[0-9A-F]{6}$/i.test(c.color)),
);

// 2. Dodawanie
await addCategory('  Testowa  ', '#123456');
const added = await db.categories.orderBy('order').last();
check('nowa kategoria trafia na koniec listy', added?.order === 6);
check('nazwa jest przycinana ze spacji', added?.name === 'Testowa');

// 3. Edycja
await updateCategory(added!.id!, { name: 'Zmieniona', color: '#ABCDEF' });
const edited = await db.categories.get(added!.id!);
check('edycja zmienia nazwę i kolor', edited?.name === 'Zmieniona' && edited?.color === '#ABCDEF');

// 4. Przestawianie kolejności
const before = await db.categories.orderBy('order').toArray();
await moveCategory(before[0]!.id!, 1);
const after = await db.categories.orderBy('order').toArray();
check(
  'przesunięcie w dół zamienia dwie pierwsze pozycje',
  after[0]!.id === before[1]!.id && after[1]!.id === before[0]!.id,
);

// Po zamianie pierwotnie pierwsza kategoria stoi na pozycji 1 — to ją cofamy.
await moveCategory(after[1]!.id!, -1);
const restored = await db.categories.orderBy('order').toArray();
check(
  'przesunięcie w górę cofa zmianę',
  restored.map((c) => c.id).join() === before.map((c) => c.id).join(),
);

const first = restored[0]!;
await moveCategory(first.id!, -1);
const unchanged = await db.categories.orderBy('order').toArray();
check(
  'przesunięcie poza początek listy nic nie psuje',
  unchanged.map((c) => c.id).join() === restored.map((c) => c.id).join(),
);

// 5. Usuwanie odpina kategorię od wydarzeń, zadań i nawyków
const victim = restored[2]!;
const eventId = await db.events.add({
  title: 'Dentysta',
  date: '2026-08-20',
  allDay: false,
  startTime: '10:00',
  endTime: '11:00',
  categoryId: victim.id,
  createdAt: Date.now(),
});
const taskId = await db.tasks.add({
  title: 'Kupić prezent',
  done: false,
  starred: true,
  categoryId: victim.id,
  order: 0,
  createdAt: Date.now(),
});
const habitId = await db.habits.add({
  name: 'Woda',
  kind: 'licznik',
  target: 8,
  unit: 'szklanek',
  period: 'ciagly',
  categoryId: victim.id,
  order: 0,
  archived: false,
  createdAt: Date.now(),
});

await deleteCategory(victim.id!);

check('usunięta kategoria znika z bazy', (await db.categories.get(victim.id!)) === undefined);
check('wydarzenie przeżywa usunięcie kategorii', (await db.events.get(eventId)) !== undefined);
check('wydarzenie traci przypisanie do kategorii', !(await db.events.get(eventId))?.categoryId);
check('zadanie traci przypisanie do kategorii', !(await db.tasks.get(taskId))?.categoryId);
check('nawyk traci przypisanie do kategorii', !(await db.habits.get(habitId))?.categoryId);

// 6. Złożony indeks nawyków — jeden wpis na nawyk i dzień
await db.habitEntries.bulkAdd([
  { habitId: 1, date: '2026-08-10', value: 1 },
  { habitId: 1, date: '2026-08-11', value: 3 },
  { habitId: 2, date: '2026-08-10', value: 1 },
]);
const found = await db.habitEntries.where('[habitId+date]').equals([1, '2026-08-11']).first();
check('wyszukiwanie wpisu nawyku po dniu działa', found?.value === 3);

// 7. Siatka miesiąca — punktem odniesienia jest sierpień 2026 ze zdjęcia,
//    gdzie widok zaczyna się 27 lipca, a kończy 6 września.
const sierpien = new Date(2026, 7, 1);
const grid = buildMonthGrid(sierpien);
check(`siatka ma 42 dni (jest ${grid.length})`, grid.length === 42);
check('siatka zaczyna się w poniedziałek 27 lipca', grid[0]!.key === '2026-07-27');
check('siatka kończy się w niedzielę 6 września', grid[41]!.key === '2026-09-06');
check(
  'sierpień ma 31 dni oznaczonych jako bieżący miesiąc',
  grid.filter((d) => d.inMonth).length === 31,
);
check('27 lipca jest oznaczony jako spoza miesiąca', grid[0]!.inMonth === false);
check(
  'weekendy wypadają na dwóch ostatnich kolumnach',
  grid.every((d, i) => d.isWeekend === (i % 7 >= 5)),
);
check("skrót miesiąca to 'SIE'", monthLabel(sierpien) === 'SIE');
check(
  "pełna data to 'niedz., 6 wrz 2026'",
  fullDateLabel(grid[41]!.date) === 'niedz., 6 wrz 2026',
);

const zakres = monthGridRange(sierpien);
check(
  'zakres zapytania pokrywa całą siatkę',
  zakres.from === '2026-07-27' && zakres.to === '2026-09-06',
);

// 8. Pobieranie wydarzeń po zakresie dat
await db.events.clear();
await db.events.bulkAdd([
  { title: 'Przed zakresem', date: '2026-07-26', allDay: true, createdAt: 1 },
  { title: 'Pierwszy dzień siatki', date: '2026-07-27', allDay: true, createdAt: 2 },
  { title: 'Środek miesiąca', date: '2026-08-12', allDay: true, createdAt: 3 },
  { title: 'Ostatni dzień siatki', date: '2026-09-06', allDay: true, createdAt: 4 },
  { title: 'Po zakresie', date: '2026-09-07', allDay: true, createdAt: 5 },
]);
const wZakresie = await eventsBetween(zakres.from, zakres.to);
check(`zakres zwraca 3 wydarzenia (jest ${wZakresie.length})`, wZakresie.length === 3);
check(
  'krańce zakresu są włączone, sąsiedztwo pominięte',
  !wZakresie.some((e) => e.title === 'Przed zakresem' || e.title === 'Po zakresie'),
);

// 9. Grupowanie i kolejność w obrębie dnia
await db.events.clear();
await db.events.bulkAdd([
  { title: 'Popołudniowe', date: '2026-08-12', allDay: false, startTime: '15:30', createdAt: 1 },
  { title: 'Całodniowe', date: '2026-08-12', allDay: true, createdAt: 2 },
  { title: 'Poranne', date: '2026-08-12', allDay: false, startTime: '08:00', createdAt: 3 },
  { title: 'Inny dzień', date: '2026-08-13', allDay: true, createdAt: 4 },
]);
const pogrupowane = groupByDate(await eventsBetween('2026-08-01', '2026-08-31'));
check('grupowanie rozdziela dni', pogrupowane.get('2026-08-12')?.length === 3);
const posortowane = pogrupowane
  .get('2026-08-12')!
  .slice()
  .sort(compareEvents)
  .map((e) => e.title);
check(
  'całodniowe idzie pierwsze, potem rosnąco po godzinie',
  posortowane.join() === 'Całodniowe,Poranne,Popołudniowe',
);

// 10. Zadania: kolejność, drzewo, kaskady
await db.tasks.clear();
await addTask({ title: '  Bez terminu  ', starred: true });
await addTask({ title: 'Za tydzień', starred: false, dueDate: '2026-08-20' });
await addTask({ title: 'Jutro zwykłe', starred: false, dueDate: '2026-08-14' });
await addTask({ title: 'Jutro ważne', starred: true, dueDate: '2026-08-14' });

const wszystkie = await db.tasks.toArray();
check('nazwa zadania jest przycinana', wszystkie.some((t) => t.title === 'Bez terminu'));
check('nowe zadania są niezrobione', wszystkie.every((t) => t.done === false));

const kolejnosc = buildTaskTree(wszystkie).map((n) => n.task.title);
check(
  'termin decyduje przed gwiazdką, brak terminu na końcu',
  kolejnosc.join() === 'Jutro ważne,Jutro zwykłe,Za tydzień,Bez terminu',
);

// Podzadania trzymają się rodzica niezależnie od własnego terminu
const rodzic = wszystkie.find((t) => t.title === 'Za tydzień')!;
await addTask({ title: 'Podzadanie B', starred: false, parentId: rodzic.id, dueDate: '2026-08-19' });
await addTask({ title: 'Podzadanie A', starred: false, parentId: rodzic.id, dueDate: '2026-08-18' });

const drzewo = buildTaskTree(await db.tasks.toArray());
check('podzadania nie trafiają na główną listę', drzewo.length === 4);
const galaz = drzewo.find((n) => n.task.title === 'Za tydzień')!;
check('podzadania wiszą pod rodzicem', galaz.subtasks.length === 2);
check(
  'podzadania też są posortowane po terminie',
  galaz.subtasks.map((t) => t.title).join() === 'Podzadanie A,Podzadanie B',
);

// Odhaczenie rodzica domyka podzadania
await toggleTask(rodzic.id!, true);
const poOdhaczeniu = await db.tasks.where('parentId').equals(rodzic.id!).toArray();
check('odhaczenie rodzica domyka podzadania', poOdhaczeniu.every((t) => t.done));
check('odhaczone zadanie ma znacznik czasu', (await db.tasks.get(rodzic.id!))?.doneAt !== undefined);

// Odznaczenie rodzica nie odwraca podzadań
await toggleTask(rodzic.id!, false);
const poOdznaczeniu = await db.tasks.where('parentId').equals(rodzic.id!).toArray();
check('odznaczenie rodzica nie otwiera podzadań', poOdznaczeniu.every((t) => t.done));

// Zrobione lądują za niezrobionymi
const zMieszanymi = buildTaskTree(await db.tasks.toArray()).map((n) => n.task.done);
check('niezrobione idą przed zrobionymi', zMieszanymi.filter(Boolean).length === 0);

// Usunięcie rodzica kasuje podzadania
await deleteTask(rodzic.id!);
check('usunięcie rodzica kasuje podzadania', (await db.tasks.where('parentId').equals(rodzic.id!).count()) === 0);
check('usunięty rodzic znika', (await db.tasks.get(rodzic.id!)) === undefined);
check('pozostałe zadania nietknięte', (await db.tasks.count()) === 3);

// 11. Nawyki: cele, wpisy, serie
await db.habits.clear();
await db.habitEntries.clear();

await addHabit({ name: '  Medytacja  ', kind: 'tak-nie', target: 99, period: 'ciagly' });
await addHabit({ name: 'Woda', kind: 'licznik', target: 8, unit: 'szklanek', period: 'miesiac' });

const nawyki = await db.habits.toArray();
const medytacja = nawyki.find((h) => h.name === 'Medytacja')!;
const woda = nawyki.find((h) => h.name === 'Woda')!;
check('nazwa nawyku jest przycinana', medytacja !== undefined);
check('nawyk tak-nie ma cel wymuszony na 1', medytacja.target === 1);
check('licznik zachowuje własny cel', woda.target === 8);

// Wpisy: dodanie, aktualizacja, kasowanie przy zerze
await setHabitValue(woda.id!, '2026-08-13', 3);
check('wpis się zapisuje', (await db.habitEntries.where('habitId').equals(woda.id!).count()) === 1);
await setHabitValue(woda.id!, '2026-08-13', 5);
const poAktualizacji = await db.habitEntries.where('[habitId+date]').equals([woda.id!, '2026-08-13']).first();
check('powtórny zapis nadpisuje, nie duplikuje', poAktualizacji?.value === 5);
await setHabitValue(woda.id!, '2026-08-13', 0);
check('wyzerowanie kasuje wpis', (await db.habitEntries.where('habitId').equals(woda.id!).count()) === 0);
await setHabitValue(woda.id!, '2026-08-13', -4);
check('ujemna wartość nie tworzy wpisu', (await db.habitEntries.where('habitId').equals(woda.id!).count()) === 0);

// Licznik zatrzymuje się na celu — przy szybkim stukaniu w plus łatwo
// przeskoczyć poza limit, a 9/8 nie znaczy nic więcej niż 8/8.
await setHabitValue(woda.id!, '2026-08-14', 99);
const przyLimicie = await db.habitEntries
  .where('[habitId+date]')
  .equals([woda.id!, '2026-08-14'])
  .first();
check('licznik nie przekracza celu', przyLimicie?.value === 8);

await setHabitValue(medytacja.id!, '2026-08-14', 5);
const takNiePrzyLimicie = await db.habitEntries
  .where('[habitId+date]')
  .equals([medytacja.id!, '2026-08-14'])
  .first();
check('nawyk tak-nie nie da się odhaczyć więcej niż raz', takNiePrzyLimicie?.value === 1);

await setHabitValue(-1, '2026-08-14', 3);
check(
  'wpis dla nieistniejącego nawyku nie powstaje',
  (await db.habitEntries.where('habitId').equals(-1).count()) === 0,
);

// Serie liczone względem ustalonego „dzisiaj”
const dzis = '2026-08-13';
const seria = new Map<string, number>([
  ['2026-08-13', 1],
  ['2026-08-12', 1],
  ['2026-08-11', 1],
  ['2026-08-09', 1], // przerwa 10 sierpnia
]);
check('seria liczy dni pod rząd', currentStreak(medytacja, seria, dzis) === 3);

const bezDzisiaj = new Map(seria);
bezDzisiaj.delete('2026-08-13');
check(
  'nieodhaczone dzisiaj nie zrywa serii z wczoraj',
  currentStreak(medytacja, bezDzisiaj, dzis) === 2,
);

check('brak historii to seria zerowa', currentStreak(medytacja, undefined, dzis) === 0);
check(
  'przerwa wczoraj i dzisiaj zeruje serię',
  currentStreak(medytacja, new Map([['2026-08-09', 1]]), dzis) === 0,
);

// Licznik zalicza dzień dopiero po osiągnięciu celu
const wodaDni = new Map<string, number>([
  ['2026-08-13', 8],
  ['2026-08-12', 7],
]);
check('licznik zalicza dzień przy pełnym celu', isDayComplete(woda, wodaDni.get('2026-08-13')));
check('licznik nie zalicza dnia poniżej celu', !isDayComplete(woda, wodaDni.get('2026-08-12')));
check('seria licznika kończy się na niedobitym dniu', currentStreak(woda, wodaDni, dzis) === 1);
check(
  'podliczenie okresu liczy tylko dni z celem',
  completedCount(woda, wodaDni, ['2026-08-13', '2026-08-12', '2026-08-11']) === 1,
);

// Ostatnie dni: kolejność i zakres
const ostatnie = lastDays(5, new Date(2026, 7, 13));
check('lastDays zwraca żądaną liczbę dni', ostatnie.length === 5);
check('lastDays kończy się na dzisiaj', ostatnie[4] === '2026-08-13');
check('lastDays zaczyna się od najstarszego', ostatnie[0] === '2026-08-09');

// Usunięcie nawyku kasuje historię
await setHabitValue(woda.id!, '2026-08-12', 4);
await deleteHabit(woda.id!);
check('usunięty nawyk znika', (await db.habits.get(woda.id!)) === undefined);
check(
  'historia usuniętego nawyku znika razem z nim',
  (await db.habitEntries.where('habitId').equals(woda.id!).count()) === 0,
);
check('inne nawyki zostają nietknięte', (await db.habits.count()) === 1);

// 12. Kolory: kontrast i rozpoznawanie ciemnego motywu
check('czerń na bieli daje maksymalny kontrast', Math.round(contrastRatio('#000000', '#FFFFFF')) === 21);
check('ten sam kolor daje kontrast 1', Math.round(contrastRatio('#7E8E62', '#7E8E62')) === 1);
check('kolejność argumentów nie zmienia wyniku', contrastRatio('#123456', '#EEEEEE') === contrastRatio('#EEEEEE', '#123456'));
check('skrócony zapis HEX jest rozumiany', Math.round(contrastRatio('#000', '#FFF')) === 21);
check('biel rozpoznana jako jasna', !isDarkColor('#FFFFFF'));
check('grafit rozpoznany jako ciemny', isDarkColor('#121211'));
check('ciemny granat rozpoznany jako ciemny', isDarkColor('#0E1116'));

// Każdy gotowy zestaw musi być czytelny — inaczej podsuwamy zły punkt wyjścia
for (const preset of PRESETS) {
  const ratio = contrastRatio(preset.colors.text, preset.colors.bg);
  check(
    `zestaw „${preset.name}” jest czytelny (kontrast ${ratio.toFixed(1)})`,
    ratio >= READABLE_CONTRAST,
  );
  check(
    `zestaw „${preset.name}” ma spójny tryb jasny/ciemny`,
    isDarkColor(preset.colors.bg) === (preset.mode === 'dark'),
  );
}

// 13. Kopia zapasowa: eksport, walidacja, wgranie z powrotem
await db.categories.clear();
await db.events.clear();
await db.tasks.clear();
await db.habits.clear();
await db.habitEntries.clear();

await addCategory('Rodzina', '#6E8399');
const kategoria = (await db.categories.toArray())[0]!;
await db.events.add({
  title: 'Ślub Kasi',
  date: '2026-08-29',
  allDay: true,
  categoryId: kategoria.id,
  createdAt: 1,
});
await addTask({ title: 'Kupić winietki', starred: true, dueDate: '2026-08-11' });
await addHabit({ name: 'Woda', kind: 'licznik', target: 8, period: 'ciagly' });
const nawykDoKopii = (await db.habits.toArray())[0]!;
await setHabitValue(nawykDoKopii.id!, '2026-08-13', 6);

const kopia = await buildBackup();
check('kopia ma znacznik aplikacji', kopia.aplikacja === 'planer-kaskowy');
check('kopia zawiera datę zapisu', typeof kopia.zapisano === 'string' && kopia.zapisano.length > 0);
const podsumowanie = summarize(kopia);
check(
  'kopia obejmuje wszystkie tabele',
  podsumowanie.categories === 1 &&
    podsumowanie.events === 1 &&
    podsumowanie.tasks === 1 &&
    podsumowanie.habits === 1 &&
    podsumowanie.habitEntries === 1,
);
check('kopia zawiera motyw', kopia.motyw.aktualny.colors.bg.length > 0);

const jako_tekst = JSON.stringify(kopia);
check('kopia przechodzi własną walidację', parseBackup(jako_tekst).backup.aplikacja === 'planer-kaskowy');
check('poprawna kopia nie gubi żadnego wpisu', parseBackup(jako_tekst).skipped === 0);

const odrzucone = (json: string) => {
  try {
    parseBackup(json);
    return false;
  } catch {
    return true;
  }
};
check('odrzuca tekst, który nie jest JSON-em', odrzucone('to nie jest json'));
check('odrzuca obcy plik JSON', odrzucone('{"cokolwiek":1}'));
check('odrzuca kopię z nowszej wersji', odrzucone('{"aplikacja":"planer-kaskowy","wersja":99}'));
check(
  'odrzuca kopię bez sekcji danych',
  odrzucone('{"aplikacja":"planer-kaskowy","wersja":1}'),
);
check(
  'odrzuca kopię z brakującą tabelą',
  odrzucone(
    '{"aplikacja":"planer-kaskowy","wersja":1,"dane":{"categories":[],"events":[],"tasks":[],"habits":[],"habitEntries":[]}}',
  ),
);

// Wgranie po wyczyszczeniu wszystkiego
await db.categories.clear();
await db.events.clear();
await db.tasks.clear();
await db.habits.clear();
await db.habitEntries.clear();
check('baza jest pusta przed wgraniem', (await db.events.count()) === 0);

await restoreBackup(parseBackup(jako_tekst).backup);
check('wgranie przywraca wydarzenia', (await db.events.count()) === 1);
check('wgranie przywraca zadania', (await db.tasks.count()) === 1);
check('wgranie przywraca nawyki i ich historię', (await db.habitEntries.count()) === 1);
const poWgraniu = await db.events.toArray();
check('treść wydarzenia przetrwała obieg', poWgraniu[0]?.title === 'Ślub Kasi');
check('powiązanie z kategorią przetrwało obieg', poWgraniu[0]?.categoryId === kategoria.id);

// Ponowne wgranie tej samej kopii nie duplikuje danych
await restoreBackup(parseBackup(jako_tekst).backup);
check('powtórne wgranie zastępuje, nie dokłada', (await db.events.count()) === 1);

check('nazwa pliku zawiera datę', backupFilename(new Date(2026, 7, 13)).includes('2026-08-13'));

// 14. Odporność na uszkodzony i spreparowany plik kopii
const zepsuty = JSON.stringify({
  aplikacja: 'planer-kaskowy',
  wersja: 1,
  zapisano: '2026-08-13T10:00:00.000Z',
  dane: {
    categories: [
      { id: 1, name: 'Dobra', color: '#7E8E62', order: 0 },
      { id: 2, name: 'Zły kolor', color: 'red; background-image: url(https://obcy.example/x)', order: 1 },
      { id: 3, name: '', color: '#000000', order: 2 },
      null,
      'napis zamiast obiektu',
    ],
    events: [
      { id: 1, title: 'Dobre', date: '2026-08-20', allDay: true, createdAt: 1 },
      { id: 2, title: 'Zła data', date: '20 sierpnia', allDay: true, createdAt: 2 },
      { id: 3, title: 'Zła godzina', date: '2026-08-20', allDay: false, startTime: '25:99', createdAt: 3 },
      { id: 4, date: '2026-08-20', allDay: true, createdAt: 4 },
      { id: 5, title: 'Nieistniejący dzień', date: '2026-02-30', allDay: true, createdAt: 5 },
    ],
    tasks: [
      { id: 1, title: 'Stare ważne', done: false, priority: 2, order: 0, createdAt: 1 },
      { id: 2, title: 'Stare zwykłe', done: false, priority: 0, order: 1, createdAt: 2 },
      { id: 3, title: 'Bez tytułu i reszty', done: 'nie', order: 2, createdAt: 3 },
    ],
    habits: [
      { id: 1, name: 'Dobry', kind: 'licznik', target: 8, order: 0, archived: false, createdAt: 1 },
      { id: 2, name: 'Zły rodzaj', kind: 'wymyślony', target: 1, order: 1, archived: false, createdAt: 2 },
      { id: 3, name: 'Cel zerowy', kind: 'licznik', target: 0, order: 2, archived: false, createdAt: 3 },
    ],
    habitEntries: [
      { habitId: 1, date: '2026-08-13', value: 4 },
      { habitId: 1, date: 'wczoraj', value: 1 },
      { habitId: 1, date: '2026-08-12', value: -5 },
    ],
    notes: [],
  },
  motyw: {
    aktualny: {
      id: 'podstawiony',
      name: 'x'.repeat(500),
      colors: {
        bg: 'url(https://obcy.example/wyciek.png)',
        text: '#112233',
        surface: 'javascript:alert(1)',
      },
      typography: { fontId: 'nieistniejacy', scale: 9999 },
      shape: { radius: -500, density: 'dużo' },
      texture: 'wstrzyknieta',
    },
    zapisane: new Array(200).fill({ id: 'z', name: 'z' }),
  },
});

const wynik = parseBackup(zepsuty);
check('uszkodzony plik nie wysadza wczytywania', wynik.backup.aplikacja === 'planer-kaskowy');
check(`odrzucono uszkodzone wpisy (${wynik.skipped})`, wynik.skipped === 13);
check('zostały tylko poprawne kategorie', wynik.backup.dane.categories.length === 1);
check('zostały tylko poprawne wydarzenia', wynik.backup.dane.events.length === 1);
check('zostały tylko poprawne zadania', wynik.backup.dane.tasks.length === 2);
check(
  'stara ważność zamieniona na gwiazdkę',
  wynik.backup.dane.tasks.find((t) => t.title === 'Stare ważne')?.starred === true,
);
check(
  'stare zadanie zwykłe zostaje bez gwiazdki',
  wynik.backup.dane.tasks.find((t) => t.title === 'Stare zwykłe')?.starred === false,
);
check('zostały tylko poprawne nawyki', wynik.backup.dane.habits.length === 1);
check('zostały tylko poprawne odhaczenia', wynik.backup.dane.habitEntries.length === 1);

const wKolorach = Object.values(wynik.backup.motyw.aktualny.colors);
check(
  'żaden kolor motywu nie przeszedł bez formatu HEX',
  wKolorach.every((c) => /^#[0-9A-F]{6}$/i.test(c)),
);
check(
  'próba wstrzyknięcia adresu w tło została odrzucona',
  !wynik.backup.motyw.aktualny.colors.bg.includes('url('),
);
check(
  'poprawny kolor z pliku został zachowany',
  wynik.backup.motyw.aktualny.colors.text === '#112233',
);
check('nieznany krój pisma zastąpiony domyślnym', wynik.backup.motyw.aktualny.typography.fontId === DEFAULT_THEME.typography.fontId);
check('nieznana tekstura zastąpiona domyślną', wynik.backup.motyw.aktualny.texture === DEFAULT_THEME.texture);
check('rozmiar pisma przycięty do zakresu', wynik.backup.motyw.aktualny.typography.scale <= 1.45);
check('zaokrąglenie przycięte do zakresu', wynik.backup.motyw.aktualny.shape.radius >= 0);
check('nieliczbowa gęstość zastąpiona domyślną', wynik.backup.motyw.aktualny.shape.density === DEFAULT_THEME.shape.density);
check('nazwa motywu przycięta', wynik.backup.motyw.aktualny.name.length <= 60);
check('liczba zapisanych motywów ograniczona', wynik.backup.motyw.zapisane.length === 50);

// Wgranie uszkodzonej kopii musi zostawić aplikację w używalnym stanie
await restoreBackup(wynik.backup);
check('po wgraniu uszkodzonej kopii baza ma tylko zdrowe dane', (await db.events.count()) === 1);
check('uszkodzone odhaczenia nie trafiły do bazy', (await db.habitEntries.count()) === 1);

// 15. Pasek nawyku zapełnia się od lewej, od dnia założenia
const dzisiajData = new Date(2026, 7, 14);
const dzisiajKlucz = '2026-08-14';

const swiezy = habitStrip(new Date(2026, 7, 14).getTime(), 28, dzisiajData);
check('pasek ma zawsze pełną szerokość', swiezy.length === 28);
check('nawyk założony dziś zaczyna się od dzisiaj', swiezy[0] === dzisiajKlucz);
check(
  'reszta pola świeżego nawyku to dni przyszłe',
  swiezy.slice(1).every((k) => k > dzisiajKlucz),
);
check(
  'świeży nawyk ma dokładnie jeden dzień do odhaczenia',
  swiezy.filter((k) => k <= dzisiajKlucz).length === 1,
);

const piecDni = habitStrip(new Date(2026, 7, 10).getTime(), 28, dzisiajData);
check('nawyk sprzed pięciu dni zaczyna się w dniu założenia', piecDni[0] === '2026-08-10');
check('dzisiaj wypada na piątej pozycji', piecDni[4] === dzisiajKlucz);
check(
  'minione dni to dokładnie pięć pól',
  piecDni.filter((k) => k <= dzisiajKlucz).length === 5,
);

const stary = habitStrip(new Date(2026, 6, 1).getTime(), 28, dzisiajData);
check('po zapełnieniu okno przesuwa się na ostatnie 28 dni', stary[27] === dzisiajKlucz);
check('okno zaczyna się 27 dni wstecz', stary[0] === '2026-07-18');
check('w przesuniętym oknie nie ma dni przyszłych', stary.every((k) => k <= dzisiajKlucz));

const dokladnie28 = habitStrip(new Date(2026, 6, 18).getTime(), 28, dzisiajData);
check(
  'granica 28 dni działa bez przeskoku',
  dokladnie28[0] === '2026-07-18' && dokladnie28[27] === dzisiajKlucz,
);

const zPrzyszlosci = habitStrip(new Date(2026, 8, 1).getTime(), 28, dzisiajData);
check('data założenia z przyszłości nie psuje paska', zPrzyszlosci[0] === dzisiajKlucz);

// 17. Nawyki liczone miesiącami
const sierpienNawyku = new Date(2026, 7, 1);
const dniSierpnia = monthDays(sierpienNawyku);
check('sierpień ma 31 pól', dniSierpnia.length === 31);
check('miesiąc zaczyna się pierwszego', dniSierpnia[0] === '2026-08-01');
check('miesiąc kończy się ostatniego', dniSierpnia[30] === '2026-08-31');
check('luty 2028 ma 29 dni (rok przestępny)', monthDays(new Date(2028, 1, 1)).length === 29);
check('luty 2026 ma 28 dni', monthDays(new Date(2026, 1, 1)).length === 28);

const podzialka = monthScale(dniSierpnia);
check('podziałka zaczyna się od pierwszego', podzialka[0] === 1);
check('podziałka kończy się ostatnim dniem', podzialka[podzialka.length - 1] === 31);
check('podziałka nie zlepia dwóch ostatnich liczb', podzialka.every((d, i) =>
  i === 0 || d - podzialka[i - 1]! >= 3));
check('podziałka lutego kończy się na 28', monthScale(monthDays(new Date(2026, 1, 1))).at(-1) === 28);

const nawykMiesieczny: Habit = {
  id: 901,
  name: 'Bieganie',
  kind: 'tak-nie',
  target: 1,
  period: 'miesiac',
  order: 0,
  archived: false,
  createdAt: new Date(2026, 7, 10).getTime(),
};
const wpisy = new Map<string, number>([['2026-08-10', 1], ['2026-08-12', 1]]);
const oknoMiesiaca = habitWindow(nawykMiesieczny, {
  stripDays: 28,
  month: sierpienNawyku,
  todayKey: '2026-08-13',
  days: wpisy,
});
check('pasek miesięczny ma długość miesiąca', oknoMiesiaca.keys.length === 31);
check('dni sprzed założenia są oznaczone', oknoMiesiaca.states[0] === 'przed');
check('dzień założenia z celem jest zrobiony', oknoMiesiaca.states[9] === 'zrobiony');
check('dzień bez wpisu jest pusty', oknoMiesiaca.states[10] === 'pusty');
check('dni po dzisiaj są przyszłe', oknoMiesiaca.states[30] === 'przyszly');
check(
  'liczone są tylko dni od założenia do dzisiaj',
  oknoMiesiaca.tracked.length === 4 && oknoMiesiaca.tracked[0] === '2026-08-10',
);

const nawykCiagly: Habit = { ...nawykMiesieczny, id: 902, period: 'ciagly' };
const oknoCiagle = habitWindow(nawykCiagly, {
  stripDays: 28,
  month: sierpienNawyku,
  todayKey: '2026-08-13',
  days: wpisy,
});
check('pasek ciągły zaczyna się w dniu założenia', oknoCiagle.keys[0] === '2026-08-10');
check('pasek ciągły nie zna dni sprzed założenia', !oknoCiagle.states.includes('przed'));

// 18. Serie wydarzeń
const coTydzien = seriesDates('2026-08-03', { freq: 'tydzien', count: 4 });
check('seria tygodniowa ma cztery terminy', coTydzien.length === 4);
check('seria tygodniowa trzyma się poniedziałków', coTydzien[3] === '2026-08-24');
check(
  'seria dwutygodniowa przeskakuje o 14 dni',
  seriesDates('2026-08-03', { freq: 'dwa-tygodnie', count: 2 })[1] === '2026-08-17',
);
check(
  'seria miesięczna z 31 stycznia nie ucieka poza luty',
  seriesDates('2027-01-31', { freq: 'miesiac', count: 2 })[1] === '2027-02-28',
);

// 19. Odliczanie do terminu zadania
check('dzisiejszy termin to "dziś"', dueInfo('2026-08-13', slownikPl, '2026-08-13').text === 'dziś');
check('jutrzejszy termin to "jutro"', dueInfo('2026-08-14', slownikPl, '2026-08-13').text === 'jutro');
check(
  'termin za trzy dni odlicza dni',
  dueInfo('2026-08-16', slownikPl, '2026-08-13').text === 'do 16.08 · za 3 dni',
);
check('bliski termin jest wyróżniony', dueInfo('2026-08-16', slownikPl, '2026-08-13').tone === 'blisko');
check('odległy termin jest zwykły', dueInfo('2026-08-30', slownikPl, '2026-08-13').tone === 'zwykly');
check(
  'przekroczony termin mówi o zaległości',
  dueInfo('2026-08-11', slownikPl, '2026-08-13').text === '11.08 · 2 dni po terminie',
);
check('przekroczony termin ma ton zaległy', dueInfo('2026-08-11', slownikPl, '2026-08-13').tone === 'zalegly');
check(
  'bardzo odległy termin nie odlicza dni',
  dueInfo('2026-12-24', slownikPl, '2026-08-13').text === 'do 24.12',
);

// 20. Układ zakładek
check('domyślny układ pokazuje wszystkie zakładki', visibleTabs(normalizeLayout({})).length === 4);
check(
  'nieznane zakładki wypadają z układu',
  normalizeLayout({ order: ['kosmos', 'zadania'], hidden: [] }).order[0] === 'zadania',
);
check(
  'brakujące zakładki są dopisywane',
  normalizeLayout({ order: ['zadania'], hidden: [] }).order.length === DEFAULT_TAB_ORDER.length,
);
check(
  'powtórzona zakładka występuje tylko raz',
  normalizeLayout({ order: ['zadania', 'zadania'], hidden: [] }).order.filter(
    (t) => t === 'zadania',
  ).length === 1,
);
const wszystkoSchowane = normalizeLayout({ order: DEFAULT_TAB_ORDER, hidden: DEFAULT_TAB_ORDER });
check('nie da się schować wszystkich zakładek', visibleTabs(wszystkoSchowane).length >= 1);

check(
  'domyślnie kalendarz pokazuje nazwy zadań',
  normalizeLayout({}).calendarTasks === 'nazwy',
);
check(
  'wybór licznika przetrwa normalizację',
  normalizeLayout({ calendarTasks: 'licznik' }).calendarTasks === 'licznik',
);
check(
  'nieznany tryb kalendarza wraca do nazw',
  normalizeLayout({ calendarTasks: 'kosmos' }).calendarTasks === 'nazwy',
);

// 21. Grupowanie zadań
await db.tasks.clear();
await addTask({ title: 'Bez kategorii', starred: false });
await addTask({ title: 'Z terminem', starred: false, dueDate: '2026-08-20' });
await addTask({ title: 'Z tym samym terminem', starred: true, dueDate: '2026-08-20' });
const doGrupowania = buildTaskTree(await db.tasks.toArray());
const wgKategorii = groupByCategory(doGrupowania, await db.categories.toArray());
check('puste kategorie nie tworzą nagłówków', wgKategorii.every((g) => g.nodes.length > 0));
check(
  'zadania bez kategorii mają własną grupę',
  wgKategorii.some((g) => g.category === undefined && g.nodes.length === 3),
);
const wgDni = groupByDay(doGrupowania);
check('zadania z tym samym terminem trafiają do jednej grupy', wgDni.length === 1);
check('zadanie bez terminu nie trafia do widoku dni', wgDni[0]?.nodes.length === 2);
check(
  'gwiazdka wypycha zadanie na górę grupy',
  wgDni.find((g) => g.key === '2026-08-20')?.nodes[0]?.task.starred === true,
);


// 22. Tłumaczenia
const slowniki = { pl: slownikPl, srLatn, srCyrl, en: slownikEn, pt: slownikPt };

/** Zbiera wszystkie ścieżki kluczy, żeby dało się porównać słowniki co do jednego. */
function sciezki(obj: unknown, prefiks = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefiks];
  const out: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    out.push(...sciezki(value, prefiks ? `${prefiks}.${key}` : key));
  }
  return out.sort();
}

const wzorzec = sciezki(slownikPl);
for (const [nazwa, slownik] of Object.entries(slowniki)) {
  if (nazwa === 'pl') continue;
  const moje = sciezki(slownik);
  const brakuje = wzorzec.filter((k) => !moje.includes(k));
  const nadmiar = moje.filter((k) => !wzorzec.includes(k));
  check(`słownik ${nazwa} ma komplet kluczy`, brakuje.length === 0 && nadmiar.length === 0);
}

// Pusty tekst w tłumaczeniu wygląda na ekranie jak dziura po błędzie.
for (const [nazwa, slownik] of Object.entries(slowniki)) {
  const puste: string[] = [];
  const szukaj = (obj: unknown, prefiks: string) => {
    if (typeof obj === 'string') {
      if (obj.trim().length === 0) puste.push(prefiks);
      return;
    }
    if (typeof obj !== 'object' || obj === null) return;
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      szukaj(value, prefiks ? `${prefiks}.${key}` : key);
    }
  };
  szukaj(slownik, '');
  check(`słownik ${nazwa} nie ma pustych tekstów`, puste.length === 0);
}

check('cyrylica naprawdę jest cyrylicą', /^[\u0400-\u04FF]/.test(srCyrl.wspolne.zapisz));
check('serbska łacinka nie zawiera cyrylicy', !/[\u0400-\u04FF]/.test(srLatn.wspolne.zapisz));
check(
  'dwuznaki przeszły na jedną literę',
  srCyrl.kalendarz.powtarzanie === 'Понављање',
);
check(
  'nazwa aplikacji zostaje łacinką w cyrylickim tekście',
  srCyrl.kopia.bladObcy.includes('Planer Kaśkowy'),
);

check('forma dla 1 to one', slavicForm(1) === 'one');
check('forma dla 2 to few', slavicForm(2) === 'few');
check('forma dla 5 to many', slavicForm(5) === 'many');
check('nastka 11 idzie do many', slavicForm(11) === 'many');
check('nastka 12 idzie do many', slavicForm(12) === 'many');
check('21 wraca do one', slavicForm(21) === 'one');
check('22 wraca do few', slavicForm(22) === 'few');

check(
  'termin po serbsku odmienia dni',
  dueInfo('2026-08-16', srLatn, '2026-08-13').text === 'do 16.08 · za 3 dana',
);
check(
  'termin po angielsku nie odmienia',
  dueInfo('2026-08-16', slownikEn, '2026-08-13').text === 'by 16.08 · in 3 days',
);
check(
  'termin po portugalsku',
  dueInfo('2026-08-16', slownikPt, '2026-08-13').text === 'até 16.08 · daqui a 3 dias',
);

// 23. Nagłówki dni tygodnia idą za językiem
const literyDni = (locale: Parameters<typeof setDateLocale>[0]) => {
  setDateLocale(locale);
  return weekdayInitials();
};

check('po polsku dni to P W Ś C P S N', literyDni(plDate).join('') === 'PWŚCPSN');
check('po angielsku dni to M T W T F S S', literyDni(enGB).join('') === 'MTWTFSS');
check('po portugalsku tydzień zaczyna się od S', literyDni(ptDate)[0] === 'S');
check('po serbsku dni są cyrylicą', /^[\u0400-\u04FF]+$/.test(literyDni(srDate).join('')));
check('zawsze siedem nagłówków', literyDni(plDate).length === 7);

// Wracamy do polskiego, żeby dalsze sprawdzenia nie zależały od kolejności.
setDateLocale(plDate);

// 24. Zadania trwające kilka dni
const wielodniowe = {
  title: 'Remont kuchni',
  done: false,
  starred: false,
  startDate: '2026-08-10',
  dueDate: '2026-08-14',
  order: 0,
  createdAt: 1,
};

check('zadanie obejmuje dzień startu', coversDay(wielodniowe, '2026-08-10'));
check('zadanie obejmuje dzień w środku', coversDay(wielodniowe, '2026-08-12'));
check('zadanie obejmuje dzień terminu', coversDay(wielodniowe, '2026-08-14'));
check('zadanie nie obejmuje dnia przed startem', !coversDay(wielodniowe, '2026-08-09'));
check('zadanie nie obejmuje dnia po terminie', !coversDay(wielodniowe, '2026-08-15'));

const zwykle = { ...wielodniowe, startDate: undefined, dueDate: '2026-08-14' };
check('zwykłe zadanie zajmuje tylko dzień terminu', coversDay(zwykle, '2026-08-14'));
check('zwykłe zadanie nie rozlewa się na sąsiednie dni', !coversDay(zwykle, '2026-08-13'));

check('pięciodniowe zadanie daje pięć dni', taskDays(wielodniowe, '2026-08-01', '2026-08-31').length === 5);
check(
  'dni idą po kolei od startu',
  taskDays(wielodniowe, '2026-08-01', '2026-08-31')[0] === '2026-08-10' &&
    taskDays(wielodniowe, '2026-08-01', '2026-08-31')[4] === '2026-08-14',
);
check(
  'zakres jest przycinany do oglądanego okna',
  taskDays(wielodniowe, '2026-08-12', '2026-08-13').join(',') === '2026-08-12,2026-08-13',
);
check(
  'zadanie poza oknem nie daje żadnych dni',
  taskDays(wielodniowe, '2026-09-01', '2026-09-30').length === 0,
);
check(
  'zadanie przez przełom miesiąca liczy się poprawnie',
  taskDays({ ...wielodniowe, startDate: '2026-08-30', dueDate: '2026-09-02' }, '2026-08-01', '2026-09-30')
    .join(',') === '2026-08-30,2026-08-31,2026-09-01,2026-09-02',
);

// Odliczanie w zadaniu wielodniowym
check(
  'przed startem odlicza do startu',
  rangeInfo('2026-08-10', '2026-08-14', slownikPl, '2026-08-08').text ===
    '10.08–14.08 · start za 2 dni',
);
check(
  'w trakcie odlicza do końca',
  rangeInfo('2026-08-10', '2026-08-14', slownikPl, '2026-08-11').text ===
    '10.08–14.08 · zostało 3 dni',
);
check(
  'ostatni dzień jest nazwany wprost',
  rangeInfo('2026-08-10', '2026-08-14', slownikPl, '2026-08-14').text ===
    '10.08–14.08 · ostatni dzień',
);
check(
  'ostatni dzień jest wyróżniony',
  rangeInfo('2026-08-10', '2026-08-14', slownikPl, '2026-08-14').tone === 'blisko',
);
check(
  'po terminie liczy zaległość',
  rangeInfo('2026-08-10', '2026-08-14', slownikPl, '2026-08-16').text ===
    '10.08–14.08 · 2 dni po terminie',
);
check(
  'po terminie ma ton zaległy',
  rangeInfo('2026-08-10', '2026-08-14', slownikPl, '2026-08-16').tone === 'zalegly',
);
check(
  'zakres po angielsku',
  rangeInfo('2026-08-10', '2026-08-14', slownikEn, '2026-08-11').text ===
    '10.08–14.08 · 3 days left',
);

// Kopia zapasowa: początek po terminie jest odrzucany, samo zadanie zostaje
const zlyZakres = validTask({
  title: 'Zły zakres',
  done: false,
  starred: false,
  startDate: '2026-08-20',
  dueDate: '2026-08-14',
  order: 0,
  createdAt: 1,
});
check('zadanie ze złym zakresem zostaje bez daty początku', zlyZakres?.startDate === undefined);
check('zadanie ze złym zakresem zachowuje termin', zlyZakres?.dueDate === '2026-08-14');

const dobryZakres = validTask({
  title: 'Dobry zakres',
  done: false,
  starred: false,
  startDate: '2026-08-10',
  dueDate: '2026-08-14',
  order: 0,
  createdAt: 1,
});
check('poprawny zakres przechodzi', dobryZakres?.startDate === '2026-08-10');

// 25. Zadania cykliczne
check('seria tygodniowa zadań ma cztery terminy', taskSeriesDates('2026-08-03', { freq: 'tydzien', count: 4 }).length === 4);
check(
  'kolejne terminy zadania idą co siedem dni',
  taskSeriesDates('2026-08-03', { freq: 'tydzien', count: 4 })[3] === '2026-08-24',
);
check(
  'seria miesięczna zadań nie ucieka poza luty',
  taskSeriesDates('2027-01-31', { freq: 'miesiac', count: 2 })[1] === '2027-02-28',
);

await db.tasks.clear();
await addTask(
  { title: 'Podlać kwiaty', starred: false, dueDate: '2026-08-03' },
  { freq: 'tydzien', count: 3 },
);
const seriaZadan = await db.tasks.toArray();
check('powtórzenia powstały jako osobne zadania', seriaZadan.length === 3);
check('wszystkie dzielą jeden znacznik serii', new Set(seriaZadan.map((z) => z.seriesId)).size === 1);
check('terminy rozłożone co tydzień', seriaZadan.map((z) => z.dueDate).join(',') === '2026-08-03,2026-08-10,2026-08-17');
check('każde powtórzenie pamięta regułę', seriaZadan.every((z) => z.repeat?.freq === 'tydzien'));

// Zadanie wielodniowe zachowuje długość w każdym powtórzeniu
await db.tasks.clear();
await addTask(
  { title: 'Sprzątanie', starred: false, startDate: '2026-08-01', dueDate: '2026-08-03' },
  { freq: 'tydzien', count: 2 },
);
const seriaWielodniowa = (await db.tasks.toArray()).sort((a, b) =>
  (a.dueDate ?? '').localeCompare(b.dueDate ?? ''),
);
check(
  'powtórzenie zachowuje długość zadania',
  seriaWielodniowa[1]?.startDate === '2026-08-08' && seriaWielodniowa[1]?.dueDate === '2026-08-10',
);

// Zmiana całej serii nie rusza terminów
const znacznik = seriaWielodniowa[0]!.seriesId!;
await updateTaskSeries(znacznik, { starred: true });
const poZmianie = await db.tasks.toArray();
check('zmiana serii obejmuje wszystkie powtórzenia', poZmianie.every((z) => z.starred));
check(
  'zmiana serii nie rusza terminów',
  poZmianie.some((z) => z.dueDate === '2026-08-03') && poZmianie.some((z) => z.dueDate === '2026-08-10'),
);

// Kasowanie serii zabiera też podzadania
await db.tasks.add({
  title: 'Podzadanie w serii',
  done: false,
  starred: false,
  parentId: seriaWielodniowa[0]!.id,
  order: 99,
  createdAt: 1,
});
await deleteTaskSeries(znacznik);
check('kasowanie serii usuwa wszystkie powtórzenia', (await db.tasks.count()) === 0);

// Pojedyncze zadanie z serii da się skasować osobno
await db.tasks.clear();
await addTask(
  { title: 'Bieganie', starred: false, dueDate: '2026-08-03' },
  { freq: 'dzien', count: 3 },
);
const doPojedynczego = await db.tasks.toArray();
await deleteTask(doPojedynczego[1]!.id!);
check('skasowanie jednego terminu zostawia resztę serii', (await db.tasks.count()) === 2);

// Powtarzanie bez terminu nie ma czego przesuwać
await db.tasks.clear();
await addTask({ title: 'Bez terminu', starred: false }, { freq: 'tydzien', count: 5 });
check('zadanie bez terminu nie tworzy serii', (await db.tasks.count()) === 1);
check('zadanie bez terminu nie dostaje znacznika serii', (await db.tasks.toArray())[0]?.seriesId === undefined);

console.log(
  problems.length === 0
    ? '\nWszystko przeszło.'
    : `\nNIEPOWODZENIA (${problems.length}):\n- ${problems.join('\n- ')}`,
);
process.exit(problems.length === 0 ? 0 : 1);
