#!/usr/bin/env bash
#
# VoiceWall Bootstrap-/Installations-Skript fuer macOS und Linux.
# Acht Schritte, jeder "check-then-do" (idempotent);
# ein erneuter Lauf auf einer fertigen Maschine geht in Sekunden durch und
# ist zugleich das Reparatur-/Update-Werkzeug.
#
# Grundsaetze:
# - Review-then-run: kein `curl | bash`. Dieses Skript liegt im geprueften
#   Repo und wird bewusst gestartet (Doppelklick: voicewall-setup.command).
# - Kein systemweiter Eingriff: portables Node landet unter
#   ~/.voicewall/runtime/, PATH wird nur prozesslokal gesetzt, keine
#   Admin-Rechte noetig.
# - Jeder externe Artefakt-Bezug wird gegen install/lib/checksums.json
#   (SHA-256) verifiziert, sonst Abbruch.
# - Alle Ausgaben landen zusaetzlich in ~/.voicewall/logs/install-<ISO>.log
#   (rein lokal, keine Telemetrie).
#
set -euo pipefail
IFS=$'\n\t'

# ---------------------------------------------------------------------------
# Pfade, Logging, Helfer
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VW_HOME="${HOME}/.voicewall"
STATE_DIR="${VW_HOME}/state"
LOG_DIR="${VW_HOME}/logs"
RUNTIME_DIR="${VW_HOME}/runtime/node"
CHECKSUMS_FILE="${SCRIPT_DIR}/lib/checksums.json"
BUNDLE_ID="de.der-ki-auditor.voicewall"

mkdir -p "${STATE_DIR}" "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/install-$(date -u '+%Y-%m-%dT%H-%M-%SZ').log"

log() {
  # Deutsche Klartext-Zeile auf Konsole UND ins Log (mit Zeitstempel).
  printf '%s\n' "$*"
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >>"${LOG_FILE}"
}

fail() {
  log "FEHLER: $*"
  log "Installation abgebrochen. Das vollstaendige Protokoll liegt unter: ${LOG_FILE}"
  exit 1
}

sha256_of() {
  shasum -a 256 "$1" | cut -d' ' -f1
}

# Stellt sicher, dass python3 wirklich lauffaehig ist, bevor eine
# Pruefsummen-Verifikation darauf aufbaut. Wichtig: auf macOS ohne Xcode
# Command Line Tools ist /usr/bin/python3 nur ein Stub, der mit Exit != 0
# endet; ein ungesicherter Aufruf wuerde das Skript unter `set -e` ohne
# verstaendliche Meldung beenden.
require_python3() {
  if ! command -v python3 >/dev/null 2>&1 || ! python3 -c 'pass' >/dev/null 2>&1; then
    fail "python3 ist auf dieser Maschine nicht lauffaehig, wird aber fuer die Pruefsummen-Verifikation des Vendor-Standes benoetigt. Auf macOS die Xcode Command Line Tools installieren ('xcode-select --install'), auf Linux das Paket python3; danach das Skript erneut ausfuehren."
  fi
}

# Liest einen Wert aus checksums.json ueber python3 (Node existiert an
# dieser Stelle ggf. noch nicht). Aufrufer sichern den Aufruf vorher mit
# require_python3 ab; python3 ist NICHT ueberall garantiert lauffaehig
# (macOS ohne Xcode CLT liefert nur einen Stub).
checksum_lookup() {
  local section="$1" key="$2"
  python3 - "$CHECKSUMS_FILE" "$section" "$key" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf8"))
print(data.get(sys.argv[2], {}).get(sys.argv[3], ""))
PY
}

case "$(uname -s)" in
  Darwin) OS_NAME="darwin" ;;
  Linux) OS_NAME="linux" ;;
  *) fail "Nicht unterstuetztes Betriebssystem: $(uname -s). Unter Windows bitte install\\voicewall-setup.cmd verwenden." ;;
esac
case "$(uname -m)" in
  arm64 | aarch64) ARCH_NAME="arm64" ;;
  x86_64) ARCH_NAME="x64" ;;
  *) fail "Nicht unterstuetzte Architektur: $(uname -m)." ;;
esac

