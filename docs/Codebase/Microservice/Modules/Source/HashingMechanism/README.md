# HashingMechanism

- Folder: `docs/Codebase/Microservice/Modules/Source/HashingMechanism`
- Role: identity propagation and hash-guided lookup

## Read Order
1. `core.cpp.md`
2. `ReverseMerkle/`
3. `HashLinks/`

## Primary Entry
- Start with `core.cpp.md`.

## Boundary
- `ReverseMerkle/` owns the cascading parent-to-child hash model.
- `HashLinks/` owns lookup structures that use those identities to reconnect actual usage with the correct virtual nodes.

## Workflow File
- `core.cpp.md` shows the whole identity and lookup workflow before the folder splits into reverse-Merkle and hash-link details.

## Acceptance Checks
- Cascading hash logic is separate from tree generation.
- Hash-link lookup is separate from reverse-Merkle identity creation.


