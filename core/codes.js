/*
 * Dictionary look-ups shared by every standard: what a code means, what a
 * composite's parts are called, and how to render a one-line summary.
 * Pure functions, no DOM.
 */
(function (root) {
  'use strict';

  const HCX = root.HCX || (root.HCX = {});

  const CODE_STATUS = Object.freeze({
    KNOWN: 'known',             // value found in the table
    EXTERNAL: 'external',       // external code system (ICD-10, CPT, CARC…), not bundled
    SITE_DEFINED: 'site',       // site-defined table, value not listed yet
    UNKNOWN: 'unknown',         // standard table, value not a listed code
    UNLISTED_TABLE: 'unlisted', // table itself not in the dictionary
  });

  function lookupCode(dictionary, tableId, code) {
    const table = dictionary.tables[tableId];
    if (!table) return { status: CODE_STATUS.UNLISTED_TABLE, tableId };
    const base = { tableId, tableName: table.name, note: table.note };
    if (table.external) return { ...base, status: CODE_STATUS.EXTERNAL };
    const entry = (table.values || {})[code] || matchPattern(table, code);
    if (entry) return { ...base, status: CODE_STATUS.KNOWN, meaning: entry.meaning, source: entry.source };
    return { ...base, status: table.siteDefined ? CODE_STATUS.SITE_DEFINED : CODE_STATUS.UNKNOWN };
  }

  /** Tables may describe code families, e.g. { match: '^HL7(\\d{4})$', meaning: 'HL7 table $1' }. */
  function matchPattern(table, code) {
    const pattern = (table.patterns || []).find(({ match }) => new RegExp(match).test(code));
    return pattern ? { meaning: code.replace(new RegExp(pattern.match), pattern.meaning), source: pattern.source } : null;
  }

  function componentDefinition(dataType, index) {
    const entry = dataType && dataType.components && dataType.components[index];
    if (!entry) return { name: `Component ${index + 1}` };
    return typeof entry === 'string' ? { name: entry } : entry;
  }

  /** Table that governs a component: the field-level table applies to component 1. */
  function tableForComponent(fieldDefinition, dataType, index) {
    if (index === 0 && fieldDefinition && fieldDefinition.table) return fieldDefinition.table;
    return componentDefinition(dataType, index).table;
  }

  /**
   * Fills a data type's display template ('{2} {3} {1}') from a repetition.
   * `format` may rewrite a component's value, e.g. to format a date.
   */
  function fillTemplate(template, repetition, dataType, format) {
    return template
      .replace(/\{(\d+)\}/g, (match, position) => {
        const index = Number(position) - 1;
        const component = repetition.components[index];
        if (!component) return '';
        return format ? format(component.value, componentDefinition(dataType, index), index) : component.value;
      })
      .replace(/\(\s*\)/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s,–^-]+|[\s,–^-]+$/g, '')
      .trim();
  }

  /** Long lists are cut short so summaries stay readable. */
  function summarizeList(values, limit) {
    const cutoff = limit || 4;
    const shown = values.slice(0, cutoff).join('; ');
    const remaining = values.length - cutoff;
    return remaining > 0 ? `${shown} (+${remaining} more)` : shown;
  }

  HCX.codes = { CODE_STATUS, lookupCode, componentDefinition, tableForComponent, fillTemplate, summarizeList };
})(globalThis);
