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
import {
  downloadModel,
  hashFileSha256,
  type DownloadError,
  type DownloadProgress,
} from './downloader';
import { MODEL_DESCRIPTORS, type ModelDescriptor } from './model-catalog';

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
    return err({ kind: 'missing', message: `Datei fehlt: ${descriptor.fileName}` });
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
      message: `Die Modelldatei ${descriptor.fileName} ist beschaedigt (Pruefsumme stimmt nicht). Sie muss neu geladen werden.`,
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

/**
 * Stellt sicher, dass eine Modelldatei vorhanden und intakt ist. Fehlt oder
 * ist sie beschaedigt, wird sie (bei allowDownload) geladen und verifiziert.
 */
export async function ensureModel(
  userDataPath: string,
  descriptor: ModelDescriptor,
  options: { allowDownload: boolean; onProgress?: (progress: DownloadProgress) => void },
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
            message: `Das ${descriptor.label} fehlt. Bitte den einmaligen Modell-Download im Einrichtungs-Assistenten starten.`,
          }
        : verified.error,
    );
  }

  // Beschaedigte Datei vorher entfernen, dann sauber neu laden.
  await rm(filePath, { force: true });
  const download = await downloadModel({
    url: descriptor.url,
    destinationPath: filePath,
    expectedSha256: descriptor.sha256,
    expectedByteSize: descriptor.byteSize,
    ...(options.onProgress ? { onProgress: options.onProgress } : {}),
  });
  if (!download.ok) {
    return err({ kind: download.error.kind, message: download.error.message });
  }

  const fileStat = await stat(filePath);
  const marker = await readMarker(userDataPath);
  marker[descriptor.fileName] = {
    sha256: download.value.sha256,
    byteSize: download.value.byteSize,
    mtimeMs: fileStat.mtimeMs,
  };
  await writeMarker(userDataPath, marker);
  return ok(filePath);
}

/** Praesenz-/Integritaetsstatus aller Katalogmodelle (ohne Download). */
export async function getModelStatuses(userDataPath: string): Promise<ModelStatus[]> {
  const dir = getModelsDirectory(userDataPath);
  const statuses: ModelStatus[] = [];
  for (const descriptor of MODEL_DESCRIPTORS) {
    const verified = await verifyFile(userDataPath, descriptor);
    statuses.push({
      descriptor,
      present: verified.ok,
      path: join(dir, descriptor.fileName),
    });
  }
  return statuses;
}
