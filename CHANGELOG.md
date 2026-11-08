# Historia zmian

Numeracja jak w `src/app/version.ts`: pierwsza liczba — przebudowa zmieniająca
sposób korzystania z aplikacji, druga — nowe możliwości, trzecia — poprawki.

Każda wydana wersja ma w repozytorium tag `vX.Y.Z`.

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
