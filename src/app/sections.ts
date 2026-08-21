/**
 * Podsekcje wewnątrz zakładek — to, co da się poprzestawiać albo wyłączyć
 * z poziomu samego ekranu, bez schodzenia do ustawień.
 *
 * Mechanizm jest ten sam co przy zakładkach dolnego paska, tylko osadzony
 * w konkretnym ekranie: ta sama normalizacja, ta sama zasada, że ostatniej
 * widocznej pozycji nie da się wyłączyć.
 */

/** Zakładki, które mają co przestawiać. */
export type SectionOwner = 'zadania' | 'przeglad';

export const SECTION_IDS: Record<SectionOwner, string[]> = {
  // Tryby widoku zadań.
  zadania: ['lista', 'kategorie', 'dni'],
  // Bloki ekranu Przegląd, w kolejności od góry.
  przeglad: ['liczniki', 'dzis', 'tydzien'],
};

export interface SectionLayout {
  order: string[];
  hidden: string[];
}

export function defaultSections(owner: SectionOwner): SectionLayout {
  return { order: [...SECTION_IDS[owner]], hidden: [] };
}

/**
 * Doprowadza układ sekcji do stanu używalnego: zna tylko istniejące pozycje,
 * każdą raz, dokłada te dodane w nowszej wersji aplikacji i nie pozwala
 * wyłączyć wszystkiego — ekran bez ani jednej sekcji byłby pusty.
 */
export function normalizeSections(owner: SectionOwner, input: unknown): SectionLayout {
  const znane = SECTION_IDS[owner];
  const record =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};

  const rawOrder = Array.isArray(record.order) ? record.order : [];
  const order: string[] = [];
  for (const item of rawOrder) {
    if (typeof item === 'string' && znane.includes(item) && !order.includes(item)) {
      order.push(item);
    }
  }
  for (const id of znane) {
    if (!order.includes(id)) order.push(id);
  }

  const rawHidden = Array.isArray(record.hidden) ? record.hidden : [];
  const hidden: string[] = [];
  for (const item of rawHidden) {
    if (typeof item === 'string' && znane.includes(item) && !hidden.includes(item)) {
      hidden.push(item);
    }
  }
  while (hidden.length >= order.length) hidden.pop();

  return { order, hidden };
}

/** Sekcje widoczne, w ustawionej kolejności. */
export function visibleSections(layout: SectionLayout): string[] {
  return layout.order.filter((id) => !layout.hidden.includes(id));
}

export type AllSections = Record<SectionOwner, SectionLayout>;

export const DEFAULT_ALL_SECTIONS: AllSections = {
  zadania: defaultSections('zadania'),
  przeglad: defaultSections('przeglad'),
};

/** Normalizuje komplet układów — używane przy wczytywaniu kopii zapasowej. */
export function normalizeAllSections(input: unknown): AllSections {
  const record =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  return {
    zadania: normalizeSections('zadania', record.zadania),
    przeglad: normalizeSections('przeglad', record.przeglad),
  };
}
