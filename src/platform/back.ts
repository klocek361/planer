import { useEffect, useRef } from 'react';

/**
 * Sprawia, że androidowy gest cofania (albo przycisk wstecz) zamyka wierzchnią
 * warstwę zamiast całej aplikacji.
 *
 * Na Androidzie przesunięcie od krawędzi ekranu cofa się w historii
 * przeglądarki. Aplikacja dodana do ekranu początkowego historii nie ma, więc
 * bez tego cofnięcie przy otwartym panelu wyrzucałoby użytkowniczkę z Planera —
 * razem z niezapisanym formularzem. iPhone takiego gestu nie ma, więc tam ten
 * kod po prostu nic nie robi.
 *
 * Zasada: otwarcie warstwy dokłada wpis do historii, cofnięcie go zdejmuje
 * i zamyka warstwę. Zamknięcie przyciskiem „Zamknij” samo sprząta ten wpis,
 * żeby historia nie puchła przy wielokrotnym otwieraniu.
 */
export function useBackDismiss(open: boolean, onClose: () => void): void {
  // Uchwyt trzymany w referencji — inaczej każda nowa funkcja onClose
  // przeładowywałaby efekt i dokładała kolejny wpis do historii.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;

    window.history.pushState({ warstwaPlanera: true }, '');
    let poppedByUser = false;

    const handle = () => {
      poppedByUser = true;
      close.current();
    };
    window.addEventListener('popstate', handle);

    return () => {
      window.removeEventListener('popstate', handle);
      // Warstwa zamknięta z poziomu aplikacji: zdejmujemy własny wpis.
      // Nasłuch jest już odpięty, więc to cofnięcie nie zamknie niczego drugi raz.
      if (!poppedByUser) window.history.back();
    };
  }, [open]);
}