if [ "${OS_NAME}" = "darwin" ]; then
  APP_SUPPORT="${HOME}/Library/Application Support/voicewall"
else
  APP_SUPPORT="${XDG_CONFIG_HOME:-${HOME}/.config}/voicewall"
fi

log "VoiceWall-Installation gestartet (${OS_NAME}/${ARCH_NAME})."
log "Repo: ${REPO_DIR}"
log "Protokoll: ${LOG_FILE}"

# ---------------------------------------------------------------------------
# Schritt 1: Preflight (nur pruefen, nichts veraendern)
# ---------------------------------------------------------------------------
log ""
log "Schritt 1/8: Preflight."

FREE_KB="$(df -Pk "${HOME}" | awk 'NR==2 {print $4}')"
FREE_GB="$((FREE_KB / 1024 / 1024))"
if [ "${FREE_KB}" -lt $((3 * 1024 * 1024)) ]; then
  fail "Zu wenig freier Speicherplatz (${FREE_GB} GB frei, benoetigt werden mindestens 3 GB fuer Modell, Electron und Runtime). Bitte Platz schaffen und das Skript erneut ausfuehren."
fi
log "  Speicherplatz: ${FREE_GB} GB frei (mindestens 3 GB): OK."

[ -w "${HOME}" ] || fail "Kein Schreibrecht auf das Home-Verzeichnis ${HOME}. Rechte pruefen, dann Skript erneut ausfuehren."
log "  Schreibrecht auf ${HOME}: OK."

# shasum wird fuer ALLE SHA-256-Pruefungen benoetigt (Lockfile-Marker,
# Build-Marker, Vendor-Artefakte); ohne Guard wuerde `set -e` das Skript
# spaeter ohne verstaendliche Meldung beenden.
command -v shasum >/dev/null 2>&1 ||
  fail "Das Werkzeug 'shasum' fehlt (noetig fuer die SHA-256-Pruefungen; auf macOS immer vorhanden, auf Linux liefert es das Paket 'perl'). Bitte installieren, dann Skript erneut ausfuehren."
log "  Benoetigtes Werkzeug shasum vorhanden: OK."
if [ -d "${HOME}/Desktop" ] && [ -w "${HOME}/Desktop" ]; then
  log "  Schreibrecht auf den Desktop: OK."
else
  log "  Hinweis: Desktop-Ordner fehlt oder ist nicht beschreibbar; der Wizard fragt dann nach einem Zielordner."
fi

NODE_OK="nein"
if command -v node >/dev/null 2>&1; then
  NODE_VERSION="$(node --version)"
  NODE_MAJOR="$(printf '%s' "${NODE_VERSION}" | sed 's/^v\([0-9]*\).*/\1/')"
  if [ "${NODE_MAJOR}" -ge 26 ] && [ "${NODE_MAJOR}" -lt 27 ]; then
    NODE_OK="ja"
    log "  System-Node ${NODE_VERSION} passt zu engines (>=26 <27): OK."
  else
    log "  System-Node ${NODE_VERSION} passt NICHT zu engines (>=26 <27)."
  fi
else
  log "  Keine System-Node gefunden."
fi

ONLINE="nein"
if curl -sI --max-time 5 https://huggingface.co >/dev/null 2>&1; then
  ONLINE="ja"
fi
log "  Internet (huggingface.co erreichbar, nur informativ): ${ONLINE}."

# ---------------------------------------------------------------------------
# Schritt 2: Node-Runtime bereitstellen (check-then-do)
# ---------------------------------------------------------------------------
log ""
log "Schritt 2/8: Node-Runtime."

if [ "${NODE_OK}" = "ja" ]; then
  log "  Vorhandene System-Node wird verwendet (kein portables Node noetig)."
