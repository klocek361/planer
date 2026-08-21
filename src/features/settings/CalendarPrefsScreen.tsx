import { useLayoutStore } from '../../app/layoutStore';
import {
  CALENDAR_TASKS_HINTS,
  CALENDAR_TASKS_LABELS,
  type CalendarTasks,
} from '../../app/tabs';
import { Screen } from '../../ui/Screen';

const MODES: CalendarTasks[] = ['nazwy', 'licznik'];

/** Jak zadania z terminem pokazują się w siatce miesiąca. */
export function CalendarPrefsScreen({ onBack }: { onBack: () => void }) {
  const mode = useLayoutStore((state) => state.calendarTasks);
  const setMode = useLayoutStore((state) => state.setCalendarTasks);

  return (
    <Screen title="Kalendarz" onBack={onBack}>
      <p className="text-muted px-1 pb-3 text-xs">
        Zadania z terminem pokazują się w siatce miesiąca. Wybierz, ile mają zajmować miejsca.
      </p>

      <ul className="flex flex-col gap-1">
        {MODES.map((item) => {
          const active = mode === item;
          return (
            <li key={item}>
              <button
                type="button"
                onClick={() => setMode(item)}
                aria-pressed={active}
                className={`rounded-app flex w-full items-center gap-3 px-4 py-3 text-left ${
                  active ? 'bg-selected text-selected-ink' : 'bg-surface text-ink'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{CALENDAR_TASKS_LABELS[item]}</span>
                  <span className={`block text-xs ${active ? 'opacity-70' : 'text-muted'}`}>
                    {CALENDAR_TASKS_HINTS[item]}
                  </span>
                </span>
                <Preview mode={item} active={active} />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-muted px-1 pt-3 text-xs">
        W obu trybach dotknięcie dnia pokazuje jego zadania w całości pod siatką — razem z tymi,
        które się w komórce nie zmieściły. Nazwa dłuższa niż komórka przepływa w bok, ale tylko
        w zaznaczonym dniu; gdyby jechały wszystkie naraz, siatki nie dałoby się czytać.
      </p>

      <p className="text-muted px-1 pt-2 text-xs">
        W siatce pokazują się zadania jeszcze niezrobione. Odhaczone znikają z kafelka, ale
        zostają w panelu pod spodem.
      </p>
    </Screen>
  );
}

/** Miniatura kafelka dnia — pokazuje różnicę, zanim się ją kliknie. */
function Preview({ mode, active }: { mode: CalendarTasks; active: boolean }) {
  const line = active ? 'bg-selected-ink' : 'bg-faint';

  return (
    <span
      className={`flex h-11 w-9 shrink-0 flex-col gap-[3px] rounded-md px-1 pt-1 ${
        active ? 'bg-black/15' : 'bg-bg'
      }`}
      aria-hidden="true"
    >
      <span className={`h-1 w-2 self-center rounded-full ${line} opacity-70`} />
      {mode === 'nazwy' ? (
        <>
          <span className={`h-1 w-full rounded-full ${line} opacity-90`} />
          <span className={`h-1 w-4/5 rounded-full ${line} opacity-45`} />
          <span className={`h-1 w-3/5 rounded-full ${line} opacity-45`} />
        </>
      ) : (
        <>
          <span className={`h-1 w-full rounded-full ${line} opacity-90`} />
          <span className="flex items-center gap-[2px] pt-[2px]">
            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-selected-ink' : 'bg-accent'}`} />
            <span className={`h-1 w-1.5 rounded-full ${line} opacity-70`} />
          </span>
        </>
      )}
    </span>
  );
}
