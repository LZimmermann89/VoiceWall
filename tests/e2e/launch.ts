/**
 * E2E-Helfer (M6): startet die gebaute App vollstaendig isoliert vom echten
 * Rechner. userData und der Firmen-Basisordner zeigen auf frische
 * Testverzeichnisse (VOICEWALL_TEST_USER_DATA, VOICEWALL_TEST_BASE_DIR; beide
 * nur in ungepackten Dev-Builds wirksam). Seit M6 entscheidet die App beim
 * Start zwischen Wizard (keine Firma) und Verwaltung (mindestens eine Firma);
 * `withCompany` legt deshalb vor den Assertions eine Testfirma ueber die
 * IPC-Bruecke an und laedt das Fenster neu.
 */
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { ALL_MODEL_DESCRIPTORS } from '../../src/main/model/model-catalog';
import {
  modelsAvailable,
  multilingualModelPath,
  sileroModelPath,
  whisperModelPath,
} from '../integration/model-fixtures';
import { getMainUiWindow } from './main-window';

const projectRoot = join(import.meta.dirname, '../..');
export const builtMainEntry = join(projectRoot, 'out/main/index.js');

export interface LaunchOptions {
  /** Vor den Assertions eine Testfirma anlegen (App zeigt die Verwaltung). */
  readonly withCompany?: boolean;
  /** Modelle aus dem echten userData in das Test-userData verlinken. */
  readonly linkModels?: boolean;
  /**
   * Einwilligung VOR dem Start in das Test-userData schreiben. Verhindert im
   * Wizard-E2E, dass grantConsent den blockierenden macOS-Mikrofon-Dialog
   * ausloest (askForMediaAccess laesst sich nicht automatisiert bestaetigen).
   */
  readonly withConsent?: boolean;
  /** Zusaetzliche Umgebungsvariablen. */
  readonly env?: Readonly<Record<string, string>>;
  /**
   * Zusaetzliche Chromium-/Electron-Kommandozeilenargumente (z. B.
   * --use-fake-device-for-media-stream fuer den echten Aufnahmepfad ohne
   * physisches Mikrofon und ohne TCC-Dialog).
   */
  readonly extraArgs?: readonly string[];
}

export interface LaunchedApp {
  readonly app: ElectronApplication;
  readonly window: Page;
  readonly testRoot: string;
  readonly userDataDir: string;
  readonly baseDir: string;
}

/**
 * Verlinkt die grossen Modelldateien (Hardlink, Copy-Fallback) in das
 * Test-userData, damit Engine-Tests ohne 574-MB-Kopie laufen.
 */
function linkModelsInto(userDataDir: string): void {
  if (!modelsAvailable) {
    return;
  }
  const modelsDir = join(userDataDir, 'models');
  mkdirSync(modelsDir, { recursive: true });
  // Das multilinguale EN-Modell (Paket B1) ist optional: es wird nur
  // verlinkt, wenn es lokal vorhanden ist (EN-Tests skippen sonst selbst).
  const sources = [whisperModelPath, sileroModelPath, multilingualModelPath].filter((source) =>
    existsSync(source),
  );
  for (const source of sources) {
    const target = join(modelsDir, basename(source));
    if (existsSync(target)) {
      continue;
    }
    try {
      linkSync(source, target);
    } catch {
      copyFileSync(source, target);
    }
  }
  // Integritaets-Marker vorbefuellen (wie er nach der ersten echten
  // SHA-256-Verifikation aussieht): sonst hasht der App-Start im frischen
  // Test-userData ueber 1 GB Modelldateien voll und die ersten UI-Asserts
  // laufen in den Timeout. Die Sicherheitsentscheidung bleibt unveraendert
  // an den Katalog-Konstanten; die verlinkten Dateien sind die bereits
  // verifizierten Originale (Hardlink, gleiche Inode).
  const marker: Record<string, { sha256: string; byteSize: number; mtimeMs: number }> = {};
  for (const descriptor of ALL_MODEL_DESCRIPTORS) {
    const target = join(modelsDir, descriptor.fileName);
    if (!existsSync(target)) {
      continue;
    }
    const info = statSync(target);
    marker[descriptor.fileName] = {
      sha256: descriptor.sha256,
      byteSize: info.size,
      mtimeMs: info.mtimeMs,
    };
  }
  writeFileSync(join(modelsDir, '.model-integrity.json'), JSON.stringify(marker, null, 2), {
    mode: 0o600,
  });
}

/**
 * Legt ueber die IPC-Bruecke eine Testfirma an (Standard: Desktop-Strategie,
 * Diktatsprache Deutsch; `sprache: 'en'` legt eine EN-Firma an, Paket B1).
 */
export async function createTestCompany(
  window: Page,
  name = 'Testfirma GmbH',
  sprache: 'de' | 'en' = 'de',
): Promise<{ ok: boolean; pfad?: string }> {
  return window.evaluate(
    (args: { name: string; sprache: 'de' | 'en' }) =>
      (
        globalThis as unknown as {
          voicewall: {
            createCompany: (
              n: string,
              strategie: 'desktop',
              details?: undefined,
              modell?: undefined,
              ordnername?: undefined,
              sprache?: 'de' | 'en',
            ) => Promise<{ ok: boolean; pfad?: string }>;
          };
        }
      ).voicewall.createCompany(
        args.name,
        'desktop',
        undefined,
        undefined,
        undefined,
        args.sprache,
      ),
    { name, sprache },
  );
}

export async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
  const testRoot = mkdtempSync(join(tmpdir(), 'voicewall-e2e-'));
  const userDataDir = join(testRoot, 'userdata');
  const baseDir = join(testRoot, 'desktop');
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(baseDir, { recursive: true });
  if (options.linkModels ?? false) {
    linkModelsInto(userDataDir);
  }
  if (options.withConsent ?? false) {
    writeFileSync(
      join(userDataDir, 'microphone-consent.json'),
      JSON.stringify(
        {
          microphoneConsent: true,
          grantedAtIso: new Date().toISOString(),
          consentTextVersion: 1,
        },
        null,
        2,
      ),
    );
  }

  const app = await electron.launch({
    args: [builtMainEntry, ...(options.extraArgs ?? [])],
    cwd: projectRoot,
    env: {
      ...process.env,
      VOICEWALL_ENABLE_TEST_IPC: '1',
      VOICEWALL_TEST_USER_DATA: userDataDir,
      VOICEWALL_TEST_BASE_DIR: baseDir,
      ...options.env,
    },
  });
  let window = await getMainUiWindow(app);

  if (options.withCompany ?? false) {
    const created = await createTestCompany(window);
    if (!created.ok) {
      throw new Error('Testfirma konnte nicht angelegt werden.');
    }
    await window.reload();
    window = await getMainUiWindow(app);
  }

  return { app, window, testRoot, userDataDir, baseDir };
}