else
  NODE_TARBALL=""
  for candidate in "${REPO_DIR}/vendor/node-runtime/"node-v*-"${OS_NAME}-${ARCH_NAME}".tar.gz; do
    [ -f "${candidate}" ] && NODE_TARBALL="${candidate}"
  done
  if [ -z "${NODE_TARBALL}" ]; then
    fail "Node >=26 <27 fehlt und es liegt kein Vendor-Stand unter vendor/node-runtime/. Fuer die Selbst-Installation bitte Node 26 installieren: https://nodejs.org/en/download aufrufen und dort ausdruecklich Version 26 ('Current') waehlen; der vorausgewaehlte Standard-Button liefert die aeltere LTS-Version, die dieser Preflight ablehnt. Auf macOS geht alternativ 'brew install node' (die Homebrew-Formel node liefert derzeit die 26er-Linie). Danach dieses Skript erneut ausfuehren. Der Vendor-Weg ueber scripts/prepare-vendor.mjs ist der Dienstleistungsweg fuer die Offline-Vor-Ort-Installation und setzt seinerseits eine Maschine mit Node 26 voraus."
  fi
  TARBALL_NAME="$(basename "${NODE_TARBALL}")"
  require_python3
  EXPECTED_SHA="$(checksum_lookup nodeRuntime "${TARBALL_NAME}")"
  [ -n "${EXPECTED_SHA}" ] || fail "Fuer ${TARBALL_NAME} ist keine SHA-256 in install/lib/checksums.json hinterlegt. Vendor-Stand mit scripts/prepare-vendor.mjs neu erzeugen."
  ACTUAL_SHA="$(sha256_of "${NODE_TARBALL}")"
  if [ "${ACTUAL_SHA}" != "${EXPECTED_SHA}" ]; then
    fail "SHA-256-Mismatch fuer ${TARBALL_NAME} (erwartet ${EXPECTED_SHA}, tatsaechlich ${ACTUAL_SHA}). Die Datei ist nicht die erwartete; Vendor-Stand neu erzeugen."
  fi
  NODE_DIR_NAME="$(basename "${TARBALL_NAME}" .tar.gz)"
  TARGET_DIR="${RUNTIME_DIR}/${NODE_DIR_NAME}"
  if [ -x "${TARGET_DIR}/bin/node" ]; then
    log "  Portables Node bereits entpackt (${NODE_DIR_NAME}): uebersprungen."
  else
    log "  Entpacke portables Node nach ${TARGET_DIR} (versionsbenannt, idempotent) ..."
    mkdir -p "${RUNTIME_DIR}"
    tar -xzf "${NODE_TARBALL}" -C "${RUNTIME_DIR}" ||
      fail "Node-Runtime nicht entpackbar, Ziel ${RUNTIME_DIR} pruefen (Rechte/Platz), dann Skript erneut ausfuehren."
  fi
  export PATH="${TARGET_DIR}/bin:${PATH}"
  log "  Prozesslokaler PATH gesetzt; node --version: $(node --version)."
fi
NPM_VERSION="$(npm --version)"
log "  npm-Version: ${NPM_VERSION}."

# ---------------------------------------------------------------------------
# Schritt 3: Skript-Haertung pruefen (.npmrc, keine gefaehrlichen Overrides)
# ---------------------------------------------------------------------------
log ""
log "Schritt 3/8: Skript-Haertung (.npmrc-Pruefung)."

NPMRC="${REPO_DIR}/.npmrc"
if [ -f "${NPMRC}" ]; then
  for forbidden in "script-shell" "onload-script" "unsafe-perm" "ignore-scripts"; do
    if grep -E "^[[:space:]]*${forbidden}[[:space:]]*=" "${NPMRC}" >/dev/null; then
      fail "Die Projekt-.npmrc setzt '${forbidden}'. Das ist ein gefaehrlicher Override und wird nicht akzeptiert. Bitte den Repo-Stand pruefen (Supply-Chain-Verdacht)."
    fi
  done
  if grep -E "^[[:space:]]*registry[[:space:]]*=" "${NPMRC}" | grep -v "https://registry.npmjs.org" >/dev/null; then
    fail "Die Projekt-.npmrc verbiegt die npm-Registry auf eine fremde Adresse. Bitte den Repo-Stand pruefen (Supply-Chain-Verdacht)."
  fi
  log "  .npmrc enthaelt keine gefaehrlichen Overrides: OK."
else
  log "  Keine Projekt-.npmrc vorhanden: OK."
fi
log "  Die binding.gyp-Pruefung (kein On-Site-Compile) laeuft in Schritt 4 nach npm ci."

