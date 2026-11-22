import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { APP_VERSION, AUTHOR_NAME } from '../app/version';
import {
  hasUnreadReply,
  isArchived,
  isThreadKey,
  lastReplyId,
  newThreadKey,
  parseArchive,
  parseConversations,
  setArchived,
  MAX_PHOTOS,
  type Conversation,
  type ConversationArchive,
  type ConversationPhoto,
} from '../app/conversations';
import { useT } from '../i18n';
import { shortDateLabel, toKey } from '../lib/dates';
import { preparePhoto, photoPreview, type PreparedPhoto } from '../platform/photos';
import {
  fetchConversationPhoto,
  fetchConversations,
  sendConversationMessage,
  sendSuggestion,
  syncAvailable,
} from '../platform/sync';
import { SyncError } from '../sync/transport';
import { Button } from './Button';
import { Sheet } from './Sheet';

/**
 * Zgłaszanie sugestii: mały przycisk (!) w lewym górnym rogu każdego ekranu
 * otwiera panel z imieniem i treścią. Sugestia idzie na serwer wspólnego
 * kalendarza, skąd właściciel pobiera ją w Planer uwagi. Pod formularzem —
 * rozmowy o wysłanych sugestiach: odpowiedzi autora aplikacji i dopiski.
 */

/** Imię zapamiętane na tym telefonie — żeby nie wpisywać go za każdym razem. */
const NAME_KEY = 'planer-imie-sugestii';
/** Klucz rozmów tego telefonu — losowany przy pierwszej sugestii. */
const THREAD_KEY = 'planer-klucz-rozmowy';
/** Numer ostatniej przeczytanej odpowiedzi — do kropki na przycisku (!). */
const SEEN_KEY = 'planer-rozmowy-przeczytane';
/** Rozmowy schowane do archiwum — tylko na tym telefonie. */
const ARCHIVE_KEY = 'planer-rozmowy-archiwum';

/** Co ile pobierać rozmowy, gdy panel jest otwarty. */
const POLL_OPEN_MS = 30_000;
/** Po powrocie do aplikacji pobierz ponownie, jeśli minęło co najmniej tyle. */
const REFRESH_MIN_MS = 2 * 60_000;

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* pamięć przeglądarki niedostępna — trudno, przy następnym razie od nowa */
  }
}

function threadKey(): string | null {
  const key = readStorage(THREAD_KEY);
  return isThreadKey(key) ? key : null;
}

/** Klucz rozmów — istniejący albo nowy, zapisany na telefonie. */
function ensureThreadKey(): string {
  const existing = threadKey();
  if (existing) return existing;
  const key = newThreadKey();
  writeStorage(THREAD_KEY, key);
  return key;
}

const lastSeen = (): number => Number(readStorage(SEEN_KEY)) || 0;

interface FeedbackState {
  open: boolean;
  /** Ekran, z którego zgłoszono — dołączany do sugestii. */
  screen: string;
  conversations: Conversation[];
  unread: boolean;
  fetchedAt: number;
  show: () => void;
  hide: () => void;
  setScreen: (screen: string) => void;
}

export const useFeedbackStore = create<FeedbackState>()((set) => ({
  open: false,
  screen: '',
  conversations: [],
  unread: false,
  fetchedAt: 0,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  setScreen: (screen) => set({ screen }),
}));

/** Pobiera rozmowy, jeśli ten telefon wysłał kiedyś sugestię. Błędy sieci po cichu. */
async function refreshConversations(): Promise<void> {
  const key = threadKey();
  if (!key || !syncAvailable()) return;
  try {
    const conversations = parseConversations(await fetchConversations(key));
    const { open } = useFeedbackStore.getState();
    // Otwarty panel = odpowiedzi widać, więc są przeczytane.
    if (open) writeStorage(SEEN_KEY, String(lastReplyId(conversations)));
    useFeedbackStore.setState({
      conversations,
      unread: !open && hasUnreadReply(conversations, lastSeen()),
      fetchedAt: Date.now(),
    });
  } catch {
    /* bez internetu — spróbujemy następnym razem */
  }
}

function markRead(): void {
  const { conversations } = useFeedbackStore.getState();
  writeStorage(SEEN_KEY, String(Math.max(lastSeen(), lastReplyId(conversations))));
  useFeedbackStore.setState({ unread: false });
}

