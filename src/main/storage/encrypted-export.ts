/**
 * Verschluesselter Einzel-Export als .vwenc-Datei (M8, Risiko R16,
 * Entscheidung E30).
 *
 * BEWUSST KEIN ZIP-mit-Passwort: Node bringt keine ZIP-Verschluesselung mit
 * und das klassische ZipCrypto ist kryptografisch gebrochen; eine neue
 * (native) Laufzeit-Dependency nur dafuer widerspraeche der
 * Null-Dependency-Regel. Stattdessen ein eigenes, schlichtes
 * Container-Format auf Basis von Node-crypto (alles Built-ins):
 *
 *   Offset  Laenge  Inhalt
 *   0       6       Magic "VWENC1" (ASCII)
 *   6       1       Format-Version (0x01)
 *   7       1       KDF-Kennung (0x01 = scrypt, N=16384, r=8, p=1, 32 Byte)
 *   8       16      Salt (zufaellig, pro Datei neu)
 *   24      12      IV/Nonce fuer AES-256-GCM (zufaellig, pro Datei neu)
 *   36      16      GCM-Auth-Tag
 *   52      n       Ciphertext (AES-256-GCM)
 *
 * Eigenschaften:
 * - AES-256-GCM: authentifizierte Verschluesselung. Ein falsches Passwort
 *   ODER eine manipulierte Datei schlaegt beim Auth-Tag-Check hart fehl
 *   (deutsche Fehlermeldung, nie halb entschluesselter Muell).
 * - Schluesselableitung scrypt (memory-hard) mit den Node-Defaults
 *   N=16384, r=8, p=1; die Parameter sind ueber die KDF-Kennung im Header
 *   versioniert und damit spaeter aenderbar.
 * - Das Passwort (Mindestlaenge 12, erzwungen an der IPC-Grenze und in der
 *   UI) wird NIRGENDS gespeichert oder geloggt. Passwortverlust bedeutet
 *   unwiederbringlichen Datenverlust; die UI sagt das ausdruecklich.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { err, ok, type Result } from '../../shared/result';

export const VWENC_EXTENSION = '.vwenc';
export const VWENC_MAGIC = 'VWENC1';
export const VWENC_VERSION = 0x01;
export const VWENC_KDF_SCRYPT = 0x01;

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const HEADER_LENGTH = VWENC_MAGIC.length + 2 + SALT_LENGTH + IV_LENGTH + TAG_LENGTH;

/** scrypt-Parameter der KDF-Kennung 0x01 (Node-Defaults, dokumentiert). */
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function deriveKey(passwort: string, salt: Buffer): Buffer {
  return scryptSync(
    Buffer.from(passwort.normalize('NFC'), 'utf8'),
    salt,
    KEY_LENGTH,
    SCRYPT_PARAMS,
  );
}

/** Verschluesselt einen Klartext-Buffer zu einem .vwenc-Container. */
export function encryptToVwenc(plain: Uint8Array, passwort: string): Buffer {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(passwort, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  key.fill(0);
  return Buffer.concat([
    Buffer.from(VWENC_MAGIC, 'ascii'),
    Buffer.from([VWENC_VERSION, VWENC_KDF_SCRYPT]),
    salt,
    iv,
    tag,
    ciphertext,
  ]);
}

/**
 * Entschluesselt einen .vwenc-Container. Erwartbare Fehler (kein
 * VoiceWall-Container, unbekannte Version, falsches Passwort, manipulierte
 * Datei) kommen als deutsche Fehler-Results zurueck.
 */
export function decryptFromVwenc(container: Uint8Array, passwort: string): Result<Buffer, string> {
  const buffer = Buffer.from(container.buffer, container.byteOffset, container.byteLength);
  if (
    buffer.length < HEADER_LENGTH ||
    buffer.subarray(0, VWENC_MAGIC.length).toString('ascii') !== VWENC_MAGIC
  ) {
    return err(
      'Diese Datei ist keine VoiceWall-verschlüsselte Datei (.vwenc) oder sie ist unvollständig.',
    );
  }
  const version = buffer[VWENC_MAGIC.length];
  const kdf = buffer[VWENC_MAGIC.length + 1];
  if (version !== VWENC_VERSION || kdf !== VWENC_KDF_SCRYPT) {
    return err(
      'Diese .vwenc-Datei wurde mit einer neueren VoiceWall-Version erstellt. Bitte VoiceWall aktualisieren.',
    );
  }
  let offset = VWENC_MAGIC.length + 2;
  const salt = buffer.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;
  const iv = buffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  const tag = buffer.subarray(offset, offset + TAG_LENGTH);
  offset += TAG_LENGTH;
  const ciphertext = buffer.subarray(offset);
  const key = deriveKey(passwort, Buffer.from(salt));
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return ok(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
  } catch {
    // GCM-Auth-Fehler: falsches Passwort oder veraenderte Datei. Beides ist
    // von aussen nicht unterscheidbar (und soll es auch nicht sein).
    return err(
      'Die Entschlüsselung ist fehlgeschlagen: das Passwort ist falsch oder die Datei wurde verändert. Hinweis: bei Passwortverlust ist der Inhalt unwiederbringlich verloren.',
    );
  } finally {
    key.fill(0);
  }
}
