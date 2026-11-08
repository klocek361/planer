# Historia zmian

Numeracja jak w `src/app/version.ts`: pierwsza liczba — przebudowa zmieniająca
sposób korzystania z aplikacji, druga — nowe możliwości, trzecia — poprawki.

Każda wydana wersja ma w repozytorium tag `vX.Y.Z`.

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
