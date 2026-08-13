import { useLayoutEffect } from 'react';
import { applyTheme } from './applyTheme';
import { useThemeStore } from './store';

/** Utrzymuje zmienne CSS w zgodzie z aktualnym motywem. */
export function useApplyTheme(): void {
  const theme = useThemeStore((s) => s.theme);
  useLayoutEffect(() => applyTheme(theme), [theme]);
}
