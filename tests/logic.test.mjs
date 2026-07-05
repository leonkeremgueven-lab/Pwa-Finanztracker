import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueDatesBetween, buildDueTransactions, runRecurringEngine, monthlyFixedCosts, recurringTxId } from '../src/logic/recurring.js';
import { extractTotal, parseAmountToCents } from '../src/logic/receiptParse.js';
import { monthTotals, savingsRate, budgetStatus, expensesByCategory, goalForecast, netWorth, netWorthHistory } from '../src/logic/stats.js';
import { buildMonthReport, reportableMonths } from '../src/logic/report.js';

// ---------- Recurring-Engine ----------

test('monatliche Regel: Catch-up über 3 Monate erzeugt exakt 3 Instanzen', () => {
  const rule = {
    id: 'r1', name: 'Miete', amount: 90000, type: 'expense', categoryId: 'cat-wohnen',
    interval: 'monthly', anchorDate: '2026-01-15', lastProcessed: '2026-04-15',
  };
  const txs = buildDueTransactions(rule, '2026-07-20');
  assert.equal(txs.length, 3);
  assert.deepEqual(txs.map((t) => t.date), ['2026-05-15', '2026-06-15', '2026-07-15']);
});

test('idempotent: zweiter Lauf erzeugt keine Duplikate', () => {
  const rule = {
    id: 'r1', name: 'Miete', amount: 90000, type: 'expense', categoryId: 'cat-wohnen',
    interval: 'monthly', anchorDate: '2026-01-15', lastProcessed: '',
  };
  const first = buildDueTransactions(rule, '2026-03-20');
  const existingIds = new Set(first.map((t) => t.id));
  const second = buildDueTransactions(rule, '2026-03-20', existingIds);
  assert.equal(first.length, 3); // Jan, Feb, Mär
  assert.equal(second.length, 0);
});

test('deterministische IDs deduplizieren über recurringId+Datum', () => {
  assert.equal(recurringTxId('abc', '2026-02-01'), 'rec-abc-2026-02-01');
});

test('Monatsende wird geklemmt (31. -> 28.02.)', () => {
  const rule = { id: 'r2', interval: 'monthly', anchorDate: '2026-01-31', lastProcessed: '2026-01-31' };
  const due = dueDatesBetween(rule, '2026-01-31', '2026-03-31');
  assert.deepEqual(due, ['2026-02-28', '2026-03-31']);
});

test('wöchentlich & jährlich & endDate', () => {
  const weekly = dueDatesBetween({ interval: 'weekly', anchorDate: '2026-06-01' }, '2026-06-14', '2026-06-30');
  assert.deepEqual(weekly, ['2026-06-15', '2026-06-22', '2026-06-29']);
  const yearly = dueDatesBetween({ interval: 'yearly', anchorDate: '2024-03-10' }, null, '2026-07-05');
  assert.deepEqual(yearly, ['2024-03-10', '2025-03-10', '2026-03-10']);
  const ended = dueDatesBetween({ interval: 'monthly', anchorDate: '2026-01-01', endDate: '2026-02-15' }, null, '2026-07-05');
  assert.deepEqual(ended, ['2026-01-01', '2026-02-01']);
});

test('Engine gegen Fake-Repo: 3-Monats-Catch-up, zweiter Lauf bucht nichts', async () => {
  const store = { recurring: [{
    id: 'r1', name: 'Netflix', amount: 1299, type: 'expense', categoryId: 'cat-abos',
    interval: 'monthly', anchorDate: '2026-04-05', lastProcessed: '2026-04-05',
  }], transactions: [], meta: {} };
  const repo = {
    listRecurring: async () => store.recurring,
    listTransactions: async () => store.transactions,
    saveTransaction: async (t) => { store.transactions.push(t); },
    saveRecurring: async (r) => { store.recurring = store.recurring.map((x) => (x.id === r.id ? r : x)); },
    setMeta: async (k, v) => { store.meta[k] = v; },
  };
  const booked = await runRecurringEngine(repo, '2026-07-05');
  assert.equal(booked, 3);
  assert.deepEqual(store.transactions.map((t) => t.date), ['2026-05-05', '2026-06-05', '2026-07-05']);
  const again = await runRecurringEngine(repo, '2026-07-05');
  assert.equal(again, 0);
  assert.equal(store.transactions.length, 3);
});

