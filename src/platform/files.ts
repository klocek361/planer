/**
 * Zapis i odczyt plików. W wersji PWA korzysta z mechanizmów przeglądarki;
 * po przejściu na Capacitora podmienia się na @capacitor/filesystem.
 */

/**
 * Oddaje plik użytkowniczce. Na iOS najpierw próbuje systemowego arkusza
 * udostępniania (pozwala zapisać w Plikach lub iCloud Drive), bo zwykłe
 * pobieranie w aplikacji dodanej do ekranu początkowego bywa zawodne.
 */
export async function saveTextFile(
  filename: string,
  contents: string,
  mime = 'application/json',
): Promise<void> {
  const file = new File([contents], filename, { type: mime });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      // Anulowanie arkusza nie jest błędem — nie schodzimy wtedy do pobierania.
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Otwiera systemowy wybór pliku i zwraca jego treść jako tekst. */
export function pickTextFile(accept = 'application/json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
