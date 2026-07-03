# VoiceWall Bootstrap-/Installations-Skript fuer Windows (M6, ABARBEITUNG 4.1).
# Acht Schritte, jeder "check-then-do" (idempotent). Aufruf ueber den
# Doppelklick-Wrapper voicewall-setup.cmd (prozess-scoped ExecutionPolicy
# Bypass, kein dauerhafter Systemeingriff). Review-then-run, kein Download-
# und-Ausfuehren; alle externen Artefakte werden gegen
# install/lib/checksums.json (SHA-256) verifiziert.
#
# Hinweis: Die Windows-Ausfuehrung ist deklariert und syntaxgeprueft; der
# vollstaendige Trockenlauf auf einer Windows-Referenzmaschine steht als
# dokumentierter offener Punkt in docs/ON-SITE-PROTOKOLL.md.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoDir = Split-Path -Parent $ScriptDir
$VwHome = Join-Path $env:USERPROFILE '.voicewall'
$StateDir = Join-Path $VwHome 'state'
$LogDir = Join-Path $VwHome 'logs'
$RuntimeDir = Join-Path $VwHome 'runtime\node'
$ChecksumsFile = Join-Path $ScriptDir 'lib\checksums.json'
$AppSupport = Join-Path $env:APPDATA 'voicewall'
$BundleName = 'VoiceWall'

New-Item -ItemType Directory -Force -Path $StateDir, $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("install-{0}.log" -f (Get-Date -Format 'yyyy-MM-ddTHH-mm-ss'))

function Write-Log {
    param([string]$Message)
    Write-Host $Message
    Add-Content -Path $LogFile -Value ("[{0}] {1}" -f (Get-Date -Format 'o'), $Message)
}

function Stop-WithError {
    param([string]$Message)
    Write-Log "FEHLER: $Message"
    Write-Log "Installation abgebrochen. Protokoll: $LogFile"
    exit 1
}

function Get-Sha256 {
    param([string]$Path)
    (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
}

$Checksums = Get-Content -Raw -Path $ChecksumsFile | ConvertFrom-Json

Write-Log "VoiceWall-Installation gestartet (win32/$env:PROCESSOR_ARCHITECTURE)."
Write-Log "Repo: $RepoDir"
Write-Log "Protokoll: $LogFile"

# ---------------------------------------------------------------------------
# Schritt 1: Preflight
# ---------------------------------------------------------------------------
Write-Log ''
Write-Log 'Schritt 1/8: Preflight.'

$Drive = (Get-Item $env:USERPROFILE).PSDrive
$FreeGb = [math]::Floor($Drive.Free / 1GB)
if ($Drive.Free -lt 3GB) {
    Stop-WithError "Zu wenig freier Speicherplatz ($FreeGb GB frei, benoetigt werden mindestens 3 GB)."
}
Write-Log "  Speicherplatz: $FreeGb GB frei (mindestens 3 GB): OK."

try {
    $ProbeFile = Join-Path $env:USERPROFILE '.voicewall-write-probe'
    Set-Content -Path $ProbeFile -Value 'probe'
    Remove-Item $ProbeFile
    Write-Log "  Schreibrecht auf $env:USERPROFILE : OK."
} catch {
    Stop-WithError "Kein Schreibrecht auf $env:USERPROFILE."
}

$NodeOk = $false
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($null -ne $NodeCmd) {
    $NodeVersion = (& node --version)
    $NodeMajor = [int]($NodeVersion.TrimStart('v').Split('.')[0])
    if ($NodeMajor -ge 26 -and $NodeMajor -lt 27) {
        $NodeOk = $true
        Write-Log "  System-Node $NodeVersion passt zu engines (>=26 <27): OK."
    } else {
        Write-Log "  System-Node $NodeVersion passt NICHT zu engines (>=26 <27)."
    }
} else {
    Write-Log '  Keine System-Node gefunden.'
}

$Online = $false
try {
    $null = Invoke-WebRequest -Uri 'https://huggingface.co' -Method Head -TimeoutSec 5 -UseBasicParsing
    $Online = $true
} catch {
    $Online = $false
}
Write-Log "  Internet (huggingface.co erreichbar, nur informativ): $Online."

# ---------------------------------------------------------------------------
# Schritt 2: Node-Runtime
# ---------------------------------------------------------------------------
Write-Log ''
Write-Log 'Schritt 2/8: Node-Runtime.'

if ($NodeOk) {
    Write-Log '  Vorhandene System-Node wird verwendet.'
} else {
    $NodeZip = Get-ChildItem -Path (Join-Path $RepoDir 'vendor\node-runtime') -Filter 'node-v*-win-x64.zip' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $NodeZip) {
        Stop-WithError "Keine passende Node-Version gefunden. Entweder Node >=26 <27 installieren ODER vorher 'node scripts/prepare-vendor.mjs --platform win32-x64' ausfuehren (siehe docs/ON-SITE-PROTOKOLL.md)."
    }
    $Expected = $Checksums.nodeRuntime.($NodeZip.Name)
    if ([string]::IsNullOrEmpty($Expected)) {
        Stop-WithError "Fuer $($NodeZip.Name) ist keine SHA-256 in checksums.json hinterlegt."
    }
    $Actual = Get-Sha256 $NodeZip.FullName
    if ($Actual -ne $Expected.ToLowerInvariant()) {
        Stop-WithError "SHA-256-Mismatch fuer $($NodeZip.Name) (erwartet $Expected, tatsaechlich $Actual)."
    }
    $NodeDirName = [System.IO.Path]::GetFileNameWithoutExtension($NodeZip.Name)
    $TargetDir = Join-Path $RuntimeDir $NodeDirName
    if (Test-Path (Join-Path $TargetDir 'node.exe')) {
        Write-Log "  Portables Node bereits entpackt ($NodeDirName): uebersprungen."
    } else {
        Write-Log "  Entpacke portables Node nach $TargetDir ..."
        New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
        Expand-Archive -Path $NodeZip.FullName -DestinationPath $RuntimeDir -Force
    }
    # PATH nur prozesslokal, kein Systemeingriff.
    $env:PATH = "$TargetDir;$env:PATH"
    Write-Log ("  Prozesslokaler PATH gesetzt; node --version: {0}." -f (& node --version))
}
Write-Log ("  npm-Version: {0}." -f (& npm --version))