/** Przycisk (!) — bez serwera nie ma dokąd wysłać, więc wtedy go nie ma. Kropka = nowa odpowiedź. */
export function FeedbackButton() {
  const { t } = useT();
  const show = useFeedbackStore((state) => state.show);
  const unread = useFeedbackStore((state) => state.unread);
  if (!syncAvailable()) return null;
  return (
    <button
      type="button"
      onClick={show}
      aria-label={unread ? `${t.sugestie.przycisk} — ${t.sugestie.nowaOdpowiedz}` : t.sugestie.przycisk}
      className="border-line text-muted active:text-ink relative flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold"
    >
      !
      {unread && (
        <span className="bg-accent absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full" aria-hidden="true" />
      )}
    </button>
  );
}

/** Panel sugestii — jeden w całej aplikacji, otwierany z dowolnego ekranu. */
export function FeedbackSheet() {
  const { t } = useT();
  const { open, screen, hide, conversations, unread } = useFeedbackStore();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'wyslano' | 'blad' | 'limit' | null>(null);
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  // Gdy panel otwarto z powodu nowej odpowiedzi — rozmowy idą na górę.
  const [repliesFirst, setRepliesFirst] = useState(false);
  const [archive, setArchive] = useState<ConversationArchive>(() => parseArchive(readStorage(ARCHIVE_KEY)));
  const [showArchived, setShowArchived] = useState(false);

  const toggleArchived = (c: Conversation, archived: boolean) => {
    const next = setArchived(archive, c, archived);
    setArchive(next);
    writeStorage(ARCHIVE_KEY, JSON.stringify(next));
  };

  // Rozmowy: przy starcie, po powrocie do aplikacji, a przy otwartym panelu co chwilę.
  useEffect(() => {
    void refreshConversations();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - useFeedbackStore.getState().fetchedAt >= REFRESH_MIN_MS) void refreshConversations();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    if (!open) return;
    setName(readStorage(NAME_KEY));
    setStatus(null);
    setRepliesFirst(useFeedbackStore.getState().unread);
    markRead();
    void refreshConversations();
    const timer = window.setInterval(() => void refreshConversations(), POLL_OPEN_MS);
    return () => window.clearInterval(timer);
  }, [open]);

  // Odpowiedź, która przyszła przy otwartym panelu, jest od razu przeczytana.
  useEffect(() => {
    if (open && unread) markRead();
  }, [open, unread]);

  const ready = name.trim().length > 0 && text.trim().length > 0;

  const send = async () => {
    if (!ready) return;
    setBusy(true);
    setStatus(null);
    try {
      await sendSuggestion({
        name: name.trim(),
        text: text.trim(),
        version: APP_VERSION,
        screen,
        klucz: ensureThreadKey(),
        ...(photos.length ? { zdjecia: photos.map((p) => p.dane) } : {}),
      });
      writeStorage(NAME_KEY, name.trim());
      setText('');
      setPhotos([]);
      setStatus('wyslano');
      void refreshConversations();
    } catch (err) {
      setStatus(err instanceof SyncError && err.code === 'limit' ? 'limit' : 'blad');
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <div className="flex flex-col gap-5">
      <p className="text-muted text-sm">{t.sugestie.opis}</p>
      <label className="flex flex-col gap-2">
        <span className="text-muted text-xs font-medium">{t.sugestie.imie}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.sugestie.imiePrzyklad}
          maxLength={60}
          className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-muted text-xs font-medium">{t.sugestie.tresc}</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (status === 'wyslano') setStatus(null);
          }}
          placeholder={t.sugestie.trescPrzyklad}
          rows={5}
          maxLength={4000}
          className="bg-surface rounded-app text-ink resize-none px-3 py-2.5 text-base"
        />
      </label>
      <PhotoPicker photos={photos} onChange={setPhotos} />
      {status && (
        <p className={`text-sm ${status === 'wyslano' ? 'text-accent' : 'text-weekend'}`} role="status">
          {status === 'wyslano' ? t.sugestie.wyslano : status === 'limit' ? t.sugestie.limit : t.sugestie.blad}
        </p>
      )}
      <Button variant="primary" disabled={busy || !ready} onClick={send}>
        {t.sugestie.wyslij}
      </Button>
      <p className="text-muted text-xs">{t.sugestie.prywatnosc}</p>
    </div>
  );

  const archivedCount = conversations.filter((c) => isArchived(c, archive)).length;
  const shown = conversations.filter((c) => showArchived || !isArchived(c, archive));
  const threads =
    conversations.length > 0 ? (
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-muted text-sm">{t.sugestie.rozmowy}</h3>
          {archivedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              aria-pressed={showArchived}
              className="text-accent text-xs"
            >
              {showArchived ? t.sugestie.ukryjZarchiwizowane : t.sugestie.pokazZarchiwizowane(archivedCount)}
            </button>
          )}
        </div>
        {shown.map((c) => {
          const archived = isArchived(c, archive);
          return (
            <Thread
              key={c.id}
              conversation={c}
              archived={archived}
              onArchive={() => toggleArchived(c, !archived)}
            />
          );
        })}
      </section>
    ) : null;

  return (
    <Sheet open={open} title={t.sugestie.tytul} onClose={hide}>
      <div className="flex flex-col gap-8">
        {repliesFirst ? (
          <>
            {threads}
            {form}
          </>
        ) : (
          <>
            {form}
            {threads}
          </>
        )}
      </div>
    </Sheet>
  );
}

