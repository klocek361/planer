import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { updateCategory } from '../../data/categories';
import { db } from '../../data/db';
import type { Category, Member, SyncState } from '../../data/types';
import { useT } from '../../i18n';
import { useBackDismiss } from '../../platform/back';
import { httpTransport, syncAvailable } from '../../platform/sync';
import { MAX_MEMBER_NAME } from '../../sync/engine';
import {
  MAX_CALENDAR_NAME,
  createInvite,
  createSpace,
  joinWithCode,
  leaveSpace,
  revokeInvite,
  rotateKey,
  setMyName,
} from '../../sync/state';
import { SyncError, type SyncErrorCode } from '../../sync/transport';
import { syncAndRecord } from '../../sync/useAutoSync';
import { Button } from '../../ui/Button';
import { CodeInput, formatCode } from '../../ui/CodeInput';
import { ConfirmDialog } from '../../ui/Confirm';
import { ChevronRightIcon } from '../../ui/icons';
import { Screen } from '../../ui/Screen';

type View = { k: 'lista' } | { k: 'nowy' } | { k: 'dolacz' } | { k: 'kalendarz'; id: string };

const timeLabel = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Wspólne operacje ekranu: zajętość przycisków i błąd do pokazania. */
function useAttempt() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SyncErrorCode | null>(null);
  const attempt = async (action: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
      return true;
    } catch (err) {
      setError(err instanceof SyncError ? err.code : 'serwer');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, attempt };
}

function ErrorBox({ code }: { code: SyncErrorCode | string | null | undefined }) {
  const { t } = useT();
  if (!code) return null;
  return (
    <p className="text-weekend pt-3 text-sm" role="alert">
      {t.wspolny.bledy[code as SyncErrorCode] ?? t.wspolny.bledy.serwer}
    </p>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  maxLength,
  onEnter,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength: number;
  onEnter?: () => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-muted text-xs font-medium">{label}</span>
      <input
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter?.();
        }}
        placeholder={placeholder}
        className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
      />
      {hint && <span className="text-muted text-xs">{hint}</span>}
    </label>
  );
}

/**
 * Wspólne kalendarze: lista, zakładanie, dołączanie kodem i szczegóły
 * jednego kalendarza z członkami i zaproszeniem.
 */
