import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import type { Subcategory } from '../data/types';
import { useT } from '../i18n';

interface Props {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}

/** Wybór kategorii — wspólny dla wydarzeń, zadań i nawyków. */
export function CategoryChip({ label, color, active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-app flex items-center gap-2 px-3 py-2 text-sm"
      style={{
        backgroundColor: active
          ? `color-mix(in srgb, ${color} 20%, transparent)`
          : 'var(--c-surface)',
        boxShadow: active ? `inset 0 0 0 1.5px ${color}` : 'none',
      }}
    >
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {label}
    </button>
  );
}

/**
 * Lista kategorii do wyboru wraz z opcją „Brak”.
 * Trzymana w jednym miejscu, żeby wszystkie formularze wyglądały tak samo.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: { id?: number; name: string; color: string }[];
  value: number | undefined;
  onChange: (id: number | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted text-xs font-medium">Kategoria</span>
      <div className="flex flex-wrap gap-2">
        <CategoryChip
          label="Brak"
          color="var(--c-text-muted)"
          active={value === undefined}
          onClick={() => onChange(undefined)}
        />
        {categories.map((category) => (
          <CategoryChip
            key={category.id}
            label={category.name}
            color={category.color}
            active={value === category.id}
            onClick={() => onChange(category.id)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Podkategorie wybranego wspólnego kalendarza. Gdy kalendarz ich nie ma —
 * nic się nie pokazuje.
 */
export function SubcategoryPicker({
  categoryId,
  value,
  onChange,
}: {
  categoryId: number | undefined;
  value: number | undefined;
  onChange: (id: number | undefined) => void;
}) {
  const { t } = useT();
  const subcategories = useLiveQuery(
    () => (categoryId === undefined ? [] : db.subcategories.where('categoryId').equals(categoryId).sortBy('order')),
    [categoryId],
    [],
  );
  if (subcategories.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted text-xs font-medium">{t.podkategorie.wybor}</span>
      <div className="flex flex-wrap gap-2">
        <CategoryChip
          label={t.podkategorie.zadna}
          color="var(--c-text-muted)"
          active={value === undefined}
          onClick={() => onChange(undefined)}
        />
        {subcategories.map((sub) => (
          <CategoryChip
            key={sub.id}
            label={sub.name}
            color={sub.color}
            active={value === sub.id}
            onClick={() => onChange(sub.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Podkategorie wszystkich kalendarzy po id — do nazw i kolorów przy wpisach. */
export function useSubcategoryMap(): Map<number, Subcategory> {
  const all = useLiveQuery(() => db.subcategories.toArray(), [], []);
  return useMemo(() => new Map(all.filter((s) => s.id !== undefined).map((s) => [s.id!, s])), [all]);
}
