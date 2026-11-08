/**
 * Szyfrowanie wspólnych kalendarzy.
 *
 * Każdy kalendarz ma losowy klucz (32 bajty), który zostaje na telefonach
 * członków. Z klucza wyprowadzamy (HKDF) dwie niezależne rzeczy:
 * - klucz AES-GCM, którym szyfrujemy każdy rekord — serwer go nie zna,
 * - token zapisu, który serwer sprawdza — żeby sama znajomość id kalendarza
 *   nie pozwalała niczego czytać ani zapisywać.
 * Klucz trafia do nowej osoby w zaproszeniu, zaszyfrowanym 8-cyfrowym kodem.
 */

const KEY_BYTES = 32;
const ID_BYTES = 16;
const IV_BYTES = 12;

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomId(bytes = ID_BYTES): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export interface SpaceSecret {
  spaceId: string;
  key: string;
}

export function newSpaceSecret(): SpaceSecret {
  return { spaceId: randomId(ID_BYTES), key: randomId(KEY_BYTES) };
}

/** Długość kodu zaproszenia. */
export const INVITE_DIGITS = 8;

/** Losowy kod z 8 cyfr — równomiernie, bez przewagi niższych liczb. */
export function newInviteCode(): string {
  const limit = 10 ** INVITE_DIGITS;
  const ceiling = Math.floor(0x1_0000_0000 / limit) * limit;
  for (;;) {
    const [value] = crypto.getRandomValues(new Uint32Array(1));
    if (value! < ceiling) return String(value! % limit).padStart(INVITE_DIGITS, '0');
  }
}

/** Zostawia same cyfry — kod da się wkleić razem ze spacjami czy myślnikami. */
export function normalizeInviteCode(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  return digits.length === INVITE_DIGITS ? digits : null;
}

const INVITE_SALT = new TextEncoder().encode('planer-kaskowy-zaproszenie');
const INVITE_ITERATIONS = 300_000;

/**
 * Z kodu wyprowadzamy (PBKDF2, celowo powoli) dwie rzeczy: identyfikator, pod
 * którym serwer trzyma zaproszenie, i klucz, którym jest ono zaszyfrowane.
 * Serwer zna tylko identyfikator, a powolne wyprowadzanie utrudnia mu
 * odgadnięcie kodu przez sprawdzanie wszystkich 100 milionów możliwości.
 */
export async function inviteMaterial(code: string): Promise<{ lookup: string; key: CryptoKey }> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: INVITE_SALT, iterations: INVITE_ITERATIONS },
      base,
      512,
    ),
  );
  const key = await crypto.subtle.importKey('raw', bits.slice(32), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
  return { lookup: toBase64Url(bits.slice(0, 32)), key };
}

async function hkdfBase(key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64Url(key), 'HKDF', false, ['deriveKey', 'deriveBits']);
}

const SALT = new TextEncoder().encode('planer-kaskowy-wspolny-kalendarz');

/** Token zapisu dla serwera — wyprowadzony, nie sam klucz. */
export async function deriveToken(key: string): Promise<string> {
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: SALT, info: new TextEncoder().encode('token') },
    await hkdfBase(key),
    256,
  );
  return toBase64Url(new Uint8Array(bits));
}

export async function deriveCipherKey(key: string): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: SALT, info: new TextEncoder().encode('szyfr') },
    await hkdfBase(key),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Szyfruje tekst; wynik to base64url(iv ‖ szyfrogram). Każde wywołanie ma nowe iv. */
export async function encryptText(cipherKey: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cipherKey,
    new TextEncoder().encode(text),
  );
  const out = new Uint8Array(IV_BYTES + data.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(data), IV_BYTES);
  return toBase64Url(out);
}

/** Odszyfrowuje; zwraca null, gdy blok jest uszkodzony albo z innym kluczem. */
export async function decryptText(cipherKey: CryptoKey, blob: string): Promise<string | null> {
  try {
    const bytes = fromBase64Url(blob);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) },
      cipherKey,
      bytes.slice(IV_BYTES),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
