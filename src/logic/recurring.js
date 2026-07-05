// Recurring-Engine: erkennt fällige Instanzen wiederkehrender Buchungen und
// verbucht sie als Transaktionen. Idempotent über deterministische IDs
// (`rec-<recurringId>-<dueDate>`), sodass ein erneuter Lauf nie doppelt bucht.

/** ISO-Datum (yyyy-mm-dd) aus einem Date in Lokalzeit. */
export function toIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Tag eines Monats, geklemmt auf die Monatslänge (31. -> 28./30.). */
function clampedDate(year, monthIndex, day) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

/**
 * Alle Fälligkeitsdaten einer Regel im Bereich (after, today] — chronologisch.
 * anchorDate ist die erste Fälligkeit. after = lastProcessed (exklusiv).
 */
export function dueDatesBetween(rule, afterIso, todayIso) {
  const anchor = parseIso(rule.anchorDate);
  const today = parseIso(todayIso);
  const end = rule.endDate ? parseIso(rule.endDate) : null;
  const after = afterIso ? parseIso(afterIso) : null;
  const dates = [];

  if (rule.interval === 'weekly') {
    for (let d = new Date(anchor); d <= today; d.setDate(d.getDate() + 7)) {
      if (end && d > end) break;
      if (!after || d > after) dates.push(toIso(d));
    }
  } else if (rule.interval === 'monthly') {
    const day = anchor.getDate();
    for (let y = anchor.getFullYear(), m = anchor.getMonth(); ; ) {
      const d = clampedDate(y, m, day);
      if (d > today || (end && d > end)) break;
      if (d >= anchor && (!after || d > after)) dates.push(toIso(d));
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
  } else if (rule.interval === 'yearly') {
    for (let y = anchor.getFullYear(); ; y += 1) {
      const d = clampedDate(y, anchor.getMonth(), anchor.getDate());
      if (d > today || (end && d > end)) break;
      if (d >= anchor && (!after || d > after)) dates.push(toIso(d));
    }
  }
  return dates;
}

/** Deterministische Transaktions-ID: garantiert Dedupe pro (Regel, Fälligkeit). */
export function recurringTxId(recurringId, dueDate) {
  return `rec-${recurringId}-${dueDate}`;
}

/**
 * Baut die zu verbuchenden Transaktionen für eine Regel.
 * `existingIds` (Set) verhindert Doppelbuchungen zusätzlich zur ID-Kollision.
 */
export function buildDueTransactions(rule, todayIso, existingIds = new Set()) {
  const due = dueDatesBetween(rule, rule.lastProcessed || null, todayIso);
  return due
    .map((date) => ({
      id: recurringTxId(rule.id, date),
      type: rule.type,
      amount: rule.amount,
      categoryId: rule.categoryId,
      note: rule.name,
      date,
      recurringId: rule.id,
      createdAt: Date.now(),
    }))
    .filter((t) => !existingIds.has(t.id));
}

/**
 * Führt die Engine gegen die DB aus. Defensiv: Fehler einer Regel werden
 * geloggt und übersprungen, der App-Start wird nie blockiert.
 * Gibt die Anzahl neu verbuchter Transaktionen zurück.
 */
export async function runRecurringEngine(repo, todayIso = toIso(new Date())) {
  let booked = 0;
  let rules = [];
  try {
    rules = await repo.listRecurring();
  } catch (err) {
    console.error('Recurring-Engine: Regeln konnten nicht geladen werden', err);
    return 0;
  }
  for (const rule of rules) {
    try {
      const existing = await repo.listTransactions();
      const existingIds = new Set(existing.map((t) => t.id));
      const txs = buildDueTransactions(rule, todayIso, existingIds);
      for (const tx of txs) {
        await repo.saveTransaction(tx);
        booked += 1;
      }
      const lastDue = dueDatesBetween(rule, null, todayIso).at(-1);
      const newLast = lastDue && lastDue > (rule.lastProcessed || '') ? lastDue : rule.lastProcessed;
      if (newLast !== rule.lastProcessed) {
        await repo.saveRecurring({ ...rule, lastProcessed: newLast });
      }
    } catch (err) {
      console.error(`Recurring-Engine: Regel "${rule?.name}" übersprungen`, err);
    }
  }
  try {
    await repo.setMeta('lastRecurringRun', todayIso);
  } catch (err) {
    console.error('Recurring-Engine: lastRecurringRun nicht gespeichert', err);
  }
  return booked;
}

/** Monatliche Fixkosten-Summe aller aktiven Ausgaben-Regeln (in Cent). */
export function monthlyFixedCosts(rules, todayIso = toIso(new Date())) {
  return rules
    .filter((r) => r.type === 'expense')
    .filter((r) => !r.endDate || r.endDate >= todayIso)
    .reduce((sum, r) => {
      if (r.interval === 'monthly') return sum + r.amount;
      if (r.interval === 'weekly') return sum + Math.round((r.amount * 52) / 12);
      if (r.interval === 'yearly') return sum + Math.round(r.amount / 12);
      return sum;
    }, 0);
}
