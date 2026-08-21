import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useBackDismiss } from '../platform/back';
import { Button } from './Button';

interface Props {
  open: boolean;
  /** Samo pytanie, np. „Usunąć nawyk Woda?”. */
  title: string;
  /** Co dokładnie zniknie — bez tego pytanie nie daje podstaw do decyzji. */
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Pytanie przed nieodwracalnym skasowaniem.
 *
 * Okienko na środku, nie panel od dołu — kasowanie ma zatrzymać rękę, a nie
 * wpisać się w rytm zwykłej edycji. „Anuluj” stoi pierwsze i jest szersze,
 * bo to ono jest wyjściem domyślnym; czerwony przycisk trzeba świadomie minąć.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Usuń',
  onConfirm,
  onCancel,
}: Props) {
  // Androidowe cofnięcie ma anulować, nigdy nie kasować.
  useBackDismiss(open, onCancel);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-60 flex items-center justify-center px-8">
          <motion.button
            type="button"
            aria-label="Anuluj"
            onClick={onCancel}
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            className="bg-bg rounded-app relative w-full max-w-sm px-5 py-5"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.16 }}
          >
            <h2 className="text-ink text-base leading-snug font-semibold">{title}</h2>
            {message && <p className="text-muted pt-2 text-sm leading-snug">{message}</p>}

            <div className="flex gap-2 pt-5">
              <Button className="flex-1" onClick={onCancel}>
                Anuluj
              </Button>
              <Button variant="danger" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
