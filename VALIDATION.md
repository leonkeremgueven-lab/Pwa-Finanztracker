# Selbst-Validierung

Durchgeführt am 2026-07-05 (automatisiert: `npm test` + Playwright gegen den
Produktions-Build via `vite preview`, Chromium, Viewport 360×740).

| # | Kriterium | Ergebnis |
|---|-----------|----------|
| 1 | `npm run build` läuft fehlerfrei | ✅ 907 Module, SW-Precache 21 Einträge (~20,5 MB inkl. OCR-Assets) |
| 2 | Alle Dateien laut Projektstruktur vorhanden; Icons existieren physisch | ✅ `public/icons/`: SVG + PNG 192/512 + maskable 512 + apple-touch (per `npm run icons` aus SVG erzeugt) |
| 3 | PWA-Kriterien: Manifest valide, SW registriert, offline lauffähig | ✅ Manifest mit name/short_name/display/theme/scope; `SW_REGISTERED: true`; App lädt nach Reload **im Offline-Modus** vollständig |
| 4 | QuickAdd: Buchung mit Betrag + Kategorie in 2 Taps | ✅ Numpad „3-5-0" → Anzeige „3,50 €" → Tap auf „Essen" → Transaktion in IndexedDB; Template-Chip bucht mit 1 Tap (Code-Pfad `applyTemplate`) |
| 5 | Recurring-Engine: `lastProcessed` 3 Monate zurück → exakt 3 Instanzen, kein Duplikat bei erneutem Lauf | ✅ Unit-Tests: Catch-up = 3 Buchungen, 2. Lauf = 0; Dedupe über deterministische ID `rec-<recurringId>-<datum>`; Monatsende-Klemmung (31. → 28.02.) getestet |
| 6 | Budgets färben um bei 80 %/100 % | ✅ Unit-Test: 82,5 % → `warn` (amber), 112,5 % → `over` (rot), 0 % → `ok` |
| 7 | Monatsabschluss-Report korrekt (manuell gegengerechnet) | ✅ Testmonat Juni: Einnahmen 2500 €, Ausgaben 1230 €, Sparquote 51 %, Top-Kategorien, größte Einzelausgabe 900 €, Budget-Bilanz, Delta zum Vormonat — alle Werte per Hand verifiziert |
| 8 | Export → DB leeren → Import stellt identischen Zustand wieder her | ✅ UI-Roundtrip: Export-Datei `finanz-backup-2026-07-05.json`, `deleteDatabase`, Import mit Vorschau („1 Transaktionen …") → Byte-identischer DB-Dump. Ungültige Datei → Fehlermeldung, Daten unangetastet |
| 9 | Beträge tabellarisch + de-DE; intern nur Cent | ✅ `Intl.NumberFormat('de-DE', currency EUR)` nur in `utils/format.js`; alle Stores/Logik integer Cent; `font-variant-numeric: tabular-nums` via `.num` |
| 10 | Scanner-Heuristik mit 5 Test-Strings | ✅ „SUMME 23,47" → 2347/high · „5UMME 12,90" → 1290/high · ohne Keyword → größter Betrag/low · ohne Betrag → null/none · US-Format „12.99" → 1299 |
| 11 | Scanner offline: Assets aus Precache, kein Netzwerk-Request | ✅ Browser offline geschaltet → echter Scan eines Testbons: „SUMME 23,47" erkannt als **23,47 €** (high confidence). Einziger Nicht-localhost-„Request" war eine interne `blob:`-URL von tesseract.js (kein Netzwerk) |
| 12 | Foto existiert nach dem Scan nirgends mehr | ✅ IndexedDB-Scan nach OCR: keine Blobs/ArrayBuffer in keinem Store; Verarbeitung nur in ImageBitmap/Canvas (Bitmap wird per `close()` freigegeben), keine eigenen Object-URLs erzeugt |
| 13 | Keine Console-Errors auf allen 5 Tabs | ✅ Einziger Log: Google-Fonts-Request in der Sandbox blockiert (Netzwerk-Policy der Testumgebung, kein App-Fehler; offline greift CacheFirst) |
| 14 | 360 px ohne horizontales Scrollen; FAB verdeckt nichts | ✅ `scrollWidth <= clientWidth` bei 360 px; Content-Padding unten = Tabbar + FAB + Safe-Area |

Zusätzlich: 21/21 Unit-Tests grün (`npm test`) — Recurring (6), Beleg-Heuristik (6), Stats/Budgets/Ziele/NetWorth (6), Report (2), Formate (1).
