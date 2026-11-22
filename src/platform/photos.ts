/**
 * Zdjęcie do sugestii: zmniejszone na telefonie i zapisane od nowa przez płótno.
 * Ponowny zapis zostawia same piksele — znikają dane z aparatu (EXIF), w tym
 * miejsce zrobienia zdjęcia. Zrzuty ekranu (PNG) zostają w PNG, jeśli się
 * zmieszczą — tekst na nich jest wtedy ostry; reszta idzie jako JPEG.
 * Serwer przyjmuje najwyżej 1 MB na zdjęcie, tylko JPEG i PNG.
 */

export type PhotoType = 'image/jpeg' | 'image/png';

export interface PreparedPhoto {
  typ: PhotoType;
  /** Bajty w base64, bez nagłówka data:. */
  dane: string;
}

const MAX_SIDE = 1600;
const MAX_BYTES = 900_000;

function toBlob(canvas: HTMLCanvasElement, type: PhotoType, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function draw(bitmap: ImageBitmap, side: number, whiteBackground: boolean): HTMLCanvasElement {
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  if (whiteBackground) {
    ctx.fillStyle = '#fff'; // przezroczystość w JPEG → białe tło zamiast czarnego
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Plik z telefonu → JPEG albo PNG w base64. Rzuca, gdy to nie obraz albo się nie da zmieścić. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file);
  try {
    if (file.type === 'image/png') {
      const png = await toBlob(draw(bitmap, MAX_SIDE, false), 'image/png');
      if (png && png.size <= MAX_BYTES) return { typ: 'image/png', dane: await toBase64(png) };
    }
    let side = MAX_SIDE;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const jpeg = await toBlob(draw(bitmap, side, true), 'image/jpeg', attempt < 3 ? 0.82 - attempt * 0.1 : 0.6);
      if (jpeg && jpeg.size <= MAX_BYTES) return { typ: 'image/jpeg', dane: await toBase64(jpeg) };
      if (attempt >= 2) side = Math.round(side * 0.75);
    }
  } finally {
    bitmap.close();
  }
  throw new Error('za duże');
}

/** Przygotowane zdjęcie → adres do podglądu przed wysłaniem. */
export const photoPreview = (p: PreparedPhoto): string => `data:${p.typ};base64,${p.dane}`;
