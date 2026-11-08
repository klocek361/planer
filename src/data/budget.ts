import { endOfMonth, startOfMonth } from 'date-fns';
import { toKey } from '../lib/dates';
import { DEFAULT_CATEGORY_COLORS } from '../theme/presets';
import { db } from './db';
import type { BudgetSettings, MoneyCategory, MoneyEntry, MoneyKind, SavingsGoal } from './types';

/**
 * Budżet domowy: jeden na telefon (albo jeden wspólny, gdy przypięty do
 * wspólnego kalendarza). Kwoty w groszach — liczbach całkowitych.
 */

export const DEFAULT_CURRENCY = 'PLN';

/** Waluty do wyboru w ustawieniach. */
export const CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP', 'CHF', 'CZK', 'UAH', 'NOK', 'SEK', 'DKK'];

export const DEFAULT_SETTINGS: BudgetSettings = { id: 'budzet', currency: DEFAULT_CURRENCY };

export async function getBudgetSettings(): Promise<BudgetSettings> {
  return (await db.budgetSettings.get('budzet')) ?? DEFAULT_SETTINGS;
}

export async function saveBudgetSettings(changes: Partial<Omit<BudgetSettings, 'id'>>): Promise<void> {
  const current = await getBudgetSettings();
  const next: BudgetSettings = { ...current, ...changes, id: 'budzet' };
  if (next.categoryId === undefined) delete next.categoryId;
  await db.budgetSettings.put(next);
}

// ── Kwoty ────────────────────────────────────────────────────────────────

