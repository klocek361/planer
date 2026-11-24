# Historia zmian

Numeracja jak w `src/app/version.ts`: pierwsza liczba — przebudowa zmieniająca
sposób korzystania z aplikacji, druga — nowe możliwości, trzecia — poprawki.

Każda wydana wersja ma w repozytorium tag `vX.Y.Z`.

## [1.13.0] — 2026-11-25

### Nowe
- **Notatka dnia we wspólnym kalendarzu:** w Zadaniach, w widoku Dni, nad
  zadaniami wybranego dnia — krótka wiadomość dla pozostałych, np. „koty
  nakarmione”. Jedna na kalendarz i dzień, widzą ją i mogą zmienić wszyscy
  członkowie; przy notatce widać, kto ją ostatnio zmienił.
- **Podkategorie wspólnych kalendarzy:** zakłada się je w ustawieniach
  kalendarza (nazwa i kolor), a wybiera przy zadaniu i wydarzeniu z tego
  kalendarza. Wpis pokazuje się jako „Kalendarz · Podkategoria” w kolorze
  podkategorii. Usunięcie podkategorii zostawia wpisy w kalendarzu.
- **Okno „Nowa wersja”** przy pierwszym uruchomieniu po aktualizacji,
  z listą usprawnień. Przy świeżej instalacji się nie pokazuje.

### Poprawki
- Godziny w czacie zawsze w zapisie 24-godzinnym i w języku aplikacji —
  wcześniej zależały od ustawień telefonu.
- Wspólne kalendarze: usunięcie pola — notatki zadania, „5 minut”, notatki
  lub płacącego we wpisie budżetu, terminu skarbonki, celu kategorii —
  nie docierało do innych telefonów; zostawała u nich stara wartość
  i wracała do wszystkich przy ich następnej edycji. Rekord z serwera
  zastępuje teraz lokalny w całości.

### Zgodność
- Nowa wersja bazy na telefonie (11) i kopii zapasowej (5); starsze kopie
  wczytują się bez zmian.
- Wspólne kalendarze: nowy format rekordów (4) — po aktualizacji telefon
  raz pobiera kalendarz od nowa. Starsza wersja aplikacji nie widzi
  podkategorii ani notatek dnia, a edytując zadanie lub wydarzenie, zdejmuje
  z niego podkategorię — warto, żeby wszyscy w kalendarzu zaktualizowali.
- Serwer bez zmian.

## [1.12.0] — 2026-11-22

### Nowe
- **Podzadania od razu pod zadaniem:** w formularzu zadania, pod nazwą,
  wpisuje się kolejne podzadania — Enter przechodzi do następnego, a kilka
  linii wklejonych naraz (np. z notatek) zamienia się w osobne podzadania.
  Przy edycji widać istniejące i można dopisać następne. Zadanie
  powtarzane dostaje podzadania w każdym powtórzeniu.

### Zmiany
- Zamiast przycisku „Dodaj podzadanie” i osobnego formularza dla każdego
  podzadania — pola w formularzu zadania.

## [1.11.0] — 2026-11-22

### Nowe
- **Zakładka Czat:** rozmowy z osobami ze wspólnych kalendarzy, jak
  w komunikatorze — lista (rozmowa całego kalendarza i poszczególne osoby),
  dotknięcie otwiera rozmowę. Kropka na zakładce i liczniki nowych wiadomości.
- Rozmowy 1:1 szyfrowane kluczem pary — nie czyta ich serwer ani pozostali
  członkowie kalendarza. Rozmowa całego kalendarza — kluczem kalendarza.
- Zdjęcia w czacie (do 3 na wiadomość) — **nieszyfrowane**, z ostrzeżeniem
  przy dodawaniu.

### Zgodność
- Nowa wersja bazy na telefonie (10, tabele czatu). Cofnięcie strony do
  wersji sprzed 1.11.0 nie jest możliwe (Planer push je zablokuje).

## [1.10.0] — 2026-11-22

### Nowe
- **Zdjęcia w sugestiach i rozmowach:** do zgłoszenia i do każdej wiadomości
  można dołączyć do 3 zdjęć (spinacz). Telefon zmniejsza je i zapisuje od
  nowa — bez danych z aparatu, w tym miejsca zrobienia zdjęcia. Zrzuty
  ekranu zostają w PNG. Dotknięcie miniatury powiększa zdjęcie.
