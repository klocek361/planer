import { useEffect, useState } from 'react';
import { addHabit, deleteHabit, updateHabit } from '../../data/habits';
import {
  HABIT_PERIOD_HINTS,
  HABIT_PERIOD_LABELS,
  type Category,
  type Habit,
  type HabitKind,
  type HabitPeriod,
} from '../../data/types';
import { Button } from '../../ui/Button';
import { CategoryPicker } from '../../ui/CategoryChip';
import { ConfirmDialog } from '../../ui/Confirm';
import { Sheet } from '../../ui/Sheet';
import { TrashIcon } from '../../ui/icons';

interface Props {
  open: boolean;
  habit: Habit | null;
  categories: Category[];
  onClose: () => void;
}

const KINDS: { id: HabitKind; label: string; hint: string }[] = [
  { id: 'tak-nie', label: 'Tak / nie', hint: 'Odhaczasz raz dziennie' },
  { id: 'licznik', label: 'Licznik', hint: 'Zliczasz powtórzenia do celu' },
];

const PERIODS: HabitPeriod[] = ['ciagly', 'miesiac'];

export function HabitSheet({ open, habit, categories, onClose }: Props) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<HabitKind>('tak-nie');
  const [target, setTarget] = useState('8');
  const [unit, setUnit] = useState('');
  const [period, setPeriod] = useState<HabitPeriod>('ciagly');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(habit?.name ?? '');
    setKind(habit?.kind ?? 'tak-nie');
    setTarget(String(habit?.target ?? 8));
    setUnit(habit?.unit ?? '');
    setPeriod(habit?.period ?? 'ciagly');
    setCategoryId(habit?.categoryId);
  }, [open, habit]);

  const trimmed = name.trim();
  const parsedTarget = Number.parseInt(target, 10);
  const targetValid = kind === 'tak-nie' || (Number.isFinite(parsedTarget) && parsedTarget >= 1);
  const canSave = trimmed.length > 0 && targetValid;

  const save = async () => {
    if (!canSave) return;
    const draft = {
      name: trimmed,
      kind,
      target: kind === 'tak-nie' ? 1 : parsedTarget,
      unit: kind === 'licznik' && unit.trim() ? unit.trim() : undefined,
      period,
      categoryId,
    };
    if (habit?.id) await updateHabit(habit.id, draft);
    else await addHabit(draft);
    onClose();
  };

  const remove = async () => {
    setConfirmOpen(false);
    if (habit?.id) await deleteHabit(habit.id);
    onClose();
  };

  return (
    <Sheet open={open} title={habit ? 'Edytuj nawyk' : 'Nowy nawyk'} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">Nazwa</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Wypić wodę"
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">Rodzaj</span>
          <div className="flex gap-2">
            {KINDS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setKind(item.id)}
                aria-pressed={kind === item.id}
                className={`rounded-app flex-1 px-3 py-2.5 text-left text-sm ${
                  kind === item.id ? 'bg-selected text-selected-ink' : 'bg-surface text-ink'
                }`}
              >
                <span className="block font-medium">{item.label}</span>
                <span className="block text-xs opacity-70">{item.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">Odliczanie</span>
          <div className="flex gap-2">
            {PERIODS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                aria-pressed={period === item}
                className={`rounded-app flex-1 px-3 py-2.5 text-left text-sm ${
                  period === item ? 'bg-selected text-selected-ink' : 'bg-surface text-ink'
                }`}
              >
                <span className="block font-medium">{HABIT_PERIOD_LABELS[item]}</span>
                <span className="block text-xs opacity-70">{HABIT_PERIOD_HINTS[item]}</span>
              </button>
            ))}
          </div>
        </div>

        {kind === 'licznik' && (
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-2">
              <span className="text-muted text-xs font-medium">Cel dzienny</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
              />
            </label>
            <label className="flex flex-1 flex-col gap-2">
              <span className="text-muted text-xs font-medium">Jednostka</span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="np. szklanek"
                className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
              />
            </label>
          </div>
        )}

        {!targetValid && (
          <p className="text-weekend -mt-3 text-xs">Cel musi być liczbą co najmniej 1.</p>
        )}

        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={!canSave} onClick={save}>
            Zapisz
          </Button>
          {habit && (
            <Button variant="danger" aria-label="Usuń nawyk" onClick={() => setConfirmOpen(true)} className="px-4">
              <TrashIcon className="h-5 w-5" />
            </Button>
          )}
        </div>

        {habit && (
          <p className="text-muted -mt-2 text-xs">
            Usunięcie nawyku kasuje też całą jego historię.
          </p>
        )}

        <ConfirmDialog
          open={confirmOpen}
          title={`Usunąć nawyk „${habit?.name ?? ''}”?`}
          message="Zniknie razem z całą historią odhaczeń. Tego nie da się cofnąć."
          onConfirm={remove}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    </Sheet>
  );
}
