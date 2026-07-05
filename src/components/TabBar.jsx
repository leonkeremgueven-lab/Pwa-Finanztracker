export const TABS = [
  { id: 'home', label: 'Übersicht', icon: '🏠' },
  { id: 'history', label: 'Historie', icon: '🧾' },
  { id: 'budgets', label: 'Budgets & Ziele', icon: '🎯' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'more', label: 'Mehr', icon: '⚙️' },
];

export default function TabBar({ tabs, active, onChange }) {
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={active === tab.id ? 'active' : ''}
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? 'page' : undefined}
        >
          <span className="tab-icon" aria-hidden>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
