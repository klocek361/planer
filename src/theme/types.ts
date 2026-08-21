/**
 * Motyw jest jedynym źródłem prawdy o wyglądzie aplikacji.
 * Każde pole trafia do zmiennej CSS, więc dodanie nowej opcji personalizacji
 * sprowadza się do rozszerzenia tych typów — komponentów nie trzeba ruszać.
 */

export type ColorKey =
  | 'bg'
  | 'surface'
  | 'surfaceAlt'
  | 'text'
  | 'textMuted'
  | 'textFaint'
  | 'accent'
  | 'weekend'
  | 'star'
  | 'selectedBg'
  | 'selectedText'
  | 'border';

export type ThemeColors = Record<ColorKey, string>;

export type FontId = 'system' | 'inter' | 'literata' | 'nunito' | 'jetbrains' | 'caveat';

export type TextureId = 'none' | 'paper' | 'canvas' | 'grid' | 'dots';

export type ThemeMode = 'light' | 'dark';

export interface Theme {
  id: string;
  name: string;
  mode: ThemeMode;
  colors: ThemeColors;
  typography: {
    fontId: FontId;
    /** Mnożnik rozmiaru pisma, 1 = domyślny (16 px). */
    scale: number;
  };
  shape: {
    /** Zaokrąglenie rogów w pikselach. */
    radius: number;
    /** Gęstość interfejsu — mnożnik odstępów, 1 = domyślna. */
    density: number;
  };
  texture: TextureId;
}
