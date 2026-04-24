# Header

- Folder: `docs/Codebase/Microservice/Modules/Header`
- Role: contract mirror for the source-side blueprint

## Active Tree
```text
Header/
  SyntacticBrokenAST/
    Analysis/
    Trees/
    HashingMechanism/
    OutputGeneration/
```

## Mirror Rule
- keep the same stage order as source
- keep the same logic-first folder names
- only diverge when a source-side implementation folder has no header contract equivalent

## Acceptance Checks
- family-first header roots are gone from the active tree
- source and header now meet at the same major stage folders
