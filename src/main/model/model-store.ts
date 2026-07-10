/**
 * Verwaltung der lokalen Modelldateien: Praesenz, Integritaet und Cache.
 *
 * Entscheidung zur Checksummen-Pruefung (bewusst dokumentiert):
 * Die Q5_0-Datei ist 574 MB. Sie bei jedem Start komplett zu hashen kostet
 * Sekunden und ist unnoetig, wenn sich die Datei nicht geaendert hat. Deshalb:
 * - Beim ERSTEN Mal (nach Download oder wenn kein Marker existiert) wird die
 *   Datei einmal voll gehasht und das Ergebnis in einem Integritaets-Marker
 *   (`.model-integrity.json`) gespeichert, zusammen mit Groesse und mtime.
 * - Bei jedem weiteren Start wird nur `stat` gelesen. Stimmen Groesse und mtime
 *   mit dem Marker ueberein und der Marker-Hash mit der erwarteten Konstante,
 *   gilt die Datei als intakt, ohne erneutes Hashen.
 * - Weicht Groesse oder mtime ab (Datei veraendert/getauscht), wird neu gehasht
 *   und der Marker aktualisiert. Passt der Hash dann nicht zur Konstante, gilt
 *   die Datei als beschaedigt.
 * Der Marker ist reine Optimierung: die Sicherheitsentscheidung haengt immer an
 * der fest im Code stehenden SHA-256-Konstante, nie am Marker allein.
 */
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { err, ok, type Result } from '../../shared/result';
import { texte } from '../i18n';
import {
  downloadModel,
  hashFileSha256,
  type DownloadError,
  type DownloadProgress,
} from './downloader';
import { MODEL_DESCRIPTORS, modelLabelFor, type ModelDescriptor } from './model-catalog';

interface IntegrityMarkerEntry {
  sha256: string;
  byteSize: number;
  mtimeMs: number;
}
type IntegrityMarker = Record<string, IntegrityMarkerEntry>;

export interface ModelStatus {
  readonly descriptor: ModelDescriptor;
  readonly present: boolean;
  readonly path: string;
}

export interface EnsureModelError {
  readonly kind: 'missing' | 'corrupt' | DownloadError['kind'];
  readonly message: string;
}

/**
 * Meldung an den Aufrufer, dass eine Download-Quelle fehlgeschlagen ist und
 * die naechste versucht wird (E50). Nur Betriebslog-Zwecke; die fachliche
 * Fehlerbehandlung bleibt beim Result von ensureModel.
 */
export interface SourceFallbackInfo {
  /** Host der fehlgeschlagenen Quelle (nie die volle URL, log-sparsam). */
  readonly failedHost: string;
  readonly errorKind: DownloadError['kind'];
  /** 1-basierte Nummer des fehlgeschlagenen Versuchs. */
  readonly attempt: number;
  /** Gesamtzahl der verfuegbaren Quellen (Primaer plus Mirrors). */
  readonly maxAttempts: number;
}

export function getModelsDirectory(userDataPath: string): string {
  return join(userDataPath, 'models');
}

function markerPath(userDataPath: string): string {
  return join(getModelsDirectory(userDataPath), '.model-integrity.json');
}

async function readMarker(userDataPath: string): Promise<IntegrityMarker> {
  try {
    const raw = await readFile(markerPath(userDataPath), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }
    return parsed as IntegrityMarker;
  } catch {
    return {};
  }
}

async function writeMarker(userDataPath: string, marker: IntegrityMarker): Promise<void> {
  await writeFile(markerPath(userDataPath), JSON.stringify(marker, null, 2), { mode: 0o600 });
}

/**
 * Prueft, ob eine Modelldatei vorhanden und intakt ist. Nutzt den Marker, um
 * das teure Hashen der grossen Datei bei unveraenderter Datei zu vermeiden.
 */
async function verifyFile(
  userDataPath: string,
  descriptor: ModelDescriptor,
): Promise<Result<void, EnsureModelError>> {
  const filePath = join(getModelsDirectory(userDataPath), descriptor.fileName);
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return err({ kind: 'missing', message: texte().modelle.dateiFehlt(descriptor.fileName) });
  }

  const marker = await readMarker(userDataPath);
  const entry = marker[descriptor.fileName];
  const statMatchesMarker =
    entry !== undefined &&
    entry.byteSize === fileStat.size &&
    entry.mtimeMs === fileStat.mtimeMs &&
    entry.sha256 === descriptor.sha256;

  if (statMatchesMarker) {
    return ok(undefined);
  }

  // Kein gueltiger Marker: einmal voll hashen und Marker (neu) schreiben.
  const actualSha = await hashFileSha256(filePath);
  if (actualSha !== descriptor.sha256) {
    return err({
      kind: 'corrupt',
      message: texte().modelle.dateiBeschaedigt(descriptor.fileName),
    });
  }
  marker[descriptor.fileName] = {
    sha256: actualSha,
    byteSize: fileStat.size,
    mtimeMs: fileStat.mtimeMs,
  };
  await writeMarker(userDataPath, marker);
  return ok(undefined);
}

