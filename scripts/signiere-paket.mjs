#!/usr/bin/env node
/**
 * Signiert eine Freigabe: bildet je uebergebenem Archiv die SHA256, baut daraus
 * den Manifest-Inhalt und signiert ihn mit dem privaten Ed25519-Schluessel.
 * Ergebnis ist manifest.json.
 *
 * Die Integritaetseinheit ist das Archiv, nicht die Einzeldatei. Das umgeht die
 * fragile Einzeldatei-Betrachtung von Bundle-Strukturen (macOS-.app mit internen
 * Symlinks): das ganze Archiv wird gehasht, das Cockpit prueft diese Pruefsumme
 * vor dem Entpacken.
 *
 * Dieses Skript laeuft in den Release-Workflows der App-Repos. Es ist bewusst
 * selbst enthalten (ohne Import aus dem Cockpit) und prueft beim Start seine
 * kanonische Form gegen einen fest eingebauten Vektor (GOLDEN), damit es nie
 * unbemerkt von der Pruefform des Cockpits abdriftet. Der Vektor ist deckungs-
 * gleich mit dem Pin-Test im Cockpit (tests/kanonik.test.ts).
 *
 * Aufruf:
 *   MANIFEST_SIGN_KEY="$(cat key.pem)" node scripts/signiere-paket.mjs \
 *     --werkzeug voicewall --quelle LZimmermann89/voicewall \
 *     --commit <sha> --paketVersion 1.2.3 --ausgabe manifest.json \
 *     --artefakt macos-arm64:voicewall-macos-arm64.tar.gz \
 *     [--artefakt windows-x64:voicewall-windows-x64.zip ...]
 */
import { createHash, sign as cryptoSign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

/** Deterministische kanonische Form. Muss mit src/shared/manifest.ts uebereinstimmen. */
function kanonischerInhalt(inhalt) {
  const artefakte = [...inhalt.artefakte]
    .sort((a, b) => (a.dateiname < b.dateiname ? -1 : a.dateiname > b.dateiname ? 1 : 0))
    .map((a) => ({ plattform: a.plattform, dateiname: a.dateiname, sha256: a.sha256 }));
  return JSON.stringify({
    version: inhalt.version,
    werkzeug: inhalt.werkzeug,
    quelle: inhalt.quelle,
    commit: inhalt.commit,
    paketVersion: inhalt.paketVersion,
    artefakte,
  });
}

// Fest eingebauter Vektor, deckungsgleich mit dem Pin-Test im Cockpit.
const GOLDEN_INHALT = {
  version: 1,
  werkzeug: 'beispiel',
  quelle: 'eigner/repo',
  commit: 'abc1234',
  paketVersion: '1.0.0',
  artefakte: [
    { plattform: 'macos-arm64', dateiname: 'b.tar.gz', sha256: 'b'.repeat(64) },
    { plattform: 'linux-x64', dateiname: 'a.tar.gz', sha256: 'a'.repeat(64) },
  ],
};
const GOLDEN_ERWARTET =
  '{"version":1,"werkzeug":"beispiel","quelle":"eigner/repo","commit":"abc1234",' +
  '"paketVersion":"1.0.0","artefakte":[{"plattform":"linux-x64","dateiname":"a.tar.gz",' +
  '"sha256":"' +
  'a'.repeat(64) +
  '"},{"plattform":"macos-arm64","dateiname":"b.tar.gz","sha256":"' +
  'b'.repeat(64) +
  '"}]}';

function selbsttest() {
  const ist = kanonischerInhalt(GOLDEN_INHALT);
  if (ist !== GOLDEN_ERWARTET) {
    console.error(
      'Selbsttest fehlgeschlagen: die kanonische Form weicht vom eingebauten Vektor ab.\n' +
        `erwartet: ${GOLDEN_ERWARTET}\nerhalten: ${ist}`,
    );
    process.exit(1);
  }
}

function argWert(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

function alleArgWerte(name) {
  const werte = [];
  for (let i = 0; i < process.argv.length - 1; i++) {
    if (process.argv[i] === name) werte.push(process.argv[i + 1]);
  }
  return werte;
}

function main() {
  selbsttest();

  const werkzeug = argWert('--werkzeug');
  const quelle = argWert('--quelle');
  const commit = argWert('--commit');
  const paketVersion = argWert('--paketVersion');
  const ausgabe = argWert('--ausgabe');
  const artefaktArgs = alleArgWerte('--artefakt');
  const key = process.env.MANIFEST_SIGN_KEY;

  for (const [name, wert] of [
    ['--werkzeug', werkzeug],
    ['--quelle', quelle],
    ['--commit', commit],
    ['--paketVersion', paketVersion],
    ['--ausgabe', ausgabe],
  ]) {
    if (!wert) {
      console.error(`Fehlt: ${name}`);
      process.exit(1);
    }
  }
  if (artefaktArgs.length === 0) {
    console.error('Fehlt: mindestens ein --artefakt <plattform>:<pfad>');
    process.exit(1);
  }
  if (!key) {
    console.error(
      'Fehlt: Umgebungsvariable MANIFEST_SIGN_KEY (privater Schluessel im PEM-Format).',
    );
    process.exit(1);
  }

  const artefakte = artefaktArgs.map((arg) => {
    const trenner = arg.indexOf(':');
    if (trenner < 0) {
      console.error(`Ungueltiges --artefakt (erwartet plattform:pfad): ${arg}`);
      process.exit(1);
    }
    const plattform = arg.slice(0, trenner);
    const pfad = arg.slice(trenner + 1);
    const dateiname = pfad.split('/').pop();
    return {
      plattform,
      dateiname,
      sha256: createHash('sha256').update(readFileSync(pfad)).digest('hex'),
    };
  });

  const inhalt = { version: 1, werkzeug, quelle, commit, paketVersion, artefakte };
  const signatur = cryptoSign(null, Buffer.from(kanonischerInhalt(inhalt), 'utf8'), key).toString(
    'base64',
  );
  writeFileSync(ausgabe, JSON.stringify({ ...inhalt, signatur }, null, 2) + '\n');
  console.log(
    `Manifest geschrieben: ${ausgabe} (${String(artefakte.length)} Artefakt(e) signiert).`,
  );
}

main();
