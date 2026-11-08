import { useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (digits: string) => void;
  length?: number;
  label: string;
  /** Wywoływane, gdy wpisano wszystkie cyfry. */
  onComplete?: (digits: string) => void;
}

/**
 * Pole na kod z cyframi w osobnych okienkach. Pod spodem jest jedno zwykłe
 * pole tekstowe (niewidoczne, na całej szerokości) — dzięki temu działa
 * klawiatura numeryczna, wklejanie całego kodu i podpowiedź kodu z SMS-a.
 */
export function CodeInput({ value, onChange, length = 8, label, onComplete }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const cells = Array.from({ length }, (_, i) => value[i] ?? '');
  const half = Math.floor(length / 2);

  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={value}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, length);
          onChange(digits);
          if (digits.length === length) onComplete?.(digits);
        }}
        // 16 px, żeby iOS nie powiększał strony przy wpisywaniu.
        className="absolute inset-0 h-full w-full text-base opacity-0"
      />
      <div className="flex gap-1.5" aria-hidden="true">
        {cells.map((digit, i) => (
          <span
            key={i}
            className={`bg-surface rounded-app text-ink flex h-12 flex-1 items-center justify-center text-xl font-semibold tabular-nums ${
              i === half ? 'ml-2' : ''
            }`}
            style={{
              boxShadow:
                focused && i === Math.min(value.length, length - 1)
                  ? 'inset 0 0 0 2px var(--c-accent)'
                  : 'none',
            }}
          >
            {digit}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Kod do pokazania człowiekowi: „1234 5678”. */
export function formatCode(code: string): string {
  const half = Math.floor(code.length / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`;
}
