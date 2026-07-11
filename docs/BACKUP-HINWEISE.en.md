> 🇩🇪 Deutsche Fassung: [BACKUP-HINWEISE.md](BACKUP-HINWEISE.md)

# Backup and encryption (VoiceWall)

This document (the backup notes) belongs to the GDPR evidence sheet
(`rechtstexte/DSGVO-BELEG-BLATT.md`, section 5) and is substantively
identical to the section "Backup and encryption" in the app's
evidence view (`src/shared/backup-hinweise.ts`). It addresses a risk
taken deliberately seriously: an unencrypted plain-text backup of
highly sensitive dictations.

## The central warning first

> Important: your dictations are stored as plain-text Markdown in the
> company folder. A copy onto an unencrypted USB stick or an
> unencrypted network drive is therefore an unencrypted plain-text
> backup. Dictations can contain highly sensitive content, such as
> health data or other special categories of personal data within the
> meaning of Art. 9 GDPR. Therefore use encrypted backup media only.

The plain-text format is a deliberate architecture decision (folder
as database): it makes the data provably local,
portable and readable even without VoiceWall. The flip side is that
PROTECTING the copies is in your hands. This page says concretely
how.

## How to back up your dictations (backup)

The company folder is the entire database. For a complete backup,
simply copy the whole company folder (e.g. "Müller & Söhne GmbH" on
the desktop or under `~/VoiceWall`) onto your backup medium. There is
no hidden database, no registry entries and no passwords that would
need to be backed up in addition.

Restoring: place the backed-up folder back at the desktop location,
start VoiceWall and the company appears (if necessary, adopt it via
"Set up a new company" with the same name). The dictations are plain
Markdown and remain readable entirely without VoiceWall.

## Encrypt the backup medium (strongly recommended)

### macOS: FileVault and encrypted drives

- Internal disk: System Settings → Privacy & Security → FileVault →
  "Turn On FileVault".
- External drives and USB sticks: right-click the drive in the Finder
  and choose "Encrypt ...", or format the drive as "APFS (encrypted)"
  in Disk Utility.

### Windows: BitLocker and BitLocker To Go

- Internal disk: Settings → Privacy & Security → Device encryption
  (or Control Panel → BitLocker Drive Encryption).
- USB sticks and external drives: right-click the drive in Explorer →
  "Turn on BitLocker" (BitLocker To Go).

Keep the recovery key of the operating system separate from the
backup medium (e.g. printed out in the folder with the company
documents).

## Encrypted single export (.vwenc)

For passing on individual dictations (e.g. via USB stick to the tax
advisor), VoiceWall offers "Export encrypted" in the detail view: the
Markdown file is encrypted locally with AES-256-GCM and placed as a
`.vwenc` file in the `Exporte/` folder. Decryption happens
exclusively here in the app under "Decrypt file" (evidence view).

The password (at least 12 characters) is not stored anywhere. If the
password is lost, the content of the `.vwenc` file is irrecoverably
lost; there is no backdoor and no recovery.

Technical key facts (`src/main/storage/encrypted-export.ts`): a
deliberately simple
container format `VWENC1` (magic, version and KDF identifier, salt,
nonce, auth tag, ciphertext), key derivation scrypt (N=16384, r=8,
p=1), AES-256-GCM with authenticated decryption: a wrong password or
a manipulated file fails hard and recognisably. Everything with Node
built-ins, no additional dependency, no network.
