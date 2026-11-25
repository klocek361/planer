import { db } from '../data/db';
import { themeJson } from '../sync/engine';
import type { Theme } from '../theme/types';
import { signTheme } from './devMode';
import { canonicalTheme, themeUid } from './themeRecord';

/**
 * Strona dewelopera: włączenie i wyłączenie narzuconego motywu w kalendarzu.
 * Sam zapis — wysyła go najbliższa synchronizacja.
 */

/** Podpisuje motyw i zapisuje go jako narzucony w kalendarzu. */
export async function setForcedTheme(key: CryptoKey, space: string, theme: Theme): Promise<void> {
  const signed = await signTheme(key, space, theme, Date.now());
  await db.syncState.update(space, { motyw: themeJson(themeUid(space), signed.theme, signed.at, signed.sig) });
}

export async function clearForcedTheme(space: string): Promise<void> {
  await db.syncState.update(space, { motyw: undefined });
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
 * kalendarzach, w których jest narzucony. Zwraca, czy coś się zmieniło.
 */
export async function refreshForcedThemes(key: CryptoKey, theme: Theme): Promise<boolean> {
  let changed = false;
  for (const state of await db.syncState.toArray()) {
    if (state.motyw && forcedThemeOutdated(state.motyw, theme)) {
      await setForcedTheme(key, state.id, theme);
      changed = true;
    }
  }
  return changed;
}
