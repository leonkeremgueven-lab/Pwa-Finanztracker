// Kopiert die self-hosted Tesseract-Assets (Worker, WASM-Core, deu.traineddata.gz)
// aus node_modules nach public/tesseract/, damit die OCR komplett offline läuft.
// Läuft automatisch bei "npm install" (postinstall) und vor jedem Build.
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'tesseract');
await mkdir(outDir, { recursive: true });

const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // SIMD-Variante (moderne Geräte) + Fallback ohne SIMD
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm', 'tesseract-core-lstm.wasm'],
  ['node_modules/@tesseract.js-data/deu/4.0.0/deu.traineddata.gz', 'deu.traineddata.gz'],
];

for (const [src, dest] of files) {
  await copyFile(path.join(root, src), path.join(outDir, dest));
  console.log(`✓ ${dest}`);
}
console.log('Tesseract-Assets bereit in public/tesseract/');