/** Pudełko archiwum; ze strzałką w górę, gdy rozmowa jest w archiwum (= przywróć). */
function ArchiveIcon({ restore }: { restore: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      {restore ? <path d="M12 17v-5m-2.5 2.5L12 12l2.5 2.5" /> : <path d="M10 13h4" />}
    </svg>
  );
}

/** Jedna rozmowa: sugestia, wiadomości, pole na dopisek i archiwum w rogu. */
function Thread({
  conversation,
  archived,
  onArchive,
}: {
  conversation: Conversation;
  archived: boolean;
  onArchive: () => void;
}) {
  const { t } = useT();
  const [reply, setReply] = useState('');
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'blad' | 'limit' | null>(null);
  const ready = reply.trim().length > 0 || photos.length > 0;

  const send = async () => {
    const key = threadKey();
    if (!key || !ready) return;
    setBusy(true);
    setError(null);
    try {
      await sendConversationMessage(key, conversation.id, reply.trim(), photos.map((p) => p.dane));
      setReply('');
      setPhotos([]);
      await refreshConversations();
    } catch (err) {
      setError(err instanceof SyncError && err.code === 'limit' ? 'limit' : 'blad');
    } finally {
      setBusy(false);
    }
  };

  const bubbles = [
    { id: 0, od: 'autor' as const, text: conversation.text, created: conversation.created, zdjecia: conversation.zdjecia },
    ...conversation.wiadomosci,
  ];

  return (
    <div className={`bg-surface rounded-app flex flex-col gap-2 p-3 ${archived ? 'opacity-60' : ''}`}>
      <div className="-mb-1 flex items-center justify-end gap-2">
        {archived && <span className="text-muted text-[0.6875rem]">{t.sugestie.zarchiwizowana}</span>}
        <button
          type="button"
          onClick={onArchive}
          aria-label={archived ? t.sugestie.przywroc : t.sugestie.archiwizuj}
          title={archived ? t.sugestie.przywroc : t.sugestie.archiwizuj}
          className="text-muted active:text-ink -m-1.5 p-1.5"
        >
          <ArchiveIcon restore={archived} />
        </button>
      </div>
      {bubbles.map((m) => {
        const mine = m.od === 'autor';
        return (
          <div key={m.id} className={`flex flex-col gap-0.5 ${mine ? 'items-end' : 'items-start'}`}>
            <span className="text-muted px-1 text-[0.6875rem]">
              {mine ? t.sugestie.ty : AUTHOR_NAME} · {shortDateLabel(toKey(new Date(m.created)))}
            </span>
            {m.text && (
              <p
                className={`rounded-app max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap ${
                  mine ? 'bg-selected text-selected-ink' : 'bg-bg text-ink'
                }`}
              >
                {m.text}
              </p>
            )}
            {m.zdjecia.length > 0 && <PhotoStrip photos={m.zdjecia} alignEnd={mine} />}
          </div>
        );
      })}
      {photos.length > 0 && <PhotoPicker photos={photos} onChange={setPhotos} compact />}
      <div className="flex items-end gap-2 pt-1">
        {photos.length === 0 && <PhotoPicker photos={photos} onChange={setPhotos} iconOnly />}
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={t.sugestie.dopisz}
          aria-label={t.sugestie.dopisz}
          rows={1}
          maxLength={4000}
          className="bg-bg rounded-app text-ink min-w-0 flex-1 resize-none px-3 py-2 text-base"
        />
        <Button variant="primary" className="py-2" disabled={busy || !ready} onClick={send}>
          {t.sugestie.wyslijKrotko}
        </Button>
      </div>
      {error && (
        <p className="text-weekend text-xs" role="status">
          {error === 'limit' ? t.sugestie.limit : t.sugestie.blad}
        </p>
      )}
    </div>
  );
}

