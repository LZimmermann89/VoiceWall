#!/usr/bin/env node
/**
 * Erzeugt das VoiceWall-App-Icon vollstaendig programmatisch und offline
 * (kein Download, kein Grafik-Tool, kein Compiler).
 *
 * Motiv: dunkles, abgerundetes Quadrat (fast-schwarze Tinte) mit einer
 * stilisierten Schallwellen-Glyphe aus sieben vertikalen Balken in Elfenbein;
 * der mittlere Balken traegt das Siegel-Gruen der Marke ("geprueft/lokal").
 * Die Farben entsprechen der UI-Palette (src/renderer/styles.css).
 *
 * Technik: Die Pixel werden per Signed-Distance-Funktion (abgerundete
 * Rechtecke) mit 2x2-Supersampling gerendert und als PNG kodiert. Der
 * PNG-Encoder ist bewusst selbst geschrieben (nur node:zlib fuer deflate,
 * CRC32 von Hand): null neue Dependencies, reproduzierbar, auditierbar.
 *
 * Ausgaben:
 *   resources/build/icon.iconset/icon_<n>x<n>[@2x].png  (alle Apple-Groessen)
 *   resources/build/icon.icns                            (nur macOS, iconutil)
 *   resources/build/icon.png                             (512 px, generisch)
 *
 * Idempotent: existiert icon.icns bereits, wird nichts neu erzeugt
 * (Aufruf mit --force erzwingt die Neuerzeugung). Laeuft im `package`-Skript
 * vor electron-vite/electron-builder.
 */
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildResources = join(projectRoot, 'resources', 'build');
const iconsetDir = join(buildResources, 'icon.iconset');
const icnsPath = join(buildResources, 'icon.icns');
const force = process.argv.includes('--force');

// Markenfarben (identisch zur Renderer-Palette).
const INK = [26, 25, 22]; // fast-schwarze Tinte #1A1916
const IVORY = [244, 241, 232]; // Elfenbein #F4F1E8
const SEAL_GREEN = [30, 92, 69]; // Siegel-Gruen #1E5C45

/** Relative Balkenhoehen der Schallwellen-Glyphe (symmetrisch). */
const BARS = [0.2, 0.42, 0.64, 0.9, 0.64, 0.42, 0.2];

// ---------------------------------------------------------------------------
// CRC32 (PNG-Standard, Polynom 0xEDB88320)
// ---------------------------------------------------------------------------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Ein PNG-Chunk: Laenge, Typ, Daten, CRC ueber Typ+Daten. */
function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/** Kodiert einen RGBA-Pixelpuffer (Uint8Array, size*size*4) als PNG. */
function encodePng(pixels, size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // Farbtyp RGBA
  // Kompression 0, Filter 0, kein Interlace.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // Filtertyp 0 (None) je Scanline
    pixels
      .subarray(y * size * 4, (y + 1) * size * 4)
      .forEach((value, index) => (raw[y * (size * 4 + 1) + 1 + index] = value));
  }
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Zeichnen per Signed-Distance-Funktion (abgerundetes Rechteck)
// ---------------------------------------------------------------------------
/** Signierte Distanz eines Punkts zu einem abgerundeten Rechteck. */
function roundedRectDistance(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - radius;
}

