import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { summarizeList } from '../../data/lists';
import type { Checklist, ChecklistItem } from '../../data/types';
import { useT } from '../../i18n';
import { useBackDismiss } from '../../platform/back';
import { Screen } from '../../ui/Screen';
import { SettingsButton } from '../../ui/SettingsButton';
import { ChevronRightIcon, PlusIcon } from '../../ui/icons';
import { ListDetailScreen } from './ListDetailScreen';
import { ListSheet } from './ListSheet';

/**
 * Spis list. Wejście w listę to osobny ekran — przy liście zakupów na trzydzieści
 * pozycji rozwijanie jej w miejscu spychałoby resztę daleko poza ekran.
 */
export function ListsScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useT();
  const [openId, setOpenId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Cofnięcie z zawartości listy wraca do spisu, a nie wychodzi z aplikacji.
  useBackDismiss(openId !== null, () => setOpenId(null));

  const lists = useLiveQuery(() => db.lists.orderBy('order').toArray());
  const items = useLiveQuery(() => db.listItems.toArray());
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());

  const categoryColors = useMemo(() => {
    const map = new Map<number, string>();
    for (const category of categories ?? []) if (category.id) map.set(category.id, category.color);
    return map;
  }, [categories]);

  const byList = useMemo(() => {
    const map = new Map<number, ChecklistItem[]>();
    for (const item of items ?? []) {
      const lista = map.get(item.listId);
      if (lista) lista.push(item);
      else map.set(item.listId, [item]);
    }
    return map;
  }, [items]);

  if (openId !== null) {
    return (
      <ListDetailScreen
        listId={openId}
        categories={categories ?? []}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <Screen
      title={t.zakladki.listy}
      action={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={t.listy.nowaLista}
            className="text-muted active:text-ink -m-2 p-2"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
          <SettingsButton onClick={onOpenSettings} />
        </div>
      }
    >
      <ul className="flex flex-col gap-1">
        {(lists ?? []).map((lista) => (
          <li key={lista.id}>
            <ListRow
              list={lista}
              items={byList.get(lista.id!) ?? []}
              color={lista.categoryId ? categoryColors.get(lista.categoryId) : undefined}
              onOpen={() => setOpenId(lista.id!)}
            />
          </li>
        ))}
      </ul>

      {lists !== undefined && lists.length === 0 && (
        <p className="text-muted py-10 text-center text-sm">{t.listy.brakList}</p>
      )}

      <ListSheet
        open={sheetOpen}
        list={null}
        categories={categories ?? []}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}

/** Wiersz spisu: nazwa, ile odhaczone i podgląd tego, co jeszcze zostało. */
function ListRow({
  list,
  items,
  color,
  onOpen,
}: {
  list: Checklist;
  items: ChecklistItem[];
  color?: string;
  onOpen: () => void;
}) {
  const { t } = useT();
  const { done, total, preview } = summarizeList(items);
  const komplet = total > 0 && done === total;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="bg-surface rounded-app flex w-full items-center gap-3 px-3 py-3 text-left"
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? 'var(--c-text-faint)' }}
        aria-hidden="true"
      />

      <span className="min-w-0 flex-1">
        <span className="text-ink block truncate text-sm font-medium">{list.name}</span>
        {preview.length > 0 ? (
          <span className="text-muted block truncate text-xs">{preview.join(', ')}</span>
        ) : (
          list.note && <span className="text-muted block truncate text-xs">{list.note}</span>
        )}
      </span>

      <span
        className={`shrink-0 text-xs tabular-nums ${komplet ? 'text-accent' : 'text-muted'}`}
      >
        {t.listy.postep(done, total)}
      </span>
      <ChevronRightIcon className="text-faint h-5 w-5 shrink-0" />
    </button>
  );
}
