import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { APP_VERSION } from '../app/version';
import { useT } from '../i18n';
import { sendSuggestion, syncAvailable } from '../platform/sync';
import { SyncError } from '../sync/transport';
import { Button } from './Button';
import { Sheet } from './Sheet';

/**
 * Zgłaszanie sugestii: mały przycisk (!) w lewym górnym rogu każdego ekranu
 * otwiera panel z imieniem i treścią. Sugestia idzie na serwer wspólnego
 * kalendarza, skąd właściciel pobiera je poleceniem `npm run sugestie`.
 */

interface FeedbackState {
  open: boolean;
  /** Ekran, z którego zgłoszono — dołączany do sugestii. */
  screen: string;
  show: () => void;
  hide: () => void;
  setScreen: (screen: string) => void;
}

export const useFeedbackStore = create<FeedbackState>()((set) => ({
  open: false,
  screen: '',
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  setScreen: (screen) => set({ screen }),
}));

/** Imię zapamiętane na tym telefonie — żeby nie wpisywać go za każdym razem. */
const NAME_KEY = 'planer-imie-sugestii';

function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* pamięć przeglądarki niedostępna — imię trzeba będzie wpisać ponownie */
  }
}

/** Przycisk (!) — bez serwera nie ma dokąd wysłać, więc wtedy go nie ma. */
export function FeedbackButton() {
  const { t } = useT();
  const show = useFeedbackStore((state) => state.show);
  if (!syncAvailable()) return null;
  return (
    <button
      type="button"
      onClick={show}
      aria-label={t.sugestie.przycisk}
      className="border-line text-muted active:text-ink flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold"
    >
      !
    </button>
  );
}

/** Panel sugestii — jeden w całej aplikacji, otwierany z dowolnego ekranu. */
export function FeedbackSheet() {
  const { t } = useT();
  const { open, screen, hide } = useFeedbackStore();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'wyslano' | 'blad' | 'limit' | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(readName());
    setStatus(null);
  }, [open]);

  const ready = name.trim().length > 0 && text.trim().length > 0;

  const send = async () => {
    if (!ready) return;
    setBusy(true);
    setStatus(null);
    try {
      await sendSuggestion({ name: name.trim(), text: text.trim(), version: APP_VERSION, screen });
      rememberName(name.trim());
      setText('');
      setStatus('wyslano');
    } catch (err) {
      setStatus(err instanceof SyncError && err.code === 'limit' ? 'limit' : 'blad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title={t.sugestie.tytul} onClose={hide}>
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
        {status && (
          <p className={`text-sm ${status === 'wyslano' ? 'text-accent' : 'text-weekend'}`} role="status">
            {status === 'wyslano'
              ? t.sugestie.wyslano
              : status === 'limit'
                ? t.sugestie.limit
                : t.sugestie.blad}
          </p>
        )}
        <Button variant="primary" disabled={busy || !ready} onClick={send}>
          {t.sugestie.wyslij}
        </Button>
      </div>
    </Sheet>
  );
}