test('Fixkosten: monatlich + wöchentlich + jährlich normalisiert', () => {
  const rules = [
    { type: 'expense', interval: 'monthly', amount: 1000 },
    { type: 'expense', interval: 'weekly', amount: 1200 }, // *52/12 = 5200
    { type: 'expense', interval: 'yearly', amount: 12000 }, // /12 = 1000
    { type: 'income', interval: 'monthly', amount: 99999 }, // zählt nicht
    { type: 'expense', interval: 'monthly', amount: 500, endDate: '2020-01-01' }, // beendet
  ];
  assert.equal(monthlyFixedCosts(rules, '2026-07-05'), 1000 + 5200 + 1000);
});

// ---------- Beleg-Heuristik (5 Test-Strings laut Spezifikation) ----------

test('Bon mit SUMME-Keyword', () => {
  const r = extractTotal('REWE\nBanane 1,99\nMilch 0,89\nSUMME 23,47\nEC 23,47');
  assert.equal(r.amount, 2347);
  assert.equal(r.confidence, 'high');
});

test('Bon mit OCR-Verschreiber 5UMME', () => {
  const r = extractTotal('Kiosk\nCola 2,50\n5UMME 12,90');
  assert.equal(r.amount, 1290);
  assert.equal(r.confidence, 'high');
});

test('Bon ohne Keyword -> größter Betrag, low confidence', () => {
  const r = extractTotal('Position A 4,20\nPosition B 17,80\nPosition C 3,10');
  assert.equal(r.amount, 1780);
  assert.equal(r.confidence, 'low');
});

test('Bon ohne Betrag -> leerer Zustand', () => {
  const r = extractTotal('Vielen Dank für Ihren Einkauf');
  assert.equal(r.amount, null);
  assert.equal(r.confidence, 'none');
});

test('US-Format 12.99 wird erkannt', () => {
  const r = extractTotal('TOTAL 12.99');
  assert.equal(r.amount, 1299);
  assert.equal(r.confidence, 'high');
});

test('parseAmountToCents: Komma und Punkt', () => {
  assert.equal(parseAmountToCents('3,50'), 350);
  assert.equal(parseAmountToCents('1234.56'), 123456);
  assert.equal(parseAmountToCents('quatsch'), null);
});

// ---------- Stats & Budgets ----------

const TXS = [
  { id: '1', type: 'income', amount: 250000, categoryId: 'cat-gehalt', date: '2026-06-01' },
  { id: '2', type: 'expense', amount: 90000, categoryId: 'cat-wohnen', date: '2026-06-03' },
  { id: '3', type: 'expense', amount: 25000, categoryId: 'cat-essen', date: '2026-06-10' },
  { id: '4', type: 'expense', amount: 8000, categoryId: 'cat-essen', date: '2026-06-15' },
  { id: '5', type: 'goal_deposit', amount: 20000, goalId: 'g1', categoryId: 'cat-sonstiges', date: '2026-06-20' },
  { id: '6', type: 'expense', amount: 5000, categoryId: 'cat-freizeit', date: '2026-05-10' },
  { id: '7', type: 'income', amount: 240000, categoryId: 'cat-gehalt', date: '2026-05-01' },
];

test('Monatssummen: manuell gegengerechnet', () => {
  const t = monthTotals(TXS, '2026-06');
  assert.equal(t.income, 250000);
  assert.equal(t.expense, 123000); // 900+250+80 €
  assert.equal(t.goalDeposits, 20000);
  assert.equal(t.balance, 250000 - 123000 - 20000); // 107000
});

test('Sparquote', () => {
  assert.equal(savingsRate({ income: 250000, expense: 123000 }), 51); // (2500-1230)/2500 = 50,8 -> 51
  assert.equal(savingsRate({ income: 0, expense: 10 }), null);
});

