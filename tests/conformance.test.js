/*
 * Runs the parser and the dictionary over remittances written by other people.
 *
 * Our own sample can only confirm what we already believed. These files come
 * from four unrelated open-source projects and describe real payer behaviour:
 * denials, reversals, capitation, forwarding balances, and payers that omit an
 * element and shift everything after it. What they contain that we cannot
 * explain is recorded in conformance/baseline.json, and this test refuses to
 * let it grow.
 *
 * The envelope warnings and the balance differences are recorded too, because
 * those are the page working correctly on defective files, and a change in
 * either number means the checks themselves moved.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadCore } = require('./load');
const { report, totals, corpusFiles, BASELINE } = require('../tools/conformance-report');

const result = report(loadCore());
const current = totals(result);
const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));

test('every remittance in the corpus parses', () => {
  assert.deepEqual(result.parseFailures, [], 'files the parser could not read');
  assert.ok(result.records > 0, 'the corpus produced no records at all');
});

test('the corpus is still all there', () => {
  assert.ok(corpusFiles().length >= 18, 'conformance files have gone missing');
  assert.equal(current.files, baseline.totals.files, 'corpus file count changed — regenerate the baseline');
  assert.equal(current.records, baseline.totals.records, 'corpus record count changed — regenerate the baseline');
});

for (const measure of ['unknownSegments', 'elementsPastDictionary', 'undefinedTables', 'codesNotInTable']) {
  test(`${measure} has not grown`, () => {
    assert.ok(
      current[measure] <= baseline.totals[measure],
      `${measure} went from ${baseline.totals[measure]} to ${current[measure]}.\n` +
      'Something in the corpus is no longer explained. Either explain it in the dictionary, ' +
      'or run node tools/update-conformance-baseline.js and say why in the commit message.\n' +
      `now: ${JSON.stringify(result[measure])}`,
    );
  });
}

test('the checks still catch what they caught before', () => {
  assert.equal(current.envelopeWarnings, baseline.totals.envelopeWarnings, 'the SE01 segment-count check changed its mind about these files');
  assert.equal(current.unbalanced, baseline.totals.unbalanced, 'the balancing rules changed their mind about these files');
});
