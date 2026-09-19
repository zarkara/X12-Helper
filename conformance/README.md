# Conformance corpus

18 X12 835 remittances from four unrelated open-source projects, with every
file's source and licence recorded and verifiable.

Two things live here. One is a test: our own sample can only confirm the
dictionary it was written from, so the corpus is what tells us whether the
dictionary and the balancing rules are any good. The other is the collection
itself. Redistributable 835s are genuinely hard to come by — the authoritative
examples live in X12's Technical Report Type 3, which is copyrighted and may
not be copied — so having assembled a clean set once, it is committed with its
paperwork rather than thrown away.

## What is in it

| Files | Source | Licence | Covers |
|---:|---|---|---|
| 7 | [cosyte/x12](https://github.com/cosyte/x12) | MIT | Medicare-shaped professional remittance, multi-claim, `PLB` with a `WO` offset, mixed CARC and RARC, a deliberately unbalanced file, a clearinghouse quirk |
| 7 | [diasks2/era_835_parser](https://github.com/diasks2/era_835_parser) | MIT | Institutional (`MIA`) and professional, `CO` and `PR` adjustments. `example_7` has the richest `PLB` here — `FB` forward balance, `WO` withholding, `CS` capitation, both signs, two transaction sets |
| 3 | [keironstoddart/edi-835-parser](https://github.com/keironstoddart/edi-835-parser) | MIT | NY eMedNY Medicaid batch with primary and secondary payers, BCBS NC, a legacy UnitedHealthcare layout |
| 1 | [DrMkdaddy/stanza-test-fixtures](https://github.com/DrMkdaddy/stanza-test-fixtures) | ISC | A minimal professional claim with a `CO-45` adjustment |

All of it is synthetic or scrubbed. None of it contains real patient data. Every
file keeps the name it had upstream, except `835-golden-serialized.edi`, which
was `test/fixtures/golden/835.edi` and needed a name that did not collide.

Several of these — all seven `era-835-parser` files, plus the BCBS NC and
UnitedHealthcare ones — are bare `ST`…`SE` transaction sets with no `ISA`/`GS`
envelope. That is worth having: plenty of real integrations hand you exactly
that.

## Proof of source

Every remittance has three things behind it.

**An `.info` sidecar** next to it, named after the file — `example_7.835` has
`example_7.835.info`. It names the upstream repository, the exact commit, the
path within that commit, a permalink you can open, the file's SHA-256, the
licence, the copyright holder and what attribution that licence requires.

**[`manifest.json`](x12-835/manifest.json)**, which holds the same record for
every file in one place, plus the licence metadata each source needs. The
sidecars are rendered from it, so they cannot drift from it.

**The upstream `LICENSE`**, committed beside the files it covers, so the licence
text travels with the data rather than living behind a link that may move.

Provenance was established by matching each captured file against the blob at
the recorded commit in the upstream repository. Every file here matched
byte-for-byte; "Verified" in a sidecar means that comparison was exact.

Nothing here is copied from an X12 Technical Report Type 3, and no source
carries an X12 Incorporated or WPC copyright notice.

## What is checked on every test run

`tests/provenance.test.js` — the paperwork:

- every remittance has a manifest entry and a current `.info` sidecar
- every file still hashes to what was recorded when it was captured
- every source names a licence on the allowed list, a copyright holder, the
  attribution it requires, and has its licence text committed
- every source appears in [`NOTICE`](NOTICE)

`tests/conformance.test.js` — the dictionary and the arithmetic:

- every remittance parses
- what the dictionary cannot explain is compared against
  [`baseline.json`](baseline.json), and may go down but not up
- the envelope warnings and the balance differences are pinned to exact
  numbers, because those are checks working correctly on defective files

## What the corpus found

Two real gaps, both now fixed:

- `PLB` stopped at four adjustment pairs. The 835 allows six, so `PLB11`
  through `PLB14` were reported as unexplained — on exactly the file a
  payment-posting engineer most needs explained.
- `BPR11` was missing, between `BPR10` and `BPR12`.

And three things confirmed rather than merely asserted:

- No unknown segments and no undefined tables, across 18 files from four
  sources that had never seen this code.
- The `SE01` segment-count check fires on ten of the files, all genuine
  upstream defects, matching a count made independently by hand.
- The balancing rules flag four files. Three are scrubbed extracts with claims
  removed; one is deliberately broken. In all four the arithmetic agreed with
  the file.

Two things are still flagged, correctly: `SVC08` and `SVC10` in one file, past
where the 835 defines `SVC`; and three elements carrying a phone number or an
account number where a qualifier code belongs, because the payer left the
preceding element empty and everything after it shifted by one.

## What was left out

**A Nevada Medicaid sample 835** was dropped on licence grounds, despite being
the only denial-heavy file in the candidate set and the only source of `CT` and
`CS` provider adjustments. It is a state agency work with no copyright notice
and no affirmative grant: 17 U.S.C. § 105 puts only *federal* works in the
public domain, and state works are not automatically public domain. It was also
only recoverable by extracting text from a PDF, which loses the fixed-width
`ISA` padding, so it could not have been verified against anything. Replacing
that coverage from a permissively licensed source is open work.

Also rejected:

- **databricks-industry-solutions/x12-edi-parser** — its licence restricts use
  to the Databricks service, which is not compatible with Apache-2.0.
- **First Coast Service Options and Nevada MMIS companion guides** — carry a MAC
  contractor or vendor copyright, not a Government one, and contain no raw EDI.
- **CMS Claims Processing Manual chapter 22** — a genuine Government work with no
  X12 notice, but it contains no raw 835.

## Adding to it

Three rules: the licence has to allow redistribution under Apache-2.0, the file
has to be synthetic or scrubbed, and it has to arrive with a recorded
provenance. Add the file, add its entry to `x12-835/manifest.json` — including
the upstream commit, path and SHA-256 you took it from — then:

```sh
node tools/build-conformance-info.js        # writes the .info sidecars and NOTICE
node tools/update-conformance-baseline.js   # re-measures what the dictionary can explain
```

Read both diffs before committing. A file with no manifest entry fails the
tests, which is the point: nothing lands here without a recorded source and
licence.
