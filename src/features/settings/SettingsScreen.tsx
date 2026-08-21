import { useState } from 'react';
import { Screen } from '../../ui/Screen';
import { useBackDismiss } from '../../platform/back';
import { ChevronRightIcon } from '../../ui/icons';
import { AppearanceScreen } from './AppearanceScreen';
import { BackupScreen } from './BackupScreen';
import { CategoriesScreen } from './CategoriesScreen';
import { TabsScreen } from './TabsScreen';

type View = 'menu' | 'kategorie' | 'wyglad' | 'zakladki' | 'kopia';

const ROWS: { id: Exclude<View, 'menu'>; label: string; hint: string }[] = [
  { id: 'wyglad', label: 'Wygląd', hint: 'Kolory, krój i rozmiar pisma, tło' },
  { id: 'kategorie', label: 'Kategorie', hint: 'Nazwy i kolory wspólne dla całej aplikacji' },
  { id: 'zakladki', label: 'Zakładki', hint: 'Kolejność i włączanie dolnego paska' },
  { id: 'kopia', label: 'Kopia zapasowa', hint: 'Zapis i odczyt wszystkich danych' },
];

export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>('menu');
  const back = () => setView('menu');

  // Cofnięcie z podekranu wraca do menu ustawień, a nie zamyka ustawień.
  useBackDismiss(view !== 'menu', back);

  if (view === 'kategorie') return <CategoriesScreen onBack={back} />;

  if (view === 'wyglad') return <AppearanceScreen onBack={back} />;

  if (view === 'zakladki') return <TabsScreen onBack={back} />;

  if (view === 'kopia') return <BackupScreen onBack={back} />;

  return (
    <Screen
      title="Ustawienia"
      action={
        <button
          type="button"
          onClick={onClose}
          className="bg-surface rounded-app text-ink px-3 py-1.5 text-sm font-medium"
        >
          Gotowe
        </button>
      }
    >
      <ul className="flex flex-col gap-1">
        {ROWS.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => setView(row.id)}
              className="bg-surface rounded-app flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="flex-1">
                <span className="text-ink block text-sm font-medium">{row.label}</span>
                <span className="text-muted block text-xs">{row.hint}</span>
              </span>
              <ChevronRightIcon className="text-faint h-5 w-5 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
