/*
 * X12 835 dictionary (005010X221 health care claim payment/advice).
 *
 * CONTENT RULES (see docs/adr/0003-content-licensing.md):
 *  - Segment IDs, element positions and element names are identifiers.
 *    Every explanation here is written in our own words; no text is copied
 *    from an X12 implementation guide.
 *  - Code tables hold only commonly published values. The external code lists
 *    that carry their own licensing — claim adjustment reason codes (CARC),
 *    remittance advice remark codes (RARC), CPT/HCPCS and NUBC codes — are
 *    marked `external` and their descriptions are never bundled. Add the ones
 *    your payers send through a vendor profile.
 *  - Table IDs are X12 element reference numbers, so they match what an
 *    implementation guide calls them.
 *
 * Field keys are the same as the HL7 dictionary: name, type, table, repeats,
 * meaning, rcm, glance.
 */
(function (root) {
  'use strict';

  root.HCX.registerDictionary('x12-835', {
    standard: 'X12 835',
    baseVersion: '005010X221',

    messageTypes: {
      payment: { name: 'Payment summary', summary: 'The payment itself: how much moved, by what method, from which payer to which payee, and any money held back at the provider level.', rcm: 'Post the payment from here, then work the claims. If this does not balance against the claims, nothing downstream will reconcile.' },
      claim: { name: 'Claim payment', summary: 'What the payer decided for one claim: what was charged, what was paid, what the patient owes and why the rest was not paid.', rcm: 'This is the denial and underpayment record. The adjustment codes say whether to write it off, bill the patient, or appeal.' },
    },

    segments: {
      ISA: {
        name: 'Interchange Control Header',
        purpose: 'The outer envelope of the file. Fixed width, which is how the file declares its own delimiters.',
        fields: {
          1: { name: 'Authorization Information Qualifier', type: 'ID' },
          5: { name: 'Interchange ID Qualifier (sender)', type: 'ID' },
          6: { name: 'Interchange Sender ID', type: 'AN', meaning: 'Who sent the interchange, usually the payer or its clearinghouse.' },
          8: { name: 'Interchange Receiver ID', type: 'AN', meaning: 'Who the interchange is addressed to.' },
          9: { name: 'Interchange Date', type: 'DT', meaning: 'Date the interchange was created (YYMMDD in ISA).' },
          10: { name: 'Interchange Time', type: 'TM' },
          13: { name: 'Interchange Control Number', type: 'N0', meaning: 'Matched by IEA02 at the end of the file.' },
          14: { name: 'Acknowledgment Requested', type: 'ID' },
          15: { name: 'Interchange Usage Indicator', type: 'ID', table: 'I14', meaning: 'P for production, T for test.', rcm: 'Test files that reach production posting are a classic incident.' },
          16: { name: 'Component Element Separator', type: 'AN', meaning: 'The character that separates the parts of a composite element.' },
        },
      },
      GS: {
        name: 'Functional Group Header',
        purpose: 'Groups transactions of one type inside the interchange.',
        fields: {
          1: { name: 'Functional Identifier Code', type: 'ID', meaning: 'HP for an 835.' },
          2: { name: 'Application Sender Code', type: 'AN' },
          3: { name: 'Application Receiver Code', type: 'AN' },
          4: { name: 'Date', type: 'DT' },
          5: { name: 'Time', type: 'TM' },
          6: { name: 'Group Control Number', type: 'N0' },
          8: { name: 'Version / Release / Industry Identifier Code', type: 'AN', meaning: 'The implementation guide the file follows, such as 005010X221A1.' },
        },
      },
      ST: { name: 'Transaction Set Header', purpose: 'Starts one remittance advice inside the group.', fields: { 1: { name: 'Transaction Set Identifier Code', type: 'ID', meaning: '835 for a remittance advice.' }, 2: { name: 'Transaction Set Control Number', type: 'AN' } } },
      SE: { name: 'Transaction Set Trailer', purpose: 'Ends the remittance advice and states how many segments it held.', fields: { 1: { name: 'Number of Included Segments', type: 'N0', meaning: 'Counted from ST through SE. A mismatch means the file is truncated or joined.' }, 2: { name: 'Transaction Set Control Number', type: 'AN' } } },
      GE: { name: 'Functional Group Trailer', fields: { 1: { name: 'Number of Transaction Sets Included', type: 'N0' }, 2: { name: 'Group Control Number', type: 'N0' } } },
      IEA: { name: 'Interchange Control Trailer', fields: { 1: { name: 'Number of Included Functional Groups', type: 'N0' }, 2: { name: 'Interchange Control Number', type: 'N0' } } },

      BPR: {
        name: 'Financial Information',
        purpose: 'The money: how much, which direction, by what method, and when it settles.',
        rcm: 'BPR02 is the amount that should hit the bank. Everything in the file has to add up to it.',
        fields: {
          1: { name: 'Transaction Handling Code', type: 'ID', table: '305', meaning: 'Whether money moves with this advice or the advice is information only.', rcm: 'An information-only advice (I or H) means no deposit to match — do not wait for one.' },
          2: { name: 'Total Actual Provider Payment Amount', type: 'AMT', meaning: 'The amount actually being paid.', rcm: 'Match this to the deposit. It equals the claims paid minus provider-level adjustments in PLB.', glance: { label: 'Payment amount', aggregate: 'first' } },
          3: { name: 'Credit/Debit Flag Code', type: 'ID', table: '478', meaning: 'C when money moves to the payee, D when it is taken back.' },
          4: { name: 'Payment Method Code', type: 'ID', table: '591', meaning: 'ACH, check, wire, or no payment at all.', glance: { label: 'Payment method', aggregate: 'first' } },
          5: { name: 'Payment Format Code', type: 'ID', meaning: 'Format of the payment order, such as CCP for cash concentration plus addenda.' },
          6: { name: 'DFI ID Number Qualifier (sender)', type: 'ID', table: '506' },
          7: { name: 'Sender DFI Identifier', type: 'AN', meaning: 'Routing number of the payer bank.' },
          8: { name: 'Account Number Qualifier (sender)', type: 'ID', table: '569', meaning: 'What kind of account the payer is paying from.' },
          9: { name: 'Sender Bank Account Number', type: 'AN' },
          10: { name: 'Originating Company Identifier', type: 'AN', meaning: 'Payer identifier the bank sees.', rcm: 'Use this with the trace number to match a deposit that arrived without a remittance.' },
          12: { name: 'DFI ID Number Qualifier (receiver)', type: 'ID', table: '506' },
          13: { name: 'Receiver DFI Identifier', type: 'AN', meaning: 'Routing number of the payee bank.' },
          14: { name: 'Account Number Qualifier (receiver)', type: 'ID', table: '569', meaning: 'What kind of account the payee is paid into.' },
          15: { name: 'Receiver Bank Account Number', type: 'AN' },
          16: { name: 'Check or EFT Effective Date', type: 'DT', meaning: 'When the money settles.', rcm: 'Posting date for the payment; also what the bank statement will show.', glance: { label: 'Effective date', aggregate: 'first' } },
        },
      },

      TRN: {
        name: 'Reassociation Trace Number',
        purpose: 'The number that ties this advice to the deposit or check.',
        rcm: 'This is how a deposit on the bank statement is matched to the remittance that explains it. Without it, cash sits unapplied.',
        fields: {
          1: { name: 'Trace Type Code', type: 'ID', meaning: '1 for a current transaction trace number.' },
          2: { name: 'Check or EFT Trace Number', type: 'AN', meaning: 'Check number, or the EFT trace the bank shows.', glance: { label: 'Check / EFT number', aggregate: 'first' } },
          3: { name: 'Payer Identifier', type: 'AN', meaning: 'Usually the payer tax ID with a leading 1.' },
          4: { name: 'Originating Company Supplemental Code', type: 'AN' },
        },
      },

      CUR: { name: 'Foreign Currency Information', purpose: 'Currency when the payment is not in US dollars.', fields: { 1: { name: 'Entity Identifier Code', type: 'ID', table: '98' }, 2: { name: 'Currency Code', type: 'ID' } } },

      REF: {
        name: 'Reference Identification',
        purpose: 'An identifier whose meaning comes from the qualifier in REF01. It appears in several places: about the payee, the claim, or the service line.',
        rcm: 'The qualifier is everything. F8 is the original claim number on a reversal, 6R is your own line number, and 1W or 1L identify the member and group.',
        fields: {
          1: { name: 'Reference Identification Qualifier', type: 'ID', table: '128', meaning: 'What kind of identifier REF02 holds.' },
          2: { name: 'Reference Identification', type: 'AN', meaning: 'The identifier itself.' },
          3: { name: 'Description', type: 'AN' },
        },
      },

      DTM: {
        name: 'Date or Time Reference',
        purpose: 'A date whose meaning comes from the qualifier in DTM01.',
        rcm: 'Service dates (472) and claim statement periods (232/233) are what a posting team matches against the claim.',
        fields: {
          1: { name: 'Date/Time Qualifier', type: 'ID', table: '374', meaning: 'What this date means.' },
          2: { name: 'Date', type: 'DT', meaning: 'The date itself, as CCYYMMDD.' },
        },
      },

      N1: {
        name: 'Party Identification',
        purpose: 'A party to the payment: the payer (PR) and the payee (PE).',
        fields: {
          1: { name: 'Entity Identifier Code', type: 'ID', table: '98', meaning: 'Which role this party plays.' },
          2: { name: 'Name', type: 'AN', meaning: 'Name of the payer or payee.', glance: { label: 'Parties', aggregate: 'list' } },
          3: { name: 'Identification Code Qualifier', type: 'ID', table: '66' },
          4: { name: 'Identification Code', type: 'AN', meaning: 'Payer ID, or the payee NPI or tax ID.', rcm: 'The payee NPI here should match the billing NPI on the claims, or the payment lands in the wrong entity.' },
        },
      },
      N3: { name: 'Party Address', fields: { 1: { name: 'Address Information', type: 'AN' }, 2: { name: 'Address Information', type: 'AN' } } },
      N4: { name: 'Party City, State, ZIP', fields: { 1: { name: 'City Name', type: 'AN' }, 2: { name: 'State or Province Code', type: 'ID' }, 3: { name: 'Postal Code', type: 'ID' }, 4: { name: 'Country Code', type: 'ID' } } },
      PER: {
        name: 'Administrative Contact',
        purpose: 'Who to call at the payer about this remittance.',
        rcm: 'The claims office number here is the one to use for an appeal or a reprocessing request.',
        fields: {
          1: { name: 'Contact Function Code', type: 'ID', table: '366' },
          2: { name: 'Name', type: 'AN' },
          3: { name: 'Communication Number Qualifier', type: 'ID', table: '365' },
          4: { name: 'Communication Number', type: 'AN' },
          5: { name: 'Communication Number Qualifier', type: 'ID', table: '365' },
          6: { name: 'Communication Number', type: 'AN' },
          7: { name: 'Communication Number Qualifier', type: 'ID', table: '365' },
          8: { name: 'Communication Number', type: 'AN' },
        },
      },

      LX: { name: 'Header Number', purpose: 'Starts a group of claims that share a provider summary.', fields: { 1: { name: 'Assigned Number', type: 'N0' } } },
      TS3: {
        name: 'Provider Summary Information',
        purpose: 'Totals for one provider in this payment.',
        rcm: 'Useful for reconciling by provider when a single payment covers several NPIs.',
        fields: {
          1: { name: 'Provider Identifier', type: 'AN' },
          2: { name: 'Facility Type Code', type: 'AN', table: '1331' },
          3: { name: 'Fiscal Period Date', type: 'DT' },
          4: { name: 'Total Claim Count', type: 'N0' },
          5: { name: 'Total Claim Charge Amount', type: 'AMT' },
        },
      },
      TS2: { name: 'Provider Supplemental Summary Information', purpose: 'Inpatient and outpatient totals behind a provider summary.', fields: { 1: { name: 'Total DRG Amount', type: 'AMT' }, 2: { name: 'Total Federal Specific Amount', type: 'AMT' }, 3: { name: 'Total Hospital Specific Amount', type: 'AMT' } } },

      CLP: {
        name: 'Claim Payment Information',
        purpose: 'The payer\'s decision on one claim: what was charged, what was paid, what the patient owes, and the payer\'s own claim number.',
        rcm: 'The heart of the remittance. Status plus the adjustments below it decide whether the balance is written off, billed to the patient, or appealed.',
        fields: {
          1: { name: 'Patient Control Number', type: 'AN', meaning: 'Your account or claim number, echoed back from the claim.', rcm: 'This is what payment posting matches on. A blank or altered value means the payment has to be worked by hand.', glance: { label: 'Patient control number', aggregate: 'first' } },
          2: { name: 'Claim Status Code', type: 'ID', table: '1029', meaning: 'How the claim finished: paid as primary, denied, reversed, forwarded to another payer.', rcm: 'Status 4 is a denial, 22 is a take-back of a previous payment, and 19-23 mean another payer is next.', glance: { label: 'Claim status', aggregate: 'first' } },
          3: { name: 'Total Claim Charge Amount', type: 'AMT', meaning: 'What was billed.', glance: { label: 'Charged', aggregate: 'first' } },
          4: { name: 'Claim Payment Amount', type: 'AMT', meaning: 'What the payer is paying on this claim.', glance: { label: 'Paid', aggregate: 'first' } },
          5: { name: 'Patient Responsibility Amount', type: 'AMT', meaning: 'What the patient owes: deductible, coinsurance, copay.', rcm: 'This is the statement amount, and it should equal the PR-group adjustments below.', glance: { label: 'Patient responsibility', aggregate: 'first' } },
          6: { name: 'Claim Filing Indicator Code', type: 'ID', table: '1032', meaning: 'What kind of coverage paid: Medicare, Medicaid, commercial, and so on.' },
          7: { name: 'Payer Claim Control Number', type: 'AN', meaning: 'The payer\'s own claim number (often called the ICN or DCN).', rcm: 'Quote this when you call about the claim, and send it back on a corrected claim.', glance: { label: 'Payer claim number', aggregate: 'first' } },
          8: { name: 'Facility Type Code', type: 'AN', table: '1331', meaning: 'Place of service or the first two digits of the institutional bill type.' },
          9: { name: 'Claim Frequency Code', type: 'ID', table: '1325', meaning: 'Original, corrected or voided claim.' },
          11: { name: 'Diagnosis Related Group (DRG) Code', type: 'AN', meaning: 'DRG the payer assigned.', rcm: 'A DRG different from the one you expected is a coding or grouper dispute worth reviewing.' },
          12: { name: 'Diagnosis Related Group (DRG) Weight', type: 'R' },
          13: { name: 'Percent Discharge Fraction', type: 'R' },
        },
      },

      CAS: {
        name: 'Claim or Service Adjustment',
        purpose: 'Why the payer did not pay the full amount. Reasons repeat in threes: group code, reason code, amount.',
        rcm: 'The most important segment in the file. The group code decides who absorbs the money: CO is a write-off, PR is billable to the patient, OA and PI usually need work.',
        fields: {
          1: { name: 'Claim Adjustment Group Code', type: 'ID', table: '1034', meaning: 'Who the adjustment falls on.', rcm: 'CO is a contractual write-off, PR goes on the patient statement, PI is a payer reduction you may be able to appeal.', glance: { label: 'Adjustment groups', aggregate: 'list' } },
          2: { name: 'Adjustment Reason Code', type: 'ID', table: '1033', meaning: 'The reason code (CARC) for this adjustment.' },
          3: { name: 'Adjustment Amount', type: 'AMT', meaning: 'How much this reason accounts for.' },
          4: { name: 'Adjustment Quantity', type: 'R', meaning: 'Units involved, when the adjustment is unit-based.' },
          5: { name: 'Adjustment Reason Code', type: 'ID', table: '1033', meaning: 'Second reason in this segment.' },
          6: { name: 'Adjustment Amount', type: 'AMT' },
          7: { name: 'Adjustment Quantity', type: 'R' },
          8: { name: 'Adjustment Reason Code', type: 'ID', table: '1033', meaning: 'Third reason in this segment.' },
          9: { name: 'Adjustment Amount', type: 'AMT' },
          10: { name: 'Adjustment Quantity', type: 'R' },
          11: { name: 'Adjustment Reason Code', type: 'ID', table: '1033' },
          12: { name: 'Adjustment Amount', type: 'AMT' },
          13: { name: 'Adjustment Quantity', type: 'R' },
          14: { name: 'Adjustment Reason Code', type: 'ID', table: '1033' },
          15: { name: 'Adjustment Amount', type: 'AMT' },
          16: { name: 'Adjustment Quantity', type: 'R' },
          17: { name: 'Adjustment Reason Code', type: 'ID', table: '1033' },
          18: { name: 'Adjustment Amount', type: 'AMT' },
          19: { name: 'Adjustment Quantity', type: 'R' },
        },
      },

      NM1: {
        name: 'Individual or Organizational Name',
        purpose: 'A name in the claim loop: the patient (QC), the subscriber (IL), the rendering provider (82), a corrected name (74), or the payer a claim was forwarded to (TT).',
        rcm: 'A corrected name or member ID here is why the claim was reprocessed, and what your record should be updated to.',
        fields: {
          1: { name: 'Entity Identifier Code', type: 'ID', table: '98', meaning: 'Whose name this is.' },
          2: { name: 'Entity Type Qualifier', type: 'ID', table: '1065', meaning: '1 for a person, 2 for an organization.' },
          3: { name: 'Name Last or Organization Name', type: 'AN' },
          4: { name: 'Name First', type: 'AN' },
          5: { name: 'Name Middle', type: 'AN' },
          7: { name: 'Name Suffix', type: 'AN' },
          8: { name: 'Identification Code Qualifier', type: 'ID', table: '66', meaning: 'What kind of ID follows.' },
          9: { name: 'Identification Code', type: 'AN', meaning: 'Member ID, NPI, or other identifier.', rcm: 'The member ID the payer used. If it differs from yours, fix the registration before the next claim.' },
        },
      },

      MIA: {
        name: 'Inpatient Adjudication Information',
        purpose: 'How an inpatient claim was priced under a prospective payment system.',
        rcm: 'Outlier, capital and pass-through amounts explain a payment that does not match the DRG base rate.',
        fields: {
          1: { name: 'Covered Days or Visits Count', type: 'N0' },
          2: { name: 'PPS Operating Outlier Amount', type: 'AMT' },
          3: { name: 'Lifetime Psychiatric Days Count', type: 'N0' },
          4: { name: 'Claim DRG Amount', type: 'AMT', meaning: 'The DRG base payment.' },
          5: { name: 'Claim Payment Remark Code', type: 'AN', table: '1271' },
          6: { name: 'Claim Disproportionate Share Amount', type: 'AMT' },
          7: { name: 'Claim MSP Pass-through Amount', type: 'AMT' },
          8: { name: 'Claim PPS Capital Amount', type: 'AMT' },
          20: { name: 'Claim Payment Remark Code', type: 'AN', table: '1271' },
          21: { name: 'Claim Payment Remark Code', type: 'AN', table: '1271' },
          22: { name: 'Claim Payment Remark Code', type: 'AN', table: '1271' },
          23: { name: 'Claim Payment Remark Code', type: 'AN', table: '1271' },
          24: { name: 'Claim Payment Remark Code', type: 'AN', table: '1271' },
        },
      },

      MOA: {
        name: 'Outpatient Adjudication Information',
        purpose: 'How an outpatient claim was priced, plus remark codes.',
        rcm: 'MOA03 onward carry the remark codes (RARC) that explain a Medicare adjustment in words.',
        fields: {
          1: { name: 'Reimbursement Rate', type: 'R' },
          2: { name: 'HCPCS Payable Amount', type: 'AMT' },
          3: { name: 'Claim Payment Remark Code', type: 'AN', table: '1271' },
          4: { name: 'Claim Payment Remark Code', type: 'AN', table: '1271' },
          5: { name: 'Claim Payment Remark Code', type: 'AN', table: '1271' },
          6: { name: 'Claim Payment Remark Code', type: 'AN', table: '1271' },
          7: { name: 'Claim Payment Remark Code', type: 'AN', table: '1271' },
          8: { name: 'Claim ESRD Payment Amount', type: 'AMT' },
          9: { name: 'Non-payable Professional Component Amount', type: 'AMT' },
        },
      },

      AMT: {
        name: 'Monetary Amount',
        purpose: 'An amount whose meaning comes from the qualifier in AMT01.',
        rcm: 'B6 (allowed amount) is what contract management compares against the fee schedule, and F5 is what the patient already paid.',
        fields: {
          1: { name: 'Amount Qualifier Code', type: 'ID', table: '522', meaning: 'What this amount is.' },
          2: { name: 'Monetary Amount', type: 'AMT' },
        },
      },

      QTY: {
        name: 'Quantity',
        purpose: 'A count whose meaning comes from the qualifier in QTY01.',
        rcm: 'Covered versus non-covered days drive inpatient patient liability.',
        fields: {
          1: { name: 'Quantity Qualifier', type: 'ID', table: '673', meaning: 'What is being counted.' },
          2: { name: 'Quantity', type: 'R' },
        },
      },

      SVC: {
        name: 'Service Payment Information',
        purpose: 'One service line: the procedure, what was charged, what was paid, and the units.',
        rcm: 'Line-level detail is where underpayments hide. A claim can balance while one line is paid at the wrong rate.',
        fields: {
          1: { name: 'Composite Medical Procedure Identifier', type: 'C003', meaning: 'The procedure paid, with its modifiers.', rcm: 'If this differs from what you billed, the payer re-coded the line — check SVC06 for the original.', glance: { label: 'Service lines', aggregate: 'list' } },
          2: { name: 'Line Item Charge Amount', type: 'AMT', meaning: 'What was billed for the line.' },
          3: { name: 'Line Item Provider Payment Amount', type: 'AMT', meaning: 'What was paid for the line.' },
          4: { name: 'Revenue Code', type: 'AN', meaning: 'Institutional revenue code for the line.' },
          5: { name: 'Units of Service Paid Count', type: 'R', meaning: 'Units the payer paid for.', rcm: 'Fewer units than billed is a quantity denial, and often appealable.' },
          6: { name: 'Original Procedure Code', type: 'C003', meaning: 'What you submitted, when the payer changed it.', rcm: 'Present means the line was re-coded: compare with SVC01 before writing off the difference.' },
          7: { name: 'Original Units of Service Count', type: 'R' },
        },
      },

      LQ: {
        name: 'Health Care Remark Codes',
        purpose: 'Remark codes that add detail to an adjustment, at claim or line level.',
        rcm: 'Remark codes often carry the appeal instruction, such as which document was missing.',
        fields: {
          1: { name: 'Code List Qualifier Code', type: 'ID', table: '1270', meaning: 'Which code list the code below comes from.' },
          2: { name: 'Industry Code', type: 'AN', table: '1271', meaning: 'The remark code itself.' },
        },
      },

      PLB: {
        name: 'Provider Adjustment',
        purpose: 'Money added to or taken from the payment outside any single claim: overpayment recovery, interest, penalties, capitation, forwarding balances. Reason and amount repeat in pairs.',
        rcm: 'This is why the deposit does not match the sum of the claims. A WO (overpayment recovery) here is a previous claim being clawed back, and needs to be traced to the original account.',
        fields: {
          1: { name: 'Provider Identifier', type: 'AN', meaning: 'Which provider the adjustment applies to.' },
          2: { name: 'Fiscal Period Date', type: 'DT' },
          3: { name: 'Adjustment Identifier', type: 'C042', meaning: 'Reason code plus the reference it applies to, such as the original claim number.' },
          4: { name: 'Provider Adjustment Amount', type: 'AMT', meaning: 'Positive amounts reduce the payment; negative amounts increase it.', rcm: 'The direction trips people up: a positive PLB amount is money being taken back.' },
          5: { name: 'Adjustment Identifier', type: 'C042' },
          6: { name: 'Provider Adjustment Amount', type: 'AMT' },
          7: { name: 'Adjustment Identifier', type: 'C042' },
          8: { name: 'Provider Adjustment Amount', type: 'AMT' },
          9: { name: 'Adjustment Identifier', type: 'C042' },
          10: { name: 'Provider Adjustment Amount', type: 'AMT' },
        },
      },
    },

    /* Composite elements. `components` entries are a name or { name, table }. */
    dataTypes: {
      C003: {
        name: 'Composite Medical Procedure Identifier',
        display: '{2} ({1})',
        components: [
          { name: 'Product/Service ID Qualifier', table: '235' },
          'Procedure Code',
          'Procedure Modifier 1', 'Procedure Modifier 2', 'Procedure Modifier 3', 'Procedure Modifier 4',
          'Description',
        ],
      },
      C042: {
        name: 'Adjustment Identifier',
        display: '{1} {2}',
        components: [{ name: 'Adjustment Reason Code', table: '426' }, 'Provider Adjustment Identifier'],
      },
    },

    /*
     * Code tables, keyed by X12 element reference number.
     *  - external: a separately maintained code list; values are never bundled.
     *  - siteDefined: payer-specific usage.
     */
    tables: {
      I14: { name: 'Interchange Usage Indicator', values: { P: 'Production', T: 'Test', I: 'Information' } },
      '66': { name: 'Identification Code Qualifier', siteDefined: true, values: { '24': 'Employer identification number', '34': 'Social Security number', BD: 'Blue Cross provider number', BS: 'Blue Shield provider number', FI: 'Federal taxpayer identification number', HN: 'Health insurance claim (HIC) number', MC: 'Medicaid provider number', MI: 'Member identification number', PI: 'Payer identification', PP: 'Pharmacy processor number', SV: 'Service provider number', XV: 'CMS plan identifier', XX: 'National Provider Identifier (NPI)' } },
      '98': { name: 'Entity Identifier Code', siteDefined: true, values: { '28': 'Subscriber', '40': 'Receiver', '41': 'Submitter', '74': 'Corrected insured', '77': 'Service location', '82': 'Rendering provider', '85': 'Billing provider', DN: 'Referring provider', IL: 'Insured or subscriber', PE: 'Payee', PR: 'Payer', QC: 'Patient', TT: 'Transfer to (another payer)' } },
      '128': { name: 'Reference Identification Qualifier', siteDefined: true, values: { '0B': 'State license number', '1A': 'Blue Cross provider number', '1B': 'Blue Shield provider number', '1C': 'Medicare provider number', '1D': 'Medicaid provider number', '1G': 'Provider UPIN', '1H': 'CHAMPUS identification number', '1J': 'Facility identification', '1L': 'Group or policy number', '1S': 'Ambulatory patient group number', '1W': 'Member identification number', '6P': 'Group number', '6R': 'Provider control number (your line number)', '9A': 'Repriced claim reference number', '9C': 'Adjusted repriced claim reference number', APC: 'Ambulatory payment classification', BB: 'Authorization number', CE: 'Class of contract code', E9: 'Attachment code', EA: 'Medical record identification number', EV: 'Receiver identification number', F8: 'Original reference number (original claim)', G1: 'Prior authorization number', G3: 'Predetermination of benefits identification number', IG: 'Insurance policy number', LU: 'Location number', PQ: 'Payee identification', RB: 'Rate code number', SY: 'Social Security number', TJ: 'Federal taxpayer identification number' } },
      '235': { name: 'Product/Service ID Qualifier', values: { AD: 'American Dental Association codes', ER: 'Jurisdiction-specific procedure and supply codes', HC: 'HCPCS / CPT procedure code', HP: 'Health insurance prospective payment system (HIPPS) rate code', IV: 'Home infusion EDI coalition product/service code', N4: 'National Drug Code (5-4-2 format)', NU: 'National Uniform Billing Committee code', RB: 'Revenue code', WK: 'Advanced Billing Concepts (ABC) code' } },
      '305': { name: 'Transaction Handling Code', values: { C: 'Payment accompanies this remittance advice', D: 'Make payment only (no remittance detail)', H: 'Notification only, no payment', I: 'Remittance information only', P: 'Prenotification of a future transfer', U: 'Split payment and remittance', X: 'Handling party\'s option to split' } },
      '365': { name: 'Communication Number Qualifier', values: { EM: 'Email', EX: 'Telephone extension', FX: 'Fax', TE: 'Telephone', UR: 'Web address' } },
      '366': { name: 'Contact Function Code', values: { BL: 'Technical department', CX: 'Payer claim office', IC: 'Information contact' } },
      '374': { name: 'Date/Time Qualifier', siteDefined: true, values: { '036': 'Coverage expiration', '050': 'Received', '150': 'Service period start', '151': 'Service period end', '232': 'Claim statement period start', '233': 'Claim statement period end', '405': 'Production (when the payer produced this advice)', '472': 'Service date' } },
      '426': { name: 'Provider Adjustment Reason Code', siteDefined: true, values: { '50': 'Late charge', '51': 'Interest penalty charge', '72': 'Authorized return', '90': 'Early payment allowance', AM: 'Applied to borrower account', AP: 'Acceleration of benefits', B2: 'Rebate', B3: 'Recovery allowance', BD: 'Bad debt adjustment', BN: 'Bonus', CR: 'Capitation interest', CS: 'Adjustment', CT: 'Capitation payment', CV: 'Capital pass-through', DM: 'Direct medical education pass-through', E3: 'Withholding', FB: 'Forwarding balance (carried to a later payment)', FC: 'Fund allocation', GO: 'Graduate medical education pass-through', IP: 'Incentive premium payment', IR: 'IRS withholding', IS: 'Interim settlement', J1: 'Non-reimbursable', L3: 'Penalty', L6: 'Interest owed', LE: 'Levy', LS: 'Lump sum', OB: 'Offset for affiliated providers', PI: 'Periodic interim payment', PL: 'Final payment', RA: 'Retro-activity adjustment', RE: 'Return on equity', SL: 'Student loan repayment', TL: 'Third party liability', WO: 'Overpayment recovery', WU: 'Unspecified recovery' } },
      '478': { name: 'Credit/Debit Flag Code', values: { C: 'Credit (money to the payee)', D: 'Debit (money taken back)' } },
      '506': { name: 'DFI Identification Number Qualifier', values: { '01': 'ABA transit routing number', '04': 'Canadian bank branch and institution number', ZZ: 'Mutually defined' } },
      '522': { name: 'Amount Qualifier Code', siteDefined: true, values: { AU: 'Coverage amount', B6: 'Allowed amount (the contracted rate)', D8: 'Discount amount', DY: 'Per-day limit', F5: 'Patient amount already paid', I: 'Interest', NL: 'Negative ledger balance', T: 'Tax', T2: 'Total claim before taxes' } },
      '569': { name: 'Account Number Qualifier', values: { DA: 'Demand deposit (checking)', SG: 'Savings' } },
      '591': { name: 'Payment Method Code', values: { ACH: 'Automated clearing house (EFT)', BOP: 'Financial institution option', CHK: 'Check', FWT: 'Wire transfer', NON: 'No payment with this advice' } },
      '673': { name: 'Quantity Qualifier', siteDefined: true, values: { CA: 'Covered days or visits - actual', CD: 'Co-insured - actual', LA: 'Lifetime reserve - actual', LE: 'Lifetime reserve - estimated', NE: 'Non-covered - estimated', NR: 'Blood units not replaced', OU: 'Outlier days', PS: 'Prescriptions', VS: 'Visits' } },
      '1065': { name: 'Entity Type Qualifier', values: { 1: 'Person', 2: 'Non-person entity (an organization)' } },
      '1029': { name: 'Claim Status Code', values: { 1: 'Processed as primary', 2: 'Processed as secondary', 3: 'Processed as tertiary', 4: 'Denied', 19: 'Processed as primary, forwarded to another payer', 20: 'Processed as secondary, forwarded to another payer', 21: 'Processed as tertiary, forwarded to another payer', 22: 'Reversal of a previous payment', 23: 'Not our claim, forwarded to another payer', 25: 'Predetermination pricing only - no payment' } },
      '1032': { name: 'Claim Filing Indicator Code', siteDefined: true, values: { '12': 'PPO', '13': 'Point of service', '14': 'Exclusive provider organization', '15': 'Indemnity insurance', '16': 'Medicare Advantage / HMO risk', '17': 'Dental maintenance organization', AM: 'Automobile medical', BL: 'Blue Cross / Blue Shield', CH: 'TRICARE / CHAMPUS', CI: 'Commercial insurance', DS: 'Disability', FI: 'Federal employees program', HM: 'Health maintenance organization', LM: 'Liability medical', MA: 'Medicare Part A', MB: 'Medicare Part B', MC: 'Medicaid', OF: 'Other federal program', TV: 'Title V', VA: 'Veterans Affairs plan', WC: 'Workers compensation', ZZ: 'Mutually defined' } },
      '1033': { name: 'Claim Adjustment Reason Code (CARC)', external: true, note: 'Maintained by X12 and published on x12.org. Descriptions are not bundled here; add the codes your payers send to a vendor profile.' },
      '1034': { name: 'Claim Adjustment Group Code', values: { CO: 'Contractual obligation (provider write-off)', CR: 'Correction or reversal', OA: 'Other adjustment', PI: 'Payer-initiated reduction', PR: 'Patient responsibility (billable to the patient)' } },
      '1270': { name: 'Code List Qualifier Code', values: { HE: 'Claim payment remark codes (RARC)', RX: 'NCPDP reject or payment codes' } },
      '1271': { name: 'Remittance Advice Remark Code (RARC)', external: true, note: 'Maintained by CMS and published with the X12 code lists. Descriptions are not bundled here; add the ones your payers send to a vendor profile.' },
      '1325': { name: 'Claim Frequency Type Code', external: true, note: 'The NUBC bill-type frequency digit (original, corrected, void). NUBC code descriptions are licensed and not bundled here.' },
      '1331': { name: 'Facility Type Code', external: true, note: 'Place-of-service codes (professional) or the first two digits of the NUBC bill type (institutional). Not bundled here.' },
    },
  });
})(globalThis);
