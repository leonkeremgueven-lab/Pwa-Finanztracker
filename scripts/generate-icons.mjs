// Erzeugt die PWA-Icons (SVG + echte PNGs) in public/icons/.
// Aufruf: npm run icons
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
await mkdir(outDir, { recursive: true });

// Kreis + "F"-Monogramm in Akzentfarbe auf dunklem Grund.
// padded=true rückt das Motiv ein (safe zone für maskable Icons).
function iconSvg(padded = false) {
  const s = padded ? 0.72 : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0e0f12"/>
  <g transform="translate(256 256) scale(${s}) translate(-256 -256)">
    <circle cx="256" cy="256" r="208" fill="none" stroke="#7fd88f" stroke-width="26"/>
    <path d="M196 366 V150 h132 v44 h-84 v52 h72 v44 h-72 v76 z" fill="#7fd88f"/>
  </g>
</svg>`;
}

await writeFile(path.join(outDir, 'icon.svg'), iconSvg(false));

const jobs = [
  { file: 'icon-192.png', size: 192, padded: false },
  { file: 'icon-512.png', size: 512, padded: false },
  { file: 'icon-maskable-512.png', size: 512, padded: true },
  { file: 'apple-touch-icon.png', size: 180, padded: true },
];

for (const { file, size, padded } of jobs) {
  await sharp(Buffer.from(iconSvg(padded))).resize(size, size).png().toFile(path.join(outDir, file));
  console.log(`✓ ${file} (${size}×${size})`);
}
console.log('Icons erzeugt in', outDir);
