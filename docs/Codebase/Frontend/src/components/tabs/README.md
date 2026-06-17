# tabs

- Folder: `Frontend/src/components/tabs`
- Owner: Frontend

## Logic Summary

Tab components render the primary Studio workspace views. They receive Studio-level state and delegate specialized behavior to focused child components.

## Documents By Logic

- `SubmitTab.tsx.md` - Studio submit form host and run-list pairing.
- `GdbRunnerTab.tsx.md` - Wrapper-aware GDB result tree and phase viewer.

## Acceptance Checks

- Tab components pass required state through without owning analyzer domain logic.
- Submit behavior remains delegated to `AnalysisForm`.
