import { FONT_STACKS, TEXTURE_CSS } from './catalog';
import { isDarkColor } from './color';
import type { Theme } from './types';

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/**
 * Przepisuje motyw na zmienne CSS na elemencie <html>.
 * To jedyne miejsce, w którym motyw dotyka DOM — komponenty czytają wyłącznie
 * zmienne przez klasy Tailwinda (bg-surface, text-muted itd.).
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--c-${kebab(key)}`, value);
  }

  root.style.setProperty('--f-app', FONT_STACKS[theme.typography.fontId]);
  root.style.setProperty('--font-scale', String(theme.typography.scale));
  root.style.setProperty('--r-app', `${theme.shape.radius}px`);
  root.style.setProperty('--density', String(theme.shape.density));
  root.style.setProperty('--texture', TEXTURE_CSS[theme.texture]);

  // Tryb kontrolek systemowych (kalendarzyk daty, zegar) wynika z jasności tła,
  // a nie z zapamiętanego ustawienia — własnoręcznie zbudowany ciemny motyw
  // dostanie ciemne kontrolki bez pytania o cokolwiek.
  root.style.colorScheme = isDarkColor(theme.colors.bg) ? 'dark' : 'light';

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.colors.bg);
}
