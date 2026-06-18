# client.ts

- Source: `Frontend/src/api/client.ts`
- Kind: frontend API client

## Story
This client carries the wrapper id through the test-runner wire types so streaming SSE results and cached results preserve the same per-question identity as the backend.

For learner APIs, a `401` received while the user is in `/pre-test` or `/patterns/learn` preserves the current path in a learner sign-in redirect. It must not silently send an expired learner session to the marketing landing page.

`provisionLocalTestIntern()` calls the development-only auth endpoint used by the localhost learner login fallback.

## Read Order
1. `GdbTestResult` and `RunStreamPhaseEvent` for the shape changes.
2. `runPatternTestsStreaming()` for the live test flow.
3. `apiFetch()` for the shared request behavior.

## Boundary
- The client does not generate wrapper ids.
- It only transports the backend result identity into the store and the UI.

## Acceptance Checks
- The streamed phase event shape matches the backend result shape.
- Cached results can still be grouped deterministically after a refresh.
- Expired learner assessment/path requests route to `/student-learning/login?next=...`.
- Local Test Intern provisioning returns a normal learner token and user record.
