import { fmtCents, daysLeftInMonth } from '../utils/format.js';

/** Ein Budget mit Fortschrittsbalken: grün / amber (>80 %) / rot (>100 %). */
export default function BudgetCard({ status, category, onEdit }) {
  const pct = Math.min(100, Math.round(status.ratio * 100));
  const days = daysLeftInMonth();

  return (
    <button className="card" style={{ width: '100%', textAlign: 'left', display: 'block' }} onClick={onEdit}>
      <div className="row-between">
        <span className="row">
          <span aria-hidden>{category?.icon ?? '📦'}</span>
          <strong>{category?.name ?? 'Unbekannt'}</strong>
        </span>
        <span className={`num small ${status.level === 'over' ? 'neg' : status.level === 'warn' ? 'warn' : 'muted'}`}>
          {fmtCents(status.used)} / {fmtCents(status.monthlyLimit)}
        </span>
      </div>
      <div className={`progress ${status.level}`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="row-between small muted">
        <span className={status.remaining < 0 ? 'neg' : ''}>
          {status.remaining >= 0
            ? `${fmtCents(status.remaining)} übrig`
            : `${fmtCents(-status.remaining)} überzogen`}
        </span>
        <span>{days} {days === 1 ? 'Tag' : 'Tage'} bis Monatsende</span>
      </div>
    </button>
  );
}
