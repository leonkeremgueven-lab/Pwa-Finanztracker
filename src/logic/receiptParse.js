// Betrags-Heuristik für den Beleg-Scanner.
// Nimmt den rohen OCR-Text und liefert den wahrscheinlichsten Gesamtbetrag
// in Cent plus Konfidenz-Level ('high' = Keyword-Zeile, 'low' = Fallback).

// Keywords inkl. typischer OCR-Verschreiber (S->5, O->0, E->3 …).
const KEYWORD_PATTERNS = [
  /[S5$]\s?[UÜ]MM[E3]/i,        // SUMME, 5UMME
  /G[E3][S5]AMT/i,               // GESAMT, G3SAMT
  /T[O0]TAL/i,                   // TOTAL, T0TAL
  /ZU\s+ZAHLEN/i,
  /B[E3]TRAG/i,                  // BETRAG
  /\bEC\b/i,
  /\bBAR\b/i,
  /KART[E3]/i,
];

const AMOUNT_RE = /\d{1,5}[,.]\d{2}(?!\d)/g;

/** '23,47' oder '12.99' -> Cent (Integer). */
export function parseAmountToCents(str) {
  const normalized = str.replace(',', '.');
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

/**
 * @param {string} text roher OCR-Text
 * @returns {{ amount: number|null, confidence: 'high'|'low'|'none', candidates: number[] }}
 */
export function extractTotal(text) {
  if (!text || typeof text !== 'string') return { amount: null, confidence: 'none', candidates: [] };

  const lines = text.split(/\r?\n/);
  const keywordAmounts = [];
  const allAmounts = [];

  for (const line of lines) {
    const matches = line.match(AMOUNT_RE) ?? [];
    const cents = matches.map(parseAmountToCents).filter((c) => c !== null);
    allAmounts.push(...cents);
    if (cents.length && KEYWORD_PATTERNS.some((re) => re.test(line))) {
      keywordAmounts.push(...cents);
    }
  }

  if (keywordAmounts.length) {
    // Bei mehreren Keyword-Treffern (z. B. SUMME + EC) ist der größte
    // fast immer der Gesamtbetrag (EC-Zeile kann Rückgeld enthalten).
    return { amount: Math.max(...keywordAmounts), confidence: 'high', candidates: allAmounts };
  }
  if (allAmounts.length) {
    return { amount: Math.max(...allAmounts), confidence: 'low', candidates: allAmounts };
  }
  return { amount: null, confidence: 'none', candidates: [] };
}
