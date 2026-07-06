import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend, ReferenceLine,
} from 'recharts';
import { fmtCents, fmtMonth } from '../utils/format.js';
import { isoWeekNumber } from '../logic/stats.js';

// Kategorische Palette, validiert für die dunkle Kartenfläche (#17181d):
// Lightness-Band, Chroma-Floor, CVD-Abstand und Kontrast ≥ 3:1 geprüft.
// Farben hängen fest an der Kategorie (Index in der Kategorienliste),
// nie an der Position im gefilterten Ergebnis.
export const CHART_COLORS = ['#38a854', '#4f8fd9', '#c08a0c', '#d95f55', '#2fa8a0', '#9a7fe0', '#cf7a3a', '#c95f93'];
export const INCOME_COLOR = '#38a854';
export const EXPENSE_COLOR = '#d95f55';

export function colorForIndex(i) {
  return CHART_COLORS[i % CHART_COLORS.length];
}

const AXIS = { stroke: 'rgba(236,235,231,0.35)', fontSize: 11 };
const GRID = 'rgba(255,255,255,0.06)';
const TOOLTIP_STYLE = {
  backgroundColor: '#17181d',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  color: '#ecebe7',
  fontSize: 12,
};
const LEGEND_STYLE = { fontSize: 11, color: 'rgba(236,235,231,0.7)' };

const centsTick = (v) => `${Math.round(v / 100)} €`;
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// Die Formatter erkennen das Schlüsselformat selbst ('2026' | '2026-07' |
// '2026-06-29'), statt der Granularität zu vertrauen: beim Umschalten hält
// der Recharts-Tooltip kurz noch den alten Schlüssel — das darf nie crashen.
export function periodTickLabel(key) {
  const k = String(key);
  if (/^\d{4}$/.test(k)) return k;
  if (/^\d{4}-\d{2}-\d{2}$/.test(k)) return `KW ${isoWeekNumber(k)}`;
  if (/^\d{4}-\d{2}$/.test(k)) {
    const [y, m] = k.split('-');
    return `${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}`;
  }
  return k;
}

export function periodFullLabel(key) {
  const k = String(key);
  if (/^\d{4}$/.test(k)) return k;
  if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
    const [y, m, d] = k.split('-');
    return `KW ${isoWeekNumber(k)} (ab ${d}.${m}.${y})`;
  }
  if (/^\d{4}-\d{2}$/.test(k)) return fmtMonth(k);
  return k;
}

/** Einnahmen vs. Ausgaben je Periode, mit gestrichelter Ausgaben-Durchschnittslinie. */
export function PeriodBars({ data, granularity, showIncome = true }) {
  const withExpense = data.filter((d) => d.expense > 0);
  const avg = withExpense.length
    ? Math.round(withExpense.reduce((s, d) => s + d.expense, 0) / withExpense.length)
    : 0;
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="key"
          tickFormatter={periodTickLabel}
          {...AXIS}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tickFormatter={centsTick} {...AXIS} tickLine={false} axisLine={false} width={54} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v, name) => [fmtCents(v), name === 'income' ? 'Einnahmen' : 'Ausgaben']}
          labelFormatter={periodFullLabel}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        {showIncome && (
          <Legend
            wrapperStyle={LEGEND_STYLE}
            iconSize={9}
            formatter={(v) => (v === 'income' ? 'Einnahmen' : 'Ausgaben')}
          />
        )}
        {showIncome && <Bar dataKey="income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={18} />}
        <Bar dataKey="expense" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={18} />
        {avg > 0 && (
          <ReferenceLine
            y={avg}
            stroke="rgba(236,235,231,0.45)"
            strokeDasharray="5 4"
            label={{ value: `Ø ${Math.round(avg / 100)} €`, position: 'insideTopRight', fill: 'rgba(236,235,231,0.6)', fontSize: 10 }}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Kategorie-Donut: data = [{name, value, color}] — Farbe kommt vom Aufrufer (entitätsstabil). */
export function CategoryDonut({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="#17181d" strokeWidth={2}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [fmtCents(v), name]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Ausgaben-Trend je Kategorie über Monate. series = [{id, name, color}] */
export function CategoryTrendLines({ data, series }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="key"
          tickFormatter={periodTickLabel}
          {...AXIS}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tickFormatter={centsTick} {...AXIS} tickLine={false} axisLine={false} width={54} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v, name) => [fmtCents(v), series.find((s) => s.id === name)?.name ?? name]}
          labelFormatter={periodFullLabel}
        />
        <Legend wrapperStyle={LEGEND_STYLE} iconSize={9} formatter={(id) => series.find((s) => s.id === id)?.name ?? id} />
        {series.map((s) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Sparquote pro Monat in % — positive Balken grün, negative rot. */
export function SavingsRateBars({ data }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="key"
          tickFormatter={periodTickLabel}
          {...AXIS}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tickFormatter={(v) => `${v} %`} {...AXIS} tickLine={false} axisLine={false} width={50} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => [`${v} %`, 'Sparquote']}
          labelFormatter={periodFullLabel}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        <ReferenceLine y={0} stroke="rgba(236,235,231,0.3)" />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={22}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.rate >= 0 ? INCOME_COLOR : EXPENSE_COLOR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Net-Worth-Verlauf als Flächenchart. data: [{date, total}] */
export function NetWorthArea({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7fd88f" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#7fd88f" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" {...AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tickFormatter={centsTick} {...AXIS} tickLine={false} axisLine={false} width={60} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [fmtCents(v), 'Net Worth']} />
        <Area type="monotone" dataKey="total" stroke="#7fd88f" strokeWidth={2} fill="url(#nwFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
