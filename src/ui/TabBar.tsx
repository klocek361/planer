import type { ReactElement } from 'react';
import { CalendarIcon, HabitsIcon, TasksIcon } from './icons';
import type { TabId } from '../app/tabs';

const TABS: { id: TabId; label: string; Icon: (p: { className?: string }) => ReactElement }[] = [
  { id: 'kalendarz', label: 'Kalendarz', Icon: CalendarIcon },
  { id: 'zadania', label: 'Zadania', Icon: TasksIcon },
  { id: 'nawyki', label: 'Nawyki', Icon: HabitsIcon },
];

interface Props {
  active: TabId;
  onChange: (id: TabId) => void;
}

/**
 * Nawigacja na dole ekranu — przy 6,7 cala góra jest poza zasięgiem kciuka.
 */
export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="border-line bg-bg pb-safe shrink-0 border-t px-2">
      <ul className="flex">
        {TABS.map(({ id, label, Icon }) => {
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
                <span className="text-[0.6875rem] leading-none font-medium">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
