> 🇩🇪 Deutsche Fassung: [README.md](README.md)

# VoiceWall

> **Something missing? Tell me about it and we will build it in.
> Everyone benefits from it.** Write to info@der-ki-auditor.de or open
> an issue.

VoiceWall is a 100 percent local, GDPR-friendly voice dictation
application for Mac and Windows. The entire path from voice to text
runs on the user's computer: no cloud, no external server, no API
call, no telemetry. The app opens no network port; internal
communication runs exclusively over Electron IPC. The core promise is
not "trust us" but "verify it yourself": evidence over claims.

**Project status:** version 1.0.0-rc.2 (release candidate). All
features are implemented and covered by automated tests; the core
path has been accepted on macOS. Before 1.0.0, practical acceptance
on real Windows hardware is still outstanding; test reports are
welcome (see the test guide `docs/TESTLEITFADEN.md`, English version:
`docs/TESTLEITFADEN.en.md`).

## What VoiceWall does

- **System-wide dictation:** global hotkey (default
  `Cmd/Ctrl+Shift+D`, freely changeable, toggle principle: press once
  to start, press again to stop), an "I am listening" overlay that
  never steals focus, a live level meter, automatic insertion at the
  cursor position of the target app (macOS via osascript, Windows via
  SendKeys), and a copy button as the resilience path: the text is
  never lost. After insertion the clipboard is restored to its
  previous content (can be switched off); if the user copied something
  themselves in the meantime, their content is left untouched. If the
  machine locks or suspends, a running dictation is aborted and the
  audio is discarded rather than transcribed.
- **Local German speech recognition:** whisper.cpp with the German
  model whisper-large-v3-turbo-german (Q5_0 as the default, fp16 as
  an option for powerful hardware) plus Silero VAD segmentation.
  Recognition runs in a separate process and restarts automatically
  after a crash. Decoding is set up deterministically, and silence is
  guaranteed to produce no text: the VAD decides before transcription,
  so the well-known Whisper hallucinations during quiet passages
  cannot arise in the first place. On macOS the GPU assists (Metal);
  on Windows the CPU does the work. Audio lives exclusively in memory
  (a ring buffer with a hard ten-minute ceiling, actively zeroed) and
  is never written to disk. Optionally, English can be chosen per
  company as the dictation language (the original multilingual
  large-v3-turbo, a one-time additional download of about 574 MB;
  VoiceWall remains primarily optimised for German).
- **First-run wizard:** informed consent with an AI transparency
  notice, company details, storage location with cloud-sync detection
  (the iCloud/OneDrive/Dropbox trap), model choice with a hardware
  recommendation, live hotkey test, macOS Accessibility step, atomic
  creation.
- **Management (folder as database):** dictations are stored as
  Markdown files with YAML front matter in the company folder on the
  desktop or under `~/VoiceWall/`. Records view with quick search,
  filters (period, tags, source), full-text search across the
  dictation contents, detail view, editing, manual notes, tags with
  autocomplete and company-wide renaming. The search index is only a
  read cache: if it is missing or breaks, the app rebuilds it from the
  files themselves. The files in the folder are always the truth, not
  the index.
- **Specialist dictionary and text processing:** per company an
  auditable dictionary (`.voicewall/vokabular.json`) with terms as
  local recognition context and a deterministic replacement list for
  frequent mistranscriptions, plus purely rule-based processing
  (punctuation sharpening, a filler-word filter that can be switched
  off, optional voice commands) without a model and without any
  external call. Replacements that actually fired are recorded per
  dictation in the front-matter evidence and shown in the detail
  view: evidence over claims down to the text processing.
- **Export:** Markdown with header data, Markdown without header data,
  plain text and PDF (audit-document layout, correct umlauts
  verified), individually or as a batch with a progress display;
  additionally an encrypted single export as `.vwenc` (AES-256-GCM,
  scrypt) including decryption in the app. An export never overwrites
  an existing file.
- **Trash:** soft delete with restore and permanent deletion after
  confirmation.
- **Models tab:** all models at a glance with purpose, size, SHA-256
  and storage location. Models can be fetched and deleted here; the
  active speech model and the speech-pause detection are locked
  against deletion so the app cannot be rendered inoperable.
- **Multiple companies:** physically separated data per company, a
  prominent switcher, separate configuration.
- **Bilingual interface (German/English):** the UI language is
  selectable globally (wizard step 0 "Sprache / Language" on first
  start, a switcher in the header of the management view; takes
  effect immediately, without a restart) and since 1.0.0-rc.2 ALSO
  covers all messages of the main process (error texts, tray,
  overlay, PDF export). It is independent of the companies' dictation
  language: a German user can keep English dictations and vice versa.
  Legal texts remain German (German law); the English interface
  explains this with a short explanatory line; the operation log
  remains German.
