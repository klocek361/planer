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
