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
Przy każdym wydaniu podmień też listę `nowosci.zmiany` we wszystkich słownikach
`src/i18n/` — to ją widać w oknie „Nowa wersja” po aktualizacji (krótko, dla
korzystających, bez szczegółów technicznych).

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
| `src/sync/` | Wspólne kalendarze: szyfrowanie, synchronizacja, kody zaproszeń; czat (`chat.ts`: osobny kanał, klucze par ECDH P-256 + HKDF, zdjęcia nieszyfrowane) |
| `src/dev/` | Tryb deweloperski: zestaw „Serduszka” i motyw narzucany członkom kalendarza (rekord `w`, podpis ECDSA) |
| `sync-server/` | Serwer wspólnego kalendarza (Cloudflare Worker + D1) |

Cały wygląd żyje jako zmienne CSS ustawiane z jednego obiektu motywu, więc
dołożenie nowej opcji personalizacji nie wymaga ruszania komponentów.

## Tryb deweloperski

Ustawienia → **Opcje deweloperskie**. Kod to klucz prywatny ECDSA P-256
(43 znaki base64url); w `src/dev/devMode.ts` leży tylko klucz publiczny
(`DEV_PUBLIC_KEY`). Kodu nie ma w repozytorium ani w kopii zapasowej — na
telefonie trzyma go osobna baza `planer-dev` jako nieeksportowalny `CryptoKey`.

Po włączeniu: zestaw i tło „Serduszka” w Wyglądzie oraz wybór „Wygląd
narzucany członkom” w ustawieniach wspólnego kalendarza: bieżący wygląd
(podpisywany od nowa po każdej zmianie, `useDevTheme`) albo wybrany zestaw
(`syncState.motywStaly` — zostaje bez zmian). Narzucony
motyw to rekord synchronizacji `w` (`motyw<id kalendarza>`, od `SYNC_FORMAT`
5) z podpisem nad `id kalendarza + chwila + motyw`; telefon nakłada go tylko
z ważnym podpisem i tylko raz na wersję (`syncState.motyw`). Członek może
potem zmienić wygląd u siebie. Członek z przerobioną aplikacją może najwyżej
zastąpić rekord podróbką, którą wszyscy zignorują — nie narzuci własnego.

Nowy kod (np. po zgubieniu): wygenerować parę P-256, podmienić
`DEV_PUBLIC_KEY`, wydać wersję. Stare podpisy przestają wtedy działać.
