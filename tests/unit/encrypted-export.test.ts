/**
 * Unit-Tests des verschluesselten Exports (.vwenc, M8, Entscheidung E30):
 * - Roundtrip: verschluesseln, entschluesseln, byte-identisch (DoD Punkt 6),
 * - falsches Passwort schlaegt sauber mit deutscher Meldung fehl,
 * - manipulierte Datei (Bit-Flip) schlaegt fehl (GCM-Authentizitaet),
 * - fremde/kaputte Datei wird als Nicht-vwenc erkannt,
 * - Header-Format: Magic, Version, KDF-Kennung; Salt/Nonce je Datei frisch.
 */
import { describe, expect, it } from 'vitest';
import {
  VWENC_KDF_SCRYPT,
  VWENC_MAGIC,
  VWENC_VERSION,
  decryptFromVwenc,
  encryptToVwenc,
} from '../../src/main/storage/encrypted-export';

const PASSWORT = 'korrektes-passwort-123';
const KLARTEXT = Buffer.from(
  '---\ntitel: "Prüfbericht Ä Ö Ü ä ö ü ß"\n---\n\nSehr geehrte Frau Schäfer, außergewöhnlich!\n',
  'utf8',
);

describe('encryptToVwenc / decryptFromVwenc', () => {
  it('Roundtrip: entschluesselter Inhalt ist byte-identisch', () => {
    const container = encryptToVwenc(KLARTEXT, PASSWORT);
    const plain = decryptFromVwenc(container, PASSWORT);
    expect(plain.ok).toBe(true);
    if (plain.ok) {
      expect(Buffer.compare(plain.value, KLARTEXT)).toBe(0);
    }
  });

  it('Header: Magic, Version und KDF-Kennung stehen an den dokumentierten Offsets', () => {
    const container = encryptToVwenc(KLARTEXT, PASSWORT);
    expect(container.subarray(0, 6).toString('ascii')).toBe(VWENC_MAGIC);
    expect(container[6]).toBe(VWENC_VERSION);
    expect(container[7]).toBe(VWENC_KDF_SCRYPT);
    // Ciphertext enthaelt den Klartext nie im Klartext.
    expect(container.includes(Buffer.from('Prüfbericht', 'utf8'))).toBe(false);
  });

  it('Salt und Nonce sind pro Datei frisch (gleicher Input, verschiedene Container)', () => {
    const a = encryptToVwenc(KLARTEXT, PASSWORT);
    const b = encryptToVwenc(KLARTEXT, PASSWORT);
    expect(a.equals(b)).toBe(false);
    expect(a.subarray(8, 24).equals(b.subarray(8, 24))).toBe(false); // Salt
    expect(a.subarray(24, 36).equals(b.subarray(24, 36))).toBe(false); // Nonce
  });

  it('falsches Passwort schlaegt sauber mit deutscher Meldung fehl', () => {
    const container = encryptToVwenc(KLARTEXT, PASSWORT);
    const result = decryptFromVwenc(container, 'falsches-passwort-456');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Passwort ist falsch');
      expect(result.error).toContain('unwiederbringlich');
    }
  });

  it('manipulierte Datei (Bit-Flip im Ciphertext) schlaegt fehl, nie halber Klartext', () => {
    const container = encryptToVwenc(KLARTEXT, PASSWORT);
    const tampered = Buffer.from(container);
    // Letztes Byte des Ciphertexts kippen.
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
    const result = decryptFromVwenc(tampered, PASSWORT);
    expect(result.ok).toBe(false);
  });

  it('fremde Datei ohne Magic wird als Nicht-vwenc erkannt', () => {
    const result = decryptFromVwenc(Buffer.from('kein vwenc container', 'utf8'), PASSWORT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('.vwenc');
    }
  });

  it('unbekannte Format-Version wird abgewiesen (Update-Hinweis)', () => {
    const container = encryptToVwenc(KLARTEXT, PASSWORT);
    const future = Buffer.from(container);
    future[6] = 0x63;
    const result = decryptFromVwenc(future, PASSWORT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('aktualisieren');
    }
  });

  it('leerer Klartext ist erlaubt und roundtrip-stabil', () => {
    const container = encryptToVwenc(Buffer.alloc(0), PASSWORT);
    const plain = decryptFromVwenc(container, PASSWORT);
    expect(plain.ok).toBe(true);
    if (plain.ok) {
      expect(plain.value.length).toBe(0);
    }
  });
});
