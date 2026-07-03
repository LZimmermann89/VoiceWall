#!/bin/bash
# macOS-Doppelklick-Wrapper (ABARBEITUNG 4.1.1): startet das eigentliche
# Bootstrap-Skript in einem Terminal-Fenster, damit Finder-Nutzer ohne
# Terminal-Kenntnis installieren koennen. Review-then-run: dieses Repo wird
# vorher geprueft kopiert, kein curl | bash.
set -euo pipefail
cd "$(dirname "$0")"
exec bash ./voicewall-setup.sh "$@"
