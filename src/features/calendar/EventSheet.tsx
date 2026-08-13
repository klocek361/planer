import { useEffect, useState } from 'react';
import { addEvent, deleteEvent, updateEvent } from '../../data/events';
import type { Category, EventItem } from '../../data/types';
import { fromKey, fullDateLabel } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { CategoryPicker } from '../../ui/CategoryChip';
import { Sheet } from '../../ui/Sheet';
import { TrashIcon } from '../../ui/icons';

interface Props {
  open: boolean;
  dateKey: string;
  /** Wydarzenie do edycji albo null, gdy dodajemy nowe. */
  event: EventItem | null;
  categories: Category[];
  onClose: () => void;
}

const DEFAULT_START = '09:00';
const DEFAULT_END = '10:00';

export function EventSheet({ open, dateKey, event, categories, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState(DEFAULT_START);
  const [endTime, setEndTime] = useState(DEFAULT_END);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [note, setNote] = useState('');

  // Wypełnia formularz przy każdym otwarciu — inaczej zostałyby dane poprzedniego wpisu.
  useEffect(() => {
    if (!open) return;
    setTitle(event?.title ?? '');
    setAllDay(event?.allDay ?? false);
    setStartTime(event?.startTime ?? DEFAULT_START);
    setEndTime(event?.endTime ?? DEFAULT_END);
    setCategoryId(event?.categoryId);
    setNote(event?.note ?? '');
  }, [open, event]);

  const trimmed = title.trim();
  const timesValid = allDay || !endTime || endTime >= startTime;
  const canSave = trimmed.length > 0 && timesValid;

  const save = async () => {
    if (!canSave) return;
    const draft = {
      title: trimmed,
      date: dateKey,
      allDay,
      startTime: allDay ? undefined : startTime,
      endTime: allDay || !endTime ? undefined : endTime,
      categoryId,
      note: note.trim() || undefined,
    };
    if (event?.id) await updateEvent(event.id, draft);
    else await addEvent(draft);
    onClose();
  };

  const remove = async () => {
    if (event?.id) await deleteEvent(event.id);
    onClose();
  };

  return (
    <Sheet
      open={open}
      title={event ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        <p className="text-muted -mt-2 text-sm">{fullDateLabel(fromKey(dateKey))}</p>

        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">Nazwa</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="np. Wizyta u dentysty"
            className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
          />
        </label>

        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />

        <label className="bg-surface rounded-app flex items-center justify-between px-3 py-2.5">
          <span className="text-ink text-sm font-medium">Całodniowe</span>
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="accent-accent h-5 w-5"
          />
        </label>

        {!allDay && (
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-2">
              <span className="text-muted text-xs font-medium">Od</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
              />
            </label>
            <label className="flex flex-1 flex-col gap-2">
              <span className="text-muted text-xs font-medium">Do</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
              />
            </label>
          </div>
        )}

        {!timesValid && (
          <p className="text-weekend -mt-3 text-xs">
            Godzina zakończenia jest wcześniejsza niż rozpoczęcia.
          </p>
        )}

        <label className="flex flex-col gap-2">
          <span className="text-muted text-xs font-medium">Notatka</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="nieobowiązkowa"
            className="bg-surface rounded-app text-ink resize-none px-3 py-2.5 text-base"
          />
        </label>

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={!canSave} onClick={save}>
            Zapisz
          </Button>
          {event && (
            <Button variant="danger" aria-label="Usuń wydarzenie" onClick={remove} className="px-4">
              <TrashIcon className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
