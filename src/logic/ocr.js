// Offline-OCR-Pipeline: Canvas-Vorverarbeitung + Tesseract.js (self-hosted).
// Das Foto lebt ausschließlich im Speicher (ImageBitmap/Canvas/Blob) und wird
// nach der Extraktion verworfen — es wird nie persistiert.

import { createWorker } from 'tesseract.js';

const BASE = import.meta.env.BASE_URL; // '/Pwa-Finanztracker/'
const OCR_TIMEOUT_MS = 20_000;

/**
 * Skaliert auf max. 1600 px Breite, wandelt in Graustufen, erhöht Kontrast
 * und binarisiert mit adaptivem Threshold (Mittelwert über Kachel-Integralbild).
 * Gibt einen PNG-Blob zurück.
 */
export async function preprocessImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, w, h);

    const img = ctx.getImageData(0, 0, w, h);
    const { data } = img;

    // Graustufen + Kontrast-Stretch
    const gray = new Uint8ClampedArray(w * h);
    let min = 255;
    let max = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[p] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const range = Math.max(1, max - min);
    for (let p = 0; p < gray.length; p += 1) {
      gray[p] = ((gray[p] - min) / range) * 255;
    }

    // Integralbild für adaptives Thresholding (lokaler Mittelwert)
    const integral = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y += 1) {
      let rowSum = 0;
      for (let x = 0; x < w; x += 1) {
        rowSum += gray[y * w + x];
        integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
      }
    }

    const win = Math.max(15, Math.round(w / 24)) | 1; // Fenstergröße, ungerade
    const half = win >> 1;
    const bias = 0.90; // Pixel muss klar dunkler als lokaler Mittelwert sein

    for (let y = 0; y < h; y += 1) {
      const y1 = Math.max(0, y - half);
      const y2 = Math.min(h - 1, y + half);
      for (let x = 0; x < w; x += 1) {
        const x1 = Math.max(0, x - half);
        const x2 = Math.min(w - 1, x + half);
        const area = (x2 - x1 + 1) * (y2 - y1 + 1);
        const sum =
          integral[(y2 + 1) * (w + 1) + (x2 + 1)] -
          integral[y1 * (w + 1) + (x2 + 1)] -
          integral[(y2 + 1) * (w + 1) + x1] +
          integral[y1 * (w + 1) + x1];
        const mean = sum / area;
        const v = gray[y * w + x] < mean * bias ? 0 : 255;
        const i = (y * w + x) * 4;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas-Export fehlgeschlagen'))), 'image/png');
    });
  } finally {
    bitmap.close();
  }
}

/**
 * Führt die OCR auf einem Foto aus. Assets kommen aus /public/tesseract
 * (im Service-Worker-Precache — funktioniert offline).
 *
 * @param {File|Blob} file Foto vom Kamera-Input
 * @param {(pct: number, label: string) => void} onProgress 0..100
 * @param {{ cancelled?: boolean }} token Abbruch-Token (cancelled=true beendet den Worker)
 * @returns {Promise<string>} roher OCR-Text
 */
export async function recognizeReceipt(file, onProgress, token = {}) {
  onProgress?.(5, 'Bild wird vorbereitet …');
  const blob = await preprocessImage(file);
  if (token.cancelled) return '';

  onProgress?.(15, 'Texterkennung wird geladen …');
  const worker = await createWorker('deu', 1, {
    workerPath: `${BASE}tesseract/worker.min.js`,
    corePath: `${BASE}tesseract/`,
    langPath: `${BASE}tesseract/`,
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.(30 + Math.round(m.progress * 65), 'Beleg wird gelesen …');
      }
    },
  });

  try {
    if (token.cancelled) return '';
    await worker.setParameters({
      // LSTM ignoriert Whitelists teils, schadet aber nicht — hilft im Legacy-Pfad.
      tessedit_char_whitelist:
        '0123456789,.€:-/ ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüß',
      preserve_interword_spaces: '1',
    });

    const result = await Promise.race([
      worker.recognize(blob),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OCR-Timeout')), OCR_TIMEOUT_MS)
      ),
    ]);
    onProgress?.(100, 'Fertig');
    return result.data.text ?? '';
  } finally {
    // Worker immer beenden — Speicher auf Mobilgeräten ist knapp.
    worker.terminate().catch(() => {});
  }
}
