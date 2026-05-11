# tokenCounter.ts

Coarse C++-friendly token counter used as a pre-flight gate before the
microservice tokenizes for real.

## Purpose

The `/api/analyze` route enforces a per-file lexical-token cap (default
1000) to keep submissions inside the microservice's tested envelope and to
match the live counter shown to the user in `AnalysisForm`. The two sides
must agree on the count, so the same regex lives here and in
`Codebase/Frontend/src/utils/tokenCounter.ts` (verbatim mirror).

## Exports

- `countCppTokens(text: string): number` — counts identifiers, numeric
  literals, and any single non-whitespace punctuation/operator as one
  token each. Empty / non-string input returns `0`.
- `resolveMaxTokensPerFile(): number` — reads `MAX_TOKENS_PER_FILE` from
  env, clamps to `[100, 20_000]`, defaults to `1000`. Exposed via
  `/api/health` so the frontend pulls the same value.

## Token approximation

Regex: `/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[^\s\w]/g`

This intentionally over-counts vs. a full C++ lexer (it splits multi-char
operators like `->` into `-` + `>`, etc.) but is close enough for input
gating. The microservice is still the source of truth for analysis-time
token counts.

## Collaborators

- `Codebase/Backend/src/routes/analysis.ts` — calls `countCppTokens` per
  file and returns HTTP 400 with `{file, tokens, limit}` if any file is
  over the cap. Health endpoint exposes `maxTokensPerFile`.
- `Codebase/Frontend/src/utils/tokenCounter.ts` — mirror.