# ---------------------------------------------------------------------------
# Schritt 4: Dependencies (npm ci, bevorzugt offline gegen Vendor-Cache)
# ---------------------------------------------------------------------------
log ""
log "Schritt 4/8: Abhaengigkeiten installieren (npm ci)."

cd "${REPO_DIR}"
LOCK_SHA="$(sha256_of package-lock.json)"
DEPS_MARKER="${STATE_DIR}/deps.ok"
if [ -f "${DEPS_MARKER}" ] && [ "$(cat "${DEPS_MARKER}")" = "${LOCK_SHA}" ] && [ -d node_modules ]; then
  log "  Lockfile unveraendert seit letztem erfolgreichem npm ci: uebersprungen."
else
  # Niemals --omit=optional: die prebuilt Plattform-Binaries (Whisper) kommen
  # als optionalDependencies mit os/cpu-Gate.
  if [ -d "${REPO_DIR}/vendor/npm-cache" ]; then
    log "  Vendor-Cache gefunden: npm ci --offline --cache vendor/npm-cache --prefer-offline ..."
    npm ci --offline --cache "${REPO_DIR}/vendor/npm-cache" --prefer-offline >>"${LOG_FILE}" 2>&1 ||
      fail "npm ci (offline) fehlgeschlagen. Vendor-Cache unvollstaendig? Mit Internet erneut versuchen oder Vendor-Stand neu erzeugen (Details im Log)."
  else
    log "  Kein Vendor-Cache: npm ci (online gegen die npm-Registry) ..."
    npm ci >>"${LOG_FILE}" 2>&1 ||
      fail "npm ci fehlgeschlagen. Internetverbindung pruefen oder Vendor-Cache bereitstellen (Details im Log)."
  fi
  printf '%s' "${LOCK_SHA}" >"${DEPS_MARKER}"
  log "  npm ci abgeschlossen, Marker geschrieben."
fi

log "  Verifiziere prebuilt native Binaries (SHA-256) und binding.gyp-Freiheit ..."
node scripts/verify-checksums.mjs >>"${LOG_FILE}" 2>&1 ||
  fail "Die Supply-Chain-Pruefung (scripts/verify-checksums.mjs) ist fehlgeschlagen. NICHT weiterverwenden; node_modules loeschen und npm ci erneut ausfuehren (Details im Log)."
log "  Supply-Chain-Pruefung bestanden (plattformrichtige .node vorhanden, kein Compile-Trigger)."

# Electron-Binary sicherstellen: unter Skript-Restriktionen laeuft das
# electron-Postinstall nicht automatisch; install.js ist idempotent (beendet
# sich sofort, wenn dist/ existiert) und verifiziert den Download gegen die
# im Paket mitgelieferten, gepinnten Checksummen. Offline kommt das Artefakt
# aus vendor/electron-cache (prepare-vendor.mjs).
if [ ! -d "${REPO_DIR}/node_modules/electron/dist" ]; then
  if [ -d "${REPO_DIR}/vendor/electron-cache" ]; then
    log "  Electron-Binary fehlt: entpacke aus vendor/electron-cache (offline, checksummen-verifiziert) ..."
    electron_config_cache="${REPO_DIR}/vendor/electron-cache" node node_modules/electron/install.js >>"${LOG_FILE}" 2>&1 ||
      fail "Electron-Binary konnte nicht aus dem Vendor-Cache entpackt werden (Details im Log). Vendor-Stand mit scripts/prepare-vendor.mjs neu erzeugen."
  else
    log "  Electron-Binary fehlt: lade es einmalig (electron install.js, checksummen-verifiziert) ..."
    node node_modules/electron/install.js >>"${LOG_FILE}" 2>&1 ||
      fail "Electron-Binary konnte nicht geladen werden. Entweder Internet bereitstellen oder den Vendor-Stand (vendor/electron-cache) mitliefern."
  fi
fi
log "  Electron-Binary vorhanden (node_modules/electron/dist)."

# ---------------------------------------------------------------------------
# Schritt 5: Build + Packaging + Ad-hoc-Signierung (nur macOS)
# ---------------------------------------------------------------------------
log ""
log "Schritt 5/8: Build und Packaging."

