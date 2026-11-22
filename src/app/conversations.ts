/**
 * Rozmowy o sugestiach. Przy pierwszej wysłanej sugestii telefon losuje
 * klucz rozmowy i trzyma go u siebie; serwer zna tylko jego skrót. Z kluczem
 * telefon pobiera odpowiedzi i dopisuje wiadomości. Klucz nie jest związany
 * z kalendarzami ani innymi danymi z telefonu.
 */

/** Zdjęcie w rozmowie. `przeniesione` — autor aplikacji je przyjął i nie ma go już na serwerze. */
export interface ConversationPhoto {
  id: number;
  przeniesione: boolean;
}

export interface ConversationMessage {
  id: number;
  created: number;
  /** 'autor' — ten telefon, 'wlasciciel' — odpowiedź autora aplikacji. */
  od: 'autor' | 'wlasciciel';
  text: string;
  zdjecia: ConversationPhoto[];
}

export interface Conversation {
  /** Numer sugestii na serwerze. */
  id: number;
  created: number;
  /** Treść sugestii — pierwsza wiadomość rozmowy. */
  text: string;
  /** Zdjęcia dołączone do samej sugestii. */
  zdjecia: ConversationPhoto[];
  wiadomosci: ConversationMessage[];
}

/** Najwyżej tyle zdjęć przy jednej wiadomości (tak samo pilnuje serwer). */
export const MAX_PHOTOS = 3;

function parsePhotos(value: unknown): ConversationPhoto[] {
  if (!Array.isArray(value)) return [];
  const photos: ConversationPhoto[] = [];
  for (const raw of value) {
    const p = raw as Record<string, unknown> | null;
    if (p && isId(p.id)) photos.push({ id: p.id, przeniesione: p.przeniesione === true });
  }
  return photos;
}

/** Klucz rozmowy: 32 losowe bajty w base64url (43 znaki), jak token przestrzeni. */
export function newThreadKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const isId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;

export const isThreadKey = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

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
      wiadomosci.push({ id: m.id, created: m.created, od: m.od, text: m.text, zdjecia: parsePhotos(m.zdjecia) });
    }
    wiadomosci.sort((a, b) => a.id - b.id);
    result.push({ id: c.id, created: c.created, text: c.text, zdjecia: parsePhotos(c.zdjecia), wiadomosci });
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

/**
 * Archiwum rozmów — tylko na tym telefonie, serwer o nim nie wie. Numer sugestii →
 * numer ostatniej wiadomości w chwili schowania. Rozmowa wraca sama, gdy autor
 * aplikacji odpowie później (nowa odpowiedź ma być widoczna).
 */
export type ConversationArchive = Record<string, number>;

/** Zapis z pamięci telefonu → archiwum; wszystko, co nie pasuje, pomija. */
export function parseArchive(text: string): ConversationArchive {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {};
  }
  const archive: ConversationArchive = {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) return archive;
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (/^[1-9]\d*$/.test(key) && Number.isSafeInteger(value) && (value as number) >= 0) {
      archive[key] = value as number;
    }
  }
  return archive;
}

const lastMessageId = (c: Conversation): number => c.wiadomosci.reduce((max, m) => Math.max(max, m.id), 0);

export function isArchived(c: Conversation, archive: ConversationArchive): boolean {
  const mark = archive[String(c.id)];
  if (mark === undefined) return false;
  return !c.wiadomosci.some((m) => m.od === 'wlasciciel' && m.id > mark);
}

/** Chowa rozmowę albo ją przywraca. Zwraca nowe archiwum (stare zostaje bez zmian). */
export function setArchived(archive: ConversationArchive, c: Conversation, archived: boolean): ConversationArchive {
  const next = { ...archive };
  if (archived) next[String(c.id)] = lastMessageId(c);
  else delete next[String(c.id)];
  return next;
}