- **Evidence view:** the UI side of "evidence over claims": zero
  external connections, model versions with SHA-256 and path, an
  embedded network self-test, consent timestamp, backup/encryption
  notes and the full provider identification (Impressum) displayed
  locally.

## Honest weaknesses

The principle "evidence over claims" includes naming the limits
honestly. These four are known, and some of them are deliberate
decisions:

- **Desktop only:** VoiceWall runs on Mac and Windows. There is no
  Linux, no mobile, no server variant and no team sync. This is
  intentional: one store per workstation, physically with the user,
  without a central component that would have to be operated and
  secured.
- **One network moment remains:** the one-time model download during
  setup is the only network connection in the app's life cycle. It is
  SHA-256-verified (a deviating file is rejected, never silently
  accepted) and is eliminated entirely by offline vendoring in the
  on-site installation.
- **Dependency on a single model:** German recognition quality
  depends on the quality of the one German fine-tune
  (whisper-large-v3-turbo-german). The custom dictionary mitigates
  mis-transcribed technical terms, but there is no second German
  model as a fallback; a Q4 emergency variant for weak hardware is
  deliberately deferred to v1.1. The availability risk of the download
  source is neutralised by our own model mirror (release
  `modelle-v1`); the quality dependency remains.
- **Not a meeting tool:** VoiceWall is a dictation device for one
  voice. There is no speaker separation (diarisation) and no meeting
  minutes feature; transcribing meetings requires a different tool.

## Verify instead of believing: the network self-test

The network self-test guide `docs/NETZWERK-SELBSTTEST.md` (English
version: `docs/NETZWERK-SELBSTTEST.en.md`) describes three
independent probes with which every customer verifies in minutes
that VoiceWall sends no data: the app's network view (DevTools), the
operating system's connection monitor and the hardest probe, the
unplugged network cable (the app works fully offline). The only
exception is the one-time, checksum-verified model download during
setup; with the on-site installation it is eliminated by offline
vendoring. In addition, the automated test
`tests/e2e/network-isolation.spec.ts` enforces zero non-local
requests during a complete dictation run for every revision.

## Security architecture (overview)

- **No server, no port:** no `listen(` call in the source code, only
  Electron IPC. Renderers run with `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true`; every IPC boundary
  validates with zod, raw errors never cross the process boundary.
- **Whisper in a utilityProcess:** the native speech recognition runs
  in its own process without any network need; native log lines pass
  an allowlist gate, transcript-carrying lines stay RAM-only.
- **Strict CSP:** the interface allows no external origin;
  exfiltration would be blocked even for hypothetical malicious code.
- **Containment:** company names pass through a sanitisation
  pipeline, all paths are checked against the company folder after
  `path.resolve` (also when reading); the renderer never passes raw
  paths. No user value ever reaches a shell (`execFile` with static
  arguments).
- **RAM-only audio:** microphone audio is never persisted; crash
  reporting is hard-disabled, the crash-dump directory is emptied on
  every start (honest swap footnote in the GDPR evidence sheet).
- **Supply chain:** `package-lock.json` committed and verified via
  `npm ci`, `npm audit` as a CI gate, a CycloneDX SBOM per revision,
  SHA-256 pinning of all six native Whisper binaries
  (`scripts/verify-checksums.mjs`) and of all models
  (`resources/model-manifest.json`), no compiling `binding.gyp` in
  the tree. Dependencies are maintained manually on purpose: every
  update is a decision with a lockfile review, not an automatically
  opened suggestion. Model downloads have a fallback source
  (our own byte-identical mirror as GitHub release assets, release
  `modelle-v1`); every source is verified against the same compiled-in
  SHA-256 constants, so the choice of source is never a matter of
  trust.
- **Logging without content:** structured, rotated log files with
  restrictive permissions; dictation contents are never logged.

Details on the reporting channel for vulnerabilities: `SECURITY.md`
(English version: `SECURITY.en.md`).

## System requirements

- **macOS:** Apple Silicon (arm64) or Intel (x64); microphone and
  Accessibility permission (the wizard guides you through them).
  After every rebuild of the ad-hoc-signed app, macOS requires the
  permissions again; the app guides through the re-granting with the
  "Request permission" button.
- **Windows:** x64. Limitation: automatic insertion into target apps
  running as administrator is not possible for system reasons (UIPI);
  the copy button covers this.
- **Resources:** about 3 GB of free disk space (app, Node runtime,
  models); the default model Q5_0 runs from 8 GB RAM, fp16 is offered
  from 16 GB RAM and 6 cores.
- **Self-installation and development:** Node.js 26 (see `.nvmrc`,
  `engines` pinned), npm 11. For the download source see
  Installation. Only the on-site installation with a prepared vendor
  bundle works without a preinstalled Node.

## Installation (review-then-run)

VoiceWall ships as an inspectable source-code repository, not as an
anonymous binary. The principle: review first, then run. Before every
installation, the entire source code can and should be inspected.
There are two routes.

