# Planer Kaśkowy

Kalendarz, zadania i nawyki w jednym — z wyglądem do przestawienia pod siebie.

Aplikacja działa jako PWA: instaluje się z przeglądarki, bez App Store i bez kont.
**Dane zostają na telefonie.** Jedyny wyjątek to **wspólne kalendarze** —
ich wydarzenia trafiają na serwer wyłącznie zaszyfrowane, a klucz mają tylko
członkowie, zaproszeni jednorazowym kodem.

## Instalacja na iPhonie

1. Otwórz adres aplikacji w **Safari** (musi być Safari, nie Chrome).
2. Dotknij ikony udostępniania (kwadrat ze strzałką w górę).
3. Wybierz **Dodaj do ekranu początkowego**.
4. Potwierdź. Ikona pojawi się między innymi aplikacjami.

Po instalacji aplikacja działa bez internetu.

> **Uwaga:** usunięcie ikony z ekranu początkowego kasuje wszystkie dane.
> Rób kopię zapasową: Ustawienia → Kopia zapasowa → Zapisz kopię do pliku.

## Wdrożenie na GitHub Pages

Jednorazowa konfiguracja — ze zwykłego terminala:

```bash
cd /home/michal/claude/kaska
git remote add origin https://github.com/klocek361/planer.git
git push -u origin main
```

Potem w repozytorium na GitHubie: **Settings → Pages → Source: GitHub Actions**.

Każdy kolejny `git push` na gałąź `main` sam przebuduje i wystawi aplikację.
Adres aplikacji: `https://klocek361.github.io/planer/`.

Adres bazowy bierze się z nazwy repozytorium automatycznie, więc zmiana nazwy
niczego nie psuje.

## Wspólne kalendarze

Ustawienia → Wspólny kalendarz → „Nowy wspólny kalendarz” → nazwa i własne
imię. Powstaje wspólna kategoria — wszystko, co do niej dodasz (wydarzenia,
zadania, nawyki, listy), widzą wszyscy członkowie. Inne kategorie są prywatne.
Kolejne osoby zapraszasz **8-cyfrowym kodem** (jednorazowym, ważnym 24 h);
wpisują go w swojej aplikacji w „Dołącz kodem”.

- Bez kont i haseł. Klucz kalendarza zostaje na telefonach członków, serwer
  widzi tylko zaszyfrowane bloki. Kod jednorazowo przekazuje ten klucz.
- Każdy kalendarz ma listę członków (imię i kto zaprosił). Można należeć do
  kilku kalendarzy naraz, z innym imieniem w każdym.
- „Odetnij wszystkich” daje kalendarzowi nowy klucz, gdy trzeba kogoś odciąć.
- Serwer to Cloudflare Worker z bazą D1 (darmowy plan), kod w `sync-server/`,
  instrukcja w `sync-server/README.md`. Bez skonfigurowanego serwera aplikacja
  działa jak dotąd, w pełni lokalnie.

## Praca lokalna

Projekt używa własnego Node w `.toolchain/` (systemowy był za stary):

```bash
export PATH="$PWD/.toolchain/node/bin:$PATH"

npm run dev        # serwer deweloperski
npm run check      # sprawdzenie logiki danych (97 testów)
npm run typecheck  # kontrola typów
npm run build      # wersja produkcyjna do dist/
npm run icons      # przegenerowanie ikon aplikacji
```

## Jak to jest poskładane

| Katalog | Za co odpowiada |
| --- | --- |
| `src/data/` | Baza IndexedDB (Dexie), operacje na danych, kopia zapasowa |
| `src/theme/` | Motyw: kolory, kroje, kształty; zamiana na zmienne CSS |
| `src/features/` | Ekrany: kalendarz, zadania, nawyki, ustawienia |
| `src/ui/` | Wspólne elementy: przyciski, panele, próbnik koloru |
| `src/platform/` | Rzeczy zależne od systemu — **jedyne miejsce do podmiany** przy przejściu na Capacitora (App Store, Android) |
| `src/lib/` | Rachunki na datach |
| `src/sync/` | Wspólne kalendarze: szyfrowanie, synchronizacja, kody zaproszeń |
| `sync-server/` | Serwer wspólnego kalendarza (Cloudflare Worker + D1) |

Cały wygląd żyje jako zmienne CSS ustawiane z jednego obiektu motywu, więc
dołożenie nowej opcji personalizacji nie wymaga ruszania komponentów.
