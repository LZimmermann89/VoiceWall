#!/usr/bin/env bash
#
# VoiceWall-Deinstallation fuer macOS und Linux.
#
# Entfernt AUSSCHLIESSLICH VoiceWall-Eigenes:
#   - ~/.voicewall/          (Runtime, Cache-Marker, Logs, State)
#   - App-Support-Ordner     (Modelle, globale Konfiguration)
#
# Die Firmen-Datenordner (Desktop/<Firmenname>/ bzw. ~/VoiceWall/<Firmenname>/)
# enthalten die Kundendiktate und werden von diesem Skript NIEMALS geloescht.
# Das Skript zeigt nur an, wo sie liegen; ein Loeschen waere ein manueller,
# bewusster Schritt des Nutzers.
#
set -euo pipefail
IFS=$'\n\t'

VW_HOME="${HOME}/.voicewall"
case "$(uname -s)" in
  Darwin) APP_SUPPORT="${HOME}/Library/Application Support/voicewall" ;;
  Linux) APP_SUPPORT="${XDG_CONFIG_HOME:-${HOME}/.config}/voicewall" ;;
  *)
    echo "Nicht unterstuetztes Betriebssystem. Unter Windows bitte install\\uninstall.ps1 verwenden."
    exit 1
    ;;
esac

echo "VoiceWall-Deinstallation."
echo ""
echo "Es werden NUR die folgenden VoiceWall-eigenen Ordner entfernt:"
echo "  1. ${VW_HOME}"
echo "  2. ${APP_SUPPORT}"
echo ""

# Firmenordner aus der globalen Konfiguration anzeigen (nur Information).
CONFIG_FILE="${APP_SUPPORT}/config.json"
if [ -f "${CONFIG_FILE}" ]; then
  echo "Ihre Firmen-Datenordner (Diktate) bleiben vollstaendig erhalten:"
  python3 -c 'import json,sys
try:
    for pfad in json.load(open(sys.argv[1], encoding="utf8")).get("firmen", []):
        print("  bleibt: " + pfad)
except Exception:
    pass' "${CONFIG_FILE}" || true
  echo ""
fi
echo "Dieses Skript loescht Firmendaten NIE. Wer einen Firmenordner entfernen"
echo "will, tut das bewusst und manuell im Datei-Explorer (unwiderruflich)."
echo ""

printf 'VoiceWall-eigene Ordner jetzt entfernen? [j/N] '
read -r ANSWER
case "${ANSWER}" in
  j | J | ja | Ja) ;;
  *)
    echo "Abgebrochen. Es wurde nichts entfernt."
    exit 0
    ;;
esac

rm -rf "${VW_HOME}"
echo "Entfernt: ${VW_HOME}"
rm -rf "${APP_SUPPORT}"
echo "Entfernt: ${APP_SUPPORT}"

if [ "$(uname -s)" = "Darwin" ]; then
  echo ""
  echo "Hinweis (macOS): Die TCC-Freigaben (Mikrofon, Bedienungshilfen) kann ein"
  echo "Skript nicht sauber zuruecknehmen. Bitte manuell entfernen unter:"
  echo "  Systemeinstellungen -> Datenschutz und Sicherheit -> Mikrofon / Bedienungshilfen"
fi

echo ""
echo "Deinstallation abgeschlossen. Die Firmen-Datenordner sind unveraendert."
