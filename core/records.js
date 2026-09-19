/*
 * Record-level helpers shared by every standard: the "At a glance" summary and
 * the profile stub that lists whatever the dictionary could not explain.
 *
 * Both walk a record's segments and the dictionary the same way, so each
 * standard only supplies two small callbacks:
 *   summarize(repetition, fieldDefinition) -> string
 *   resolve(segment, fieldDefinition) -> fieldDefinition   (optional)
 */
(function (root) {
  'use strict';

  const HCX = root.HCX || (root.HCX = {});
  const { CODE_STATUS, lookupCode, tableForComponent, summarizeList } = HCX.codes;
  const EXPLICIT_NULL = '""';

  function isEmptyField(field) {
    return !field || field.raw === '';
  }

  function isExplicitNull(field) {
    return Boolean(field) && field.raw === EXPLICIT_NULL;
  }

  /**
   * Values for the "At a glance" panel, driven by `glance` on field
   * definitions. Returns [{ label, text }] in the order fields first appear.
   */
  function collectGlance(record, dictionary, { summarize, resolve }) {
    const entries = new Map();
    record.segments.forEach((segment) => {
      const definition = dictionary.segments[segment.id];
      if (!definition || segment.invalid) return;
      Object.entries(definition.fields || {}).forEach(([position, fieldDefinition]) => {
        const field = segment.fields[position];
        if (!fieldDefinition.glance || isEmptyField(field) || isExplicitNull(field)) return;
        const { label, aggregate = 'first' } = fieldDefinition.glance;
        const entry = entries.get(label) || { label, aggregate, values: [] };
        const resolved = resolve ? resolve(segment, fieldDefinition) : fieldDefinition;
        entry.values.push(summarize(field.repetitions[0], resolved));
        entries.set(label, entry);
      });
    });
    return [...entries.values()].map(({ label, aggregate, values }) => ({ label, text: aggregateValues(aggregate, values) }));
  }

  function aggregateValues(aggregate, values) {
    if (aggregate === 'sum') {
      const total = values.reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
      const currency = (values.join(' ').match(/[A-Z]{3}/) || [''])[0];
      return `${total.toFixed(2)} ${currency} (${values.length} line${values.length === 1 ? '' : 's'})`.replace('  ', ' ');
    }
    if (aggregate === 'list') return summarizeList([...new Set(values)]);
    return values[0];
  }

  /**
   * Adds everything the dictionary could not explain to `stub`: unknown
   * segments, unknown field positions, and unlisted codes. Only code values
   * from code tables are copied — never field contents — so a stub built from
   * real traffic contains no patient data.
   */
  function collectUnknowns(record, dictionary, stub, { resolve } = {}) {
    record.segments.forEach((segment) => {
      if (segment.invalid) return;
      const definition = dictionary.segments[segment.id];
      populatedPositions(segment).forEach((position) => {
        const fieldDefinition = definition && definition.fields && definition.fields[position];
        if (!fieldDefinition) {
          ensureStubField(stub, segment.id, position, !definition);
          return;
        }
        const resolved = resolve ? resolve(segment, fieldDefinition) : fieldDefinition;
        collectUnknownCodes(segment.fields[position], resolved, dictionary, stub);
      });
    });
    return stub;
  }

  function populatedPositions(segment) {
    return segment.fields
      .map((field, position) => (isEmptyField(field) ? null : position))
      .filter((position) => position !== null && position > 0);
  }

  function ensureStubField(stub, segmentId, position, isNewSegment) {
    const segments = stub.segments || (stub.segments = {});
    const segment = segments[segmentId] || (segments[segmentId] = isNewSegment ? { name: 'TODO', purpose: 'TODO', fields: {} } : { fields: {} });
    segment.fields[position] = segment.fields[position] || { name: 'TODO', type: 'ST', meaning: 'TODO' };
  }

  function collectUnknownCodes(field, fieldDefinition, dictionary, stub) {
    const dataType = dictionary.dataTypes[fieldDefinition.type];
    field.repetitions.forEach((repetition) => {
      repetition.components.forEach((component, index) => {
        const tableId = tableForComponent(fieldDefinition, dataType, index);
        if (!tableId || !component.value || component.raw === EXPLICIT_NULL) return;
        const lookup = lookupCode(dictionary, tableId, component.value);
        if (lookup.status === CODE_STATUS.KNOWN || lookup.status === CODE_STATUS.EXTERNAL) return;
        const tables = stub.tables || (stub.tables = {});
        const table = tables[tableId] || (tables[tableId] = { values: {} });
        table.values[component.value] = 'TODO';
      });
    });
  }

  HCX.records = { isEmptyField, isExplicitNull, collectGlance, collectUnknowns, populatedPositions };
})(globalThis);
