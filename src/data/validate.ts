/**
 * Sprawdzanie danych wczytywanych z pliku kopii zapasowej.
 *
 * Plik przychodzi z zewnątrz i może być uszkodzony albo podmieniony, a jest
 * jedyną drogą, którą obce dane wchodzą do aplikacji. Rekordy niespełniające
 * wymagań są odrzucane pojedynczo, a nie unieważniają całej kopii — przy
 * częściowo uszkodzonym pliku lepiej odzyskać resztę niż nic.
 */

import type { BudgetSettings, MoneyCategory, MoneyEntry, SavingsGoal } from './types';
import { FONTS, TEXTURES } from '../theme/catalog';
import { DEFAULT_THEME } from '../theme/presets';
import type { ColorKey, Theme } from '../theme/types';
import { MAX_REPEAT_COUNT, REPEAT_FREQS } from './types';
import type {
  Category,
  Checklist,
  ChecklistItem,
  EventItem,
  Habit,
  HabitEntry,
  Note,
  Repeat,
  Task,
} from './types';

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isOptionalText = (v: unknown): v is string | undefined => v === undefined || isText(v);
/** Globalny identyfikator rekordu ze wspólnego kalendarza: znaki base64url. */
export const isUid = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(v);
const isOptionalUid = (v: unknown): boolean => v === undefined || isUid(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isOptionalId = (v: unknown): v is number | undefined => v === undefined || isNumber(v);
const isFlag = (v: unknown): v is boolean => typeof v === 'boolean';
/**
 * Data musi nie tylko mieć właściwy kształt, ale też naprawdę istnieć —
 * sam wzorzec przepuściłby 2026-99-99 albo 30 lutego.
 */
const isDateKey = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [year, month, day] = v.split('-').map(Number) as [number, number, number];
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
};

const isOptionalDateKey = (v: unknown): v is string | undefined => v === undefined || isDateKey(v);

/** Godzina w zakresie 00:00–23:59; sam wzorzec przepuściłby 25:99. */
const isTime = (v: unknown): v is string =>
  typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const isOptionalTime = (v: unknown): v is string | undefined => v === undefined || isTime(v);
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

const record = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

export function validCategory(input: unknown): Category | null {
  const r = record(input);
  if (!r) return null;
  if (!isText(r.name) || !isHex(r.color) || !isNumber(r.order) || !isOptionalId(r.id)) return null;
  if (!isOptionalUid(r.uid) || !isOptionalUid(r.space)) return null;
  return {
    id: r.id as number | undefined,
    name: r.name,
    color: r.color,
    order: r.order,
    ...(r.uid !== undefined ? { uid: r.uid as string } : {}),
    ...(r.space !== undefined ? { space: r.space as string } : {}),
  };
}

const DOZWOLONE_REGULY = new Set<string>(REPEAT_FREQS);

/** Reguła powtarzania z pliku; przy byle wątpliwości wydarzenie zostaje pojedyncze. */
function validRepeat(input: unknown): Repeat | undefined {
  const r = record(input);
  if (!r || !DOZWOLONE_REGULY.has(r.freq as string) || !isNumber(r.count)) return undefined;
  const count = Math.round(r.count);
  if (count < 2 || count > MAX_REPEAT_COUNT) return undefined;
  return { freq: r.freq as Repeat['freq'], count };
}

export function validEvent(input: unknown): EventItem | null {
  const r = record(input);
  if (!r) return null;
  if (!isText(r.title) || !isDateKey(r.date) || !isFlag(r.allDay)) return null;
  if (!isOptionalTime(r.startTime) || !isOptionalTime(r.endTime)) return null;
  if (!isOptionalId(r.categoryId) || !isOptionalId(r.id) || !isNumber(r.createdAt)) return null;
  if (!isOptionalText(r.note) || !isOptionalId(r.seriesId)) return null;
  if (!isOptionalUid(r.uid)) return null;

  return {
    id: r.id as number | undefined,
    title: r.title,
    date: r.date,
    allDay: r.allDay,
    startTime: r.startTime as string | undefined,
    endTime: r.endTime as string | undefined,
    categoryId: r.categoryId as number | undefined,
    note: r.note as string | undefined,
    seriesId: r.seriesId as number | undefined,
    repeat: validRepeat(r.repeat),
    ...(r.uid !== undefined ? { uid: r.uid as string } : {}),
    createdAt: r.createdAt,
  };
}

