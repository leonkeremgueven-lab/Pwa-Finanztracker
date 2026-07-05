// Monatsabschluss-Report: berechnet alle Kennzahlen eines Monats
// (typischerweise des Vormonats) rein aus den Rohdaten.

import { monthTotals, savingsRate, expensesByCategory, budgetStatus, monthKey, shiftMonth } from './stats.js';

/**
 * Erstellt den Report für Monat `key` ('yyyy-mm').
 * Liefert null, wenn der Monat keinerlei Buchungen hat.
 */
export function buildMonthReport(key, transactions, budgets, categories) {
  const inMonth = transactions.filter((t) => monthKey(t.date) === key);
  if (inMonth.length === 0) return null;

  const totals = monthTotals(transactions, key);
  const prevKey = shiftMonth(key, -1);
  const prevTotals = monthTotals(transactions, prevKey);
  const catName = (id) => categories.find((c) => c.id === id)?.name ?? 'Unbekannt';
  const catIcon = (id) => categories.find((c) => c.id === id)?.icon ?? '❓';

  const byCat = expensesByCategory(transactions, key);
  const topCategories = byCat.slice(0, 3).map((e) => ({
    ...e,
    name: catName(e.categoryId),
    icon: catIcon(e.categoryId),
  }));

  const expenses = inMonth.filter((t) => t.type === 'expense');
  const biggest = expenses.length
    ? expenses.reduce((max, t) => (t.amount > max.amount ? t : max))
    : null;

  const budgetResults = budgetStatus(budgets, transactions, key).map((b) => ({
    categoryId: b.categoryId,
    name: catName(b.categoryId),
    icon: catIcon(b.categoryId),
    limit: b.monthlyLimit,
    used: b.used,
    kept: b.used <= b.monthlyLimit,
  }));

  return {
    key,
    totals,
    savingsRate: savingsRate(totals),
    topCategories,
    biggestExpense: biggest
      ? { amount: biggest.amount, note: biggest.note, categoryName: catName(biggest.categoryId), date: biggest.date }
      : null,
    budgets: budgetResults,
    delta: {
      income: totals.income - prevTotals.income,
      expense: totals.expense - prevTotals.expense,
      balance: totals.balance - prevTotals.balance,
    },
    txCount: inMonth.length,
  };
}

/** Alle Monats-Keys (absteigend), für die Buchungen existieren — außer dem laufenden Monat. */
export function reportableMonths(transactions, currentKey) {
  const keys = new Set(transactions.map((t) => monthKey(t.date)));
  keys.delete(currentKey);
  return [...keys].filter((k) => k < currentKey).sort().reverse();
}
