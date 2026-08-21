import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LAYOUT, normalizeLayout, visibleTabs, type Layout, type TabId } from './tabs';

interface LayoutState extends Layout {
  /** Przesuwa zakładkę o jedno miejsce w lewo (-1) albo w prawo (1). */
  move: (tab: TabId, direction: -1 | 1) => void;
  /** Włącza albo wyłącza zakładkę; ostatniej widocznej nie da się wyłączyć. */
  toggle: (tab: TabId) => void;
  reset: () => void;
  /** Podmiana całości — używane przy wczytywaniu kopii zapasowej. */
  replaceAll: (layout: Layout) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      ...DEFAULT_LAYOUT,

      move: (tab, direction) =>
        set((state) => {
          const order = state.order.slice();
          const index = order.indexOf(tab);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= order.length) return state;
          [order[index], order[target]] = [order[target]!, order[index]!];
          return { order };
        }),

      toggle: (tab) =>
        set((state) => {
          const hidden = state.hidden.includes(tab)
            ? state.hidden.filter((id) => id !== tab)
            : [...state.hidden, tab];
          const next = normalizeLayout({ order: state.order, hidden });
          // Próba wyłączenia ostatniej widocznej zakładki nie zmienia nic.
          return visibleTabs(next).length === 0 ? state : next;
        }),

      reset: () => set({ ...DEFAULT_LAYOUT }),

      replaceAll: (layout) => set(normalizeLayout(layout)),
    }),
    {
      name: 'planer-uklad',
      version: 1,
      merge: (persisted, current) => ({ ...current, ...normalizeLayout(persisted) }),
    },
  ),
);
