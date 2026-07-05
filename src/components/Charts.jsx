import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
} from 'recharts';
import { fmtCents, fmtMonth } from '../utils/format.js';

// Gedeckte Palette passend zum Dark Theme
export const CHART_COLORS = ['#7fd88f', '#6fa8dc', '#d8b45f', '#e0685f', '#b48ead', '#8fbcbb', '#d08770', '#a3be8c'];
const AXIS = { stroke: 'rgba(236,235,231,0.35)', fontSize: 11 };
const GRID = 'rgba(255,255,255,0.06)';
const TOOLTIP_STYLE = {
  backgroundColor: '#17181d',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  color: '#ecebe7',
  fontSize: 12,
};

const centsTick = (v) => `${Math.round(v / 100)} €`;
const shortMonth = (key) => {
  const [y, m] = key.split('-');
  return `${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][Number(m) - 1]} ${y.slice(2)}`;
};

/** Einnahmen vs. Ausgaben, letzte n Monate. data: [{key, income, expense}] */
export function IncomeExpenseBars({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="key" tickFormatter={shortMonth} {...AXIS} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={centsTick} {...AXIS} tickLine={false} axisLine={false} width={54} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v, name) => [fmtCents(v), name === 'income' ? 'Einnahmen' : 'Ausgaben']}
          labelFormatter={fmtMonth}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        <Bar dataKey="income" fill="#7fd88f" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="expense" fill="#e0685f" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Kategorie-Donut eines Monats. data: [{name, value, icon}] */
export function CategoryDonut({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [fmtCents(v), name]} />
        <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(236,235,231,0.7)' }} iconSize={9} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Ausgaben-Trend über 12 Monate. data: [{key, expense}] */
export function ExpenseTrendLine({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="key" tickFormatter={shortMonth} {...AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tickFormatter={centsTick} {...AXIS} tickLine={false} axisLine={false} width={54} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => [fmtCents(v), 'Ausgaben']}
          labelFormatter={fmtMonth}
        />
        <Line type="monotone" dataKey="expense" stroke="#d8b45f" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
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
