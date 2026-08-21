import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { enGB, pl as plDate, pt as ptDate, sr as srDate, srLatn as srLatnDate } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { setDateLocale } from '../lib/dates';
import { pl, type Dict } from './pl';
import { srLatn } from './srLatn';
import { srCyrl } from './srCyrl';
import { en } from './en';
import { pt } from './pt';
import { slavicForm, type Plural } from './plural';

export type Lang = 'pl' | 'sr-Latn' | 'sr-Cyrl' | 'en' | 'pt';

/** Nazwa języka zapisana w nim samym — tak się szuka swojego na liście. */
export const LANG_LABELS: Record<Lang, string> = {
  pl: 'Polski',
  'sr-Latn': 'Srpski',
  'sr-Cyrl': 'Српски',
  en: 'English',
  pt: 'Português',
};

export const LANGS: Lang[] = ['pl', 'sr-Latn', 'sr-Cyrl', 'en', 'pt'];

const DICTS: Record<Lang, Dict> = {
  pl,
  'sr-Latn': srLatn,
  'sr-Cyrl': srCyrl,
  en,
  pt,
};

const DATE_LOCALES: Record<Lang, Locale> = {
  pl: plDate,
  'sr-Latn': srLatnDate,
  'sr-Cyrl': srDate,
  en: enGB,
  pt: ptDate,
};

/** Angielski i portugalski mają jedną formę mnogą — „few” się w nich nie zdarza. */
const simpleForm = (count: number): keyof Plural => (Math.abs(count) === 1 ? 'one' : 'many');

const FORMS: Record<Lang, (count: number) => keyof Plural> = {
  pl: slavicForm,
  'sr-Latn': slavicForm,
  'sr-Cyrl': slavicForm,
  en: simpleForm,
  pt: simpleForm,
};

/** Kod dla atrybutu lang w HTML — czytniki ekranu biorą z niego wymowę. */
const HTML_LANG: Record<Lang, string> = {
  pl: 'pl',
  'sr-Latn': 'sr-Latn',
  'sr-Cyrl': 'sr-Cyrl',
  en: 'en',
  pt: 'pt',
};

function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as string[]).includes(value);
}

/**
 * Język wybiera się raz i zostaje. Domyślnie polski — aplikacja powstała po
 * polsku i to jest jej język wyjściowy, a nie zgadywanie z ustawień telefonu.
 */
interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: 'pl',
      setLang: (lang) => set({ lang }),
    }),
    {
      name: 'planer-jezyk',
      version: 1,
      merge: (persisted, current) => {
        const record = persisted as { lang?: unknown } | null;
        return { ...current, lang: isLang(record?.lang) ? record.lang : 'pl' };
      },
    },
  ),
);

/**
 * Nakłada język poza Reactem: daty i atrybut `lang` na dokumencie. Wołane
 * z subskrypcji sklepu, więc dzieje się raz na zmianę języka, a nie przy
 * każdym przerysowaniu.
 */
function applyLang(lang: Lang): void {
  setDateLocale(DATE_LOCALES[lang]);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = HTML_LANG[lang];
  }
}

applyLang(useLangStore.getState().lang);
useLangStore.subscribe((state) => applyLang(state.lang));

export interface Translation {
  lang: Lang;
  t: Dict;
  /** Liczba razem z odmienionym słowem, np. „3 dni”. */
  plural: (count: number, forms: Plural) => string;
  /** Sama odmieniona forma, bez liczby. */
  pluralWord: (count: number, forms: Plural) => string;
  setLang: (lang: Lang) => void;
}

/** Wszystko, czego komponent potrzebuje do napisania czegokolwiek na ekranie. */
export function useT(): Translation {
  const lang = useLangStore((state) => state.lang);
  const setLang = useLangStore((state) => state.setLang);
  const t = DICTS[lang];
  const form = FORMS[lang];

  return {
    lang,
    t,
    plural: (count, forms) => `${count} ${forms[form(count)]}`,
    pluralWord: (count, forms) => forms[form(count)],
    setLang,
  };
}

/** Słownik poza komponentem — do warstwy danych, która nie ma dostępu do hooków. */
export function currentDict(): Dict {
  return DICTS[useLangStore.getState().lang];
}

export type { Dict, Plural };
