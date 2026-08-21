import type { ReactElement } from 'react';
import { CalendarIcon, HabitsIcon, OverviewIcon, TasksIcon } from './icons';
import type { TabId } from '../app/tabs';
import { useT } from '../i18n';

const ICONS: Record<TabId, (p: { className?: string }) => ReactElement> = {
  przeglad: OverviewIcon,
  kalendarz: CalendarIcon,
  zadania: TasksIcon,
  nawyki: HabitsIcon,
};

interface Props {
  /** Zakładki do pokazania, w kolejności ustawionej przez użytkowniczkę. */
  tabs: TabId[];
  active: TabId;
  onChange: (id: TabId) => void;
}

/**
 * Nawigacja na dole ekranu — przy 6,7 cala góra jest poza zasięgiem kciuka.
 * Zestaw i kolejność zakładek biorą się z ustawień, więc pasek może mieć
 * od jednej do czterech pozycji.
 */
export function TabBar({ tabs, active, onChange }: Props) {
  const { t } = useT();

  return (
    <nav className="border-line bg-bg pb-safe shrink-0 border-t px-2">
      <ul className="flex">
        {tabs.map((id) => {
          const Icon = ICONS[id];
          const isActive = id === active;
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-1 py-2 transition-colors ${
                  isActive ? 'text-accent' : 'text-muted'
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-[0.6875rem] leading-none font-medium">
                  {t.zakladki[id]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
