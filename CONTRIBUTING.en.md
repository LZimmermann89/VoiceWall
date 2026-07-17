> 🇩🇪 Deutsche Fassung: [CONTRIBUTING.md](CONTRIBUTING.md)

# Contributing to VoiceWall

Thank you for your interest. To avoid false expectations, here are
the honest ground rules of this project.

## Project mode

VoiceWall is a deliberately narrow, finished tool in maintenance
mode: security updates of the dependencies are maintained, and
reported bugs are fixed where possible. There is no feature roadmap
and no promise of further development.

## Issues

Bug reports and Windows test reports are expressly welcome,
preferably via the issue templates. Please always include the
operating system, the version and a log excerpt (the logs contain no
dictation contents). Please report security-relevant findings
confidentially via the channel in `SECURITY.md`, not as a public
issue.

## Pull requests

Bug fixes and security improvements: gladly, with tests. New
features: please open an issue first and do not count on a merge. The
narrowness is a deliberate product decision (small attack surface,
auditable scope), which is why many ideas that are good in themselves
are declined. A fork is expressly permitted and is the right way for
larger rebuilds (MIT licence).

## Quality bar

Before every pull request, please make sure this passes locally:
`npm run typecheck && npm run lint && npm run format:check && npm run
test`. The CI additionally checks on three platforms, including
supply-chain gates. German interface texts use real umlauts; every
user-visible message exists in both languages (see
`src/shared/i18n/`).
