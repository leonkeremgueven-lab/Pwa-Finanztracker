// Formatierung ausschließlich in der UI — intern wird immer in Cent gerechnet.

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const dayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

/** Cent -> "12,34 €" */
export function fmtCents(cents) {
  return eur.format((cents ?? 0) / 100);
}

/** Cent -> "+12,34 €" / "-12,34 €" (Vorzeichen explizit) */
export function fmtSigned(cents) {
  const s = eur.format(Math.abs(cents) / 100);
  return cents < 0 ? `-${s}` : `+${s}`;
}

function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 'yyyy-mm-dd' -> "Mo., 3. Feb." — heute/gestern werden benannt. */
export function fmtDay(iso, now = new Date()) {
  const todayIso = toIsoDate(now);
  if (iso === todayIso) return 'Heute';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (iso === toIsoDate(yesterday)) return 'Gestern';
  return dayFmt.format(parseLocalDate(iso));
}

/** 'yyyy-mm-dd' -> "03.02.2026" */
export function fmtDate(iso) {
  return dateFmt.format(parseLocalDate(iso));
}

/** 'yyyy-mm' -> "Februar 2026" */
export function fmtMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return monthFmt.format(new Date(y, m - 1, 1));
}

export function toIsoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Tage bis Monatsende (inkl. heute). */
export function daysLeftInMonth(now = new Date()) {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return last - now.getDate() + 1;
}
