-- Baza serwera wspólnego kalendarza. Leżą tu wyłącznie zaszyfrowane bloki.

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  -- Skrót SHA-256 tokenu zapisu; sam token nie jest przechowywany.
  token_hash TEXT NOT NULL,
  -- Numer ostatniej zmiany w przestrzeni.
  seq INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS records (
  space TEXT NOT NULL,
  uid TEXT NOT NULL,
  seq INTEGER NOT NULL,
  -- base64url(iv ‖ szyfrogram AES-GCM)
  blob TEXT NOT NULL,
  PRIMARY KEY (space, uid)
);

CREATE INDEX IF NOT EXISTS records_by_seq ON records (space, seq);

-- Zaproszenia: jednorazowe, ważne 24 h. `lookup` to identyfikator wyprowadzony
-- z 8-cyfrowego kodu; sam kod ani klucz kalendarza tu nie trafiają.
CREATE TABLE IF NOT EXISTS invites (
  lookup TEXT PRIMARY KEY,
  space TEXT NOT NULL,
  blob TEXT NOT NULL,
  expires INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS invites_by_space ON invites (space);

-- Licznik prób odebrania zaproszenia z jednego adresu w danej godzinie —
-- żeby kodu nie dało się odgadnąć, sprawdzając kolejne liczby.
CREATE TABLE IF NOT EXISTS invite_attempts (
  ip TEXT NOT NULL,
  hour INTEGER NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (ip, hour)
);

-- Sugestie z aplikacji: imię i treść wpisane przez użytkownika. Jedyne dane
-- na serwerze, które nie są szyfrowane — pobiera je właściciel serwera.
CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created INTEGER NOT NULL,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  version TEXT,
  screen TEXT
);

-- Rozmowy o sugestiach. Telefon przy wysłaniu sugestii losuje klucz rozmowy
-- i trzyma go u siebie; tu leży tylko jego skrót SHA-256. Kto zna klucz, ten
-- czyta odpowiedzi i dopisuje wiadomości. Starsze sugestie nie mają rozmowy.
CREATE TABLE IF NOT EXISTS suggestion_threads (
  suggestion_id INTEGER PRIMARY KEY,
  key_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS suggestion_threads_by_key ON suggestion_threads (key_hash);

-- Wiadomości w rozmowie: 'autor' — osoba, która zgłosiła sugestię (z aplikacji),
-- 'wlasciciel' — odpowiedź właściciela (wpisywana wranglerem z Planer uwagi).
-- Tak jak sugestie: niezaszyfrowane.
CREATE TABLE IF NOT EXISTS suggestion_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  suggestion_id INTEGER NOT NULL,
  created INTEGER NOT NULL,
  author TEXT NOT NULL CHECK (author IN ('autor', 'wlasciciel')),
  text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS suggestion_messages_by_suggestion ON suggestion_messages (suggestion_id, id);