### Self-installation (from the clone)

Prerequisite: **Node.js 26** and one-time internet access (npm
registry and model download). Node 26 is the current "Current" line
of Node.js: on <https://nodejs.org/en/download>, explicitly choose
version 26 ("Current"); the pre-selected default button delivers the
older LTS version, which the setup rejects. On macOS,
`brew install node` works as an alternative (the Homebrew formula
`node` currently delivers the 26 line).

1. Obtain the repo via `git clone` and review it (source code,
   `package-lock.json`, scripts under `install/` and `scripts/`).
2. Run `install/voicewall-setup.command` (macOS) or
   `install\voicewall-setup.cmd` (Windows). The script works through
   eight idempotent steps (preflight, Node check, npm hardening,
   `npm ci`, build and packaging with ad-hoc signing, verification
   including SBOM, app start, first-run detection) and logs to
   `~/.voicewall/logs/`. On this route, `npm ci` runs online against
   the npm registry; the wizard downloads the model once,
   SHA-256-verified.
3. The first-run wizard guides through consent, company, storage
   location, model and hotkey.

Honest note on the "Code, Download ZIP" route instead of `git clone`:
macOS attaches the quarantine attribute to the download; Gatekeeper
then blocks double-clicking the `.command` file. Way out: right-click
the file, "Open", or start `bash install/voicewall-setup.sh` in the
terminal. The clone via git is the recommended route.

### On-site installation with a vendor bundle (service route)

This route runs completely offline at the customer's site and needs
no preinstalled Node there. In advance, a vendor bundle is prepared
on a machine with internet access and Node 26
(`node scripts/prepare-vendor.mjs`): portable Node, npm cache,
Electron binary and models, all SHA-256-anchored in
`install/lib/checksums.json`. At the customer's site, the same setup
script then uses the portable Node runtime from `vendor/`, `npm ci`
runs offline against the vendor cache, and the models are copied with
verification.

### Uninstallation

`install/uninstall.command` (macOS, double-click) or
`install\uninstall.cmd` (Windows, double-click), alternatively
directly `install/uninstall.sh` or `install\uninstall.ps1`. Removes
only what belongs to VoiceWall; company data always remains in place.

## Development

```bash
npm ci               # install dependencies exactly from the lockfile
npm run dev          # development mode (electron-vite)
npm run build        # production build to out/
npm run package      # app bundle (electron-builder --dir, incl. icon)
npm run typecheck    # TypeScript strict across all project references
npm run lint         # ESLint incl. module boundaries, 0 warnings allowed
npm run format:check # Prettier check
npm run test         # unit tests (Vitest)
npm run test:e2e     # E2E against the built app (run npm run build first)
npm run audit        # npm audit, gate from severity high
npm run sbom         # CycloneDX SBOM to sbom.cdx.json
```

Test strategy: unit tests for every security- or data-carrying
function (sanitisation, front matter, migration, encryption,
manifest, full-text search), E2E tests against the real built app
(wizard, dictation flow with PCM injection, management including an
XSS probe, export with PDF text extraction, network isolation,
Impressum display). The CI additionally enforces the legal-reference
gate (`scripts/check-legal-references.mjs`, no active citation of
repealed laws), the supply-chain gate
(`scripts/verify-checksums.mjs`), script syntax gates and a macOS
packaging job with bundle asserts.

## AI transparency

Transcription is performed by a local AI model (Whisper). Automatic
transcription can contain errors; the result must be reviewed before
use. This notice also appears in the first-run wizard and in the
interface. The legal assessment with the verbatim Art. 50 carve-out
of the AI Act is in `rechtstexte/AI-ACT-EINORDNUNG.md`.

## Legal texts

Legal notices are provided in German as required by German law for
the German provider; see `rechtstexte/`. The folder contains: the
Impressum (`IMPRESSUM.md`, provider identification under § 5 DDG,
displayed locally in the app under Evidence, "About VoiceWall"), the
privacy policy (`DATENSCHUTZ.md`), the GDPR evidence sheet for the
customer documentation (`DSGVO-BELEG-BLATT.md`) and the AI Act
assessment (`AI-ACT-EINORDNUNG.md`).

## Licence

MIT licence (see `LICENSE`): VoiceWall is free to use; the source
code is free to review, self-install and pass on. Anyone who does not
want to do the setup themselves can get it as an on-site service for
a one-time 49 euros (see `rechtstexte/`). Third-party licences and
attributions: `THIRD_PARTY_LICENSES.md` and `NOTICE` (among others
whisper.cpp, @fugood/whisper.node, the GGML model
primeline/whisper-large-v3-turbo-german in the cstr conversion,
Silero VAD v5.1.2, React, zod, Electron/Chromium). Security reports:
`SECURITY.md`. Version history: `CHANGELOG.md`.
