import { useState } from 'react';
import BaseConfig from './BaseConfig.jsx';
import NetWorth from './NetWorth.jsx';
import MonthReport from './MonthReport.jsx';
import Settings from './Settings.jsx';

const SECTIONS = [
  { id: 'baseconfig', label: '💶 Grundkonfiguration', hint: 'Feste monatliche Einnahmen & Ausgaben' },
  { id: 'networth', label: '🏦 Net Worth' },
  { id: 'reports', label: '📋 Monatsabschlüsse' },
  { id: 'settings', label: '⚙️ Einstellungen & Backup' },
];

export default function More({ initialSection = null }) {
  const [section, setSection] = useState(initialSection);

  if (section === 'baseconfig') return <Sub onBack={() => setSection(null)}><BaseConfig /></Sub>;
  if (section === 'networth') return <Sub onBack={() => setSection(null)}><NetWorth /></Sub>;
  if (section === 'reports') return <Sub onBack={() => setSection(null)}><MonthReport /></Sub>;
  if (section === 'settings') return <Sub onBack={() => setSection(null)}><Settings /></Sub>;

  return (
    <div>
      <h1 className="page-title">Mehr</h1>
      <div className="stack">
        {SECTIONS.map((s) => (
          <button key={s.id} className="card row-between" style={{ width: '100%', textAlign: 'left' }} onClick={() => setSection(s.id)}>
            <span>
              {s.label}
              {s.hint && <div className="small muted">{s.hint}</div>}
            </span>
            <span className="muted">›</span>
          </button>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 24 }}>
        Finanz speichert alle Daten ausschließlich lokal auf diesem Gerät. Kein Konto, keine Cloud, kein Tracking.
      </p>
    </div>
  );
}

function Sub({ onBack, children }) {
  return (
    <div>
      <button className="btn btn-ghost" style={{ marginBottom: 8 }} onClick={onBack}>‹ Zurück</button>
      {children}
    </div>
  );
}
