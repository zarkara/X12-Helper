/*
 * EXAMPLE payer profile for a FICTIONAL payer ("Example Blue Plan").
 *
 * Two things a fork usually adds for an 835:
 *
 * 1. Reason-code descriptions. Claim adjustment reason codes (CARC) and
 *    remittance advice remark codes (RARC) are maintained outside this project
 *    and their descriptions are not bundled (see docs/adr/0003). Paste the
 *    descriptions your payers send into a profile like this one — either
 *    committed in an internal fork, or kept private and loaded at runtime with
 *    "Load profile".
 * 2. Payer-specific qualifiers: the REF and AMT codes a payer uses its own way.
 *
 * The TODOs below are deliberate: fill them from your payer's companion guide
 * or the published code list, and the page will explain every code in the file.
 */
(function (root) {
  'use strict';

  root.HCX.registerProfile({
    id: 'example-payer-835',
    standard: 'x12-835',
    name: 'Example Blue Plan remittance (fictional example)',
    description: 'Shows how a payer overlay supplies reason-code descriptions and payer-specific identifiers.',

    tables: {
      // Setting external: false turns the flag off for the codes you supply.
      1033: {
        external: false,
        values: {
          45: 'TODO: description for CARC 45 from your payer or the published list',
          97: 'TODO: description for CARC 97',
        },
      },
      1271: {
        external: false,
        values: {
          N130: 'TODO: description for RARC N130',
        },
      },
      128: {
        values: {
          '6R': 'Example Blue Plan echoes the line number you sent on the claim',
        },
      },
    },

    segments: {
      REF: {
        fields: {
          2: { meaning: 'Example Blue Plan sends the member ID here without the alpha prefix, unlike the card.' },
        },
      },
    },
  });
})(globalThis);
