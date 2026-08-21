import { useEffect, useRef } from 'react';

/**
 * Obsługa androidowego gestu cofania dla warstw, które da się zamknąć.
 *
 * Na Androidzie przesunięcie od krawędzi ekranu cofa się w historii
 * przeglądarki. Aplikacja dodana do ekranu początkowego historii nie ma, więc
 * bez tego cofnięcie przy otwartym panelu wyrzucałoby użytkowniczkę z Planera —
 * razem z niezapisanym formularzem. iPhone takiego gestu nie ma, więc tam ten
 * kod po prostu nic nie robi.
 *
 * Warstwy trzymamy na wspólnym stosie i nasłuchujemy `popstate` tylko raz.
 * Gdyby każda warstwa miała własny nasłuch, jedno cofnięcie zamykałoby je
 * wszystkie naraz — a tak zdejmuje dokładnie tę wierzchnią.
 */
interface Warstwa {
  zamknij: () => void;
  /** Zdjęta gestem cofania, a nie przyciskiem w aplikacji. */
  zdjeta: boolean;
}

const stos: Warstwa[] = [];

/**
 * Ile najbliższych zdarzeń `popstate` pochodzi z naszego własnego
 * `history.back()` — te trzeba przepuścić, inaczej sprzątanie po zamkniętej
 * warstwie zamykałoby od razu następną pod nią.
 */
let doPominiecia = 0;

let nasluchuje = false;

function obsluzCofniecie(): void {
  if (doPominiecia > 0) {
    doPominiecia -= 1;
    return;
  }
  const wierzchnia = stos.pop();
  if (!wierzchnia) return;
  wierzchnia.zdjeta = true;
  wierzchnia.zamknij();
}

function wlaczNasluch(): void {
  if (nasluchuje || typeof window === 'undefined') return;
  window.addEventListener('popstate', obsluzCofniecie);
  nasluchuje = true;
}

export function useBackDismiss(open: boolean, onClose: () => void): void {
  // Uchwyt trzymany w referencji — inaczej każda nowa funkcja onClose
  // przeładowywałaby efekt i dokładała kolejny wpis do historii.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;

    const warstwa: Warstwa = { zamknij: () => close.current(), zdjeta: false };
    stos.push(warstwa);
    wlaczNasluch();
    window.history.pushState({ warstwaPlanera: true }, '');

    return () => {
      const miejsce = stos.indexOf(warstwa);
      if (miejsce >= 0) stos.splice(miejsce, 1);

      // Warstwa zamknięta z poziomu aplikacji: zdejmujemy własny wpis
      // z historii i zapowiadamy, że wywołane tym `popstate` nie jest
      // gestem użytkowniczki.
      if (!warstwa.zdjeta) {
        doPominiecia += 1;
        window.history.back();
      }
    };
  }, [open]);
}
