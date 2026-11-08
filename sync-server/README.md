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

Każde zapytanie wymaga `Authorization: Bearer <token>`; token telefon
wylicza z klucza, serwer trzyma tylko jego skrót SHA-256. Limity: 16 KB na
rekord, 5000 rekordów na przestrzeń. CORS tylko dla adresów z `ALLOWED_ORIGINS`.
