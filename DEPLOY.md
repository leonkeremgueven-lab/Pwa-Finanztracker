# Deployment auf GitHub Pages

Die App wird als statische PWA auf GitHub Pages gehostet und lässt sich danach
auf Android als App installieren.

> **Wichtig:** `base` in `vite.config.js` und `homepage` in `package.json` sind
> auf den Repo-Namen **`Pwa-Finanztracker`** eingestellt. Wenn du das Repo
> umbenennst, müssen beide Werte angepasst werden (z. B. `/finanztracker/`).

## 1. Repository anlegen & pushen (einmalig)

Falls das Repo noch nicht existiert: auf GitHub ein **öffentliches** Repository
`Pwa-Finanztracker` anlegen, dann lokal:

```bash
git init
git add .
git commit -m "Finanz PWA"
git branch -M main
git remote add origin https://github.com/leonkeremgueven-lab/Pwa-Finanztracker.git
git push -u origin main
```

## 2. Abhängigkeiten installieren

```bash
npm install
```

Das `postinstall`-Script kopiert dabei automatisch die Tesseract-OCR-Assets
(Worker, WASM-Core, deutsches Sprachmodell, ~20 MB) nach `public/tesseract/` —
sie werden self-hosted und funktionieren damit offline.

## 3. Deployen

```bash
npm run deploy
```

Das baut die App (`predeploy` → `npm run build`) und pusht den Inhalt von
`dist/` auf den Branch **`gh-pages`** (via `gh-pages`-Package).

## 4. GitHub Pages aktivieren (einmalig)

Auf GitHub: **Settings → Pages**

- **Source**: „Deploy from a branch"
- **Branch**: `gh-pages`, Ordner `/ (root)`
- Speichern. Nach 1–2 Minuten ist die App erreichbar unter:

```
https://leonkeremgueven-lab.github.io/Pwa-Finanztracker/
```

## 5. Auf dem Handy installieren

1. Die URL oben in **Chrome auf Android** öffnen.
2. Kurz warten (beim ersten Besuch lädt der Service Worker ~20 MB in den
   Cache — danach läuft alles offline, inklusive Beleg-Scanner).
3. Menü (⋮) → **„Zum Startbildschirm hinzufügen"** bzw. den
   Installations-Hinweis bestätigen.
4. Die App „Finanz" erscheint als Icon und startet im Vollbild (standalone).

## Updates veröffentlichen

Einfach erneut `npm run deploy` ausführen. Die PWA aktualisiert sich beim
nächsten Öffnen automatisch (`registerType: 'autoUpdate'`).

## Hinweise

- **Alle Daten bleiben lokal** in IndexedDB auf dem Gerät. GitHub Pages liefert
  nur die statischen App-Dateien aus.
- Backups regelmäßig über **Mehr → Einstellungen & Backup → Daten exportieren**
  sichern — beim Löschen der Browserdaten wäre IndexedDB sonst weg.
