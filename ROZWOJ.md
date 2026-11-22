# Rozwój aplikacji

Notatki techniczne. Instrukcja dla korzystających z aplikacji jest w `README.md`.

## Praca lokalna

Wymaga Node 22 lub nowszego (Vite 7).

```bash
npm ci             # instalacja zależności
npm run dev        # serwer deweloperski
npm run check      # sprawdzenie logiki danych
npm run typecheck  # kontrola typów
npm run build      # wersja produkcyjna do dist/
npm run icons      # przegenerowanie ikon aplikacji
```

## Wdrożenie

Każdy `git push` na gałąź `main` uruchamia workflow
`.github/workflows/deploy.yml`, który sprawdza, buduje i wystawia aplikację
na GitHub Pages (`https://klocek361.github.io/planer/`). W repozytorium:
**Settings → Pages → Source: GitHub Actions**.

Adres bazowy bierze się z nazwy repozytorium automatycznie, więc zmiana nazwy
niczego nie psuje. Adres serwera wspólnego kalendarza ustawia się w zmiennej
repozytorium `VITE_SYNC_URL` (Settings → Secrets and variables → Actions →
Variables); pusta zmienna oznacza aplikację w pełni lokalną.

Wersje: numer w `src/app/version.ts` i `package.json`, opis w `CHANGELOG.md`,
tag `vX.Y.Z` dla każdej wydanej wersji.

## Serwer wspólnego kalendarza

Cloudflare Worker z bazą D1 (darmowy plan), kod w `sync-server/`, instrukcja
w `sync-server/README.md`. Serwer widzi tylko zaszyfrowane bloki. Przyjmuje
też sugestie z aplikacji i rozmowy o nich (`src/app/conversations.ts`,
`src/ui/Feedback.tsx`) — pobiera się je poleceniem `npm run sugestie`
w `sync-server/`.

## Jak to jest poskładane

| Katalog | Za co odpowiada |
| --- | --- |
| `src/data/` | Baza IndexedDB (Dexie), operacje na danych, kopia zapasowa |
| `src/theme/` | Motyw: kolory, kroje, kształty; zamiana na zmienne CSS |
| `src/features/` | Ekrany: kalendarz, zadania, nawyki, listy, budżet, ustawienia |
| `src/ui/` | Wspólne elementy: przyciski, panele, próbnik koloru |
| `src/platform/` | Rzeczy zależne od systemu — **jedyne miejsce do podmiany** przy przejściu na Capacitora (App Store, Android) |
| `src/lib/` | Rachunki na datach |
| `src/sync/` | Wspólne kalendarze: szyfrowanie, synchronizacja, kody zaproszeń |
| `sync-server/` | Serwer wspólnego kalendarza (Cloudflare Worker + D1) |

Cały wygląd żyje jako zmienne CSS ustawiane z jednego obiektu motywu, więc
dołożenie nowej opcji personalizacji nie wymaga ruszania komponentów.
