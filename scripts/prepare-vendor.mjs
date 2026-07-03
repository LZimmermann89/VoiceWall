#!/usr/bin/env node
/**
 * Vendor-Vorbereitung fuer die Offline-Vor-Ort-Installation (M6,
 * ABARBEITUNG 4.1 Schritt 2 und M6-Checkliste "Offline-Vendoring je
 * Plattform als Default").
 *
 * Laeuft auf Lars' Maschine VOR dem Termin (mit Internet), NIE beim Kunden.
 * Das Ergebnis (vendor/) wandert per USB-Stick oder Archiv mit zum Termin;
 * die Tarballs/Caches werden bewusst NICHT committet (.gitignore).
 *
 * Was das Skript je Zielplattform vorbereitet:
 *   1. Portables Node von nodejs.org laden und gegen die OFFIZIELLE
 *      SHASUMS256.txt derselben Version verifizieren; Ablage unter
 *      vendor/node-runtime/, SHA-256 wird zusaetzlich in
 *      install/lib/checksums.json eingetragen (der Anker, gegen den das
 *      Setup-Skript beim Kunden prueft).
 *   2. npm-Cache fuellen: `npm ci --cache vendor/npm-cache` in einem
 *      Staging-Verzeichnis (fuellt den Cache fuer die aktuelle Plattform)
 *      plus explizites `npm cache add` des plattformrichtigen
 *      @fugood-Whisper-Subpakets der ZIELplattform (Cross-Vendoring).
 *   3. Modelle aus dem lokalen Modell-Ordner (App-Support) nach
 *      vendor/models/ kopieren und gegen resources/model-manifest.json
 *      verifizieren.
 *
 * Aufruf-Beispiele:
 *   node scripts/prepare-vendor.mjs                        (aktuelle Plattform)
 *   node scripts/prepare-vendor.mjs --platform win32-x64
 *   node scripts/prepare-vendor.mjs --platform darwin-x64 --node 26.0.0
 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = join(projectRoot, 'vendor');
const checksumsPath = join(projectRoot, 'install', 'lib', 'checksums.json');
const manifestPath = join(projectRoot, 'resources', 'model-manifest.json');

/** Unterstuetzte Zielplattformen: <process.platform>-<process.arch>. */
const SUPPORTED = ['darwin-arm64', 'darwin-x64', 'win32-x64', 'linux-x64'];

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    platform: `${process.platform}-${process.arch}`,
    nodeVersion: process.versions.node,
  };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--platform') {
      result.platform = args[i + 1] ?? result.platform;
      i += 1;
    } else if (args[i] === '--node') {
      result.nodeVersion = args[i + 1] ?? result.nodeVersion;
      i += 1;
    }
  }
  return result;
}

