import { useEffect, useState } from 'react';
import {
  addEntry,
  addGoal,
  amountToInput,
  deleteGoal,
  formatMoney,
  parseAmount,
  updateGoal,
} from '../../data/budget';
import type { MoneyEntry, SavingsGoal } from '../../data/types';
import { useT } from '../../i18n';
import { toKey } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/Confirm';
import { Sheet } from '../../ui/Sheet';

interface Props {
  open: boolean;
  /** Skarbonka do wpłat i edycji; pusta — nowa skarbonka. */
  goal: SavingsGoal | null;
  /** Wpłaty i wypłaty tej skarbonki, od najnowszych. */
  history: MoneyEntry[];
  saved: number;
  currency: string;
  onClose: () => void;
}

/**
 * Skarbonka: wpłata albo wypłata jednym ruchem, historia, a niżej nazwa,
 * kwota docelowa i termin. Nowa skarbonka — same pola.
 */
export function GoalSheet({ open, goal, history, saved, currency, onClose }: Props) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [money, setMoney] = useState('');
  const [error, setError] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? '');
    setTarget(goal ? amountToInput(goal.target) : '');
    setDeadline(goal?.deadline ?? '');
    setMoney('');
    setError(false);
  }, [open, goal]);

  const move = async (kind: 'wplata' | 'wyplata') => {
    const grosze = parseAmount(money);
    if (!grosze || !goal?.id) {
      setError(true);
      return;
    }
    await addEntry({ kind, amount: grosze, date: toKey(new Date()), goalId: goal.id });
    setMoney('');
  };

  const save = async () => {
    const grosze = parseAmount(target);
    if (!name.trim() || !grosze) {
      setError(true);
      return;
    }
    if (goal?.id) await updateGoal(goal.id, { name, target: grosze, deadline: deadline || undefined });
    else await addGoal(name, grosze, deadline || undefined);
    onClose();
  };

  const remove = async () => {
    setConfirmOpen(false);
    if (goal?.id) await deleteGoal(goal.id);
    onClose();
  };

  return (
    <Sheet open={open} title={goal?.name ?? t.budzet.nowaSkarbonka} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {goal && (
          <div className="flex flex-col gap-3">
            <p className="text-ink text-center text-2xl font-semibold tabular-nums">
              {formatMoney(saved, currency)}
              <span className="text-muted text-base font-normal"> / {formatMoney(goal.target, currency)}</span>
            </p>
            <div className="flex gap-2">
              <input
                value={money}
                onChange={(e) => {
                  setMoney(e.target.value);
                  setError(false);
                }}
                inputMode="decimal"
                placeholder="0,00"
                className="bg-surface rounded-app text-ink min-w-0 flex-1 px-3 py-2.5 text-base tabular-nums"
              />
              <Button variant="primary" onClick={() => move('wplata')}>
                {t.budzet.wplac}
              </Button>
              <Button onClick={() => move('wyplata')}>{t.budzet.wyplac}</Button>
            </div>
            {history.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-muted text-xs font-medium">{t.budzet.historia}</span>
                <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                  {history.map((entry) => (
                    <li key={entry.id} className="flex justify-between text-sm">
                      <span className="text-muted">{entry.date}</span>
                      <span className={`tabular-nums ${entry.kind === 'wplata' ? 'text-accent' : 'text-ink'}`}>
                        {entry.kind === 'wplata' ? '+' : '−'}
                        {formatMoney(entry.amount, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.budzet.nazwa}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">
            {t.budzet.celKwota} ({currency})
          </span>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.budzet.termin}</span>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
          />
        </label>
        {error && <p className="text-weekend text-xs">{t.budzet.zlaKwota}</p>}

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={save}>
            {t.wspolne.zapisz}
          </Button>
          {goal && <Button onClick={() => setConfirmOpen(true)}>{t.budzet.usun}</Button>}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t.budzet.usun}
        message={t.budzet.usunSkarbonkePyt}
        confirmLabel={t.budzet.usun}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </Sheet>
  );
}
