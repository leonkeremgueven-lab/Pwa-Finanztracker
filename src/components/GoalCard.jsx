import { fmtCents, fmtDate } from '../utils/format.js';

function ProgressRing({ pct }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const filled = Math.min(1, pct / 100) * c;
  return (
    <div className="ring" aria-hidden>
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke="var(--accent)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <span className="ring-label num">{pct}%</span>
    </div>
  );
}

/** Sparziel mit Fortschrittsring und linearer Prognose. */
export default function GoalCard({ goal, saved, forecast, onEdit, onDeposit }) {
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((saved / goal.targetAmount) * 100)) : 0;
  const done = saved >= goal.targetAmount;

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <ProgressRing pct={pct} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row-between">
            <strong>{goal.name}</strong>
            <button className="icon-btn" aria-label={`${goal.name} bearbeiten`} onClick={onEdit}>✏️</button>
          </div>
          <div className="num">
            {fmtCents(saved)} <span className="muted">von {fmtCents(goal.targetAmount)}</span>
          </div>
          {goal.targetDate && <div className="small muted">Wunschtermin: {fmtDate(goal.targetDate)}</div>}
          <div className="small" style={{ marginTop: 4 }}>
            {done ? (
              <span className="pos">🎉 Ziel erreicht!</span>
            ) : forecast?.date ? (
              <span className="muted">
                Bei deinem Tempo erreichst du das Ziel am <strong>{fmtDate(forecast.date)}</strong>.
              </span>
            ) : (
              <span className="muted">Zahle regelmäßig ein, um eine Prognose zu sehen.</span>
            )}
          </div>
        </div>
      </div>
      {!done && (
        <button className="btn btn-block" style={{ marginTop: 10 }} onClick={onDeposit}>
          🐷 Einzahlen
        </button>
      )}
    </div>
  );
}
