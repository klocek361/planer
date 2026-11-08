# Planer Kaśkowy

Kalendarz, zadania i nawyki w jednym — z wyglądem do przestawienia pod siebie.

Aplikacja działa jako PWA: instaluje się z przeglądarki, bez App Store i bez kont.
**Dane zostają na telefonie.** Jedyny wyjątek to kategorie, które sama
udostępnisz we **Wspólnym kalendarzu** — ich wydarzenia trafiają na serwer
wyłącznie zaszyfrowane, a klucz do nich ma tylko link, który wysyłasz
zaufanym osobom.

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

## Wspólny kalendarz

Ustawienia → Wspólny kalendarz → wybór kategorii → link dla drugiej osoby.
Druga osoba wkleja link w **swojej** aplikacji (Ustawienia → Wspólny kalendarz
→ Dołącz). Zmiany synchronizują się same, co ok. 45 s przy otwartej aplikacji.

- Bez kont i haseł: dostęp daje link. Klucz szyfrujący siedzi w części po `#`,
  której przeglądarka nie wysyła nigdzie — serwer widzi tylko zaszyfrowane bloki.
- „Zmień link” zakłada nową przestrzeń i zamyka starą, gdy link trafił
  w niepowołane ręce.
- Serwer to Cloudflare Worker z bazą D1 (darmowy plan), kod w `sync-server/`,
  instrukcja wdrożenia w `sync-server/README.md`. Bez skonfigurowanego serwera
  aplikacja działa jak dotąd, w pełni lokalnie.

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
| `src/sync/` | Wspólny kalendarz: szyfrowanie, silnik synchronizacji, link |
| `sync-server/` | Serwer wspólnego kalendarza (Cloudflare Worker + D1) |

Cały wygląd żyje jako zmienne CSS ustawiane z jednego obiektu motywu, więc
dołożenie nowej opcji personalizacji nie wymaga ruszania komponentów.
