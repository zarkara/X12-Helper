/*
 * Runs the parser and the dictionary over conformance/x12-835/ and reports
 * everything they could not explain, plus what the balancing rules found.
 *
 * Shared by tools/update-conformance-baseline.js (which writes the result) and
 * tests/conformance.test.js (which compares against it), so the two can never
 * disagree about how the numbers were produced.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CORPUS = path.join(ROOT, 'conformance', 'x12-835');
const BASELINE = path.join(ROOT, 'conformance', 'baseline.json');
/* Corpus files keep their upstream names, so the extension varies. Everything
 * that is not a remittance — the licence, the manifest, the .info sidecars —
 * is named here rather than guessed at. */
const NOT_REMITTANCES = ['LICENSE', 'manifest.json'];
function isRemittanceFile(name) {
  return !NOT_REMITTANCES.includes(name) && !name.endsWith('.info');
}

function corpusFiles() {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (isRemittanceFile(entry.name)) out.push(full);
    }
  })(CORPUS);
  return out;
}

function report(HCX) {
  const x12 = HCX.x12835;
  const dictionary = HCX.buildEffectiveDictionary('x12-835', []);
  const result = {
    files: 0,
    records: 0,
    parseFailures: [],
    unknownSegments: {},
    elementsPastDictionary: {},
    undefinedTables: {},
    codesNotInTable: {},
    envelopeWarnings: {},
    unbalanced: {},
  };

  const count = (bucket, key) => { bucket[key] = (bucket[key] || 0) + 1; };

  for (const file of corpusFiles()) {
    const name = path.relative(CORPUS, file).split(path.sep).join('/');
    result.files += 1;
    let parsed;
    try {
      parsed = x12.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      result.parseFailures.push(`${name}: ${error.message}`);
      continue;
    }
    if (!parsed.records.length) result.parseFailures.push(`${name}: no records found`);
    result.records += parsed.records.length;

    for (const warning of parsed.warnings || []) {
      count(result.envelopeWarnings, `${name}: ${(warning.text || String(warning)).slice(0, 60)}`);
    }

    for (const record of parsed.records) {
      for (const segment of record.segments) {
        const definition = dictionary.segments[segment.id];
        if (!definition) { count(result.unknownSegments, segment.id); continue; }
        for (const position of HCX.records.populatedPositions(segment)) {
          const fieldDefinition = definition.fields && definition.fields[position];
          const label = `${segment.id}${String(position).padStart(2, '0')}`;
          if (!fieldDefinition) { count(result.elementsPastDictionary, label); continue; }
          const dataType = dictionary.dataTypes[fieldDefinition.type];
          for (const repetition of segment.fields[position].repetitions) {
            repetition.components.forEach((component, index) => {
              const tableId = x12.tableForComponent(fieldDefinition, dataType, index);
              if (!tableId || !component.value) return;
              const lookup = x12.lookupCode(dictionary, tableId, component.value);
              if (lookup.status === x12.CODE_STATUS.UNLISTED_TABLE) { count(result.undefinedTables, tableId); return; }
              if (lookup.status !== x12.CODE_STATUS.UNKNOWN) return;
              count(result.codesNotInTable, `${tableId}:${component.value}@${label}`);
            });
          }
        }
      }
    }

    const payment = x12.paymentBalance(parsed.records, dictionary);
    if (payment && payment.balanced === false) count(result.unbalanced, `${name}: payment off by ${payment.difference}`);
    parsed.records.filter((record) => record.kind === 'claim').forEach((record, index) => {
      const balance = x12.claimBalance(record, dictionary);
      if (balance && balance.balanced === false) count(result.unbalanced, `${name}: claim ${index + 1} off by ${balance.difference}`);
    });
  }
  return result;
}

function totals(result) {
  const sum = (bucket) => Object.values(bucket).reduce((a, b) => a + b, 0);
  return {
    files: result.files,
    records: result.records,
    parseFailures: result.parseFailures.length,
    unknownSegments: sum(result.unknownSegments),
    elementsPastDictionary: sum(result.elementsPastDictionary),
    undefinedTables: sum(result.undefinedTables),
    codesNotInTable: sum(result.codesNotInTable),
    envelopeWarnings: sum(result.envelopeWarnings),
    unbalanced: sum(result.unbalanced),
  };
}

module.exports = { report, totals, corpusFiles, BASELINE, CORPUS };
