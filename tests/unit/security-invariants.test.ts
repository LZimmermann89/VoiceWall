/**
 * Grep-basierte Sicherheits-Invarianten ueber den Quellbaum (M4):
 * 1. `shell.openExternal` existiert genau ZWEIMAL, ausschliesslich mit
 *    statischen Konstanten: Accessibility-Deep-Link in
 *    permission/accessibility.ts (M3) und Impressums-Quelle in
 *    ipc/handlers.ts (M9). Jede weitere Stelle braucht einen Eintrag in
 *    docs/ENTSCHEIDUNGEN.md (E31) UND eine Erweiterung dieses Tests.
 * 2. Kein `innerHTML`/`dangerouslySetInnerHTML`/`document.write` fuer
 *    Nutzerinhalte im Renderer (Output-Encoding, ABARBEITUNG 3.5).
 * 3. Kein `exec(`/`execSync(` mit Shell-String; ausschliesslich `execFile`
 *    mit Argument-Array (Command-Injection-Abwehr, ABARBEITUNG 3.4).
 * 4. Kein Telemetrie-/Crash-Upload-Code (`crashReporter.start`).
 * 5. Keine aktiven TMG-/TTDSG-Zitate in src/ (Spiegel des CI-Gates).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot = join(import.meta.dirname, '../../src');

interface SourceFile {
  readonly path: string;
  readonly content: string;
}

function collectSources(dir: string, files: SourceFile[] = []): SourceFile[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSources(fullPath, files);
    } else if (/\.(ts|tsx|html|css)$/.test(entry.name)) {
      files.push({ path: fullPath, content: readFileSync(fullPath, 'utf8') });
    }
  }
  return files;
}

const sources = collectSources(srcRoot);

function filesMatching(pattern: RegExp): string[] {
  return sources.filter((file) => pattern.test(file.content)).map((file) => file.path);
}

describe('Sicherheits-Invarianten im Quellbaum', () => {
  it('shell.openExternal existiert genau zweimal (statische Ausnahmen E31)', () => {
    const hits = filesMatching(/openExternal\s*\(/).sort();
    expect(hits.length).toBe(2);

    const accessibilityPath = hits.find((hit) =>
      hit.includes(join('permission', 'accessibility.ts')),
    );
    const impressumPath = hits.find((hit) => hit.includes(join('ipc', 'handlers.ts')));
    expect(accessibilityPath).toBeDefined();
    expect(impressumPath).toBeDefined();

    // Beide Aufrufe verwenden statische Konstanten, nie dynamischen Input.
    const accessibilityFile = sources.find((source) => source.path === accessibilityPath);
    expect(accessibilityFile?.content).toContain('shell.openExternal(ACCESSIBILITY_SETTINGS_URL)');
    const impressumFile = sources.find((source) => source.path === impressumPath);
    expect(impressumFile?.content).toContain('shell.openExternal(IMPRESSUM_QUELLE_URL)');

    // Die Impressums-URL ist ein Literal in shared/impressum.ts.
    const impressumConst = sources.find((source) =>
      source.path.endsWith(join('shared', 'impressum.ts')),
    );
    expect(impressumConst?.content).toContain(
      "export const IMPRESSUM_QUELLE_URL = 'https://der-ki-auditor.de/impressum';",
    );
  });

  it('kein innerHTML/dangerouslySetInnerHTML/document.write im Quellbaum', () => {
    expect(filesMatching(/innerHTML|dangerouslySetInnerHTML|document\.write/)).toEqual([]);
  });

  it('kein exec(/execSync( mit Shell-String (nur execFile/spawn erlaubt)', () => {
    // Negative Lookbehind: execFile( ist erlaubt, exec( und execSync( nicht.
    expect(filesMatching(/(?<![\w.])exec(Sync)?\s*\(/)).toEqual([]);
  });

  it('kein crashReporter.start und kein Telemetrie-SDK im Quellbaum', () => {
    expect(filesMatching(/crashReporter\.start|@sentry|analytics|posthog|mixpanel/i)).toEqual([]);
  });

  it('keine aktiven TMG-/TTDSG-Zitate in src/ (DDG/TDDDG seit Mai 2024)', () => {
    expect(filesMatching(/\b(TMG|TTDSG)\b/)).toEqual([]);
  });
});
