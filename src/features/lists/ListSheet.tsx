import { useEffect, useState } from 'react';
import { addChecklist, deleteChecklist, updateChecklist } from '../../data/lists';
import type { Category, Checklist } from '../../data/types';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { CategoryPicker } from '../../ui/CategoryChip';
import { ConfirmDialog } from '../../ui/Confirm';
import { Sheet } from '../../ui/Sheet';
import { TrashIcon } from '../../ui/icons';

interface Props {
  open: boolean;
  /** Lista do edycji albo null, gdy zakładamy nową. */
  list: Checklist | null;
  categories: Category[];
  onClose: () => void;
  /** Wołane po skasowaniu — ekran listy musi wtedy wrócić do spisu. */
  onDeleted?: () => void;
}

export function ListSheet({ open, list, categories, onClose, onDeleted }: Props) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(list?.name ?? '');
    setNote(list?.note ?? '');
    setCategoryId(list?.categoryId);
  }, [open, list]);

  const trimmed = name.trim();

  const save = async () => {
    if (!trimmed) return;
    const draft = { name: trimmed, note: note.trim() || undefined, categoryId };
    if (list?.id) await updateChecklist(list.id, draft);
    else await addChecklist(draft);
    onClose();
  };

  const remove = async () => {
    setConfirmOpen(false);
    if (list?.id) await deleteChecklist(list.id);
    onClose();
    onDeleted?.();
  };

  return (
    <Sheet
      open={open}
      title={list ? t.listy.edytujListe : t.listy.nowaLista}
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.wspolne.nazwa}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.listy.nazwaPrzyklad}
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.listy.notatka}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t.listy.notatkaPrzyklad}
            className="bg-surface rounded-app text-ink resize-none px-3 py-2.5 text-base"
          />
        </label>

        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={!trimmed} onClick={save}>
            {t.wspolne.zapisz}
          </Button>
          {list && (
            <Button
              variant="danger"
              aria-label={t.listy.usunListe}
              onClick={() => setConfirmOpen(true)}
              className="px-4"
            >
              <TrashIcon className="h-5 w-5" />
            </Button>
          )}
        </div>

        <ConfirmDialog
          open={confirmOpen}
          title={t.listy.pytanieLista(list?.name ?? '')}
          message={t.listy.opisLista}
          onConfirm={remove}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    </Sheet>
  );
}
