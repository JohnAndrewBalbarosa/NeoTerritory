import { defineConfig } from 'vitest/config';

// Frontend unit tests cover pure logic modules only (no DOM/component
// rendering). Components are exercised by Playwright e2e + visual regression.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    reporters: 'default',
  },
});