SRC_SHA="$( (
  find src resources -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' -o -name '*.html' -o -name '*.json' -o -name '*.additions' \) -print0 2>/dev/null | sort -z | xargs -0 shasum -a 256
  shasum -a 256 package.json package-lock.json electron.vite.config.ts electron-builder.yml
) | shasum -a 256 | cut -d' ' -f1)"
BUILD_MARKER="${STATE_DIR}/package.ok"

APP_PATH=""
for candidate in "${REPO_DIR}/dist/mac-${ARCH_NAME}/VoiceWall.app" "${REPO_DIR}/dist/mac/VoiceWall.app" "${REPO_DIR}/dist/linux-unpacked"; do
  [ -e "${candidate}" ] && APP_PATH="${candidate}" && break
done

if [ -n "${APP_PATH}" ] && [ -f "${BUILD_MARKER}" ] && [ "$(cat "${BUILD_MARKER}")" = "${SRC_SHA}" ]; then
  log "  Quellen unveraendert und gepackte App vorhanden: Build uebersprungen."
  REBUILT="nein"
else
  log "  npm run package (electron-vite build + electron-builder --dir) ..."
  npm run package >>"${LOG_FILE}" 2>&1 ||
    fail "Build/Packaging fehlgeschlagen (Details im Log)."
  printf '%s' "${SRC_SHA}" >"${BUILD_MARKER}"
  REBUILT="ja"
  APP_PATH=""
  for candidate in "${REPO_DIR}/dist/mac-${ARCH_NAME}/VoiceWall.app" "${REPO_DIR}/dist/mac/VoiceWall.app" "${REPO_DIR}/dist/linux-unpacked"; do
    [ -e "${candidate}" ] && APP_PATH="${candidate}" && break
  done
  [ -n "${APP_PATH}" ] || fail "Gepackte App nicht gefunden (dist/). Details im Log."
  log "  Gepackte App: ${APP_PATH}"
fi

if [ "${OS_NAME}" = "darwin" ]; then
  NEEDS_SIGN="ja"
  if [ "${REBUILT}" = "nein" ] && codesign -dv "${APP_PATH}" 2>&1 | grep -q "Identifier=${BUNDLE_ID}"; then
    NEEDS_SIGN="nein"
    log "  App ist bereits ad-hoc signiert (Bundle-ID ${BUNDLE_ID}): Signierung uebersprungen."
  fi
  if [ "${NEEDS_SIGN}" = "ja" ]; then
    log "  Ad-hoc-Signierung (codesign -s - --force --deep) ..."
    codesign -s - --force --deep "${APP_PATH}" >>"${LOG_FILE}" 2>&1 ||
      fail "codesign fehlgeschlagen (Details im Log)."
    codesign -dv "${APP_PATH}" 2>&1 | tee -a "${LOG_FILE}" | grep -q "Identifier=${BUNDLE_ID}" ||
      fail "Signatur-Verifikation fehlgeschlagen: Bundle-ID ${BUNDLE_ID} nicht in codesign -dv."
    log "  Signatur verifiziert: Identifier=${BUNDLE_ID}, Signature=adhoc."
    log "  WICHTIG: Jeder Rebuild aendert den cdhash und bricht damit erteilte TCC-Freigaben."
    # Veraltete TCC-Eintraege der ALTEN Signatur zuruecksetzen: ein alter
    # Bedienungshilfen-Eintrag zeigt sonst "an", gilt aber nicht fuer den
    # neuen Build (Stale-Entry-Falle, Praxistest 03.07.2026). tccutil wirkt
    # nur auf die eigene Bundle-ID und ist gefahrlos wiederholbar.
    if tccutil reset Accessibility "${BUNDLE_ID}" >>"${LOG_FILE}" 2>&1; then
      log "  Veralteter Bedienungshilfen-Eintrag zurueckgesetzt (tccutil reset Accessibility ${BUNDLE_ID})."
    else
      log "  Hinweis: tccutil reset nicht moeglich (ok bei Erstinstallation)."
    fi
    log "  Re-Grant-Schritt: In der App den Knopf 'Freigabe anfordern (macOS-Dialog)' nutzen (traegt die NEUE Signatur ein), danach VoiceWall neu starten. Mikrofon fragt macOS beim ersten Aufnahmeversuch automatisch neu ab."
  fi