function fail(message) {
  console.error(`FEHLER: ${message}`);
  process.exit(1);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function download(url) {
  console.log(`Lade ${url} ...`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    fail(`Download fehlgeschlagen (HTTP ${response.status}): ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

const { platform, nodeVersion } = parseArgs();
if (!SUPPORTED.includes(platform)) {
  fail(`Unbekannte Zielplattform "${platform}". Unterstuetzt: ${SUPPORTED.join(', ')}`);
}
if (!nodeVersion.startsWith('26.')) {
  fail(
    `Node-Version ${nodeVersion} passt nicht zu engines (>=26 <27). Mit --node 26.x.y eine passende Version angeben.`,
  );
}

// Mapping auf die offiziellen nodejs.org-Artefaktnamen.
const NODE_ARTIFACTS = {
  'darwin-arm64': `node-v${nodeVersion}-darwin-arm64.tar.gz`,
  'darwin-x64': `node-v${nodeVersion}-darwin-x64.tar.gz`,
  'linux-x64': `node-v${nodeVersion}-linux-x64.tar.gz`,
  'win32-x64': `node-v${nodeVersion}-win-x64.zip`,
};
const artifactName = NODE_ARTIFACTS[platform];

console.log(`Vendor-Vorbereitung fuer ${platform} (Node v${nodeVersion}).`);
mkdirSync(join(vendorDir, 'node-runtime'), { recursive: true });
mkdirSync(join(vendorDir, 'models'), { recursive: true });

// ---------------------------------------------------------------------------
// 1. Portables Node laden und gegen die offizielle SHASUMS256.txt pruefen
// ---------------------------------------------------------------------------
const artifactPath = join(vendorDir, 'node-runtime', artifactName);
const shasumsUrl = `https://nodejs.org/dist/v${nodeVersion}/SHASUMS256.txt`;
const shasumsText = (await download(shasumsUrl)).toString('utf8');
const shaLine = shasumsText
  .split('\n')
  .find(
    (line) => line.trim().endsWith(`  ${artifactName}`) || line.trim().endsWith(` ${artifactName}`),
  );
if (shaLine === undefined) {
  fail(`${artifactName} ist nicht in der offiziellen SHASUMS256.txt von v${nodeVersion} gelistet.`);
}
const officialSha = shaLine.trim().split(/\s+/)[0].toLowerCase();

let artifactSha;
if (existsSync(artifactPath) && sha256(readFileSync(artifactPath)) === officialSha) {
  console.log(`OK: ${artifactName} liegt bereits verifiziert vor (uebersprungen).`);
  artifactSha = officialSha;
} else {
  const artifactBuffer = await download(`https://nodejs.org/dist/v${nodeVersion}/${artifactName}`);
  artifactSha = sha256(artifactBuffer);
  if (artifactSha !== officialSha) {
    fail(
      `SHA-256-Mismatch fuer ${artifactName}: offiziell ${officialSha}, geladen ${artifactSha}. NICHT verwenden.`,
    );
  }
  writeFileSync(`${artifactPath}.part`, artifactBuffer);
  renameSync(`${artifactPath}.part`, artifactPath);
  console.log(`OK: ${artifactName} geladen und gegen SHASUMS256.txt verifiziert.`);
}

// Anker in install/lib/checksums.json eintragen (das Setup-Skript beim
// Kunden prueft ausschliesslich gegen diese Datei).
const checksums = JSON.parse(readFileSync(checksumsPath, 'utf8'));
checksums.nodeRuntime[artifactName] = artifactSha;
writeFileSync(checksumsPath, `${JSON.stringify(checksums, null, 2)}\n`);
console.log(`OK: SHA-256 in install/lib/checksums.json eingetragen (${artifactName}).`);

// ---------------------------------------------------------------------------
// 2. npm-Cache fuellen (Staging-Verzeichnis, beruehrt das Repo nicht)
// ---------------------------------------------------------------------------
const cacheDir = join(vendorDir, 'npm-cache');
const staging = mkdtempSync(join(tmpdir(), 'voicewall-vendor-'));
try {
  for (const file of ['package.json', 'package-lock.json', '.npmrc']) {
    const source = join(projectRoot, file);
    if (existsSync(source)) {
      copyFileSync(source, join(staging, file));
    }
  }
  console.log('Fuelle npm-Cache (npm ci im Staging-Verzeichnis) ...');
  execFileSync('npm', ['ci', '--cache', cacheDir, '--no-audit', '--no-fund'], {
    cwd: staging,
    stdio: 'inherit',
  });

  // Cross-Vendoring: das plattformrichtige Whisper-Subpaket der ZIELplattform
  // explizit in den Cache legen (npm ci auf dieser Maschine zieht nur die
  // eigene Plattform).
  const addonVersion = JSON.parse(
    readFileSync(
      join(projectRoot, 'node_modules', '@fugood', 'whisper.node', 'package.json'),
      'utf8',
    ),
  ).version;
  const targetSubpackage = `@fugood/node-whisper-${platform}@${addonVersion}`;
  console.log(`Lege ${targetSubpackage} in den Cache (Zielplattform) ...`);
  execFileSync('npm', ['cache', 'add', targetSubpackage, '--cache', cacheDir], {
    cwd: staging,
    stdio: 'inherit',
  });
  console.log(`OK: npm-Cache unter ${cacheDir} gefuellt.`);

  // Electron-Binary der ZIELplattform in den Vendor-Cache legen: das
  // electron-Postinstall laeuft unter Skript-Restriktionen nicht automatisch;
  // beim Kunden entpackt das Setup-Skript offline aus diesem Cache
  // (install.js verifiziert gegen die im Paket gepinnten Checksummen).
  const electronCache = join(vendorDir, 'electron-cache');
  mkdirSync(electronCache, { recursive: true });
  const [targetOs, targetArch] = platform.split('-');
  console.log(`Lade Electron-Binary fuer ${targetOs}/${targetArch} in vendor/electron-cache ...`);
  execFileSync('node', [join(staging, 'node_modules', 'electron', 'install.js')], {
    cwd: staging,
    stdio: 'inherit',
    env: {
      ...process.env,
      electron_config_cache: electronCache,
      ELECTRON_INSTALL_PLATFORM: targetOs,
      ELECTRON_INSTALL_ARCH: targetArch,
    },
  });
  console.log('OK: Electron-Binary im Vendor-Cache.');
} finally {
  rmSync(staging, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// 3. Modelle aus dem lokalen Modell-Ordner kopieren und verifizieren
// ---------------------------------------------------------------------------
function localModelsDir() {
  if (process.platform === 'darwin') {
    return join(process.env.HOME ?? '', 'Library', 'Application Support', 'voicewall', 'models');
  }
  if (process.platform === 'win32') {
    return join(process.env.APPDATA ?? '', 'voicewall', 'models');
  }
  return join(
    process.env.XDG_CONFIG_HOME ?? join(process.env.HOME ?? '', '.config'),
    'voicewall',
    'models',
  );
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const sourceModels = localModelsDir();
for (const model of manifest.models) {
  const source = join(sourceModels, model.fileName);
  const target = join(vendorDir, 'models', model.fileName);
  if (existsSync(target) && sha256(readFileSync(target)) === model.sha256) {
    console.log(`OK: Modell ${model.fileName} liegt bereits verifiziert im Vendor-Ordner.`);
    continue;
  }
  if (!existsSync(source)) {
    console.log(
      `Hinweis: Modell ${model.fileName} liegt nicht unter ${sourceModels}; wird uebersprungen (der Wizard kann es beim Kunden laden, falls Internet vorhanden).`,
    );
    continue;
  }
  const actual = sha256(readFileSync(source));
  if (actual !== model.sha256) {
    fail(
      `SHA-256-Mismatch fuer lokales Modell ${model.fileName} (erwartet ${model.sha256}, tatsaechlich ${actual}).`,
    );
  }
  console.log(`Kopiere Modell ${model.fileName} nach vendor/models/ ...`);
  cpSync(source, `${target}.part`);
  renameSync(`${target}.part`, target);
  console.log(`OK: ${model.fileName} kopiert und verifiziert.`);
}

console.log('');
console.log(`Vendor-Stand fuer ${platform} ist bereit (vendor/).`);
console.log('Naechster Schritt: vendor/ zusammen mit dem Repo zum Termin mitnehmen');
console.log('(Ablauf: docs/ON-SITE-PROTOKOLL.md).');
