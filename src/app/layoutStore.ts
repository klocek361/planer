import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_LAYOUT,
  normalizeLayout,
  visibleTabs,
  type CalendarTasks,
  type Layout,
  type TabId,
} from './tabs';

interface LayoutState extends Layout {
  /** Przesuwa zakładkę o jedno miejsce w lewo (-1) albo w prawo (1). */
  move: (tab: TabId, direction: -1 | 1) => void;
  /** Włącza albo wyłącza zakładkę; ostatniej widocznej nie da się wyłączyć. */
  toggle: (tab: TabId) => void;
  /** Wybór sposobu pokazywania zadań w siatce kalendarza. */
  setCalendarTasks: (mode: CalendarTasks) => void;
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
          // calendarTasks przekazujemy dalej — bez tego normalizacja cofnęłaby
          // wybór trybu kalendarza przy każdym włączeniu zakładki.
          const next = normalizeLayout({
            order: state.order,
            hidden,
            calendarTasks: state.calendarTasks,
          });
          // Próba wyłączenia ostatniej widocznej zakładki nie zmienia nic.
          return visibleTabs(next).length === 0 ? state : next;
        }),

      setCalendarTasks: (mode) => set({ calendarTasks: mode }),

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
