import { create } from 'zustand';
import { currentDict } from '../i18n';
import { persist } from 'zustand/middleware';
import { sanitizeTheme, sanitizeThemeList } from '../data/validate';
import { DEFAULT_THEME, PRESETS } from './presets';
import type { ColorKey, Theme } from './types';

interface ThemeState {
  theme: Theme;
  /** Własne motywy zapisane przez użytkowniczkę. */
  saved: Theme[];
  setColor: (key: ColorKey, value: string) => void;
  patch: (partial: Partial<Omit<Theme, 'colors'>>) => void;
  applyTheme: (theme: Theme) => void;
  applyPreset: (presetId: string) => void;
  saveCurrentAs: (name: string) => void;
  deleteSaved: (id: string) => void;
  reset: () => void;
  /** Podmiana całego stanu — używane przy imporcie kopii zapasowej. */
  replaceAll: (theme: Theme, saved: Theme[]) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      saved: [],

      setColor: (key, value) =>
        set((s) => ({ theme: { ...s.theme, colors: { ...s.theme.colors, [key]: value } } })),

      patch: (partial) => set((s) => ({ theme: { ...s.theme, ...partial } })),

      applyTheme: (theme) => set({ theme: structuredClone(theme) }),

      applyPreset: (presetId) =>
        set((s) => {
          const preset = PRESETS.find((p) => p.id === presetId);
          return preset ? { theme: structuredClone(preset) } : s;
        }),

      saveCurrentAs: (name) =>
        set((s) => {
          const entry: Theme = {
            ...structuredClone(s.theme),
            id: `wlasny-${Date.now()}`,
            name: name.trim() || currentDict().wyglad.mojMotyw,
          };
          return { saved: [...s.saved, entry], theme: entry };
        }),

      deleteSaved: (id) => set((s) => ({ saved: s.saved.filter((t) => t.id !== id) })),

      reset: () => set({ theme: structuredClone(DEFAULT_THEME) }),

      replaceAll: (theme, saved) => set({ theme, saved }),
    }),
    {
      // Ta sama nazwa co w public/motyw.js, który nakłada motyw przed startem Reacta.
      name: 'planer-motyw',
      version: 1,

      // Motyw wczytany z pamięci przeglądarki przechodzi przez to samo sito co
      // motyw z pliku kopii zapasowej. Dzięki temu w całej aplikacji obowiązuje
      // jedna zasada: w sklepie nigdy nie leży motyw o nieznanym kształcie.
      merge: (persisted, current) => {
        const saved = persisted as Partial<ThemeState> | undefined;
        if (!saved) return current;
        return {
          ...current,
          theme: sanitizeTheme(saved.theme),
          saved: sanitizeThemeList(saved.saved),
        };
      },
    },
  ),
);
