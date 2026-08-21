/** Trzy formy liczby mnogiej — polski i serbski dzielą ten sam podział. */
export interface Plural {
  /** 1 dzień, 21 dni… */
  one: string;
  /** 2–4 dni, 22–24… */
  few: string;
  /** 5–20, 25… */
  many: string;
}

/**
 * Wybór formy dla języków słowiańskich. Polski i serbski liczą tak samo:
 * decyduje ostatnia cyfra, z wyjątkiem nastek (11–14), które zawsze idą
 * do formy „many”.
 */
export function slavicForm(count: number): keyof Plural {
  const abs = Math.abs(Math.trunc(count));
  const last = abs % 10;
  const lastTwo = abs % 100;

  if (last === 1 && lastTwo !== 11) return 'one';
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'few';
  return 'many';
}

/** Sama odmieniona forma, bez liczby — liczbę składa wywołujący. */
export function pluralWord(count: number, forms: Plural): string {
  return forms[slavicForm(count)];
}

/** Liczba razem z odmienionym słowem, np. „3 dni”. */
export function plural(count: number, forms: Plural): string {
  return `${count} ${pluralWord(count, forms)}`;
}