# ---------------------------------------------------------------------------
# Schritt 3: Skript-Haertung (.npmrc)
# ---------------------------------------------------------------------------
Write-Log ''
Write-Log 'Schritt 3/8: Skript-Haertung (.npmrc-Pruefung).'

$NpmrcPath = Join-Path $RepoDir '.npmrc'
if (Test-Path $NpmrcPath) {
    $NpmrcLines = Get-Content $NpmrcPath
    foreach ($Forbidden in @('script-shell', 'onload-script', 'unsafe-perm', 'ignore-scripts')) {
        if ($NpmrcLines -match "^\s*$Forbidden\s*=") {
            Stop-WithError "Die Projekt-.npmrc setzt '$Forbidden' (gefaehrlicher Override). Repo-Stand pruefen."
        }
    }
    $RegistryLines = $NpmrcLines | Where-Object { $_ -match '^\s*registry\s*=' -and $_ -notmatch 'https://registry\.npmjs\.org' }
    if ($RegistryLines) {
        Stop-WithError 'Die Projekt-.npmrc verbiegt die npm-Registry auf eine fremde Adresse. Repo-Stand pruefen.'
    }
    Write-Log '  .npmrc enthaelt keine gefaehrlichen Overrides: OK.'
} else {
    Write-Log '  Keine Projekt-.npmrc vorhanden: OK.'
}

# ---------------------------------------------------------------------------
# Schritt 4: npm ci (bevorzugt offline gegen Vendor-Cache)
# ---------------------------------------------------------------------------
Write-Log ''
Write-Log 'Schritt 4/8: Abhaengigkeiten installieren (npm ci).'

Set-Location $RepoDir
$LockSha = Get-Sha256 (Join-Path $RepoDir 'package-lock.json')
$DepsMarker = Join-Path $StateDir 'deps.ok'
$DepsCurrent = (Test-Path $DepsMarker) -and ((Get-Content $DepsMarker -Raw) -eq $LockSha) -and (Test-Path (Join-Path $RepoDir 'node_modules'))
if ($DepsCurrent) {
    Write-Log '  Lockfile unveraendert seit letztem erfolgreichem npm ci: uebersprungen.'
} else {
    # Niemals --omit=optional (prebuilt Whisper-Binaries sind optionalDependencies).
    $VendorCache = Join-Path $RepoDir 'vendor\npm-cache'
    if (Test-Path $VendorCache) {
        Write-Log '  Vendor-Cache gefunden: npm ci --offline --cache vendor/npm-cache --prefer-offline ...'
        & npm ci --offline --cache $VendorCache --prefer-offline *>> $LogFile
    } else {
        Write-Log '  Kein Vendor-Cache: npm ci (online) ...'
        & npm ci *>> $LogFile
    }
    if ($LASTEXITCODE -ne 0) {
        Stop-WithError 'npm ci fehlgeschlagen (Details im Log).'
    }
    Set-Content -Path $DepsMarker -Value $LockSha -NoNewline
    Write-Log '  npm ci abgeschlossen, Marker geschrieben.'
}

