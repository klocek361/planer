import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { saveDayNote } from '../../data/dayNotes';
import type { Category, DayNote } from '../../data/types';
import { MAX_DAY_NOTE } from '../../data/validate';
import { useT } from '../../i18n';
import { dayHeadingLabel } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { CategoryChip } from '../../ui/CategoryChip';
import { Sheet } from '../../ui/Sheet';
import { PlusIcon, TrashIcon } from '../../ui/icons';

/**
 * Notatki dnia nad zadaniami wybranego dnia — po jednej na wspólny kalendarz,
 * np. „koty nakarmione, kuweta posprzątana”. Widzą je wszyscy członkowie.
 * Bez wspólnych kalendarzy nic się nie pokazuje.
 */
export function DayNotes({ date }: { date: string }) {
  const { t } = useT();
  const shared = useLiveQuery(
    () => db.categories.filter((c) => c.space !== undefined).sortBy('order'),
    [],
    [] as Category[],
  );
  const notes = useLiveQuery(() => db.dayNotes.where('date').equals(date).toArray(), [date], [] as DayNote[]);
  const members = useLiveQuery(() => db.members.toArray(), [], []);
  const [editing, setEditing] = useState<number | null>(null);

  const categoryById = useMemo(() => new Map(shared.map((c) => [c.id!, c])), [shared]);
  const nameOf = useMemo(() => new Map(members.map((m) => [`${m.space}:${m.uid}`, m.name])), [members]);
  // Notatki tylko z kalendarzy, do których telefon wciąż należy.
  const visible = notes.filter((n) => categoryById.has(n.categoryId));
  const free = shared.filter((c) => !visible.some((n) => n.categoryId === c.id));

  if (shared.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 pb-3">
      {visible.map((note) => {
        const category = categoryById.get(note.categoryId)!;
        const author = note.by ? nameOf.get(`${category.space}:${note.by}`) : undefined;
        return (
          <button
            key={note.id}
            type="button"
            onClick={() => setEditing(note.categoryId)}
            className="bg-surface rounded-app border-l-4 px-3 py-2.5 text-left"
            style={{ borderLeftColor: category.color }}
          >
            <span className="text-ink block text-sm whitespace-pre-wrap">{note.text}</span>
            <span className="text-muted block pt-1 text-xs">
              {category.name}
              {author ? ` · ${author}` : ''}
            </span>
          </button>
        );
      })}

      {free.length > 0 && (
        <button
          type="button"
          onClick={() => setEditing(free[0]!.id!)}
          className="text-muted active:text-ink flex items-center gap-1.5 self-start py-1 text-xs font-medium"
        >
          <PlusIcon className="h-4 w-4" />
          {t.notatkaDnia.dodaj}
        </button>
      )}

      <DayNoteSheet
        open={editing !== null}
        date={date}
        categoryId={editing}
        calendars={shared}
        notes={visible}
        onChoose={setEditing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function DayNoteSheet({
  open,
  date,
  categoryId,
  calendars,
  notes,
  onChoose,
  onClose,
}: {
  open: boolean;
  date: string;
  categoryId: number | null;
  calendars: Category[];
  notes: DayNote[];
  onChoose: (id: number) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const existing = notes.find((n) => n.categoryId === categoryId);
  const [text, setText] = useState('');

  // Treść podąża za wybranym kalendarzem — każdy ma swoją notatkę.
  useEffect(() => {
    if (open) setText(existing?.text ?? '');
  }, [open, categoryId, existing?.text]);

  const calendar = calendars.find((c) => c.id === categoryId);

  const save = async (value: string) => {
    if (categoryId === null) return;
    await saveDayNote(categoryId, date, value);
    onClose();
  };

  return (
    <Sheet open={open} title={t.notatkaDnia.tytul} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <p className="text-muted -mt-2 text-sm first-letter:uppercase">{dayHeadingLabel(date)}</p>

        {calendars.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {calendars.map((c) => (
              <CategoryChip
                key={c.id}
                label={c.name}
                color={c.color}
                active={c.id === categoryId}
                onClick={() => onChoose(c.id!)}
              />
            ))}
          </div>
        )}

        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">{t.notatkaDnia.tresc}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.notatkaDnia.przyklad}
            rows={3}
            maxLength={MAX_DAY_NOTE}
            className="bg-surface rounded-app text-ink resize-none px-3 py-2.5 text-base"
          />
          {calendar && <span className="text-muted text-xs">{t.notatkaDnia.widza(calendar.name)}</span>}
        </label>

        <div className="flex gap-2">
          <Button
            variant="primary"
            className="flex-1"
            disabled={!text.trim() && !existing}
            onClick={() => save(text)}
          >
            {t.wspolne.zapisz}
          </Button>
          {existing && (
            <Button variant="danger" aria-label={t.notatkaDnia.usun} onClick={() => save('')} className="px-4">
              <TrashIcon className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
