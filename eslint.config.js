/**
 * ESLint Flat-Config mit typed-linting und harten Modulgrenzen:
 * - src/renderer/** darf weder Node-Builtins noch Electron (ausser Typen)
 *   noch native Addons importieren. Jeder OS-Zugriff laeuft ueber die
 *   Preload-Bruecke.
 * - src/shared/** darf weder Node- noch DOM-Globals nutzen und keine
 *   Node-/Electron-Module importieren: reine, portable TypeScript-Logik.
 * Formatierung macht ausschliesslich Prettier (eslint-config-prettier
 * schaltet alle kollidierenden Regeln ab, kein Regel-Overlap).
 */
import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

const nodeBuiltinImportPatterns = [
  'node:*',
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'crypto',
  'dgram',
  'dns',
  'events',
  'fs',
  'fs/*',
  'http',
  'http2',
  'https',
  'module',
  'net',
  'os',
  'path',
  'path/*',
  'perf_hooks',
  'process',
  'readline',
  'stream',
  'stream/*',
  'tls',
  'url',
  'util',
  'v8',
  'vm',
  'worker_threads',
  'zlib',
  '*.node',
];

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'dist/**',
      'playwright-report/**',
      'test-results/**',
      'sbom.cdx.json',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
    },
  },
  {
    // Modulgrenze Renderer: kein Node, kein Electron (ausser Typ-Importen),
    // keine nativen Addons. Verstoss = Build-Bruch in der CI.
    files: ['src/renderer/**/*.ts', 'src/renderer/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'electron',
              message:
                'Der Renderer darf Electron nicht importieren (nur Typ-Importe). OS-Zugriff laeuft ueber die Preload-Bruecke window.voicewall.',
              allowTypeImports: true,
            },
          ],
          patterns: [
            {
              group: nodeBuiltinImportPatterns,
              message:
                'Der Renderer darf keine Node-Builtins oder nativen Addons importieren. OS-Zugriff laeuft ueber die Preload-Bruecke window.voicewall.',
            },
          ],
        },
      ],
    },
  },
  {
    // Modulgrenze Shared: reine TypeScript-Logik, weder Node- noch
    // DOM-Globals, keine Node-/Electron-Importe.
    files: ['src/shared/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'electron',
              message: 'src/shared/** ist plattformneutral und darf Electron nicht importieren.',
            },
          ],
          patterns: [
            {
              group: nodeBuiltinImportPatterns,
              message: 'src/shared/** ist plattformneutral und darf keine Node-Module importieren.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'location',
          'localStorage',
          'sessionStorage',
          'alert',
          'XMLHttpRequest',
          'WebSocket',
          'fetch',
          'process',
          'Buffer',
          'require',
          '__dirname',
          '__filename',
          'global',
          'setImmediate',
        ].map((name) => ({
          name,
          message: `src/shared/** darf weder Node- noch DOM-Globals nutzen (verboten: ${name}).`,
        })),
      ],
    },
  },
  {
    // JS-Konfigdateien (nur eslint.config.js) ohne typed-linting pruefen.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettierConfig,
);
