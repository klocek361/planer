# Serwer wspólnego kalendarza

Cloudflare Worker + baza D1. Przechowuje wyłącznie zaszyfrowane rekordy —
klucz zostaje w linku po `#` i nigdy tu nie trafia. Darmowy plan Cloudflare
wystarcza z dużym zapasem (100 tys. zapytań dziennie).

## Jednorazowe wdrożenie

Wszystko w zwykłym terminalu, w katalogu `sync-server/`:

```bash
npm install
npx wrangler login                 # logowanie w przeglądarce, darmowe konto
npx wrangler d1 create planer-sync # wypisze database_id
```

Skopiuj `database_id` z wyniku do `wrangler.toml` (w miejsce `UZUPELNIJ`), potem:

```bash
npm run schema:remote   # zakłada tabele w bazie
npm run deploy          # wypisze adres, np. https://planer-sync.<konto>.workers.dev
```

Na koniec w repozytorium na GitHubie: **Settings → Secrets and variables →
Actions → Variables → New repository variable**, nazwa `VITE_SYNC_URL`,
wartość — adres z `npm run deploy`. Następny push przebuduje aplikację
z włączonym wspólnym kalendarzem.

## Próby lokalne

```bash
npm run schema:local
npm run dev                         # serwer na http://localhost:8787
# w drugim terminalu, w katalogu głównym projektu:
VITE_SYNC_URL=http://localhost:8787 npm run dev
```

## API

| Metoda | Ścieżka | Co robi |
| --- | --- | --- |
| `POST` | `/s/:id` | zakłada przestrzeń, zapamiętuje skrót tokenu |
| `PUT` | `/s/:id/r` | zapisuje do 100 zaszyfrowanych rekordów |
| `GET` | `/s/:id/zmiany?od=N` | zmiany o numerze większym niż N (po 500) |
| `DELETE` | `/s/:id` | zamyka przestrzeń i kasuje jej dane |
| `PUT` | `/s/:id/zaproszenie` | wystawia zaproszenie na 24 h (zastępuje poprzednie) |
| `DELETE` | `/s/:id/zaproszenie` | unieważnia zaproszenie |
| `POST` | `/z/:lookup` | odbiera zaproszenie — raz, bez tokenu, max 30 prób/h z adresu |
| `POST` | `/sugestie` | zapisuje sugestię z aplikacji — bez tokenu, max 10/h z adresu |

Zapytania o przestrzeń wymagają `Authorization: Bearer <token>`; token telefon
wylicza z klucza, serwer trzyma tylko jego skrót SHA-256. Limity: 16 KB na
rekord, 5000 rekordów na przestrzeń. CORS tylko dla adresów z `ALLOWED_ORIGINS`.

## Zaproszenia

8-cyfrowy kod nie trafia na serwer. Telefon wyprowadza z niego (PBKDF2,
300 tys. rund) identyfikator zaproszenia i klucz, którym szyfruje klucz
kalendarza. Serwer trzyma zaszyfrowane zaproszenie pod tym identyfikatorem
przez 24 h i oddaje je tylko raz.

## Aktualizacja serwera

Po zmianach w `schema.sql` lub `src/`:

```bash
npm run schema:remote   # dokłada nowe tabele, istniejące dane zostają
npm run deploy
```

## Sugestie z aplikacji

Przycisk (!) w lewym górnym rogu aplikacji wysyła imię i treść sugestii.
To jedyne dane na serwerze, które **nie są szyfrowane** — czyta je tylko
właściciel serwera. Pobranie (w katalogu `sync-server/`, po `wrangler login`):

```bash
npm run sugestie        # tabela w terminalu, najnowsze na górze
npm run sugestie:plik   # to samo do pliku sugestie.json (jest w .gitignore)
```
