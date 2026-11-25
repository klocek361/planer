import { db } from '../data/db';
import { themeJson } from '../sync/engine';
import type { Theme } from '../theme/types';
import { signTheme } from './devMode';
import { canonicalTheme, parseThemeText, themeUid } from './themeRecord';

/**
 * Strona dewelopera: włączenie i wyłączenie narzuconego motywu w kalendarzu.
 * Sam zapis — wysyła go najbliższa synchronizacja.
 */

/**
 * Podpisuje motyw i zapisuje go jako narzucony w kalendarzu. `fixed` — wybrany
 * zestaw, który zostaje, gdy deweloper zmienia swój wygląd; bez tego narzucony
 * jest bieżący wygląd i podąża za każdą zmianą (`refreshForcedThemes`).
 */
export async function setForcedTheme(key: CryptoKey, space: string, theme: Theme, fixed = false): Promise<void> {
  const signed = await signTheme(key, space, theme, Date.now());
  await db.syncState.update(space, {
    motyw: themeJson(themeUid(space), signed.theme, signed.at, signed.sig),
    motywStaly: fixed || undefined,
  });
}

export async function clearForcedTheme(space: string): Promise<void> {
  await db.syncState.update(space, { motyw: undefined, motywStaly: undefined });
}

/** Zestaw zapisany w narzuconym motywie (do zaznaczenia wyboru) albo null. */
export function forcedThemeId(motyw: string | undefined): string | null {
  if (!motyw) return null;
  try {
    return parseThemeText((JSON.parse(motyw) as { theme?: unknown }).theme)?.id ?? null;
  } catch {
    return null;
  }
}

/** Czy zapisany narzucony motyw różni się od podanego (deweloper zmienił wygląd). */
export function forcedThemeOutdated(motyw: string, theme: Theme): boolean {
  try {
    return (JSON.parse(motyw) as { theme?: unknown }).theme !== canonicalTheme(theme);
  } catch {
    return true;
  }
}

/**
 * Po zmianie motywu u dewelopera — podpisuje go od nowa we wszystkich
 * kalendarzach, w których narzucony jest bieżący wygląd (nie wybrany zestaw).
 * Zwraca, czy coś się zmieniło.
 */
export async function refreshForcedThemes(key: CryptoKey, theme: Theme): Promise<boolean> {
  let changed = false;
  for (const state of await db.syncState.toArray()) {
    if (state.motyw && !state.motywStaly && forcedThemeOutdated(state.motyw, theme)) {
      await setForcedTheme(key, state.id, theme);
      changed = true;
    }
  }
  return changed;
}
