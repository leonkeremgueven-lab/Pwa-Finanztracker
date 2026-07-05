import { useMemo, useState } from 'react';
import { useApp } from '../App.jsx';
import BudgetCard from './BudgetCard.jsx';
import GoalCard from './GoalCard.jsx';
import { budgetStatus, currentMonthKey, goalSaved, goalForecast } from '../logic/stats.js';
import { monthlyFixedCosts } from '../logic/recurring.js';
import { fmtCents, fmtDate, toIsoDate } from '../utils/format.js';

function eurToCents(str) {
  const v = Number.parseFloat(String(str).replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.round(v * 100);
}

const INTERVAL_LABEL = { weekly: 'wöchentlich', monthly: 'monatlich', yearly: 'jährlich' };

export default function BudgetsGoals() {
  const { transactions, categories, budgets, goals, recurring, repo, reload, toast, openQuickAdd, loading } = useApp();
  const [editor, setEditor] = useState(null); // {kind:'budget'|'goal'|'recurring', item}

  const monthKey = currentMonthKey();
  const statuses = useMemo(() => budgetStatus(budgets, transactions, monthKey), [budgets, transactions, monthKey]);
  const fixedCosts = useMemo(() => monthlyFixedCosts(recurring), [recurring]);
  const catOf = (id) => categories.find((c) => c.id === id);

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Budgets & Ziele</h1>
        <div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Budgets & Ziele</h1>
      <div className="grid-2">
        <section>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <h2>Budgets</h2>
            <button className="btn" onClick={() => setEditor({ kind: 'budget', item: null })}>+ Budget</button>
          </div>
          {statuses.length === 0 && (
            <div className="empty">
              <span className="empty-icon" aria-hidden>🎯</span>
              Noch keine Budgets. Lege ein Monatsbudget pro Kategorie fest, um deine Ausgaben im Blick zu behalten.
            </div>
          )}
          {statuses.map((s) => (
            <BudgetCard key={s.id} status={s} category={catOf(s.categoryId)} onEdit={() => setEditor({ kind: 'budget', item: s })} />
          ))}
        </section>

        <section>
          <div className="row-between" style={{ margin: '16px 0 8px' }}>
            <h2>Sparziele</h2>
            <button className="btn" onClick={() => setEditor({ kind: 'goal', item: null })}>+ Ziel</button>
          </div>
          {goals.length === 0 && (
            <div className="empty">
              <span className="empty-icon" aria-hidden>🐷</span>
              Noch keine Sparziele. Erstelle ein Ziel und zahle regelmäßig ein.
            </div>
          )}
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              saved={goalSaved(transactions, g.id)}
              forecast={goalForecast(g, transactions)}
              onEdit={() => setEditor({ kind: 'goal', item: g })}
              onDeposit={() => openQuickAdd({ goalId: g.id })}
            />
          ))}
        </section>

        <section>
          <div className="row-between" style={{ margin: '16px 0 8px' }}>
            <h2>Abos & Fixkosten</h2>
            <button className="btn" onClick={() => setEditor({ kind: 'recurring', item: null })}>+ Abo</button>
          </div>
          <div className="card">
            <div className="card-title">Deine Fixkosten</div>
            <div className="num" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              {fmtCents(fixedCosts)}<span className="muted small"> /Monat</span>
            </div>
          </div>
          {recurring.length === 0 && (
            <div className="empty">
              <span className="empty-icon" aria-hidden>🔁</span>
              Keine wiederkehrenden Buchungen. Miete, Streaming & Co. werden automatisch verbucht, wenn du sie hier anlegst.
            </div>
          )}
          {recurring.map((r) => (
            <div key={r.id} className="card">
              <div className="row-between">
                <span className="row">
                  <span aria-hidden>{catOf(r.categoryId)?.icon ?? '🔁'}</span>
                  <span>
                    <strong>{r.name}</strong>
                    <div className="small muted">
                      {INTERVAL_LABEL[r.interval]} · seit {fmtDate(r.anchorDate)}
                      {r.endDate ? ` · bis ${fmtDate(r.endDate)}` : ''}
                    </div>
                  </span>
                </span>
                <span className="row">
                  <span className={`num ${r.type === 'income' ? 'pos' : ''}`}>{fmtCents(r.amount)}</span>
                  <button className="icon-btn" aria-label={`${r.name} bearbeiten`} onClick={() => setEditor({ kind: 'recurring', item: r })}>✏️</button>
                </span>
              </div>
            </div>
          ))}
        </section>
      </div>

      {editor?.kind === 'budget' && <BudgetEditor item={editor.item} onClose={() => setEditor(null)} />}
      {editor?.kind === 'goal' && <GoalEditor item={editor.item} onClose={() => setEditor(null)} />}
      {editor?.kind === 'recurring' && <RecurringEditor item={editor.item} onClose={() => setEditor(null)} />}
    </div>
  );
}

