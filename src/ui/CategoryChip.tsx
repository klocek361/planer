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
