import type { ReactNode } from 'react';
import { PlusIcon } from './icons';

interface Props {
  /** Tytuł na środku górnego paska. Pusty — pasek ma same przyciski. */
  title?: string;
  /** Przyciski po prawej, zebrane w jedną zaokrągloną pigułkę. */
  actions?: ReactNode;
  /** Pływający przycisk „+” w prawym dolnym rogu. */
  fab?: { label: string; onClick: () => void };
  children: ReactNode;
}

/**
 * Szkielet „miękkich” ekranów (Przegląd, Nawyki): lekki górny pasek
 * z okrągłymi przyciskami zamiast dużego tytułu, treść w kartach i pływający
 * plus. Pozostałe ekrany zostają na zwykłym `Screen`.
 */
export function SoftScreen({ title, actions, fab, children }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="pt-safe px-safe shrink-0">
        <div className="relative flex h-14 items-center justify-end">
          {title && (
            <h1 className="text-ink pointer-events-none absolute inset-x-16 truncate text-center text-base font-semibold">
              {title}
            </h1>
          )}
          {actions && (
            <div className="bg-surface flex items-center gap-4 rounded-full px-4 py-2.5 shadow-[0_2px_14px_rgba(0,0,0,0.06)]">
              {actions}
            </div>
          )}
        </div>
      </header>

      <div className="px-safe min-h-0 flex-1 overflow-y-auto pb-4">
        {children}

        {fab && (
          // Przyklejony do dołu przewijanej treści — zawsze nad dolnym paskiem,
          // bez liczenia jego wysokości.
          <div className="pointer-events-none sticky bottom-3 flex justify-end pt-4">
            <button
              type="button"
              onClick={fab.onClick}
              aria-label={fab.label}
              className="bg-surface text-accent pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full shadow-[0_4px_18px_rgba(0,0,0,0.1)] active:scale-95"
            >
              <PlusIcon className="h-7 w-7" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Karta treści w miękkich ekranach — mocniej zaokrąglona niż reszta aplikacji. */
export function SoftCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`bg-surface px-4 py-3.5 shadow-[0_1px_12px_rgba(0,0,0,0.04)] ${className}`}
      style={{ borderRadius: 'calc(var(--r-app) * 1.35)' }}
    >
      {children}
    </section>
  );
}
