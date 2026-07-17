> 🇩🇪 Deutsche Fassung: [TESTLEITFADEN.md](TESTLEITFADEN.md)

# Test guide for external testers

As of: 2026-07-04, version 1.0.0-rc.2. Audience: technically
experienced testers (developers) who examine VoiceWall independently
on macOS or Windows. Thank you for testing: please be honest and
merciless, that is exactly what we need.

## New in 1.0.0-rc.2: bilingual interface

The interface now speaks German AND English, including all error
messages from the main process. The setup assistant asks for
"Sprache / Language" as the VERY FIRST step (takes effect
immediately); in the management view, the switcher sits in the
header. The UI language is independent of the companies' dictation
language (which can be German or English per company). While testing,
please switch to English once and check whether any German texts
still meet you in the English interface (exception: legal texts
intentionally remain German).

## What VoiceWall is (30 seconds)

A 100 percent local voice dictation application: press the global
hotkey, speak, press the hotkey again, and the text appears via
automatic insertion in the currently focused application. Whisper
(optimised for German) runs entirely on the computer; there is no
server, no cloud, no telemetry. The core promise is provable, not
claimed: see the network self-test guide
`docs/NETZWERK-SELBSTTEST.md` (English version:
`docs/NETZWERK-SELBSTTEST.en.md`) and the evidence view in the app.

## Honest status up front

- **macOS (Apple Silicon):** core path fully accepted (setup,
  recording, transcription, auto-paste) on 2026-07-03 on the
  reference machine.
- **Windows:** the code is green on the CI (windows-latest; all unit
  and E2E tests, paste mocked in the CI), but the complete flow on
  REAL Windows hardware has never been executed. You would be the
  first. Your test protocol is the section "Windows-specific" further
  down in this guide.
- There are deliberately no purchased code-signing certificates (a
  deliberate product decision: everything is built locally from the
  source code, nothing is distributed as an anonymous binary): expect
  a SmartScreen/Defender prompt on Windows and the usual TCC
  permission prompts on macOS.

## Prerequisites

- Node.js 26 (`node --version` must show v26.x), npm 11. Caution,
  common wrong turn: Node 26 is the "Current" line; the default
  button on <https://nodejs.org/en/download> delivers the older LTS
  version, which the setup rejects. So explicitly choose version 26
  ("Current") there; on macOS, `brew install node` works as an
  alternative (currently delivers the 26 line). No compiler, no
  Xcode, no build tools needed: all native building blocks come
  prebuilt.
- About 3 GB of free disk space, internet for `npm ci` (the
  self-installation downloads the dependencies online from the npm
  registry; the offline vendor route is the on-site service route)
  and once for the model download (574 MB from huggingface.co,
  SHA-256-verified; after that, this is the only network access you
  will ever see).
- A microphone.

## Installation

Principle review-then-run: look at the source code first, then run
it.

**Route A, the install script (the product route):**

1. Obtain the repo via `git clone` (please not as a ZIP: macOS sets
   the quarantine attribute on ZIP downloads, and Gatekeeper then
   blocks double-clicking the `.command` file; the way out would be
   right-click, "Open"), take a brief look inside (`install/`,
   `scripts/`, `package-lock.json`).
2. macOS: double-click `install/voicewall-setup.command` (or
   `bash install/voicewall-setup.sh`). Windows: double-click
   `install\voicewall-setup.cmd`.
3. The script works through eight idempotent steps and starts the
   app; log under `~/.voicewall/logs/`. A second run must finish in
   seconds (idempotence, please test this too). Uninstallation
   afterwards: `install/uninstall.command` or
   `install\uninstall.cmd` (company data always remains in place).

**Route B, the developer route:**

```bash
npm ci
npm run package          # builds dist/<platform>/VoiceWall
# macOS additionally: codesign -s - --force --deep dist/mac-arm64/VoiceWall.app
```

Then start the built app. `npm run dev` works too, but the OS
permissions (microphone, Accessibility) are then tied to the Electron
binary instead of VoiceWall; for permission tests always use the
packaged app.

## The core test path (both platforms)

1. Go through the first-run wizard completely (consent, company
   details with umlauts in the name, storage location, model Q5_0,
   hotkey).
2. Wait for the model download (one time; progress indicator).
3. macOS: grant Accessibility via the button "Request permission
   (macOS dialog)", then press "Restart VoiceWall" in the app (macOS
   reports fresh permissions only after a restart, that is documented
   OS behaviour).
4. Place the cursor in a text field of a third-party app (Word, Mail,
   browser, editor), hotkey (`Cmd/Ctrl+Shift+D`), speak a German
   sentence with umlauts, hotkey. Expectation: the text appears at
   the cursor position, correct with umlauts, after about 1 to 3
   seconds.
5. Test the management view: records (search, filters, full text),
   detail, editing, tags, export (MD/TXT/PDF, encrypted as .vwenc),
   trash, create a second company and check the separation.
6. Do the network self-test (`docs/NETZWERK-SELBSTTEST.md`): watch
   the connection monitor of the OS, then the hardest probe:
   disconnect the network and keep dictating.

## Windows-specific: please log precisely

These are the open acceptance points:

- Does `voicewall-setup.cmd` run through completely? Where does it
  get stuck? (Attach the log: `%USERPROFILE%\.voicewall\logs\`)
- SmartScreen/Defender behaviour on first start (screenshot).
- Does automatic insertion (SendKeys) work in Word, Outlook, the
  browser? Known limitation: insertion into programs running as
  administrator is not possible for system reasons (UIPI); the copy
  button covers this.
- Latency: does it feel like a dictation device? Please include the
  CPU model and RAM configuration (we are expressly also looking for
  results from weaker hardware).
- OneDrive: is your desktop located in OneDrive? Then the wizard must
  warn at the storage-location step, please check.

## What you should report (informally, ideally as a GitHub issue)

OS version and hardware, app version/commit, what you did, what you
expected, what happened, a log excerpt (`~/.voicewall/logs/` or the
app-support folder `voicewall/logs/`; by design the logs contain no
dictation contents) and, for UI topics, a screenshot. Security
findings please via the channel in `SECURITY.md`.

## Known limitations (no bug report needed)

- After every rebuild of the app, macOS requires the permissions
  again (a consequence of the ad-hoc signing, a deliberate decision);
  the "Request permission" button plus an app restart is the intended
  path.
- There is no push-to-talk (toggle mode only): Electron's global
  hotkey delivers no key-release event, and a native keyboard
  listener would be additional attack surface.
- The transcript sits in the clipboard for about one second (after
  which the previous content is restored); clipboard managers can see
  it in this window, a documented residual limitation.
- The clipboard restoration rescues only text content; images in the
  clipboard are lost during a dictation.
