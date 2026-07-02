/**
 * Modell-Downloader: streamt eine Datei, berechnet dabei den SHA-256 mit und
 * prueft ihn gegen eine fest hinterlegte Konstante. Der einzige erlaubte
 * externe Request der gesamten App laeuft ueber diesen Pfad (First-Run gegen
 * huggingface.co), danach nie wieder.
 *
 * Ablauf, auf Auditfestigkeit ausgelegt:
 * - Download in eine `.part`-Datei, nie direkt in die Zieldatei.
 * - SHA-256 wird waehrend des Streamens berechnet (kein zweiter Lesedurchlauf).
 * - Bei Checksummen- oder Groessen-Mismatch: `.part` loeschen, klare deutsche
 *   Fehlermeldung mit naechstem Schritt. Kein Rename einer defekten Datei.
 * - Erst nach erfolgreicher Verifikation atomares Rename auf den Zielpfad.
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { rename, rm, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { err, ok, type Result } from '../../shared/result';

export interface DownloadProgress {
  readonly receivedBytes: number;
  /** Gesamtgroesse laut Content-Length, falls bekannt. */
  readonly totalBytes: number | null;
  readonly percent: number | null;
}

export interface DownloadOptions {
  readonly url: string;
  /** Absoluter Zielpfad (ohne .part). */
  readonly destinationPath: string;
  readonly expectedSha256: string;
  readonly expectedByteSize?: number;
  readonly onProgress?: (progress: DownloadProgress) => void;
  /** Injizierbar fuer Tests; Default ist das globale fetch (undici). */
  readonly fetchImpl?: typeof fetch;
}

export type DownloadErrorKind =
  'network' | 'http-status' | 'size-mismatch' | 'checksum-mismatch' | 'io';

export interface DownloadError {
  readonly kind: DownloadErrorKind;
  /** Deutsche, handlungsleitende Fehlermeldung. */
  readonly message: string;
}

/** Berechnet den SHA-256 einer Datei (Hex, Kleinbuchstaben). */
export async function hashFileSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

export async function downloadModel(
  options: DownloadOptions,
): Promise<Result<{ sha256: string; byteSize: number }, DownloadError>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const partPath = `${options.destinationPath}.part`;

  // Reste eines abgebrochenen Vorlaufs entfernen: fuer 574 MB ist ein
  // vollstaendiger Neuladen robuster als ein fehleranfaelliges Resume.
  await rm(partPath, { force: true });

  let response: Response;
  try {
    response = await fetchImpl(options.url, { redirect: 'follow' });
  } catch (error) {
    return err({
      kind: 'network',
      message: `Der Modell-Download ist fehlgeschlagen (Netzwerkfehler: ${
        error instanceof Error ? error.message : String(error)
      }). Bitte die Internetverbindung pruefen und erneut versuchen. Nach dem einmaligen Download laeuft VoiceWall vollstaendig offline.`,
    });
  }

  if (!response.ok || response.body === null) {
    return err({
      kind: 'http-status',
      message: `Der Server hat den Modell-Download abgelehnt (HTTP ${String(
        response.status,
      )}). Bitte spaeter erneut versuchen oder die Modell-Quelle pruefen.`,
    });
  }

  const contentLengthHeader = response.headers.get('content-length');
  const totalBytes = contentLengthHeader === null ? null : Number.parseInt(contentLengthHeader, 10);
  const hash = createHash('sha256');
  let receivedBytes = 0;

  const source = Readable.fromWeb(response.body);
  source.on('data', (chunk: Buffer) => {
    hash.update(chunk);
    receivedBytes += chunk.length;
    if (options.onProgress) {
      const validTotal = totalBytes !== null && !Number.isNaN(totalBytes) ? totalBytes : null;
      options.onProgress({
        receivedBytes,
        totalBytes: validTotal,
        percent: validTotal === null ? null : Math.min(100, (receivedBytes / validTotal) * 100),
      });
    }
  });

  try {
    await pipeline(source, createWriteStream(partPath));
  } catch (error) {
    await rm(partPath, { force: true });
    return err({
      kind: 'io',
      message: `Der Modell-Download konnte nicht gespeichert werden (${
        error instanceof Error ? error.message : String(error)
      }). Bitte freien Speicherplatz und Schreibrechte pruefen.`,
    });
  }

  const actualSha256 = hash.digest('hex');

  if (options.expectedByteSize !== undefined && receivedBytes !== options.expectedByteSize) {
    await rm(partPath, { force: true });
    return err({
      kind: 'size-mismatch',
      message: `Die heruntergeladene Datei hat eine unerwartete Groesse (${String(
        receivedBytes,
      )} statt ${String(
        options.expectedByteSize,
      )} Bytes). Die Datei wurde geloescht. Bitte den Download erneut starten.`,
    });
  }

  if (actualSha256 !== options.expectedSha256) {
    await rm(partPath, { force: true });
    return err({
      kind: 'checksum-mismatch',
      message:
        'Die Pruefsumme der heruntergeladenen Modelldatei stimmt nicht mit dem erwarteten Wert ueberein. Die Datei wurde aus Sicherheitsgruenden geloescht. Bitte den Download erneut starten; tritt der Fehler wiederholt auf, ist die Quelle nicht vertrauenswuerdig.',
    });
  }

  try {
    await rename(partPath, options.destinationPath);
  } catch (error) {
    await rm(partPath, { force: true });
    return err({
      kind: 'io',
      message: `Die verifizierte Modelldatei konnte nicht abgelegt werden (${
        error instanceof Error ? error.message : String(error)
      }).`,
    });
  }

  const finalStat = await stat(options.destinationPath);
  return ok({ sha256: actualSha256, byteSize: finalStat.size });
}
