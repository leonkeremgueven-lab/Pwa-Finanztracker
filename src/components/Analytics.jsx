import { useMemo, useState } from 'react';
import { useApp } from '../App.jsx';
import {
  PeriodBars, CategoryDonut, CategoryTrendLines, SavingsRateBars,
  colorForIndex,
} from './Charts.jsx';
import {
  lastMonths, monthTotals, savingsRate, expensesByCategory, currentMonthKey,
  shiftMonth, totalsByPeriod, categoryMonthlySeries, trendInsights,
} from '../logic/stats.js';
import { monthlyFixedCosts } from '../logic/recurring.js';
import { fmtCents, fmtMonth } from '../utils/format.js';

const GRANULARITIES = [
  { id: 'week', label: 'Pro Woche', count: 12 },
  { id: 'month', label: 'Pro Monat', count: 12 },
  { id: 'year', label: 'Pro Jahr', count: 5 },
];

export default function Analytics() {
  const { transactions, categories, recurring, loading } = useApp();

  const expenseCats = useMemo(() => categories.filter((c) => c.type === 'expense'), [categories]);
  // Farbe hängt fest an der Kategorie (Position in der Gesamtliste), nicht am Filter
  const colorOf = useMemo(() => {
    const map = new Map(categories.map((c, i) => [c.id, colorForIndex(i)]));
    return (id) => map.get(id) ?? 'rgba(236,235,231,0.4)';
  }, [categories]);

  const [granularity, setGranularity] = useState('month');
  const [showIncome, setShowIncome] = useState(true);
  const [donutMonth, setDonutMonth] = useState(currentMonthKey());
  const [selectedCats, setSelectedCats] = useState(null); // null = alle

  const selected = useMemo(
    () => selectedCats ?? new Set(expenseCats.map((c) => c.id)),
    [selectedCats, expenseCats]
  );
  const toggleCat = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCats(next);
  };

  // --- KPIs -------------------------------------------------------------
  const curKey = currentMonthKey();
  const prevKey = shiftMonth(curKey, -1);
  const kpis = useMemo(() => {
    const cur = monthTotals(transactions, curKey);
    const prev = monthTotals(transactions, prevKey);
    const now = new Date();
    const expenseDelta = prev.expense > 0 ? Math.round(((cur.expense - prev.expense) / prev.expense) * 100) : null;
    const perDay = now.getDate() > 0 ? Math.round(cur.expense / now.getDate()) : 0;
    const rate = savingsRate(prev) ?? savingsRate(cur);
    return { cur, expenseDelta, perDay, rate, fixed: monthlyFixedCosts(recurring) };
  }, [transactions, recurring, curKey, prevKey]);

  // --- Zeitverlauf -------------------------------------------------------
  const gran = GRANULARITIES.find((g) => g.id === granularity);
  const periodData = useMemo(
    () => totalsByPeriod(transactions, granularity, gran.count, new Date(), selected),
    [transactions, granularity, gran.count, selected]
  );

  // --- Kategorien im Monat ------------------------------------------------
  const monthCats = useMemo(() => {
    const rows = expensesByCategory(transactions, donutMonth).filter((e) => selected.has(e.categoryId));
    const total = rows.reduce((s, e) => s + e.amount, 0);
    return {
      total,
      rows: rows.map((e) => {
        const cat = categories.find((c) => c.id === e.categoryId);
        return {
          ...e,
          name: cat ? `${cat.icon} ${cat.name}` : 'Unbekannt',
          color: colorOf(e.categoryId),
          pct: total > 0 ? Math.round((e.amount / total) * 100) : 0,
        };
      }),
    };
  }, [transactions, donutMonth, selected, categories, colorOf]);

  // --- Kategorie-Trend (max. 4 Linien: die größten der Auswahl, 12 Monate) --
  const trend = useMemo(() => {
    const months = lastMonths(12);
    const totals = new Map();
    for (const t of transactions) {
      if (t.type !== 'expense' || !selected.has(t.categoryId)) continue;
      if (!months.includes(t.date.slice(0, 7))) continue;
      totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
    }
    const topIds = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
    const series = topIds.map((id) => {
      const cat = categories.find((c) => c.id === id);
      return { id, name: cat ? `${cat.icon} ${cat.name}` : 'Unbekannt', color: colorOf(id) };
    });
    return { data: categoryMonthlySeries(transactions, topIds, months), series, capped: totals.size > 4 };
  }, [transactions, selected, categories, colorOf]);

  // --- Sparquote + Insights ------------------------------------------------
  const rates = useMemo(
    () =>
      lastMonths(12)
        .map((key) => ({ key, rate: savingsRate(monthTotals(transactions, key)) }))
        .filter((r) => r.rate !== null),
    [transactions]
  );
  const insights = useMemo(
    () => trendInsights(transactions, categories, monthlyFixedCosts(recurring)),
    [transactions, categories, recurring]
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

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-label">Ausgaben {fmtMonth(curKey).split(' ')[0]}</span>
          <span className="kpi-value num">{fmtCents(kpis.cur.expense)}</span>
          {kpis.expenseDelta !== null && (
            <span className={`kpi-delta num ${kpis.expenseDelta > 0 ? 'neg' : 'pos'}`}>
              {kpis.expenseDelta > 0 ? '▲' : '▼'} {Math.abs(kpis.expenseDelta)} % vs. Vormonat
            </span>
          )}
        </div>
        <div className="kpi">
          <span className="kpi-label">Ø pro Tag</span>
          <span className="kpi-value num">{fmtCents(kpis.perDay)}</span>
          <span className="kpi-delta muted">im laufenden Monat</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Sparquote</span>
          <span className={`kpi-value num ${kpis.rate !== null && kpis.rate < 0 ? 'neg' : ''}`}>
            {kpis.rate !== null ? `${kpis.rate} %` : '—'}
          </span>
          <span className="kpi-delta muted">letzter voller Monat</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Fixkosten</span>
          <span className="kpi-value num">{fmtCents(kpis.fixed)}</span>
          <span className="kpi-delta muted">pro Monat</span>
        </div>
      </div>

      {insights.length > 0 && (
        <div className="card">
          <div className="card-title">🧠 Trends & Insights</div>
          <div className="stack" style={{ gap: 10 }}>
            {insights.map((ins) => (
              <div key={ins.id} className="insight">
                <span className="insight-icon" aria-hidden>{ins.icon}</span>
                <span>
                  <strong className="small">{ins.title}</strong>
                  <div className={`small ${ins.tone === 'pos' ? 'pos' : ins.tone === 'neg' ? 'warn' : 'muted'}`}>
                    {ins.text.replace(/PROJ|VAL/g, fmtCents(ins.value ?? 0))}
                  </div>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="row-between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Ausgabenverlauf</div>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value)}
              aria-label="Zeitraum"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '0.85rem' }}
            >
              {GRANULARITIES.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </div>
          {selected.size < expenseCats.length && (
            <p className="small muted" style={{ margin: '0 0 4px' }}>
              Gefiltert auf {selected.size} von {expenseCats.length} Kategorien.
            </p>
          )}
          <PeriodBars data={periodData} granularity={granularity} showIncome={showIncome} />
          <label className="row small muted" style={{ gap: 6, marginTop: 4 }}>
            <input
              type="checkbox"
              checked={showIncome}
              onChange={(e) => setShowIncome(e.target.checked)}
              style={{ width: 'auto' }}
            />
            Einnahmen einblenden
          </label>
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
                disabled={donutMonth >= curKey}
                onClick={() => setDonutMonth((m) => shiftMonth(m, 1))}
              >
                ›
              </button>
            </div>
          </div>

          <details className="dropdown-panel">
            <summary>
              Kategorien wählen ({selected.size}/{expenseCats.length})
            </summary>
            <div className="row" style={{ margin: '8px 0' }}>
              <button className="btn small" style={{ minHeight: 36, padding: '4px 12px' }} onClick={() => setSelectedCats(new Set(expenseCats.map((c) => c.id)))}>Alle</button>
              <button className="btn small" style={{ minHeight: 36, padding: '4px 12px' }} onClick={() => setSelectedCats(new Set())}>Keine</button>
            </div>
            <div className="checkbox-list">
              {expenseCats.map((c) => (
                <label key={c.id} className="row small" style={{ gap: 8, padding: '7px 0' }}>
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleCat(c.id)}
                    style={{ width: 'auto' }}
                  />
                  <span className="cat-dot" style={{ background: colorOf(c.id) }} aria-hidden />
                  {c.icon} {c.name}
                </label>
              ))}
            </div>
          </details>

          {monthCats.rows.length === 0 ? (
            <p className="muted small" style={{ padding: '16px 0' }}>Keine Ausgaben in diesem Monat (für die gewählten Kategorien).</p>
          ) : (
            <>
              <CategoryDonut data={monthCats.rows.map((r) => ({ name: r.name, value: r.amount, color: r.color }))} />
              <div className="stack" style={{ gap: 8 }}>
                {monthCats.rows.map((r) => (
                  <div key={r.categoryId}>
                    <div className="row-between small">
                      <span className="row" style={{ gap: 6 }}>
                        <span className="cat-dot" style={{ background: r.color }} aria-hidden />
                        {r.name}
                      </span>
                      <span className="num">
                        <strong>{r.pct} %</strong> <span className="muted">· {fmtCents(r.amount)}</span>
                      </span>
                    </div>
                    <div className="share-bar">
                      <div style={{ width: `${(r.amount / monthCats.rows[0].amount) * 100}%`, background: r.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title">Kategorie-Trend (12 Monate)</div>
          {trend.series.length === 0 ? (
            <p className="muted small">Keine Ausgaben in den gewählten Kategorien.</p>
          ) : (
            <>
              <CategoryTrendLines data={trend.data} series={trend.series} />
              {trend.capped && (
                <p className="small muted" style={{ margin: '4px 0 0' }}>
                  Zeigt die 4 größten der gewählten Kategorien.
                </p>
              )}
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title">Sparquote pro Monat</div>
          {rates.length === 0 ? (
            <p className="muted small">Sobald Einnahmen erfasst sind, siehst du hier deine Sparquote.</p>
          ) : (
            <SavingsRateBars data={rates} />
          )}
        </div>
      </div>
    </div>
  );
}
