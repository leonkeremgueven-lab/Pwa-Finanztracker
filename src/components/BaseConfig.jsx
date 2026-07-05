import { useMemo, useState } from 'react';
import { useApp } from '../App.jsx';
import { runRecurringEngine } from '../logic/recurring.js';
import { fmtCents } from '../utils/format.js';

// Grundkonfiguration: feste monatliche Einnahmen und Ausgaben, die jeden Monat
// automatisch verbucht werden. Technisch sind das Recurring-Regeln mit
// Intervall "monthly" — die Engine bucht sie beim App-Start (Catch-up inklusive).

function eurToCents(str) {
  const v = Number.parseFloat(String(str).replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.round(v * 100);
}

function anchorForDay(day) {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const d = Math.min(day, last);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function BaseConfig() {
  const { recurring, categories, repo, reload, toast } = useApp();
  const [editing, setEditing] = useState(null); // { type, item|null }

  const monthly = useMemo(() => recurring.filter((r) => r.interval === 'monthly'), [recurring]);
  const incomes = monthly.filter((r) => r.type === 'income');
  const expenses = monthly.filter((r) => r.type === 'expense');

  const incomeSum = incomes.reduce((s, r) => s + r.amount, 0);
  const expenseSum = expenses.reduce((s, r) => s + r.amount, 0);
  const catOf = (id) => categories.find((c) => c.id === id);

  // Ausgaben nach Kategorie gegliedert
  const expensesByCat = useMemo(() => {
    const map = new Map();
    for (const r of expenses) {
      if (!map.has(r.categoryId)) map.set(r.categoryId, []);
      map.get(r.categoryId).push(r);
    }
    return [...map.entries()].sort(
      (a, b) => b[1].reduce((s, r) => s + r.amount, 0) - a[1].reduce((s, r) => s + r.amount, 0)
    );
  }, [expenses]);

  async function remove(item) {
    try {
      await repo.deleteRecurring(item.id);
      await reload();
      toast(`„${item.name}" entfernt (bereits verbuchte Monate bleiben).`);
    } catch (err) {
      console.error('Grundkonfiguration: Löschen fehlgeschlagen', err);
      toast('Löschen fehlgeschlagen — bitte erneut versuchen.', { error: true });
    }
  }

  const dayOf = (r) => Number(r.anchorDate.slice(8, 10));

  return (
    <div>
      <h2 style={{ marginBottom: 8 }}>Grundkonfiguration</h2>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Trage hier ein, was jeden Monat fest reinkommt und rausgeht. Diese Posten
        werden automatisch am jeweiligen Tag verbucht — auch rückwirkend, wenn du
        die App ein paar Tage nicht öffnest.
      </p>

      <div className="card">
        <div className="card-title">Deine monatliche Bilanz</div>
        <div className="row-between"><span>Feste Einnahmen</span><strong className="num pos">{fmtCents(incomeSum)}</strong></div>
        <div className="row-between"><span>Feste Ausgaben</span><strong className="num">{fmtCents(expenseSum)}</strong></div>
        <div className="row-between" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--line)' }}>
          <span>Bleibt frei</span>
          <strong className={`num ${incomeSum - expenseSum >= 0 ? 'pos' : 'neg'}`}>{fmtCents(incomeSum - expenseSum)}</strong>
        </div>
      </div>

      <section>
        <div className="row-between" style={{ margin: '16px 0 8px' }}>
          <h3>💶 Monatliche Einnahmen</h3>
          <button className="btn" onClick={() => setEditing({ type: 'income', item: null })}>+ Neu</button>
        </div>
        {incomes.length === 0 && (
          <div className="empty" style={{ padding: '20px 16px' }}>
            Noch keine festen Einnahmen — z. B. dein Gehalt.
          </div>
        )}
        {incomes.map((r) => (
          <div key={r.id} className="card" style={{ padding: '12px 16px' }}>
            <div className="row-between">
              <span>
                <span aria-hidden>{catOf(r.categoryId)?.icon ?? '💶'}</span> <strong>{r.name}</strong>
                <div className="small muted">{catOf(r.categoryId)?.name ?? '—'} · am {dayOf(r)}. des Monats</div>
              </span>
              <span className="row">
                <span className="num pos">{fmtCents(r.amount)}</span>
                <button className="icon-btn" aria-label={`${r.name} bearbeiten`} onClick={() => setEditing({ type: 'income', item: r })}>✏️</button>
                <button className="icon-btn" aria-label={`${r.name} löschen`} onClick={() => remove(r)}>🗑️</button>
              </span>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="row-between" style={{ margin: '16px 0 8px' }}>
          <h3>📤 Monatliche Ausgaben</h3>
          <button className="btn" onClick={() => setEditing({ type: 'expense', item: null })}>+ Neu</button>
        </div>
        {expenses.length === 0 && (
          <div className="empty" style={{ padding: '20px 16px' }}>
            Noch keine festen Ausgaben — z. B. Miete, Strom, Versicherungen, Abos.
          </div>
        )}
        {expensesByCat.map(([catId, items]) => {
          const cat = catOf(catId);
          const sum = items.reduce((s, r) => s + r.amount, 0);
          return (
            <div key={catId} className="card" style={{ padding: '12px 16px' }}>
              <div className="row-between" style={{ marginBottom: 4 }}>
                <span className="card-title" style={{ marginBottom: 0 }}>{cat?.icon} {cat?.name ?? 'Unbekannt'}</span>
                <span className="num small muted">{fmtCents(sum)}/Monat</span>
              </div>
              {items.map((r) => (
                <div key={r.id} className="list-row">
                  <span>
                    {r.name}
                    <div className="small muted">am {dayOf(r)}. des Monats</div>
                  </span>
                  <span className="row">
                    <span className="num">{fmtCents(r.amount)}</span>
                    <button className="icon-btn" aria-label={`${r.name} bearbeiten`} onClick={() => setEditing({ type: 'expense', item: r })}>✏️</button>
                    <button className="icon-btn" aria-label={`${r.name} löschen`} onClick={() => remove(r)}>🗑️</button>
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </section>

      {editing && <BaseConfigEditor type={editing.type} item={editing.item} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BaseConfigEditor({ type, item, onClose }) {
  const { categories, repo, reload, toast } = useApp();
  const [name, setName] = useState(item?.name ?? '');
  const [amount, setAmount] = useState(item ? String(item.amount / 100).replace('.', ',') : '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '');
  const [day, setDay] = useState(item ? String(Number(item.anchorDate.slice(8, 10))) : '1');
  const [saving, setSaving] = useState(false);

  const cents = eurToCents(amount);
  const dayNum = Number.parseInt(day, 10);
  const cats = categories.filter((c) => c.type === type);
  const valid = name.trim() && cents && categoryId && dayNum >= 1 && dayNum <= 31;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await repo.saveRecurring({
        id: item?.id,
        name: name.trim(),
        amount: cents,
        type,
        categoryId,
        interval: 'monthly',
        anchorDate: item?.anchorDate ?? anchorForDay(dayNum),
        endDate: item?.endDate,
        lastProcessed: item?.lastProcessed ?? '',
      });
      // Fällige Instanzen sofort verbuchen (z. B. wenn der Tag diesen Monat
      // schon vorbei ist), statt auf den nächsten App-Start zu warten.
      const booked = await runRecurringEngine(repo);
      await reload();
      toast(booked > 0 ? `Gespeichert — ${booked} Buchung${booked > 1 ? 'en' : ''} direkt verbucht.` : 'Gespeichert.');
      onClose();
    } catch (err) {
      console.error('Grundkonfiguration: Speichern fehlgeschlagen', err);
      toast('Speichern fehlgeschlagen — bitte erneut versuchen.', { error: true });
      setSaving(false);
    }
  }

  // Beim Bearbeiten den Tag ändern = anchorDate-Tag anpassen
  function handleDayChange(v) {
    setDay(v);
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Fester Posten">
        <div className="sheet-header">
          <h2>
            {item ? 'Posten bearbeiten' : type === 'income' ? 'Neue monatliche Einnahme' : 'Neue monatliche Ausgabe'}
          </h2>
          <button className="sheet-close" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        <div className="form-grid">
          <div>
            <label htmlFor="bc-name">Name</label>
            <input id="bc-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={type === 'income' ? 'z. B. Gehalt' : 'z. B. Miete'} />
          </div>
          <div>
            <label htmlFor="bc-amount">Betrag (€)</label>
            <input id="bc-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder={type === 'income' ? 'z. B. 2500' : 'z. B. 850'} />
          </div>
          <div>
            <label htmlFor="bc-cat">Kategorie</label>
            <select id="bc-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— wählen —</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bc-day">Tag des Monats (1–31)</label>
            <input id="bc-day" type="number" min="1" max="31" inputMode="numeric" value={day}
              onChange={(e) => handleDayChange(e.target.value)} disabled={!!item} />
            {item && <span className="small muted">Der Buchungstag lässt sich nach dem Anlegen nicht ändern — lösche den Posten und lege ihn neu an.</span>}
          </div>
          <button className="btn btn-primary btn-block" disabled={!valid || saving} onClick={save}>
            ✓ Speichern
          </button>
        </div>
      </div>
    </>
  );
}
