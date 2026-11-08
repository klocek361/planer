import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DEFAULT_SETTINGS,
  addDefaultCategories,
  formatMoney,
  getBudgetSettings,
  goalSaved,
  monthRange,
  monthSummary,
  progress,
} from '../../data/budget';
import { db } from '../../data/db';
import type { MoneyEntry, SavingsGoal } from '../../data/types';
import { addMonths, monthNameLabel, startOfMonth, toKey, weekdayWithDay } from '../../lib/dates';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { SettingsButton } from '../../ui/SettingsButton';
import { SoftCard, SoftScreen } from '../../ui/SoftScreen';
import { ChevronLeftIcon, ChevronRightIcon, MoreIcon, PlusIcon } from '../../ui/icons';
import { BudgetSettingsSheet } from './BudgetSettingsSheet';
import { EntrySheet } from './EntrySheet';
import { GoalSheet } from './GoalSheet';

/** Pasek postępu do celu. Ponad cel — kolor ostrzegawczy, bez alarmu. */
function GoalBar({ ratio, color }: { ratio: number; color: string }) {
  const over = ratio > 1;
  return (
    <span className="bg-bg block h-1.5 overflow-hidden rounded-full">
      <span
        className="block h-full rounded-full transition-[width]"
        style={{
          width: `${Math.min(100, Math.round(ratio * 100))}%`,
          backgroundColor: over ? 'var(--c-weekend)' : color,
        }}
      />
    </span>
  );
}

/**
 * Budżet domowy: bilans miesiąca (przychody, wydatki, ile zostało), wydatki
 * według kategorii, kto zapłacił, skarbonki i wpisy miesiąca po dniach.
 */
