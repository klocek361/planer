/**
 * Rachunki na kolorach — potrzebne, żeby edytor wyglądu mógł ostrzec, kiedy
 * dobrane barwy robią tekst nieczytelnym, i żeby aplikacja sama rozpoznała,
 * czy zbudowany motyw jest jasny czy ciemny.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb | null {
  const raw = hex.trim().replace(/^#/, '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

/** Jasność względna wg WCAG — 0 to czerń, 1 to biel. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;

  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** Stosunek kontrastu wg WCAG: od 1 (brak) do 21 (czerń na bieli). */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Czy tło jest ciemne. Używane zamiast zapamiętanego trybu — dzięki temu
 * własnoręcznie zbudowany ciemny motyw i tak dostanie ciemne kontrolki
 * systemowe (kalendarzyk daty, zegar), bez pytania użytkowniczki o tryb.
 */
export function isDarkColor(hex: string): boolean {
  return relativeLuminance(hex) < 0.4;
}

/** Próg czytelności dla zwykłego tekstu wg WCAG AA. */
export const READABLE_CONTRAST = 4.5;
