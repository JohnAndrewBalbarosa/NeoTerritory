# studio

- Folder: `Frontend/src/components/studio`
- Owner: Frontend

## Logic Summary

Studio components host the interactive analyzer workspace. The surface coordinates tab state, tour state, analyzer results, and optional target-pattern callbacks for embedded learning checks.

## Documents By Logic

- `StudioSurface.tsx.md` - shared Studio workspace and embedded target-pattern check bridge.

## Acceptance Checks

- Standalone Studio works without learning-specific props.
- Learner Studio questions can pass starter code and receive detection callbacks.
