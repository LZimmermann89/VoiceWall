#!/bin/bash
# macOS-Doppelklick-Wrapper fuer die Deinstallation (Gegenstueck zu
# voicewall-setup.command): startet install/uninstall.sh in einem
# Terminal-Fenster, damit Finder-Nutzer ohne Terminal-Kenntnis
# deinstallieren koennen. Die Firmen-Datenordner (Diktate) bleiben
# IMMER erhalten; das Skript fragt vor dem Entfernen nach.
set -euo pipefail
cd "$(dirname "$0")"
exec bash ./uninstall.sh "$@"
