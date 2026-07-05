> 🇩🇪 Deutsche Fassung: [ACCESSIBILITY.md](ACCESSIBILITY.md)

# Why VoiceWall needs the macOS Accessibility permission and what it does NOT do with it

This document is the auditable justification for the only
"powerful-looking" permission VoiceWall requests on macOS:
**Accessibility** (System Settings, Privacy & Security,
Accessibility; technically: TCC service `kTCCServiceAccessibility`).

## What the permission is needed for

VoiceWall automatically inserts the dictated text into the currently
focused third-party app (Word, Outlook, browser). To do that, it
simulates exactly ONE keystroke: Cmd+V. macOS allows programs to
simulate keyboard input into other apps only with the Accessibility
permission; without it, the call fails silently. That is the entire
purpose.

## What VoiceWall concretely does with the permission

The complete code that runs under this permission is a single,
encapsulated location: `src/main/paste/macos.ts`. It executes this
static AppleScript via `execFile('osascript', ['-e', ...])`:

```applescript
tell application "System Events" to keystroke "v" using command down
```

Audit notes:

- The script is a **literal in the source code**. It is never
  assembled dynamically; no user or transcript text is interpolated
  (`execFile` with an argument array, no shell).
- The transcript text reaches the third-party app exclusively via the
  clipboard (`clipboard.writeText`), never via the command line and
  never via simulated individual keystrokes.
- Before every insertion, `src/main/permission/accessibility.ts`
  checks with `systemPreferences.isTrustedAccessibilityClient(false)`
  whether the permission is granted. Without the permission, **no**
  osascript attempt is started; instead, the UI explains the
  permission (in the selected interface language) and opens the right settings pane at the press
  of a button (static deep link
  `x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility`).

## What VoiceWall does NOT do with the permission

- **No keylogging:** VoiceWall does not read keyboard input,
  anywhere. There is no event tap, no keyboard hook, no input
  monitoring, and the corresponding TCC right
  (`kTCCServiceListenEvent`) is never requested. The global hotkey
  runs via Electron's `globalShortcut`, which is only notified of the
  ONE registered combination, not of any other keystrokes.
- **No reading of other apps:** no window contents, no UI elements,
  no screen reading. Exclusively one keystroke is sent; nothing is
  ever queried.
- **No control of other apps** beyond the insertion: no clicking, no
  navigating, no further keystrokes.
- **No network involvement:** the paste path (like the entire app at
  runtime) triggers no external request.

If you want to verify this: `grep -rn "osascript\|keystroke" src/`
yields exactly the one location in `paste/macos.ts` (plus
documentation and tests).

## Known TCC limitation: the permission is tied to the signing identity (cdhash)

Measured empirically: with an ad-hoc-signed app, macOS forms the TCC
trust relationship via the designated requirement `cdhash H"<hash>"`,
i.e. via the hash of the concrete build, not via the bundle ID.
Consequences:

- **Every rebuild** (even one byte of difference in the bundle)
  produces a new cdhash. The previously granted Accessibility
  permission then no longer matches; insertion fails silently until
  the permission is granted again (VoiceWall detects this via the
  check before every paste and shows the guidance path instead of
  failing silently).
- A pure **re-signing without content changes** is harmless (the
  cdhash is deterministic).
- In **dev operation** (electron from node_modules), the client is
  the Electron helper binary; on the development machine,
  `isTrustedAccessibilityClient(false)` returns `false` as expected
  (measured on 2026-07-03 with Electron 43.0.0). The guidance path is
  therefore the regular, tested dev state.
- **Only a rebuild-stable signing identity solves this permanently:**
  Apple Developer ID plus notarisation yields an identifier-/
  team-based designated requirement that survives rebuilds
  (recommendation priority 2 of the ABARBEITUNG; decision after the
  manual TCC test with Lars). Until then: plan for the re-grant step
  after every update, and the copy button plus clipboard remains the
  primary resilience path.

## Windows for comparison

Windows has no Accessibility permission for SendKeys; instead, the
UIPI boundary applies there (no simulated input into target apps
running as administrator). The same resilience rule applies on both
platforms: if automatic insertion fails, the text is in the clipboard
and remains available at any time via the copy button.
