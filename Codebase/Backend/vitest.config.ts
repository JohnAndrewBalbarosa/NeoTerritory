import { defineConfig } from 'vitest/config';

// Vitest config for backend unit tests (Phase D of the CI requirement-
// compliance plan). The tests live alongside the modules they exercise
// in src/__tests__/. No globals, no jsdom — the backend is plain Node.
export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    // Each test file gets its own module instance so any module-level
    // state (e.g. env-var snapshots) does not leak across files.
    isolate: true,
  },
});