- Gdy autor aplikacji przyjmie zgłoszenie, zabiera zdjęcie do siebie —
  w rozmowie zostaje informacja „Zdjęcie przekazane”.

## [1.9.1] — 2026-11-22

### Poprawki
- Czcionka JetBrains Mono (znaki wietnamskie) jest teraz osobnym plikiem.
  Wcześniej trafiała do pliku stylów, a zabezpieczenia strony ją blokowały
  — z błędem w konsoli przeglądarki.

## [1.9.0] — 2026-11-22

### Nowe
- **Archiwum rozmów o sugestiach:** ikonka w rogu rozmowy chowa ją do
  archiwum — tylko na tym telefonie. „Pokaż zarchiwizowane” pokazuje całą
  historię i pozwala rozmowę przywrócić. Rozmowa wraca sama, gdy przyjdzie
  na nią nowa odpowiedź.

## [1.8.0] — 2026-11-22

### Nowe
- **Rozmowa o sugestii:** na wysłaną sugestię przychodzi odpowiedź — widać
  ją w panelu sugestii, pod formularzem, i można odpisać. Kropka na
  przycisku (!) oznacza nową odpowiedź. Telefon zapamiętuje losowy klucz
  rozmowy, niezwiązany z kalendarzami ani innymi danymi.

## [1.7.0] — 2026-11-22

### Nowe
- **Sentencje po portugalsku:** w języku portugalskim nagłówek Przeglądu
  i karteczka w Nawykach losują z osobnej puli przekręconych portugalskich
  przysłów (nie tłumaczeń). W pozostałych językach bez zmian.

### Zmiany
- **Budżet:** wydatki według kategorii są ułożone od najwyższej sumy
  w miesiącu do najniższej.

### Poprawki
- Gdy ktoś usuwał wspólny kalendarz z przypiętym budżetem, u pozostałych
  członków czasem zostawały wpisy tego budżetu. Teraz znikają zawsze.

## [1.6.1] — 2026-11-08

### Poprawki
- Przycisk sugestii (!) pojawia się też w zakładce Kalendarz.

## [1.6.0] — 2026-11-08

### Nowe
- **Sugestie:** mały przycisk (!) w lewym górnym rogu każdego ekranu otwiera
  panel z imieniem i treścią sugestii. Sugestie trafiają na serwer razem
  z wersją aplikacji i nazwą ekranu; imię zapamiętuje się na telefonie.
  Pobiera się je poleceniem `npm run sugestie` w `sync-server/`.

## [1.5.0] — 2026-11-08

### Nowe
- **Zakładka Budżet.** Bilans miesiąca: przychody, wydatki i ile zostało;
  wydatki według kategorii z opcjonalnym celem miesięcznym; opcjonalnie
  „kto zapłacił”; skarbonki z kwotą docelową, wpłatami i wypłatami; wpisy
  miesiąca po dniach. Waluta do wyboru.
- **Wspólny budżet:** przypięty do wspólnego kalendarza widzą i uzupełniają
  wszyscy jego członkowie; bez przypięcia zostaje tylko na telefonie.
- **Notatka do zadania** — wyświetlana drobnym drukiem pod tytułem.
- **„+ Dodaj podzadanie”** w edycji zadania — bez szukania małego plusa
  na liście.
- Kopia zapasowa obejmuje budżet (format 4).

## [1.4.1] — 2026-11-08

### Poprawki
- Telefon, który dostał wspólne zadania, nawyki lub listy jeszcze w starszej
  wersji, pomijał je i po aktualizacji już ich nie pobierał. Teraz po zmianie
  formatu danych pobiera wszystko od nowa, jednorazowo.

## [1.4.0] — 2026-11-08

### Zmiany we wspólnym kalendarzu
- **Współdzielone jest wszystko ze wspólnej kategorii:** oprócz wydarzeń
  także zadania (z podzadaniami), nawyki (z odhaczeniami — wspólny postęp)
  i listy (z pozycjami). Pozostałe kategorie zostają prywatne.
- Gdy dwie osoby odhaczą ten sam nawyk tego samego dnia, powstaje jedno
  odhaczenie, nie dwa.

