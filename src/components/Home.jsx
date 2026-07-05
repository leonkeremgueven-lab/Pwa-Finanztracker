import { useMemo, useState } from 'react';
import { useApp } from '../App.jsx';
import TransactionList from './TransactionList.jsx';
import MonthReport, { ReportTeaser } from './MonthReport.jsx';
import { monthTotals, budgetStatus, currentMonthKey } from '../logic/stats.js';
import { monthlyFixedCosts } from '../logic/recurring.js';
import { fmtCents, fmtSigned, fmtMonth } from '../utils/format.js';

export default function Home() {
  const { transactions, budgets, categories, recurring, loading, setActiveTab, openMore } = useApp();
  const [reportMonth, setReportMonth] = useState(null);
  const key = currentMonthKey();

  const totals = useMemo(() => monthTotals(transactions, key), [transactions, key]);
  const statuses = useMemo(() => budgetStatus(budgets, transactions, key), [budgets, transactions, key]);
  const attention = statuses.filter((s) => s.level !== 'ok');
  const fixedCosts = useMemo(() => monthlyFixedCosts(recurring), [recurring]);
  const recent = transactions.slice(0, 5);

  if (reportMonth) {
    return <MonthReport initialMonth={reportMonth} onBack={() => setReportMonth(null)} />;
  }

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Übersicht</h1>
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Übersicht</h1>

      <div className="card">
        <div className="card-title">{fmtMonth(key)}</div>
        <div className={`num ${totals.balance >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: '2.1rem', fontWeight: 700 }}>
          {fmtSigned(totals.balance)}
        </div>
        <div className="row" style={{ marginTop: 6, gap: 16 }}>
          <span className="small muted num">▲ {fmtCents(totals.income)}</span>
          <span className="small muted num">▼ {fmtCents(totals.expense + totals.goalDeposits)}</span>
        </div>
      </div>

      <ReportTeaser onOpen={setReportMonth} />

      {recurring.filter((r) => r.interval === 'monthly').length === 0 && (
        <button className="card" style={{ width: '100%', textAlign: 'left', display: 'block' }} onClick={() => openMore('baseconfig')}>
          <div className="card-title">💶 Grundkonfiguration einrichten</div>
          <div className="row-between">
            <span className="small muted">
              Gehalt, Miete & feste Kosten einmal eintragen — sie werden jeden Monat automatisch verbucht.
            </span>
            <span className="pos small">Los ›</span>
          </div>
        </button>
      )}

      {attention.length > 0 && (
        <button className="card" style={{ width: '100%', textAlign: 'left', display: 'block' }} onClick={() => setActiveTab('budgets')}>
          <div className="card-title">⚠️ Budgets im Blick behalten</div>
          {attention.map((s) => {
            const cat = categories.find((c) => c.id === s.categoryId);
            return (
              <div key={s.id} className="row-between" style={{ padding: '3px 0' }}>
                <span className="small">{cat?.icon} {cat?.name}</span>
                <span className={`small num ${s.level === 'over' ? 'neg' : 'warn'}`}>
                  {Math.round(s.ratio * 100)} % verbraucht
                </span>
              </div>
            );
          })}
        </button>
      )}

      {recurring.length > 0 && (
        <button className="card" style={{ width: '100%', textAlign: 'left', display: 'block' }} onClick={() => setActiveTab('budgets')}>
          <div className="row-between">
            <span className="card-title" style={{ marginBottom: 0 }}>🔁 Deine Fixkosten</span>
            <strong className="num">{fmtCents(fixedCosts)}/Monat</strong>
          </div>
        </button>
      )}

      <div className="row-between" style={{ margin: '18px 0 4px' }}>
        <h2>Letzte Buchungen</h2>
        {transactions.length > 5 && (
          <button className="btn btn-ghost small" onClick={() => setActiveTab('history')}>Alle ›</button>
        )}
      </div>
      <TransactionList
        transactions={recent}
        emptyText="Noch keine Buchungen. Tippe unten rechts auf +, um zu starten."
      />
    </div>
  );
}
