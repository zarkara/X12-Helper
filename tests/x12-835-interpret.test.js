const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load');

const HCX = loadCore();
const x12 = HCX.x12835;
const dictionary = HCX.buildEffectiveDictionary('x12-835', []);
const records = x12.parse(HCX.samples['x12-835'][0].text).records;
const [payment, paidClaim, deniedClaim] = records;

test('formats X12 dates and amounts', () => {
  assert.equal(x12.formatDate('20260921'), '2026-09-21');
  assert.equal(x12.formatDate('202609211015'), '2026-09-21 10:15');
  assert.equal(x12.formatDate('2026'), null);
  assert.equal(x12.formatAmount('1320.75'), '1320.75');
  assert.equal(x12.formatAmount('80'), '80.00');
  assert.equal(x12.formatAmount('not a number'), 'not a number');
});

test('reads the adjustment triplets a CAS segment packs into one line', () => {
  const cas = paidClaim.segments.find((segment) => segment.raw === 'CAS*PR*1*100*PR*2*69.25');

  assert.deepEqual(x12.adjustmentsIn(cas), [
    { group: 'PR', reason: '1', amount: 100, quantity: 'PR' },
    { group: 'PR', reason: '2', amount: 69.25, quantity: '' },
  ]);
});

test('checks that a claim balances: charged = paid + adjustments', () => {
  assert.deepEqual(x12.claimBalance(paidClaim), {
    charged: 1800, paid: 1320.75, patientResponsibility: 329.25, adjustments: 479.25, difference: 0, balanced: true,
  });
});

test('catches a claim that does not balance', () => {
  const broken = x12.parse(HCX.samples['x12-835'][0].text.replace('CAS*CO*45*30~', 'CAS*CO*45*20~')).records[1];
  const balance = x12.claimBalance(broken);

  assert.equal(balance.balanced, false);
  assert.equal(balance.difference, 10);
});

test('totals adjustments by group, largest first', () => {
  assert.deepEqual(x12.adjustmentsByGroup(paidClaim), [{ group: 'PR', amount: 329.25 }, { group: 'CO', amount: 150 }]);
  assert.deepEqual(x12.adjustmentsByGroup(deniedClaim), [{ group: 'CO', amount: 1250 }]);
});

test('balances every service line against the adjustments that follow it', () => {
  assert.deepEqual(x12.serviceLineBalances(paidClaim), [
    { service: '99214', charged: 250, paid: 180, adjustments: 70, difference: 0, balanced: true },
    { service: '80053', charged: 1200, paid: 950.75, adjustments: 249.25, difference: 0, balanced: true },
    { service: '85025', charged: 350, paid: 190, adjustments: 160, difference: 0, balanced: true },
  ]);
});

test('balances the payment: BPR02 = claims paid minus provider adjustments', () => {
  assert.deepEqual(x12.paymentBalance(records), {
    paid: 1245.75, claimsPaid: 1320.75, providerAdjustments: 75, difference: 0, balanced: true,
  });
});

test('reads provider-level adjustments as reason, reference and amount', () => {
  assert.deepEqual(x12.providerAdjustmentsIn(payment), [{ reason: 'WO', reference: 'ACCT7712001', amount: 75 }]);
});

test('labels the payment and each claim for the navigator', () => {
  assert.deepEqual(records.map((record) => x12.recordLabel(record, dictionary)), [
    '#1 · Payment summary',
    '#2 · ACCT7788990 · JANE DOE · Processed as primary · paid 1320.75 of 1800.00',
    '#3 · ACCT7788991 · SAM ROE · Denied · paid 0.00 of 625.00',
  ]);
});

test('summarizes the payment record', () => {
  const glance = Object.fromEntries(x12.collectGlance(payment, dictionary).map(({ label, text }) => [label, text]));

  assert.equal(glance['Payment amount'], '1245.75');
  assert.equal(glance['Payment method'], 'ACH — Automated clearing house (EFT)');
  assert.equal(glance['Check / EFT number'], 'EFT20260921001');
  assert.equal(glance['Effective date'], '2026-09-21');
  assert.equal(glance.Parties, 'EXAMPLE BLUE PLAN; ACME PRIMARY CARE WESTSIDE');
});

test('summarizes a denied claim', () => {
  const glance = Object.fromEntries(x12.collectGlance(deniedClaim, dictionary).map(({ label, text }) => [label, text]));

  assert.equal(glance['Claim status'], '4 — Denied');
  assert.equal(glance.Charged, '625.00');
  assert.equal(glance.Paid, '0.00');
  assert.equal(glance['Adjustment groups'], 'CO — Contractual obligation (provider write-off)');
  assert.equal(glance['Service lines'], '97110 (HC)');
});

test('leaves licensed code lists external rather than bundling descriptions', () => {
  const carc = x12.lookupCode(dictionary, '1033', '45');
  const rarc = x12.lookupCode(dictionary, '1271', 'N130');

  assert.equal(carc.status, x12.CODE_STATUS.EXTERNAL);
  assert.equal(rarc.status, x12.CODE_STATUS.EXTERNAL);
  assert.match(carc.note, /not bundled here/);
  assert.equal(x12.lookupCode(dictionary, '1034', 'PR').meaning, 'Patient responsibility (billable to the patient)');
});

test('the sample is fully explained by the dictionary', () => {
  const stub = records.reduce((accumulated, record) => x12.collectUnknowns(record, dictionary, accumulated), {});

  assert.deepEqual(stub, {}, `unexplained: ${JSON.stringify(stub)}`);
});

test('a payer profile can supply the reason-code descriptions the repo cannot ship', () => {
  HCX.registerProfile({
    id: 'test-carc-pack', standard: 'x12-835', name: 'Test CARC pack',
    tables: { 1033: { external: false, values: { 45: 'Charge exceeds the contracted rate' } } },
  });
  const withPack = HCX.buildEffectiveDictionary('x12-835', ['test-carc-pack']);

  assert.deepEqual(x12.lookupCode(withPack, '1033', '45'), {
    status: x12.CODE_STATUS.KNOWN, tableId: '1033', tableName: 'Claim Adjustment Reason Code (CARC)',
    note: dictionary.tables['1033'].note, meaning: 'Charge exceeds the contracted rate', source: 'Test CARC pack',
  });
});
