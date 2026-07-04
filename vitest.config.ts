import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// Gleiche Buildzeit-Konstante wie in electron.vite.config.ts (Paket B3):
// Unit-Tests pruefen damit, dass die eingebettete App-Version der
// package.json-Version entspricht (Pruefstempel-Footer).
const packageJson = JSON.parse(readFileSync(join(import.meta.dirname, 'package.json'), 'utf8')) as {
  version: string;
};

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
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
