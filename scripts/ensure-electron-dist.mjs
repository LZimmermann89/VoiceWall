/**
 * Stellt sicher, dass das prebuilt Electron-Binary vorhanden ist
 * (node_modules/electron/dist), bevor dev/package laufen.
 *
 * Hintergrund (Entscheidung E17/E48): Unter den restriktiven
 * npm-Defaults (ab npm 11.12, vom Bauplan fuer npm v12 vorhergesagt)
 * laeuft das Electron-Postinstall bei `npm ci` in einem frischen Klon
 * nicht mehr automatisch; das Binary fehlt dann und electron-builder
 * bricht mit "The specified electronDist does not exist" ab. Die
 * Setup-Skripte (install/) behandeln das seit M6; dieser Schritt macht
 * zusaetzlich den dokumentierten Entwickler-Weg (`npm ci` und dann
 * `npm run package` bzw. `npm run dev`) selbstheilend.
 *
 * Verhalten: existiert dist/ bereits, passiert nichts (idempotent,
 * Millisekunden). Fehlt es, wird Electrons eigenes install.js
 * ausgefuehrt: das bedient sich zuerst aus dem lokalen Electron-Cache
 * und laedt nur bei leerem Cache einmalig von den offiziellen
 * Electron-Releases (Toolchain-Bezug zur Entwicklungszeit, nicht zur
 * Laufzeit; die App selbst bleibt ohne externe Requests).
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);

let electronDir;
try {
  electronDir = dirname(require.resolve('electron/package.json'));
} catch {
  console.error(
    'Electron ist nicht installiert. Bitte zuerst `npm ci` ausfuehren (niemals mit --omit=optional).',
  );
  process.exit(1);
}

const distDir = join(electronDir, 'dist');
if (existsSync(distDir)) {
  process.exit(0);
}

console.log(
  'Electron-Binary fehlt (Postinstall wurde von npm uebersprungen). Hole es ueber Electrons install.js nach ...',
);
const result = spawnSync(process.execPath, [join(electronDir, 'install.js')], {
  stdio: 'inherit',
});
if (result.status !== 0 || !existsSync(distDir)) {
  console.error(
    'Das Electron-Binary konnte nicht bereitgestellt werden. Naechster Schritt: Internetverbindung pruefen und `node node_modules/electron/install.js` manuell ausfuehren (Details im Log oberhalb).',
  );
  process.exit(1);
}
console.log('Electron-Binary bereitgestellt.');
