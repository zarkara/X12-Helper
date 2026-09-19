# ADR-0004: One repository per standard, with a copied core

Status: Accepted    Date: 2026-09-19

## Context
The explainers started in one repository (HL7-Helper) holding an HL7 v2 page and this X12 835 page. They share real code: the registry, code look-ups, record summaries, the page shell, the DOM builder and the styles. They do not share an audience: an interface engineer debugging an ADT feed and a payment-posting engineer chasing an unbalanced deposit arrive from different searches, file different issues and want different release notes.

The project also has a hard constraint: no build step, no dependencies, open the HTML from disk. That rules out the usual answer of publishing the shared core as a package.

## Decision
- Each standard gets its own repository, its own GitHub Pages site and its own issue tracker.
- `core/` is maintained in HL7-Helper and **copied** into each sibling repository.
- `tools/sync-core.js <path to HL7-Helper>` copies the shared files, and `--check` fails when they are out of step, so drift is visible rather than silent.
- The dictionary and profile schema stays identical across repositories. A change to it is a change to every repository.

## Consequences
- Each page is smaller to read, fork and explain, and a payer profile lives next to the standard it describes.
- The shared core exists in more than one place. Without discipline it drifts: the sync check is the discipline, and it belongs in CI once a second repository is live.
- A change to the shared core is now a change to several repositories, which is slower than one commit.
- Anyone forking for one standard no longer carries code for standards they don't use.

## Alternatives considered
- **One repository for all standards:** simplest for the maintainer and keeps a single core, but the name, README and releases have to serve several audiences at once.
- **Publish core as an npm package:** the clean answer for shared code, rejected because it adds an install step to a project whose selling point is not needing one.
- **git submodule or subtree for core:** keeps one source of truth, but submodules surprise contributors who just want to open an HTML file.
