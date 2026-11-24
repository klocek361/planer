/**
 * Okno „Nowa wersja” przy pierwszym uruchomieniu po aktualizacji.
 * Telefon pamięta, którą wersję już pokazał. Lista zmian stoi w słownikach
 * (`nowosci.zmiany`) — przy każdym wydaniu trzeba ją podmienić na nową.
 */

/** Klucz w pamięci przeglądarki: wersja, której nowości już widziano. */
export const SEEN_VERSION_KEY = 'planer-ostatnia-wersja';

/** Porównanie numerów 'X.Y.Z' liczbowo, nie jako tekstu (1.10 > 1.9). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number(n) || 0);
  const pb = b.split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

/**
 * Czy pokazać nowości. `seen` — zapamiętana wersja (pusta, gdy nigdy nic nie
 * zapisano), `hasData` — czy na telefonie są już dane. Pusty zapis i puste
 * dane to świeża instalacja: wtedy nie ma czego ogłaszać. Pusty zapis przy
 * danych to aktualizacja z wersji sprzed tego okna.
 */
export function shouldShowWhatsNew(current: string, seen: string, hasData: boolean): boolean {
  if (!seen) return hasData;
  return compareVersions(current, seen) > 0;
}