export function BudgetScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t, lang } = useT();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [filter, setFilter] = useState<number | null>(null);
  const [entrySheet, setEntrySheet] = useState<{ entry: MoneyEntry | null } | null>(null);
  const [goalSheet, setGoalSheet] = useState<{ goal: SavingsGoal | null } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const range = useMemo(() => monthRange(month), [month]);
  const settings = useLiveQuery(getBudgetSettings, [], DEFAULT_SETTINGS);
  const categories = useLiveQuery(() => db.moneyCategories.orderBy('order').toArray(), [], []);
  const entries = useLiveQuery(
    () => db.moneyEntries.where('date').between(range.from, range.to, true, true).toArray(),
    [range],
    [],
  );
  const goals = useLiveQuery(() => db.savingsGoals.orderBy('order').toArray(), [], []);
  const goalEntries = useLiveQuery(
    () => db.moneyEntries.where('kind').anyOf('wplata', 'wyplata').toArray(),
    [],
    [],
  );
  const appCategories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [], []);
  const syncStates = useLiveQuery(() => db.syncState.toArray(), [], []);

  // Wspólny budżet: przypięty do kategorii wspólnego kalendarza. Wtedy
  // „kto zapłacił” wybiera spośród jego członków.
  const sharedCategories = appCategories.filter((c) => c.space);
  const pinned = appCategories.find((c) => c.id === settings.categoryId && c.space);
  const members =
    useLiveQuery(
      () => (pinned?.space ? db.members.where('space').equals(pinned.space).toArray() : []),
      [pinned?.space],
      [],
    ) ?? [];
  const meId = syncStates.find((s) => s.id === pinned?.space)?.memberId;

  const money = (grosze: number) => formatMoney(grosze, settings.currency, lang);
  const summary = useMemo(() => monthSummary(entries), [entries]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id!, c])), [categories]);
  const memberName = (uid: string) =>
    uid === meId ? t.budzet.ty : (members.find((m) => m.uid === uid)?.name ?? '?');

  const expenseCategories = categories.filter((c) => c.kind === 'wydatek');
  const incomeCategories = categories.filter((c) => c.kind === 'przychod');
  const spentRatio = summary.income > 0 ? summary.expense / summary.income : null;

  const visibleEntries = useMemo(
    () =>
      [...entries]
        .filter((e) => filter === null || (e.categoryId ?? 0) === filter)
        .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)),
    [entries, filter],
  );
  const days = useMemo(() => {
    const map = new Map<string, MoneyEntry[]>();
    for (const entry of visibleEntries) {
      const list = map.get(entry.date);
      if (list) list.push(entry);
      else map.set(entry.date, [entry]);
    }
    return [...map.entries()];
  }, [visibleEntries]);

  const thisMonth = toKey(startOfMonth(new Date())) === toKey(month);
  const payers = [...summary.byPayer.entries()].filter(([uid]) => uid !== '');
  const goalName = (id?: number) => goals.find((g) => g.id === id)?.name ?? '';

  const entryLabel = (entry: MoneyEntry) => {
    if (entry.kind === 'wplata' || entry.kind === 'wyplata') {
      return `${entry.kind === 'wplata' ? t.budzet.wplata : t.budzet.wyplata}: ${goalName(entry.goalId)}`;
    }
    return entry.note || categoryById.get(entry.categoryId ?? -1)?.name || t.budzet.bezKategorii;
  };

  return (
    <SoftScreen
      title={`${t.zakladki.budzet}${pinned ? ' 👥' : ''}`}
      actions={
        <>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label={t.budzet.ustawienia}
            className="text-muted active:text-ink -m-2 p-2"
          >
            <MoreIcon className="h-6 w-6" />
          </button>
          <SettingsButton onClick={onOpenSettings} />
        </>
      }
      fab={{ label: t.budzet.nowyWpis, onClick: () => setEntrySheet({ entry: null }) }}
    >
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, -1))}
          aria-label={t.wspolne.poprzedniMiesiac}
          className="text-muted active:text-ink -m-1.5 p-1.5"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setMonth(startOfMonth(new Date()))}
          disabled={thisMonth}
          className={`text-sm font-medium first-letter:uppercase ${thisMonth ? 'text-ink' : 'text-accent'}`}
        >
          {monthNameLabel(month)}
        </button>
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label={t.wspolne.nastepnyMiesiac}
          className="text-muted active:text-ink -m-1.5 p-1.5"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <SoftCard>
          <p className="text-muted text-sm">{t.budzet.zostalo}</p>
          <p
            className={`pb-2 text-3xl font-semibold tabular-nums ${summary.left < 0 ? 'text-weekend' : 'text-ink'}`}
          >
            {money(summary.left)}
          </p>
          <div className="flex justify-between gap-3 pb-2 text-sm">
            <span className="text-muted">
              {t.budzet.przychody} <span className="text-ink font-medium tabular-nums">{money(summary.income)}</span>
            </span>
            <span className="text-muted">
              {t.budzet.wydatki} <span className="text-ink font-medium tabular-nums">{money(summary.expense)}</span>
            </span>
          </div>
          {spentRatio !== null && (
            <div className="flex items-center gap-3">
              <span className="flex-1">
                <GoalBar ratio={spentRatio} color="var(--c-accent)" />
              </span>
              <span className="text-muted text-xs tabular-nums">
                {t.budzet.wydano(Math.round(spentRatio * 100))}
              </span>
            </div>
          )}
        </SoftCard>

        {categories.length === 0 && (
          <SoftCard>
            <p className="text-muted pb-3 text-sm">{t.budzet.pusty}</p>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => void addDefaultCategories(t.budzet.domyslneWydatki, t.budzet.domyslnePrzychody)}
            >
              {t.budzet.dodajDomyslne}
            </Button>
          </SoftCard>
        )}

        {expenseCategories.length > 0 && (
          <SoftCard>
            <h3 className="text-muted pb-2 text-sm">{t.budzet.wedlugKategorii}</h3>
            <ul className="flex flex-col gap-2.5">
              {expenseCategories.map((category) => {
                const spent = summary.byCategory.get(category.id!) ?? 0;
                const ratio = progress(spent, category.goal);
                const active = filter === category.id;
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => setFilter(active ? null : category.id!)}
                      aria-pressed={active}
                      className={`flex w-full flex-col gap-1 text-left ${filter !== null && !active ? 'opacity-45' : ''}`}
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: category.color }}
                          aria-hidden="true"
                        />
                        <span className="text-ink min-w-0 flex-1 truncate">{category.name}</span>
                        <span className="text-ink tabular-nums">{money(spent)}</span>
                        {category.goal && (
                          <span className="text-muted text-xs tabular-nums">
                            {t.budzet.cel(money(category.goal))}
                          </span>
                        )}
                      </span>
                      {ratio !== null && <GoalBar ratio={ratio} color={category.color} />}
                    </button>
                  </li>
                );
              })}
            </ul>
            {incomeCategories.length > 0 && summary.income > 0 && (
              <p className="text-muted pt-3 text-xs">
                {t.budzet.przychody}:{' '}
                {incomeCategories
                  .filter((c) => (summary.byCategory.get(c.id!) ?? 0) > 0)
                  .map((c) => `${c.name} ${money(summary.byCategory.get(c.id!)!)}`)
                  .join(' · ')}
              </p>
            )}
          </SoftCard>
        )}

        {payers.length > 0 && (
          <p className="text-muted px-1 text-xs">
            {t.budzet.ktoZaplacil}:{' '}
            {[
              ...payers.map(([uid, sum]) => `${memberName(uid)} ${money(sum)}`),
              ...(summary.byPayer.get('') ? [`${t.budzet.bezOsoby} ${money(summary.byPayer.get('')!)}`] : []),
            ].join(' · ')}
          </p>
        )}

        <section className="pt-2">
          <div className="flex items-center justify-between pb-2">
            <h3 className="text-muted text-sm">{t.budzet.skarbonki}</h3>
            <button
              type="button"
              onClick={() => setGoalSheet({ goal: null })}
              aria-label={t.budzet.nowaSkarbonka}
              className="text-muted active:text-ink -m-1.5 p-1.5"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {goals.map((goal) => {
              const saved = goalSaved(goalEntries, goal.id!);
              const ratio = progress(saved, goal.target) ?? 0;
              return (
                <button key={goal.id} type="button" onClick={() => setGoalSheet({ goal })} className="text-left">
                  <SoftCard>
                    <span className="flex items-baseline gap-2 pb-1.5 text-sm">
                      <span className="text-ink min-w-0 flex-1 truncate font-medium">{goal.name}</span>
                      <span className="text-ink tabular-nums">
                        {money(saved)} <span className="text-muted">/ {money(goal.target)}</span>
                      </span>
                    </span>
                    <GoalBar ratio={Math.min(ratio, 1)} color="var(--c-accent)" />
                    <span className="text-muted block pt-1 text-xs">
                      {ratio >= 1 ? `✓ ${t.budzet.osiagnieto}` : `${Math.round(ratio * 100)}%`}
                      {goal.deadline ? ` · ${t.budzet.doTerminu(goal.deadline)}` : ''}
                    </span>
                  </SoftCard>
                </button>
              );
            })}
          </div>
        </section>

        {days.length === 0 ? (
          <p className="text-muted py-6 text-center text-sm">{t.budzet.pustyMiesiac}</p>
        ) : (
          days.map(([date, list]) => (
            <SoftCard key={date}>
              <h3 className="text-muted pb-2 text-xs font-semibold tracking-[0.18em] uppercase">
                {weekdayWithDay(date)}
              </h3>
              <ul className="flex flex-col gap-2">
                {list.map((entry) => {
                  const category = categoryById.get(entry.categoryId ?? -1);
                  const plus = entry.kind === 'przychod' || entry.kind === 'wyplata';
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => setEntrySheet({ entry })}
                        className="flex w-full items-center gap-2.5 text-left text-sm"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: category?.color ?? 'var(--c-text-faint)' }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-ink block truncate">{entryLabel(entry)}</span>
                          {(entry.note && category) || entry.paidBy ? (
                            <span className="text-muted block truncate text-xs">
                              {[entry.note && category ? category.name : '', entry.paidBy ? memberName(entry.paidBy) : '']
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          ) : null}
                        </span>
                        <span className={`shrink-0 tabular-nums ${plus ? 'text-accent' : 'text-ink'}`}>
                          {plus ? '+' : '−'}
                          {money(entry.amount)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </SoftCard>
          ))
        )}
      </div>

      <EntrySheet
        open={entrySheet !== null}
        entry={entrySheet?.entry ?? null}
        categories={categories}
        members={members}
        meId={meId}
        currency={settings.currency}
        onClose={() => setEntrySheet(null)}
      />
      <GoalSheet
        open={goalSheet !== null}
        goal={goalSheet?.goal ?? null}
        history={goalEntries
          .filter((e) => e.goalId === goalSheet?.goal?.id)
          .sort((a, b) => (a.date < b.date ? 1 : -1))}
        saved={goalSheet?.goal ? goalSaved(goalEntries, goalSheet.goal.id!) : 0}
        currency={settings.currency}
        onClose={() => setGoalSheet(null)}
      />
      <BudgetSettingsSheet
        open={settingsOpen}
        settings={settings}
        sharedCategories={sharedCategories}
        categories={categories}
        onClose={() => setSettingsOpen(false)}
      />
    </SoftScreen>
  );
}
