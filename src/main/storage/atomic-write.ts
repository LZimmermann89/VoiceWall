/**
 * Atomares Schreiben von Dateien (Temp plus Rename, ABARBEITUNG 4.4.4).
 *
 * Jeder Schreibpfad des Ordner-als-Datenbank-Modells laeuft ueber diese
 * Funktion: erst vollstaendig in eine Tempdatei IM SELBEN Verzeichnis
 * schreiben (rename ist nur innerhalb eines Dateisystems atomar), dann per
 * `rename` an die finale Stelle bewegen. Ein Absturz mitten im Schreiben
 * hinterlaesst nie eine halb geschriebene Zieldatei; schlimmstenfalls bleibt
 * eine Tempdatei mit `.voicewall-tmp-`-Praefix liegen, die beim naechsten
 * Schreiben irrelevant ist und am Punkt-Praefix als versteckt erkennbar
 * bleibt.
 */
import { randomBytes } from 'node:crypto';
import { chmod, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

/** Praefix aller Tempdateien (versteckt, eindeutig VoiceWall zuordenbar). */
export const TMP_PREFIX = '.voicewall-tmp-';

/**
 * Schreibt `content` (Text oder Binaerdaten, z. B. PDF/.vwenc seit M8)
 * atomar nach `filePath` (Default-Rechte 0600). Bei einem Fehler wird die
 * Tempdatei entfernt und der Fehler weitergereicht; die Zieldatei bleibt in
 * ihrem vorherigen Zustand.
 */
export async function writeFileAtomic(
  filePath: string,
  content: string | Uint8Array,
  mode = 0o600,
): Promise<void> {
  const tmpPath = join(
    dirname(filePath),
    `${TMP_PREFIX}${randomBytes(6).toString('hex')}-${basename(filePath)}`,
  );
  try {
    await writeFile(tmpPath, content, { mode });
    // `mode` greift nur beim Anlegen; explizit haerten (POSIX).
    if (process.platform !== 'win32') {
      await chmod(tmpPath, mode);
    }
    await rename(tmpPath, filePath);
  } catch (error) {
    await rm(tmpPath, { force: true });
    throw error;
  }
}
