import { getDb, uid, STORES, SCHEMA_VERSION } from './db.js';

// ---- generische Helfer -----------------------------------------------------

async function getAll(store) {
  const db = await getDb();
  return db.getAll(store);
}

async function put(store, value) {
  const db = await getDb();
  await db.put(store, value);
  return value;
}

async function remove(store, id) {
  const db = await getDb();
  await db.delete(store, id);
}

// ---- Transaktionen ---------------------------------------------------------

export async function listTransactions() {
  const all = await getAll('transactions');
  return all.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)));
}

export async function saveTransaction(tx) {
  const value = { ...tx, id: tx.id ?? uid(), createdAt: tx.createdAt ?? Date.now() };
  return put('transactions', value);
}

export async function deleteTransaction(id) {
  const db = await getDb();
  const tx = await db.get('transactions', id);
  await db.delete('transactions', id);
  return tx; // für Undo
}

export async function restoreTransaction(tx) {
  return put('transactions', tx);
}

// ---- Kategorien ------------------------------------------------------------

export async function listCategories() {
  const all = await getAll('categories');
  return all.sort((a, b) => a.sortOrder - b.sortOrder);
}
export const saveCategory = (c) => put('categories', { ...c, id: c.id ?? uid() });
export const deleteCategory = (id) => remove('categories', id);

// ---- Budgets ---------------------------------------------------------------

export const listBudgets = () => getAll('budgets');
export const saveBudget = (b) => put('budgets', { ...b, id: b.id ?? uid() });
export const deleteBudget = (id) => remove('budgets', id);

// ---- Ziele -----------------------------------------------------------------

export const listGoals = () => getAll('goals');
export const saveGoal = (g) => put('goals', { ...g, id: g.id ?? uid(), createdAt: g.createdAt ?? Date.now() });
export const deleteGoal = (id) => remove('goals', id);

// ---- Wiederkehrende Buchungen ----------------------------------------------

export const listRecurring = () => getAll('recurring');
export const saveRecurring = (r) => put('recurring', { ...r, id: r.id ?? uid() });
export const deleteRecurring = (id) => remove('recurring', id);

// ---- Vorlagen ----------------------------------------------------------------

export async function listTemplates() {
  const all = await getAll('templates');
  return all.sort((a, b) => a.sortOrder - b.sortOrder);
}
export const saveTemplate = (t) => put('templates', { ...t, id: t.id ?? uid() });
export const deleteTemplate = (id) => remove('templates', id);

// ---- Konten & Snapshots -------------------------------------------------------

export const listAccounts = () => getAll('accounts');
export const saveAccount = (a) => put('accounts', { ...a, id: a.id ?? uid() });

export async function deleteAccount(id) {
  const db = await getDb();
  const tx = db.transaction(['accounts', 'snapshots'], 'readwrite');
  tx.objectStore('accounts').delete(id);
  let cursor = await tx.objectStore('snapshots').index('byAccount').openCursor(id);
  while (cursor) {
    cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export const listSnapshots = () => getAll('snapshots');
export const saveSnapshot = (s) => put('snapshots', { ...s, id: s.id ?? uid() });

// ---- Meta --------------------------------------------------------------------

export async function getMeta(key) {
  const db = await getDb();
  const row = await db.get('meta', key);
  return row?.value;
}

export async function setMeta(key, value) {
  return put('meta', { key, value });
}

// ---- Export / Import ---------------------------------------------------------

const DATA_STORES = STORES.filter((s) => s !== 'meta');

export async function exportAll() {
  const db = await getDb();
  const data = { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
  for (const store of DATA_STORES) data[store] = await db.getAll(store);
  const meta = await db.getAll('meta');
  data.meta = meta.filter((m) => m.key !== 'schemaVersion');
  return data;
}

/** Validiert ein Backup-Objekt. Wirft Error mit verständlicher Meldung. */
export function validateBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Die Datei enthält kein gültiges Backup-Objekt.');
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Nicht unterstützte Schema-Version (${data.schemaVersion ?? 'fehlt'}). Erwartet: ${SCHEMA_VERSION}.`);
  }
  for (const store of DATA_STORES) {
    if (data[store] !== undefined && !Array.isArray(data[store])) {
      throw new Error(`Feld "${store}" ist keine Liste.`);
    }
  }
  for (const t of data.transactions ?? []) {
    if (typeof t.id !== 'string' || !Number.isInteger(t.amount) || typeof t.date !== 'string') {
      throw new Error('Mindestens eine Transaktion ist ungültig (id/amount/date).');
    }
    if (!['expense', 'income', 'goal_deposit'].includes(t.type)) {
      throw new Error(`Unbekannter Transaktionstyp "${t.type}".`);
    }
  }
  for (const c of data.categories ?? []) {
    if (typeof c.id !== 'string' || typeof c.name !== 'string') {
      throw new Error('Mindestens eine Kategorie ist ungültig.');
    }
  }
  return {
    transactions: (data.transactions ?? []).length,
    categories: (data.categories ?? []).length,
    budgets: (data.budgets ?? []).length,
    goals: (data.goals ?? []).length,
    recurring: (data.recurring ?? []).length,
    templates: (data.templates ?? []).length,
    accounts: (data.accounts ?? []).length,
    snapshots: (data.snapshots ?? []).length,
  };
}

/** Ersetzt alle Daten atomar (eine einzige readwrite-Transaktion). */
export async function importAll(data) {
  validateBackup(data);
  const db = await getDb();
  const tx = db.transaction(STORES, 'readwrite');
  for (const store of DATA_STORES) {
    tx.objectStore(store).clear();
    for (const row of data[store] ?? []) tx.objectStore(store).put(row);
  }
  tx.objectStore('meta').clear();
  tx.objectStore('meta').put({ key: 'schemaVersion', value: SCHEMA_VERSION });
  for (const m of data.meta ?? []) {
    if (m.key !== 'schemaVersion') tx.objectStore('meta').put(m);
  }
  await tx.done;
}
