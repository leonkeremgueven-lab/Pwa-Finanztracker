import { useRef, useState } from 'react';
import { useApp } from '../App.jsx';
import { fmtCents, toIsoDate } from '../utils/format.js';

function eurToCents(str) {
  const v = Number.parseFloat(String(str).replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.round(v * 100);
}

export default function Settings() {
  const { categories, templates, transactions, repo, reload, toast } = useApp();
  const fileRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null); // {counts, data}
  const [importError, setImportError] = useState('');
  const [catEditor, setCatEditor] = useState(null);
  const [tplEditor, setTplEditor] = useState(null);

  // ---- Export ----
  async function handleExport() {
    try {
      const data = await repo.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finanz-backup-${toIsoDate()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Backup exportiert.');
    } catch (err) {
      console.error('Export fehlgeschlagen', err);
      toast('Export fehlgeschlagen — bitte erneut versuchen.', { error: true });
    }
  }

  // ---- Import ----
  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError('');
    setImportPreview(null);
    try {
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Die Datei ist kein gültiges JSON.');
      }
      const counts = repo.validateBackup(data); // wirft bei ungültigem Schema
      setImportPreview({ counts, data });
    } catch (err) {
      console.error('Import-Validierung fehlgeschlagen', err);
      setImportError(err.message || 'Die Datei konnte nicht gelesen werden.');
    }
  }

  async function confirmImport() {
    try {
      await repo.importAll(importPreview.data);
      setImportPreview(null);
      await reload();
      toast('Backup importiert — alle Daten wurden ersetzt.');
    } catch (err) {
      console.error('Import fehlgeschlagen', err);
      setImportPreview(null);
      toast('Import fehlgeschlagen — es wurden keine Daten geändert.', { error: true });
    }
  }

  const usedCatIds = new Set(transactions.map((t) => t.categoryId));

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Einstellungen</h2>

      <div className="card">
        <div className="card-title">Backup</div>
        <p className="small muted">
          Dein Backup ist eine JSON-Datei mit allen Daten. Sie bleibt zu 100 % lokal — speichere sie z. B. in deinem eigenen Cloud-Ordner.
        </p>
        <div className="stack">
          <button className="btn btn-primary btn-block" onClick={handleExport}>⬇️ Daten exportieren</button>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleImportFile} />
          <button className="btn btn-block" onClick={() => fileRef.current?.click()}>⬆️ Backup importieren</button>
        </div>
        {importError && <p className="small neg" style={{ marginTop: 8 }}>⚠️ {importError}</p>}
      </div>

      <div className="card">
        <div className="row-between">
          <div className="card-title" style={{ marginBottom: 0 }}>Kategorien</div>
          <button className="btn" onClick={() => setCatEditor({})}>+ Neu</button>
        </div>
        {categories.map((c) => (
          <div key={c.id} className="list-row">
            <span>{c.icon} {c.name} <span className="small muted">({c.type === 'expense' ? 'Ausgabe' : 'Einnahme'})</span></span>
            <span className="row">
              <button className="icon-btn" aria-label={`${c.name} bearbeiten`} onClick={() => setCatEditor(c)}>✏️</button>
              <button
                className="icon-btn"
                aria-label={`${c.name} löschen`}
                onClick={async () => {
                  if (usedCatIds.has(c.id)) {
                    toast('Kategorie wird von Buchungen verwendet und kann nicht gelöscht werden.', { error: true });
                    return;
                  }
                  try {
                    await repo.deleteCategory(c.id);
                    await reload();
                    toast('Kategorie gelöscht.');
                  } catch (err) {
                    console.error('Kategorie löschen fehlgeschlagen', err);
                    toast('Löschen fehlgeschlagen — bitte erneut versuchen.', { error: true });
                  }
                }}
              >
                🗑️
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="row-between">
          <div className="card-title" style={{ marginBottom: 0 }}>Vorlagen (QuickAdd-Chips)</div>
          <button className="btn" onClick={() => setTplEditor({})}>+ Neu</button>
        </div>
        {templates.length === 0 && (
          <p className="small muted">Vorlagen buchen wiederkehrende Kleinigkeiten mit einem Tap — z. B. „Kaffee, 3,50 €".</p>
        )}
        {templates.map((t) => {
          const cat = categories.find((c) => c.id === t.categoryId);
          return (
            <div key={t.id} className="list-row">
              <span>{cat?.icon ?? '📦'} {t.name} <span className="small muted num">{fmtCents(t.amount)}</span></span>
              <span className="row">
                <button className="icon-btn" aria-label={`${t.name} bearbeiten`} onClick={() => setTplEditor(t)}>✏️</button>
                <button
                  className="icon-btn"
                  aria-label={`${t.name} löschen`}
                  onClick={async () => {
                    try {
                      await repo.deleteTemplate(t.id);
                      await reload();
                      toast('Vorlage gelöscht.');
                    } catch (err) {
                      console.error('Vorlage löschen fehlgeschlagen', err);
                      toast('Löschen fehlgeschlagen — bitte erneut versuchen.', { error: true });
                    }
                  }}
                >
                  🗑️
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {importPreview && (
        <>
          <div className="sheet-backdrop" onClick={() => setImportPreview(null)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Import bestätigen">
            <div className="sheet-header">
              <h2>Import bestätigen</h2>
              <button className="sheet-close" onClick={() => setImportPreview(null)} aria-label="Schließen">✕</button>
            </div>
            <div className="card">
              <div className="card-title">Inhalt des Backups</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>{importPreview.counts.transactions} Transaktionen</li>
                <li>{importPreview.counts.categories} Kategorien</li>
                <li>{importPreview.counts.budgets} Budgets</li>
                <li>{importPreview.counts.goals} Sparziele</li>
                <li>{importPreview.counts.recurring} Abos</li>
                <li>{importPreview.counts.templates} Vorlagen</li>
                <li>{importPreview.counts.accounts} Konten, {importPreview.counts.snapshots} Snapshots</li>
              </ul>
            </div>
            <p className="small warn">⚠️ Der Import ersetzt ALLE aktuellen Daten. Dieser Schritt kann nicht rückgängig gemacht werden.</p>
            <div className="stack">
              <button className="btn btn-primary btn-block" onClick={confirmImport}>Ja, Daten ersetzen</button>
              <button className="btn btn-block" onClick={() => setImportPreview(null)}>Abbrechen</button>
            </div>
          </div>
        </>
      )}

      {catEditor && <CategoryEditor item={catEditor.id ? catEditor : null} onClose={() => setCatEditor(null)} />}
      {tplEditor && <TemplateEditor item={tplEditor.id ? tplEditor : null} onClose={() => setTplEditor(null)} />}
    </div>
  );

  function CategoryEditor({ item, onClose }) {
    const [name, setName] = useState(item?.name ?? '');
    const [icon, setIcon] = useState(item?.icon ?? '📦');
    const [type, setType] = useState(item?.type ?? 'expense');
    const valid = name.trim() && icon.trim();

    async function save() {
      try {
        await repo.saveCategory({
          id: item?.id,
          name: name.trim(),
          icon: icon.trim(),
          type,
          sortOrder: item?.sortOrder ?? categories.length,
        });
        await reload();
        toast('Kategorie gespeichert.');
        onClose();
      } catch (err) {
        console.error('Kategorie speichern fehlgeschlagen', err);
        toast('Speichern fehlgeschlagen — bitte erneut versuchen.', { error: true });
      }
    }

    return (
      <>
        <div className="sheet-backdrop" onClick={onClose} />
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Kategorie">
          <div className="sheet-header">
            <h2>{item ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h2>
            <button className="sheet-close" onClick={onClose} aria-label="Schließen">✕</button>
          </div>
          <div className="form-grid">
            <div>
              <label htmlFor="ce-name">Name</label>
              <input id="ce-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="ce-icon">Icon (Emoji)</label>
              <input id="ce-icon" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
            </div>
            <div>
              <label htmlFor="ce-type">Typ</label>
              <select id="ce-type" value={type} onChange={(e) => setType(e.target.value)} disabled={!!item}>
                <option value="expense">Ausgabe</option>
                <option value="income">Einnahme</option>
              </select>
            </div>
            <button className="btn btn-primary btn-block" disabled={!valid} onClick={save}>Speichern</button>
          </div>
        </div>
      </>
    );
  }

  function TemplateEditor({ item, onClose }) {
    const [name, setName] = useState(item?.name ?? '');
    const [amount, setAmount] = useState(item ? String(item.amount / 100).replace('.', ',') : '');
    const [type, setType] = useState(item?.type ?? 'expense');
    const [categoryId, setCategoryId] = useState(item?.categoryId ?? '');
    const cents = eurToCents(amount);
    const cats = categories.filter((c) => c.type === type);
    const valid = name.trim() && cents && categoryId;

    async function save() {
      try {
        await repo.saveTemplate({
          id: item?.id,
          name: name.trim(),
          amount: cents,
          type,
          categoryId,
          sortOrder: item?.sortOrder ?? templates.length,
        });
        await reload();
        toast('Vorlage gespeichert.');
        onClose();
      } catch (err) {
        console.error('Vorlage speichern fehlgeschlagen', err);
        toast('Speichern fehlgeschlagen — bitte erneut versuchen.', { error: true });
      }
    }

    return (
      <>
        <div className="sheet-backdrop" onClick={onClose} />
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Vorlage">
          <div className="sheet-header">
            <h2>{item ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h2>
            <button className="sheet-close" onClick={onClose} aria-label="Schließen">✕</button>
          </div>
          <div className="form-grid">
            <div>
              <label htmlFor="te-name">Name</label>
              <input id="te-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Kaffee" />
            </div>
            <div>
              <label htmlFor="te-amount">Betrag (€)</label>
              <input id="te-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="z. B. 3,50" />
            </div>
            <div>
              <label htmlFor="te-type">Typ</label>
              <select id="te-type" value={type} onChange={(e) => { setType(e.target.value); setCategoryId(''); }}>
                <option value="expense">Ausgabe</option>
                <option value="income">Einnahme</option>
              </select>
            </div>
            <div>
              <label htmlFor="te-cat">Kategorie</label>
              <select id="te-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— wählen —</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary btn-block" disabled={!valid} onClick={save}>Speichern</button>
          </div>
        </div>
      </>
    );
  }
}