export function validTask(input: unknown): Task | null {
  const r = record(input);
  if (!r) return null;
  if (!isText(r.title) || !isFlag(r.done) || !isNumber(r.order) || !isNumber(r.createdAt)) return null;
  if (!isOptionalDateKey(r.dueDate) || !isOptionalId(r.categoryId)) return null;
  if (!isOptionalDateKey(r.startDate)) return null;
  if (!isOptionalId(r.parentId) || !isOptionalId(r.id) || !isOptionalId(r.doneAt)) return null;
  if (!isOptionalId(r.seriesId)) return null;
  if (r.quick !== undefined && !isFlag(r.quick)) return null;

  // Kopie sprzed wprowadzenia gwiazdki trzymały trzy poziomy ważności.
  // "Ważne" i "Pilne" wchodzą jako gwiazdka, "Zwykłe" jako zadanie bez niej.
  const starred = isFlag(r.starred) ? r.starred : isNumber(r.priority) && r.priority > 0;

  // Początek po terminie nie znaczy nic sensownego — zamiast odrzucać całe
  // zadanie, zostawiamy sam termin.
  const start = r.startDate as string | undefined;
  const due = r.dueDate as string | undefined;
  const startDate = start !== undefined && due !== undefined && start <= due ? start : undefined;

  return {
    id: r.id as number | undefined,
    title: r.title,
    ...(isText(r.note) ? { note: r.note.trim().slice(0, 500) } : {}),
    done: r.done,
    doneAt: r.doneAt as number | undefined,
    starred,
    // Pole zapisujemy tylko wtedy, gdy jest włączone — zwykłe zadanie go nie ma.
    ...(r.quick === true ? { quick: true } : {}),
    startDate,
    dueDate: due,
    categoryId: r.categoryId as number | undefined,
    parentId: r.parentId as number | undefined,
    seriesId: r.seriesId as number | undefined,
    repeat: validRepeat(r.repeat),
    order: r.order,
    ...(isUid(r.uid) ? { uid: r.uid } : {}),
    createdAt: r.createdAt,
  };
}

export function validHabit(input: unknown): Habit | null {
  const r = record(input);
  if (!r) return null;
  if (!isText(r.name) || (r.kind !== 'tak-nie' && r.kind !== 'licznik')) return null;
  if (!isNumber(r.target) || r.target < 1) return null;
  if (!isNumber(r.order) || !isFlag(r.archived) || !isNumber(r.createdAt)) return null;
  if (!isOptionalText(r.unit) || !isOptionalId(r.categoryId) || !isOptionalId(r.id)) return null;

  return {
    id: r.id as number | undefined,
    name: r.name,
    kind: r.kind,
    // Nawyk tak-nie zawsze ma cel 1, niezależnie od tego, co było w pliku.
    target: r.kind === 'tak-nie' ? 1 : Math.round(r.target),
    unit: r.unit as string | undefined,
    // Kopie sprzed wprowadzenia trybów liczyły wyłącznie od dnia założenia.
    period: r.period === 'miesiac' ? 'miesiac' : 'ciagly',
    categoryId: r.categoryId as number | undefined,
    order: r.order,
    archived: r.archived,
    ...(isUid(r.uid) ? { uid: r.uid } : {}),
    createdAt: r.createdAt,
  };
}

export function validHabitEntry(input: unknown): HabitEntry | null {
  const r = record(input);
  if (!r) return null;
  if (!isNumber(r.habitId) || !isDateKey(r.date)) return null;
  if (!isNumber(r.value) || r.value < 0 || !isOptionalId(r.id)) return null;
  return {
    id: r.id as number | undefined,
    habitId: r.habitId,
    date: r.date,
    value: Math.round(r.value),
  };
}

