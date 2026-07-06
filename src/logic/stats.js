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

// ---- Perioden-Analyse (Woche / Monat / Jahr) --------------------------------

/** Montag der Woche eines ISO-Datums, als ISO-Datum. */
export function weekStartIso(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = (dt.getDay() + 6) % 7; // Mo=0 … So=6
  dt.setDate(dt.getDate() - dow);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** ISO-Kalenderwoche (1–53) eines ISO-Datums. */
export function isoWeekNumber(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3); // Donnerstag der Woche
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((dt - firstThursday) / (7 * 24 * 3600 * 1000));
}

/** Bucket-Schlüssel einer Transaktion je Granularität. */
export function periodKeyOf(isoDate, granularity) {
  if (granularity === 'week') return weekStartIso(isoDate);
  if (granularity === 'year') return isoDate.slice(0, 4);
  return isoDate.slice(0, 7);
}

/** Die letzten n Perioden-Schlüssel, älteste zuerst, inkl. laufender Periode. */
export function lastPeriodKeys(n, granularity, now = new Date()) {
  if (granularity === 'month') return lastMonths(n, now);
  if (granularity === 'year') {
    const y = now.getFullYear();
    return Array.from({ length: n }, (_, i) => String(y - (n - 1 - i)));
  }
  const start = weekStartIso(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  );
  const [y, m, d] = start.split('-').map(Number);
  const keys = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const dt = new Date(y, m - 1, d - i * 7);
    keys.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`);
  }
  return keys;
}

/**
 * Einnahmen/Ausgaben je Periode für die letzten n Perioden.
 * Optional auf Kategorien eingeschränkt (nur Ausgabenseite).
 */
export function totalsByPeriod(transactions, granularity, n, now = new Date(), categoryIds = null) {
  const keys = lastPeriodKeys(n, granularity, now);
  const buckets = new Map(keys.map((k) => [k, { key: k, income: 0, expense: 0 }]));
  for (const t of transactions) {
    const b = buckets.get(periodKeyOf(t.date, granularity));
    if (!b) continue;
    if (t.type === 'income') b.income += t.amount;
    else if (t.type === 'expense') {
      if (categoryIds && !categoryIds.has(t.categoryId)) continue;
      b.expense += t.amount;
    }
  }
  return keys.map((k) => buckets.get(k));
}

/** Monatliche Ausgaben je Kategorie: [{key, <catId>: cent, …}] für Liniencharts. */
export function categoryMonthlySeries(transactions, categoryIds, months) {
  const rows = months.map((key) => {
    const row = { key };
    for (const id of categoryIds) row[id] = 0;
    return row;
  });
  const idx = new Map(months.map((k, i) => [k, i]));
  for (const t of transactions) {
    if (t.type !== 'expense' || !categoryIds.includes(t.categoryId)) continue;
    const i = idx.get(monthKey(t.date));
    if (i !== undefined) rows[i][t.categoryId] += t.amount;
  }
  return rows;
}

// ---- Trend-Insights ----------------------------------------------------------

function pctChange(current, previous) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Berechnete Kennzahlen für die "Analysten-Abteilung".
 * Jedes Insight: { id, icon, title, text, tone: 'pos'|'neg'|'neutral' } —
 * Einträge ohne ausreichende Datenbasis fehlen einfach.
 */
export function trendInsights(transactions, categories, monthlyFixed, now = new Date()) {
  const insights = [];
  const cur = currentMonthKey(now);
  const prev = shiftMonth(cur, -1);
  const curTotals = monthTotals(transactions, cur);
  const prevTotals = monthTotals(transactions, prev);
  const catName = (id) => {
    const c = categories.find((x) => x.id === id);
    return c ? `${c.icon} ${c.name}` : 'Unbekannt';
  };

  // 1) Monats-Hochrechnung: bisheriges Tagestempo aufs Monatsende projiziert
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = now.getDate();
  if (curTotals.expense > 0 && elapsed >= 3) {
    const projected = Math.round((curTotals.expense / elapsed) * daysInMonth);
    const delta = pctChange(projected, prevTotals.expense);
    insights.push({
      id: 'projection',
      icon: '🔮',
      title: 'Monats-Hochrechnung',
      value: projected,
      text:
        delta === null
          ? `Bei deinem Tempo landest du diesen Monat bei ~PROJ Ausgaben.`
          : `Bei deinem Tempo landest du bei ~PROJ — das wären ${Math.abs(delta)} % ${delta >= 0 ? 'mehr' : 'weniger'} als im Vormonat.`,
      tone: delta === null ? 'neutral' : delta > 5 ? 'neg' : delta < -5 ? 'pos' : 'neutral',
    });
  }

  // 2) 3-Monats-Trend der Ausgaben (volle Monate: Vormonat vs. die 3 davor)
  const last3 = [-1, -2, -3].map((i) => monthTotals(transactions, shiftMonth(cur, i)).expense);
  const prev3 = [-4, -5, -6].map((i) => monthTotals(transactions, shiftMonth(cur, i)).expense);
  const avgLast3 = last3.reduce((a, b) => a + b, 0) / 3;
  const avgPrev3 = prev3.reduce((a, b) => a + b, 0) / 3;
  if (avgPrev3 > 0 && avgLast3 > 0) {
    const delta = pctChange(avgLast3, avgPrev3);
    insights.push({
      id: 'trend3m',
      icon: delta >= 0 ? '📈' : '📉',
      title: '3-Monats-Trend',
      text: `Deine Ausgaben der letzten 3 Monate liegen im Schnitt ${Math.abs(delta)} % ${delta >= 0 ? 'über' : 'unter'} den 3 Monaten davor.`,
      tone: delta > 5 ? 'neg' : delta < -5 ? 'pos' : 'neutral',
    });
  }

  // 3) Größter Kostentreiber & größte Einsparung (Vormonat vs. laufender Monat)
  const curByCat = new Map(expensesByCategory(transactions, cur).map((e) => [e.categoryId, e.amount]));
  const prevByCat = new Map(expensesByCategory(transactions, prev).map((e) => [e.categoryId, e.amount]));
  const allCatIds = new Set([...curByCat.keys(), ...prevByCat.keys()]);
  let mover = null;
  let saver = null;
  for (const id of allCatIds) {
    const diff = (curByCat.get(id) ?? 0) - (prevByCat.get(id) ?? 0);
    if (!mover || diff > mover.diff) mover = { id, diff };
    if (!saver || diff < saver.diff) saver = { id, diff };
  }
  if (mover && mover.diff > 500) {
    insights.push({
      id: 'mover',
      icon: '🚀',
      title: 'Größter Kostentreiber',
      value: mover.diff,
      text: `${catName(mover.id)} kostet dich diesen Monat VAL mehr als im Vormonat.`,
      tone: 'neg',
    });
  }
  if (saver && saver.diff < -500) {
    insights.push({
      id: 'saver',
      icon: '🧊',
      title: 'Größte Einsparung',
      value: -saver.diff,
      text: `Bei ${catName(saver.id)} hast du diesen Monat VAL weniger ausgegeben als im Vormonat.`,
      tone: 'pos',
    });
  }

  // 4) Fixkosten-Quote (feste Ausgaben / Einnahmen des Vormonats)
  const incomeBase = prevTotals.income || curTotals.income;
  if (monthlyFixed > 0 && incomeBase > 0) {
    const quote = Math.round((monthlyFixed / incomeBase) * 100);
    insights.push({
      id: 'fixed',
      icon: '🔒',
      title: 'Fixkosten-Quote',
      text: `${quote} % deiner Einnahmen sind durch feste Kosten gebunden — ${100 - quote} % bleiben flexibel.`,
      tone: quote > 60 ? 'neg' : quote > 45 ? 'neutral' : 'pos',
    });
  }

  // 5) Sparquote: Vormonat vs. Schnitt der 3 Monate davor
  const prevRate = savingsRate(prevTotals);
  const older = [-2, -3, -4].map((i) => savingsRate(monthTotals(transactions, shiftMonth(cur, i)))).filter((r) => r !== null);
  if (prevRate !== null && older.length >= 2) {
    const avgOlder = Math.round(older.reduce((a, b) => a + b, 0) / older.length);
    const diff = prevRate - avgOlder;
    insights.push({
      id: 'savings',
      icon: '🐷',
      title: 'Sparquote-Trend',
      text: `Im Vormonat hast du ${prevRate} % gespart — ${Math.abs(diff)} Prozentpunkte ${diff >= 0 ? 'mehr' : 'weniger'} als dein 3-Monats-Schnitt (${avgOlder} %).`,
      tone: diff >= 0 ? 'pos' : 'neg',
    });
  }

  return insights;
}
