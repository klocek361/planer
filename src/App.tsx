import { useState } from 'react';
import { CalendarScreen } from './features/calendar/CalendarScreen';
import { HabitsScreen } from './features/habits/HabitsScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { TasksScreen } from './features/tasks/TasksScreen';
import { useApplyTheme } from './theme/useApplyTheme';
import { TabBar } from './ui/TabBar';
import type { TabId } from './app/tabs';

export function App() {
  useApplyTheme();

  const [tab, setTab] = useState<TabId>('kalendarz');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = () => setSettingsOpen(true);

  // Wysokość liczona w dvh, żeby pasek adresu Safari nie ucinał dolnej nawigacji.
  return (
    <div className="flex h-[100dvh] flex-col">
      {settingsOpen ? (
        <SettingsScreen onClose={() => setSettingsOpen(false)} />
      ) : (
        <>
          {tab === 'kalendarz' && <CalendarScreen onOpenSettings={openSettings} />}
          {tab === 'zadania' && <TasksScreen onOpenSettings={openSettings} />}
          {tab === 'nawyki' && <HabitsScreen onOpenSettings={openSettings} />}
          <TabBar active={tab} onChange={setTab} />
        </>
      )}
    </div>
  );
}
