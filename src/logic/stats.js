// Aggregationen über Transaktionen, Budgets, Ziele und Snapshots.
// Alle Beträge in Cent (Integer). Monate als 'yyyy-mm'.

export function monthKey(isoDate) {
  return isoDate.slice(0, 7);
}

export function currentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Einnahmen/Ausgaben/Sparziel-Einzahlungen eines Monats. */
export function monthTotals(transactions, key) {
  const totals = { income: 0, expense: 0, goalDeposits: 0 };
  for (const t of transactions) {
    if (monthKey(t.date) !== key) continue;
    if (t.type === 'income') totals.income += t.amount;
    else if (t.type === 'expense') totals.expense += t.amount;
    else if (t.type === 'goal_deposit') totals.goalDeposits += t.amount;
  }
  totals.balance = totals.income - totals.expense - totals.goalDeposits;
  return totals;
}

/** Sparquote in % (gespart = Einnahmen - Ausgaben; Ziel-Einzahlungen zählen als gespart). */
export function savingsRate(totals) {
  if (totals.income <= 0) return null;
  return Math.round(((totals.income - totals.expense) / totals.income) * 100);
}

/** Ausgaben je Kategorie eines Monats, absteigend sortiert. */
export function expensesByCategory(transactions, key) {
  const map = new Map();
  for (const t of transactions) {
    if (t.type !== 'expense' || monthKey(t.date) !== key) continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Verbrauch je Budget im Monat + Status-Farbe. */
export function budgetStatus(budgets, transactions, key) {
  const spent = new Map(expensesByCategory(transactions, key).map((e) => [e.categoryId, e.amount]));
  return budgets.map((b) => {
    const used = spent.get(b.categoryId) ?? 0;
    const ratio = b.monthlyLimit > 0 ? used / b.monthlyLimit : 0;
    let level = 'ok';
    if (ratio > 1) level = 'over';
    else if (ratio > 0.8) level = 'warn';
    return { ...b, used, remaining: b.monthlyLimit - used, ratio, level };
  });
}

/** Letzte n Monate als Keys, älteste zuerst, inkl. aktuellem Monat. */
export function lastMonths(n, now = new Date()) {
  const keys = [];
  for (let i = n - 1; i >= 0; i -= 1) keys.push(shiftMonth(currentMonthKey(now), -i));
  return keys;
}

/** Angesparter Betrag je Ziel (Summe der goal_deposit-Transaktionen). */
export function goalSaved(transactions, goalId) {
  return transactions
    .filter((t) => t.type === 'goal_deposit' && t.goalId === goalId)
    .reduce((s, t) => s + t.amount, 0);
}

/**
 * Prognose: lineares Tempo aus den Einzahlungen der letzten 3 Kalendermonate.
 * Gibt ISO-Datum der voraussichtlichen Zielerreichung oder null zurück.
 */
export function goalForecast(goal, transactions, now = new Date()) {
  const saved = goalSaved(transactions, goal.id);
  const remaining = goal.targetAmount - saved;
  if (remaining <= 0) return { done: true, date: null };
  const window = lastMonths(3, now);
  const deposited = transactions
    .filter((t) => t.type === 'goal_deposit' && t.goalId === goal.id && window.includes(monthKey(t.date)))
    .reduce((s, t) => s + t.amount, 0);
  const perMonth = deposited / 3;
  if (perMonth <= 0) return { done: false, date: null };
  const months = Math.ceil(remaining / perMonth);
  const d = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
  return { done: false, date: d.toISOString().slice(0, 10), perMonth: Math.round(perMonth) };
}

/** Net Worth: letzter Snapshot je Konto, summiert (gesamt und je Kontotyp). */
export function netWorth(accounts, snapshots) {
  const latest = latestSnapshots(snapshots);
  let total = 0;
  const byKind = {};
  for (const acc of accounts) {
    const snap = latest.get(acc.id);
    if (!snap) continue;
    total += snap.balance;
    byKind[acc.kind] = (byKind[acc.kind] ?? 0) + snap.balance;
  }
  return { total, byKind };
}

export function latestSnapshots(snapshots) {
  const latest = new Map();
  for (const s of snapshots) {
    const prev = latest.get(s.accountId);
    if (!prev || s.date > prev.date || (s.date === prev.date && (s.createdAt ?? 0) > (prev.createdAt ?? 0))) {
      latest.set(s.accountId, s);
    }
  }
  return latest;
}

/**
 * Net-Worth-Verlauf: für jedes Datum, an dem irgendein Snapshot existiert,
 * die Summe der jeweils letzten bekannten Salden aller Konten.
 */
export function netWorthHistory(accounts, snapshots) {
  const dates = [...new Set(snapshots.map((s) => s.date))].sort();
  const accIds = new Set(accounts.map((a) => a.id));
  const lastBalance = new Map();
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const result = [];
  let i = 0;
  for (const date of dates) {
    while (i < sorted.length && sorted[i].date <= date) {
      if (accIds.has(sorted[i].accountId)) lastBalance.set(sorted[i].accountId, sorted[i].balance);
      i += 1;
    }
    let total = 0;
    for (const b of lastBalance.values()) total += b;
    result.push({ date, total });
  }
  return result;
}
