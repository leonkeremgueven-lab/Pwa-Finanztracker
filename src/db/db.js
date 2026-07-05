import { openDB } from 'idb';

export const DB_NAME = 'finanz';
export const DB_VERSION = 1;
export const SCHEMA_VERSION = 1;

export const STORES = [
  'transactions',
  'categories',
  'budgets',
  'goals',
  'recurring',
  'templates',
  'accounts',
  'snapshots',
  'meta',
];

export const DEFAULT_CATEGORIES = [
  { id: 'cat-essen', name: 'Essen', icon: '🍽️', type: 'expense', sortOrder: 0 },
  { id: 'cat-wohnen', name: 'Wohnen', icon: '🏠', type: 'expense', sortOrder: 1 },
  { id: 'cat-transport', name: 'Transport', icon: '🚌', type: 'expense', sortOrder: 2 },
  { id: 'cat-freizeit', name: 'Freizeit', icon: '🎳', type: 'expense', sortOrder: 3 },
  { id: 'cat-shopping', name: 'Shopping', icon: '🛍️', type: 'expense', sortOrder: 4 },
  { id: 'cat-gesundheit', name: 'Gesundheit', icon: '💊', type: 'expense', sortOrder: 5 },
  { id: 'cat-abos', name: 'Abos', icon: '🔁', type: 'expense', sortOrder: 6 },
  { id: 'cat-sonstiges', name: 'Sonstiges', icon: '📦', type: 'expense', sortOrder: 7 },
  { id: 'cat-gehalt', name: 'Gehalt', icon: '💼', type: 'income', sortOrder: 8 },
  { id: 'cat-einnahmen', name: 'Sonstige Einnahmen', icon: '💶', type: 'income', sortOrder: 9 },
];

let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const tx = db.createObjectStore('transactions', { keyPath: 'id' });
          tx.createIndex('byDate', 'date');
          tx.createIndex('byRecurring', 'recurringId');
          db.createObjectStore('categories', { keyPath: 'id' });
          const budgets = db.createObjectStore('budgets', { keyPath: 'id' });
          budgets.createIndex('byCategory', 'categoryId', { unique: true });
          db.createObjectStore('goals', { keyPath: 'id' });
          db.createObjectStore('recurring', { keyPath: 'id' });
          db.createObjectStore('templates', { keyPath: 'id' });
          db.createObjectStore('accounts', { keyPath: 'id' });
          const snaps = db.createObjectStore('snapshots', { keyPath: 'id' });
          snaps.createIndex('byAccount', 'accountId');
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    }).then(async (db) => {
      await seedIfEmpty(db);
      return db;
    });
  }
  return dbPromise;
}

async function seedIfEmpty(db) {
  const tx = db.transaction(['categories', 'meta'], 'readwrite');
  const count = await tx.objectStore('categories').count();
  if (count === 0) {
    for (const cat of DEFAULT_CATEGORIES) tx.objectStore('categories').put(cat);
  }
  const version = await tx.objectStore('meta').get('schemaVersion');
  if (!version) tx.objectStore('meta').put({ key: 'schemaVersion', value: SCHEMA_VERSION });
  await tx.done;
}

export function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
