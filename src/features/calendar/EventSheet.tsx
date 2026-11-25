import { useEffect, useMemo, useState } from 'react';
import {
  addEvent,
  copyEvent,
  deleteEvent,
  deleteSeries,
  seriesDates,
  updateEvent,
  updateSeries,
} from '../../data/events';
import { MAX_EVENT_DAYS, MAX_REPEAT_COUNT, type Category, type EventItem, type RepeatFreq } from '../../data/types';
import { useT } from '../../i18n';
import { daysApart, dotDateLabel, fromKey, fullDateLabel, shiftKey } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { CategoryPicker, SubcategoryPicker } from '../../ui/CategoryChip';
import { ConfirmDialog } from '../../ui/Confirm';
import { Sheet } from '../../ui/Sheet';
import { TrashIcon } from '../../ui/icons';

interface Props {
  open: boolean;
  dateKey: string;
  /** Wydarzenie do edycji albo null, gdy dodajemy nowe. */
  event: EventItem | null;
  categories: Category[];
  onClose: () => void;
}

const DEFAULT_START = '09:00';
const DEFAULT_END = '10:00';
const DEFAULT_COUNT = 4;

/** 'brak' to wydarzenie pojedyncze — reszta to reguły powtarzania. */
type RepeatChoice = 'brak' | RepeatFreq;

const REPEAT_CHOICES: RepeatChoice[] = ['brak', 'dzien', 'tydzien', 'dwa-tygodnie', 'miesiac'];

/** Czy zmiana dotyczy jednego terminu, czy całej serii. */
type Scope = 'ten' | 'seria';

