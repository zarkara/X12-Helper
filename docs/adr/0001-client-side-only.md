# ADR-0001: Process files only in the browser, with network access blocked

Status: Accepted    Date: 2026-09-16

## Context
The files these pages explain (HL7 v2, X12, FHIR) routinely contain protected health information. Engineers need to inspect real production traffic, but most organizations won't approve a tool that uploads PHI or might do so. The project is meant to be public, forkable and approved quickly by compliance teams.

## Decision
- All parsing and rendering happens in the page, in plain JavaScript loaded from the same origin.
- Every page carries a Content Security Policy of `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'`, so the browser refuses any network request, even one added by a malicious change.
- There are no third-party scripts, fonts or analytics, and no browser storage.
- Pages work from `file://` as well as from a static host, with no build step.
- Scripts are separate files, not inline, so `script-src 'self'` doesn't need `'unsafe-inline'`.

## Consequences
- Compliance review is simple: the CSP in the HTML is the whole argument.
- There can be no server-side features (sharing, saved sessions, hosted terminology look-ups). Adding any of them means superseding this ADR.
- Dictionaries ship as `.js` files rather than `.json`, because `fetch()` of local JSON fails under `file://`. Runtime-loaded profiles use `FileReader`, which isn't a network request.
- Downloads (profile stubs) use `Blob` URLs, which the CSP allows.

## Alternatives considered
- **Hosted service with an API:** rejected because of PHI handling, hosting cost and slower approval.
- **Desktop app (Electron):** rejected because of install friction and a much larger attack surface.
- **Bundled single-file build:** deferred. It's easy to add later if forks ask for it, but it adds a build step now.
