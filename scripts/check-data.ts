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
  isDayComplete,
  setHabitValue,
} from '../src/data/habits';
import {
  buildMonthGrid,
  compareEvents,
  fullDateLabel,
  lastDays,
  monthGridRange,
  monthLabel,
} from '../src/lib/dates';

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
  priority: 1,
  categoryId: victim.id,
  order: 0,
  createdAt: Date.now(),
});
const habitId = await db.habits.add({
  name: 'Woda',
  kind: 'licznik',
  target: 8,
  unit: 'szklanek',
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
await addTask({ title: '  Bez terminu  ', priority: 2 });
await addTask({ title: 'Za tydzień', priority: 0, dueDate: '2026-08-20' });
await addTask({ title: 'Jutro zwykłe', priority: 0, dueDate: '2026-08-14' });
await addTask({ title: 'Jutro pilne', priority: 2, dueDate: '2026-08-14' });

const wszystkie = await db.tasks.toArray();
check('nazwa zadania jest przycinana', wszystkie.some((t) => t.title === 'Bez terminu'));
check('nowe zadania są niezrobione', wszystkie.every((t) => t.done === false));

const kolejnosc = buildTaskTree(wszystkie).map((n) => n.task.title);
check(
  'termin decyduje przed ważnością, brak terminu na końcu',
  kolejnosc.join() === 'Jutro pilne,Jutro zwykłe,Za tydzień,Bez terminu',
);

// Podzadania trzymają się rodzica niezależnie od własnego terminu
const rodzic = wszystkie.find((t) => t.title === 'Za tydzień')!;
await addTask({ title: 'Podzadanie B', priority: 0, parentId: rodzic.id, dueDate: '2026-08-19' });
await addTask({ title: 'Podzadanie A', priority: 0, parentId: rodzic.id, dueDate: '2026-08-18' });

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

await addHabit({ name: '  Medytacja  ', kind: 'tak-nie', target: 99 });
await addHabit({ name: 'Woda', kind: 'licznik', target: 8, unit: 'szklanek' });

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
await addTask({ title: 'Kupić winietki', priority: 1, dueDate: '2026-08-11' });
await addHabit({ name: 'Woda', kind: 'licznik', target: 8 });
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
      { id: 1, title: 'Dobre', done: false, priority: 1, order: 0, createdAt: 1 },
      { id: 2, title: 'Zły priorytet', done: false, priority: 7, order: 1, createdAt: 2 },
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
check('zostały tylko poprawne zadania', wynik.backup.dane.tasks.length === 1);
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

console.log(
  problems.length === 0
    ? '\nWszystko przeszło.'
    : `\nNIEPOWODZENIA (${problems.length}):\n- ${problems.join('\n- ')}`,
);
process.exit(problems.length === 0 ? 0 : 1);