### Nowe
- Do losowanych sentencji doszło dziesięć po podlasku — obok wszystkich
  czterdziestu polskich oryginałów.

## [1.3.1] — 2026-11-08

### Poprawki
- Nawyki znów pokazują serię — „🔥 5 dni” po prawej stronie — oraz wynik
  okresu („18/28 dni”). Liczniki mają z powrotem jednostkę („3/8 szklanki”).

## [1.3.0] — 2026-11-08

### Nowy wygląd Przeglądu i Nawyków
- **Przegląd:** nagłówek z datą i losową sentencją, zakładki „dziś”
  i „wkrótce” (dwa tygodnie, po dniach albo po obszarach), karty po
  kategoriach z wydarzeniami, nawykami i zadaniami, filtr „⚡ 5 min”
  i pływający „+” do dodania zadania.
- **Nawyki:** karteczka z sentencją, nawyki pogrupowane po kategoriach,
  kółko z postępem dnia i kropki ostatnich 7 dni, pływający „+”.

### Zmiany we wspólnym kalendarzu
- **Kod zamiast linku.** Zaprasza się 8-cyfrowym kodem — jednorazowym,
  ważnym 24 godziny. „Nowy kod” unieważnia poprzedni, „Unieważnij kod”
  wyłącza go od razu. Udostępniany jest sam tekst z kodem.
- **Kilka wspólnych kalendarzy** na jednym telefonie. Każdy zakłada się,
  wpisując samą nazwę (np. „Nasz dom”) — powstaje z niej wspólna kategoria.
- **Lista członków** w każdym kalendarzu: imię wpisane przez samego członka
  (osobne w każdym kalendarzu) i to, kto go zaprosił.
- **Opuść** usuwa z listy członków; dane zostają u wychodzącego jako prywatne.
  **Odetnij wszystkich** daje kalendarzowi nowy klucz.
- Serwer ogranicza próby odgadnięcia kodu (30 na godzinę z jednego adresu).

## [1.2.0] — 2026-11-08

### Nowe
- Gotowy zestaw wyglądu **Kaśkowy** — ciepła złamana biel, szałwiowa zieleń,
  bursztynowe weekendy, miękkie zaokrąglenia i faktura papieru.
- **Zadania na 5 minut** — oznaczane piorunkiem, zawsze na górze listy.
  Przycisk „⚡ 5 min” w nagłówku Zadań pokazuje tylko takie zadania.
- **Wspólny kalendarz** — wybrane kategorie wspólne z drugą osobą, edycja
  po obu stronach, synchronizacja w tle. Dostęp przez link, bez kont;
  dane na serwerze wyłącznie zaszyfrowane (AES-GCM, klucz tylko w linku).

### Poprawki
- Test paska nawyku ciągłego nie zależy już od dzisiejszej daty.
- Zaktualizowane narzędzia do budowania (m.in. vite, sharp) — załatane podatności.

## [1.1.0] — 2026-11-07

### Nowe
- Zakładka **Przegląd** i ustawienia zakładek (kolejność, ukrywanie).
- Zakładka **Listy** — zakupy i inne listy do odhaczania.
- Zadania mogą trwać kilka dni i powtarzać się cyklicznie.
- Widok „Wszystkie” dzieli zadania na dni.
- Kalendarz pokazuje zadania z terminem.
- Nawyki liczone miesiącami; licznik zatrzymuje się na celu.
- Pięć języków: polski, angielski, portugalski, serbski (cyrylica i łacinka).
- Ustawienia sekcji z poziomu samego ekranu.
- Numer wersji widoczny w Ustawieniach i zapisywany w kopii zapasowej.
- Podpis autora na dole Ustawień.

### Poprawki
- Pytanie przed skasowaniem nawyku, zadania, wydarzenia i kategorii.
- Android: gest cofania zamyka jedną warstwę, klawiatura nie zasłania pól.
- Kalendarz przewija się w całości przy powiększonym piśmie.
- Pola formularzy nie wystają poza panel.

## [0.1.0] — 2026-08-14

Pierwsza wersja: kalendarz, zadania i nawyki, motywy, kopia zapasowa,
działanie offline (PWA) i wdrożenie na GitHub Pages.
