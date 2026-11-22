/**
 * Serwer wspólnego kalendarza Planera — Cloudflare Worker + baza D1.
 *
 * Działa jak skrzynka pocztowa z zamkniętymi pudełkami: przechowuje
 * zaszyfrowane rekordy i oddaje je tym, którzy znają id przestrzeni i token.
 * Nie zna klucza szyfrującego (zostaje w linku po `#`), więc nie umie odczytać
 * żadnego wydarzenia. Nie ma kont ani logowania.
 *
 * API:
 *   POST   /s/:id           — załóż przestrzeń (zapamiętuje skrót tokenu)
 *   PUT    /s/:id/r         — zapisz rekordy { records: [{ uid, blob }] }
 *   GET    /s/:id/zmiany?od=N — zmiany o numerze większym niż N
 *   DELETE /s/:id           — zamknij przestrzeń i skasuj jej dane
 *   PUT    /s/:id/zaproszenie — wystaw zaproszenie { lookup, blob } (24 h, zastępuje poprzednie)
 *   DELETE /s/:id/zaproszenie — unieważnij zaproszenie
 *   POST   /z/:lookup       — odbierz zaproszenie (raz; bez tokenu, z limitem prób)
 *   POST   /sugestie        — zapisz sugestię { name, text, version?, screen?, klucz? } (bez tokenu, z limitem)
 *   POST   /sugestie/rozmowy — rozmowy o sugestiach wysłanych z danym kluczem { klucz }
 *   POST   /sugestie/:nr/wiadomosc — dopisz wiadomość do rozmowy { klucz, text, zdjecia? } (z limitem)
 *   POST   /sugestie/zdjecie/:id — zdjęcie z rozmowy { klucz } → { typ, dane } (base64)
 * Zdjęcia (`zdjecia`: do 3 JPEG-ów / PNG-ów w base64, każde ≤ 1 MB) tylko z kluczem rozmowy.
 * Zapytania o przestrzeń: nagłówek `Authorization: Bearer <token>`.
 */

interface Env {
  DB: D1Database;
  /** Adresy stron, które mogą rozmawiać z serwerem, po przecinku. */
  ALLOWED_ORIGINS: string;
}

const ID = /^[A-Za-z0-9_-]{22}$/;
const UID = /^[A-Za-z0-9_-]{8,64}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

const LOOKUP = /^[A-Za-z0-9_-]{43}$/;
const INVITE_TTL = 24 * 60 * 60 * 1000;
/** Ile prób odebrania zaproszenia na godzinę z jednego adresu. */
const MAX_ATTEMPTS_PER_HOUR = 30;

/** Ile sugestii na godzinę z jednego adresu. */
const MAX_SUGGESTIONS_PER_HOUR = 10;
const MAX_NAME = 60;
const MAX_TEXT = 4000;
/** Ile wiadomości w rozmowach na godzinę z jednego adresu. */
const MAX_MESSAGES_PER_HOUR = 30;
/** Ile wiadomości może mieć jedna rozmowa. */
const MAX_THREAD = 200;
/** Klucz rozmowy: 32 losowe bajty w base64url — jak token przestrzeni. */
const THREAD_KEY = TOKEN;
/** Zdjęcia: najwyżej tyle przy jednej wiadomości, każde najwyżej tyle bajtów. */
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 1_000_000;

type Photo = { bytes: Uint8Array; type: 'image/jpeg' | 'image/png' };

/** Typ obrazu po pierwszych bajtach (nie po deklaracji telefonu); null — ani JPEG, ani PNG. */
function photoType(b: Uint8Array): Photo['type'] | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return png.every((v, i) => b[i] === v) ? 'image/png' : null;
}

/**
 * Zdjęcia z JSON-a → bajty. undefined → brak zdjęć; null → coś nie tak
 * (za dużo, za duże, nie base64, ani JPEG, ani PNG). Telefon zapisuje każde
 * zdjęcie od nowa przez płótno, więc inne formaty nie mają skąd się wziąć.
 */
