import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as repo from './db/repo.js';
import { runRecurringEngine } from './logic/recurring.js';
import TabBar, { TABS } from './components/TabBar.jsx';
import QuickAdd from './components/QuickAdd.jsx';
import ReceiptScanner from './components/ReceiptScanner.jsx';
import Home from './components/Home.jsx';
import History from './components/History.jsx';
import BudgetsGoals from './components/BudgetsGoals.jsx';
import Analytics from './components/Analytics.jsx';
import More from './components/More.jsx';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export default function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    transactions: [],
    categories: [],
    budgets: [],
    goals: [],
    recurring: [],
    templates: [],
    accounts: [],
    snapshots: [],
  });
  const [activeTab, setActiveTab] = useState('home');
  const [moreSection, setMoreSection] = useState(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState(null); // vorbefüllter Betrag aus dem Scanner
  const [editTx, setEditTx] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const toast = useCallback((message, { error = false, action = null, actionLabel = '', duration = 3500 } = {}) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, error, action, actionLabel }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  const reload = useCallback(async () => {
    try {
      const [transactions, categories, budgets, goals, recurring, templates, accounts, snapshots] =
        await Promise.all([
          repo.listTransactions(),
          repo.listCategories(),
          repo.listBudgets(),
          repo.listGoals(),
          repo.listRecurring(),
          repo.listTemplates(),
          repo.listAccounts(),
          repo.listSnapshots(),
        ]);
      setData({ transactions, categories, budgets, goals, recurring, templates, accounts, snapshots });
    } catch (err) {
      console.error('Daten konnten nicht geladen werden', err);
      toast('Daten konnten nicht geladen werden — bitte App neu öffnen.', { error: true });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    (async () => {
      try {
        const booked = await runRecurringEngine(repo);
        if (booked > 0) toast(`${booked} wiederkehrende Buchung${booked > 1 ? 'en' : ''} verbucht.`);
      } catch (err) {
        console.error('Recurring-Engine fehlgeschlagen', err);
      }
      await reload();
    })();
  }, [reload, toast]);

  const openQuickAdd = useCallback((prefill = null) => {
    setScanResult(prefill);
    setEditTx(null);
    setQuickAddOpen(true);
  }, []);

  const openEdit = useCallback((tx) => {
    setScanResult(null);
    setEditTx(tx);
    setQuickAddOpen(true);
  }, []);

  const ctx = {
    ...data,
    loading,
    reload,
    toast,
    repo,
    openQuickAdd,
    openEdit,
    openScanner: () => setScannerOpen(true),
    setActiveTab,
    openMore: (section) => {
      setMoreSection(section);
      setActiveTab('more');
    },
  };

  return (
    <AppContext.Provider value={ctx}>
      <div className="app-shell">
        {activeTab === 'home' && <Home />}
        {activeTab === 'history' && <History />}
        {activeTab === 'budgets' && <BudgetsGoals />}
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'more' && <More key={moreSection ?? 'menu'} initialSection={moreSection} />}
      </div>

      <div className="fab-wrap">
        <button
          className="fab-secondary"
          aria-label="Beleg scannen"
          title="Beleg scannen"
          onClick={() => setScannerOpen(true)}
        >
          📷
        </button>
        <button className="fab" aria-label="Buchung hinzufügen" onClick={() => openQuickAdd()}>
          +
        </button>
      </div>

      <TabBar
        tabs={TABS}
        active={activeTab}
        onChange={(tab) => {
          setMoreSection(null);
          setActiveTab(tab);
        }}
      />

      {quickAddOpen && (
        <QuickAdd
          prefill={scanResult}
          editTx={editTx}
          onClose={() => {
            setQuickAddOpen(false);
            setScanResult(null);
            setEditTx(null);
          }}
        />
      )}

      {scannerOpen && (
        <ReceiptScanner
          onClose={() => setScannerOpen(false)}
          onResult={(result) => {
            setScannerOpen(false);
            openQuickAdd(result);
          }}
        />
      )}

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.error ? ' error' : ''}`}>
            <span>{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action();
                  setToasts((list) => list.filter((x) => x.id !== t.id));
                }}
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
