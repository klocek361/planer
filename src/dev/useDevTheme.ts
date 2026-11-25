import { useEffect } from 'react';
import { syncAndRecord } from '../sync/useAutoSync';
import { useThemeStore } from '../theme/store';
import { useDevStore } from './devMode';
import { refreshForcedThemes } from './forceTheme';
import { setThemeApplier } from './themeRecord';

/** Po zmianie wyglądu u dewelopera chwilę czekamy — suwaki zmieniają motyw co klatkę. */
const DEBOUNCE_MS = 1_500;

/**
 * Narzucony motyw w aplikacji: rejestruje nakładanie motywu z synchronizacji,
 * wczytuje tryb deweloperski, a u dewelopera rozsyła każdą zmianę wyglądu
 * do kalendarzy, w których motyw jest narzucony.
 */
export function useDevTheme(): void {
  const theme = useThemeStore((s) => s.theme);
  const key = useDevStore((s) => s.key);

  useEffect(() => {
    setThemeApplier((forced) => useThemeStore.getState().applyTheme(forced));
    void useDevStore.getState().load();
    return () => setThemeApplier(null);
  }, []);

  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => {
      void refreshForcedThemes(key, theme).then((changed) => (changed ? syncAndRecord() : undefined));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [key, theme]);
}