function EditorSheet({ title, onClose, children }) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-header">
          <h2>{title}</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        {children}
      </div>
    </>
  );
}

function BudgetEditor({ item, onClose }) {
  const { categories, budgets, repo, reload, toast } = useApp();
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '');
  const [limit, setLimit] = useState(item ? String(item.monthlyLimit / 100).replace('.', ',') : '');
  const takenCats = new Set(budgets.filter((b) => b.id !== item?.id).map((b) => b.categoryId));
  const expenseCats = categories.filter((c) => c.type === 'expense' && (!takenCats.has(c.id) || c.id === item?.categoryId));
  const cents = eurToCents(limit);
  const valid = categoryId && cents;

  async function save() {
    try {
      await repo.saveBudget({ id: item?.id, categoryId, monthlyLimit: cents });
      await reload();
      toast('Budget gespeichert.');
      onClose();
    } catch (err) {
      console.error('Budget speichern fehlgeschlagen', err);
      toast('Speichern fehlgeschlagen — bitte erneut versuchen.', { error: true });
    }
  }

  async function remove() {
    try {
      await repo.deleteBudget(item.id);
      await reload();
      toast('Budget gelöscht.');
      onClose();
    } catch (err) {
      console.error('Budget löschen fehlgeschlagen', err);
      toast('Löschen fehlgeschlagen — bitte erneut versuchen.', { error: true });
    }
  }

  return (
    <EditorSheet title={item ? 'Budget bearbeiten' : 'Neues Budget'} onClose={onClose}>
      <div className="form-grid">
        <div>
          <label htmlFor="be-cat">Kategorie</label>
          <select id="be-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={!!item}>
            <option value="">— wählen —</option>
            {expenseCats.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="be-limit">Monatslimit (€)</label>
          <input id="be-limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="z. B. 250" />
        </div>
        <button className="btn btn-primary btn-block" disabled={!valid} onClick={save}>Speichern</button>
        {item && <button className="btn btn-danger btn-block" onClick={remove}>Budget löschen</button>}
      </div>
    </EditorSheet>
  );
}

function GoalEditor({ item, onClose }) {
  const { repo, reload, toast } = useApp();
  const [name, setName] = useState(item?.name ?? '');
  const [target, setTarget] = useState(item ? String(item.targetAmount / 100).replace('.', ',') : '');
  const [targetDate, setTargetDate] = useState(item?.targetDate ?? '');
  const cents = eurToCents(target);
  const valid = name.trim() && cents;

  async function save() {
    try {
      await repo.saveGoal({
        id: item?.id,
        createdAt: item?.createdAt,
        name: name.trim(),
        targetAmount: cents,
        targetDate: targetDate || undefined,
      });
      await reload();
      toast('Sparziel gespeichert.');
      onClose();
    } catch (err) {
      console.error('Sparziel speichern fehlgeschlagen', err);
      toast('Speichern fehlgeschlagen — bitte erneut versuchen.', { error: true });
    }
  }

  async function remove() {
    try {
      await repo.deleteGoal(item.id);
      await reload();
      toast('Sparziel gelöscht (Einzahlungen bleiben in der Historie).');
      onClose();
    } catch (err) {
      console.error('Sparziel löschen fehlgeschlagen', err);
      toast('Löschen fehlgeschlagen — bitte erneut versuchen.', { error: true });
    }
  }

  return (
    <EditorSheet title={item ? 'Sparziel bearbeiten' : 'Neues Sparziel'} onClose={onClose}>
      <div className="form-grid">
        <div>
          <label htmlFor="ge-name">Name</label>
          <input id="ge-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Urlaub" />
        </div>
        <div>
          <label htmlFor="ge-target">Zielbetrag (€)</label>
          <input id="ge-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="z. B. 1500" />
        </div>
        <div>
          <label htmlFor="ge-date">Zieldatum (optional)</label>
          <input id="ge-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" disabled={!valid} onClick={save}>Speichern</button>
        {item && <button className="btn btn-danger btn-block" onClick={remove}>Ziel löschen</button>}
      </div>
    </EditorSheet>
  );
}