fi

# ---------------------------------------------------------------------------
# Schritt 6: Verifikation (npm audit, SBOM) und Vendor-Modelle bereitstellen
# ---------------------------------------------------------------------------
log ""
log "Schritt 6/8: Verifikation (Audit, SBOM, Modelle)."

AUDIT_WARNUNG=""
if [ "${ONLINE}" = "ja" ]; then
  if npm audit --audit-level=high >>"${LOG_FILE}" 2>&1; then
    log "  npm audit: keine Findings ab Level high."
  else
    # Bewusst KEIN Abbruch: ein neues High-Advisory fuer
    # gepinnte Dependencies erscheint ausserhalb der Kontrolle des
    # Installierenden und darf eine fertig gebaute, funktionierende
    # Installation nicht kippen. In der CI bleibt npm audit ein hartes Gate.
    AUDIT_WARNUNG="Sicherheits-Hinweis: npm audit meldet bekannte Schwachstellen in Abhaengigkeiten (Details im Log). Die Installation wurde fortgesetzt. Bitte auf eine aktualisierte VoiceWall-Version pruefen."
    log "  WARNUNG: ${AUDIT_WARNUNG}"
  fi
else
  log "  Offline: npm audit uebersprungen (Vermerk; Audit ist zuletzt in der CI gelaufen)."
fi

SBOM_FILE="${LOG_DIR}/sbom-$(date -u '+%Y-%m-%d').json"
npm sbom --sbom-format cyclonedx --sbom-type application >"${SBOM_FILE}" 2>>"${LOG_FILE}" ||
  fail "SBOM-Erzeugung fehlgeschlagen (Details im Log)."
log "  SBOM (CycloneDX) geschrieben: ${SBOM_FILE}"

# Offline-Modelle: liegen Modelle im Vendor-Ordner, werden sie verifiziert in
# den App-Support-Ordner kopiert (idempotent). Sonst laedt der Wizard sie
# einmalig aus dem Netz (mit denselben SHA-256-Konstanten).
if [ -d "${REPO_DIR}/vendor/models" ]; then
  require_python3
  mkdir -p "${APP_SUPPORT}/models"
  for model in "${REPO_DIR}/vendor/models/"*.bin; do
    [ -f "${model}" ] || continue
    MODEL_NAME="$(basename "${model}")"
    TARGET="${APP_SUPPORT}/models/${MODEL_NAME}"
    EXPECTED_SHA="$(checksum_lookup modelle "${MODEL_NAME}")"
    if [ -z "${EXPECTED_SHA}" ]; then
      log "  Hinweis: ${MODEL_NAME} ist nicht in checksums.json gelistet und wird ignoriert."
      continue
    fi
    if [ -f "${TARGET}" ] && [ "$(sha256_of "${TARGET}")" = "${EXPECTED_SHA}" ]; then
      log "  Modell ${MODEL_NAME} bereits vorhanden und verifiziert: uebersprungen."
      continue
    fi
    ACTUAL_SHA="$(sha256_of "${model}")"
    if [ "${ACTUAL_SHA}" != "${EXPECTED_SHA}" ]; then
      fail "SHA-256-Mismatch fuer Vendor-Modell ${MODEL_NAME} (erwartet ${EXPECTED_SHA}, tatsaechlich ${ACTUAL_SHA}). Vendor-Stand neu erzeugen."
    fi
    log "  Kopiere Modell ${MODEL_NAME} in den App-Support-Ordner (offline, verifiziert) ..."
    cp "${model}" "${TARGET}.part"
    mv "${TARGET}.part" "${TARGET}"
  done
else
  log "  Kein vendor/models-Ordner: der Wizard laedt fehlende Modelle einmalig mit Pruefsummen-Verifikation."
fi

# ---------------------------------------------------------------------------
# Schritt 7: App starten und aktiv auf Ready warten (kein blindes sleep)
# ---------------------------------------------------------------------------
log ""
log "Schritt 7/8: App starten."

