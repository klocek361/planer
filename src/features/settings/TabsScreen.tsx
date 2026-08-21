import { useLayoutStore } from '../../app/layoutStore';
import { TAB_HINTS, TAB_LABELS, visibleTabs } from '../../app/tabs';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { ArrowDownIcon, ArrowUpIcon } from '../../ui/icons';

/**
 * Kolejność i widoczność zakładek dolnego paska. Strzałki zamiast przeciągania —
 * na telefonie w jednej ręce celniejsze, a lista ma najwyżej cztery pozycje.
 */
export function TabsScreen({ onBack }: { onBack: () => void }) {
  const order = useLayoutStore((state) => state.order);
  const hidden = useLayoutStore((state) => state.hidden);
  const move = useLayoutStore((state) => state.move);
  const toggle = useLayoutStore((state) => state.toggle);
  const reset = useLayoutStore((state) => state.reset);

  const visible = visibleTabs({ order, hidden });
  // Ostatniej włączonej zakładki nie da się wyłączyć — pasek bez ani jednej
  // pozycji byłby ślepym zaułkiem.
  const lastOne = visible.length === 1;

  return (
    <Screen title="Zakładki" onBack={onBack}>
      <ul className="flex flex-col gap-1">
        {order.map((tab, index) => {
          const isHidden = hidden.includes(tab);
          const lockedOn = !isHidden && lastOne;

          return (
            <li
              key={tab}
              className="bg-surface rounded-app flex items-center gap-2 px-3 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-medium ${isHidden ? 'text-faint' : 'text-ink'}`}
                >
                  {TAB_LABELS[tab]}
                </span>
                <span className="text-muted block truncate text-xs">
                  {isHidden ? 'Wyłączona' : TAB_HINTS[tab]}
                </span>
              </span>

              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(tab, -1)}
                  disabled={index === 0}
                  aria-label={`Przesuń ${TAB_LABELS[tab]} wyżej`}
                  className="text-muted active:text-ink p-1.5 disabled:opacity-25"
                >
                  <ArrowUpIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(tab, 1)}
                  disabled={index === order.length - 1}
                  aria-label={`Przesuń ${TAB_LABELS[tab]} niżej`}
                  className="text-muted active:text-ink p-1.5 disabled:opacity-25"
                >
                  <ArrowDownIcon className="h-5 w-5" />
                </button>

                <input
                  type="checkbox"
                  checked={!isHidden}
                  disabled={lockedOn}
                  onChange={() => toggle(tab)}
                  aria-label={`Pokazuj zakładkę ${TAB_LABELS[tab]}`}
                  className="accent-accent ml-1 h-5 w-5 disabled:opacity-40"
                />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-muted px-1 pt-3 text-xs">
        Kolejność na liście to kolejność na pasku u dołu ekranu. Wyłączona zakładka znika z paska,
        ale nic z niej nie ginie — wystarczy włączyć ją z powrotem.
      </p>

      <div className="pt-4">
        <Button variant="soft" onClick={reset}>
          Przywróć domyślne
        </Button>
      </div>
    </Screen>
  );
}
