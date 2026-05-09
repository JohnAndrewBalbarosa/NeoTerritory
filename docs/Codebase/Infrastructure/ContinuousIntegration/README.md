# Continuous Integration

- Folder: docs/Codebase/Infrastructure/ContinuousIntegration

## Logic Summary
Developer-only quality gates for compile, unit, integration, GDB, and AI async orchestration checks. This folder documents how GitHub Actions validates the pipeline without exposing internal diagnostics to production users.

## Ownership Boundary
- Owns CI workflow contracts and test visibility rules.
- Does not define production UI behavior beyond hiding developer-only diagnostics.
- Does not change runtime algorithm behavior.

## Read Order
1. Read `github_actions_step_pipeline.md` for the Step 1 -> Step 2 test contract.
2. Read the pod warmup separation contract in `pod_warmup_separation.md`.
3. Apply the no-leak policy in backend and frontend production profiles.
