# analysis.js

- Source: Backend/src/routes/analysis.js
- Kind: Express router

## Story
### What Happens Here

This router exposes the public analysis API used by the Frontend. Per D20 and D22, it is a thin orchestration layer:

1. Receives source code from the Frontend (file upload or JSON body).
2. Hands the code to `classDeclarationAnalysisService.analyzeClassDeclaration` which spawns the C++ microservice and reads its `report.json` + evidence files.
3. For each detected pattern, calls `aiDocumentationService.generateDocumentation` to produce per-anchor documentation and per-unit-test test plans.
4. Builds line-anchored annotations, persists the run to `analysis_runs`, writes a JSON artifact, and returns the full response to the Frontend.

The router never embeds regex pattern detection, never builds AI prompts inline, and never calls the AI provider directly — those concerns live in the two services.

### Why It Matters In The Flow

This is the single ingress point for the documentation-generation workflow. Frontend speaks only to this router. The router speaks to two services. The services speak to the microservice and the AI provider. This keeps the architecture clean per D20.

## Endpoints

| Method | Path                          | Purpose                                              |
|--------|-------------------------------|------------------------------------------------------|
| GET    | `/api/health`                 | Service status, run count, AI provider configuration |
| GET    | `/api/sample`                 | Returns the bundled `samples/integration/all_patterns.cpp` template |
| POST   | `/api/analyze`                | Run microservice + AI on submitted source            |
| GET    | `/api/runs`                   | List recent runs                                     |
| GET    | `/api/runs/:id`               | Full run detail                                      |
| GET    | `/api/runs/:id/artifact`      | Download the stored analysis JSON                    |
| GET    | `/api/runs/:id/export?format=`| Download annotated `.cpp` or `comments.md`           |

## Response Shape (`POST /api/analyze`)

```json
{
  "runId": 12,
  "createdAt": "2026-04-26T...",
  "sourceName": "snippet.cpp",
  "sourceText": "...",
  "stage": "output",
  "diagnostics": [],
  "detectedPatterns": [
    {
      "patternId": "creational.singleton",
      "patternName": "Singleton",
      "className": "ConfigSingleton",
      "fileName": "...",
      "classText": "...",
      "documentationTargets": [...],
      "unitTestTargets": [...]
    }
  ],
  "aiByPattern": [
    {
      "status": "generated" | "pending_provider" | "skipped" | "failed",
      "verdict": "confirmed" | "reclassified",
      "documentationByTarget": { "<label>": "<paragraph>" },
      "unitTestPlanByTarget":  { "<function_hash>": "<test note>" }
    }
  ],
  "annotations": [...],
  "pipeline": [...],
  "stageMetrics": [...],
  "commentedCode": "...",
  "commentsOnly": "...",
  "summary": "..."
}
```

## Acceptance Checks

- The router contains no regex-based source analysis; structural verdicts come exclusively from the microservice.
- The router never imports an AI SDK or holds an API key; the AI call goes through `aiDocumentationService.js`.
- The `analysis_runs` table schema is preserved (the legacy `structure_score` and `modernization_score` columns are written as `0` for backward compatibility with existing rows).
- When the microservice binary or pattern catalog is missing, the router returns the run with diagnostics rather than a 500 error.
- When the AI provider is unconfigured, the run still completes and `aiByPattern[i].status === "pending_provider"`.

## Related

- `Backend/src/services/classDeclarationAnalysisService.js` — microservice spawn + report ingestion.
- `Backend/src/services/aiDocumentationService.js` — Claude Messages API call, prompt construction, response parsing.
- `docs/Codebase/DESIGN_DECISIONS.md` — D20 (microservice purity) and D22 (Claude provider choice).
