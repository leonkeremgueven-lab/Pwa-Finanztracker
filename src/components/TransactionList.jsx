import { useRef, useState } from 'react';
import { useApp } from '../App.jsx';
import { fmtCents, fmtSigned, fmtDay } from '../utils/format.js';

const UNDO_MS = 5000;

/**
 * Chronologische Liste, gruppiert nach Tag mit Tagessumme.
 * Tap = Aktionen (Bearbeiten/Löschen), Löschen mit 5-s-Undo.
 */
export default function TransactionList({ transactions, emptyText = 'Noch keine Buchungen.' }) {
  const { categories, goals, repo, reload, toast, openEdit } = useApp();
  const [openActionsId, setOpenActionsId] = useState(null);
  const undoTimer = useRef(null);

  if (transactions.length === 0) {
    return (
      <div className="empty">
        <span className="empty-icon" aria-hidden>🧾</span>
        {emptyText}
      </div>
    );
  }

  const byDay = new Map();
  for (const t of transactions) {
    if (!byDay.has(t.date)) byDay.set(t.date, []);
    byDay.get(t.date).push(t);
  }

  const catOf = (t) => categories.find((c) => c.id === t.categoryId);
  const titleOf = (t) => {
    if (t.type === 'goal_deposit') {
      const goal = goals.find((g) => g.id === t.goalId);
      return t.note || `Sparziel: ${goal?.name ?? '—'}`;
    }
    return t.note || catOf(t)?.name || 'Buchung';
  };
  const signedAmount = (t) => (t.type === 'income' ? t.amount : -t.amount);

  async function handleDelete(t) {
    setOpenActionsId(null);
    try {
      const deleted = await repo.deleteTransaction(t.id);
      await reload();
      toast(`Gelöscht: ${titleOf(t)} (${fmtCents(t.amount)})`, {
        actionLabel: 'Rückgängig',
        duration: UNDO_MS,
        action: async () => {
          clearTimeout(undoTimer.current);
          try {
            await repo.restoreTransaction(deleted);
            await reload();
          } catch (err) {
            console.error('Wiederherstellen fehlgeschlagen', err);
            toast('Wiederherstellen fehlgeschlagen.', { error: true });
          }
        },
      });
    } catch (err) {
      console.error('Löschen fehlgeschlagen', err);
      toast('Löschen fehlgeschlagen — bitte erneut versuchen.', { error: true });
    }
  }

  return (
    <div>
      {[...byDay.entries()].map(([date, txs]) => {
        const daySum = txs.reduce((s, t) => s + signedAmount(t), 0);
        return (
          <div key={date}>
            <div className="tx-day-header">
              <span>{fmtDay(date)}</span>
              <span className={`num ${daySum < 0 ? '' : 'pos'}`}>{fmtSigned(daySum)}</span>
            </div>
            {txs.map((t) => {
              const cat = catOf(t);
              const isOpen = openActionsId === t.id;
              return (
                <div key={t.id}>
                  <button className="tx-item" onClick={() => setOpenActionsId(isOpen ? null : t.id)}>
                    <span className="tx-icon" aria-hidden>
                      {t.type === 'goal_deposit' ? '🐷' : cat?.icon ?? '📦'}
                    </span>
                    <span className="tx-main">
                      <span className="tx-title">{titleOf(t)}</span>
                      <span className="tx-sub">
                        {t.type === 'goal_deposit' ? 'Sparziel-Einzahlung' : cat?.name ?? 'Ohne Kategorie'}
                        {t.recurringId ? ' · 🔁 Abo' : ''}
                      </span>
                    </span>
                    <span className={`tx-amount num ${t.type === 'income' ? 'pos' : ''}`}>
                      {t.type === 'income' ? fmtSigned(t.amount) : fmtSigned(-t.amount)}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="row" style={{ margin: '2px 0 8px', justifyContent: 'flex-end' }}>
                      <button className="btn" onClick={() => { setOpenActionsId(null); openEdit(t); }}>
                        ✏️ Bearbeiten
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDelete(t)}>
                        🗑️ Löschen
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
