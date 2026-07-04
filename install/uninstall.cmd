@echo off
rem VoiceWall Windows-Doppelklick-Wrapper fuer die Deinstallation
rem (Gegenstueck zu voicewall-setup.cmd): startet install\uninstall.ps1
rem prozess-scoped (ExecutionPolicy Bypass NUR fuer diese Prozesskette,
rem kein dauerhafter Systemeingriff). Die Firmen-Datenordner (Diktate)
rem bleiben IMMER erhalten; das Skript fragt vor dem Entfernen nach.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1" %*
pause
