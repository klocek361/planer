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
