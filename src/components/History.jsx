import { useMemo, useState } from 'react';
import { useApp } from '../App.jsx';
import Filters, { EMPTY_FILTERS, applyFilters } from './Filters.jsx';
import TransactionList from './TransactionList.jsx';

export default function History() {
  const { transactions, categories, loading } = useApp();
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });

  const filtered = useMemo(
    () => applyFilters(transactions, filters, categories),
    [transactions, filters, categories]
  );

  return (
    <div>
      <h1 className="page-title">Historie</h1>
      <Filters filters={filters} onChange={setFilters} />
      {loading ? (
        <>
          <div className="skeleton" />
          <div className="skeleton" />
        </>
      ) : (
        <TransactionList
          transactions={filtered}
          emptyText={
            transactions.length === 0
              ? 'Noch keine Buchungen. Tippe auf +, um deine erste Ausgabe zu erfassen.'
              : 'Keine Buchungen für diese Filter gefunden.'
          }
        />
      )}
    </div>
  );
}