export function SharingScreen({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const [view, setView] = useState<View>({ k: 'lista' });
  const toList = () => setView({ k: 'lista' });
  useBackDismiss(view.k !== 'lista', toList);

  if (!syncAvailable()) {
    return (
      <Screen title={t.ustawienia.wspolny} onBack={onBack}>
        <p className="text-muted text-sm">{t.wspolny.niedostepny}</p>
      </Screen>
    );
  }

  if (view.k === 'nowy') {
    return <CreateView onBack={toList} onDone={(id) => setView({ k: 'kalendarz', id })} />;
  }
  if (view.k === 'dolacz') {
    return <JoinView onBack={toList} onDone={(id) => setView({ k: 'kalendarz', id })} />;
  }
  if (view.k === 'kalendarz') {
    return (
      <CalendarView
        id={view.id}
        onBack={toList}
        onMoved={(id) => setView({ k: 'kalendarz', id })}
      />
    );
  }
  return <ListView onBack={onBack} onOpen={setView} />;
}

function ListView({ onBack, onOpen }: { onBack: () => void; onOpen: (view: View) => void }) {
  const { t } = useT();
  const states = useLiveQuery(() => db.syncState.toArray(), [], null);
  const categories = useLiveQuery(() => db.categories.toArray(), [], []);
  const members = useLiveQuery(() => db.members.toArray(), [], []);

  return (
    <Screen title={t.ustawienia.wspolny} onBack={onBack}>
      <p className="text-muted pb-5 text-sm">{t.wspolny.wstep}</p>

      {states && states.length > 0 && (
        <>
          <p className="text-muted pb-2 text-xs font-medium">{t.wspolny.lista}</p>
          <ul className="flex flex-col gap-1 pb-6">
            {states.map((state) => {
              const category = categories.find((c) => c.space === state.id);
              const count = members.filter((m) => m.space === state.id).length;
              return (
                <li key={state.id}>
                  <button
                    type="button"
                    onClick={() => onOpen({ k: 'kalendarz', id: state.id })}
                    className="bg-surface rounded-app flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: category?.color ?? 'var(--c-text-faint)' }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-ink block truncate text-sm font-medium">
                        {category?.name ?? t.ustawienia.wspolny}
                      </span>
                      <span className={`block text-xs ${state.lastError ? 'text-weekend' : 'text-muted'}`}>
                        {state.lastError
                          ? (t.wspolny.bledy[state.lastError as SyncErrorCode] ?? t.wspolny.bledy.serwer)
                          : `${t.wspolny.czlonkowie}: ${count}`}
                      </span>
                    </span>
                    <ChevronRightIcon className="text-faint h-5 w-5 shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {states && states.length === 0 && <p className="text-muted pb-6 text-sm">{t.wspolny.brak}</p>}

      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={() => onOpen({ k: 'nowy' })}>
          {t.wspolny.nowy}
        </Button>
        <Button onClick={() => onOpen({ k: 'dolacz' })}>{t.wspolny.dolaczKodem}</Button>
      </div>
    </Screen>
  );
}

function CreateView({ onBack, onDone }: { onBack: () => void; onDone: (id: string) => void }) {
  const { t } = useT();
  const { busy, error, attempt } = useAttempt();
  const [name, setName] = useState('');
  const [me, setMe] = useState('');
  const ready = name.trim().length > 0 && me.trim().length > 0;

  const create = async () => {
    if (!ready) return;
    let id = '';
    if (await attempt(async () => (id = await createSpace(httpTransport(), name, me)))) onDone(id);
  };

  return (
    <Screen title={t.wspolny.nowy} onBack={onBack}>
      <div className="flex flex-col gap-5">
        <TextField
          label={t.wspolny.nazwa}
          value={name}
          onChange={setName}
          placeholder={t.wspolny.nazwaPrzyklad}
          maxLength={MAX_CALENDAR_NAME}
        />
        <TextField
          label={t.wspolny.mojeImie}
          hint={t.wspolny.mojeImieOpis}
          value={me}
          onChange={setMe}
          placeholder={t.wspolny.mojeImiePrzyklad}
          maxLength={MAX_MEMBER_NAME}
          onEnter={create}
        />
        <Button variant="primary" disabled={busy || !ready} onClick={create}>
          {t.wspolny.utworz}
        </Button>
      </div>
      <ErrorBox code={error} />
    </Screen>
  );
}

function JoinView({ onBack, onDone }: { onBack: () => void; onDone: (id: string) => void }) {
  const { t } = useT();
  const { busy, error, attempt } = useAttempt();
  const [code, setCode] = useState('');
  const [me, setMe] = useState('');
  const ready = code.length === 8 && me.trim().length > 0;

  const join = async () => {
    if (!ready) return;
    let id = '';
    if (await attempt(async () => (id = await joinWithCode(httpTransport(), code, me)))) onDone(id);
  };

  return (
    <Screen title={t.wspolny.dolaczKodem} onBack={onBack}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.wspolny.kod}</span>
          <CodeInput value={code} onChange={setCode} label={t.wspolny.kod} />
          <span className="text-muted text-xs">{t.wspolny.kodOpis}</span>
        </div>
        <TextField
          label={t.wspolny.mojeImie}
          hint={t.wspolny.mojeImieOpis}
          value={me}
          onChange={setMe}
          placeholder={t.wspolny.mojeImiePrzyklad}
          maxLength={MAX_MEMBER_NAME}
          onEnter={join}
        />
        <Button variant="primary" disabled={busy || !ready} onClick={join}>
          {t.wspolny.dolacz}
        </Button>
      </div>
      <ErrorBox code={error} />
    </Screen>
  );
}

type Pending = 'odetnij' | 'opusc' | null;

function CalendarView({
  id,
  onBack,
  onMoved,
}: {
  id: string;
  onBack: () => void;
  onMoved: (id: string) => void;
}) {
  const { t } = useT();
  const { busy, error, attempt } = useAttempt();
  const state = useLiveQuery(() => db.syncState.get(id), [id], null) as SyncState | undefined | null;
  const category = useLiveQuery(() => db.categories.where('space').equals(id).first(), [id]) as
    | Category
    | undefined;
  const members = useLiveQuery(() => db.members.where('space').equals(id).toArray(), [id], []) as Member[];

  const me = members.find((m) => m.uid === state?.memberId);
  const [nameDraft, setNameDraft] = useState('');
  const [meDraft, setMeDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [now, setNow] = useState(Date.now());

  // Pola podążają za zapisanymi wartościami — także gdy zmieni je ktoś inny.
  useEffect(() => setNameDraft(category?.name ?? ''), [category?.name]);
  useEffect(() => setMeDraft(me?.name ?? ''), [me?.name]);
  // Odświeżenie co minutę, żeby wygasły kod sam zniknął z ekranu.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const nameById = useMemo(() => new Map(members.map((m) => [m.uid, m.name])), [members]);
  const sorted = useMemo(() => [...members].sort((a, b) => a.joinedAt - b.joinedAt), [members]);

  // Kalendarz zniknął (opuszczony albo przeniesiony) — wracamy do listy.
  if (state === undefined) {
    return (
      <Screen title={t.ustawienia.wspolny} onBack={onBack}>
        {null}
      </Screen>
    );
  }
  if (state === null) return <Screen title={t.ustawienia.wspolny} onBack={onBack}>{null}</Screen>;

  const calendarName = category?.name ?? t.ustawienia.wspolny;
  const nameChanged = !!category && nameDraft.trim() !== '' && nameDraft.trim() !== category.name;
  const meChanged = meDraft.trim() !== '' && meDraft.trim() !== (me?.name ?? '');
  const activeCode =
    state.inviteCode && state.inviteExpires && state.inviteExpires > now ? state.inviteCode : null;

  const saveName = () =>
    category?.id &&
    nameChanged &&
    attempt(async () => {
      await updateCategory(category.id!, { name: nameDraft.trim().slice(0, MAX_CALENDAR_NAME) });
      await syncAndRecord();
    });

  const saveMe = () =>
    meChanged &&
    attempt(async () => {
      await setMyName(id, meDraft);
      await syncAndRecord();
    });

  const inviteText = activeCode ? t.wspolny.tekstZaproszenia(calendarName, formatCode(activeCode)) : '';

  const share = async () => {
    if (!activeCode) return;
    if (navigator.share) {
      try {
        // Sam tekst, bez adresu — telefon nie podsuwa wtedy udostępniania strony.
        await navigator.share({ text: inviteText });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    await copy();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* schowek niedostępny — kod i tak widać na ekranie */
    }
  };

  const memberNote = (member: Member) => {
    if (!member.by) return t.wspolny.zalozyciel;
    return t.wspolny.zaprosil(
      member.by === state.memberId ? t.wspolny.ty : (nameById.get(member.by) ?? t.wspolny.nieznany),
    );
  };

  return (
    <Screen title={calendarName} onBack={onBack}>
      <div className="flex flex-col gap-2">
        <TextField
          label={t.wspolny.nazwa}
          value={nameDraft}
          onChange={setNameDraft}
          placeholder={t.wspolny.nazwaPrzyklad}
          maxLength={MAX_CALENDAR_NAME}
          onEnter={saveName}
        />
        {nameChanged && (
          <Button variant="primary" disabled={busy} onClick={saveName}>
            {t.wspolne.zapisz}
          </Button>
        )}
        {category && (
          <p className="text-muted flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
              aria-hidden="true"
            />
            {t.wspolny.dodawajDo(category.name)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-6">
        <TextField
          label={t.wspolny.mojeImie}
          hint={t.wspolny.mojeImieOpis}
          value={meDraft}
          onChange={setMeDraft}
          placeholder={t.wspolny.mojeImiePrzyklad}
          maxLength={MAX_MEMBER_NAME}
          onEnter={saveMe}
        />
        {meChanged && (
          <Button variant="primary" disabled={busy} onClick={saveMe}>
            {t.wspolne.zapisz}
          </Button>
        )}
      </div>

      <p className="text-muted pt-6 pb-2 text-xs font-medium">
        {t.wspolny.czlonkowie} · {members.length}
      </p>
      <ul className="flex flex-col gap-1">
        {sorted.map((member) => (
          <li key={member.uid} className="bg-surface rounded-app flex items-baseline gap-2 px-4 py-2.5">
            <span className="text-ink truncate text-sm font-medium">
              {member.name}
              {member.uid === state.memberId && (
                <span className="text-accent"> · {t.wspolny.ty}</span>
              )}
            </span>
            <span className="text-muted ml-auto shrink-0 text-xs">{memberNote(member)}</span>
          </li>
        ))}
      </ul>

      <div className="pt-6">
        {activeCode ? (
          <div className="bg-surface rounded-app flex flex-col items-center gap-1 px-4 py-4">
            <span className="text-muted text-xs font-medium">{t.wspolny.kod}</span>
            <span className="text-ink text-3xl font-semibold tracking-widest tabular-nums select-all">
              {formatCode(activeCode)}
            </span>
            <span className="text-muted text-xs">{t.wspolny.kodWazny(timeLabel(state.inviteExpires!))}</span>
            <div className="flex w-full gap-2 pt-3">
              <Button variant="primary" className="flex-1" onClick={share}>
                {t.wspolny.udostepnijKod}
              </Button>
              <Button className="flex-1" onClick={copy}>
                {copied ? t.wspolny.skopiowano : t.wspolny.kopiuj}
              </Button>
            </div>
            <div className="flex w-full gap-2">
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => attempt(() => createInvite(httpTransport(), id))}
              >
                {t.wspolny.nowyKod}
              </Button>
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => attempt(() => revokeInvite(httpTransport(), id))}
              >
                {t.wspolny.uniewaznij}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="primary"
            className="w-full"
            disabled={busy}
            onClick={() => attempt(() => createInvite(httpTransport(), id))}
          >
            {t.wspolny.zapros}
          </Button>
        )}
        <p className="text-muted pt-2 text-xs">{t.wspolny.kodOstrzezenie}</p>
      </div>

      <p className="text-muted pt-6 text-sm">
        {state.lastSyncAt ? t.wspolny.ostatnio(timeLabel(state.lastSyncAt)) : t.wspolny.nigdy}
      </p>
      <ErrorBox code={error ?? state.lastError} />
      <Button className="mt-2 w-full" disabled={busy} onClick={() => attempt(syncAndRecord)}>
        {t.wspolny.synchronizuj}
      </Button>

      <div className="flex flex-col gap-2 pt-8">
        <Button disabled={busy} onClick={() => setPending('odetnij')}>
          {t.wspolny.odetnij}
        </Button>
        <Button disabled={busy} onClick={() => setPending('opusc')}>
          {t.wspolny.opusc}
        </Button>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending === 'odetnij' ? t.wspolny.odetnij : t.wspolny.opusc}
        message={pending === 'odetnij' ? t.wspolny.odetnijOpis : t.wspolny.opuscOpis}
        confirmLabel={t.wspolny.potwierdz}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          const action = pending;
          setPending(null);
          if (action === 'opusc') {
            if (await attempt(() => leaveSpace(httpTransport(), id))) onBack();
            return;
          }
          let newId = '';
          if (await attempt(async () => (newId = await rotateKey(httpTransport(), id)))) onMoved(newId);
        }}
      />
    </Screen>
  );
}
