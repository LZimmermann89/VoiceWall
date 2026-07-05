> 🇩🇪 Deutsche Fassung: [SECURITY.md](SECURITY.md)

# Security policy (SECURITY.en.md)

## Reporting vulnerabilities

If you find a vulnerability in VoiceWall, please report it
confidentially to the provider (FERNAU Präzisionstechnik GmbH, see
`rechtstexte/IMPRESSUM.md`):

- Email: info@der-ki-auditor.de
- Subject: `[SECURITY] VoiceWall: <short description>`
- Direct contact to the project lead (fallback channel):
  lars.zimmermann89@gmail.com

Please state: the affected version or commit, steps to reproduce,
expected and actual behaviour, and an assessment of the impact.
Please do not publish any details before a fix is available
(coordinated disclosure). An acknowledgement of receipt is usually
sent within 7 days.

## Scope

VoiceWall processes dictations exclusively locally. Reports on the
following are therefore particularly relevant:

- any form of unexpected network traffic (the claim is: zero external
  requests during operation),
- bypasses of the renderer isolation (contextIsolation, sandbox,
  CSP),
- path escapes from the company folder (containment),
- weaknesses in the supply chain (dependencies, install scripts,
  lockfile).

## Review-then-run

VoiceWall is delivered as source code and executed on site. Review
the code before installation, see README.md. The CI enforces for
every revision: type checking, lint with module boundaries, tests,
build, E2E, `npm audit --audit-level=high`, SBOM generation and a
lockfile guard.

## Supported versions

Until the final 1.0.0 release, only the current state of the `main`
branch is supported (currently: 1.0.0-rc.1). Updates are rolled out
in a controlled way as a new, inspectable repo release that is
installed on site (review-then-run); there is deliberately no
automatic update channel and no phone-home.
