# logic (admin)

- Folder: `Frontend/src/admin/logic`
- Owner: Frontend

## Logic Summary

Pure admin-side data shaping helpers. These modules prepare instructor analytics, plan previews, and other operator-facing summaries for components without owning network calls or page layout.

## Documents By Logic

- `learningAggregate.ts.md` - question heatmap, module summary, and mixed-question drilldown aggregation.

## Acceptance Checks

- UI components receive already-shaped rows and labels.
- Catalog joins preserve the authored question type instead of assuming every theoretical question is MCQ.