/** Rendert das Icon in der gegebenen Groesse als RGBA-Puffer. */
function renderIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  // Apple-Konvention: das Motiv fuellt nicht die volle Flaeche, sondern laesst
  // einen transparenten Rand (rund 9 Prozent je Seite).
  const margin = size * 0.09;
  const squareHalf = (size - 2 * margin) / 2;
  const center = size / 2;
  const cornerRadius = squareHalf * 0.45;

  // Schallwellen-Balken: Geometrie relativ zur Innenflaeche.
  const inner = squareHalf * 2;
  const barWidth = inner * 0.072;
  const gap = inner * 0.052;
  const totalBarsWidth = BARS.length * barWidth + (BARS.length - 1) * gap;
  const firstBarX = center - totalBarsWidth / 2 + barWidth / 2;
  const maxBarHalf = inner * 0.31;
  const accentIndex = (BARS.length - 1) / 2;

  const samples = [
    [-0.25, -0.25],
    [0.25, -0.25],
    [-0.25, 0.25],
    [0.25, 0.25],
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const [sx, sy] of samples) {
        const px = x + 0.5 + sx;
        const py = y + 0.5 + sy;
        // Grundflaeche: dunkles abgerundetes Quadrat.
        const dSquare = roundedRectDistance(
          px,
          py,
          center,
          center,
          squareHalf,
          squareHalf,
          cornerRadius,
        );
        const squareAlpha = Math.min(1, Math.max(0, 0.5 - dSquare));
        if (squareAlpha <= 0) {
          continue;
        }
        // Balken der Schallwellen-Glyphe.
        let color = INK;
        for (let barIndex = 0; barIndex < BARS.length; barIndex += 1) {
          const barCx = firstBarX + barIndex * (barWidth + gap);
          const barHalfH = maxBarHalf * BARS[barIndex];
          const dBar = roundedRectDistance(
            px,
            py,
            barCx,
            center,
            barWidth / 2,
            barHalfH,
            barWidth / 2,
          );
          if (dBar < 0.5) {
            const barAlpha = Math.min(1, Math.max(0, 0.5 - dBar));
            const barColor = barIndex === accentIndex ? SEAL_GREEN : IVORY;
            color = [
              INK[0] + (barColor[0] - INK[0]) * barAlpha,
              INK[1] + (barColor[1] - INK[1]) * barAlpha,
              INK[2] + (barColor[2] - INK[2]) * barAlpha,
            ];
            break;
          }
        }
        r += color[0] * squareAlpha;
        g += color[1] * squareAlpha;
        b += color[2] * squareAlpha;
        a += squareAlpha;
      }
      const offset = (y * size + x) * 4;
      if (a > 0) {
        pixels[offset] = Math.round(r / a);
        pixels[offset + 1] = Math.round(g / a);
        pixels[offset + 2] = Math.round(b / a);
        pixels[offset + 3] = Math.round((a / samples.length) * 255);
      }
    }
  }
  return pixels;
}

// ---------------------------------------------------------------------------
// Hauptablauf
// ---------------------------------------------------------------------------
if (existsSync(icnsPath) && !force) {
  console.log(`OK: ${icnsPath} existiert bereits (Neuerzeugung mit --force).`);
  process.exit(0);
}

mkdirSync(iconsetDir, { recursive: true });

/** Apple-iconset-Dateinamen: [Punktgroesse, Skalierung]. */
const ICONSET_ENTRIES = [
  [16, 1],
  [16, 2],
  [32, 1],
  [32, 2],
  [128, 1],
  [128, 2],
  [256, 1],
  [256, 2],
  [512, 1],
  [512, 2],
];

const rendered = new Map();
for (const [points, scale] of ICONSET_ENTRIES) {
  const pixelSize = points * scale;
  if (!rendered.has(pixelSize)) {
    rendered.set(pixelSize, encodePng(renderIcon(pixelSize), pixelSize));
  }
  const suffix = scale === 2 ? '@2x' : '';
  const fileName = `icon_${points}x${points}${suffix}.png`;
  writeFileSync(join(iconsetDir, fileName), rendered.get(pixelSize));
  console.log(`OK: ${fileName} (${pixelSize}x${pixelSize}) erzeugt.`);
}

// Generisches 512er-PNG (z. B. fuer eine spaetere Windows-/Linux-Pipeline).
writeFileSync(join(buildResources, 'icon.png'), rendered.get(512));
console.log('OK: icon.png (512x512) erzeugt.');

if (process.platform === 'darwin') {
  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath]);
  console.log(`OK: ${icnsPath} erzeugt (iconutil).`);
} else {
  console.log('Hinweis: icon.icns wird nur auf macOS erzeugt (iconutil noetig).');
}