function RecurringEditor({ item, onClose }) {
  const { categories, repo, reload, toast } = useApp();
  const [name, setName] = useState(item?.name ?? '');
  const [amount, setAmount] = useState(item ? String(item.amount / 100).replace('.', ',') : '');
  const [type, setType] = useState(item?.type ?? 'expense');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '');
  const [interval, setInterval] = useState(item?.interval ?? 'monthly');
  const [anchorDate, setAnchorDate] = useState(item?.anchorDate ?? toIsoDate());
  const [endDate, setEndDate] = useState(item?.endDate ?? '');
  const cents = eurToCents(amount);
  const cats = categories.filter((c) => c.type === type);
  const valid = name.trim() && cents && categoryId && /^\d{4}-\d{2}-\d{2}$/.test(anchorDate);

  async function save() {
    try {
      await repo.saveRecurring({
        id: item?.id,
        name: name.trim(),
        amount: cents,
        type,
        categoryId,
        interval,
        anchorDate,
        endDate: endDate || undefined,
        lastProcessed: item?.lastProcessed ?? '',
      });
      await reload();
      toast('Abo gespeichert. Fällige Buchungen werden beim nächsten App-Start verbucht.');
      onClose();
    } catch (err) {
      console.error('Abo speichern fehlgeschlagen', err);
      toast('Speichern fehlgeschlagen — bitte erneut versuchen.', { error: true });
    }
  }

  async function remove() {
    try {
      await repo.deleteRecurring(item.id);
      await reload();
      toast('Abo gelöscht (bereits verbuchte Instanzen bleiben).');
      onClose();
    } catch (err) {
      console.error('Abo löschen fehlgeschlagen', err);
      toast('Löschen fehlgeschlagen — bitte erneut versuchen.', { error: true });
    }
  }

  return (
    <EditorSheet title={item ? 'Abo bearbeiten' : 'Neues Abo'} onClose={onClose}>
      <div className="form-grid">
        <div>
          <label htmlFor="re-name">Name</label>
          <input id="re-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Miete, Netflix" />
        </div>
        <div>
          <label htmlFor="re-amount">Betrag (€)</label>
          <input id="re-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="z. B. 12,99" />
        </div>
        <div>
          <label htmlFor="re-type">Typ</label>
          <select id="re-type" value={type} onChange={(e) => { setType(e.target.value); setCategoryId(''); }}>
            <option value="expense">Ausgabe</option>
            <option value="income">Einnahme</option>
          </select>
        </div>
        <div>
          <label htmlFor="re-cat">Kategorie</label>
          <select id="re-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— wählen —</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="re-interval">Intervall</label>
          <select id="re-interval" value={interval} onChange={(e) => setInterval(e.target.value)}>
            <option value="weekly">wöchentlich</option>
            <option value="monthly">monatlich</option>
            <option value="yearly">jährlich</option>
          </select>
        </div>
        <div>
          <label htmlFor="re-anchor">Erste Fälligkeit</label>
          <input id="re-anchor" type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="re-end">Enddatum (optional)</label>
          <input id="re-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" disabled={!valid} onClick={save}>Speichern</button>
        {item && <button className="btn btn-danger btn-block" onClick={remove}>Abo löschen</button>}
      </div>
    </EditorSheet>
  );
}
