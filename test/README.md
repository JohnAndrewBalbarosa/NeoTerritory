# test/

All testing-phase artifacts live here. Per-user run JSON is saved under
`devcon<N>/` for tester account `Devcon<N>` (case-insensitive bind).

Asymmetric keys are **not** stored in this tree. Devcon seats are runtime
allocations:

- `Devcon1` through `Devcon100` are seeded as available seats.
- Claiming a seat generates a fresh public/private keypair in the backend.
- The keypair is returned only to the claiming browser session.
- A heartbeat must refresh the seat every 30 seconds.
- If the seat is released or expires after 60 seconds without heartbeat, the
  key binding is cleared and the seat becomes available again.

```
test/
|-- _uploads/         # multer temp uploads (auto-cleaned)
|-- devcon1/          # saved run JSON only
|-- devcon2/
|-- ...
`-- devcon100/
```

This whole folder is testing-phase only. For actual deployment, results will
live elsewhere (a separate `actual/` tree, not yet wired).

Override the root with `TEST_RESULTS_DIR`.