test('Budget-Level: ok / warn (>80 %) / over (>100 %)', () => {
  const budgets = [
    { id: 'b1', categoryId: 'cat-essen', monthlyLimit: 40000 },   // 330/400 = 82,5 % -> warn
    { id: 'b2', categoryId: 'cat-wohnen', monthlyLimit: 80000 },  // 900/800 -> over
    { id: 'b3', categoryId: 'cat-freizeit', monthlyLimit: 10000 },// 0 % -> ok
  ];
  const [essen, wohnen, freizeit] = budgetStatus(budgets, TXS, '2026-06');
  assert.equal(essen.level, 'warn');
  assert.equal(wohnen.level, 'over');
  assert.equal(freizeit.level, 'ok');
  assert.equal(essen.used, 33000);
  assert.equal(wohnen.remaining, -10000);
});

test('Kategorien-Ranking', () => {
  const r = expensesByCategory(TXS, '2026-06');
  assert.deepEqual(r.map((x) => x.categoryId), ['cat-wohnen', 'cat-essen']);
});

test('Zielprognose: lineares Tempo aus 3 Monaten', () => {
  const goal = { id: 'g1', targetAmount: 120000 };
  const now = new Date(2026, 5, 30); // 30.06.2026
  const txs = [
    { type: 'goal_deposit', goalId: 'g1', amount: 20000, date: '2026-06-20' },
    { type: 'goal_deposit', goalId: 'g1', amount: 10000, date: '2026-05-15' },
  ];
  // gespart 300 €, fehlen 900 €, Tempo (200+100)/3 = 100 €/Monat -> 9 Monate
  const f = goalForecast(goal, txs, now);
  assert.equal(f.done, false);
  assert.equal(f.date, '2027-03-30');
});

test('Net Worth: letzter Snapshot je Konto + Verlauf', () => {
  const accounts = [{ id: 'a1', kind: 'giro' }, { id: 'a2', kind: 'depot' }];
  const snaps = [
    { id: 's1', accountId: 'a1', balance: 100000, date: '2026-05-01' },
    { id: 's2', accountId: 'a1', balance: 120000, date: '2026-06-01' },
    { id: 's3', accountId: 'a2', balance: 500000, date: '2026-05-15' },
  ];
  const nw = netWorth(accounts, snaps);
  assert.equal(nw.total, 620000);
  assert.deepEqual(nw.byKind, { giro: 120000, depot: 500000 });
  const hist = netWorthHistory(accounts, snaps);
  assert.deepEqual(hist, [
    { date: '2026-05-01', total: 100000 },
    { date: '2026-05-15', total: 600000 },
    { date: '2026-06-01', total: 620000 },
  ]);
});

// ---------- Monatsabschluss-Report ----------

test('Report Juni 2026: Summen, Top-Kategorien, größte Ausgabe, Budget-Bilanz, Delta', () => {
  const categories = [
    { id: 'cat-wohnen', name: 'Wohnen', icon: '🏠' },
    { id: 'cat-essen', name: 'Essen', icon: '🍽️' },
    { id: 'cat-freizeit', name: 'Freizeit', icon: '🎳' },
    { id: 'cat-gehalt', name: 'Gehalt', icon: '💼' },
    { id: 'cat-sonstiges', name: 'Sonstiges', icon: '📦' },
  ];
  const budgets = [{ id: 'b1', categoryId: 'cat-essen', monthlyLimit: 40000 }];
  const r = buildMonthReport('2026-06', TXS, budgets, categories);
  assert.equal(r.totals.income, 250000);
  assert.equal(r.totals.expense, 123000);
  assert.equal(r.savingsRate, 51);
  assert.deepEqual(r.topCategories.map((c) => c.name), ['Wohnen', 'Essen']);
  assert.equal(r.biggestExpense.amount, 90000);
  assert.equal(r.biggestExpense.categoryName, 'Wohnen');
  assert.equal(r.budgets[0].kept, true);
  assert.equal(r.delta.income, 250000 - 240000);
  assert.equal(r.delta.expense, 123000 - 5000);
  assert.equal(buildMonthReport('2020-01', TXS, budgets, categories), null);
});

test('Report-Archiv: nur vergangene Monate mit Buchungen', () => {
  assert.deepEqual(reportableMonths(TXS, '2026-07'), ['2026-06', '2026-05']);
  assert.deepEqual(reportableMonths(TXS, '2026-06'), ['2026-05']);
});
