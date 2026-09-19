/*
 * X12 835 page adapter: turns one record (the payment, or one claim) into a
 * readable document. The shared shell (core/shell.js) handles input,
 * navigation and profiles.
 */
(function (root) {
  'use strict';

  const HCX = root.HCX;
  const { el } = HCX.dom;
  const x12 = HCX.x12835;
  const { CODE_STATUS } = x12;

  function renderRecord(record, dictionary, options) {
    const occurrences = {};
    return el('article', { className: 'record' }, [
      record.kind === 'payment' ? renderPaymentHeader(record, dictionary) : renderClaimHeader(record, dictionary),
      renderGlance(record, dictionary),
      record.kind === 'payment' ? null : renderClaimBalance(record, dictionary),
      record.kind === 'payment' ? null : renderServiceLines(record),
      renderWarnings(record.warnings),
      ...record.segments.map((segment) => {
        occurrences[segment.id] = (occurrences[segment.id] || 0) + 1;
        return renderSegment(segment, occurrences[segment.id], dictionary, options);
      }),
    ]);
  }

  function renderPaymentHeader(record, dictionary) {
    const type = dictionary.messageTypes.payment || {};
    const trace = x12.segmentsOfType(record, 'TRN')[0];
    const bpr = x12.segmentsOfType(record, 'BPR')[0];
    return el('header', { className: 'record-header' }, [
      el('p', { className: 'eyebrow', text: 'Record 1' }),
      el('h2', {}, [el('span', { className: 'code', text: 'BPR' }), ' Payment summary']),
      type.summary ? el('p', { className: 'summary', text: type.summary }) : null,
      type.rcm ? renderRcmNote(type.rcm) : null,
      el('dl', { className: 'meta' }, [
        metaItem('Check / EFT number', x12.firstValue(trace, 2)),
        metaItem('Amount', bpr ? x12.formatAmount(x12.firstValue(bpr, 2)) : ''),
        metaItem('Method', describeCode(dictionary, '591', x12.firstValue(bpr, 4))),
        metaItem('Effective date', x12.formatDate(x12.firstValue(bpr, 16))),
        metaItem('Payer', partyName(record, 'PR')),
        metaItem('Payee', partyName(record, 'PE')),
      ]),
    ]);
  }

  function partyName(record, role) {
    const party = x12.segmentsOfType(record, 'N1').find((segment) => x12.firstValue(segment, 1) === role);
    return party ? x12.firstValue(party, 2) : '';
  }

  function renderClaimHeader(record, dictionary) {
    const description = x12.describeRecord(record);
    const status = x12.lookupCode(dictionary, '1029', description.status);
    const type = dictionary.messageTypes.claim || {};
    return el('header', { className: 'record-header' }, [
      el('p', { className: 'eyebrow', text: 'Claim' }),
      el('h2', {}, [
        el('span', { className: 'code', text: description.patientControlNumber || 'no claim number' }),
        description.patientName ? ` ${description.patientName}` : '',
      ]),
      el('p', { className: 'summary', text: status.status === CODE_STATUS.KNOWN ? status.meaning : `Claim status ${description.status}` }),
      type.rcm ? renderRcmNote(type.rcm) : null,
      el('dl', { className: 'meta' }, [
        metaItem('Payer claim number', description.payerClaimNumber),
        metaItem('Charged', x12.formatAmount(description.charged)),
        metaItem('Paid', x12.formatAmount(description.paid)),
        metaItem('Service dates', serviceDates(record)),
      ]),
    ]);
  }

  function serviceDates(record) {
    const dates = x12.segmentsOfType(record, 'DTM')
      .filter((segment) => ['232', '233', '472'].includes(x12.firstValue(segment, 1)))
      .map((segment) => x12.formatDate(x12.firstValue(segment, 2)) || x12.firstValue(segment, 2));
    return [...new Set(dates)].join(' – ');
  }

  function renderGlance(record, dictionary) {
    const entries = x12.collectGlance(record, dictionary);
    if (!entries.length) return null;
    return el('section', { className: 'glance', attrs: { 'aria-label': 'At a glance' } }, [
      el('h3', { text: 'At a glance' }),
      el('dl', {}, entries.map(({ label, text }) => el('div', {}, [el('dt', { text: label }), el('dd', { text })]))),
    ]);
  }

  /** Charged = paid + adjustments, with the adjustment groups spelled out. */
  function renderClaimBalance(record, dictionary) {
    const balance = x12.claimBalance(record);
    if (!balance) return null;
    const groups = x12.adjustmentsByGroup(record).map(({ group, amount }) => {
      const lookup = x12.lookupCode(dictionary, '1034', group);
      return el('div', {}, [
        el('dt', {}, [el('span', { className: 'code', text: group }), lookup.status === CODE_STATUS.KNOWN ? ` ${lookup.meaning}` : '']),
        el('dd', { text: x12.formatAmount(amount) }),
      ]);
    });

    return el('section', { className: `balance ${balance.balanced ? 'ok' : 'warn'}`, attrs: { 'aria-label': 'Claim balance' } }, [
      el('h3', { text: balance.balanced ? 'This claim balances' : 'This claim does not balance' }),
      el('p', { className: 'muted small', text: 'Charged = paid + every adjustment. A difference means a segment is missing or an amount is wrong.' }),
      el('dl', {}, [
        el('div', {}, [el('dt', { text: 'Charged' }), el('dd', { text: x12.formatAmount(balance.charged) })]),
        el('div', {}, [el('dt', { text: 'Paid' }), el('dd', { text: x12.formatAmount(balance.paid) })]),
        el('div', {}, [el('dt', { text: 'Adjustments' }), el('dd', { text: x12.formatAmount(balance.adjustments) })]),
        el('div', {}, [el('dt', { text: 'Patient responsibility' }), el('dd', { text: x12.formatAmount(balance.patientResponsibility) })]),
        el('div', {}, [el('dt', { text: 'Difference' }), el('dd', { text: x12.formatAmount(balance.difference) })]),
        ...groups,
      ]),
    ]);
  }

  function renderServiceLines(record) {
    const lines = x12.serviceLineBalances(record);
    if (!lines.length) return null;
    return el('section', { className: 'panel service-lines' }, [
      el('h3', { text: `Service lines (${lines.length})` }),
      el('table', { className: 'fields' }, [
        el('thead', {}, [el('tr', {}, ['Service', 'Charged', 'Paid', 'Adjustments', 'Balances'].map((heading) => el('th', { text: heading, attrs: { scope: 'col' } })))]),
        el('tbody', {}, lines.map((line) => el('tr', { className: line.balanced ? '' : 'unknown' }, [
          el('th', { attrs: { scope: 'row' } }, [el('span', { className: 'code', text: line.service || '—' })]),
          el('td', { text: x12.formatAmount(line.charged), attrs: { 'data-label': 'Charged' } }),
          el('td', { text: x12.formatAmount(line.paid), attrs: { 'data-label': 'Paid' } }),
          el('td', { text: x12.formatAmount(line.adjustments), attrs: { 'data-label': 'Adjustments' } }),
          el('td', { text: line.balanced ? 'yes' : `off by ${x12.formatAmount(line.difference)}`, attrs: { 'data-label': 'Balances' } }),
        ]))),
      ]),
    ]);
  }

  function renderWarnings(warnings) {
    if (!warnings || !warnings.length) return null;
    return el('ul', { className: 'warnings' }, warnings.map((warning) => el('li', { text: warning.text })));
  }

  function renderSegment(segment, occurrence, dictionary, options) {
    const definition = dictionary.segments[segment.id];
    return el('section', { className: `segment${definition ? '' : ' unknown'}` }, [
      el('h3', {}, [
        el('span', { className: 'code', text: segment.id }),
        occurrence > 1 ? el('span', { className: 'badge', text: `#${occurrence}` }) : null,
        ` ${definition && definition.name ? definition.name : 'Segment not in dictionary'}`,
        definition && definition.source ? sourceBadge(definition.source) : null,
      ]),
      definition ? null : el('p', { className: 'flag-note', text: 'This segment is not in the dictionary yet. Add it to the dictionary or a vendor profile.' }),
      definition && definition.purpose ? el('p', { className: 'purpose', text: definition.purpose }) : null,
      definition && definition.rcm ? renderRcmNote(definition.rcm) : null,
      el('details', { className: 'raw-toggle' }, [
        el('summary', { text: `Raw segment (${segment.line})` }),
        el('pre', { className: 'raw', text: segment.raw }),
      ]),
      renderElementTable(segment, definition, dictionary, options),
    ]);
  }

  function renderElementTable(segment, definition, dictionary, options) {
    const fieldDefinitions = (definition && definition.fields) || {};
    const positions = new Set();
    segment.fields.forEach((field, position) => {
      if (position > 0 && !x12.isEmptyField(field)) positions.add(position);
    });
    if (options.showEmpty) Object.keys(fieldDefinitions).forEach((position) => positions.add(Number(position)));

    const rows = [...positions].sort((a, b) => a - b).map((position) =>
      renderElementRow(segment, position, fieldDefinitions[position], dictionary, definition && definition.source));
    if (!rows.length) return el('p', { className: 'muted', text: 'No populated elements.' });

    return el('table', { className: 'fields' }, [
      el('thead', {}, [el('tr', {}, ['Element', 'Name', 'Value', 'What it means'].map((heading) => el('th', { text: heading, attrs: { scope: 'col' } })))]),
      el('tbody', {}, rows),
    ]);
  }

  function renderElementRow(segment, position, fieldDefinition, dictionary, segmentSource) {
    const field = segment.fields[position];
    const isEmpty = x12.isEmptyField(field);
    return el('tr', { className: [!fieldDefinition && !isEmpty ? 'unknown' : '', isEmpty ? 'empty' : ''].filter(Boolean).join(' ') }, [
      el('th', { attrs: { scope: 'row' } }, [
        el('span', { className: 'code', text: elementId(segment.id, position) }),
        fieldDefinition && fieldDefinition.type ? el('span', { className: 'type', text: fieldDefinition.type, attrs: { title: typeTitle(dictionary, fieldDefinition.type) } }) : null,
      ]),
      el('td', { className: 'name', attrs: { 'data-label': 'Name' } }, [
        fieldDefinition ? fieldDefinition.name : el('span', { className: 'flag', text: 'Not in dictionary' }),
        fieldDefinition && fieldDefinition.source && fieldDefinition.source !== segmentSource ? sourceBadge(fieldDefinition.source) : null,
      ]),
      el('td', { className: 'value', attrs: { 'data-label': 'Value' } }, [renderValue(field, fieldDefinition, dictionary)]),
      el('td', { className: 'meaning', attrs: { 'data-label': 'Meaning' } }, [
        fieldDefinition && fieldDefinition.meaning ? el('p', { text: fieldDefinition.meaning }) : null,
        fieldDefinition && fieldDefinition.rcm ? renderRcmNote(fieldDefinition.rcm) : null,
      ]),
    ]);
  }

  /** X12 writes element positions two digits wide: BPR02, CLP07, SVC01. */
  function elementId(segmentId, position) {
    return `${segmentId}${String(position).padStart(2, '0')}`;
  }

  function renderValue(field, fieldDefinition, dictionary) {
    if (x12.isEmptyField(field)) return el('span', { className: 'muted', text: '(empty)' });
    if (field.repetitions.length === 1) return renderRepetition(field.repetitions[0], fieldDefinition, dictionary);
    return el('ol', { className: 'repetitions' }, field.repetitions.map((repetition) =>
      el('li', {}, [renderRepetition(repetition, fieldDefinition, dictionary)])));
  }

  function renderRepetition(repetition, fieldDefinition, dictionary) {
    const dataType = dictionary.dataTypes[fieldDefinition && fieldDefinition.type];
    const components = repetition.components;
    if (components.length === 1 || !dataType) {
      return renderScalar(components.map((component) => component.value).filter(Boolean).join(' '), fieldDefinition, dictionary);
    }
    return el('dl', { className: 'components' }, components
      .map((component, index) => ({ component, index }))
      .filter(({ component }) => component.value !== '')
      .map(({ component, index }) => {
        const componentDef = x12.componentDefinition(dataType, index);
        return el('div', {}, [
          el('dt', { text: componentDef.name }),
          el('dd', {}, [renderCoded(component.value, x12.tableForComponent(fieldDefinition, dataType, index), dictionary)]),
        ]);
      }));
  }

  function renderScalar(value, fieldDefinition, dictionary) {
    if (value === '') return el('span', { className: 'muted', text: '(empty)' });
    if (x12.isDateField(fieldDefinition)) {
      const formatted = x12.formatDate(value);
      if (formatted) return el('span', { className: 'val', text: formatted, attrs: { title: `Raw: ${value}` } });
    }
    if (x12.isMoneyField(fieldDefinition)) {
      return el('span', { className: 'val amount', text: x12.formatAmount(value) });
    }
    return renderCoded(value, fieldDefinition && fieldDefinition.table, dictionary);
  }

  function renderCoded(value, tableId, dictionary) {
    if (!tableId) return el('span', { className: 'val', text: value });
    const lookup = x12.lookupCode(dictionary, tableId, value);
    const code = el('span', { className: 'val code-val', text: value });
    switch (lookup.status) {
      case CODE_STATUS.KNOWN:
        return el('span', {}, [code, el('span', { className: 'code-meaning', text: ` ${lookup.meaning}` }), lookup.source ? sourceBadge(lookup.source) : null]);
      case CODE_STATUS.EXTERNAL:
        return el('span', {}, [code, el('span', { className: 'badge muted-badge', text: 'external code list', attrs: { title: lookup.note || '' } })]);
      case CODE_STATUS.SITE_DEFINED:
        return el('span', {}, [code, el('span', { className: 'badge site-badge', text: 'payer-specific', attrs: { title: `${lookup.tableName} (element ${lookup.tableId}) allows payer-specific values and this one is not listed. Add it to a vendor profile.` } })]);
      case CODE_STATUS.UNKNOWN:
        return el('span', {}, [code, el('span', { className: 'flag', text: ` not a listed value for element ${lookup.tableId} (${lookup.tableName})` })]);
      default:
        return el('span', {}, [code, el('span', { className: 'muted', text: ` element ${lookup.tableId}` })]);
    }
  }

  function renderEnvelope(envelope, dictionary) {
    if (!envelope.length) return null;
    return el('p', { className: 'envelope' }, envelope.map((segment) => {
      const definition = dictionary.segments[segment.id];
      const detail = { ISA: x12.firstValue(segment, 13), GS: x12.firstValue(segment, 8), ST: x12.firstValue(segment, 2), SE: `${x12.firstValue(segment, 1)} segments` }[segment.id] || '';
      return el('span', { className: 'badge', text: `${segment.id} ${definition ? definition.name : ''}${detail ? ': ' + detail : ''}` });
    }));
  }

  function renderRcmNote(text) {
    return el('p', { className: 'rcm' }, [el('strong', { text: 'Revenue cycle: ' }), text]);
  }

  function sourceBadge(source) {
    return el('span', { className: 'badge profile-badge', text: source, attrs: { title: `Defined by profile: ${source}` } });
  }

  function metaItem(label, value) {
    if (!value) return null;
    return el('div', {}, [el('dt', { text: label }), el('dd', { text: value })]);
  }

  function describeCode(dictionary, tableId, code) {
    if (!code) return '';
    const lookup = x12.lookupCode(dictionary, tableId, code);
    return lookup.status === CODE_STATUS.KNOWN ? `${code} (${lookup.meaning})` : code;
  }

  function typeTitle(dictionary, type) {
    const dataType = dictionary.dataTypes[type];
    if (dataType) return `${type}: ${dataType.name}`;
    return { AN: 'AN: text', DT: 'DT: date', TM: 'TM: time', ID: 'ID: code from a list', N0: 'N0: whole number', R: 'R: decimal number', AMT: 'AMT: money amount' }[type] || `Data type ${type}`;
  }

  /** Warnings that belong to the whole file, shown once above the records. */
  function fileWarnings(records) {
    const balance = x12.paymentBalance(records);
    if (!balance || balance.balanced) return [];
    return [{
      line: 0,
      text: `The payment does not balance: BPR02 is ${x12.formatAmount(balance.paid)} but the claims paid (${x12.formatAmount(balance.claimsPaid)}) minus provider adjustments (${x12.formatAmount(balance.providerAdjustments)}) come to ${x12.formatAmount(balance.claimsPaid - balance.providerAdjustments)}, a difference of ${x12.formatAmount(balance.difference)}.`,
    }];
  }

  HCX.adapters = HCX.adapters || {};
  HCX.adapters['x12-835'] = {
    standardId: 'x12-835',
    recordNoun: 'record',
    parse(text) {
      const parsed = x12.parse(text);
      return {
        records: parsed.records,
        warnings: parsed.warnings.concat(fileWarnings(parsed.records)),
        envelope: parsed.envelope,
      };
    },
    recordLabel: x12.recordLabel,
    renderRecord,
    renderEnvelope,
    collectUnknowns: x12.collectUnknowns,
  };
})(globalThis);
