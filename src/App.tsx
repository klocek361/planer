import { useEffect, useState } from 'react';
import { CalendarScreen } from './features/calendar/CalendarScreen';
import { HabitsScreen } from './features/habits/HabitsScreen';
import { OverviewScreen } from './features/overview/OverviewScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { TasksScreen } from './features/tasks/TasksScreen';
import { useApplyTheme } from './theme/useApplyTheme';
import { TabBar } from './ui/TabBar';
import { useLayoutStore } from './app/layoutStore';
import { visibleTabs, type TabId } from './app/tabs';

export function App() {
  useApplyTheme();

  const order = useLayoutStore((state) => state.order);
  const hidden = useLayoutStore((state) => state.hidden);
  const tabs = visibleTabs({ order, hidden });

  const [tab, setTab] = useState<TabId>(() => tabs[0] ?? 'kalendarz');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = () => setSettingsOpen(true);

  // Po wyłączeniu zakładki, na której akurat stoimy, trzeba przeskoczyć na
  // pierwszą widoczną — inaczej ekran zostałby pusty.
  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0] ?? 'kalendarz');
  }, [tabs, tab]);

  // Wysokość liczona w dvh, żeby pasek adresu Safari nie ucinał dolnej nawigacji.
  return (
    <div className="flex h-[100dvh] flex-col">
      {settingsOpen ? (
        <SettingsScreen onClose={() => setSettingsOpen(false)} />
      ) : (
        <>
          {tab === 'przeglad' && <OverviewScreen onOpenSettings={openSettings} />}
          {tab === 'kalendarz' && <CalendarScreen onOpenSettings={openSettings} />}
          {tab === 'zadania' && <TasksScreen onOpenSettings={openSettings} />}
          {tab === 'nawyki' && <HabitsScreen onOpenSettings={openSettings} />}
          <TabBar tabs={tabs} active={tab} onChange={setTab} />
        </>
      )}
    </div>
  );
}
