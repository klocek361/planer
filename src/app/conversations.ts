/**
 * Rozmowy o sugestiach. Przy pierwszej wysłanej sugestii telefon losuje
 * klucz rozmowy i trzyma go u siebie; serwer zna tylko jego skrót. Z kluczem
 * telefon pobiera odpowiedzi i dopisuje wiadomości. Klucz nie jest związany
 * z kalendarzami ani innymi danymi z telefonu.
 */

export interface ConversationMessage {
  id: number;
  created: number;
  /** 'autor' — ten telefon, 'wlasciciel' — odpowiedź autora aplikacji. */
  od: 'autor' | 'wlasciciel';
  text: string;
}

export interface Conversation {
  /** Numer sugestii na serwerze. */
  id: number;
  created: number;
  /** Treść sugestii — pierwsza wiadomość rozmowy. */
  text: string;
  wiadomosci: ConversationMessage[];
}

/** Klucz rozmowy: 32 losowe bajty w base64url (43 znaki), jak token przestrzeni. */
export function newThreadKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const isThreadKey = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

const isId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;

/** Odpowiedź serwera → rozmowy. Odrzuca wszystko, co nie ma oczekiwanego kształtu. */
export function parseConversations(data: unknown): Conversation[] {
  const list = (data as { rozmowy?: unknown } | null)?.rozmowy;
  if (!Array.isArray(list)) return [];
  const result: Conversation[] = [];
  for (const raw of list) {
    const c = raw as Record<string, unknown> | null;
    if (!c || !isId(c.id) || typeof c.text !== 'string' || typeof c.created !== 'number') continue;
    const wiadomosci: ConversationMessage[] = [];
    for (const rawMessage of Array.isArray(c.wiadomosci) ? c.wiadomosci : []) {
      const m = rawMessage as Record<string, unknown> | null;
      if (!m || !isId(m.id) || typeof m.text !== 'string' || typeof m.created !== 'number') continue;
      if (m.od !== 'autor' && m.od !== 'wlasciciel') continue;
      wiadomosci.push({ id: m.id, created: m.created, od: m.od, text: m.text });
    }
    wiadomosci.sort((a, b) => a.id - b.id);
    result.push({ id: c.id, created: c.created, text: c.text, wiadomosci });
  }
  // Najnowsza aktywność na górze.
  const last = (c: Conversation) => c.wiadomosci.at(-1)?.created ?? c.created;
  return result.sort((a, b) => last(b) - last(a));
}

/** Numer najnowszej odpowiedzi autora aplikacji; 0, gdy jeszcze żadnej nie ma. */
export function lastReplyId(conversations: Conversation[]): number {
  let max = 0;
  for (const c of conversations) {
    for (const m of c.wiadomosci) if (m.od === 'wlasciciel' && m.id > max) max = m.id;
  }
  return max;
}

/** Czy jest odpowiedź nowsza niż ostatnio przeczytana. */
export const hasUnreadReply = (conversations: Conversation[], lastSeen: number): boolean =>
  lastReplyId(conversations) > lastSeen;
