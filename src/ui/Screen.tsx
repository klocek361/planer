import type { ReactNode } from 'react';
import { ChevronLeftIcon } from './icons';
import { useT } from '../i18n';

interface Props {
  title: string;
  action?: ReactNode;
  /** Gdy podane, nad tytułem pojawia się przycisk powrotu. */
  onBack?: () => void;
  children: ReactNode;
}

/**
 * Wspólny szkielet ekranu: nagłówek przyklejony u góry, treść przewijana pod nim.
 * Nagłówek jest duży i ciężki — to jedyny mocny akcent typograficzny w całym
 * interfejsie, reszta ma zostać cicha.
 */
export function Screen({ title, action, onBack, children }: Props) {
  const { t } = useT();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="pt-safe px-safe shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-muted active:text-ink -ml-2 flex items-center gap-0.5 py-1 pr-2 pl-1 text-sm font-medium"
          >
            <ChevronLeftIcon className="h-5 w-5" />
            {t.wspolne.wstecz}
          </button>
        )}
        <div className="flex items-end justify-between gap-3 pb-2">
          <h1 className="text-ink text-4xl leading-none font-bold tracking-tight">{title}</h1>
          {action ? <div className="flex items-center gap-1 pb-1">{action}</div> : null}
        </div>
      </header>
      <div className="px-safe min-h-0 flex-1 overflow-y-auto pb-4">{children}</div>
    </div>
  );
}

/** Tymczasowy komunikat na ekranach, które dopiero powstaną. */
export function Placeholder({ text }: { text: string }) {
  return (
    <div className="text-muted flex h-full min-h-48 items-center justify-center px-6 text-center text-sm">
      {text}
    </div>
  );
}
