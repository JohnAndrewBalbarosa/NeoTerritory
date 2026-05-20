# Thesis results

Panel-facing summary of the analyzer's measured behaviour against the
50-participant cohort. Two files, one shape each:

- **`results.csv`** — single worksheet, several stacked tables.
  - Cohort summary
  - Test surfaces (compile / static / unit) with pass rates
  - Time + space complexity (OLS regression: slope, intercept, R²)
  - F1 — overall + per-pattern, with a thematic interpretation cell per row
  - Cronbach α per ISO-25010 subscale (B / C / D / E / F + overall instrument)
  - Paste into Excel as-is; no formula evaluation needed.

- **`results-interpretation.md`** — narrative reading of the same
  numbers, written for the panel.
  - Time complexity verdict (O(n) confirmed) + system-dependence caveat
  - Space complexity verdict
  - Per-run averages (mean tokens, items, wall ms, output KB)
  - Explicit note: the regression **intercept** is a property of the host
    system, not the algorithm. Slope is what transfers across replications.
  - Test-surface verdict (pass rates in expected band)
  - **F1 verdict** under the v4 run × pattern grain (per-pattern total = 150)
  - Cronbach α reading + the k=2 short-scale caveat
  - Closing four-bullet "common themes" panel takeaway

Both files are regenerated from the live dataset; the numbers here are
a point-in-time export. Refresh by re-running the dataset and the
export, then copying the new files over these.