/** Host einer URL fuer log-sparsame Meldungen; nie die volle URL loggen. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unbekannt';
  }
}

/**
 * Stellt sicher, dass eine Modelldatei vorhanden und intakt ist. Fehlt oder
 * ist sie beschaedigt, wird sie (bei allowDownload) geladen und verifiziert.
 *
 * Quellen-Reihenfolge (E50): erst die Primaerquelle (descriptor.url), dann
 * die Mirrors (descriptor.mirrorUrls). Bei Netz-/HTTP-/Groessen-/
 * Checksummen-Fehlern wird die naechste Quelle versucht; bei einem lokalen
 * io-Fehler wird sofort abgebrochen, weil eine andere Quelle ein
 * Plattenproblem nicht loest. Jede Quelle wird gegen dieselbe SHA-256-
 * Konstante verifiziert; scheitern alle, kommt der letzte Fehler zurueck.
 */
export async function ensureModel(
  userDataPath: string,
  descriptor: ModelDescriptor,
  options: {
    allowDownload: boolean;
    onProgress?: (progress: DownloadProgress) => void;
    onSourceFallback?: (info: SourceFallbackInfo) => void;
  },
): Promise<Result<string, EnsureModelError>> {
  const dir = getModelsDirectory(userDataPath);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, descriptor.fileName);

  const verified = await verifyFile(userDataPath, descriptor);
  if (verified.ok) {
    return ok(filePath);
  }
  if (!options.allowDownload) {
    return err(
      verified.error.kind === 'missing'
        ? {
            kind: 'missing',
            message: texte().modelle.modellFehltDownloadNoetig(modelLabelFor(descriptor.id)),
          }
        : verified.error,
    );
  }

  // Beschaedigte Datei vorher entfernen, dann sauber neu laden.
  await rm(filePath, { force: true });
  const sources: readonly string[] = [descriptor.url, ...descriptor.mirrorUrls];
  let lastError: DownloadError | null = null;
  let downloaded: { sha256: string; byteSize: number } | null = null;
  for (const [index, sourceUrl] of sources.entries()) {
    const attempt = await downloadModel({
      url: sourceUrl,
      destinationPath: filePath,
      expectedSha256: descriptor.sha256,
      expectedByteSize: descriptor.byteSize,
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    });
    if (attempt.ok) {
      downloaded = attempt.value;
      break;
    }
    lastError = attempt.error;
    if (attempt.error.kind === 'io') {
      break;
    }
    if (index < sources.length - 1 && options.onSourceFallback) {
      options.onSourceFallback({
        failedHost: hostOf(sourceUrl),
        errorKind: attempt.error.kind,
        attempt: index + 1,
        maxAttempts: sources.length,
      });
    }
  }
  if (downloaded === null) {
    // lastError ist hier immer gesetzt (mindestens eine Quelle wurde
    // versucht); der Fallback existiert nur fuer die Typsicherheit.
    const error = lastError ?? {
      kind: 'network' as const,
      message: texte().modelle.downloadNetzwerkfehler('unbekannt'),
    };
    return err({ kind: error.kind, message: error.message });
  }

  const fileStat = await stat(filePath);
  const marker = await readMarker(userDataPath);
  marker[descriptor.fileName] = {
    sha256: downloaded.sha256,
    byteSize: downloaded.byteSize,
    mtimeMs: fileStat.mtimeMs,
  };
  await writeMarker(userDataPath, marker);
  return ok(filePath);
}

/**
 * Loescht eine Modelldatei kontrolliert (Modelle-Reiter, E46): Datei
 * entfernen und den Integritaets-Marker-Eintrag mit austragen, damit ein
 * spaeterer Download wieder sauber voll verifiziert wird. Die fachliche
 * Regel, WELCHE Modelle loeschbar sind (nie das Modell der aktiven
 * Firmensprache, nie das VAD), liegt beim Aufrufer (Orchestrator).
 */
export async function removeModelFile(
  userDataPath: string,
  descriptor: ModelDescriptor,
): Promise<Result<void, string>> {
  const filePath = join(getModelsDirectory(userDataPath), descriptor.fileName);
  try {
    await rm(filePath, { force: true });
    const marker = await readMarker(userDataPath);
    if (marker[descriptor.fileName] !== undefined) {
      // Bewusst ohne dynamic delete (lint): Marker ohne den Eintrag neu bauen.
      const bereinigt = Object.fromEntries(
        Object.entries(marker).filter(([fileName]) => fileName !== descriptor.fileName),
      );
      await writeMarker(userDataPath, bereinigt);
    }
    return ok(undefined);
  } catch (error) {
    return err(
      texte().modelle.loeschenFehler(error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Praesenz-/Integritaetsstatus der uebergebenen Modelle (ohne Download).
 * Default sind die Pflichtmodelle des Standardbetriebs (Q5_0 plus VAD);
 * der Wizard fragt zusaetzlich das optionale fp16-Modell ab.
 */
export async function getModelStatuses(
  userDataPath: string,
  descriptors: readonly ModelDescriptor[] = MODEL_DESCRIPTORS,
): Promise<ModelStatus[]> {
  const dir = getModelsDirectory(userDataPath);
  const statuses: ModelStatus[] = [];
  for (const descriptor of descriptors) {
    const verified = await verifyFile(userDataPath, descriptor);
    statuses.push({
      descriptor,
      present: verified.ok,
      path: join(dir, descriptor.fileName),
    });
  }
  return statuses;
}