export function validChecklist(input: unknown): Checklist | null {
  const r = record(input);
  if (!r) return null;
  if (!isText(r.name) || !isNumber(r.order) || !isNumber(r.createdAt)) return null;
  if (!isOptionalText(r.note) || !isOptionalId(r.categoryId) || !isOptionalId(r.id)) return null;

  return {
    id: r.id as number | undefined,
    name: r.name,
    note: r.note as string | undefined,
    categoryId: r.categoryId as number | undefined,
    order: r.order,
    ...(isUid(r.uid) ? { uid: r.uid } : {}),
    createdAt: r.createdAt,
  };
}

export function validChecklistItem(input: unknown): ChecklistItem | null {
  const r = record(input);
  if (!r) return null;
  if (!isText(r.text) || !isNumber(r.listId) || !isFlag(r.done)) return null;
  if (!isNumber(r.order) || !isNumber(r.createdAt) || !isOptionalId(r.id)) return null;

  return {
    id: r.id as number | undefined,
    listId: r.listId,
    text: r.text,
    done: r.done,
    order: r.order,
    ...(isUid(r.uid) ? { uid: r.uid } : {}),
    createdAt: r.createdAt,
  };
}

export function validNote(input: unknown): Note | null {
  const r = record(input);
  if (!r) return null;
  if (typeof r.title !== 'string' || typeof r.content !== 'string') return null;
  if (!isNumber(r.createdAt) || !isNumber(r.updatedAt) || !isOptionalId(r.id)) return null;
  return {
    id: r.id as number | undefined,
    title: r.title,
    content: r.content,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Przepuszcza tylko poprawne rekordy i liczy, ile odpadło. */
export function keepValid<T>(
  items: unknown[],
  validate: (item: unknown) => T | null,
): { kept: T[]; skipped: number } {
  const kept: T[] = [];
  let skipped = 0;
  for (const item of items) {
    const value = validate(item);
    if (value) kept.push(value);
    else skipped += 1;
  }
  return { kept, skipped };
}

const COLOR_KEYS = Object.keys(DEFAULT_THEME.colors) as ColorKey[];
const FONT_IDS = new Set(FONTS.map((f) => f.id));
const TEXTURE_IDS = new Set(TEXTURES.map((t) => t.id));

const clamp = (value: unknown, min: number, max: number, fallback: number): number =>
  isNumber(value) ? Math.min(max, Math.max(min, value)) : fallback;

/**
 * Buduje poprawny motyw na podstawie wczytanego obiektu.
 * Cokolwiek nie przejdzie sprawdzenia, zastępuje wartość domyślna — dzięki temu
 * plik z uszkodzonym motywem nie zrobi z aplikacji nieczytelnej plamy.
 */
export function sanitizeTheme(input: unknown): Theme {
  const r = record(input);
  const base = DEFAULT_THEME;
  if (!r) return structuredClone(base);

  const colorsInput = record(r.colors) ?? {};
  const colors = { ...base.colors };
  for (const key of COLOR_KEYS) {
    const value = colorsInput[key];
    if (isHex(value)) colors[key] = value.toUpperCase();
  }

  const typography = record(r.typography) ?? {};
  const shape = record(r.shape) ?? {};

  return {
    id: isText(r.id) ? r.id : base.id,
    name: isText(r.name) ? r.name.slice(0, 60) : base.name,
    mode: r.mode === 'dark' ? 'dark' : 'light',
    colors,
    typography: {
      fontId: FONT_IDS.has(typography.fontId as never)
        ? (typography.fontId as Theme['typography']['fontId'])
        : base.typography.fontId,
      scale: clamp(typography.scale, 0.85, 1.45, base.typography.scale),
    },
    shape: {
      radius: clamp(shape.radius, 0, 28, base.shape.radius),
      density: clamp(shape.density, 0.85, 1.3, base.shape.density),
    },
    texture: TEXTURE_IDS.has(r.texture as never)
      ? (r.texture as Theme['texture'])
      : base.texture,
  };
}

/** Lista zapisanych motywów — każdy przepuszczony przez to samo sito. */
export function sanitizeThemeList(input: unknown): Theme[] {
  if (!Array.isArray(input)) return [];
  // Rozsądny limit, żeby spreparowany plik nie zapchał pamięci przeglądarki.
  return input.slice(0, 50).map(sanitizeTheme);
}

// ── Budżet ────────────────────────────────────────────────────────────────

/** Kwota w groszach: liczba całkowita, dodatnia, z rozsądnym sufitem. */
const isAmount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v <= 1_000_000_000_00;
const isOptionalAmount = (v: unknown): v is number | undefined => v === undefined || isAmount(v);
const isCurrency = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]{3}$/.test(v);
const withUid = (r: Record<string, unknown>) => (isUid(r.uid) ? { uid: r.uid } : {});

export function validBudgetSettings(input: unknown): BudgetSettings | null {
  const r = record(input);
  if (!r || !isCurrency(r.currency) || !isOptionalId(r.categoryId)) return null;
  return {
    id: 'budzet',
    currency: r.currency,
    ...(r.categoryId !== undefined ? { categoryId: r.categoryId as number } : {}),
  };
}

export function validMoneyCategory(input: unknown): MoneyCategory | null {
  const r = record(input);
  if (!r || (r.kind !== 'wydatek' && r.kind !== 'przychod')) return null;
  if (!isText(r.name) || !isHex(r.color) || !isNumber(r.order) || !isOptionalId(r.id)) return null;
  if (!isOptionalAmount(r.goal)) return null;
  return {
    id: r.id as number | undefined,
    kind: r.kind,
    name: r.name.trim().slice(0, 40),
    color: r.color,
    ...(r.goal !== undefined ? { goal: r.goal as number } : {}),
    order: r.order,
    ...withUid(r),
  };
}

const ENTRY_KINDS = new Set(['wydatek', 'przychod', 'wplata', 'wyplata']);

export function validMoneyEntry(input: unknown): MoneyEntry | null {
  const r = record(input);
  if (!r || typeof r.kind !== 'string' || !ENTRY_KINDS.has(r.kind)) return null;
  if (!isAmount(r.amount) || !isDateKey(r.date) || !isNumber(r.createdAt)) return null;
  if (!isOptionalId(r.categoryId) || !isOptionalId(r.goalId) || !isOptionalId(r.id)) return null;
  if (!isOptionalText(r.note) || !(r.paidBy === undefined || isUid(r.paidBy))) return null;
  return {
    id: r.id as number | undefined,
    kind: r.kind as MoneyEntry['kind'],
    amount: r.amount,
    date: r.date,
    ...(r.categoryId !== undefined ? { categoryId: r.categoryId as number } : {}),
    ...(r.goalId !== undefined ? { goalId: r.goalId as number } : {}),
    ...(r.note !== undefined ? { note: (r.note as string).trim().slice(0, 120) } : {}),
    ...(r.paidBy !== undefined ? { paidBy: r.paidBy as string } : {}),
    createdAt: r.createdAt,
    ...withUid(r),
  };
}

export function validSavingsGoal(input: unknown): SavingsGoal | null {
  const r = record(input);
  if (!r || !isText(r.name) || !isAmount(r.target) || !isNumber(r.order)) return null;
  if (!isNumber(r.createdAt) || !isOptionalDateKey(r.deadline) || !isOptionalId(r.id)) return null;
  return {
    id: r.id as number | undefined,
    name: r.name.trim().slice(0, 40),
    target: r.target,
    ...(r.deadline !== undefined ? { deadline: r.deadline as string } : {}),
    order: r.order,
    createdAt: r.createdAt,
    ...withUid(r),
  };
}
