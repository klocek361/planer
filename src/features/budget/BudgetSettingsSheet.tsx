import { useEffect, useState } from 'react';
import {
  CURRENCIES,
  addDefaultCategories,
  addMoneyCategory,
  amountToInput,
  deleteMoneyCategory,
  parseAmount,
  saveBudgetSettings,
  updateMoneyCategory,
} from '../../data/budget';
import type { BudgetSettings, Category, MoneyCategory, MoneyKind } from '../../data/types';
import { useT } from '../../i18n';
import { DEFAULT_CATEGORY_COLORS } from '../../theme/presets';
import { Button } from '../../ui/Button';
import { ColorPicker } from '../../ui/ColorPicker';
import { ConfirmDialog } from '../../ui/Confirm';
import { Sheet } from '../../ui/Sheet';
import { Chip } from './EntrySheet';

interface Props {
  open: boolean;
  settings: BudgetSettings;
  /** Kategorie wspólnych kalendarzy, do których można przypiąć budżet. */
  sharedCategories: Category[];
  categories: MoneyCategory[];
  onClose: () => void;
}

/** Ustawienia budżetu: waluta, przypięcie do wspólnego kalendarza, kategorie. */
export function BudgetSettingsSheet({ open, settings, sharedCategories, categories, onClose }: Props) {
  const { t } = useT();
  const [editing, setEditing] = useState<MoneyCategory | { kind: MoneyKind } | null>(null);

  const row = (kind: MoneyKind) => (
    <div className="flex flex-col gap-2">
      <span className="text-muted text-xs font-medium">
        {kind === 'wydatek' ? t.budzet.katWydatkow : t.budzet.katPrzychodow}
      </span>
      <div className="flex flex-wrap gap-2">
        {categories
          .filter((c) => c.kind === kind)
          .map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              color={category.color}
              active={false}
              onClick={() => setEditing(category)}
            />
          ))}
        <Chip label={`+ ${t.budzet.nowaKategoria}`} active={false} onClick={() => setEditing({ kind })} />
      </div>
    </div>
  );

  return (
    <Sheet open={open} title={t.budzet.ustawienia} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.budzet.waluta}</span>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((code) => (
              <Chip
                key={code}
                label={code}
                active={settings.currency === code}
                onClick={() => void saveBudgetSettings({ currency: code })}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.budzet.wspolny}</span>
          <div className="flex flex-wrap gap-2">
            <Chip
              label={t.budzet.prywatny}
              active={settings.categoryId === undefined}
              onClick={() => void saveBudgetSettings({ categoryId: undefined })}
            />
            {sharedCategories.map((category) => (
              <Chip
                key={category.id}
                label={`👥 ${category.name}`}
                color={category.color}
                active={settings.categoryId === category.id}
                onClick={() => void saveBudgetSettings({ categoryId: category.id })}
              />
            ))}
          </div>
          <span className="text-muted text-xs">{t.budzet.wspolnyOpis}</span>
        </div>

        {row('wydatek')}
        {row('przychod')}

        {categories.length === 0 && (
          <Button
            onClick={() =>
              void addDefaultCategories(t.budzet.domyslneWydatki, t.budzet.domyslnePrzychody)
            }
          >
            {t.budzet.dodajDomyslne}
          </Button>
        )}
      </div>

      <CategoryEditSheet editing={editing} onClose={() => setEditing(null)} />
    </Sheet>
  );
}

/** Nazwa, kolor i cel miesięczny jednej kategorii pieniędzy. */
function CategoryEditSheet({
  editing,
  onClose,
}: {
  editing: MoneyCategory | { kind: MoneyKind } | null;
  onClose: () => void;
}) {
  const { t } = useT();
  const existing = editing && 'id' in editing ? editing : null;
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLORS[0]!);
  const [goal, setGoal] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setName(existing?.name ?? '');
    setColor(existing?.color ?? DEFAULT_CATEGORY_COLORS[0]!);
    setGoal(existing?.goal ? amountToInput(existing.goal) : '');
  }, [editing, existing]);

  const save = async () => {
    if (!editing || !name.trim()) return;
    const parsed = parseAmount(goal) ?? undefined;
    if (existing?.id) await updateMoneyCategory(existing.id, { name, color, goal: parsed });
    else await addMoneyCategory(editing.kind, name, color, parsed);
    onClose();
  };

  return (
    <Sheet open={editing !== null} title={existing?.name ?? t.budzet.nowaKategoria} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.budzet.nazwa}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
          />
        </label>
        <ColorPicker value={color} onChange={setColor} presets={DEFAULT_CATEGORY_COLORS} />
        {editing?.kind === 'wydatek' && (
          <label className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">{t.budzet.celMiesieczny}</span>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="bg-surface rounded-app text-ink px-3 py-2.5 text-base tabular-nums"
            />
          </label>
        )}
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={!name.trim()} onClick={save}>
            {t.wspolne.zapisz}
          </Button>
          {existing && <Button onClick={() => setConfirmOpen(true)}>{t.budzet.usun}</Button>}
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={t.budzet.usun}
        message={t.budzet.usunKategoriePyt}
        confirmLabel={t.budzet.usun}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setConfirmOpen(false);
          if (existing?.id) await deleteMoneyCategory(existing.id);
          onClose();
        }}
      />
    </Sheet>
  );
}
