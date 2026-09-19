# Contributing

Thanks for helping engineers understand healthcare data.

## Ground rules

1. **No real remittance data, ever.** That includes issues, pull requests, tests, samples and screenshots. Use obviously fake names, account numbers and payer IDs. If you're reporting a parsing problem, reduce it to a synthetic remittance that reproduces it.
2. **Write explanations in your own words.** Don't paste text from HL7 specifications, X12 TR3 implementation guides, AMA CPT or NUBC manuals. Names and identifiers (`PV1-20 Financial Class`) are fine.
3. **Never bundle licensed code sets.** CPT descriptions, NUBC/UB-04 codes and the X12 CARC/RARC reason-code descriptions stay out of the repo. Mark those tables `external: true` or `siteDefined: true` with a `note`, and let forks supply the text through a profile.
4. **Keep the privacy model intact.** No network calls, no storage, no third-party scripts, and no `innerHTML` with file content.

## Improving the dictionary

Each element entry in `standards/x12-835/dictionary.js` looks like this:

```js
2: {
  name: 'Claim Status Code',        // the X12 element name
  type: 'ID',                       // AN, DT, TM, ID, N0, R, AMT, or a composite
  table: '1029',                    // code list, keyed by X12 element number
  meaning: 'What the element is, in plain English.',
  rcm: 'Why it matters to posting, denials or appeals.',                // optional
  glance: { label: 'Claim status', aggregate: 'first' },                // optional: 'first' | 'list' | 'sum'
},
```

A good `meaning` is one or two sentences that a new engineer can act on. A good `rcm` note names the business consequence, such as a denial, a work queue, a late charge or a statement.

## Adding a payer profile to this repo

Shared profiles are welcome when they describe **publicly documented** payer behavior. Don't contribute anything from a confidential companion guide, and don't paste licensed reason-code descriptions. Keep those in a private fork, or load them at runtime.

## Adding or changing a sample

Sample files live in `samples/x12-835/` and are the source of truth. The page cannot fetch them when it is opened from disk, so they are also embedded in `standards/x12-835/sample.js`. After editing a sample, run `node tools/build-samples.js` to regenerate that file, and add new samples to the list at the top of the tool. Keep every value invented.

## Changing shared code

`core/` is maintained in [HL7-Helper](https://github.com/zarkara/HL7-Helper) and copied here (see [ADR-0004](docs/adr/0004-separate-repos.md)). Make the change there first, then run:

```sh
node tools/sync-core.js ../HL7-Helper
```

`node tools/sync-core.js ../HL7-Helper --check` fails when the copies are out of step.

## Before opening a pull request

```sh
node tools/build-samples.js   # only if you touched a sample
npm test
```

Then open `index.html` from disk (`file://`) and check that the sample renders in both light and dark mode, and at phone width.
