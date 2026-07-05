import { useMemo, useState } from 'react';
import { useApp } from '../App.jsx';
import { buildMonthReport, reportableMonths } from '../logic/report.js';
import { currentMonthKey, shiftMonth } from '../logic/stats.js';
import { fmtCents, fmtSigned, fmtMonth, fmtDate } from '../utils/format.js';

/** Vollständiger Report eines Monats. */
export function ReportDetail({ report }) {
  if (!report) return null;
  const { totals, savingsRate, topCategories, biggestExpense, budgets, delta } = report;
  return (
    <div>
      <div className="card">
        <div className="card-title">Bilanz</div>
        <div className="row-between"><span>Einnahmen</span><strong className="num pos">{fmtCents(totals.income)}</strong></div>
        <div className="row-between"><span>Ausgaben</span><strong className="num">{fmtCents(totals.expense)}</strong></div>
        {totals.goalDeposits > 0 && (
          <div className="row-between"><span>Sparziel-Einzahlungen</span><strong className="num">{fmtCents(totals.goalDeposits)}</strong></div>
        )}
        <div className="row-between" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--line)' }}>
          <span>Saldo</span>
          <strong className={`num ${totals.balance >= 0 ? 'pos' : 'neg'}`}>{fmtSigned(totals.balance)}</strong>
        </div>
        {savingsRate !== null && (
          <div className="row-between"><span>Sparquote</span><strong className={`num ${savingsRate >= 0 ? 'pos' : 'neg'}`}>{savingsRate} %</strong></div>
        )}
      </div>

      {topCategories.length > 0 && (
        <div className="card">
          <div className="card-title">Top-Kategorien</div>
          {topCategories.map((c, i) => (
            <div key={c.categoryId} className="row-between" style={{ padding: '4px 0' }}>
              <span>{i + 1}. {c.icon} {c.name}</span>
              <strong className="num">{fmtCents(c.amount)}</strong>
            </div>
          ))}
        </div>
      )}

      {biggestExpense && (
        <div className="card">
          <div className="card-title">Größte Einzelausgabe</div>
          <div className="row-between">
            <span>
              {biggestExpense.note || biggestExpense.categoryName}
              <div className="small muted">{biggestExpense.categoryName} · {fmtDate(biggestExpense.date)}</div>
            </span>
            <strong className="num">{fmtCents(biggestExpense.amount)}</strong>
          </div>
        </div>
      )}

      {budgets.length > 0 && (
        <div className="card">
          <div className="card-title">Budget-Bilanz</div>
          {budgets.map((b) => (
            <div key={b.categoryId} className="row-between" style={{ padding: '4px 0' }}>
              <span>{b.icon} {b.name}</span>
              <span className={`num small ${b.kept ? 'pos' : 'neg'}`}>
                {b.kept ? '✓ eingehalten' : '✗ überzogen'} · {fmtCents(b.used)} / {fmtCents(b.limit)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">Vergleich zum Vormonat</div>
        <div className="row-between"><span>Einnahmen</span><span className={`num ${delta.income >= 0 ? 'pos' : 'neg'}`}>{fmtSigned(delta.income)}</span></div>
        <div className="row-between"><span>Ausgaben</span><span className={`num ${delta.expense <= 0 ? 'pos' : 'neg'}`}>{fmtSigned(delta.expense)}</span></div>
        <div className="row-between"><span>Saldo</span><span className={`num ${delta.balance >= 0 ? 'pos' : 'neg'}`}>{fmtSigned(delta.balance)}</span></div>
      </div>
    </div>
  );
}

/** Karte auf der Übersicht: „Dein [Monat] im Überblick" für den Vormonat. */
export function ReportTeaser({ onOpen }) {
  const { transactions, budgets, categories } = useApp();
  const prevKey = shiftMonth(currentMonthKey(), -1);
  const report = useMemo(
    () => buildMonthReport(prevKey, transactions, budgets, categories),
    [prevKey, transactions, budgets, categories]
  );
  if (!report) return null;
  return (
    <button className="card" style={{ width: '100%', textAlign: 'left', display: 'block' }} onClick={() => onOpen(prevKey)}>
      <div className="card-title">📋 Dein {fmtMonth(prevKey)} im Überblick</div>
      <div className="row-between">
        <span className="small muted">
          {fmtCents(report.totals.expense)} ausgegeben · Saldo {fmtSigned(report.totals.balance)}
        </span>
        <span className="pos small">Ansehen ›</span>
      </div>
    </button>
  );
}

/** Archiv-Seite mit Monatswahl. */
export default function MonthReport({ initialMonth = null, onBack }) {
  const { transactions, budgets, categories } = useApp();
  const currentKey = currentMonthKey();
  const months = useMemo(() => reportableMonths(transactions, currentKey), [transactions, currentKey]);
  const [selected, setSelected] = useState(initialMonth ?? months[0] ?? null);

  const report = useMemo(
    () => (selected ? buildMonthReport(selected, transactions, budgets, categories) : null),
    [selected, transactions, budgets, categories]
  );

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        {onBack && <button className="icon-btn" onClick={onBack} aria-label="Zurück">‹</button>}
        <h2>Monatsabschluss</h2>
      </div>
      {months.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden>📋</span>
          Noch keine abgeschlossenen Monate mit Buchungen. Der erste Report erscheint am 1. des nächsten Monats.
        </div>
      ) : (
        <>
          <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value)} style={{ marginBottom: 12 }} aria-label="Monat wählen">
            {months.map((m) => (
              <option key={m} value={m}>{fmtMonth(m)}</option>
            ))}
          </select>
          {report ? <ReportDetail report={report} /> : <p className="muted">Keine Daten für diesen Monat.</p>}
        </>
      )}
    </div>
  );
}
