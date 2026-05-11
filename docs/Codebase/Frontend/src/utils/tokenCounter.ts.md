# tokenCounter.ts (frontend)

Verbatim mirror of `Codebase/Backend/src/utils/tokenCounter.ts` for the
live token counter shown next to the `AnalysisForm` textarea.

## Exports

- `countCppTokens(text: string): number` — same regex as the backend.
- `DEFAULT_MAX_TOKENS_PER_FILE` — `1000`. Used as a fallback when the
  health endpoint hasn't responded yet; the actual cap comes from
  `useAppStore().maxTokensPerFile`, hydrated by `useHealth`.

## Why mirror

If the frontend used a different counting algorithm, the live counter
would disagree with what the server accepts — the user would either be
surprised by a 400, or held back by a stricter local count. Keeping the
two regexes byte-identical makes the limit predictable.
