import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import type { ChatMessage, ChatPhoto } from '../../data/types';
import { useT } from '../../i18n';
import { useBackDismiss } from '../../platform/back';
import type { PreparedPhoto } from '../../platform/photos';
import { httpTransport, syncAvailable } from '../../platform/sync';
import {
  buildSections,
  chatPhotoUrl,
  markChatRead,
  sendChat,
  syncChat,
  type ChatThread,
} from '../../sync/chat';
import { SyncError } from '../../sync/transport';
import { syncAndRecord } from '../../sync/useAutoSync';
import { Button } from '../../ui/Button';
import { PhotoPicker } from '../../ui/Feedback';
import { Screen } from '../../ui/Screen';
import { SettingsButton } from '../../ui/SettingsButton';
import { ChevronRightIcon } from '../../ui/icons';

/** Co ile dociągać wiadomości: przy otwartej rozmowie częściej, na liście rzadziej. */
const POLL_THREAD_MS = 5_000;
const POLL_LIST_MS = 20_000;

/** Wszystko, czego potrzebuje lista rozmów — prosto z bazy, odświeża się samo. */
function useChatData() {
  const states = useLiveQuery(() => db.syncState.toArray(), [], []);
  const categories = useLiveQuery(() => db.categories.toArray(), [], []);
  const members = useLiveQuery(() => db.members.toArray(), [], []);
  const peers = useLiveQuery(() => db.chatPeers.toArray(), [], []);
  const messages = useLiveQuery(() => db.chatMessages.toArray(), [], []);
  const reads = useLiveQuery(() => db.chatRead.toArray(), [], []);
  return useMemo(() => {
    const spaces = states.map((s) => ({
      id: s.id,
      memberId: s.memberId,
      nazwa: categories.find((c) => c.space === s.id)?.name ?? '?',
    }));
    return {
      spaces,
      members,
      sections: buildSections(
        spaces,
        members,
        new Set(peers.map((p) => p.id)),
        messages,
        new Map(reads.map((r) => [r.id, r.seq])),
      ),
      messages,
    };
  }, [states, categories, members, peers, messages, reads]);
}

/** Liczba nieprzeczytanych wiadomości ze wszystkich rozmów — do kropki na pasku. */
export function useChatUnread(): number {
  const { sections } = useChatData();
  return sections.reduce((sum, s) => sum + s.watki.reduce((n, w) => n + w.nieprzeczytane, 0), 0);
}

