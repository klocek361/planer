import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_ALL_SECTIONS,
  defaultSections,
  normalizeAllSections,
  normalizeSections,
  visibleSections,
  type AllSections,
  type SectionLayout,
  type SectionOwner,
} from './sections';

interface SectionsState {
  sekcje: AllSections;
  /** Przesuwa sekcję o jedno miejsce w górę (-1) albo w dół (1). */
  move: (owner: SectionOwner, id: string, direction: -1 | 1) => void;
  /** Włącza albo wyłącza sekcję; ostatniej widocznej nie da się wyłączyć. */
  toggle: (owner: SectionOwner, id: string) => void;
  reset: (owner: SectionOwner) => void;
  /** Podmiana całości — używane przy wczytywaniu kopii zapasowej. */
  replaceAll: (sekcje: AllSections) => void;
}

export const useSectionsStore = create<SectionsState>()(
  persist(
    (set) => ({
      sekcje: DEFAULT_ALL_SECTIONS,

      move: (owner, id, direction) =>
        set((state) => {
          const biezacy = state.sekcje[owner];
          const order = biezacy.order.slice();
          const index = order.indexOf(id);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= order.length) return state;
          [order[index], order[target]] = [order[target]!, order[index]!];
          return { sekcje: { ...state.sekcje, [owner]: { ...biezacy, order } } };
        }),

      toggle: (owner, id) =>
        set((state) => {
          const biezacy = state.sekcje[owner];
          const hidden = biezacy.hidden.includes(id)
            ? biezacy.hidden.filter((x) => x !== id)
            : [...biezacy.hidden, id];
          const next: SectionLayout = normalizeSections(owner, { order: biezacy.order, hidden });
          // Próba wyłączenia ostatniej widocznej sekcji nie zmienia nic.
          if (visibleSections(next).length === 0) return state;
          return { sekcje: { ...state.sekcje, [owner]: next } };
        }),

      reset: (owner) =>
        set((state) => ({ sekcje: { ...state.sekcje, [owner]: defaultSections(owner) } })),

      replaceAll: (sekcje) => set({ sekcje: normalizeAllSections(sekcje) }),
    }),
    {
      name: 'planer-sekcje',
      version: 1,
      merge: (persisted, current) => {
        const record = persisted as { sekcje?: unknown } | null;
        return { ...current, sekcje: normalizeAllSections(record?.sekcje) };
      },
    },
  ),
);

/** Widoczne sekcje danej zakładki — skrót do użycia w komponentach. */
export function useVisibleSections(owner: SectionOwner): string[] {
  const sekcje = useSectionsStore((state) => state.sekcje[owner]);
  return visibleSections(sekcje);
}