READY_FILE="${APP_SUPPORT}/app-ready.json"
PROCESS_PATTERN="VoiceWall.app/Contents/MacOS"
if [ "${OS_NAME}" != "darwin" ]; then
  PROCESS_PATTERN="linux-unpacked/voicewall"
fi

if pgrep -f "${PROCESS_PATTERN}" >/dev/null 2>&1; then
  # Idempotenz: die gepackte App laeuft bereits (z. B. erneuter Skript-Lauf).
  log "  App laeuft bereits (Prozess gefunden): Start uebersprungen."
else
  LAUNCH_EPOCH="$(date +%s)"
  if [ "${OS_NAME}" = "darwin" ]; then
    open "${APP_PATH}" || fail "Die App konnte nicht gestartet werden (open ${APP_PATH})."
  else
    ( "${APP_PATH}/voicewall" >>"${LOG_FILE}" 2>&1 & ) || fail "Die App konnte nicht gestartet werden."
  fi

  # Aktives Polling auf den Ready-Marker, den die App beim Start schreibt
  # (userData/app-ready.json). KEIN HTTP-Port: die App oeffnet keinen; ein
  # blindes sleep gibt es ebenfalls nicht (Poll bricht frueh ab).
  READY="nein"
  for _ in $(seq 1 60); do
    if [ -f "${READY_FILE}" ]; then
      MARKER_EPOCH="$(stat -f %m "${READY_FILE}" 2>/dev/null || stat -c %Y "${READY_FILE}" 2>/dev/null || echo 0)"
      if [ "${MARKER_EPOCH}" -ge "${LAUNCH_EPOCH}" ]; then
        READY="ja"
        break
      fi
    fi
    sleep 1
  done
  if [ "${READY}" = "ja" ]; then
    log "  App meldet Ready (Marker ${READY_FILE})."
  elif pgrep -f "${PROCESS_PATTERN}" >/dev/null 2>&1; then
    log "  App-Prozess laeuft (Ready-Marker nicht gefunden; aeltere App-Version?)."
  else
    fail "Die App ist nicht gestartet (weder Ready-Marker noch Prozess gefunden). Details im Log; App manuell starten: ${APP_PATH}"
  fi
fi

# ---------------------------------------------------------------------------
# Schritt 8: First-Run-Erkennung (nur loggen; die App entscheidet selbst)
# ---------------------------------------------------------------------------
log ""
log "Schritt 8/8: First-Run-Erkennung."

CONFIG_FILE="${APP_SUPPORT}/config.json"
FIRST_RUN="ja"
# python3 geguardet wie in uninstall.sh: auf Macs ohne Xcode CLT ist
# /usr/bin/python3 nur ein Stub mit Exit != 0; ohne Guard und Fallback
# wuerde `set -e` das Skript hier NACH dem erfolgreichen App-Start noch
# abrupt beenden. Dieser Schritt loggt nur; im Zweifel gilt First-Run.
if [ -f "${CONFIG_FILE}" ] && command -v python3 >/dev/null 2>&1; then
  FIRMEN_COUNT="$(python3 -c 'import json,sys
try:
    print(len(json.load(open(sys.argv[1], encoding="utf8")).get("firmen", [])))
except Exception:
    print(0)' "${CONFIG_FILE}" 2>>"${LOG_FILE}" || echo 0)"
  if [ "${FIRMEN_COUNT}" -gt 0 ]; then
    FIRST_RUN="nein"
  fi
fi
if [ "${FIRST_RUN}" = "ja" ]; then
  log "  Keine gueltige Konfiguration mit Firma gefunden: die App zeigt den Einrichtungs-Wizard."
else
  log "  Konfiguration mit mindestens einer Firma vorhanden: die App startet direkt in der Verwaltung."
fi

log ""
log "Fertig. VoiceWall laeuft. Installationsprotokoll: ${LOG_FILE}"
log "SBOM (Stueckliste aller Komponenten): ${SBOM_FILE}"
log "Deinstallation (Firmendaten bleiben IMMER erhalten): install/uninstall.command (Doppelklick) oder install/uninstall.sh"
if [ -n "${AUDIT_WARNUNG}" ]; then
  log ""
  log "WARNUNG: ${AUDIT_WARNUNG}"
fi