const time = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Zakładka Czat: lista rozmów we wspólnych kalendarzach, wejście w rozmowę. */
export function ChatScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useT();
  const { sections, members, spaces } = useChatData();
  const [open, setOpen] = useState<{ space: string; rozmowa: string } | null>(null);
  useBackDismiss(open !== null, () => setOpen(null));

  // Na liście pełna synchronizacja (nowi członkowie kalendarza + czat);
  // otwarta rozmowa ma własne, częstsze dociąganie samego czatu.
  useEffect(() => {
    if (!syncAvailable() || open) return;
    void syncAndRecord().catch(() => undefined);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void syncAndRecord().catch(() => undefined);
    }, POLL_LIST_MS);
    return () => window.clearInterval(timer);
  }, [open]);

  const thread = open
    ? sections.find((s) => s.space === open.space)?.watki.find((w) => w.rozmowa === open.rozmowa)
    : undefined;
  if (open && thread) {
    return <Conversation thread={thread} members={members} onBack={() => setOpen(null)} />;
  }

  return (
    <Screen title={t.zakladki.czat} action={<SettingsButton onClick={onOpenSettings} />}>
      {!syncAvailable() || sections.length === 0 ? (
        <p className="text-muted px-2 py-12 text-center text-sm">{t.czat.brakKalendarza}</p>
      ) : (
        <div className="flex flex-col gap-6 pt-2">
          {sections.map((section) => (
            <section key={section.space} className="flex flex-col gap-1">
              <h2 className="text-muted px-1 pb-1 text-xs font-medium tracking-wide uppercase">{section.nazwa}</h2>
              {section.watki.map((w) => (
                <ThreadRow
                  key={w.rozmowa}
                  thread={w}
                  members={members}
                  me={spaces.find((x) => x.id === section.space)?.memberId ?? ''}
                  onOpen={() => setOpen({ space: w.space, rozmowa: w.rozmowa })}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </Screen>
  );
}

function Avatar({ name, group }: { name: string; group: boolean }) {
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-semibold ${
        group ? 'bg-selected text-selected-ink' : 'bg-surface text-ink'
      }`}
      aria-hidden="true"
    >
      {group ? '#' : (name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

function ThreadRow({
  thread,
  members,
  me,
  onOpen,
}: {
  thread: ChatThread;
  members: { uid: string; name: string }[];
  me: string;
  onOpen: () => void;
}) {
  const { t } = useT();
  const last = thread.ostatnia;
  const preview = last
    ? last.szyfr
      ? t.czat.nieczytelna
      : last.tekst || `📷 ${t.sugestie.zdjecie}`
    : thread.grupa
      ? t.czat.calyKalendarz
      : thread.mozna
        ? t.czat.brakWiadomosci
        : t.czat.starszaWersja;
  const prefix = !last
    ? ''
    : last.od === me
      ? `${t.czat.ty}: `
      : thread.grupa
        ? `${members.find((m) => m.uid === last.od)?.name ?? '?'}: `
        : '';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="active:bg-surface rounded-app flex w-full items-center gap-3 px-1 py-2 text-left"
    >
      <Avatar name={thread.nazwa} group={thread.grupa} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline gap-2">
          <span className={`text-ink min-w-0 flex-1 truncate ${thread.nieprzeczytane ? 'font-semibold' : ''}`}>
            {thread.nazwa}
          </span>
          {last && <span className="text-muted shrink-0 text-[0.6875rem]">{time(last.created)}</span>}
        </span>
        <span className={`truncate text-sm ${thread.nieprzeczytane ? 'text-ink' : 'text-muted'}`}>
          {prefix}
          {preview}
        </span>
      </span>
      {thread.nieprzeczytane > 0 ? (
        <span className="bg-accent text-bg flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-semibold">
          {thread.nieprzeczytane}
        </span>
      ) : (
        <ChevronRightIcon className="text-muted h-4 w-4 shrink-0" />
      )}
    </button>
  );
}

/** Jedna rozmowa: dymki, zdjęcia, pole wiadomości. */
function Conversation({
  thread,
  members,
  onBack,
}: {
  thread: ChatThread;
  members: { uid: string; name: string }[];
  onBack: () => void;
}) {
  const { t } = useT();
  const messages = useLiveQuery(
    () => db.chatMessages.where('[space+rozmowa]').equals([thread.space, thread.rozmowa]).sortBy('seq'),
    [thread.space, thread.rozmowa],
    [] as ChatMessage[],
  );
  const me = useLiveQuery(() => db.syncState.get(thread.space), [thread.space])?.memberId;
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Częstsze dociąganie, dopóki rozmowa jest otwarta.
  useEffect(() => {
    if (!syncAvailable()) return;
    const transport = httpTransport();
    void syncChat(transport, thread.space).catch(() => undefined);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void syncChat(transport, thread.space).catch(() => undefined);
    }, POLL_THREAD_MS);
    return () => window.clearInterval(timer);
  }, [thread.space]);

  // Otwarta rozmowa jest przeczytana; przewinięcie na dół przy nowej wiadomości.
  const lastSeq = messages.at(-1)?.seq ?? 0;
  useEffect(() => {
    void markChatRead(thread.space, thread.rozmowa);
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [thread.space, thread.rozmowa, lastSeq]);

  const ready = (text.trim().length > 0 || photos.length > 0) && thread.mozna;
  const send = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await sendChat(httpTransport(), thread.space, thread.rozmowa, text, photos.map((p) => p.dane));
      setText('');
      setPhotos([]);
    } catch (err) {
      const code = err instanceof SyncError ? err.code : 'serwer';
      setError(t.wspolny.bledy[code] ?? t.czat.blad);
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (uid: string) => members.find((m) => m.uid === uid)?.name ?? '?';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Screen title={thread.nazwa} onBack={onBack}>
        <p className="text-muted pb-3 text-center text-[0.6875rem]">
          {thread.grupa ? t.czat.szyfrowaneGrupa : t.czat.szyfrowane1na1}
        </p>
        <div className="flex flex-col gap-2 pb-2">
          {messages.length === 0 && (
            <p className="text-muted py-8 text-center text-sm">
              {thread.mozna ? t.czat.brakWiadomosci : t.czat.starszaWersja}
            </p>
          )}
          {messages.map((m) => {
            const mine = m.od === me;
            return (
              <div key={m.uid} className={`flex flex-col gap-0.5 ${mine ? 'items-end' : 'items-start'}`}>
                <span className="text-muted px-1 text-[0.6875rem]">
                  {mine ? t.czat.ty : nameOf(m.od)} · {time(m.created)}
                </span>
                {m.szyfr ? (
                  <p className="text-muted rounded-app bg-surface px-3 py-2 text-sm italic">{t.czat.nieczytelna}</p>
                ) : (
                  m.tekst && (
                    <p
                      className={`rounded-app max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap ${
                        mine ? 'bg-selected text-selected-ink' : 'bg-surface text-ink'
                      }`}
                    >
                      {m.tekst}
                    </p>
                  )
                )}
                {m.zdjecia.length > 0 && (
                  <div className={`flex max-w-[85%] flex-wrap gap-1.5 ${mine ? 'justify-end' : ''}`}>
                    {m.zdjecia.map((p) => (
                      <ChatPhotoThumb key={p.id} space={thread.space} photo={p} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottom} />
        </div>
      </Screen>
      <div className="border-line bg-bg px-safe shrink-0 border-t pt-2 pb-2">
        {photos.length > 0 && (
          <>
            <PhotoPicker photos={photos} onChange={setPhotos} compact />
            <p className="text-weekend pt-1 text-xs" role="note">
              {t.czat.zdjeciaOstrzezenie}
            </p>
          </>
        )}
        {error && (
          <p className="text-weekend pb-1 text-xs" role="status">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2 pt-1">
          {photos.length === 0 && thread.mozna && <PhotoPicker photos={photos} onChange={setPhotos} iconOnly />}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={thread.mozna ? t.czat.napisz : t.czat.starszaWersja}
            aria-label={t.czat.napisz}
            disabled={!thread.mozna}
            rows={1}
            maxLength={4000}
            className="bg-surface rounded-app text-ink min-w-0 flex-1 resize-none px-3 py-2 text-base disabled:opacity-50"
          />
          <Button variant="primary" className="py-2" disabled={busy || !ready} onClick={send}>
            {t.czat.wyslij}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Pobrane zdjęcia czatu — żeby przy przewijaniu nie ściągać ich znowu. */
const photoCache = new Map<string, string>();

function ChatPhotoThumb({ space, photo }: { space: string; photo: ChatPhoto }) {
  const { t } = useT();
  const [src, setSrc] = useState<string | null>(() => photoCache.get(photo.id) ?? null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (src || !syncAvailable()) return;
    let alive = true;
    chatPhotoUrl(httpTransport(), space, photo.id)
      .then((url) => {
        photoCache.set(photo.id, url);
        if (alive) setSrc(url);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [space, photo.id, src]);

  if (failed) return <span className="text-muted px-1 text-[0.6875rem]">{t.sugestie.zdjecieBlad}</span>;
  return (
    <>
      <button
        type="button"
        onClick={() => src && setZoom(true)}
        aria-label={t.sugestie.zdjecie}
        className="bg-surface rounded-app h-28 w-28 overflow-hidden"
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
