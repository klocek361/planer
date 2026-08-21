import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import {
  addItem,
  clearDone,
  deleteItem,
  splitItems,
  toggleItem,
  uncheckAll,
} from '../../data/lists';
import type { Category, ChecklistItem } from '../../data/types';
import { useT } from '../../i18n';
import { tap } from '../../platform/haptics';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/Confirm';
import { Screen } from '../../ui/Screen';
import { CheckIcon, EditIcon, PlusIcon, TrashIcon } from '../../ui/icons';
import { ListSheet } from './ListSheet';

interface Props {
  listId: number;
  categories: Category[];
  onBack: () => void;
}

/**
 * Zawartość jednej listy. Pole dopisywania stoi tuż pod nagłówkiem i po
 * zatwierdzeniu zostaje otwarte — przy spisywaniu zakupów pozycje sypią się
 * jedna po drugiej i schodzenie po każdej na dół byłoby męczące.
 */
export function ListDetailScreen({ listId, categories, onBack }: Props) {
  const { t } = useT();
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const list = useLiveQuery(() => db.lists.get(listId), [listId]);
  const items = useLiveQuery(
    () => db.listItems.where('listId').equals(listId).toArray(),
    [listId],
  );

  const { open, done } = useMemo(() => splitItems(items ?? []), [items]);

  const dopisz = async () => {
    const tekst = draft.trim();
    if (!tekst) return;
    setDraft('');
    await addItem(listId, tekst);
    // Klawiatura ma zostać — kolejna pozycja zwykle idzie od razu po tej.
    inputRef.current?.focus();
  };

  // Dopóki zapytanie nie wróci, nie ma czego rysować.
  if (!list) return null;

  return (
    <Screen
      title={list.name}
      onBack={onBack}
      action={
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          aria-label={t.listy.edytujListe}
          className="text-muted active:text-ink -m-2 p-2"
        >
          <EditIcon className="h-6 w-6" />
        </button>
      }
    >
      {list.note && (
        <p className="text-muted bg-surface rounded-app mb-3 px-3 py-2.5 text-sm whitespace-pre-line">
          {list.note}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void dopisz();
        }}
        className="bg-surface rounded-app mb-3 flex items-center gap-2 px-3 py-2"
      >
        <PlusIcon className="text-muted h-5 w-5 shrink-0" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.listy.dopisz}
          enterKeyHint="done"
          className="text-ink min-w-0 flex-1 bg-transparent py-1 text-base outline-none"
        />
      </form>

      <ul className="flex flex-col gap-0.5">
        {open.map((item) => (
          <li key={item.id}>
            <ItemRow item={item} />
          </li>
        ))}
      </ul>

      {items !== undefined && open.length === 0 && done.length === 0 && (
        <p className="text-muted py-10 text-center text-sm">{t.listy.pustaLista}</p>
      )}

      {done.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowDone((value) => !value)}
            className="text-muted w-full py-2 text-center text-sm"
          >
            {t.listy.zrobione(done.length)}
          </button>
          {showDone && (
            <ul className="flex flex-col gap-0.5">
              {done.map((item) => (
                <li key={item.id}>
                  <ItemRow item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {done.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-6">
          <Button
            variant="soft"
            onClick={() => {
              tap();
              void uncheckAll(listId);
            }}
          >
            {t.listy.odznaczWszystko}
          </Button>
          <Button variant="soft" onClick={() => setConfirmDone(true)}>
            {t.listy.usunZrobione}
          </Button>
        </div>
      )}

      <ListSheet
        open={editOpen}
        list={list}
        categories={categories}
        onClose={() => setEditOpen(false)}
        onDeleted={onBack}
      />

      <ConfirmDialog
        open={confirmDone}
        title={t.listy.pytanieZrobione}
        message={t.listy.opisZrobione}
        onConfirm={() => {
          setConfirmDone(false);
          void clearDone(listId);
        }}
        onCancel={() => setConfirmDone(false)}
      />
    </Screen>
  );
}

/**
 * Pozycja listy — odhaczenie i kosz, bez wchodzenia w osobny formularz.
 * Osobny komponent, a nie funkcja w środku ekranu: zagnieżdżona powstawałaby
 * od nowa przy każdym renderze i React montowałby całą listę jeszcze raz.
 */
function ItemRow({ item }: { item: ChecklistItem }) {
  const { t } = useT();

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => {
          tap();
          void toggleItem(item.id!, !item.done);
        }}
        aria-pressed={item.done}
        aria-label={item.text}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
          item.done ? 'bg-selected border-transparent' : 'border-line'
        }`}
      >
        {item.done && <CheckIcon className="text-selected-ink h-3.5 w-3.5" />}
      </button>

      <span
        className={`min-w-0 flex-1 py-2 text-[0.9375rem] ${
          item.done ? 'text-faint line-through' : 'text-ink'
        }`}
      >
        {item.text}
      </span>

      <button
        type="button"
        onClick={() => void deleteItem(item.id!)}
        aria-label={t.listy.usunPozycje(item.text)}
        className="text-faint active:text-weekend -m-1.5 shrink-0 p-1.5"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
