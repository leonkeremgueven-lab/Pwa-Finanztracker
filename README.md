# Finanz — persönlicher Finanztracker (PWA)

Mobile-first Progressive Web App für einen einzelnen Nutzer. Läuft komplett
offline, speichert alle Daten ausschließlich lokal (IndexedDB) und wird auf
GitHub Pages gehostet → auf Android als App installierbar. UI auf Deutsch,
Beträge in EUR (de-DE), intern immer als Integer in Cent.

## Features

- **Schnelleingabe**: Betrag tippen → Kategorie antippen → grüner Speichern-Button. Vorlagen-Chips buchen mit 1 Tap.
- **Grundkonfiguration**: feste monatliche Einnahmen (Gehalt …) und Ausgaben (Miete, Strom …) einmal eintragen, nach Kategorien gegliedert — sie werden jeden Monat automatisch verbucht.
- **Beleg-Scanner**: Foto vom Kassenbon → Offline-OCR (Tesseract.js, self-hosted, deutsch) → Gesamtbetrag wird erkannt (SUMME/GESAMT/TOTAL-Heuristik inkl. OCR-Verschreiber) und zur Bestätigung vorausgefüllt. Das Foto wird nie gespeichert.
- **Historie** mit Suche, Filtern (Kategorie, Typ, Zeitraum, Betrag), Bearbeiten und Löschen mit 5-Sekunden-Undo.
- **Budgets** pro Kategorie mit Ampel-Fortschritt (>80 % amber, >100 % rot).
- **Sparziele** mit Fortschrittsring und linearer Zielprognose.
- **Abos**: wiederkehrende Buchungen (wöchentlich/monatlich/jährlich) werden beim App-Start automatisch nachgebucht — idempotent, auch nach Tagen ohne Öffnen.
- **Analytics**: Einnahmen/Ausgaben (6 Monate), Kategorie-Donut, 12-Monats-Trend, Sparquote.
- **Net Worth**: Konten + historisierte Saldo-Snapshots mit Verlaufs-Chart.
- **Monatsabschluss-Report** für jeden Vormonat, mit Archiv.
- **Backup**: Export/Import als JSON — validiert, mit Vorschau, atomar.

## Techstack

React 18 · Vite 5 · `idb` · `vite-plugin-pwa` (Workbox) · Recharts ·
Tesseract.js (self-hosted inkl. `deu.traineddata`) · reines CSS. Kein Router,
kein UI-Framework.

## Entwicklung

```bash
npm install     # kopiert auch die Tesseract-Assets nach public/tesseract/
npm run dev     # Dev-Server
npm test        # Logik-Tests (Recurring-Engine, Beleg-Heuristik, Stats, Report)
npm run build   # Produktions-Build inkl. Service Worker
npm run icons   # PWA-Icons neu generieren (public/icons/)
```

## Deployment

Siehe [DEPLOY.md](DEPLOY.md) — kurz: `npm run deploy` pusht `dist/` auf den
Branch `gh-pages`.

## Datenschutz

Keine Auth, keine Cloud, kein Tracking. Alle Daten liegen in IndexedDB auf dem
Gerät; auch die Beleg-Erkennung läuft vollständig offline auf dem Gerät.
