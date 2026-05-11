// Coarse C++-friendly token counter used as a fast pre-flight gate before
// the microservice tokenizes for real. Identifiers, numbers, and any single
// non-whitespace punctuation/operator each count as one token. The same
// regex is mirrored verbatim in the frontend so the live counter shown to
// the user matches what the server will accept.
export function countCppTokens(text: string): number {
  if (typeof text !== 'string' || text.length === 0) return 0;
  const m = text.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[^\s\w]/g);
  return m ? m.length : 0;
}

// Per-file token cap. Submission is rejected with HTTP 400 if any single
// file exceeds this. Override via env for ops/research; clamped to a sane
// floor and ceiling so a misconfigured value cannot disable the gate or
// blow past the microservice's tested envelope.
export function resolveMaxTokensPerFile(): number {
  const raw = Number(process.env.MAX_TOKENS_PER_FILE);
  if (!Number.isFinite(raw) || raw <= 0) return 1000;
  return Math.min(20_000, Math.max(100, Math.floor(raw)));
}
