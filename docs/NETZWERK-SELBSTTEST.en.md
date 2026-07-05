> 🇩🇪 Deutsche Fassung: [NETZWERK-SELBSTTEST.md](NETZWERK-SELBSTTEST.md)

# How to verify yourself that VoiceWall sends no data

VoiceWall promises: **your dictations never leave your computer.**
You do not have to take this promise on trust; you can verify it
yourself in a few minutes. This guide (the network self-test guide)
describes three mutually independent probes, from a simple look into
the built-in tools to the hardest probe with the network cable
unplugged.

The only exception you may see along the way: the **one-time model
download** during the initial setup. VoiceWall downloads two model
files from `huggingface.co` and checks them against hard-coded
checksums. After that, the app is completely offline.

## Probe 1: network view of the app (developer tools)

VoiceWall is based on the same technology as a browser and brings
along its network view. It shows every single connection the
interface would establish.

1. Open the VoiceWall window.
2. Open the developer tools: on the Mac with `Cmd+Alt+I`, on Windows
   with `F12` or `Ctrl+Shift+I`.
3. Switch to the **Network** tab and select the **All** filter.
4. Now dictate as many texts as you like, via hotkey or test
   recording.

**Expected result:** the list shows **not a single entry to an
external address.** At most you see local entries (files of the app
itself, `blob:` or `data:` sources) or nothing at all. In addition,
the interface's built-in security policy (content security policy)
forbids every connection to foreign addresses, even if malicious code
tried.

## Probe 2: connection monitor of the operating system

Independently of the app itself, you can ask the operating system
which programs establish connections.

**On the Mac:**

- With a firewall tool such as **LuLu** (free, open source) or
  **Little Snitch**: watch the list of outgoing connections while you
  dictate. VoiceWall does not appear there, with the single exception
  of the one-time `huggingface.co` download during setup.
- Alternatively in the terminal:
  `lsof -i -a -p <VoiceWall process ID>` shows no open internet
  connections.

**On Windows:**

- Open the **Resource Monitor** (Start menu, type "resmon"), tab
  **Network**. Dictate and watch the list "Processes with network
  activity": VoiceWall does not appear there.

**Expected result:** no outgoing connection from VoiceWall during
operation.

## Probe 3: the hardest probe, the network cable

If a program works completely without the internet, it cannot send
your data to a cloud. That is the definitive evidence.

1. Make sure the one-time setup (model download) is complete.
2. Disconnect the internet completely: turn off Wi-Fi, unplug the
   network cable, use flight mode if necessary.
3. Dictate as usual: press the hotkey, speak, press the hotkey.

**Expected result:** VoiceWall works **completely and without any
restriction offline.** Recording, recognition and insertion of the
text run entirely on your computer. There is no cloud that could be
missing.

## What VoiceWall additionally proves automatically

- An automated test in the development pipeline monitors all network
  requests of the app during a complete dictation run and fails as
  soon as even a single request to a non-local address occurs
  (`tests/e2e/network-isolation.spec.ts`).
- The app contains no telemetry, analytics or crash-report features
  of any kind that send anything outward. Error reports, too, remain
  exclusively in a local log file on your computer, and this log file
  never contains dictation contents.
- During and after the dictation, no audio file exists on the disk:
  the microphone audio lives only in memory and is actively deleted
  after recognition. You can verify this at any time by inspecting
  the folder.

If any of these probes shows a different result on your machine,
please report it via the channel described in `SECURITY.md`.
