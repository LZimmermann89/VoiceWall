/**
 * Eigene Vitest-Konfiguration nur fuer den WER-Messstand.
 *
 * Bewusst getrennt von vitest.config.ts: Der Messstand laedt die grossen
 * Modelle (bis 1,6 GB) und gehoert nicht in jeden Testlauf und schon gar nicht
 * in die CI. Aufruf ueber `npm run wer`. Fehlt das Korpus oder die Modelle,
 * ueberspringt der Lauf sich sauber.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

const packageJson = JSON.parse(readFileSync(join(import.meta.dirname, 'package.json'), 'utf8')) as {
  version: string;
};

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  test: {
    include: ['tests/wer/**/*.test.ts'],
    environment: 'node',
    testTimeout: 300_000,
    hookTimeout: 300_000,
    // Der Bericht soll direkt auf der Konsole erscheinen, nicht von Vitest
    // eingesammelt werden.
    disableConsoleIntercept: true,
  },
});
