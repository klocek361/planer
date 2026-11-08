import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { useT } from '../../i18n';
import { httpTransport, syncAvailable } from '../../platform/sync';
import { syncAndRecord } from '../../sync/useAutoSync';
import {
  createSpace,
  currentLink,
  joinSpace,
  leaveSpace,
  rotateLink,
  setCategoryShared,
} from '../../sync/state';
import { SyncError, type SyncErrorCode } from '../../sync/transport';
import { Button } from '../../ui/Button';
import { CategoryChip } from '../../ui/CategoryChip';
import { ConfirmDialog } from '../../ui/Confirm';
import { Screen } from '../../ui/Screen';

/** Adres aplikacji, do którego doklejamy sekret — ten sam, z którego działa. */
const appBase = () => `${location.origin}${import.meta.env.BASE_URL}`;

type Pending = 'zmien' | 'opusc' | null;

export function SharingScreen({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const state = useLiveQuery(() => db.syncState.get('stan'), [], null);
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());
  const link = useLiveQuery(() => currentLink(appBase()), [state?.spaceId]);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [joinText, setJoinText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SyncErrorCode | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  const attempt = async (action: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof SyncError ? err.code : 'serwer');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ url: link, title: t.ustawienia.wspolny });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    await copy();
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* schowek niedostępny — link i tak widać na ekranie */
    }
  };

  const toggleSelected = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const errorBox = (code: SyncErrorCode | null | undefined) =>
    code ? (
      <p className="text-weekend pt-3 text-sm" role="alert">
        {t.wspolny.bledy[code as keyof typeof t.wspolny.bledy] ?? t.wspolny.bledy.serwer}
      </p>
    ) : null;

  if (!syncAvailable()) {
    return (
      <Screen title={t.ustawienia.wspolny} onBack={onBack}>
        <p className="text-muted text-sm">{t.wspolny.niedostepny}</p>
      </Screen>
    );
  }

  // Jeszcze nie wiadomo, czy telefon należy do przestrzeni.
  if (state === null) return <Screen title={t.ustawienia.wspolny} onBack={onBack}>{null}</Screen>;

  if (!state) {
    return (
      <Screen title={t.ustawienia.wspolny} onBack={onBack}>
        <p className="text-muted pb-5 text-sm">{t.wspolny.wstep}</p>

        <p className="text-muted pb-2 text-xs font-medium">{t.wspolny.wybierz}</p>
        <div className="flex flex-wrap gap-2 pb-4">
          {(categories ?? []).map((category) => (
            <CategoryChip
              key={category.id}
              label={category.name}
              color={category.color}
              active={selected.has(category.id!)}
              onClick={() => toggleSelected(category.id!)}
            />
          ))}
        </div>
        <Button
          variant="primary"
          className="w-full"
          disabled={busy || selected.size === 0}
          onClick={() => attempt(() => createSpace(httpTransport(), [...selected], appBase()))}
        >
          {t.wspolny.utworz}
        </Button>

        <div className="border-line mt-8 border-t pt-6">
          <p className="text-ink pb-2 text-sm font-medium">{t.wspolny.dolaczTytul}</p>
          <textarea
            value={joinText}
            onChange={(e) => setJoinText(e.target.value)}
            placeholder={t.wspolny.wklej}
            rows={3}
            className="bg-surface rounded-app text-ink w-full px-3 py-2.5 text-sm break-all"
          />
          <Button
            className="mt-2 w-full"
            disabled={busy || joinText.trim().length === 0}
            onClick={() => attempt(() => joinSpace(httpTransport(), joinText))}
          >
            {t.wspolny.dolacz}
          </Button>
        </div>

        {errorBox(error)}
      </Screen>
    );
  }

  const lastSync = state.lastSyncAt
    ? t.wspolny.ostatnio(
        new Date(state.lastSyncAt).toLocaleString(undefined, {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
      )
    : t.wspolny.nigdy;

  return (
    <Screen title={t.ustawienia.wspolny} onBack={onBack}>
      <p className="text-muted pb-2 text-xs font-medium">{t.wspolny.link}</p>
      <div className="bg-surface rounded-app text-ink px-3 py-2.5 font-mono text-xs break-all select-all">
        {link}
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="primary" className="flex-1" onClick={share}>
          {t.wspolny.udostepnij}
        </Button>
        <Button className="flex-1" onClick={copy}>
          {copied ? t.wspolny.skopiowano : t.wspolny.kopiuj}
        </Button>
      </div>
      <div
        className="rounded-app mt-3 px-3 py-2.5 text-xs"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--c-weekend) 12%, transparent)',
          color: 'var(--c-weekend)',
        }}
      >
        {t.wspolny.ostrzezenie}
      </div>

      <p className="text-muted pt-6 pb-2 text-xs font-medium">{t.wspolny.kategorie}</p>
      <div className="flex flex-wrap gap-2">
        {(categories ?? []).map((category) => (
          <CategoryChip
            key={category.id}
            label={category.name}
            color={category.color}
            active={category.shared === true}
            onClick={() =>
              attempt(async () => {
                await setCategoryShared(category.id!, !category.shared);
                await syncAndRecord();
              })
            }
          />
        ))}
      </div>
      <p className="text-muted pt-2 text-xs">{t.wspolny.wylaczUwaga}</p>

      <p className="text-muted pt-6 text-sm">{lastSync}</p>
      {errorBox(error ?? (state.lastError as SyncErrorCode | undefined))}
      <Button className="mt-2 w-full" disabled={busy} onClick={() => attempt(syncAndRecord)}>
        {t.wspolny.synchronizuj}
      </Button>

      <div className="flex flex-col gap-2 pt-8">
        <Button disabled={busy} onClick={() => setPending('zmien')}>
          {t.wspolny.zmienLink}
        </Button>
        <Button disabled={busy} onClick={() => setPending('opusc')}>
          {t.wspolny.opusc}
        </Button>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending === 'zmien' ? t.wspolny.zmienLink : t.wspolny.opusc}
        message={pending === 'zmien' ? t.wspolny.zmienLinkOpis : t.wspolny.opuscOpis}
        confirmLabel={t.wspolny.potwierdz}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const action = pending;
          setPending(null);
          void attempt(() =>
            action === 'zmien' ? rotateLink(httpTransport(), appBase()) : leaveSpace(),
          );
        }}
      />
    </Screen>
  );
}
