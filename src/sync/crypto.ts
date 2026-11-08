/**
 * Szyfrowanie wspólnego kalendarza.
 *
 * Link do wspólnej przestrzeni ma postać `#dolacz=<id>.<klucz>`. Z klucza
 * wyprowadzamy (HKDF) dwie niezależne rzeczy:
 * - klucz AES-GCM, którym szyfrujemy każdy rekord — serwer go nie zna,
 * - token zapisu, który serwer sprawdza — żeby sama znajomość `id` nie
 *   pozwalała niczego czytać ani zapisywać.
 * Z tokenu nie da się odtworzyć klucza szyfrującego.
 */

const KEY_BYTES = 32;
const ID_BYTES = 16;
const IV_BYTES = 12;
const LINK_PREFIX = 'dolacz=';

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

/** Link do wysłania drugiej osobie. Sekret siedzi po `#`, więc nie trafia do serwera strony. */
export function buildJoinLink(base: string, secret: SpaceSecret): string {
  return `${base.replace(/#.*$/, '')}#${LINK_PREFIX}${secret.spaceId}.${secret.key}`;
}

const SECRET_PATTERN = /dolacz=([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})/;

/**
 * Wyciąga sekret z wklejonego tekstu. Przyjmuje cały link albo sam fragment,
 * także z doklejonym tekstem wiadomości dookoła.
 */
export function parseJoinLink(text: string): SpaceSecret | null {
  const match = SECRET_PATTERN.exec(text.trim());
  if (!match) return null;
  return { spaceId: match[1]!, key: match[2]! };
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
