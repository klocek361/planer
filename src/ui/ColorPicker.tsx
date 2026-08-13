import { useEffect, useState } from 'react';
import { HexColorPicker } from 'react-colorful';

interface Props {
  value: string;
  onChange: (hex: string) => void;
  /** Szybkie próbki nad kołem barw. */
  presets?: string[];
}

/** Uzupełnia skrót typu '#abc' do pełnego zapisu i sprawdza poprawność. */
function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return null;
}

/**
 * Wybór koloru na dwa sposoby: z palety barw albo przez wpisanie kodu HEX.
 * Pole tekstowe ma własny stan, żeby dało się swobodnie kasować i dopisywać
 * znaki — do rodzica trafia dopiero poprawny, kompletny kolor.
 */
export function ColorPicker({ value, onChange, presets = [] }: Props) {
  const [text, setText] = useState(value);

  // Nadążanie za zmianami z zewnątrz (koło barw, próbki).
  useEffect(() => setText(value), [value]);

  const handleText = (next: string) => {
    setText(next);
    const hex = normalizeHex(next);
    if (hex) onChange(hex);
  };

  const isValid = normalizeHex(text) !== null;

  return (
    <div className="flex flex-col gap-4">
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              aria-label={`Kolor ${preset}`}
              className="h-9 w-9 rounded-full"
              style={{
                backgroundColor: preset,
                outline: preset.toUpperCase() === value.toUpperCase() ? '2px solid' : 'none',
                outlineColor: 'var(--c-text)',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>
      )}

      <HexColorPicker
        color={value}
        onChange={onChange}
        style={{ width: '100%', height: '11rem' }}
      />

      <div className="flex items-center gap-3">
        <span
          className="rounded-app border-line h-11 w-11 shrink-0 border"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        <label className="flex-1">
          <span className="sr-only">Kod koloru HEX</span>
          <input
            value={text}
            onChange={(e) => handleText(e.target.value)}
            spellCheck={false}
            autoCapitalize="characters"
            autoCorrect="off"
            placeholder="#RRGGBB"
            className={`bg-surface rounded-app text-ink w-full px-3 py-2.5 font-mono text-sm tracking-wider ${
              isValid ? '' : 'text-weekend'
            }`}
          />
        </label>
      </div>
      {!isValid && (
        <p className="text-muted -mt-2 text-xs">
          Wpisz kod w formacie #RRGGBB, na przykład #9C6F4A.
        </p>
      )}
    </div>
  );
}
