/*
 * Registry for standard dictionaries and vendor profiles.
 *
 * A dictionary describes what a standard means (segments, fields, data types,
 * code tables). A profile is a partial dictionary that overlays vendor-specific
 * meaning on top of it. Pages never edit dictionaries; they build an
 * "effective dictionary" from the base plus whichever profiles are active.
 *
 * Works in the browser (script tag) and in Node (require) via globalThis.
 */
(function (root) {
  'use strict';

  const HCX = root.HCX || (root.HCX = {});
  const dictionaries = {};
  const profiles = {};

  function registerDictionary(standardId, dictionary) {
    if (!standardId || !dictionary || typeof dictionary !== 'object') {
      throw new Error('registerDictionary needs a standard id and a dictionary object');
    }
    dictionaries[standardId] = dictionary;
  }

  function getDictionary(standardId) {
    const dictionary = dictionaries[standardId];
    if (!dictionary) throw new Error(`No dictionary registered for standard "${standardId}"`);
    return dictionary;
  }

  /** Validates and registers a profile. Returns the profile id. */
  function registerProfile(profile) {
    const problems = validateProfile(profile);
    if (problems.length) {
      throw new Error(`Profile rejected: ${problems.join('; ')}`);
    }
    profiles[profile.id] = profile;
    return profile.id;
  }

  function validateProfile(profile) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      return ['a profile must be a JSON object'];
    }
    const problems = [];
    if (typeof profile.id !== 'string' || !profile.id.trim()) problems.push('"id" must be a non-empty string');
    if (typeof profile.standard !== 'string' || !profile.standard.trim()) problems.push('"standard" must be a non-empty string (e.g. "hl7v2")');
    if (typeof profile.name !== 'string' || !profile.name.trim()) problems.push('"name" must be a non-empty string');
    ['segments', 'tables', 'dataTypes', 'messageTypes'].forEach((section) => {
      const value = profile[section];
      if (value !== undefined && (typeof value !== 'object' || Array.isArray(value))) {
        problems.push(`"${section}" must be an object when present`);
      }
    });
    return problems;
  }

  function listProfiles(standardId) {
    return Object.values(profiles).filter((profile) => profile.standard === standardId);
  }

  /**
   * Builds a fresh dictionary = base + active profiles (applied in order).
   * Anything a profile adds or overrides is stamped with `source` so the page
   * can show where a meaning came from.
   */
  function buildEffectiveDictionary(standardId, activeProfileIds) {
    const effective = cloneDeep(getDictionary(standardId));
    normalizeTables(effective.tables || (effective.tables = {}));
    effective.segments = effective.segments || {};
    effective.dataTypes = effective.dataTypes || {};
    effective.messageTypes = effective.messageTypes || {};

    (activeProfileIds || []).forEach((profileId) => {
      const profile = profiles[profileId];
      if (!profile || profile.standard !== standardId) return;
      applyProfile(effective, profile);
    });
    return effective;
  }

  function applyProfile(effective, profile) {
    const source = profile.name;
    mergeSegments(effective.segments, profile.segments || {}, source);
    mergeTables(effective.tables, profile.tables || {}, source);
    mergeFlatSection(effective.dataTypes, profile.dataTypes || {}, source);
    mergeFlatSection(effective.messageTypes, profile.messageTypes || {}, source);
  }

  function mergeSegments(target, overlay, source) {
    Object.entries(overlay).forEach(([segmentId, overlaySegment]) => {
      const base = target[segmentId];
      const { fields: overlayFields = {}, ...overlayProps } = overlaySegment;
      const merged = base
        ? { ...base, ...overlayProps, fields: { ...(base.fields || {}) } }
        : { ...overlayProps, fields: {}, source };
      if (base && Object.keys(overlayProps).length) merged.source = source;

      Object.entries(overlayFields).forEach(([position, overlayField]) => {
        merged.fields[position] = { ...(merged.fields[position] || {}), ...overlayField, source };
      });
      target[segmentId] = merged;
    });
  }

  function mergeTables(target, overlay, source) {
    Object.entries(overlay).forEach(([tableId, overlayTable]) => {
      const { values: overlayValues = {}, ...overlayProps } = overlayTable;
      const merged = { values: {}, ...(target[tableId] || {}), ...overlayProps };
      merged.values = { ...merged.values };
      Object.entries(overlayValues).forEach(([code, meaning]) => {
        merged.values[code] = { meaning: String(meaning), source };
      });
      target[tableId] = merged;
    });
  }

  function mergeFlatSection(target, overlay, source) {
    Object.entries(overlay).forEach(([key, value]) => {
      target[key] = { ...(target[key] || {}), ...value, source };
    });
  }

  /** Base tables may list values as plain strings; normalize to { meaning }. */
  function normalizeTables(tables) {
    Object.values(tables).forEach((table) => {
      const values = table.values || {};
      table.values = {};
      Object.entries(values).forEach(([code, meaning]) => {
        table.values[code] = typeof meaning === 'string' ? { meaning } : meaning;
      });
    });
  }

  function cloneDeep(value) {
    return JSON.parse(JSON.stringify(value));
  }

  Object.assign(HCX, {
    registerDictionary,
    getDictionary,
    registerProfile,
    validateProfile,
    listProfiles,
    buildEffectiveDictionary,
  });
})(globalThis);
