import { useEffect, useState } from 'react';
import { addHabit, deleteHabit, updateHabit } from '../../data/habits';
import type { Category, Habit, HabitKind, HabitPeriod } from '../../data/types';
import { useT } from '../../i18n';
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

const KINDS: HabitKind[] = ['tak-nie', 'licznik'];

const PERIODS: HabitPeriod[] = ['ciagly', 'miesiac'];

export function HabitSheet({ open, habit, categories, onClose }: Props) {
  const { t } = useT();
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
    <Sheet
      open={open}
      title={habit ? t.nawyki.edytujNawyk : t.nawyki.nowyNawyk}
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.wspolne.nazwa}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.nawyki.nazwaPrzyklad}
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.nawyki.rodzaj}</span>
          <div className="flex gap-2">
            {KINDS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setKind(item)}
                aria-pressed={kind === item}
                className={`rounded-app flex-1 px-3 py-2.5 text-left text-sm ${
                  kind === item ? 'bg-selected text-selected-ink' : 'bg-surface text-ink'
                }`}
              >
                <span className="block font-medium">
                  {item === 'tak-nie' ? t.nawyki.takNie : t.nawyki.licznik}
                </span>
                <span className="block text-xs opacity-70">
                  {item === 'tak-nie' ? t.nawyki.takNieOpis : t.nawyki.licznikOpis}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.nawyki.odliczanie}</span>
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
                <span className="block font-medium">
                  {item === 'ciagly' ? t.nawyki.ciagle : t.nawyki.miesiacami}
                </span>
                <span className="block text-xs opacity-70">
                  {item === 'ciagly' ? t.nawyki.ciagleOpis : t.nawyki.miesiacamiOpis}
                </span>
              </button>
            ))}
          </div>
        </div>

        {kind === 'licznik' && (
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-2">
              <span className="text-muted text-xs font-medium">{t.nawyki.celDzienny}</span>
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
              <span className="text-muted text-xs font-medium">{t.nawyki.jednostka}</span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={t.nawyki.jednostkaPrzyklad}
                className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
              />
            </label>
          </div>
        )}

        {!targetValid && (
          <p className="text-weekend -mt-3 text-xs">{t.nawyki.zlyCel}</p>
        )}

        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={!canSave} onClick={save}>
            {t.wspolne.zapisz}
          </Button>
          {habit && (
            <Button variant="danger" aria-label={t.nawyki.usunNawyk} onClick={() => setConfirmOpen(true)} className="px-4">
              <TrashIcon className="h-5 w-5" />
            </Button>
          )}
        </div>

        {habit && (
          <p className="text-muted -mt-2 text-xs">
            {t.nawyki.uwagaHistoria}
          </p>
        )}

        <ConfirmDialog
          open={confirmOpen}
          title={t.nawyki.pytanieNawyk(habit?.name ?? '')}
          message={t.nawyki.opisNawyk}
          onConfirm={remove}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    </Sheet>
  );
}