Write-Log '  Verifiziere prebuilt native Binaries (SHA-256) und binding.gyp-Freiheit ...'
& node (Join-Path $RepoDir 'scripts\verify-checksums.mjs') *>> $LogFile
if ($LASTEXITCODE -ne 0) {
    Stop-WithError 'Die Supply-Chain-Pruefung (scripts/verify-checksums.mjs) ist fehlgeschlagen. node_modules loeschen und npm ci erneut ausfuehren.'
}
Write-Log '  Supply-Chain-Pruefung bestanden (plattformrichtige .node vorhanden).'

# Electron-Binary sicherstellen (install.js ist idempotent und verifiziert
# gegen die im Paket gepinnten Checksummen; offline aus vendor/electron-cache).
if (-not (Test-Path (Join-Path $RepoDir 'node_modules\electron\dist'))) {
    $ElectronVendorCache = Join-Path $RepoDir 'vendor\electron-cache'
    if (Test-Path $ElectronVendorCache) {
        Write-Log '  Electron-Binary fehlt: entpacke aus vendor/electron-cache (offline) ...'
        $env:electron_config_cache = $ElectronVendorCache
    } else {
        Write-Log '  Electron-Binary fehlt: lade es einmalig (electron install.js) ...'
    }
    & node (Join-Path $RepoDir 'node_modules\electron\install.js') *>> $LogFile
    if ($LASTEXITCODE -ne 0) {
        Stop-WithError 'Electron-Binary konnte nicht bereitgestellt werden (Details im Log). Vendor-Stand pruefen oder Internet bereitstellen.'
    }
    Remove-Item Env:\electron_config_cache -ErrorAction SilentlyContinue
}
Write-Log '  Electron-Binary vorhanden (node_modules/electron/dist).'

# ---------------------------------------------------------------------------
# Schritt 5: Build + Packaging (Windows: keine Signierung noetig)
# ---------------------------------------------------------------------------
Write-Log ''
Write-Log 'Schritt 5/8: Build und Packaging.'

$AppDir = Join-Path $RepoDir 'dist\win-unpacked'
$AppExe = Join-Path $AppDir "$BundleName.exe"
$BuildMarker = Join-Path $StateDir 'package.ok'
$SourceFiles = Get-ChildItem -Recurse -File -Path (Join-Path $RepoDir 'src'), (Join-Path $RepoDir 'resources') -ErrorAction SilentlyContinue
$HashInput = ($SourceFiles | Sort-Object FullName | ForEach-Object { Get-Sha256 $_.FullName }) -join "`n"
$HashInput += "`n" + (Get-Sha256 (Join-Path $RepoDir 'package.json')) + "`n" + $LockSha + "`n" + (Get-Sha256 (Join-Path $RepoDir 'electron-builder.yml'))
$Sha256 = [System.Security.Cryptography.SHA256]::Create()
$SrcSha = ([System.BitConverter]::ToString($Sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($HashInput)))).Replace('-', '').ToLowerInvariant()

$BuildCurrent = (Test-Path $AppExe) -and (Test-Path $BuildMarker) -and ((Get-Content $BuildMarker -Raw) -eq $SrcSha)
if ($BuildCurrent) {
    Write-Log '  Quellen unveraendert und gepackte App vorhanden: Build uebersprungen.'
} else {
    Write-Log '  npm run package (electron-vite build + electron-builder --dir) ...'
    & npm run package *>> $LogFile
    if ($LASTEXITCODE -ne 0) {
        Stop-WithError 'Build/Packaging fehlgeschlagen (Details im Log).'
    }
    if (-not (Test-Path $AppExe)) {
        Stop-WithError "Gepackte App nicht gefunden: $AppExe"
    }
    Set-Content -Path $BuildMarker -Value $SrcSha -NoNewline
}
Write-Log '  Windows braucht keinen Ad-hoc-Signierschritt (TCC ist ein macOS-Mechanismus).'
Write-Log '  Beim ersten Start einmal die SmartScreen-Warnung bestaetigen (bewusst ausgefuehrt).'

# ---------------------------------------------------------------------------
# Schritt 6: Verifikation (npm audit, SBOM) und Vendor-Modelle
# ---------------------------------------------------------------------------
Write-Log ''
Write-Log 'Schritt 6/8: Verifikation (Audit, SBOM, Modelle).'

if ($Online) {
    & npm audit --audit-level=high *>> $LogFile
    if ($LASTEXITCODE -ne 0) {
        Stop-WithError 'npm audit meldet Schwachstellen ab Level high (Details im Log).'
    }
    Write-Log '  npm audit: keine Findings ab Level high.'
} else {
    Write-Log '  Offline: npm audit uebersprungen (Vermerk; Audit ist zuletzt in der CI gelaufen).'
}

