import {
  SyncError,
  type PullResult,
  type SyncErrorCode,
  type SyncTransport,
} from '../sync/transport';

/**
 * Połączenie z serwerem wspólnego kalendarza przez HTTP — jedyne miejsce
 * w aplikacji, które wysyła coś do sieci. Adres serwera przychodzi z budowania
 * (`VITE_SYNC_URL`); bez niego wspólny kalendarz jest po prostu niedostępny.
 */

export const SYNC_URL: string = (import.meta.env?.VITE_SYNC_URL as string | undefined) ?? '';

export const syncAvailable = (): boolean => SYNC_URL.length > 0;

function codeFor(status: number): SyncErrorCode {
  if (status === 404) return 'brak-przestrzeni';
  if (status === 401 || status === 403 || status === 409) return 'odmowa';
  if (status === 413 || status === 429) return 'limit';
  return 'serwer';
}

export function httpTransport(baseUrl: string = SYNC_URL): SyncTransport {
  const base = baseUrl.replace(/\/+$/, '');

  async function call(
    method: string,
    path: string,
    token: string | null,
    body?: unknown,
    notFound: SyncErrorCode = 'brak-przestrzeni',
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
      });
    } catch {
      throw new SyncError('siec');
    }
    if (!response.ok) {
      throw new SyncError(response.status === 404 ? notFound : codeFor(response.status));
    }
    const text = await response.text();
    return text ? (JSON.parse(text) as unknown) : null;
  }

  return {
    async create(spaceId, token) {
      await call('POST', `/s/${spaceId}`, token);
    },
    async push(spaceId, token, records) {
      await call('PUT', `/s/${spaceId}/r`, token, { records });
    },
    async pull(spaceId, token, since) {
      const data = (await call('GET', `/s/${spaceId}/zmiany?od=${since}`, token)) as PullResult | null;
      if (!data || !Array.isArray(data.records)) throw new SyncError('serwer');
      return data;
    },
    async close(spaceId, token) {
      await call('DELETE', `/s/${spaceId}`, token);
    },
    async putInvite(spaceId, token, lookup, blob) {
      const data = (await call('PUT', `/s/${spaceId}/zaproszenie`, token, { lookup, blob })) as {
        expires?: number;
      } | null;
      if (typeof data?.expires !== 'number') throw new SyncError('serwer');
      return data.expires;
    },
    async deleteInvite(spaceId, token) {
      await call('DELETE', `/s/${spaceId}/zaproszenie`, token);
    },
    async takeInvite(lookup) {
      const data = (await call('POST', `/z/${lookup}`, null, undefined, 'zly-kod')) as {
        blob?: string;
      } | null;
      if (typeof data?.blob !== 'string') throw new SyncError('zly-kod');
      return data.blob;
    },
  };
}

/** Wysyła sugestię na serwer. Bez tokenu — serwer ogranicza liczbę wiadomości. */
export async function sendSuggestion(suggestion: {
  name: string;
  text: string;
  version: string;
  screen: string;
}): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${SYNC_URL.replace(/\/+$/, '')}/sugestie`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(suggestion),
      cache: 'no-store',
    });
  } catch {
    throw new SyncError('siec');
  }
  if (!response.ok) throw new SyncError(codeFor(response.status));
}
