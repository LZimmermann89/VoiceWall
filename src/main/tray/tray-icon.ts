/**
 * Programmatisch erzeugte Tray-Icons (kein Download, kein Binaer-Asset im
 * Repo: der komplette Pixelinhalt entsteht auditierbar aus diesem Code).
 *
 * Es wird ein minimaler, standardkonformer PNG-Encoder verwendet (Signatur,
 * IHDR, IDAT mit zlib-Deflate der RGBA-Scanlines, IEND). Node liefert das
 * Deflate ueber node:zlib, es ist keine Zusatz-Dependency noetig.
 *
 * Motive:
 * - idle: Ring (Kreis-Outline) in Schwarz mit Alpha, als macOS-Template-Image
 *   nutzbar (das OS faerbt es passend zu Hell-/Dunkelmodus).
 * - recording: gefuellter roter Punkt, bewusst KEIN Template-Image, damit die
 *   Farbe als deutlicher Aufnahme-Indikator sichtbar bleibt.
 */
import { deflateSync } from 'node:zlib';

export type TrayIconVariant = 'idle' | 'recording';

/** CRC32 (PNG-Chunk-Pruefsumme), Standard-Implementierung. */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, payload: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const crcInput = Buffer.concat([typeBytes, payload]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([length, typeBytes, Buffer.from(payload), crc]);
}

/** Kodiert rohe RGBA-Pixel (size x size) als PNG. */
export function encodePng(size: number, rgba: Uint8Array): Buffer {
  if (rgba.length !== size * size * 4) {
    throw new Error('encodePng: RGBA-Puffer passt nicht zur Bildgroesse.');
  }
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // Breite
  ihdr.writeUInt32BE(size, 4); // Hoehe
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // Farbtyp RGBA
  ihdr[10] = 0; // Kompression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // kein Interlace

  // Scanlines mit Filter-Byte 0 (None) je Zeile.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    rgba
      .subarray(y * size * 4, (y + 1) * size * 4)
      .forEach((value, index) => (raw[rowStart + 1 + index] = value));
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

/**
 * Zeichnet die Icon-Variante als RGBA-Pixel. Weiche Kanten ueber
 * distanzbasiertes Alpha (einfaches Anti-Aliasing).
 */
function renderRgba(size: number, variant: TrayIconVariant): Uint8Array {
  const rgba = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;
  const outerRadius = size * 0.42;
  const ringWidth = Math.max(1.2, size * 0.09);
  // Template-Icons sind schwarz (macOS invertiert selbst); der
  // Aufnahme-Punkt ist rot und kein Template.
  const color = variant === 'idle' ? [0, 0, 0] : [223, 41, 41];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - center, y - center);
      // Ring (idle): Abstand zur Ringmitte bestimmt die Deckung.
      // Gefuellter Punkt (recording): Abstand zum Mittelpunkt.
      const ringDistance = Math.abs(distance - (outerRadius - ringWidth / 2));
      const coverage =
        variant === 'idle'
          ? Math.min(1, Math.max(0, ringWidth / 2 + 0.5 - ringDistance))
          : Math.min(1, Math.max(0, outerRadius + 0.5 - distance));
      const offset = (y * size + x) * 4;
      rgba[offset] = color[0] ?? 0;
      rgba[offset + 1] = color[1] ?? 0;
      rgba[offset + 2] = color[2] ?? 0;
      rgba[offset + 3] = Math.round(coverage * 255);
    }
  }
  return rgba;
}

/** Erzeugt das Tray-Icon-PNG in der gewuenschten Groesse (16 oder 32 px). */
export function createTrayIconPng(size: 16 | 32, variant: TrayIconVariant): Buffer {
  return encodePng(size, renderRgba(size, variant));
}
