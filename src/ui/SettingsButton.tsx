import { useT } from '../i18n';
import { SettingsIcon } from './icons';

export function SettingsButton({ onClick }: { onClick: () => void }) {
  const { t } = useT();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t.ustawienia.tytul}
      className="text-muted active:text-ink -m-2 p-2 transition-colors"
    >
      <SettingsIcon className="h-6 w-6" />
    </button>
  );
}
