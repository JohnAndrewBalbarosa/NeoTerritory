# projectLearningContracts.js

- Source: `Backend/src/services/projectLearningContracts.js`
- Kind: JavaScript contract module

## Story
### What Happens Here

This module owns the shared data shapes for the project-learning workflow. It keeps the route, controller, and service contracts aligned so the project brief, scope plan, toggle plan, assessment attempt, and readiness evidence all mean the same thing everywhere.

### Why It Matters In The Flow

The workflow changes shape across stages:
- project brief in.
- learning scope out.
- toggle manifest out.
- assessment decision out.
- evidence bundle out.

If these shapes drift, the PM review surface and the intern assessment flow stop matching each other.

### What To Watch While Reading

Keep contracts normalized and project-scoped:
- every object should carry `projectId`.
- every assessment record should carry `internId` and `moduleId`.
- every readiness item should be traceable back to the exact evidence bundle.

## Contract Flow

```mermaid
flowchart TD
    Brief["Project brief"]
    Scope["Learning scope"]
    Toggle["Toggle plan"]
    Assess["Assessment record"]
    Evidence["Evidence bundle"]
    Brief --> Scope
    Scope --> Toggle
    Toggle --> Assess
    Assess --> Evidence
```

## Core Shapes

### ProjectBriefInput

```json
{
  "projectId": "proj-1024",
  "projectTitle": "Retail billing redesign",
  "businessSpecs": ["..."],
  "architectureSpecs": ["..."],
  "businessProcess": "..."
}
```

### ProjectLearningScope

```json
{
  "projectId": "proj-1024",
  "scopeVersion": "scope-7",
  "requiredPatterns": ["adapter", "facade"],
  "requiredModules": ["module-boundaries", "dependency-direction"],
  "excludedPatterns": ["builder"],
  "notes": ["implicit deny applied"]
}
```

### ToggleManifest

```json
{
  "projectId": "proj-1024",
  "scopeVersion": "scope-7",
  "toggles": [
    { "key": "pattern.adapter", "enabled": true },
    { "key": "pattern.builder", "enabled": false }
  ]
}
```

### AssessmentRecord

```json
{
  "projectId": "proj-1024",
  "internId": "int-44",
  "moduleId": "adapter",
  "attemptType": "pretest",
  "decision": "pass",
  "score": 92
}
```

### ReadinessEvidenceBundle

```json
{
  "projectId": "proj-1024",
  "internId": "int-44",
  "summaryStatus": "ready",
  "codeRuns": [],
  "answers": [],
  "rawResults": []
}
```

## Acceptance Checks

- The same project identifier survives every stage of the workflow.
- The toggle manifest can represent both enabled and denied patterns.
- The assessment record can represent pretest and posttest attempts with the same shape.
- The evidence bundle can carry summary results and raw inspection data together.
