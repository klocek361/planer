import { useState } from 'react';
import { useT } from '../../i18n';
import { Screen } from '../../ui/Screen';
import { useBackDismiss } from '../../platform/back';
import { ChevronRightIcon } from '../../ui/icons';
import { AppearanceScreen } from './AppearanceScreen';
import { BackupScreen } from './BackupScreen';
import { CalendarPrefsScreen } from './CalendarPrefsScreen';
import { LanguageScreen } from './LanguageScreen';
import { CategoriesScreen } from './CategoriesScreen';
import { TabsScreen } from './TabsScreen';

type View = 'menu' | 'kategorie' | 'wyglad' | 'zakladki' | 'kalendarz' | 'jezyk' | 'kopia';

const ROWS: Exclude<View, 'menu'>[] = [
  'wyglad',
  'kategorie',
  'zakladki',
  'kalendarz',
  'jezyk',
  'kopia',
];

export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [view, setView] = useState<View>('menu');
  const back = () => setView('menu');

  // Cofnięcie z podekranu wraca do menu ustawień, a nie zamyka ustawień.
  useBackDismiss(view !== 'menu', back);

  if (view === 'kategorie') return <CategoriesScreen onBack={back} />;

  if (view === 'wyglad') return <AppearanceScreen onBack={back} />;

  if (view === 'zakladki') return <TabsScreen onBack={back} />;

  if (view === 'kalendarz') return <CalendarPrefsScreen onBack={back} />;

  if (view === 'jezyk') return <LanguageScreen onBack={back} />;

  if (view === 'kopia') return <BackupScreen onBack={back} />;

  return (
    <Screen
      title={t.ustawienia.tytul}
      action={
        <button
          type="button"
          onClick={onClose}
          className="bg-surface rounded-app text-ink px-3 py-1.5 text-sm font-medium"
        >
          {t.wspolne.gotowe}
        </button>
      }
    >
      <ul className="flex flex-col gap-1">
        {ROWS.map((row) => (
          <li key={row}>
            <button
              type="button"
              onClick={() => setView(row)}
              className="bg-surface rounded-app flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="flex-1">
                <span className="text-ink block text-sm font-medium">{t.ustawienia[row]}</span>
                <span className="text-muted block text-xs">
                  {t.ustawienia[`${row}Opis` as const]}
                </span>
              </span>
              <ChevronRightIcon className="text-faint h-5 w-5 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
