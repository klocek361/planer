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
 * Każde zapytanie: nagłówek `Authorization: Bearer <token>`.
 */

interface Env {
  DB: D1Database;
  /** Adresy stron, które mogą rozmawiać z serwerem, po przecinku. */
  ALLOWED_ORIGINS: string;
}

const ID = /^[A-Za-z0-9_-]{22}$/;
const UID = /^[A-Za-z0-9_-]{8,64}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

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

    if (request.method === 'DELETE' && !action) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM records WHERE space = ?').bind(id),
        env.DB.prepare('DELETE FROM spaces WHERE id = ?').bind(id),
      ]);
      return reply(request, env, 200, { ok: true });
    }

    return reply(request, env, 404);
  },
};
