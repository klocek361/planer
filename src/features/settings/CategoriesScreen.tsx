import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import {
  addCategory,
  deleteCategory,
  moveCategory,
  updateCategory,
} from '../../data/categories';
import type { Category } from '../../data/types';
import { DEFAULT_CATEGORY_COLORS } from '../../theme/presets';
import { Button } from '../../ui/Button';
import { ColorPicker } from '../../ui/ColorPicker';
import { useT } from '../../i18n';
import { Screen } from '../../ui/Screen';
import { ConfirmDialog } from '../../ui/Confirm';
import { Sheet } from '../../ui/Sheet';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '../../ui/icons';
import { tap } from '../../platform/haptics';

type Editing = { mode: 'nowa' } | { mode: 'edycja'; category: Category } | null;

export function CategoriesScreen({ onBack }: { onBack: () => void }) {
  // Dopóki zapytanie nie wróci, wynik jest `undefined` — to co innego niż pusta
  // lista i musi wyglądać inaczej, żeby nie mignął komunikat o braku kategorii.
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());
  const list = categories ?? [];
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLORS[0]!);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { t } = useT();

  const openNew = () => {
    setName('');
    setColor(DEFAULT_CATEGORY_COLORS[list.length % DEFAULT_CATEGORY_COLORS.length]!);
    setEditing({ mode: 'nowa' });
  };

  const openEdit = (category: Category) => {
    setName(category.name);
    setColor(category.color);
    setEditing({ mode: 'edycja', category });
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editing?.mode === 'edycja') {
      await updateCategory(editing.category.id!, { name: trimmed, color });
    } else {
      await addCategory(trimmed, color);
    }
    setEditing(null);
  };

  const remove = async () => {
    setConfirmOpen(false);
    if (editing?.mode !== 'edycja') return;
    await deleteCategory(editing.category.id!);
    setEditing(null);
  };

  return (
    <Screen
      title={t.ustawienia.kategorie}
      onBack={onBack}
      action={
        <button
          type="button"
          onClick={openNew}
          aria-label={t.kategorie.nowaKategoria}
          className="text-muted active:text-ink -m-2 p-2"
        >
          <PlusIcon className="h-6 w-6" />
        </button>
      }
    >
      <p className="text-muted pb-4 text-sm">
        {t.kategorie.wstep}
      </p>

      <ul className="flex flex-col gap-1">
        {list.map((category, index) => (
          <li key={category.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openEdit(category)}
              className="bg-surface rounded-app flex flex-1 items-center gap-3 px-3 py-3 text-left"
            >
              <span
                className="h-5 w-5 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
                aria-hidden="true"
              />
              <span className="text-ink flex-1 truncate text-sm font-medium">{category.name}</span>
              <span className="text-faint font-mono text-xs">{category.color}</span>
            </button>

            <div className="flex flex-col">
              <button
                type="button"
                aria-label={`Przesuń ${category.name} w górę`}
                disabled={index === 0}
                onClick={() => {
                  tap();
                  void moveCategory(category.id!, -1);
                }}
                className="text-muted p-1 disabled:opacity-25"
              >
                <ArrowUpIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Przesuń ${category.name} w dół`}
                disabled={index === list.length - 1}
                onClick={() => {
                  tap();
                  void moveCategory(category.id!, 1);
                }}
                className="text-muted p-1 disabled:opacity-25"
              >
                <ArrowDownIcon className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {categories !== undefined && list.length === 0 && (
        <p className="text-muted py-8 text-center text-sm">
          {t.kategorie.brak}
        </p>
      )}

      <Sheet
        open={editing !== null}
        title={editing?.mode === 'edycja' ? t.kategorie.edytujKategorie : t.kategorie.nowaKategoria}
        onClose={() => setEditing(null)}
      >
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">{t.wspolne.nazwa}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.kategorie.nazwaPrzyklad}
              className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">{t.wspolne.kolor}</span>
            <ColorPicker value={color} onChange={setColor} presets={DEFAULT_CATEGORY_COLORS} />
          </div>

          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" disabled={!name.trim()} onClick={save}>
              {t.wspolne.zapisz}
            </Button>
            {editing?.mode === 'edycja' && (
              <Button
                variant="danger"
                aria-label={t.kategorie.usunKategorie}
                onClick={() => setConfirmOpen(true)}
                className="px-4"
              >
                <TrashIcon className="h-5 w-5" />
              </Button>
            )}
          </div>

          {editing?.mode === 'edycja' && (
            <p className="text-muted -mt-2 text-xs">
              {t.kategorie.uwaga}
            </p>
          )}

          <ConfirmDialog
            open={confirmOpen}
            title={t.kategorie.pytanie(
              editing?.mode === 'edycja' ? editing.category.name : '',
            )}
            message={t.kategorie.opis}
            onConfirm={remove}
            onCancel={() => setConfirmOpen(false)}
          />
        </div>
      </Sheet>
    </Screen>
  );
}
