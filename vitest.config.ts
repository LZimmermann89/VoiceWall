import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/unit/**/*.test.ts',
      'tests/smoke/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    environment: 'node',
    // Modell-Laden und Transkription in den Integrationstests brauchen laenger
    // als der Vitest-Default von 5 s.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