$SbomFile = Join-Path $LogDir ("sbom-{0}.json" -f (Get-Date -Format 'yyyy-MM-dd'))
& npm sbom --sbom-format cyclonedx --sbom-type application | Out-File -FilePath $SbomFile -Encoding utf8
if ($LASTEXITCODE -ne 0) {
    Stop-WithError 'SBOM-Erzeugung fehlgeschlagen.'
}
Write-Log "  SBOM (CycloneDX) geschrieben: $SbomFile"

$VendorModels = Join-Path $RepoDir 'vendor\models'
if (Test-Path $VendorModels) {
    $ModelsDir = Join-Path $AppSupport 'models'
    New-Item -ItemType Directory -Force -Path $ModelsDir | Out-Null
    foreach ($Model in Get-ChildItem -Path $VendorModels -Filter '*.bin') {
        $Expected = $Checksums.modelle.($Model.Name)
        if ([string]::IsNullOrEmpty($Expected)) {
            Write-Log "  Hinweis: $($Model.Name) ist nicht in checksums.json gelistet und wird ignoriert."
            continue
        }
        $Target = Join-Path $ModelsDir $Model.Name
        if ((Test-Path $Target) -and ((Get-Sha256 $Target) -eq $Expected.ToLowerInvariant())) {
            Write-Log "  Modell $($Model.Name) bereits vorhanden und verifiziert: uebersprungen."
            continue
        }
        if ((Get-Sha256 $Model.FullName) -ne $Expected.ToLowerInvariant()) {
            Stop-WithError "SHA-256-Mismatch fuer Vendor-Modell $($Model.Name). Vendor-Stand neu erzeugen."
        }
        Write-Log "  Kopiere Modell $($Model.Name) in den App-Support-Ordner ..."
        Copy-Item -Path $Model.FullName -Destination "$Target.part" -Force
        Move-Item -Path "$Target.part" -Destination $Target -Force
    }
} else {
    Write-Log '  Kein vendor/models-Ordner: der Wizard laedt fehlende Modelle einmalig mit Pruefsummen-Verifikation.'
}

# ---------------------------------------------------------------------------
# Schritt 7: App starten und aktiv auf Ready warten (kein blindes Sleep)
# ---------------------------------------------------------------------------
Write-Log ''
Write-Log 'Schritt 7/8: App starten.'

$ReadyFile = Join-Path $AppSupport 'app-ready.json'
if (Get-Process -Name $BundleName -ErrorAction SilentlyContinue) {
    # Idempotenz: die gepackte App laeuft bereits (erneuter Skript-Lauf).
    Write-Log '  App laeuft bereits (Prozess gefunden): Start uebersprungen.'
} else {
    $LaunchTime = Get-Date
    Start-Process -FilePath $AppExe | Out-Null

    $Ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        if (Test-Path $ReadyFile) {
            if ((Get-Item $ReadyFile).LastWriteTime -ge $LaunchTime.AddSeconds(-2)) {
                $Ready = $true
                break
            }
        }
        Start-Sleep -Seconds 1
    }
    if ($Ready) {
        Write-Log "  App meldet Ready (Marker $ReadyFile)."
    } elseif (Get-Process -Name $BundleName -ErrorAction SilentlyContinue) {
        Write-Log '  App-Prozess laeuft (Ready-Marker nicht gefunden).'
    } else {
        Stop-WithError "Die App ist nicht gestartet. App manuell starten: $AppExe"
    }
}

# ---------------------------------------------------------------------------
# Schritt 8: First-Run-Erkennung (nur loggen; die App entscheidet selbst)
# ---------------------------------------------------------------------------
Write-Log ''
Write-Log 'Schritt 8/8: First-Run-Erkennung.'

$ConfigFile = Join-Path $AppSupport 'config.json'
$FirstRun = $true
if (Test-Path $ConfigFile) {
    try {
        $Config = Get-Content -Raw -Path $ConfigFile | ConvertFrom-Json
        if ($Config.firmen -and @($Config.firmen).Count -gt 0) {
            $FirstRun = $false
        }
    } catch {
        $FirstRun = $true
    }
}
if ($FirstRun) {
    Write-Log '  Keine gueltige Konfiguration mit Firma gefunden: die App zeigt den Einrichtungs-Wizard.'
} else {
    Write-Log '  Konfiguration mit mindestens einer Firma vorhanden: die App startet direkt in der Verwaltung.'
}

Write-Log ''
Write-Log "Fertig. VoiceWall laeuft. Installationsprotokoll: $LogFile"
Write-Log 'Deinstallation (Firmendaten bleiben IMMER erhalten): install\uninstall.ps1'
