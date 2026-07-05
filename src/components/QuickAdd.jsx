import { useMemo, useState } from 'react';
import { useApp } from '../App.jsx';
import { fmtCents, toIsoDate } from '../utils/format.js';

// Betrag wird als Cent-String getippt: "350" => 3,50 €
function centsFromDigits(digits) {
  return Number.parseInt(digits || '0', 10);
}

function digitsDisplay(digits) {
  return fmtCents(centsFromDigits(digits));
}

export default function QuickAdd({ prefill, editTx, onClose }) {
  const { categories, templates, goals, accounts, repo, reload, toast, openScanner } = useApp();
  const [type, setType] = useState(editTx?.type ?? (prefill?.goalId ? 'goal_deposit' : 'expense'));
  const [digits, setDigits] = useState(() => {
    if (editTx) return String(editTx.amount);
    if (prefill?.amount) return String(prefill.amount);
    return '';
  });
  const [categoryId, setCategoryId] = useState(editTx?.categoryId ?? null);
  const [goalId, setGoalId] = useState(editTx?.goalId ?? prefill?.goalId ?? goals[0]?.id ?? null);
  const [note, setNote] = useState(editTx?.note ?? prefill?.note ?? '');
  const [date, setDate] = useState(editTx?.date ?? toIsoDate());
  const [accountId, setAccountId] = useState(editTx?.accountId ?? '');
  const [saving, setSaving] = useState(false);

  const amount = centsFromDigits(digits);
  const cats = useMemo(
    () => categories.filter((c) => (type === 'income' ? c.type === 'income' : c.type === 'expense')),
    [categories, type]
  );
  const canSave = amount > 0 && (type === 'goal_deposit' ? !!goalId : true);

  const tap = (d) => {
    if (d === '⌫') setDigits((s) => s.slice(0, -1));
    else if (digits.length < 7) setDigits((s) => (s === '' && d === '0' ? s : s + d));
  };

  async function save(catId) {
    if (saving) return;
    const finalCat = catId ?? categoryId;
    if (amount <= 0) {
      toast('Bitte einen Betrag größer 0 eingeben.', { error: true });
      return;
    }
    if (type !== 'goal_deposit' && !finalCat) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast('Ungültiges Datum.', { error: true });
      return;
    }
    setSaving(true);
    try {
      await repo.saveTransaction({
        id: editTx?.id,
        createdAt: editTx?.createdAt,
        type,
        amount,
        categoryId: type === 'goal_deposit' ? 'cat-sonstiges' : finalCat,
        goalId: type === 'goal_deposit' ? goalId : undefined,
        accountId: accountId || undefined,
        note: note.trim() || undefined,
        date,
      });
      await reload();
      toast(editTx ? 'Buchung aktualisiert.' : 'Buchung gespeichert.');
      onClose();
    } catch (err) {
      console.error('Buchung speichern fehlgeschlagen', err);
      toast('Speichern fehlgeschlagen — bitte erneut versuchen.', { error: true });
      setSaving(false);
    }
  }

  async function applyTemplate(tpl) {
    if (saving) return;
    setSaving(true);
    try {
      await repo.saveTransaction({
        type: tpl.type,
        amount: tpl.amount,
        categoryId: tpl.categoryId,
        note: tpl.name,
        date: toIsoDate(),
      });
      await reload();
      toast(`„${tpl.name}" gespeichert (${fmtCents(tpl.amount)}).`);
      onClose();
    } catch (err) {
      console.error('Vorlage buchen fehlgeschlagen', err);
      toast('Speichern fehlgeschlagen — bitte erneut versuchen.', { error: true });
      setSaving(false);
    }
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Buchung hinzufügen">
        <div className="sheet-header">
          <h2>{editTx ? 'Buchung bearbeiten' : 'Neue Buchung'}</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Schließen">✕</button>
        </div>

        {prefill?.confidence && !prefill.manual && (
          <div className={`card small ${prefill.confidence === 'high' ? '' : 'warn'}`}>
            {prefill.confidence === 'high'
              ? '📷 Betrag vom Beleg übernommen — bitte prüfen.'
              : '📷 Betrag nicht sicher erkannt — bitte prüfen/eintippen.'}
          </div>
        )}

        {!editTx && templates.length > 0 && (
          <div className="template-chips">
            {templates.map((tpl) => {
              const cat = categories.find((c) => c.id === tpl.categoryId);
              return (
                <button key={tpl.id} className="chip" onClick={() => applyTemplate(tpl)} disabled={saving}>
                  <span>{cat?.icon ?? '📦'}</span>
                  <span>{tpl.name}</span>
                  <span className="muted num">{fmtCents(tpl.amount)}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="type-toggle" role="tablist">
          <button
            className={type === 'expense' ? 'active expense-active' : ''}
            onClick={() => { setType('expense'); setCategoryId(null); }}
          >
            Ausgabe
          </button>
          <button
            className={type === 'income' ? 'active' : ''}
            onClick={() => { setType('income'); setCategoryId(null); }}
          >
            Einnahme
          </button>
          {goals.length > 0 && (
            <button className={type === 'goal_deposit' ? 'active' : ''} onClick={() => setType('goal_deposit')}>
              Sparziel
            </button>
          )}
        </div>

        <div className={`amount-display num ${type === 'income' ? 'income' : 'expense'}`}>
          {digitsDisplay(digits)}
        </div>

        <div className="numpad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'].map((d) => (
            <button key={d} onClick={() => tap(d)} aria-label={d === '⌫' ? 'Löschen' : d}>
              {d}
            </button>
          ))}
        </div>

        {type === 'goal_deposit' ? (
          <div className="form-grid">
            <div>
              <label htmlFor="qa-goal">Sparziel</label>
              <select id="qa-goal" value={goalId ?? ''} onChange={(e) => setGoalId(e.target.value)}>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary btn-block" disabled={!canSave || saving} onClick={() => save()}>
              Einzahlung speichern
            </button>
          </div>
        ) : (
          <div className="cat-grid">
            {cats.map((c) => (
              <button
                key={c.id}
                className={categoryId === c.id ? 'selected' : ''}
                disabled={saving}
                onClick={() => {
                  setCategoryId(c.id);
                  if (amount > 0) save(c.id);
                  else toast('Erst Betrag eintippen, dann Kategorie wählen.', { error: true });
                }}
              >
                <span className="cat-icon" aria-hidden>{c.icon}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        )}

        <details className="optional-fields">
          <summary>Notiz, Datum, Konto</summary>
          <div className="form-grid">
            <div>
              <label htmlFor="qa-note">Notiz</label>
              <input id="qa-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Mittagessen" />
            </div>
            <div>
              <label htmlFor="qa-date">Datum</label>
              <input id="qa-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {accounts.length > 0 && (
              <div>
                <label htmlFor="qa-account">Konto</label>
                <select id="qa-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">— kein Konto —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </details>

        {editTx && type !== 'goal_deposit' && (
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={!canSave || !categoryId || saving} onClick={() => save()}>
            Änderungen speichern
          </button>
        )}

        {!editTx && !prefill && (
          <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => { onClose(); openScanner(); }}>
            📷 Beleg scannen
          </button>
        )}
      </div>
    </>
  );
}
