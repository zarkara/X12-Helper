# X12 835 Helper

A browser-only page that turns an X12 835 remittance advice into a readable document: the payment first, then one record per claim, with every adjustment explained and the arithmetic checked.

It's built for engineers who are new to healthcare EDI, and for anyone who has had to work out why a deposit doesn't match the claims behind it.

**Use it now: [X12 835 Explainer](https://zarkara.github.io/X12-Helper/).** Nothing you load is uploaded — see the privacy guarantee below.

Its sister project, [HL7-Helper](https://github.com/zarkara/HL7-Helper), does the same for HL7 v2 registration, charges, orders and results.

## Quick start

1. Open [the hosted page](https://zarkara.github.io/X12-Helper/), or clone the repo and double-click `index.html`. Either way there is no server, build step or install.
2. Choose a file, drop one in, or paste a remittance. Or click the sample.
3. Step through the records with **Prev / Next**, the dropdown, or the ← → keys.

Working with remittances your organization won't let you open from the internet? Clone the repo and open the file locally. The two copies behave identically.

## Privacy guarantee

Remittances carry PHI, so the page is built so that the data can't leave the browser tab:

- The page ships a Content Security Policy with `connect-src 'none'`. The browser itself blocks every network request.
- There are no CDNs, fonts, analytics or third-party scripts.
- Nothing is written to localStorage, cookies or IndexedDB. **Clear** drops everything.
- **Download profile stub** exports segment IDs, element positions and code values from payer-specific code lists. It never exports element contents.
- The repo contains only synthetic sample data.

See [ADR-0001](docs/adr/0001-client-side-only.md).

## What it covers

| Area | Segments |
|---|---|
| The payment | BPR, TRN, REF, DTM, N1/N3/N4/PER (payer and payee), LX, TS3, TS2 |
| Each claim | CLP, CAS, NM1, REF, DTM, AMT, QTY, MIA, MOA |
| Service lines | SVC, CAS, DTM, AMT, REF, LQ |
| Provider-level money | PLB (overpayment recovery, interest, forwarding balances) |
| Envelope | ISA, GS, ST, SE, GE, IEA |

### It checks the arithmetic

- **Claim:** charged = paid + every adjustment on the claim.
- **Service line:** line charge = line paid + the adjustments that follow it.
- **Payment:** BPR02 = the claims paid minus the provider-level adjustments in PLB.

Anything that doesn't balance is flagged where you see it, not buried. That is usually the first question about a remittance, and the reason cash sits unapplied.

It explains remittances. It doesn't validate them.

## What you see for each record

- **Payment summary:** check or EFT number, amount, method, effective date, payer and payee, and the provider-level adjustments that explain the difference from the claim total.
- **Each claim:** your account number, the patient, the claim status in plain English, the payer's claim number, the balance panel, a service-line table, and a card per segment.
- **Every element** with its name, decoded value, what it means, and a revenue cycle note where it matters.
- **Flags** for segments and elements the dictionary doesn't cover, and for codes that aren't valid for their element.

## Customizing for your payer

Payer differences, and the reason-code descriptions this repo can't ship, go in a **profile**: a partial dictionary layered on top of the base one. Anything a profile explains is tagged on the page with the profile's name.

```js
HCX.registerProfile({
  id: 'example-payer-835',
  standard: 'x12-835',
  name: 'Example Blue Plan remittance',
  tables: {
    1033: { external: false, values: { 45: 'Charge exceeds the contracted rate' } },   // CARC descriptions
    1271: { external: false, values: { N130: 'Refer to the plan benefit documents' } }, // RARC descriptions
    128: { values: { '6R': 'This payer echoes the line number you sent' } },
  },
  segments: { REF: { fields: { 2: { meaning: 'This payer drops the alpha prefix from the member ID.' } } } },
});
```

A full example is in [`profiles/x12-835/example-payer.js`](profiles/x12-835/example-payer.js). Either commit it in a fork and add a `<script>` tag to `index.html`, or save it as `.json` and load it with **Vendor profiles → Load profile**, which keeps it in the browser tab and out of any repo.

**Starting from a real file.** Analyze a remittance, then click **Download profile stub**. You get a JSON profile listing every segment, element position and code the page couldn't explain, with `TODO` placeholders.

## Project layout

```
index.html                     the page (boilerplate + script tags)
core/                          shared with HL7-Helper: registry, code look-ups,
                               record summaries, shell, DOM builder, styles
standards/x12-835/
  parser.js                    text -> payment and claim records
  interpret.js                 look-ups, dates, amounts, balancing
  dictionary.js                base meaning (005010X221 names, our explanations)
  render.js                    record -> document (adapter used by core/shell.js)
  sample.js                    synthetic sample, generated from samples/
profiles/x12-835/              payer overlays
samples/x12-835/               synthetic sample files (the source of truth)
tools/build-samples.js         regenerates standards/x12-835/sample.js
tools/sync-core.js             copies core/ from a sibling HL7-Helper checkout
tests/                         node --test unit tests
docs/adr/                      architecture decisions
```

`core/` is maintained in HL7-Helper and copied here. See [ADR-0004](docs/adr/0004-separate-repos.md).

## Development

Node 20 or later, for tests. No dependencies to install.

```sh
npm test
node tools/build-samples.js              # after editing a sample
node tools/sync-core.js ../HL7-Helper    # after changing shared core code
```

| Test file | What it covers |
|---|---|
| `tests/x12-835-parser.test.js` | ISA-declared delimiters, composites, splitting into payment and claim records, PLB placement, segment counts, files with no envelope |
| `tests/x12-835-interpret.test.js` | Adjustment triplets, claim/line/payment balancing (including a deliberately broken file), navigator labels, summaries, and that licensed code lists stay external until a profile supplies them |

## Licensing and content

The code is licensed under [Apache-2.0](LICENSE). Standards content follows [ADR-0003](docs/adr/0003-content-licensing.md):

| Content | How it's handled |
|---|---|
| X12 835 | Segment IDs, element positions and element names are identifiers. Explanations are written in our own words; no implementation-guide text is copied. |
| Code lists | Only commonly published values are included. Payer-specific lists are marked as such. |
| CARC and RARC | Never bundled. Codes are shown and marked "external code list"; load the descriptions through a profile. |
| NUBC / UB-04 codes | Never bundled. |

This is not legal advice. If you're redistributing a fork commercially, check with your counsel.

X12 is a trademark of X12 Incorporated. This project is not affiliated with or endorsed by X12.

## Contributing

Contributions to the dictionary are the most valuable kind. Never paste a real remittance into an issue, pull request, test or sample — every value in this repo is invented.

## Not now

- Validation or conformance checking
- Writing or generating 835 files
- The 837 claim (that is its own transaction, and its own repo when it happens)
- Bundled CARC, RARC or NUBC descriptions