/** Spinacz — dodaj zdjęcie. */
function ClipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" />
    </svg>
  );
}

/**
 * Wybór zdjęć do wiadomości (najwyżej MAX_PHOTOS): miniatury z „×” i przycisk dodania.
 * `iconOnly` — sam spinacz obok pola odpowiedzi; `compact` — same miniatury nad nim.
 */
function PhotoPicker({
  photos,
  onChange,
  iconOnly = false,
  compact = false,
}: {
  photos: PreparedPhoto[];
  onChange: (photos: PreparedPhoto[]) => void;
  iconOnly?: boolean;
  compact?: boolean;
}) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) setError(t.sugestie.zdjeciaLimit(MAX_PHOTOS));
    setBusy(true);
    const added: PreparedPhoto[] = [];
    for (const file of [...files].slice(0, Math.max(0, room))) {
      try {
        added.push(await preparePhoto(file));
      } catch {
        setError(t.sugestie.zdjecieBlad);
      }
    }
    setBusy(false);
    if (added.length) onChange([...photos, ...added]);
    if (input.current) input.current.value = '';
  };

  const picker = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(e) => void add(e.target.files)}
    />
  );
  const addButton = (
    <button
      type="button"
      onClick={() => input.current?.click()}
      disabled={busy || photos.length >= MAX_PHOTOS}
      aria-label={t.sugestie.dodajZdjecie}
      title={t.sugestie.dodajZdjecie}
      className={
        iconOnly
          ? 'text-muted active:text-ink shrink-0 p-2 disabled:opacity-40'
          : 'text-accent flex items-center gap-1.5 self-start text-sm disabled:opacity-40'
      }
    >
      <ClipIcon />
      {!iconOnly && <span>{busy ? '…' : t.sugestie.dodajZdjecie}</span>}
    </button>
  );

  if (iconOnly) {
    return (
      <>
        {picker}
        {addButton}
      </>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {picker}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative">
              <img src={photoPreview(p)} alt="" className="rounded-app h-16 w-16 object-cover" />
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                aria-label={t.sugestie.usunZdjecie}
                className="bg-ink text-bg absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs"
              >
                ×
              </button>
            </div>
          ))}
          {compact && photos.length < MAX_PHOTOS && addButton}
        </div>
      )}
      {!compact && addButton}
      {error && <p className="text-weekend text-xs">{error}</p>}
    </div>
  );
}

/** Pobrane zdjęcia z rozmów — żeby przy odświeżaniu nie ściągać ich znowu. */
const photoCache = new Map<number, string>();

/** Miniatury zdjęć z wiadomości; dotknięcie powiększa. */
function PhotoStrip({ photos, alignEnd }: { photos: ConversationPhoto[]; alignEnd: boolean }) {
  const { t } = useT();
  return (
    <div className={`flex max-w-[85%] flex-wrap gap-1.5 ${alignEnd ? 'justify-end' : ''}`}>
      {photos.map((p) =>
        p.przeniesione ? (
          <span key={p.id} className="text-muted px-1 text-[0.6875rem] italic">
            {t.sugestie.zdjeciePrzeniesione}
          </span>
        ) : (
          <RemotePhoto key={p.id} id={p.id} />
        ),
      )}
    </div>
  );
}

function RemotePhoto({ id }: { id: number }) {
  const { t } = useT();
  const [src, setSrc] = useState<string | null>(() => photoCache.get(id) ?? null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (src) return;
    const key = threadKey();
    if (!key) return;
    let alive = true;
    fetchConversationPhoto(key, id)
      .then((url) => {
        photoCache.set(id, url);
        if (alive) setSrc(url);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [id, src]);

  if (failed) return <span className="text-muted px-1 text-[0.6875rem]">{t.sugestie.zdjecieBlad}</span>;
  return (
    <>
      <button
        type="button"
        onClick={() => src && setZoom(true)}
        aria-label={t.sugestie.zdjecie}
        className="bg-bg rounded-app h-24 w-24 overflow-hidden"
      >
        {src && <img src={src} alt="" className="h-full w-full object-cover" />}
      </button>
      {zoom &&
        src &&
        createPortal(
          <button
            type="button"
            onClick={() => setZoom(false)}
            aria-label={t.wspolne.zamknij}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          >
            <img src={src} alt="" className="max-h-full max-w-full object-contain" />
          </button>,
          document.body,
        )}
    </>
  );
}
