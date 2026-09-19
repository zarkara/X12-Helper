const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load');

const HCX = loadCore();
const { parse, firstValue, segmentsOfType } = HCX.x12835;
const SAMPLE = HCX.samples['x12-835'][0].text;

test('reads the delimiters the interchange declares in ISA', () => {
  const result = parse(SAMPLE);

  assert.deepEqual({ ...result.delimiters }, { element: '*', repetition: '^', component: ':', segment: '~' });
});

test('honours non-default delimiters', () => {
  const isa = ['ISA', '00', ' '.repeat(10), '00', ' '.repeat(10), 'ZZ', 'SENDER'.padEnd(15), 'ZZ', 'RECEIVER'.padEnd(15), '260921', '1015', 'U', '00501', '000000101', '0', 'P', '>'].join('|') + '\u001c';
  const result = parse(`${isa}CLP|A1|1|100|80|20|12|ICN1\u001c`);

  assert.equal(result.delimiters.element, '|');
  assert.equal(result.delimiters.segment, '\u001c');
  assert.equal(firstValue(result.records[1].segments[0], 4), '80');
});

test('splits the file into a payment record and one record per claim', () => {
  const result = parse(SAMPLE);

  assert.deepEqual(result.records.map((record) => record.kind), ['payment', 'claim', 'claim']);
  assert.deepEqual(result.envelope.map((segment) => segment.id), ['ISA', 'GS', 'ST', 'SE', 'GE', 'IEA']);
  assert.deepEqual(result.warnings, []);
});

test('keeps provider-level adjustments with the payment, not the last claim', () => {
  const result = parse(SAMPLE);

  assert.equal(segmentsOfType(result.records[0], 'PLB').length, 1);
  assert.equal(segmentsOfType(result.records[2], 'PLB').length, 0);
});

test('splits composite elements on the component separator', () => {
  const [, claim] = parse(SAMPLE).records;
  const service = segmentsOfType(claim, 'SVC')[0];

  assert.equal(firstValue(service, 1, 1), 'HC');
  assert.equal(firstValue(service, 1, 2), '99214');
});

test('leaves ISA elements unsplit, since its own separators appear inside it', () => {
  const isa = parse(SAMPLE).envelope[0];

  assert.equal(firstValue(isa, 16), ':');
  assert.equal(isa.fields[16].repetitions[0].components.length, 1);
});

test('flags a segment count that disagrees with SE01', () => {
  const result = parse(SAMPLE.replace('SE*48*0001~', 'SE*60*0001~'));

  assert.match(result.warnings[0].text, /SE01 says the transaction holds 60 segments but 48 were found/);
});

test('reads a file that has lost its ISA envelope', () => {
  const result = parse('CLP*A1*1*100*80*20*12*ICN1~CAS*CO*45*20~');

  assert.equal(result.records.length, 2);
  assert.equal(firstValue(segmentsOfType(result.records[1], 'CLP')[0], 1), 'A1');
});

test('warns when there are no claims to step through', () => {
  const result = parse('ISA*00*          *00*          *ZZ*A              *ZZ*B              *260921*1015*^*00501*000000101*0*P*:~BPR*I*0*C*NON~');

  assert.match(result.warnings[0].text, /No CLP \(claim\) segments/);
});

test('returns nothing for text that is not X12', () => {
  assert.deepEqual(parse('hello world').records, []);
  assert.deepEqual(parse('').records, []);
});
