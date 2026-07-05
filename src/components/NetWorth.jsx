import { useMemo, useState } from 'react';
import { useApp } from '../App.jsx';
import { NetWorthArea } from './Charts.jsx';
import { netWorth, netWorthHistory, latestSnapshots } from '../logic/stats.js';
import { fmtCents, toIsoDate, fmtDate } from '../utils/format.js';

const KIND_LABEL = { giro: 'Giro', cash: 'Bargeld', depot: 'Depot', other: 'Sonstiges' };

function eurToCents(str) {
  const v = Number.parseFloat(String(str).replace(',', '.'));
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 100);
}

export default function NetWorth() {
  const { accounts, snapshots, repo, reload, toast } = useApp();
  const [editor, setEditor] = useState(null); // {account} | {account:null} | {snapshotFor}

  const nw = useMemo(() => netWorth(accounts, snapshots), [accounts, snapshots]);
  const history = useMemo(() => netWorthHistory(accounts, snapshots), [accounts, snapshots]);
  const latest = useMemo(() => latestSnapshots(snapshots), [snapshots]);

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <h2>Net Worth</h2>
        <button className="btn" onClick={() => setEditor({ account: null })}>+ Konto</button>
      </div>

      {accounts.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden>🏦</span>
          Lege Konten an (Giro, Bargeld, Depot …) und aktualisiere die Salden per Snapshot, um dein Vermögen zu verfolgen.
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-title">Gesamt</div>
            <div className="num" style={{ fontSize: '1.7rem', fontWeight: 700 }}>{fmtCents(nw.total)}</div>
            <div className="row" style={{ flexWrap: 'wrap', marginTop: 6 }}>
              {Object.entries(nw.byKind).map(([kind, val]) => (
                <span key={kind} className="small muted num">
                  {KIND_LABEL[kind] ?? kind}: {fmtCents(val)}
                </span>
              ))}
            </div>
          </div>

          {history.length > 1 && (
            <div className="card">
              <div className="card-title">Verlauf</div>
              <NetWorthArea data={history} />
            </div>
          )}

          {accounts.map((a) => {
            const snap = latest.get(a.id);
            return (
              <div key={a.id} className="card">
                <div className="row-between">
                  <span>
                    <strong>{a.name}</strong>
                    <div className="small muted">
                      {KIND_LABEL[a.kind] ?? a.kind}
                      {snap ? ` · Stand ${fmtDate(snap.date)}` : ' · noch kein Snapshot'}
                    </div>
                  </span>
                  <span className="row">
                    <span className="num">{snap ? fmtCents(snap.balance) : '—'}</span>
                    <button className="icon-btn" aria-label={`Saldo von ${a.name} aktualisieren`} onClick={() => setEditor({ snapshotFor: a })}>🔄</button>
                    <button className="icon-btn" aria-label={`${a.name} bearbeiten`} onClick={() => setEditor({ account: a })}>✏️</button>
                  </span>
                </div>
              </div>
            );
          })}
        </>
      )}

      {editor && 'account' in editor && <AccountEditor item={editor.account} onClose={() => setEditor(null)} />}
      {editor?.snapshotFor && <SnapshotEditor account={editor.snapshotFor} onClose={() => setEditor(null)} />}
    </div>
  );

  function AccountEditor({ item, onClose }) {
    const [name, setName] = useState(item?.name ?? '');
    const [kind, setKind] = useState(item?.kind ?? 'giro');
    const [balance, setBalance] = useState('');
    const valid = name.trim() && (item || eurToCents(balance) !== null);

    async function save() {
      try {
        const acc = await repo.saveAccount({ id: item?.id, name: name.trim(), kind });
        if (!item) {
          await repo.saveSnapshot({ accountId: acc.id, balance: eurToCents(balance), date: toIsoDate(), createdAt: Date.now() });
        }
        await reload();
        toast('Konto gespeichert.');
        onClose();
      } catch (err) {
        console.error('Konto speichern fehlgeschlagen', err);
        toast('Speichern fehlgeschlagen — bitte erneut versuchen.', { error: true });
      }
    }

    async function remove() {
      try {
        await repo.deleteAccount(item.id);
        await reload();
        toast('Konto samt Verlauf gelöscht.');
        onClose();
      } catch (err) {
        console.error('Konto löschen fehlgeschlagen', err);
        toast('Löschen fehlgeschlagen — bitte erneut versuchen.', { error: true });
      }
    }

    return (
      <>
        <div className="sheet-backdrop" onClick={onClose} />
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Konto">
          <div className="sheet-header">
            <h2>{item ? 'Konto bearbeiten' : 'Neues Konto'}</h2>
            <button className="sheet-close" onClick={onClose} aria-label="Schließen">✕</button>
          </div>
          <div className="form-grid">
            <div>
              <label htmlFor="ae-name">Name</label>
              <input id="ae-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Girokonto" />
            </div>
            <div>
              <label htmlFor="ae-kind">Typ</label>
              <select id="ae-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="giro">Giro</option>
                <option value="cash">Bargeld</option>
                <option value="depot">Depot</option>
                <option value="other">Sonstiges</option>
              </select>
            </div>
            {!item && (
              <div>
                <label htmlFor="ae-balance">Aktueller Saldo (€)</label>
                <input id="ae-balance" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="z. B. 1234,56" />
              </div>
            )}
            <button className="btn btn-primary btn-block" disabled={!valid} onClick={save}>Speichern</button>
            {item && <button className="btn btn-danger btn-block" onClick={remove}>Konto löschen</button>}
          </div>
        </div>
      </>
    );
  }

  function SnapshotEditor({ account, onClose }) {
    const [balance, setBalance] = useState('');
    const [date, setDate] = useState(toIsoDate());
    const cents = eurToCents(balance);
    const valid = cents !== null && /^\d{4}-\d{2}-\d{2}$/.test(date);

    async function save() {
      try {
        await repo.saveSnapshot({ accountId: account.id, balance: cents, date, createdAt: Date.now() });
        await reload();
        toast(`Saldo von ${account.name} aktualisiert.`);
        onClose();
      } catch (err) {
        console.error('Snapshot speichern fehlgeschlagen', err);
        toast('Speichern fehlgeschlagen — bitte erneut versuchen.', { error: true });
      }
    }

    return (
      <>
        <div className="sheet-backdrop" onClick={onClose} />
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Saldo aktualisieren">
          <div className="sheet-header">
            <h2>Saldo: {account.name}</h2>
            <button className="sheet-close" onClick={onClose} aria-label="Schließen">✕</button>
          </div>
          <div className="form-grid">
            <div>
              <label htmlFor="se-balance">Neuer Saldo (€)</label>
              <input id="se-balance" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="z. B. 1234,56" autoFocus />
            </div>
            <div>
              <label htmlFor="se-date">Datum</label>
              <input id="se-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-block" disabled={!valid} onClick={save}>Snapshot speichern</button>
          </div>
        </div>
      </>
    );
  }
}
