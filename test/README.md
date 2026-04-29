# test/

All testing-phase artifacts live here. Per-user run JSON is saved under
`devcon<N>/` for tester account `Devcon<N>` (case-insensitive bind).

```
test/
├── _uploads/         # multer temp uploads (auto-cleaned)
├── devcon1/
├── devcon2/
├── ...
└── devcon100/
```

This whole folder is testing-phase only. For actual deployment, results
will live elsewhere (a separate `actual/` tree, not yet wired).

Override the root with `TEST_RESULTS_DIR`.
