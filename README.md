# Planer Kaśkowy

Kalendarz, zadania i nawyki w jednym — z wyglądem do przestawienia pod siebie.

Aplikacja działa jako PWA: instaluje się z przeglądarki, bez App Store i bez kont.
**Wszystkie dane zostają na telefonie** — nic nie trafia na żaden serwer.

## Instalacja na iPhonie

1. Otwórz adres aplikacji w **Safari** (musi być Safari, nie Chrome).
2. Dotknij ikony udostępniania (kwadrat ze strzałką w górę).
3. Wybierz **Dodaj do ekranu początkowego**.
4. Potwierdź. Ikona pojawi się między innymi aplikacjami.

Po instalacji aplikacja działa bez internetu.

> **Uwaga:** usunięcie ikony z ekranu początkowego kasuje wszystkie dane.
> Rób kopię zapasową: Ustawienia → Kopia zapasowa → Zapisz kopię do pliku.

## Wdrożenie na GitHub Pages

Jednorazowa konfiguracja:

```bash
# 1. Utwórz puste repozytorium na github.com (bez README)
# 2. Podłącz je i wyślij kod:
git remote add origin https://github.com/TWOJA-NAZWA/planer-kaskowy.git
git branch -M main
git push -u origin main
```

Potem w repozytorium na GitHubie: **Settings → Pages → Source: GitHub Actions**.

Każdy kolejny `git push` na gałąź `main` sam przebuduje i wystawi aplikację.
Adres będzie miał postać `https://TWOJA-NAZWA.github.io/planer-kaskowy/`.

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

Cały wygląd żyje jako zmienne CSS ustawiane z jednego obiektu motywu, więc
dołożenie nowej opcji personalizacji nie wymaga ruszania komponentów.
