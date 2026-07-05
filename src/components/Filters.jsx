import { useApp } from '../App.jsx';

export const EMPTY_FILTERS = {
  query: '',
  categoryId: '',
  type: '',
  from: '',
  to: '',
  minAmount: '',
  maxAmount: '',
};

/** Wendet die Filter auf eine Transaktionsliste an (Beträge in Euro-Eingabe). */
export function applyFilters(transactions, filters, categories) {
  const q = filters.query.trim().toLowerCase();
  const min = filters.minAmount === '' ? null : Math.round(Number.parseFloat(filters.minAmount.replace(',', '.')) * 100);
  const max = filters.maxAmount === '' ? null : Math.round(Number.parseFloat(filters.maxAmount.replace(',', '.')) * 100);
  const catName = (id) => categories.find((c) => c.id === id)?.name.toLowerCase() ?? '';

  return transactions.filter((t) => {
    if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
    if (filters.type && t.type !== filters.type) return false;
    if (filters.from && t.date < filters.from) return false;
    if (filters.to && t.date > filters.to) return false;
    if (min !== null && Number.isFinite(min) && t.amount < min) return false;
    if (max !== null && Number.isFinite(max) && t.amount > max) return false;
    if (q && !(t.note?.toLowerCase().includes(q) || catName(t.categoryId).includes(q))) return false;
    return true;
  });
}

export default function Filters({ filters, onChange }) {
  const { categories } = useApp();
  const set = (patch) => onChange({ ...filters, ...patch });
  const active = Object.entries(filters).some(([, v]) => v !== '');

  return (
    <div>
      <div className="filter-bar">
        <input
          type="search"
          placeholder="Suchen (Notiz, Kategorie) …"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          style={{ flexBasis: '100%' }}
        />
        <select value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value })} aria-label="Kategorie">
          <option value="">Alle Kategorien</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <select value={filters.type} onChange={(e) => set({ type: e.target.value })} aria-label="Typ">
          <option value="">Alle Typen</option>
          <option value="expense">Ausgaben</option>
          <option value="income">Einnahmen</option>
          <option value="goal_deposit">Sparziel-Einzahlungen</option>
        </select>
      </div>
      <details className="optional-fields" style={{ marginTop: 0 }}>
        <summary>Zeitraum & Betrag</summary>
        <div className="filter-bar">
          <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} aria-label="Von" />
          <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} aria-label="Bis" />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Min €"
            value={filters.minAmount}
            onChange={(e) => set({ minAmount: e.target.value })}
            aria-label="Mindestbetrag"
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Max €"
            value={filters.maxAmount}
            onChange={(e) => set({ maxAmount: e.target.value })}
            aria-label="Höchstbetrag"
          />
        </div>
      </details>
      {active && (
        <button className="btn btn-ghost small" onClick={() => onChange({ ...EMPTY_FILTERS })}>
          ✕ Filter zurücksetzen
        </button>
      )}
    </div>
  );
}
