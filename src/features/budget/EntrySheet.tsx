import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  addEntry,
  addMoneyCategory,
  amountToInput,
  categoryGoalStatus,
  deleteEntry,
  formatMoney,
  monthRange,
  parseAmount,
  updateEntry,
} from '../../data/budget';
import { db } from '../../data/db';
import type { Member, MoneyCategory, MoneyEntry, MoneyKind } from '../../data/types';
import { useT } from '../../i18n';
import { fromKey, toKey } from '../../lib/dates';
import { GoalBar } from './GoalBar';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/Confirm';
import { Sheet } from '../../ui/Sheet';

interface Props {
  open: boolean;
  /** Edytowany wpis; pusty — nowy. */
  entry: MoneyEntry | null;
  categories: MoneyCategory[];
  /** Członkowie wspólnego kalendarza — do „kto zapłacił”. Pusto w budżecie prywatnym. */
  members: Member[];
  /** Ten telefon na liście członków — podpisany „Ty”. */
  meId?: string;
  currency: string;
  onClose: () => void;
}

/** Chip wyboru — wspólny wygląd dla kategorii, rodzaju i osoby. */
export function Chip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-app flex items-center gap-2 px-3 py-2 text-sm"
      style={{
        backgroundColor: active
          ? `color-mix(in srgb, ${color ?? 'var(--c-accent)'} 20%, transparent)`
          : 'var(--c-surface)',
        boxShadow: active ? `inset 0 0 0 1.5px ${color ?? 'var(--c-accent)'}` : 'none',
      }}
    >
      {color && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />}
      {label}
    </button>
  );
}

/**
 * Dodawanie i edycja wpisu: wydatek albo przychód, duża kwota, kategoria,
 * notatka, data i — we wspólnym budżecie — opcjonalnie, kto zapłacił.
 */
