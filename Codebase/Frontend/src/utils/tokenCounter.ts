// Mirrors Codebase/Backend/src/utils/tokenCounter.ts. Identifiers, numbers,
// and any single non-whitespace punctuation/operator each count as one token.
// The regex is intentionally identical so the live counter shown next to the
// textarea matches the server-side gate that rejects oversized submissions.
export function countCppTokens(text: string): number {
  if (typeof text !== 'string' || text.length === 0) return 0;
  const m = text.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[^\s\w]/g);
  return m ? m.length : 0;
}

export const DEFAULT_MAX_TOKENS_PER_FILE = 1000;
