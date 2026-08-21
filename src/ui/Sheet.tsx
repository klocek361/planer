import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useBackDismiss } from '../platform/back';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Panel wysuwany od dołu ekranu — na telefonie wygodniejszy niż okno na środku,
 * bo treść i przyciski lądują w zasięgu kciuka.
 */
export function Sheet({ open, title, onClose, children }: Props) {
  // Na Androidzie cofnięcie zamyka panel, a nie całą aplikację.
  useBackDismiss(open, onClose);

  // Blokuje przewijanie treści pod spodem, dopóki panel jest otwarty.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <motion.button
            type="button"
            aria-label="Zamknij"
            onClick={onClose}
            className="absolute inset-0 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="bg-bg pb-safe relative max-h-[88dvh] overflow-y-auto rounded-t-3xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
          >
            <div className="bg-bg sticky top-0 z-10 flex items-center justify-between px-5 pt-4 pb-3">
              <h2 className="text-ink text-lg font-semibold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-muted active:text-ink -m-2 p-2 text-sm font-medium"
              >
                Zamknij
              </button>
            </div>
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
