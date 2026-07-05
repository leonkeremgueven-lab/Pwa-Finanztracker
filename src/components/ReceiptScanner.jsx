import { useEffect, useRef, useState } from 'react';
import { recognizeReceipt } from '../logic/ocr.js';
import { extractTotal } from '../logic/receiptParse.js';

// Kamera-Aufnahme via file-input (robusteste Lösung auf Android-PWAs),
// Offline-OCR, Betrags-Heuristik. Das Ergebnis wird an QuickAdd übergeben —
// der Nutzer bestätigt dort immer selbst. Das Foto wird nie gespeichert.
export default function ReceiptScanner({ onClose, onResult }) {
  const inputRef = useRef(null);
  const tokenRef = useRef({ cancelled: false });
  const [state, setState] = useState('idle'); // idle | working | error
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = tokenRef.current;
    return () => {
      token.cancelled = true;
    };
  }, []);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // Input leeren — keine Referenz aufs Foto behalten
    if (!file) return;

    setState('working');
    setProgress(0);
    tokenRef.current = { cancelled: false };

    try {
      const text = await recognizeReceipt(
        file,
        (pct, lbl) => {
          setProgress(pct);
          setLabel(lbl);
        },
        tokenRef.current
      );
      if (tokenRef.current.cancelled) return;

      const { amount, confidence } = extractTotal(text);
      onResult({
        amount: amount ?? 0,
        confidence: amount ? confidence : 'none',
      });
    } catch (err) {
      if (tokenRef.current.cancelled) return;
      console.error('Beleg-Scan fehlgeschlagen', err);
      setErrorMsg(
        err?.message === 'OCR-Timeout'
          ? 'Die Erkennung hat zu lange gedauert.'
          : 'Der Beleg konnte nicht gelesen werden.'
      );
      setState('error');
    }
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={state === 'working' ? undefined : onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Beleg scannen">
        <div className="sheet-header">
          <h2>Beleg scannen</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Schließen">✕</button>
        </div>

        {state === 'idle' && (
          <div className="stack">
            <p className="muted">
              Fotografiere den Kassenbon — der Gesamtbetrag wird automatisch erkannt.
              Alles läuft offline auf deinem Gerät; das Foto wird nicht gespeichert.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
            <button className="btn btn-primary btn-block" onClick={() => inputRef.current?.click()}>
              📷 Foto aufnehmen
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => onResult({ amount: 0, confidence: 'none', manual: true })}>
              Lieber manuell eingeben
            </button>
          </div>
        )}

        {state === 'working' && (
          <div className="stack">
            <p className="muted">{label || 'Beleg wird gelesen …'}</p>
            <div className="scan-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${progress}%` }} />
            </div>
            <button
              className="btn btn-block"
              onClick={() => {
                tokenRef.current.cancelled = true;
                onClose();
              }}
            >
              Abbrechen
            </button>
          </div>
        )}

        {state === 'error' && (
          <div className="stack">
            <p>{errorMsg} Du kannst den Betrag einfach selbst eintippen.</p>
            <button className="btn btn-primary btn-block" onClick={() => onResult({ amount: 0, confidence: 'none', manual: true })}>
              Manuell eingeben
            </button>
            <button className="btn btn-block" onClick={() => setState('idle')}>Nochmal versuchen</button>
          </div>
        )}
      </div>
    </>
  );
}