export function EventSheet({ open, dateKey, event, categories, onClose }: Props) {
  const { t } = useT();

  const repeatLabel: Record<RepeatChoice, string> = {
    brak: t.kalendarz.raz,
    dzien: t.kalendarz.codziennie,
    tydzien: t.kalendarz.coTydzien,
    'dwa-tygodnie': t.kalendarz.coDwaTygodnie,
    miesiac: t.kalendarz.coMiesiac,
  };

  const [title, setTitle] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState(DEFAULT_START);
  const [endTime, setEndTime] = useState(DEFAULT_END);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [subcategoryId, setSubcategoryId] = useState<number | undefined>(undefined);
  const [note, setNote] = useState('');
  const [repeat, setRepeat] = useState<RepeatChoice>('brak');
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [scope, setScope] = useState<Scope>('ten');
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Ostatni dzień wydarzenia wielodniowego; pusty — jednodniowe. */
  const [endDate, setEndDate] = useState('');
  /** Dzień, na który kopiujemy, i podpis po skopiowaniu. */
  const [copyDate, setCopyDate] = useState('');
  const [copiedTo, setCopiedTo] = useState<string[]>([]);

  // Edytowane wydarzenie zaczyna się w swoim dniu — wielodniowe można
  // otworzyć z dowolnego dnia jego trwania, a nie może się przy tym przesunąć.
  const startKey = event?.date ?? dateKey;

  // Wypełnia formularz przy każdym otwarciu — inaczej zostałyby dane poprzedniego wpisu.
  useEffect(() => {
    if (!open) return;
    setTitle(event?.title ?? '');
    setAllDay(event?.allDay ?? false);
    setStartTime(event?.startTime ?? DEFAULT_START);
    setEndTime(event?.endTime ?? DEFAULT_END);
    setCategoryId(event?.categoryId);
    setSubcategoryId(event?.subcategoryId);
    setNote(event?.note ?? '');
    setRepeat('brak');
    setCount(DEFAULT_COUNT);
    setScope('ten');
    setEndDate(event?.endDate ?? '');
    setCopyDate(shiftKey(event?.date ?? dateKey, 1));
    setCopiedTo([]);
  }, [open, event, dateKey]);

  const trimmed = title.trim();
  const multiDay = endDate !== '';
  const endValid = !multiDay || (endDate > startKey && daysApart(startKey, endDate) < MAX_EVENT_DAYS);
  // Przy wielodniowym godzina końca dotyczy innego dnia niż początek.
  const timesValid = allDay || !endTime || multiDay || endTime >= startTime;
  const canSave = trimmed.length > 0 && timesValid && endValid;

  const inSeries = event?.seriesId !== undefined;
  const wholeSeries = inSeries && scope === 'seria';

  // Podgląd ostatniego terminu — bez tego "co tydzień, 6 razy" nic nie mówi
  // o tym, dokąd seria sięga.
  const lastDate = useMemo(() => {
    if (repeat === 'brak' || count < 2) return null;
    const keys = seriesDates(startKey, { freq: repeat, count });
    return keys[keys.length - 1] ?? null;
  }, [repeat, count, startKey]);

  const save = async () => {
    if (!canSave) return;
    const draft = {
      title: trimmed,
      date: startKey,
      endDate: multiDay ? endDate : undefined,
      allDay,
      startTime: allDay ? undefined : startTime,
      endTime: allDay || !endTime ? undefined : endTime,
      categoryId,
      subcategoryId: categoryId !== undefined ? subcategoryId : undefined,
      note: note.trim() || undefined,
    };

    if (event?.id !== undefined) {
      if (wholeSeries) {
        // Daty zostają nietknięte — inaczej wszystkie terminy serii wskoczyłyby
        // na ten sam dzień.
        const { date: _pominietaData, endDate: _pominietyKoniec, ...bezDaty } = draft;
        await updateSeries(event.seriesId!, bezDaty);
      } else {
        await updateEvent(event.id, draft);
      }
    } else {
      await addEvent(
        draft,
        repeat === 'brak' ? undefined : { freq: repeat, count: Math.max(2, count) },
      );
    }
    onClose();
  };

  const copy = async () => {
    if (!event || !copyDate) return;
    await copyEvent(event, copyDate);
    setCopiedTo((list) => [...list, copyDate]);
    setCopyDate(shiftKey(copyDate, 1));
  };

  const remove = async () => {
    setConfirmOpen(false);
    if (event?.id === undefined) return;
    if (wholeSeries) await deleteSeries(event.seriesId!);
    else await deleteEvent(event.id);
    onClose();
  };

  return (
    <Sheet
      open={open}
      title={event ? t.kalendarz.edytujWydarzenie : t.kalendarz.noweWydarzenie}
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        <p className="text-muted -mt-2 text-sm">
          {fullDateLabel(fromKey(startKey))}
          {multiDay && endValid && ` – ${fullDateLabel(fromKey(endDate))}`}
        </p>

        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.wspolne.nazwa}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.kalendarz.nazwaPrzyklad}
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
          />
        </label>

        <CategoryPicker
          categories={categories}
          value={categoryId}
          onChange={(id) => {
            setCategoryId(id);
            setSubcategoryId(undefined);
          }}
        />
        <SubcategoryPicker categoryId={categoryId} value={subcategoryId} onChange={setSubcategoryId} />

        <label className="bg-surface rounded-app flex items-center justify-between px-3 py-2.5">
          <span className="text-ink text-sm font-medium">{t.kalendarz.calodniowe}</span>
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="accent-accent h-5 w-5"
          />
        </label>

        {!allDay && (
          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-muted text-xs font-medium">{t.kalendarz.od}</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-surface rounded-app text-ink w-full min-w-0 px-3 py-2.5 text-base"
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-muted text-xs font-medium">{t.kalendarz.do}</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-surface rounded-app text-ink w-full min-w-0 px-3 py-2.5 text-base"
              />
            </label>
          </div>
        )}

        {!timesValid && (
          <p className="text-weekend -mt-3 text-xs">
            {t.kalendarz.zlyZakres}
          </p>
        )}

        {/* Kilka dni — nie przy serii: jej terminy mają wspólną regułę, a długość
            pojedynczego terminu zmieniałaby się wtedy tylko w jednym z nich. */}
        {!inSeries && repeat === 'brak' && (
          <div className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">{t.kalendarz.doDnia}</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={endDate}
                min={shiftKey(startKey, 1)}
                max={shiftKey(startKey, MAX_EVENT_DAYS - 1)}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label={t.kalendarz.doDnia}
                className="bg-surface rounded-app text-ink min-w-0 flex-1 px-3 py-2.5 text-base"
              />
              {multiDay && (
                <button
                  type="button"
                  onClick={() => setEndDate('')}
                  className="text-muted shrink-0 px-2 py-2 text-sm"
                >
                  {t.kalendarz.jedenDzien}
                </button>
              )}
            </div>
            {!multiDay && <p className="text-muted text-xs">{t.kalendarz.doDniaOpis}</p>}
            {!endValid && <p className="text-weekend text-xs">{t.kalendarz.zlyKoniec(MAX_EVENT_DAYS)}</p>}
          </div>
        )}

        {/* Powtarzanie ustawiamy tylko przy zakładaniu serii — zmiana reguły
            istniejącej serii to w praktyce nowa seria. */}
        {!event && !multiDay && (
          <div className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">{t.kalendarz.powtarzanie}</span>
            <div className="flex flex-wrap gap-1.5">
              {REPEAT_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setRepeat(choice)}
                  aria-pressed={repeat === choice}
                  className={`rounded-app px-3 py-1.5 text-sm ${
                    repeat === choice ? 'bg-selected text-selected-ink' : 'bg-surface text-ink'
                  }`}
                >
                  {repeatLabel[choice]}
                </button>
              ))}
            </div>

            {repeat !== 'brak' && (
              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2">
                  <span className="text-muted text-xs font-medium">{t.kalendarz.ileRazy}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={MAX_REPEAT_COUNT}
                    value={count}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setCount(
                        Number.isFinite(value)
                          ? Math.min(MAX_REPEAT_COUNT, Math.max(2, Math.round(value)))
                          : DEFAULT_COUNT,
                      );
                    }}
                    className="bg-surface rounded-app text-ink w-20 px-3 py-2 text-base tabular-nums"
                  />
                </label>
                {lastDate && (
                  <span className="text-muted text-xs">{t.kalendarz.ostatniRaz(dotDateLabel(lastDate))}</span>
                )}
              </div>
            )}
          </div>
        )}

        {inSeries && (
          <div className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">
              {t.kalendarz.naleziDoSerii}
            </span>
            <div className="flex gap-2">
              {(
                [
                  { id: 'ten' as const, label: t.kalendarz.tegoTerminu },
                  { id: 'seria' as const, label: t.kalendarz.calejSerii },
                ]
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setScope(option.id)}
                  aria-pressed={scope === option.id}
                  className={`rounded-app flex-1 px-3 py-2 text-sm ${
                    scope === option.id ? 'bg-selected text-selected-ink' : 'bg-surface text-ink'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.kalendarz.notatka}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t.kalendarz.notatkaPrzyklad}
            className="bg-surface rounded-app text-ink resize-none px-3 py-2.5 text-base"
          />
        </label>

        {event && (
          <div className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">{t.kalendarz.kopiujNaDzien}</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={copyDate}
                onChange={(e) => setCopyDate(e.target.value)}
                aria-label={t.kalendarz.kopiujNaDzien}
                className="bg-surface rounded-app text-ink min-w-0 flex-1 px-3 py-2.5 text-base"
              />
              <Button className="shrink-0 px-4" disabled={!copyDate} onClick={copy}>
                {t.kalendarz.kopiuj}
              </Button>
            </div>
            {copiedTo.length > 0 && (
              <p className="text-accent text-xs">{t.kalendarz.skopiowano(copiedTo.map(dotDateLabel).join(', '))}</p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={!canSave} onClick={save}>
            {t.wspolne.zapisz}
          </Button>
          {event && (
            <Button variant="danger" aria-label={t.kalendarz.usunWydarzenie} onClick={() => setConfirmOpen(true)} className="px-4">
              <TrashIcon className="h-5 w-5" />
            </Button>
          )}
        </div>

        {wholeSeries && (
          <p className="text-muted -mt-2 text-xs">
            {t.kalendarz.uwagaSeria}
          </p>
        )}

        <ConfirmDialog
          open={confirmOpen}
          title={
            wholeSeries
              ? t.kalendarz.pytanieSeria(event?.title ?? '')
              : t.kalendarz.pytanieWydarzenie(event?.title ?? '')
          }
          message={
            wholeSeries ? t.kalendarz.opisSeria : t.wspolne.nieodwracalne
          }
          onConfirm={remove}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    </Sheet>
  );
}
