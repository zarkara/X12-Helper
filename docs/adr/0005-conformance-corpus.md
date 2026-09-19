# ADR-0005: Test against remittances we did not write

Status: Accepted    Date: 2026-09-19

## Context
Until now the only 835 in this repository was one we wrote. It exercises the dictionary well, because we wrote it to. That is also the problem: a sample written from a dictionary can only confirm the dictionary.

Running the parser, dictionary and balancing rules over 19 remittances collected from four unrelated open-source projects found:

- **`PLB` stops at four adjustment pairs here. The 835 allows six.** A file with `FB`, `WO` and `CS` adjustments in the same segment had `PLB11` through `PLB14` reported as unexplained, which is exactly the file a payment-posting engineer most needs explained.
- **`BPR11` was missing** from the dictionary, between `BPR10` and `BPR12`.

It also confirmed things we had no independent evidence for:

- **No unknown segments and no undefined tables**, across 19 files from four sources.
- **The `SE01` segment-count check fires on ten of the nineteen files**, all of them genuine upstream defects, matching an independent count made by hand.
- **The balancing rules flag four files.** Three are scrubbed extracts with claims removed; one is deliberately broken. In all four the arithmetic agreed with the file.
- **Three elements carry a phone number or an account number where a qualifier code belongs**, because the payer left the preceding element empty and everything after it shifted by one. Flagging those is the right answer, and a payment-posting engineer meeting that file for the first time wants to be told.

## Decision
- A **conformance corpus** of third-party remittances lives in `conformance/`, with source, licence and attribution recorded in `conformance/README.md` and `conformance/NOTICE`, and the upstream `LICENSE` kept beside each folder's files.
- Every file must be synthetic or scrubbed, and its source must be licensed MIT, Apache-2.0, BSD, ISC or CC0, or be a US Government work. [ADR-0003](0003-content-licensing.md) rules out redistributing licensed standards content, and X12's Technical Report Type 3 is licensed content: nothing here is copied out of one.
- `tests/conformance.test.js` parses the corpus on every run and compares against `conformance/baseline.json`. Unexplained segments, elements, tables and codes may go down and may not go up.
- The envelope warnings and the balance differences are pinned to exact numbers rather than a ceiling, because those are checks working correctly on defective files. A change in either direction means the check itself moved, and that should be deliberate.
- `tools/update-conformance-baseline.js` regenerates the baseline, in a commit that says why.
- **Provenance is recorded per file and verified on every test run.** Each remittance carries an `.info` sidecar naming the upstream repository, commit, path, permalink, SHA-256 and licence; `conformance/x12-835/manifest.json` holds the same record for all of them and is the source the sidecars and `NOTICE` are generated from. `tests/provenance.test.js` fails if a file has no manifest entry, if its hash has changed, if its source names a licence outside the allowed list, or if a source is missing from `NOTICE`.
- The corpus is also a **collection**, not only a test. Redistributable 835s are hard to come by, because the authoritative examples live in a copyrighted implementation guide, so the set is published with its paperwork rather than thrown away.

## Consequences
- `PLB` now covers all six adjustment pairs and `BPR` is complete. Elements past the dictionary went from 7 occurrences to 2, both of them genuinely past where the 835 defines `SVC`.
- We now have evidence that the balancing rules hold on files from four sources that have never seen this code.
- Several corpus files are bare `ST`…`SE` transaction sets with no `ISA`/`GS` envelope. That was not something our own sample covered, and plenty of real integrations hand you exactly that.
- MIT obligations travel with this repository; `conformance/NOTICE` carries them.
- A state Medicaid sample was rejected despite being the only denial-heavy file in the candidate set. Federal works are public domain under 17 U.S.C. § 105; state works are not automatically, and the document carried no grant. Replacing that coverage from a permissively licensed source is open work.

## Alternatives considered
- **Copy examples out of the 005010X221A1 Technical Report Type 3.** They are the most authoritative 835s in existence and they are copyrighted by X12 Incorporated. Not an option, and the reason this took research rather than a download.
- **Write more of our own samples.** Would have found neither gap. The value is that we did not write these.
- **Fetch the corpus at test time.** Makes the build depend on the network and on other people's repositories not moving.
- **Record provenance once in a README rather than per file.** Cheaper, and useless to anyone who opens a single remittance to see where it came from. The per-file sidecar is generated, so it costs nothing to keep current.
