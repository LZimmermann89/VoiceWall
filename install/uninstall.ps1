# VoiceWall-Deinstallation fuer Windows.
#
# Entfernt AUSSCHLIESSLICH VoiceWall-Eigenes:
#   - %USERPROFILE%\.voicewall  (Runtime, Marker, Logs, State)
#   - %APPDATA%\voicewall       (Modelle, globale Konfiguration)
#
# Die Firmen-Datenordner (Desktop\<Firmenname>\ bzw. ~\VoiceWall\<Firmenname>\)
# enthalten die Kundendiktate und werden von diesem Skript NIEMALS geloescht.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$VwHome = Join-Path $env:USERPROFILE '.voicewall'
$AppSupport = Join-Path $env:APPDATA 'voicewall'

Write-Host 'VoiceWall-Deinstallation.'
Write-Host ''
Write-Host 'Es werden NUR die folgenden VoiceWall-eigenen Ordner entfernt:'
Write-Host "  1. $VwHome"
Write-Host "  2. $AppSupport"
Write-Host ''

$ConfigFile = Join-Path $AppSupport 'config.json'
if (Test-Path $ConfigFile) {
    try {
        $Config = Get-Content -Raw -Path $ConfigFile | ConvertFrom-Json
        if ($Config.firmen) {
            Write-Host 'Ihre Firmen-Datenordner (Diktate) bleiben vollstaendig erhalten:'
            foreach ($Pfad in @($Config.firmen)) {
                Write-Host "  bleibt: $Pfad"
            }
            Write-Host ''
        }
    } catch {
        # Konfiguration nicht lesbar: kein Hindernis fuer die Deinstallation.
    }
}
Write-Host 'Dieses Skript loescht Firmendaten NIE. Wer einen Firmenordner entfernen'
Write-Host 'will, tut das bewusst und manuell im Datei-Explorer (unwiderruflich).'
Write-Host ''

$Answer = Read-Host 'VoiceWall-eigene Ordner jetzt entfernen? [j/N]'
if ($Answer -notin @('j', 'J', 'ja', 'Ja')) {
    Write-Host 'Abgebrochen. Es wurde nichts entfernt.'
    exit 0
}

if (Test-Path $VwHome) {
    Remove-Item -Recurse -Force -Path $VwHome
    Write-Host "Entfernt: $VwHome"
}
if (Test-Path $AppSupport) {
    Remove-Item -Recurse -Force -Path $AppSupport
    Write-Host "Entfernt: $AppSupport"
}

Write-Host ''
Write-Host 'Deinstallation abgeschlossen. Die Firmen-Datenordner sind unveraendert.'
