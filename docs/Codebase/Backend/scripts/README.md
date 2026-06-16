# scripts

- Folder: `Backend/scripts`
- Owner: Backend

## Logic Summary

Backend-local maintenance scripts that operate beside the runtime service. These scripts may inspect or repair persisted backend data, but they are not part of the request path.

## Documents By Logic

- `repairLearningQuestionBank.mjs.md` - dry-run-first repair for incomplete mixed theoretical question banks.

## Acceptance Checks

- Maintenance scripts document their run mode and mutation boundary.
- Scripts are invoked directly through backend npm scripts, not through rebuild shims.
