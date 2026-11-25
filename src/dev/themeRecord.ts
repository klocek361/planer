import { sanitizeTheme } from '../data/validate';
import type { Theme } from '../theme/types';

/**
 * Narzucony motyw kalendarza jako rekord synchronizacji (litera 'w').
 * Jeden na kalendarz; podpisany kluczem deweloperskim (`devMode.ts`).
 */

/** `uid` rekordu motywu — stały dla kalendarza. */
export const themeUid = (space: string) => `motyw${space}`;

/** Motyw jako tekst o stałej kolejności pól — ten sam motyw daje zawsze ten sam podpis. */
export const canonicalTheme = (theme: Theme): string => JSON.stringify(sanitizeTheme(theme));

/** Motyw z podpisanego tekstu albo null, gdy tekst nie jest motywem. */
export function parseThemeText(text: unknown): Theme | null {
  if (typeof text !== 'string' || text.length > 4000) return null;
  try {
    return sanitizeTheme(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * Nakładanie motywu na telefonie. Silnik synchronizacji nie zna sklepu
 * z motywem (działa też w testach, bez przeglądarki), więc aplikacja
 * rejestruje tu funkcję przy starcie.
 */
let applier: ((theme: Theme) => void) | null = null;

export function setThemeApplier(fn: ((theme: Theme) => void) | null): void {
  applier = fn;
}

export function applyForcedTheme(theme: Theme): void {
  applier?.(theme);
}