/**
 * Kwota wpisana przez człowieka → grosze. Przyjmuje „12,50”, „12.5”,
 * „1 234,50” i „12 zł”. Zwraca null dla pustej, ujemnej albo nieczytelnej.
 */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[\s ]/g, '').replace(/[^\d,.-]/g, '');
  if (!/^\d+([.,]\d{0,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split(/[.,]/);
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0') || '0');
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Grosze → tekst do pola edycji, np. 1250 → „12,50”. */
export function amountToInput(grosze: number): string {
  return (grosze / 100).toFixed(2).replace('.', ',');
}

/** Grosze → kwota z walutą, w zapisie języka aplikacji. */
export function formatMoney(grosze: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(grosze / 100);
  } catch {
    return `${(grosze / 100).toFixed(2)} ${currency}`;
  }
}

// ── Podsumowanie ─────────────────────────────────────────────────────────

/** Pierwszy i ostatni dzień miesiąca jako klucze dat. */
export function monthRange(month: Date): { from: string; to: string } {
  return { from: toKey(startOfMonth(month)), to: toKey(endOfMonth(month)) };
}

export interface MonthSummary {
  income: number;
  expense: number;
  /** Wpłaty do skarbonek minus wypłaty z nich. */
  saved: number;
  /** Przychody − wydatki − odłożone do skarbonek. */
  left: number;
  /** Suma po kategorii pieniędzy; klucz 0 — wpisy bez kategorii. */
  byCategory: Map<number, number>;
  /** Wydatki według tego, kto zapłacił; klucz '' — bez wpisanej osoby. */
  byPayer: Map<string, number>;
}

/** Bilans z wpisów jednego miesiąca. */
export function monthSummary(entries: MoneyEntry[]): MonthSummary {
  const summary: MonthSummary = {
    income: 0,
    expense: 0,
    saved: 0,
    left: 0,
    byCategory: new Map(),
    byPayer: new Map(),
  };
  for (const entry of entries) {
    if (entry.kind === 'wplata') summary.saved += entry.amount;
    else if (entry.kind === 'wyplata') summary.saved -= entry.amount;
    else {
      if (entry.kind === 'przychod') summary.income += entry.amount;
      else {
        summary.expense += entry.amount;
        const payer = entry.paidBy ?? '';
        summary.byPayer.set(payer, (summary.byPayer.get(payer) ?? 0) + entry.amount);
      }
      const key = entry.categoryId ?? 0;
      summary.byCategory.set(key, (summary.byCategory.get(key) ?? 0) + entry.amount);
    }
  }
  summary.left = summary.income - summary.expense - summary.saved;
  return summary;
}

/** Ile jest w skarbonce: suma wpłat minus wypłat, ze wszystkich miesięcy. */
export function goalSaved(entries: MoneyEntry[], goalId: number): number {
  let saved = 0;
  for (const entry of entries) {
    if (entry.goalId !== goalId) continue;
    if (entry.kind === 'wplata') saved += entry.amount;
    if (entry.kind === 'wyplata') saved -= entry.amount;
  }
  return saved;
}

/** Postęp 0–1 do paska; brak celu albo cel zero — brak paska. */
export function progress(value: number, goal: number | undefined): number | null {
  if (!goal || goal <= 0) return null;
  return Math.max(0, value / goal);
}

// ── Zapis ────────────────────────────────────────────────────────────────

export interface EntryDraft {
  kind: MoneyEntry['kind'];
  amount: number;
  date: string;
  categoryId?: number;
  goalId?: number;
  note?: string;
  paidBy?: string;
}

function cleanDraft(draft: EntryDraft): Omit<MoneyEntry, 'id' | 'createdAt'> {
  const note = draft.note?.trim();
  return {
    kind: draft.kind,
    amount: Math.round(draft.amount),
    date: draft.date,
    ...(draft.categoryId !== undefined ? { categoryId: draft.categoryId } : {}),
    ...(draft.goalId !== undefined ? { goalId: draft.goalId } : {}),
    ...(note ? { note } : {}),
    ...(draft.paidBy ? { paidBy: draft.paidBy } : {}),
  };
}

export async function addEntry(draft: EntryDraft): Promise<void> {
  await db.moneyEntries.add({ ...cleanDraft(draft), createdAt: Date.now() });
}

/** Zastępuje treść wpisu, zachowując jego id, czas założenia i `uid`. */
export async function updateEntry(id: number, draft: EntryDraft): Promise<void> {
  const existing = await db.moneyEntries.get(id);
  if (!existing) return;
  await db.moneyEntries.put({
    ...cleanDraft(draft),
    id,
    createdAt: existing.createdAt,
    ...(existing.uid ? { uid: existing.uid } : {}),
  });
}

export async function deleteEntry(id: number): Promise<void> {
  await db.moneyEntries.delete(id);
}

export async function addMoneyCategory(
  kind: MoneyKind,
  name: string,
  color?: string,
  goal?: number,
): Promise<number> {
  const count = await db.moneyCategories.count();
  return db.moneyCategories.add({
    kind,
    name: name.trim().slice(0, 40),
    color: color ?? DEFAULT_CATEGORY_COLORS[count % DEFAULT_CATEGORY_COLORS.length]!,
    order: count,
    ...(goal ? { goal } : {}),
  });
}

export async function updateMoneyCategory(
  id: number,
  changes: { name: string; color: string; goal?: number },
): Promise<void> {
  const existing = await db.moneyCategories.get(id);
  if (!existing) return;
  const next: MoneyCategory = { ...existing, name: changes.name.trim().slice(0, 40), color: changes.color };
  if (changes.goal) next.goal = changes.goal;
  else delete next.goal;
  await db.moneyCategories.put(next);
}

/** Usuwa kategorię; jej wpisy zostają, tylko bez kategorii. */
export async function deleteMoneyCategory(id: number): Promise<void> {
  await db.transaction('rw', db.moneyCategories, db.moneyEntries, async () => {
    await db.moneyEntries
      .where('categoryId')
      .equals(id)
      .modify((entry) => {
        delete entry.categoryId;
      });
    await db.moneyCategories.delete(id);
  });
}

/** Podstawowe kategorie dla pustego budżetu — nazwy w języku aplikacji. */
export async function addDefaultCategories(expenses: string[], incomes: string[]): Promise<void> {
  for (const name of expenses) await addMoneyCategory('wydatek', name);
  for (const name of incomes) await addMoneyCategory('przychod', name);
}

export async function addGoal(name: string, target: number, deadline?: string): Promise<void> {
  await db.savingsGoals.add({
    name: name.trim().slice(0, 40),
    target,
    ...(deadline ? { deadline } : {}),
    order: await db.savingsGoals.count(),
    createdAt: Date.now(),
  });
}

export async function updateGoal(
  id: number,
  changes: { name: string; target: number; deadline?: string },
): Promise<void> {
  const existing = await db.savingsGoals.get(id);
  if (!existing) return;
  const next: SavingsGoal = { ...existing, name: changes.name.trim().slice(0, 40), target: changes.target };
  if (changes.deadline) next.deadline = changes.deadline;
  else delete next.deadline;
  await db.savingsGoals.put(next);
}

/** Usuwa skarbonkę razem z jej wpłatami i wypłatami. */
export async function deleteGoal(id: number): Promise<void> {
  await db.transaction('rw', db.savingsGoals, db.moneyEntries, async () => {
    await db.moneyEntries.where('goalId').equals(id).delete();
    await db.savingsGoals.delete(id);
  });
}
