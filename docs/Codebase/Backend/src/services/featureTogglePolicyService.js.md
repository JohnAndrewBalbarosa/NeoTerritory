# featureTogglePolicyService.js

- Source: `Backend/src/services/featureTogglePolicyService.js`
- Kind: JavaScript service

## Story
### What Happens Here

This service converts the project-learning scope into model-backed publish toggles with implicit deny. It decides which pattern modules, topic sections, and assessment gates should be visible for the current project.

Everything starts off disabled. Only the AI-approved scope becomes enabled.

### Why It Matters In The Flow

The system should not expose irrelevant learning material. The toggle policy makes the study environment project-specific and keeps the rest of the catalog hidden.

### What To Watch While Reading

This service is policy, not content:
- it does not teach the pattern.
- it does not score the intern.
- it only decides what can be reached.
- it operates on the module model/catalog entries rather than a generic config blob.
- general config is reserved for adding structural pattern families outside the GoF catalog.
- it now covers the wider pattern set, including later structural and behavioral modules such as facade, command, strategy, observer, and the other supported families.

## Service Flow

```mermaid
flowchart TD
    Start["Receive scope"]
    N0["Load catalog"]
    N1["Apply deny default"]
    N2["Enable required items"]
    N3["Hide excluded items"]
    N4["Build manifest"]
    End["Return policy"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

## Input Contract

```json
{
  "projectId": "proj-1024",
  "scopeVersion": "scope-7",
  "requiredPatterns": ["adapter", "facade", "observer", "command", "strategy"],
  "requiredModules": ["structural-adapter", "structural-facade", "behavioural-observer"],
  "requiredTopics": ["module boundaries", "dependency direction", "live updates"],
  "excludedPatterns": ["builder"]
}
```

## Output Contract

```json
{
  "projectId": "proj-1024",
  "scopeVersion": "scope-7",
  "toggles": [
    { "key": "pattern.adapter", "enabled": true },
    { "key": "pattern.facade", "enabled": true },
    { "key": "pattern.builder", "enabled": false }
  ],
  "implicitDeny": true,
  "status": "applied"
}
```

## Acceptance Checks

- The manifest defaults to denied for every unlisted module.
- Only the scoped patterns and topics are enabled.
- Excluded modules remain disabled even if they appear in the broader catalog.
- The policy can be re-evaluated when the scope version changes.
- Module publish state is resolved from the learning model catalog.
- Config is only used when the org wants to add structural pattern families outside the GoF set.
- Pattern keys now cover the broader supported catalog, not just the initial partial set.
