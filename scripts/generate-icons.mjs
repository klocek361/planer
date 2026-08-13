/**
 * Generuje ikony aplikacji z jednego rysunku wektorowego.
 * Uruchamiane ręcznie: `npm run icons`. Wynik trafia do public/ i jest
 * commitowany, więc budowanie aplikacji nie potrzebuje sharp.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');

const INK = '#2C2C2A'; // grafitowy — jak kafelek zaznaczonego dnia
const PAPER = '#F5F3EF'; // ciepła biel
const ACCENT = '#C89B72'; // piaskowy akcent

/**
 * @param {object} opts
 * @param {number} opts.radius Zaokrąglenie tła (0 = pełne wypełnienie kafla).
 * @param {number} opts.markScale Rozmiar znaku względem kafla; mniejszy dla
 *   ikon maskowalnych, bo systemy przycinają brzegi.
 */
function icon({ radius, markScale }) {
  const offset = (100 - 100 * markScale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="${radius}" fill="${INK}"/>
  <g transform="translate(${offset} ${offset}) scale(${markScale})">
    <g fill="none" stroke="${PAPER}" stroke-width="4.5" stroke-linecap="round">
      <rect x="20" y="28" width="60" height="52" rx="10"/>
      <path d="M20 45h60"/>
      <path d="M36 19v14M64 19v14" stroke-width="5.5"/>
    </g>
    <circle cx="35" cy="63" r="4.5" fill="${PAPER}"/>
    <circle cx="50" cy="63" r="4.5" fill="${ACCENT}"/>
    <circle cx="65" cy="63" r="4.5" fill="${PAPER}"/>
  </g>
</svg>`;
}

const outputs = [
  { file: 'icons/icon-192.png', size: 192, svg: icon({ radius: 22, markScale: 1 }) },
  { file: 'icons/icon-512.png', size: 512, svg: icon({ radius: 22, markScale: 1 }) },
  // Maskowalna: tło na całą powierzchnię, znak zmieszczony w bezpiecznym polu.
  { file: 'icons/icon-maskable-512.png', size: 512, svg: icon({ radius: 0, markScale: 0.62 }) },
  // iOS sam zaokrągla ikonę, więc tutaj też pełne wypełnienie.
  { file: 'apple-touch-icon.png', size: 180, svg: icon({ radius: 0, markScale: 0.86 }) },
];

await mkdir(join(publicDir, 'icons'), { recursive: true });

for (const { file, size, svg } of outputs) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(join(publicDir, file));
  console.log(`✓ ${file} (${size}×${size})`);
}

await writeFile(join(publicDir, 'favicon.svg'), icon({ radius: 22, markScale: 1 }));
console.log('✓ favicon.svg');
