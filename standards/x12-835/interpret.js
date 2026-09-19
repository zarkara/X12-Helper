/*
 * X12 835 interpretation: combines parsed records with the effective dictionary.
 * Pure functions only (no DOM), so everything here is unit-testable in Node.
 *
 * The balancing rules are what make an 835 readable:
 *   claim:        CLP03 (charged) = CLP04 (paid) + every CAS amount on the claim
 *   service line: SVC02 (charged) = SVC03 (paid) + every CAS amount on the line
 *   payment:      BPR02 (paid) = sum of CLP04 + provider adjustments in PLB
 * A file that does not balance is the first thing a posting team needs to see.
 */
(function (root) {
  'use strict';

  const HCX = root.HCX || (root.HCX = {});
  const { CODE_STATUS, lookupCode, componentDefinition, tableForComponent, fillTemplate } = HCX.codes;
  const { isEmptyField, collectGlance: collectGlanceFor, collectUnknowns: collectUnknownsFor } = HCX.records;
  const x12 = HCX.x12835;

  const DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?$/;
  const MONEY_TYPES = ['AMT', 'R'];      // X12 data types that hold money
  const ROUNDING_TOLERANCE = 0.005;      // amounts are cents; anything larger is a real imbalance

  /** 'CCYYMMDD' (or with HHMM) -> '2026-09-18'. Returns null when it is not a date. */
  function formatDate(value) {
    const match = DATE_PATTERN.exec(value || '');
    if (!match) return null;
    const [, year, month, day, hour, minute] = match;
    const time = [hour, minute].filter(Boolean).join(':');
    return [`${year}-${month}-${day}`, time].filter(Boolean).join(' ');
  }

  function isDateField(fieldDefinition) {
    return Boolean(fieldDefinition) && fieldDefinition.type === 'DT';
  }

  function isMoneyField(fieldDefinition) {
    return Boolean(fieldDefinition) && MONEY_TYPES.includes(fieldDefinition.type);
  }

  function amountOf(segment, position) {
    const value = parseFloat(x12.firstValue(segment, position));
    return Number.isFinite(value) ? value : 0;
  }

  function formatAmount(value) {
    const amount = parseFloat(value);
    return Number.isFinite(amount) ? amount.toFixed(2) : value;
  }

  /** One-line, human-friendly text for a repetition. */
  function summarizeRepetition(repetition, fieldDefinition, dictionary) {
    const first = repetition.components[0] ? repetition.components[0].value : '';
    if (isDateField(fieldDefinition)) return formatDate(first) || first;
    if (isMoneyField(fieldDefinition)) return formatAmount(first);

    const dataType = dictionary.dataTypes[fieldDefinition && fieldDefinition.type];
    if (dataType && dataType.display) return fillTemplate(dataType.display, repetition, dataType);

    const text = repetition.components.map((component) => component.value).filter(Boolean).join(' ');
    const tableId = tableForComponent(fieldDefinition, dataType, 0);
    if (!tableId || !first) return text;
    const lookup = lookupCode(dictionary, tableId, first);
    return lookup.status === CODE_STATUS.KNOWN ? `${text} — ${lookup.meaning}` : text;
  }

  /** CAS segments repeat group/reason/amount in threes: CAS02-04, CAS05-07, and so on. */
  function adjustmentsIn(segment) {
    const group = x12.firstValue(segment, 1);
    const adjustments = [];
    for (let position = 2; position + 1 < segment.fields.length; position += 3) {
      const reason = x12.firstValue(segment, position);
      if (!reason) continue;
      adjustments.push({
        group,
        reason,
        amount: amountOf(segment, position + 1),
        quantity: x12.firstValue(segment, position + 2),
      });
    }
    return adjustments;
  }

  function claimAdjustments(record) {
    return x12.segmentsOfType(record, 'CAS').flatMap(adjustmentsIn);
  }

  function totalOf(adjustments) {
    return adjustments.reduce((total, adjustment) => total + adjustment.amount, 0);
  }

  /** Adjustment totals per group code (CO, PR, OA…), largest first. */
  function adjustmentsByGroup(record) {
    const totals = new Map();
    claimAdjustments(record).forEach(({ group, amount }) => totals.set(group, (totals.get(group) || 0) + amount));
    return [...totals.entries()]
      .map(([group, amount]) => ({ group, amount }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }

  /** Does CLP03 = CLP04 + every adjustment on the claim? */
  function claimBalance(record) {
    const claim = x12.segmentsOfType(record, 'CLP')[0];
    if (!claim) return null;
    const charged = amountOf(claim, 3);
    const paid = amountOf(claim, 4);
    const adjustments = totalOf(claimAdjustments(record));
    const difference = round(charged - paid - adjustments);
    return { charged, paid, patientResponsibility: amountOf(claim, 5), adjustments, difference, balanced: Math.abs(difference) < ROUNDING_TOLERANCE };
  }

  /** Does SVC02 = SVC03 + the adjustments that follow the line? */
  function serviceLineBalances(record) {
    const lines = [];
    let current = null;
    record.segments.forEach((segment) => {
      if (segment.id === 'SVC') {
        current = { service: x12.firstValue(segment, 1, 2), charged: amountOf(segment, 2), paid: amountOf(segment, 3), adjustments: 0 };
        lines.push(current);
      } else if (segment.id === 'CAS' && current) {
        current.adjustments += totalOf(adjustmentsIn(segment));
      } else if (segment.id === 'CLP') {
        current = null;
      }
    });
    return lines.map((line) => {
      const difference = round(line.charged - line.paid - line.adjustments);
      return { ...line, difference, balanced: Math.abs(difference) < ROUNDING_TOLERANCE };
    });
  }

  /** Does BPR02 equal the claims paid plus the provider-level adjustments? */
  function paymentBalance(records) {
    const payment = records.find((record) => record.kind === 'payment');
    const bpr = payment && x12.segmentsOfType(payment, 'BPR')[0];
    if (!bpr) return null;
    const paid = amountOf(bpr, 2);
    const claimsPaid = records
      .filter((record) => record.kind === 'claim')
      .reduce((total, record) => total + amountOf(x12.segmentsOfType(record, 'CLP')[0], 4), 0);
    const providerAdjustments = providerAdjustmentsIn(payment).reduce((total, entry) => total + entry.amount, 0);
    // PLB amounts are positive when money is taken back, so they reduce the payment.
    const difference = round(paid - (claimsPaid - providerAdjustments));
    return { paid, claimsPaid, providerAdjustments, difference, balanced: Math.abs(difference) < ROUNDING_TOLERANCE };
  }

  /** PLB repeats reason/amount in pairs from element 3 onward. */
  function providerAdjustmentsIn(record) {
    if (!record) return [];
    return x12.segmentsOfType(record, 'PLB').flatMap((segment) => {
      const entries = [];
      for (let position = 3; position < segment.fields.length; position += 2) {
        const reason = x12.firstValue(segment, position, 1);
        if (!reason) continue;
        entries.push({ reason, reference: x12.firstValue(segment, position, 2), amount: amountOf(segment, position + 1) });
      }
      return entries;
    });
  }

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  function helpersFor(dictionary) {
    return { summarize: (repetition, fieldDefinition) => summarizeRepetition(repetition, fieldDefinition, dictionary) };
  }

  function collectGlance(record, dictionary) {
    return collectGlanceFor(record, dictionary, helpersFor(dictionary));
  }

  function collectUnknowns(record, dictionary, stub) {
    return collectUnknownsFor(record, dictionary, stub, helpersFor(dictionary));
  }

  function describeRecord(record) {
    if (record.kind === 'payment') return { kind: 'payment' };
    const claim = x12.segmentsOfType(record, 'CLP')[0];
    const patient = x12.segmentsOfType(record, 'NM1').find((segment) => x12.firstValue(segment, 1) === 'QC');
    return {
      kind: 'claim',
      patientControlNumber: x12.firstValue(claim, 1),
      status: x12.firstValue(claim, 2),
      charged: amountOf(claim, 3),
      paid: amountOf(claim, 4),
      payerClaimNumber: x12.firstValue(claim, 7),
      patientName: patient ? [x12.firstValue(patient, 4), x12.firstValue(patient, 3)].filter(Boolean).join(' ') : '',
    };
  }

  function recordLabel(record, dictionary) {
    if (record.kind === 'payment') return '#1 · Payment summary';
    const description = describeRecord(record);
    const status = lookupCode(dictionary, '1029', description.status);
    return [
      `#${record.index + 1}`,
      description.patientControlNumber || 'no claim number',
      description.patientName || 'no patient name',
      status.status === CODE_STATUS.KNOWN ? status.meaning : `status ${description.status}`,
      `paid ${formatAmount(description.paid)} of ${formatAmount(description.charged)}`,
    ].join(' · ');
  }

  HCX.x12835 = Object.assign(HCX.x12835 || {}, {
    CODE_STATUS,
    lookupCode: (dictionary, tableId, code) => lookupCode(dictionary, tableId, code),
    componentDefinition,
    tableForComponent,
    isEmptyField,
    isDateField,
    isMoneyField,
    formatDate,
    formatAmount,
    summarizeRepetition,
    adjustmentsIn,
    claimAdjustments,
    adjustmentsByGroup,
    claimBalance,
    serviceLineBalances,
    paymentBalance,
    providerAdjustmentsIn,
    describeRecord,
    recordLabel,
    collectGlance,
    collectUnknowns,
  });
})(globalThis);
