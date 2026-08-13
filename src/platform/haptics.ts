/**
 * Warstwa zależna od platformy. Przy przejściu na Capacitora (App Store,
 * Android) podmienia się wyłącznie zawartość tego katalogu.
 *
 * Safari na iOS nie udostępnia Vibration API, więc w wersji PWA to cicha
 * atrapa — celowo, żeby wywołania w kodzie aplikacji już były na miejscu.
 */
export function tap(): void {
  if ('vibrate' in navigator) navigator.vibrate(8);
}
