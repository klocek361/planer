import { SettingsIcon } from './icons';

export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ustawienia"
      className="text-muted active:text-ink -m-2 p-2 transition-colors"
    >
      <SettingsIcon className="h-6 w-6" />
    </button>
  );
}
