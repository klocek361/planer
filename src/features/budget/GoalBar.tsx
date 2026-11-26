/** Pasek postępu do celu. Ponad cel — kolor ostrzegawczy, bez alarmu. */
export function GoalBar({ ratio, color }: { ratio: number; color: string }) {
  const over = ratio > 1;
  return (
    <span className="bg-bg block h-1.5 overflow-hidden rounded-full">
      <span
        className="block h-full rounded-full transition-[width]"
        style={{
          width: `${Math.min(100, Math.round(ratio * 100))}%`,
          backgroundColor: over ? 'var(--c-weekend)' : color,
        }}
      />
    </span>
  );
}