function decodePhotos(value: unknown): Photo[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_PHOTOS) return null;
  const photos: Photo[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 4) return null;
    let binary: string;
    try {
      binary = atob(item);
    } catch {
      return null;
    }
    if (binary.length === 0 || binary.length > MAX_PHOTO_BYTES) return null;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const type = photoType(bytes);
    if (!type) return null;
    photos.push({ bytes, type });
  }
  return photos;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function photoInserts(env: Env, suggestionId: number, messageId: number | null, photos: Photo[]) {
  const now = Date.now();
  return photos.map(({ bytes, type }) =>
    env.DB.prepare(
      'INSERT INTO suggestion_photos (suggestion_id, message_id, created, type, data) VALUES (?, ?, ?, ?, ?)',
    ).bind(
      suggestionId,
      messageId,
      now,
      type,
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ),
  );
}

const MAX_BLOB = 16_000;
const MAX_BATCH = 100;
const MAX_RECORDS = 5_000;
const PAGE = 500;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Porównanie bez zdradzania czasem, na którym znaku się rozjechało. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  if (!allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function reply(request: Request, env: Env, status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function bearer(request: Request): string | null {
  const value = request.headers.get('Authorization') ?? '';
  const token = value.startsWith('Bearer ') ? value.slice(7) : '';
  return TOKEN.test(token) ? token : null;
}

/** Liczy zapytania z adresu w bieżącej godzinie; true — limit przekroczony. */
async function overLimit(env: Env, request: Request, prefix: string, max: number): Promise<boolean> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'nieznany';
  const hour = Math.floor(Date.now() / 3_600_000);
  const row = await env.DB.prepare(
    `INSERT INTO invite_attempts (ip, hour, n) VALUES (?, ?, 1)
     ON CONFLICT (ip, hour) DO UPDATE SET n = n + 1 RETURNING n`,
  )
    .bind(`${prefix}:${ip}`, hour)
    .first<{ n: number }>();
  return (row?.n ?? 0) > max;
}

/** Sprawdza token przestrzeni. Zwraca kod błędu albo null, gdy wszystko gra. */
async function authorize(env: Env, id: string, token: string): Promise<number | null> {
  const row = await env.DB.prepare('SELECT token_hash FROM spaces WHERE id = ?')
    .bind(id)
    .first<{ token_hash: string }>();
  if (!row) return 404;
  return sameText(row.token_hash, await sha256(token)) ? null : 403;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    // Odbiór zaproszenia — jedyne zapytanie bez tokenu. Zaproszenie jest
    // oddawane raz i od razu kasowane; nieudane próby są liczone.
    if (request.method === 'POST' && parts[0] === 'z' && parts.length === 2) {
      const lookup = parts[1]!;
      if (!LOOKUP.test(lookup)) return reply(request, env, 404);

      const ip = request.headers.get('CF-Connecting-IP') ?? 'nieznany';
      const hour = Math.floor(Date.now() / 3_600_000);
      const attempts = await env.DB.prepare(
        `INSERT INTO invite_attempts (ip, hour, n) VALUES (?, ?, 1)
         ON CONFLICT (ip, hour) DO UPDATE SET n = n + 1 RETURNING n`,
      )
        .bind(ip, hour)
        .first<{ n: number }>();
      if ((attempts?.n ?? 0) > MAX_ATTEMPTS_PER_HOUR) return reply(request, env, 429);

      const invite = await env.DB.prepare(
        'DELETE FROM invites WHERE lookup = ? AND expires > ? RETURNING blob',
      )
        .bind(lookup, Date.now())
        .first<{ blob: string }>();
      // Przy okazji sprzątamy wygasłe zaproszenia i stare liczniki.
      await env.DB.batch([
        env.DB.prepare('DELETE FROM invites WHERE expires <= ?').bind(Date.now()),
        env.DB.prepare('DELETE FROM invite_attempts WHERE hour < ?').bind(hour - 24),
      ]);
      return invite ? reply(request, env, 200, { blob: invite.blob }) : reply(request, env, 404);
    }

    // Sugestia z aplikacji — bez tokenu, z limitem na adres.
    if (request.method === 'POST' && parts[0] === 'sugestie' && parts.length === 1) {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      const text = typeof body?.text === 'string' ? body.text.trim() : '';
      if (!name || !text || name.length > MAX_NAME || text.length > MAX_TEXT) {
        return reply(request, env, 400);
      }
      // Klucz rozmowy jest opcjonalny — starsze wersje aplikacji go nie wysyłają.
      const key = body?.klucz;
      if (key !== undefined && (typeof key !== 'string' || !THREAD_KEY.test(key))) {
        return reply(request, env, 400);
      }
      const photos = decodePhotos(body?.zdjecia);
      if (!photos || (photos.length > 0 && typeof key !== 'string')) return reply(request, env, 400);
      if (await overLimit(env, request, 'sugestie', MAX_SUGGESTIONS_PER_HOUR)) return reply(request, env, 429);

      const short = (value: unknown) => (typeof value === 'string' ? value.slice(0, 40) : null);
      const row = await env.DB.prepare(
        'INSERT INTO suggestions (created, name, text, version, screen) VALUES (?, ?, ?, ?, ?) RETURNING id',
      )
        .bind(Date.now(), name, text, short(body?.version), short(body?.screen))
        .first<{ id: number }>();
      if (row && typeof key === 'string') {
        await env.DB.batch([
          env.DB.prepare('INSERT INTO suggestion_threads (suggestion_id, key_hash) VALUES (?, ?)').bind(
            row.id,
            await sha256(key),
          ),
          ...photoInserts(env, row.id, null, photos),
        ]);
      }
      return reply(request, env, 201, { ok: true, ...(row && typeof key === 'string' ? { id: row.id } : {}) });
    }

    // Rozmowy o sugestiach wysłanych z tego telefonu (po kluczu rozmowy).
    if (request.method === 'POST' && parts[0] === 'sugestie' && parts[1] === 'rozmowy' && parts.length === 2) {
      const body = (await request.json().catch(() => null)) as { klucz?: unknown } | null;
      if (typeof body?.klucz !== 'string' || !THREAD_KEY.test(body.klucz)) return reply(request, env, 400);
      const hash = await sha256(body.klucz);
      const [suggestions, messages, photos] = await env.DB.batch([
        env.DB.prepare(
          `SELECT s.id, s.created, s.text FROM suggestions s
           JOIN suggestion_threads t ON t.suggestion_id = s.id
           WHERE t.key_hash = ? ORDER BY s.id`,
        ).bind(hash),
        env.DB.prepare(
          `SELECT m.id, m.suggestion_id, m.created, m.author, m.text FROM suggestion_messages m
           JOIN suggestion_threads t ON t.suggestion_id = m.suggestion_id
           WHERE t.key_hash = ? ORDER BY m.id`,
        ).bind(hash),
        env.DB.prepare(
          `SELECT p.id, p.suggestion_id, p.message_id, p.data IS NULL AS moved FROM suggestion_photos p
           JOIN suggestion_threads t ON t.suggestion_id = p.suggestion_id
           WHERE t.key_hash = ? ORDER BY p.id`,
        ).bind(hash),
      ]);
      type Photo = { id: number; suggestion_id: number; message_id: number | null; moved: number };
      const photosOf = new Map<string, { id: number; przeniesione: boolean }[]>();
      for (const p of (photos?.results ?? []) as Photo[]) {
        const key = p.message_id === null ? `s${p.suggestion_id}` : `m${p.message_id}`;
        photosOf.set(key, [...(photosOf.get(key) ?? []), { id: p.id, przeniesione: Boolean(p.moved) }]);
      }
      type Msg = { id: number; suggestion_id: number; created: number; author: string; text: string };
      type Out = { id: number; created: number; od: string; text: string; zdjecia: { id: number; przeniesione: boolean }[] };
      const bySuggestion = new Map<number, Out[]>();
      for (const m of (messages?.results ?? []) as Msg[]) {
        const list = bySuggestion.get(m.suggestion_id) ?? [];
        list.push({ id: m.id, created: m.created, od: m.author, text: m.text, zdjecia: photosOf.get(`m${m.id}`) ?? [] });
        bySuggestion.set(m.suggestion_id, list);
      }
      const rozmowy = ((suggestions?.results ?? []) as { id: number; created: number; text: string }[]).map(
        (s) => ({
          id: s.id,
          created: s.created,
          text: s.text,
          zdjecia: photosOf.get(`s${s.id}`) ?? [],
          wiadomosci: bySuggestion.get(s.id) ?? [],
        }),
      );
      return reply(request, env, 200, { rozmowy });
    }

    // Wiadomość od autora sugestii — tylko z kluczem tej rozmowy.
    if (request.method === 'POST' && parts[0] === 'sugestie' && parts[2] === 'wiadomosc' && parts.length === 3) {
      const nr = Number(parts[1]);
      if (!Number.isSafeInteger(nr) || nr <= 0) return reply(request, env, 404);
      const body = (await request.json().catch(() => null)) as {
        klucz?: unknown;
        text?: unknown;
        zdjecia?: unknown;
      } | null;
      const text = typeof body?.text === 'string' ? body.text.trim() : '';
      const photos = decodePhotos(body?.zdjecia);
      if (
        typeof body?.klucz !== 'string' ||
        !THREAD_KEY.test(body.klucz) ||
        !photos ||
        (!text && photos.length === 0) ||
        text.length > MAX_TEXT
      ) {
        return reply(request, env, 400);
      }
      const thread = await env.DB.prepare('SELECT key_hash FROM suggestion_threads WHERE suggestion_id = ?')
        .bind(nr)
        .first<{ key_hash: string }>();
      if (!thread || !sameText(thread.key_hash, await sha256(body.klucz))) return reply(request, env, 404);
      if (await overLimit(env, request, 'czat', MAX_MESSAGES_PER_HOUR)) return reply(request, env, 429);
      const count = await env.DB.prepare('SELECT count(*) AS n FROM suggestion_messages WHERE suggestion_id = ?')
        .bind(nr)
        .first<{ n: number }>();
      if ((count?.n ?? 0) >= MAX_THREAD) return reply(request, env, 429);
      const message = await env.DB.prepare(
        "INSERT INTO suggestion_messages (suggestion_id, created, author, text) VALUES (?, ?, 'autor', ?) RETURNING id",
      )
        .bind(nr, Date.now(), text)
        .first<{ id: number }>();
      if (message && photos.length) await env.DB.batch(photoInserts(env, nr, message.id, photos));
      return reply(request, env, 201, { ok: true });
    }

    // Zdjęcie z rozmowy — tylko z kluczem rozmowy, do której należy.
    if (request.method === 'POST' && parts[0] === 'sugestie' && parts[1] === 'zdjecie' && parts.length === 3) {
      const photoId = Number(parts[2]);
      if (!Number.isSafeInteger(photoId) || photoId <= 0) return reply(request, env, 404);
      const body = (await request.json().catch(() => null)) as { klucz?: unknown } | null;
      if (typeof body?.klucz !== 'string' || !THREAD_KEY.test(body.klucz)) return reply(request, env, 400);
      const photo = await env.DB.prepare(
        `SELECT p.data, p.type, t.key_hash FROM suggestion_photos p
         JOIN suggestion_threads t ON t.suggestion_id = p.suggestion_id WHERE p.id = ?`,
      )
        .bind(photoId)
        .first<{ data: ArrayBuffer | number[] | null; type: string; key_hash: string }>();
      if (!photo || !sameText(photo.key_hash, await sha256(body.klucz))) return reply(request, env, 404);
      if (photo.data === null) return reply(request, env, 410);
      const bytes = photo.data instanceof ArrayBuffer ? new Uint8Array(photo.data) : Uint8Array.from(photo.data);
      return reply(request, env, 200, { typ: photo.type, dane: toBase64(bytes) });
    }

    if (parts[0] !== 's' || !parts[1] || !ID.test(parts[1])) return reply(request, env, 404);
    const id = parts[1];
    const action = parts[2];

    const token = bearer(request);
    if (!token) return reply(request, env, 401);

    // Założenie przestrzeni. Powtórka z tym samym tokenem nic nie psuje.
    if (request.method === 'POST' && !action) {
      const hash = await sha256(token);
      const existing = await env.DB.prepare('SELECT token_hash FROM spaces WHERE id = ?')
        .bind(id)
        .first<{ token_hash: string }>();
      if (existing) {
        return reply(request, env, sameText(existing.token_hash, hash) ? 200 : 409);
      }
      await env.DB.prepare('INSERT INTO spaces (id, token_hash, seq, created) VALUES (?, ?, 0, ?)')
        .bind(id, hash, Date.now())
        .run();
      return reply(request, env, 201);
    }

    const denied = await authorize(env, id, token);
    if (denied) return reply(request, env, denied);

    if (request.method === 'PUT' && action === 'r') {
      const body = (await request.json().catch(() => null)) as {
        records?: { uid?: unknown; blob?: unknown }[];
      } | null;
      const records = body?.records;
      if (!Array.isArray(records) || records.length === 0 || records.length > MAX_BATCH) {
        return reply(request, env, 400);
      }
      for (const r of records) {
        if (typeof r.uid !== 'string' || !UID.test(r.uid)) return reply(request, env, 400);
        if (typeof r.blob !== 'string' || r.blob.length === 0 || r.blob.length > MAX_BLOB) {
          return reply(request, env, 413);
        }
      }

      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM records WHERE space = ?')
        .bind(id)
        .first<{ n: number }>();
      if ((count?.n ?? 0) + records.length > MAX_RECORDS) return reply(request, env, 429);

      // Każdy rekord dostaje kolejny numer przestrzeni. D1 wykonuje paczkę
      // w jednej transakcji, po kolei — numery nie mogą się powtórzyć.
      const statements = records.flatMap((r) => [
        env.DB.prepare(
          `INSERT INTO records (space, uid, seq, blob)
           VALUES (?1, ?2, (SELECT seq + 1 FROM spaces WHERE id = ?1), ?3)
           ON CONFLICT (space, uid) DO UPDATE SET seq = excluded.seq, blob = excluded.blob`,
        ).bind(id, r.uid, r.blob),
        env.DB.prepare('UPDATE spaces SET seq = seq + 1 WHERE id = ?').bind(id),
      ]);
      await env.DB.batch(statements);
      return reply(request, env, 200, { ok: true });
    }

    if (request.method === 'GET' && action === 'zmiany') {
      const since = Number(url.searchParams.get('od') ?? '0');
      if (!Number.isSafeInteger(since) || since < 0) return reply(request, env, 400);
      const { results } = await env.DB.prepare(
        'SELECT uid, seq, blob FROM records WHERE space = ? AND seq > ? ORDER BY seq LIMIT ?',
      )
        .bind(id, since, PAGE + 1)
        .all<{ uid: string; seq: number; blob: string }>();
      const page = results.slice(0, PAGE);
      return reply(request, env, 200, {
        records: page,
        seq: page.at(-1)?.seq ?? since,
        more: results.length > PAGE,
      });
    }

    if (action === 'zaproszenie' && request.method === 'PUT') {
      const body = (await request.json().catch(() => null)) as {
        lookup?: unknown;
        blob?: unknown;
      } | null;
      if (typeof body?.lookup !== 'string' || !LOOKUP.test(body.lookup)) return reply(request, env, 400);
      if (typeof body.blob !== 'string' || body.blob.length === 0 || body.blob.length > MAX_BLOB) {
        return reply(request, env, 400);
      }
      const expires = Date.now() + INVITE_TTL;
      // Jedno aktywne zaproszenie na przestrzeń — nowe unieważnia poprzednie.
      await env.DB.batch([
        env.DB.prepare('DELETE FROM invites WHERE space = ?').bind(id),
        env.DB.prepare(
          'INSERT OR REPLACE INTO invites (lookup, space, blob, expires) VALUES (?, ?, ?, ?)',
        ).bind(body.lookup, id, body.blob, expires),
      ]);
      return reply(request, env, 200, { expires });
    }

    if (action === 'zaproszenie' && request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM invites WHERE space = ?').bind(id).run();
      return reply(request, env, 200, { ok: true });
    }

    if (request.method === 'DELETE' && !action) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM invites WHERE space = ?').bind(id),
        env.DB.prepare('DELETE FROM records WHERE space = ?').bind(id),
        env.DB.prepare('DELETE FROM spaces WHERE id = ?').bind(id),
      ]);
      return reply(request, env, 200, { ok: true });
    }

    return reply(request, env, 404);
  },
};
