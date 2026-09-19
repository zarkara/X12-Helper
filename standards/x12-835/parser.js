/*
 * X12 835 parser: text in, structured records out. No dictionary knowledge.
 *
 * X12 is positional: an 835 is a flat stream of segments whose meaning comes
 * from the loop they sit in. This parser splits the stream into the records a
 * reader actually thinks in:
 *
 *   records[0]            the payment itself (BPR/TRN/REF/DTM, payer and payee,
 *                         and any provider-level adjustments in PLB)
 *   records[1..]          one per claim (CLP and everything under it)
 *
 * Output shape:
 *   {
 *     records: [{ kind: 'payment' | 'claim', index, segments: [Segment], warnings: [] }],
 *     envelope: [Segment],            // ISA/GS/ST/SE/GE/IEA
 *     delimiters, warnings
 *   }
 *   Segment = { id, line, raw, fields: [Field] }   // fields[n] is element n (1-based)
 *   Field   = { raw, repetitions: [{ raw, components: [{ raw, value }] }] }
 *
 * `fields` uses the same shape as the HL7 parser so both pages can share the
 * dictionary, profile and rendering model.
 */
(function (root) {
  'use strict';

  const HCX = root.HCX || (root.HCX = {});

  const DEFAULT_DELIMITERS = Object.freeze({ element: '*', component: ':', repetition: '^', segment: '~' });
  const ISA_SEGMENT_LENGTH = 106;          // 105 characters plus the terminator
  const ISA_COMPONENT_SEPARATOR_INDEX = 104;
  const ISA_TERMINATOR_INDEX = 105;
  const ISA_REPETITION_SEPARATOR_INDEX = 82;
  const ENVELOPE_SEGMENTS = ['ISA', 'GS', 'ST', 'SE', 'GE', 'IEA'];
  const SEGMENT_ID_PATTERN = /^[A-Z][A-Z0-9]{1,2}$/;
  const CLAIM_SEGMENT = 'CLP';
  const PROVIDER_ADJUSTMENT_SEGMENT = 'PLB';

  function parse(text) {
    const source = String(text || '');
    const delimiters = readDelimiters(source);
    const result = { records: [], envelope: [], warnings: [], delimiters };
    const payment = { kind: 'payment', index: 0, segments: [], warnings: [] };
    let current = payment;

    splitSegments(source, delimiters).forEach(({ raw, line }) => {
      const segment = parseSegment(raw, line, delimiters);
      if (!SEGMENT_ID_PATTERN.test(segment.id)) {
        result.warnings.push({ line, text: `Segment ${line} starts with "${segment.id}", which is not a valid segment ID. It was skipped.` });
        return;
      }
      if (ENVELOPE_SEGMENTS.includes(segment.id)) {
        result.envelope.push(segment);
        return;
      }
      if (segment.id === CLAIM_SEGMENT) {
        current = { kind: 'claim', index: result.records.length + 1, segments: [], warnings: [] };
        result.records.push(current);
      } else if (segment.id === PROVIDER_ADJUSTMENT_SEGMENT) {
        current = payment;   // provider-level adjustments belong to the payment, not the last claim
      }
      current.segments.push(segment);
    });

    if (!payment.segments.length && !result.records.length) return result;
    result.records.unshift(payment);
    result.records.forEach((record, index) => { record.index = index; });
    checkEnvelopeCounts(result);
    return result;
  }

  /**
   * ISA is fixed width, so the interchange declares its own delimiters:
   * element separator at position 4, repetition separator at 83, component
   * separator at 105 and segment terminator at 106.
   */
  function readDelimiters(source) {
    const start = source.indexOf('ISA');
    if (start === -1 || source.length < start + ISA_SEGMENT_LENGTH) return guessDelimiters(source);
    const isa = source.slice(start, start + ISA_SEGMENT_LENGTH);
    const delimiters = {
      element: isa[3],
      repetition: isa[ISA_REPETITION_SEPARATOR_INDEX],
      component: isa[ISA_COMPONENT_SEPARATOR_INDEX],
      segment: isa[ISA_TERMINATOR_INDEX],
    };
    return usable(delimiters) ? Object.freeze(delimiters) : guessDelimiters(source);
  }

  /** A file that has lost its ISA (an extract, a log) still has to be readable. */
  function guessDelimiters(source) {
    const element = ['*', '|', '\u001d'].find((candidate) => source.includes(candidate)) || DEFAULT_DELIMITERS.element;
    const segment = ['~', '\u001c'].find((candidate) => source.includes(candidate)) || '\n';
    return Object.freeze({ ...DEFAULT_DELIMITERS, element, segment });
  }

  function usable(delimiters) {
    return Object.values(delimiters).every((character) => character && !/[A-Za-z0-9 ]/.test(character));
  }

  function splitSegments(source, delimiters) {
    return source
      .split(delimiters.segment)
      .map((raw, index) => ({ raw: raw.replace(/[\r\n]+/g, '').trim(), line: index + 1 }))
      .filter(({ raw }) => raw !== '');
  }

  function parseSegment(raw, line, delimiters) {
    const parts = raw.split(delimiters.element);
    const fields = [undefined];
    // ISA is fixed width and its own separators appear inside it, so its
    // elements are taken as-is rather than re-split.
    parts.slice(1).forEach((part) => fields.push(parseField(part, delimiters, parts[0] === 'ISA')));
    return { id: parts[0], line, raw, fields };
  }

  function parseField(raw, delimiters, literal) {
    if (literal) return { raw, repetitions: [{ raw, components: [{ raw, value: raw }] }] };
    return {
      raw,
      repetitions: raw.split(delimiters.repetition).map((repetitionRaw) => ({
        raw: repetitionRaw,
        components: repetitionRaw.split(delimiters.component).map((componentRaw) => ({ raw: componentRaw, value: componentRaw })),
      })),
    };
  }

  function checkEnvelopeCounts(result) {
    const claims = result.records.filter((record) => record.kind === 'claim').length;
    const trailer = result.envelope.find((segment) => segment.id === 'SE');
    const declared = Number(firstValue(trailer, 1));
    if (trailer && declared) {
      const counted = result.envelope.filter((segment) => segment.id === 'ST' || segment.id === 'SE').length
        + result.records.reduce((total, record) => total + record.segments.length, 0);
      if (counted !== declared) {
        result.warnings.push({
          line: trailer.line,
          text: `SE01 says the transaction holds ${declared} segments but ${counted} were found. The file may be truncated or joined with another.`,
        });
      }
    }
    if (!claims) result.warnings.push({ line: 0, text: 'No CLP (claim) segments were found, so there is nothing to step through beyond the payment summary.' });
  }

  /** First component value of the first repetition of an element; '' when absent. */
  function firstValue(segment, position, componentIndex) {
    const field = segment && segment.fields[position];
    if (!field) return '';
    const component = field.repetitions[0].components[(componentIndex || 1) - 1];
    return component ? component.value : '';
  }

  /** Every segment with this ID inside a record. */
  function segmentsOfType(record, id) {
    return record.segments.filter((segment) => segment.id === id);
  }

  HCX.x12835 = Object.assign(HCX.x12835 || {}, { parse, firstValue, segmentsOfType });
})(globalThis);
