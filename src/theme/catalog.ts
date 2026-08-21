import type { ColorKey, FontId, TextureId } from './types';

/**
 * Kroje pisma dostępne w ustawieniach. Wszystkie są w paczce, więc działają
 * offline. Nazwy i opisy siedzą w słownikach — tutaj tylko to, co techniczne.
 */
export const FONTS: { id: FontId; stack: string }[] = [
  {
    id: 'system',
    stack: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  },
  {
    id: 'inter',
    stack: '"Inter Variable", system-ui, sans-serif',
  },
  {
    id: 'literata',
    stack: '"Literata Variable", Georgia, serif',
  },
  {
    id: 'nunito',
    stack: '"Nunito Variable", system-ui, sans-serif',
  },
  {
    id: 'jetbrains',
    stack: '"JetBrains Mono Variable", ui-monospace, monospace',
  },
  {
    id: 'caveat',
    stack: '"Caveat Variable", cursive',
  },
];

export const FONT_STACKS = Object.fromEntries(FONTS.map((f) => [f.id, f.stack])) as Record<
  FontId,
  string
>;

/**
 * Kolejność pól w edytorze wyglądu. Trzymana osobno od typów, żeby edytor mógł
 * się wyrenderować sam z tej listy, bez ręcznego wypisywania pól. Nazwy i opisy
 * pól są w słownikach.
 */
export const COLOR_FIELDS: { key: ColorKey }[] = [
  { key: 'bg' },
  { key: 'surface' },
  { key: 'surfaceAlt' },
  { key: 'text' },
  { key: 'textMuted' },
  { key: 'textFaint' },
  { key: 'accent' },
  { key: 'weekend' },
  { key: 'star' },
  { key: 'selectedBg' },
  { key: 'selectedText' },
  { key: 'border' },
];

/** Tekstury tła jako obrazki SVG wpisane w CSS — nic się nie pobiera z sieci. */
export const TEXTURES: { id: TextureId; css: string }[] = [
  { id: 'none', css: 'none' },
  {
    id: 'paper',
    css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")`,
  },
  {
    id: 'canvas',
    css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpath d='M0 0h8v1H0zM0 0v8h1V0z' fill='%23000' opacity='0.03'/%3E%3C/svg%3E")`,
  },
  {
    id: 'grid',
    css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M24 0H0v24' fill='none' stroke='%23000' stroke-width='1' opacity='0.05'/%3E%3C/svg%3E")`,
  },
  {
    id: 'dots',
    css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23000' opacity='0.07'/%3E%3C/svg%3E")`,
  },
];

export const TEXTURE_CSS = Object.fromEntries(TEXTURES.map((t) => [t.id, t.css])) as Record<
  TextureId,
  string
>;
