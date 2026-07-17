@echo off
rem VoiceWall Windows-Doppelklick-Wrapper: startet das
rem PowerShell-Bootstrap prozess-scoped (ExecutionPolicy Bypass NUR fuer
rem diese Prozesskette, kein dauerhafter Systemeingriff).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0voicewall-setup.ps1" %*
pause