export function EntrySheet({ open, entry, categories, members, meId, currency, onClose }: Props) {
  const { t, lang } = useT();
  const [kind, setKind] = useState<MoneyKind>('wydatek');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [paidBy, setPaidBy] = useState<string | undefined>(undefined);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Wpłata i wypłata ze skarbonki edytują się tutaj tylko kwotą, datą i notatką.
  const goalEntry = entry?.kind === 'wplata' || entry?.kind === 'wyplata';

  useEffect(() => {
    if (!open) return;
    setKind(entry?.kind === 'przychod' ? 'przychod' : 'wydatek');
    setAmount(entry ? amountToInput(entry.amount) : '');
    setCategoryId(entry?.categoryId);
    setNote(entry?.note ?? '');
    setDate(entry?.date ?? toKey(new Date()));
    setPaidBy(entry?.paidBy);
    setNewCategory(null);
    setError(false);
  }, [open, entry]);

  const visible = categories.filter((c) => c.kind === kind);

  // Pasek celu: wybrana kategoria wydatków z miesięcznym celem — stan miesiąca
  // z daty wpisu, razem z wpisywaną kwotą (edytowany wpis liczy się raz).
  const goalCategory =
    !goalEntry && kind === 'wydatek' && newCategory === null
      ? visible.find((c) => c.id === categoryId && c.goal)
      : undefined;
  const goalMonth = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : null;
  const monthEntries = useLiveQuery(
    async () => {
      if (!open || !goalCategory || !goalMonth) return [];
      const range = monthRange(fromKey(`${goalMonth}-01`));
      return db.moneyEntries.where('date').between(range.from, range.to, true, true).toArray();
    },
    [open, goalCategory?.id, goalMonth],
    [],
  );
  const typed = parseAmount(amount) ?? 0;
  const goalStatus = goalCategory
    ? categoryGoalStatus(monthEntries, goalCategory, { skipId: entry?.id, extra: typed })
    : null;
  const money = (grosze: number) => formatMoney(grosze, currency, lang);

  const save = async () => {
    const grosze = parseAmount(amount);
    if (!grosze) {
      setError(true);
      return;
    }
    let category = categoryId;
    if (newCategory !== null && newCategory.trim()) {
      category = await addMoneyCategory(kind, newCategory);
    }
    const draft = {
      kind: goalEntry ? entry!.kind : kind,
      amount: grosze,
      date: date || toKey(new Date()),
      categoryId: goalEntry ? undefined : category,
      goalId: goalEntry ? entry!.goalId : undefined,
      note,
      paidBy: goalEntry || kind === 'przychod' ? undefined : paidBy,
    };
    if (entry?.id) await updateEntry(entry.id, draft);
    else await addEntry(draft);
    onClose();
  };

  const remove = async () => {
    setConfirmOpen(false);
    if (entry?.id) await deleteEntry(entry.id);
    onClose();
  };

  const title = entry
    ? goalEntry
      ? entry.kind === 'wplata'
        ? t.budzet.wplata
        : t.budzet.wyplata
      : t.budzet.edytujWpis
    : t.budzet.nowyWpis;

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {!goalEntry && (
          <div className="bg-surface rounded-app flex gap-1 p-1">
            {(['wydatek', 'przychod'] as MoneyKind[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setKind(item);
                  if (categories.find((c) => c.id === categoryId)?.kind !== item) setCategoryId(undefined);
                }}
                aria-pressed={kind === item}
                className={`rounded-app flex-1 py-1.5 text-sm font-medium ${
                  kind === item ? 'bg-bg text-ink' : 'text-muted'
                }`}
              >
                {item === 'wydatek' ? t.budzet.wydatek : t.budzet.przychod}
              </button>
            ))}
          </div>
        )}

        <label className="flex flex-col items-center gap-1">
          <span className="text-muted text-xs font-medium">{t.budzet.kwota}</span>
          <span className="flex items-baseline gap-2">
            <input
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(false);
              }}
              inputMode="decimal"
              placeholder="0,00"
              autoFocus={!entry}
              className="text-ink w-48 bg-transparent text-center text-4xl font-semibold tabular-nums outline-none"
            />
            <span className="text-muted text-lg">{currency}</span>
          </span>
          {error && <span className="text-weekend text-xs">{t.budzet.zlaKwota}</span>}
        </label>

        {!goalEntry && (
          <div className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">{t.budzet.kategoria}</span>
            <div className="flex flex-wrap gap-2">
              {visible.map((category) => (
                <Chip
                  key={category.id}
                  label={category.name}
                  color={category.color}
                  active={categoryId === category.id && newCategory === null}
                  onClick={() => {
                    setNewCategory(null);
                    setCategoryId(categoryId === category.id ? undefined : category.id);
                  }}
                />
              ))}
              <Chip
                label={`+ ${t.budzet.nowaKategoria}`}
                active={newCategory !== null}
                onClick={() => setNewCategory(newCategory === null ? '' : null)}
              />
            </div>
            {newCategory !== null && (
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder={t.budzet.nazwa}
                maxLength={40}
                className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
              />
            )}
            {goalCategory && goalStatus && (
              <div className="bg-surface rounded-app flex flex-col gap-1.5 px-3 py-2.5" aria-live="polite">
                <span className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-ink tabular-nums">
                    {t.budzet.stanCelu(
                      Math.round(goalStatus.ratio * 100),
                      money(goalStatus.spent),
                      money(goalCategory.goal!),
                    )}
                  </span>
                  <span
                    className={`shrink-0 font-medium tabular-nums ${goalStatus.left < 0 ? 'text-weekend' : 'text-ink'}`}
                  >
                    {goalStatus.left < 0
                      ? t.budzet.ponadCel(money(-goalStatus.left))
                      : t.budzet.zostaloKwota(money(goalStatus.left))}
                  </span>
                </span>
                <GoalBar ratio={goalStatus.ratio} color={goalCategory.color} />
                {typed > 0 && <span className="text-muted text-[0.6875rem]">{t.budzet.zTymWydatkiem}</span>}
              </div>
            )}
          </div>
        )}

        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.budzet.notatka}</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.budzet.notatkaPrzyklad}
            maxLength={120}
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.budzet.data}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
          />
        </label>

        {!goalEntry && kind === 'wydatek' && members.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">{t.budzet.ktoZaplacil}</span>
            <div className="flex flex-wrap gap-2">
              <Chip label={t.budzet.nikt} active={!paidBy} onClick={() => setPaidBy(undefined)} />
              {members.map((member) => (
                <Chip
                  key={member.uid}
                  label={member.uid === meId ? `${member.name} (${t.budzet.ty})` : member.name}
                  active={paidBy === member.uid}
                  onClick={() => setPaidBy(member.uid)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={save}>
            {t.wspolne.zapisz}
          </Button>
          {entry && <Button onClick={() => setConfirmOpen(true)}>{t.budzet.usun}</Button>}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t.budzet.usun}
        message={t.wspolne.nieodwracalne}
        confirmLabel={t.budzet.usun}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </Sheet>
  );
}
