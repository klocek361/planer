import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { addSubcategory, deleteSubcategory, updateSubcategory } from '../data/subcategories';
import type { Subcategory } from '../data/types';
import { MAX_SUBCATEGORY_NAME } from '../data/validate';
import { useT } from '../i18n';
import { DEFAULT_CATEGORY_COLORS } from '../theme/presets';
import { Button } from './Button';
import { ColorPicker } from './ColorPicker';
import { ConfirmDialog } from './Confirm';
import { ChevronRightIcon, PlusIcon, TrashIcon } from './icons';
import { Sheet } from './Sheet';

type SubEditing = { mode: 'nowa' } | { mode: 'edycja'; sub: Subcategory } | null;

/**
 * Podkategorie kategorii albo wspólnego kalendarza: lista, dodawanie, zmiana
 * nazwy i koloru, usuwanie. Wybiera się je przy zadaniu, wydarzeniu i liście.
 */
export function SubcategoriesSection({ categoryId, shared = false }: { categoryId: number; shared?: boolean }) {
  const { t } = useT();
  const subs = useLiveQuery(
    () => db.subcategories.where('categoryId').equals(categoryId).sortBy('order'),
    [categoryId],
    [] as Subcategory[],
  );
  const [editing, setEditing] = useState<SubEditing>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLORS[0]!);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const openNew = () => {
    setName('');
    setColor(DEFAULT_CATEGORY_COLORS[subs.length % DEFAULT_CATEGORY_COLORS.length]!);
    setEditing({ mode: 'nowa' });
  };

  const openEdit = (sub: Subcategory) => {
    setName(sub.name);
    setColor(sub.color);
    setEditing({ mode: 'edycja', sub });
  };

  const save = async () => {
    if (!name.trim()) return;
    if (editing?.mode === 'edycja') await updateSubcategory(editing.sub.id!, { name, color });
    else await addSubcategory(categoryId, name, color);
    setEditing(null);
  };

  const remove = async () => {
    setConfirmOpen(false);
    if (editing?.mode !== 'edycja') return;
    await deleteSubcategory(editing.sub.id!);
    setEditing(null);
  };

  return (
    <div className="pt-6">
      <p className="text-muted pb-2 text-xs font-medium">{t.podkategorie.tytul}</p>
      {subs.length > 0 && (
        <ul className="flex flex-col gap-1 pb-2">
          {subs.map((sub) => (
            <li key={sub.id}>
              <button
                type="button"
                onClick={() => openEdit(sub)}
                className="bg-surface rounded-app flex w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: sub.color }}
                  aria-hidden="true"
                />
                <span className="text-ink min-w-0 flex-1 truncate text-sm font-medium">{sub.name}</span>
                <ChevronRightIcon className="text-faint h-5 w-5 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button className="flex w-full items-center justify-center gap-2" onClick={openNew}>
        <PlusIcon className="h-5 w-5" />
        {t.podkategorie.dodaj}
      </Button>
      <p className="text-muted pt-2 text-xs">{shared ? t.podkategorie.opis : t.podkategorie.opisPrywatna}</p>

      <Sheet
        open={editing !== null}
        title={editing?.mode === 'edycja' ? t.podkategorie.edytuj : t.podkategorie.nowa}
        onClose={() => setEditing(null)}
      >
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">{t.wspolne.nazwa}</span>
            <input
              value={name}
              maxLength={MAX_SUBCATEGORY_NAME}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.podkategorie.nazwaPrzyklad}
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
                aria-label={t.podkategorie.usun}
                onClick={() => setConfirmOpen(true)}
                className="px-4"
              >
                <TrashIcon className="h-5 w-5" />
              </Button>
            )}
          </div>

          <ConfirmDialog
            open={confirmOpen}
            title={t.podkategorie.pytanie(editing?.mode === 'edycja' ? editing.sub.name : '')}
            message={t.podkategorie.opisUsuniecia}
            onConfirm={remove}
            onCancel={() => setConfirmOpen(false)}
          />
        </div>
      </Sheet>
    </div>
  );
}
