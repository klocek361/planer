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
| `POST` | `/sugestie` | zapisuje sugestię z aplikacji — bez tokenu, max 10/h z adresu; opcjonalnie z kluczem rozmowy |
| `POST` | `/sugestie/rozmowy` | rozmowy o sugestiach wysłanych z danym kluczem `{ klucz }` |
| `POST` | `/sugestie/:nr/wiadomosc` | dopisuje wiadomość autora sugestii `{ klucz, text, zdjecia? }` — max 30/h z adresu, 200 na rozmowę |
| `POST` | `/s/:id/czat` | dopisuje zaszyfrowaną wiadomość czatu `{ uid, blob }` → `{ seq, created }` (max 50 000 na kalendarz) |
| `GET` | `/s/:id/czat?od=N` | wiadomości czatu o numerze większym niż N (po 500) |
| `POST` | `/s/:id/czat/zdjecie-szyfr` | zaszyfrowane zdjęcie czatu `{ szyfr }` (iv ‖ szyfrogram w base64, ≤ 1 MB + 28 B) → `{ id }` (od 1.16.0) |
| `GET` | `/s/:id/czat/zdjecie-szyfr/:pid` | zaszyfrowane zdjęcie czatu → `{ szyfr }` |
| `POST` | `/s/:id/czat/zdjecie` | zdjęcie czatu ze starszych wersji `{ dane }` (JPEG/PNG ≤ 1 MB, **nieszyfrowane**) → `{ id, typ }` |
| `GET` | `/s/:id/czat/zdjecie/:pid` | zdjęcie czatu sprzed 1.16.0 → `{ typ, dane }` |
| `POST` | `/sugestie/zdjecie/:id` | zdjęcie z rozmowy `{ klucz }` → `{ typ, dane }` (base64); 410, gdy już przekazane |

Zapytania o przestrzeń wymagają `Authorization: Bearer <token>`; token telefon
wylicza z klucza, serwer trzyma tylko jego skrót SHA-256. Limity: 16 KB na
rekord, 5000 rekordów na przestrzeń, 3000 zdjęć czatu (obu rodzajów razem).
CORS tylko dla adresów z `ALLOWED_ORIGINS`.

Zdjęcia czatu od 1.16.0 (`chat_photos_sealed`) telefon szyfruje losowym kluczem
AES-256-GCM; klucz jedzie w wiadomości (zaszyfrowanej kluczem kalendarza albo
pary), więc serwer nie zna ani obrazu, ani jego typu.

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
właściciel serwera. Tak samo zdjęcia (`zdjecia`: do 3 JPEG-ów / PNG-ów w base64,
każde do 1 MB, tylko z kluczem rozmowy) — telefon zapisuje je od nowa, bez danych
z aparatu. Po przyjęciu sugestii właściciel zabiera zdjęcie do siebie, a na
serwerze zostaje sam wpis bez danych. Pobranie (w katalogu `sync-server/`, po `wrangler login`):

```bash
npm run sugestie        # tabela w terminalu, najnowsze na górze
npm run sugestie:plik   # to samo do pliku sugestie.json (jest w .gitignore)
```

**Rozmowy.** Przy wysłaniu sugestii telefon losuje klucz rozmowy (32 bajty)
i trzyma go u siebie; serwer zapisuje tylko jego skrót SHA-256
(`suggestion_threads`). Z kluczem telefon czyta odpowiedzi i dopisuje
wiadomości (`suggestion_messages`, autor `autor`). Odpowiedzi właściciela
(autor `wlasciciel`) nie mają adresu w API — wpisuje się je wprost do D1
wranglerem, tak jak pobiera się sugestie. Wiadomości, tak jak sugestie,
nie są szyfrowane. Sugestie ze starszych wersji aplikacji nie mają rozmowy.
