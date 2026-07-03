#!/usr/bin/env node
/**
 * Supply-Chain-Pruefung der prebuilt nativen Whisper-Binaries (ABARBEITUNG 3.8).
 *
 * Prueft:
 * 1. Die installierte Version von @fugood/whisper.node entspricht exakt der
 *    Version, fuer die die Hashes unten hinterlegt sind (Drift-Erkennung).
 * 2. Der SHA-256 der plattformrichtigen `index.node` entspricht der fest
 *    hinterlegten Konstante. Mismatch = Abbruch (untergeschobenes Binary).
 * 3. Kein Paket im node_modules-Baum bringt eine KOMPILIERENDE `binding.gyp`
 *    mit (phantom-gyp-Falle, Miasma-Wurm Juni 2026): eine binding.gyp direkt
 *    neben einer package.json ohne eigenes install-/preinstall-Skript wuerde
 *    npm zum node-gyp-Build verleiten. VoiceWall ist compilerfrei.
 *
 * Herkunft der Hash-Konstanten (einmaliger Build-Zeit-Vorgang, 2026-07-03):
 * Fuer jede der sechs Zielplattformen wurde der offizielle npm-Registry-
 * Tarball der Version 1.0.22 geladen und die enthaltene `package/index.node`
 * gehasht:
 *
 *   npm view "@fugood/node-whisper-<plattform>@1.0.22" dist.tarball
 *   curl -sL <tarball-url> -o pkg.tgz && tar -xzf pkg.tgz
 *   shasum -a 256 package/index.node
 *
 * Die lokal installierte darwin-arm64-Datei wurde zusaetzlich unabhaengig
 * gehasht und stimmt mit dem Registry-Tarball ueberein. Bei einem Versions-
 * Update von @fugood/whisper.node MUESSEN diese Konstanten bewusst neu
 * berechnet und im Review nachvollzogen werden.
 *
 * Laeuft in der CI direkt nach `npm ci` sowie lokal via
 * `node scripts/verify-checksums.mjs`.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const nodeModules = join(projectRoot, 'node_modules');

/** Version, fuer die die Hashes gelten (muss zur package.json passen). */
const EXPECTED_ADDON_VERSION = '1.0.22';

/**
 * SHA-256 der `index.node` je Plattform-Subpaket
 * @fugood/node-whisper-<platform>-<arch>@1.0.22 (Quelle: npm-Registry-
 * Tarballs, siehe Kopfkommentar).
 */
const EXPECTED_NATIVE_SHA256 = {
  'darwin-arm64': '278b07326937df633753e06f93efd4b92aa099a75f891f8c3cc0961ad909174a',
  'darwin-x64': '8d835a62b15fe8a9058476d5533d86634de92f0d7fc3f4cc09dff644cd66cea9',
  'win32-x64': '4c663298b6d41f57415e1b12db61819176ab23f1f3ba87e47136628c0cea293d',
  'win32-arm64': 'd01bae84c439f7bab9014328fc5e288ab8e02a6229f3f4a8225660c620778020',
  'linux-x64': 'af911d91071657bd35720b4f278292a51a6724397e5aceb6383b43b15efd2056',
  'linux-arm64': 'e7240c9e237d1dcc1e3299c4dbf8a1cc5c2eeea3e35b589dfe0fcf6665a27925',
};

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`FEHLER: ${message}`);
};
const okay = (message) => {
  console.log(`OK: ${message}`);
};

// ---------------------------------------------------------------------------
// 1. Versions-Drift-Erkennung
// ---------------------------------------------------------------------------
const addonPackageJsonPath = join(nodeModules, '@fugood', 'whisper.node', 'package.json');
if (!existsSync(addonPackageJsonPath)) {
  fail('@fugood/whisper.node ist nicht installiert (npm ci ausfuehren).');
} else {
  const addonVersion = JSON.parse(readFileSync(addonPackageJsonPath, 'utf8')).version;
  if (addonVersion === EXPECTED_ADDON_VERSION) {
    okay(`@fugood/whisper.node Version ${addonVersion} entspricht den hinterlegten Hashes.`);
  } else {
    fail(
      `@fugood/whisper.node ist ${addonVersion}, die Hashes gelten fuer ${EXPECTED_ADDON_VERSION}. ` +
        'Bitte Hashes bewusst neu berechnen (siehe Kopfkommentar) und aktualisieren.',
    );
  }
}

// ---------------------------------------------------------------------------
// 2. SHA-256 der plattformrichtigen index.node
// ---------------------------------------------------------------------------
const platformKey = `${process.platform}-${process.arch}`;
const expectedSha = EXPECTED_NATIVE_SHA256[platformKey];
if (expectedSha === undefined) {
  fail(`Keine Hash-Konstante fuer Plattform ${platformKey} hinterlegt.`);
} else {
  const nativePath = join(nodeModules, '@fugood', `node-whisper-${platformKey}`, 'index.node');
  if (!existsSync(nativePath)) {
    fail(`Natives Binary fehlt: ${nativePath}`);
  } else {
    const actualSha = createHash('sha256').update(readFileSync(nativePath)).digest('hex');
    if (actualSha === expectedSha) {
      okay(`SHA-256 der index.node (${platformKey}) stimmt: ${actualSha}`);
    } else {
      fail(
        `SHA-256-Mismatch fuer ${nativePath}\n  erwartet: ${expectedSha}\n  tatsaechlich: ${actualSha}\n` +
          'Das Binary ist nicht das erwartete. NICHT weiterverwenden; node_modules loeschen und npm ci erneut ausfuehren.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Keine kompilierende binding.gyp im Baum
// ---------------------------------------------------------------------------
/**
 * Eine binding.gyp ist nur dann ein Kompilier-Trigger, wenn sie direkt neben
 * einer package.json liegt, die KEIN eigenes install-/preinstall-Skript
 * definiert (dann injiziert npm `node-gyp rebuild`). Vendorte Quellbaeume in
 * Unterordnern (z. B. whisper.cpp-Beispiele) triggern nichts.
 */
function findCompilingGyp(dir, results) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const hasPackageJson = entries.some((entry) => entry.isFile() && entry.name === 'package.json');
  const hasBindingGyp = entries.some((entry) => entry.isFile() && entry.name === 'binding.gyp');
  if (hasPackageJson && hasBindingGyp) {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const scripts = pkg.scripts ?? {};
    if (scripts.install === undefined && scripts.preinstall === undefined) {
      results.push(dir);
    }
  }
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== '.bin') {
      findCompilingGyp(join(dir, entry.name), results);
    }
  }
}

if (existsSync(nodeModules) && statSync(nodeModules).isDirectory()) {
  const compilingGyps = [];
  findCompilingGyp(nodeModules, compilingGyps);
  if (compilingGyps.length === 0) {
    okay('Keine kompilierende binding.gyp im Dependency-Baum (compilerfreie Installation).');
  } else {
    for (const dir of compilingGyps) {
      fail(`Kompilierende binding.gyp gefunden: ${dir}`);
    }
  }
} else {
  fail('node_modules fehlt (npm ci ausfuehren).');
}

if (failures > 0) {
  console.error(`\n${failures} Pruefung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle Supply-Chain-Pruefungen bestanden.');
