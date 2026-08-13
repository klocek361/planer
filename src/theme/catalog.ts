import type { ColorKey, FontId, TextureId } from './types';

/** Kroje pisma dostępne w ustawieniach. Wszystkie są w paczce, więc działają offline. */
export const FONTS: { id: FontId; label: string; hint: string; stack: string }[] = [
  {
    id: 'system',
    label: 'Systemowy',
    hint: 'Krój iOS — najbardziej naturalny na iPhonie',
    stack: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  },
  {
    id: 'inter',
    label: 'Neutralny',
    hint: 'Czysty i bezosobowy, dobrze czytelny w małych rozmiarach',
    stack: '"Inter Variable", system-ui, sans-serif',
  },
  {
    id: 'literata',
    label: 'Szeryfowy',
    hint: 'Cieplejszy, książkowy charakter',
    stack: '"Literata Variable", Georgia, serif',
  },
  {
    id: 'nunito',
    label: 'Zaokrąglony',
    hint: 'Miękki i przyjazny',
    stack: '"Nunito Variable", system-ui, sans-serif',
  },
  {
    id: 'jetbrains',
    label: 'Techniczny',
    hint: 'Stała szerokość znaków, cyfry idealnie w kolumnach',
    stack: '"JetBrains Mono Variable", ui-monospace, monospace',
  },
  {
    id: 'caveat',
    label: 'Odręczny',
    hint: 'Styl notesu pisanego ręcznie',
    stack: '"Caveat Variable", cursive',
  },
];

export const FONT_STACKS = Object.fromEntries(FONTS.map((f) => [f.id, f.stack])) as Record<
  FontId,
  string
>;

/**
 * Kolejność i opisy pól w edytorze wyglądu. Trzymane osobno od typów, żeby
 * edytor mógł się wyrenderować sam z tej listy, bez ręcznego wypisywania pól.
 */
export const COLOR_FIELDS: { key: ColorKey; label: string; hint: string }[] = [
  { key: 'bg', label: 'Tło aplikacji', hint: 'Główne tło pod wszystkim' },
  { key: 'surface', label: 'Panele i przyciski', hint: 'Tło kart, pól i przycisków' },
  { key: 'surfaceAlt', label: 'Dzisiejszy dzień', hint: 'Podświetlenie bieżącej daty' },
  { key: 'text', label: 'Tekst główny', hint: 'Cyfry dni, tytuły, treść' },
  { key: 'textMuted', label: 'Tekst przygaszony', hint: 'Nagłówki dni tygodnia, podpisy' },
  { key: 'textFaint', label: 'Tekst ledwie widoczny', hint: 'Dni z sąsiednich miesięcy' },
  { key: 'accent', label: 'Akcent', hint: 'Aktywna zakładka i elementy wyróżnione' },
  { key: 'weekend', label: 'Weekend', hint: 'Cyfry sobót i niedziel' },
  { key: 'selectedBg', label: 'Zaznaczony dzień — tło', hint: 'Kafelek klikniętego dnia' },
  { key: 'selectedText', label: 'Zaznaczony dzień — cyfra', hint: 'Tekst na tym kafelku' },
  { key: 'border', label: 'Linie i obramowania', hint: 'Delikatne kreski rozdzielające' },
];

/** Tekstury tła jako obrazki SVG wpisane w CSS — nic się nie pobiera z sieci. */
export const TEXTURES: { id: TextureId; label: string; css: string }[] = [
  { id: 'none', label: 'Gładkie', css: 'none' },
  {
    id: 'paper',
    label: 'Papier',
    css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")`,
  },
  {
    id: 'canvas',
    label: 'Płótno',
    css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpath d='M0 0h8v1H0zM0 0v8h1V0z' fill='%23000' opacity='0.03'/%3E%3C/svg%3E")`,
  },
  {
    id: 'grid',
    label: 'Kratka',
    css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M24 0H0v24' fill='none' stroke='%23000' stroke-width='1' opacity='0.05'/%3E%3C/svg%3E")`,
  },
  {
    id: 'dots',
    label: 'Kropki',
    css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23000' opacity='0.07'/%3E%3C/svg%3E")`,
  },
];

export const TEXTURE_CSS = Object.fromEntries(TEXTURES.map((t) => [t.id, t.css])) as Record<
  TextureId,
  string
>;
