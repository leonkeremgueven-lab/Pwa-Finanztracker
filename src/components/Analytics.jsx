import { useMemo, useState } from 'react';
import { useApp } from '../App.jsx';
import { IncomeExpenseBars, CategoryDonut, ExpenseTrendLine } from './Charts.jsx';
import { lastMonths, monthTotals, savingsRate, expensesByCategory, currentMonthKey, shiftMonth } from '../logic/stats.js';
import { fmtMonth } from '../utils/format.js';

export default function Analytics() {
  const { transactions, categories, loading } = useApp();
  const [donutMonth, setDonutMonth] = useState(currentMonthKey());

  const sixMonths = useMemo(
    () => lastMonths(6).map((key) => ({ key, ...monthTotals(transactions, key) })),
    [transactions]
  );
  const twelveMonths = useMemo(
    () => lastMonths(12).map((key) => ({ key, expense: monthTotals(transactions, key).expense })),
    [transactions]
  );
  const donutData = useMemo(
    () =>
      expensesByCategory(transactions, donutMonth).map((e) => {
        const cat = categories.find((c) => c.id === e.categoryId);
        return { name: cat ? `${cat.icon} ${cat.name}` : 'Unbekannt', value: e.amount };
      }),
    [transactions, categories, donutMonth]
  );
  const rates = useMemo(
    () =>
      lastMonths(6)
        .map((key) => ({ key, rate: savingsRate(monthTotals(transactions, key)) }))
        .filter((r) => r.rate !== null),
    [transactions]
  );

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Analytics</h1>
        <div className="skeleton" /><div className="skeleton" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div>
        <h1 className="page-title">Analytics</h1>
        <div className="empty">
          <span className="empty-icon" aria-hidden>📊</span>
          Noch keine Daten. Erfasse Buchungen, um Auswertungen zu sehen.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Analytics</h1>
      <div className="grid-2">
        <div className="card">
          <div className="card-title">Einnahmen vs. Ausgaben (6 Monate)</div>
          <IncomeExpenseBars data={sixMonths} />
        </div>

        <div className="card">
          <div className="row-between" style={{ marginBottom: 4 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Kategorien</div>
            <div className="row">
              <button className="icon-btn" aria-label="Voriger Monat" onClick={() => setDonutMonth((m) => shiftMonth(m, -1))}>‹</button>
              <span className="small">{fmtMonth(donutMonth)}</span>
              <button
                className="icon-btn"
                aria-label="Nächster Monat"
                disabled={donutMonth >= currentMonthKey()}
                onClick={() => setDonutMonth((m) => shiftMonth(m, 1))}
              >
                ›
              </button>
            </div>
          </div>
          {donutData.length ? (
            <CategoryDonut data={donutData} />
          ) : (
            <p className="muted small">Keine Ausgaben in diesem Monat.</p>
          )}
        </div>

        <div className="card">
          <div className="card-title">Ausgaben-Trend (12 Monate)</div>
          <ExpenseTrendLine data={twelveMonths} />
        </div>

        <div className="card">
          <div className="card-title">Sparquote pro Monat</div>
          {rates.length === 0 && <p className="muted small">Sobald Einnahmen erfasst sind, siehst du hier deine Sparquote.</p>}
          {rates.map((r) => (
            <div key={r.key} className="row-between" style={{ padding: '5px 0' }}>
              <span className="small">{fmtMonth(r.key)}</span>
              <strong className={`num ${r.rate >= 0 ? 'pos' : 'neg'}`}>{r.rate} %</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
