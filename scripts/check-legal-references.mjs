#!/usr/bin/env node
/**
 * CI-Gate gegen veraltete Rechtsverweise (ABARBEITUNG 3.12, Vorbereitung).
 *
 * Das Telemediengesetz (TMG) wurde am 14.05.2024 aufgehoben (Nachfolger:
 * DDG, Impressumspflicht in § 5 DDG); das TTDSG heisst seit Mai 2024 TDDDG.
 * Ein aktives "nach § 5 TMG"- oder "TTDSG"-Zitat in Rechtstexten, UI oder
 * README waere ein falscher Verweis und ein Glaubwuerdigkeitsschaden.
 *
 * Zielgenau (bewusst NICHT auf ABARBEITUNG.md/docs/-Analysedokumente, die TMG
 * historisch einordnen duerfen): geprueft werden nur die Orte, an denen
 * kuenftige Rechtstexte und Nutzertexte leben:
 *   - src/**            (UI-Texte, Meldungen)
 *   - README.md
 *   - resources/**      (mitgelieferte Texte/Manifeste)
 *   - rechtstexte/**    (kuenftige Rechtstexte, M9)
 *
 * Cross-Platform als Node-Skript (die CI laeuft auch auf Windows).
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = ['src', 'README.md', 'resources', 'rechtstexte'];
const TEXT_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs|json|html|css|md|txt|xml|yml|yaml)$/i;
const FORBIDDEN = /\b(TMG|TTDSG)\b/;

const hits = [];

function scanFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (FORBIDDEN.test(line)) {
      hits.push(`${relative(projectRoot, filePath)}:${String(index + 1)}: ${line.trim()}`);
    }
  });
}

function scanDir(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && TEXT_EXTENSIONS.test(entry.name)) {
      scanFile(fullPath);
    }
  }
}

for (const target of TARGETS) {
  const fullPath = join(projectRoot, target);
  if (!existsSync(fullPath)) {
    continue;
  }
  if (statSync(fullPath).isDirectory()) {
    scanDir(fullPath);
  } else {
    scanFile(fullPath);
  }
}

if (hits.length > 0) {
  console.error(
    'FEHLER: Veraltete Rechtsverweise gefunden (TMG ist seit 14.05.2024 DDG, TTDSG ist TDDDG):',
  );
  for (const hit of hits) {
    console.error(`  ${hit}`);
  }
  process.exit(1);
}
console.log('OK: Keine aktiven TMG-/TTDSG-Zitate in src/, README.md, resources/, rechtstexte/.');
