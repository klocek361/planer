import Dexie, { type Table } from 'dexie';
import { create } from 'zustand';
import { canonicalTheme } from './themeRecord';
import { fromBase64Url, toBase64Url } from '../sync/crypto';
import type { Theme } from '../theme/types';

/**
 * Tryb deweloperski: odblokowuje motyw „Serduszka” i pozwala narzucić własny
 * motyw członkom wspólnego kalendarza.
 *
 * Kodem odblokowującym jest klucz prywatny ECDSA P-256 (43 znaki base64url).
 * W kodzie aplikacji leży tylko klucz publiczny — po nim każdy telefon
 * sprawdza podpis narzuconego motywu, więc motywu nie narzuci nikt bez kodu,
 * nawet członek kalendarza z przerobioną aplikacją. Kod nie trafia do
 * repozytorium ani do kopii zapasowej; na telefonie leży jako
 * nieeksportowalny `CryptoKey` w osobnej bazie.
 */

/** Publiczna część klucza deweloperskiego (JWK, P-256). */
export const DEV_PUBLIC_KEY = {
  kty: 'EC',
  crv: 'P-256',
  x: 'lfXd4Ha-FWWOce4_l1GBH-x7XLDQs9MCC1P6R0rBlSo',
  y: '_sJ4s7febYkYgQGhTYo_iPv4YgNeb1JYKmkOe-GVQ3A',
} as const;

const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGNING = { name: 'ECDSA', hash: 'SHA-256' } as const;

/** Osobna baza — główna zostaje bez zmian wersji, a klucz nie wchodzi do kopii. */
class DevDb extends Dexie {
  klucz!: Table<{ id: 'dev'; key: CryptoKey }, string>;
  constructor() {
    super('planer-dev');
    this.version(1).stores({ klucz: 'id' });
  }
}

let devDb: DevDb | null = null;
const getDevDb = () => (devDb ??= new DevDb());

/** Klucz publiczny w użyciu — podmieniany wyłącznie w testach (`scripts/check-data.ts`). */
let publicJwk: { kty: string; crv: string; x: string; y: string } = DEV_PUBLIC_KEY;
let publicKey: Promise<CryptoKey> | null = null;
const getPublicKey = () =>
  (publicKey ??= crypto.subtle.importKey('jwk', { ...publicJwk, ext: true }, ALGORITHM, false, ['verify']));

/** Tylko dla testów: sprawdzanie podpisów innym kluczem (prawdziwy kod nie leży w repozytorium). */
export function setDevPublicKeyForTests(jwk: { x: string; y: string } | null): void {
  publicJwk = jwk ? { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y } : DEV_PUBLIC_KEY;
  publicKey = null;
}

const encoder = new TextEncoder();

/** Treść, którą podpisujemy: kalendarz, chwila i motyw — podpis nie przeniesie się do innego kalendarza. */
const signedText = (space: string, at: number, theme: string) => `planer-motyw\n${space}\n${at}\n${theme}`;

/**
 * Zamienia wpisany kod na klucz do podpisywania. Zwraca null, gdy kod nie
 * pasuje do klucza publicznego aplikacji.
 */
export async function importDevCode(code: string): Promise<CryptoKey | null> {
  const d = code.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(d)) return null;
  try {
    const key = await crypto.subtle.importKey('jwk', { ...publicJwk, d, ext: false }, ALGORITHM, false, ['sign']);
    // Klucz prywatny z innej pary też się wczyta (WebCrypto nie zawsze to
    // sprawdza), więc próbny podpis musi przejść weryfikację kluczem publicznym.
    const probe = encoder.encode('planer-dev-probe');
    const sig = await crypto.subtle.sign(SIGNING, key, probe);
    return (await crypto.subtle.verify(SIGNING, await getPublicKey(), sig, probe)) ? key : null;
  } catch {
    return null;
  }
}

/** Podpisuje motyw dla podanego kalendarza. */
export async function signTheme(
  key: CryptoKey,
  space: string,
  theme: Theme,
  at: number,
): Promise<{ theme: string; at: number; sig: string }> {
  const text = canonicalTheme(theme);
  const sig = await crypto.subtle.sign(SIGNING, key, encoder.encode(signedText(space, at, text)));
  return { theme: text, at, sig: toBase64Url(new Uint8Array(sig)) };
}

/** Czy podpis motywu pochodzi od klucza deweloperskiego. */
export async function verifyTheme(space: string, theme: string, at: number, sig: string): Promise<boolean> {
  try {
    const bytes = fromBase64Url(sig);
    return await crypto.subtle.verify(SIGNING, await getPublicKey(), bytes, encoder.encode(signedText(space, at, theme)));
  } catch {
    return false;
  }
}

// ── Stan na telefonie ─────────────────────────────────────────────────────

interface DevState {
  /** Klucz do podpisywania albo null — tryb wyłączony. */
  key: CryptoKey | null;
  loaded: boolean;
  load: () => Promise<void>;
  /** Włącza tryb kodem; false — kod nie pasuje. */
  unlock: (code: string) => Promise<boolean>;
  lock: () => Promise<void>;
}

export const useDevStore = create<DevState>()((set) => ({
  key: null,
  loaded: false,
  load: async () => {
    try {
      const row = await getDevDb().klucz.get('dev');
      set({ key: row?.key ?? null, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  unlock: async (code) => {
    const key = await importDevCode(code);
    if (!key) return false;
    await getDevDb().klucz.put({ id: 'dev', key });
    set({ key });
    return true;
  },
  lock: async () => {
    await getDevDb().klucz.delete('dev');
    set({ key: null });
  },
}));

/** Czy tryb deweloperski jest włączony na tym telefonie. */
export const useDevMode = () => useDevStore((s) => s.key !== null);
