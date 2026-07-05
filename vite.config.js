import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages liefert die App unter https://<user>.github.io/Pwa-Finanztracker/
// aus — base MUSS dem Repo-Namen entsprechen.
export default defineConfig({
  base: '/Pwa-Finanztracker/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,wasm,gz}'],
        // Tesseract-Core (~4-5 MB) und deu.traineddata.gz (~10 MB) müssen in
        // den Precache, damit der Beleg-Scanner offline funktioniert.
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-css',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Finanz',
        short_name: 'Finanz',
        description: 'Persönlicher Finanztracker — offline, lokal, privat.',
        lang: 'de',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0e0f12',
        background_color: '#0e0f12',
        start_url: '/Pwa-Finanztracker/',
        scope: '/Pwa-Finanztracker/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
