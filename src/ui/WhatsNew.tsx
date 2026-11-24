import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { SEEN_VERSION_KEY, shouldShowWhatsNew } from '../app/whatsNew';
import { APP_VERSION } from '../app/version';
import { db } from '../data/db';
import { useT } from '../i18n';
import { useBackDismiss } from '../platform/back';
import { Button } from './Button';

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_VERSION_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberSeen(): void {
  try {
    localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION);
  } catch {
    /* pamięć przeglądarki niedostępna — okno pokaże się jeszcze raz, trudno */
  }
}

/** Czy telefon ma już własne dane — kategorie startowe się nie liczą. */
async function hasUserData(): Promise<boolean> {
  const counts = await Promise.all([
    db.tasks.count(),
    db.events.count(),
    db.habits.count(),
    db.lists.count(),
    db.moneyEntries.count(),
    db.syncState.count(),
  ]);
  return counts.some((n) => n > 0);
}

/** Okno „Nowa wersja vX.Y.Z” z listą usprawnień — raz po każdej aktualizacji. */
export function WhatsNew() {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const seen = readSeen();
      const show = shouldShowWhatsNew(APP_VERSION, seen, seen ? true : await hasUserData().catch(() => false));
      if (cancelled) return;
      if (show) setOpen(true);
      else rememberSeen();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const close = () => {
    rememberSeen();
    setOpen(false);
  };
  useBackDismiss(open, close);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-60 flex items-center justify-center px-6">
          <motion.button
            type="button"
            aria-label={t.wspolne.zamknij}
            onClick={close}
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t.nowosci.tytul(APP_VERSION)}
            className="bg-bg rounded-app relative max-h-[80dvh] w-full max-w-sm overflow-y-auto px-5 py-5"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.16 }}
          >
            <h2 className="text-ink text-lg leading-snug font-semibold">{t.nowosci.tytul(APP_VERSION)}</h2>
            <p className="text-muted pt-3 text-sm font-medium">{t.nowosci.usprawnienia}</p>
            <ul className="flex flex-col gap-2 pt-2">
              {t.nowosci.zmiany.map((zmiana, i) => (
                <li key={i} className="text-ink flex gap-2 text-sm leading-snug">
                  <span className="text-accent shrink-0" aria-hidden="true">
                    •
                  </span>
                  <span>{zmiana}</span>
                </li>
              ))}
            </ul>
            <Button variant="primary" className="mt-5 w-full" onClick={close}>
              {t.nowosci.ok}
            </Button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
