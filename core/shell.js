/*
 * Shared page shell: input (file, drop, paste), record navigation, vendor
 * profiles and profile-stub download. Standard-specific work is delegated to
 * an adapter:
 *
 *   { standardId, recordNoun, parse(text) -> { records, warnings, envelope },
 *     recordLabel(record, dict), renderRecord(record, dict, options),
 *     renderEnvelope(envelope, dict), collectUnknowns(record, dict, stub) }
 *
 * Privacy: nothing is persisted (no storage, no network). "Clear" drops all data.
 */
(function (root) {
  'use strict';

  const HCX = root.HCX;
  const { el } = HCX.dom;
  const FORM_TAGS = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'];

  function startShell({ adapter, samples }) {
    const ui = bindElements();
    const state = {
      records: [],
      envelope: [],
      index: 0,
      sourceLabel: '',
      activeProfileIds: new Set(HCX.listProfiles(adapter.standardId).filter((profile) => profile.activeByDefault).map((profile) => profile.id)),
      dictionary: null,
    };

    function rebuildDictionary() {
      state.dictionary = HCX.buildEffectiveDictionary(adapter.standardId, [...state.activeProfileIds]);
    }

    function analyze(text, sourceLabel) {
      let parsed;
      try {
        parsed = adapter.parse(text);
      } catch (error) {
        showStatus(`Could not read ${sourceLabel}: ${error.message}`, 'error');
        return;
      }
      if (!parsed.records.length) {
        showStatus(`No ${adapter.recordNoun}s found in ${sourceLabel}. Check that the content is ${adapter.standardId.toUpperCase()} data.`, 'error', parsed.warnings);
        return;
      }
      Object.assign(state, { records: parsed.records, envelope: parsed.envelope, index: 0, sourceLabel });
      const count = parsed.records.length;
      showStatus(`${count} ${adapter.recordNoun}${count === 1 ? '' : 's'} found in ${sourceLabel}.`, 'ok', parsed.warnings);
      ui.inputPanel.open = false;
      ui.stubButton.disabled = false;
      refreshAll();
    }

    function refreshAll() {
      renderNavigatorOptions();
      renderCurrentRecord();
    }

    function renderNavigatorOptions() {
      ui.nav.hidden = state.records.length === 0;
      ui.select.replaceChildren(...state.records.map((record, index) =>
        el('option', { text: adapter.recordLabel(record, state.dictionary), attrs: { value: index } })));
      ui.envelope.replaceChildren();
      const envelopeNode = adapter.renderEnvelope(state.envelope, state.dictionary);
      if (envelopeNode) ui.envelope.appendChild(envelopeNode);
    }

    function renderCurrentRecord() {
      if (!state.records.length) {
        ui.output.replaceChildren();
        return;
      }
      const total = state.records.length;
      ui.select.value = String(state.index);
      ui.position.textContent = `${state.index + 1} of ${total}`;
      ui.prev.disabled = state.index === 0;
      ui.next.disabled = state.index === total - 1;
      ui.output.replaceChildren(adapter.renderRecord(state.records[state.index], state.dictionary, { showEmpty: ui.showEmpty.checked }));
    }

    function goTo(index) {
      if (!state.records.length) return;
      const clamped = Math.max(0, Math.min(state.records.length - 1, index));
      if (clamped === state.index) return;
      state.index = clamped;
      renderCurrentRecord();
      if (root.scrollY > ui.output.offsetTop) ui.output.scrollIntoView({ block: 'start' });
    }

    function clearAll() {
      Object.assign(state, { records: [], envelope: [], index: 0, sourceLabel: '' });
      ui.paste.value = '';
      ui.fileInput.value = '';
      ui.inputPanel.open = true;
      ui.stubButton.disabled = true;
      ui.envelope.replaceChildren();
      refreshAll();
      showStatus('Cleared. Nothing from the file was stored anywhere.', 'ok');
    }

    function showStatus(message, kind, warnings) {
      ui.status.className = `status ${kind}`;
      const nodes = [el('p', { text: message })];
      if (warnings && warnings.length) {
        nodes.push(el('ul', { className: 'warnings' }, warnings.map((warning) => el('li', { text: warning.text }))));
      }
      ui.status.replaceChildren(...nodes);
    }

    function readFile(file, onText) {
      if (!file) return;
      const reader = new root.FileReader();
      reader.onload = () => onText(String(reader.result), file.name);
      reader.onerror = () => showStatus(`Could not read ${file.name}: ${reader.error && reader.error.message}`, 'error');
      reader.readAsText(file);
    }

    function renderSampleButtons() {
      ui.sampleButtons.replaceChildren(...(samples || []).map((sample) => el('button', {
        className: 'button',
        text: `Sample: ${sample.label}`,
        attrs: { type: 'button' },
        on: {
          click: () => {
            ui.paste.value = sample.text;
            analyze(sample.text, `the "${sample.label}" sample`);
          },
        },
      })));
    }

    function renderProfiles() {
      const profiles = HCX.listProfiles(adapter.standardId);
      if (!profiles.length) {
        ui.profilesList.replaceChildren(el('p', { className: 'muted', text: 'No profiles registered.' }));
        return;
      }
      ui.profilesList.replaceChildren(...profiles.map((profile) => el('label', { className: 'profile-option' }, [
        el('input', {
          attrs: { type: 'checkbox', checked: state.activeProfileIds.has(profile.id) },
          on: { change: (event) => toggleProfile(profile.id, event.target.checked) },
        }),
        el('span', {}, [el('strong', { text: profile.name }), profile.description ? el('span', { className: 'muted', text: ` ${profile.description}` }) : null]),
      ])));
    }

    function toggleProfile(profileId, isActive) {
      if (isActive) state.activeProfileIds.add(profileId);
      else state.activeProfileIds.delete(profileId);
      rebuildDictionary();
      refreshAll();
    }

    function loadProfileFile(text, fileName) {
      try {
        const profile = JSON.parse(text);
        if (profile.standard !== adapter.standardId) {
          throw new Error(`"standard" is "${profile.standard}", but this page expects "${adapter.standardId}"`);
        }
        HCX.registerProfile(profile);
        state.activeProfileIds.add(profile.id);
        rebuildDictionary();
        renderProfiles();
        refreshAll();
        showStatus(`Loaded profile "${profile.name}" from ${fileName}. It lives only in this tab.`, 'ok');
      } catch (error) {
        showStatus(`Could not load profile ${fileName}: ${error.message}`, 'error');
      } finally {
        ui.profileFileInput.value = '';
      }
    }

    function downloadProfileStub() {
      const stub = { segments: {}, tables: {} };
      state.records.forEach((record) => adapter.collectUnknowns(record, state.dictionary, stub));
      const unknownCount = Object.keys(stub.segments).length + Object.keys(stub.tables).length;
      if (!unknownCount) {
        showStatus('Everything in this file is already explained by the dictionary and active profiles. No stub needed.', 'ok');
        return;
      }
      const profile = {
        id: `my-${adapter.standardId}-profile`,
        standard: adapter.standardId,
        name: 'TODO: vendor and interface name',
        description: 'Generated stub. Replace every TODO. Contains segment/field positions and site-defined code values only; no field contents from the analyzed file.',
        segments: stub.segments,
        tables: stub.tables,
      };
      const blob = new root.Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
      const link = el('a', { attrs: { href: root.URL.createObjectURL(blob), download: `${profile.id}.json` } });
      root.document.body.appendChild(link);
      link.click();
      link.remove();
      root.setTimeout(() => root.URL.revokeObjectURL(link.href), 0);
      showStatus('Profile stub downloaded. Fill in the TODOs, then load it with "Load profile" or commit it to your fork.', 'ok');
    }

    function onKeydown(event) {
      if (!state.records.length || FORM_TAGS.includes(event.target.tagName) || event.altKey || event.ctrlKey || event.metaKey) return;
      const moves = { ArrowLeft: state.index - 1, ArrowRight: state.index + 1, Home: 0, End: state.records.length - 1 };
      if (!(event.key in moves)) return;
      event.preventDefault();
      goTo(moves[event.key]);
    }

    function wireEvents() {
      ui.analyzeButton.addEventListener('click', () => analyze(ui.paste.value, 'pasted text'));
      renderSampleButtons();
      ui.clearButton.addEventListener('click', clearAll);
      ui.fileInput.addEventListener('change', () => readFile(ui.fileInput.files[0], analyze));
      ui.profileFileInput.addEventListener('change', () => readFile(ui.profileFileInput.files[0], loadProfileFile));
      ui.stubButton.addEventListener('click', downloadProfileStub);
      ui.prev.addEventListener('click', () => goTo(state.index - 1));
      ui.next.addEventListener('click', () => goTo(state.index + 1));
      ui.select.addEventListener('change', () => goTo(Number(ui.select.value)));
      ui.showEmpty.addEventListener('change', renderCurrentRecord);
      root.document.addEventListener('keydown', onKeydown);

      ui.dropZone.addEventListener('dragover', (event) => { event.preventDefault(); ui.dropZone.classList.add('dragging'); });
      ui.dropZone.addEventListener('dragleave', () => ui.dropZone.classList.remove('dragging'));
      ui.dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        ui.dropZone.classList.remove('dragging');
        readFile(event.dataTransfer.files[0], analyze);
      });
    }

    rebuildDictionary();
    renderProfiles();
    wireEvents();
  }

  function bindElements() {
    const byId = (id) => {
      const node = root.document.getElementById(id);
      if (!node) throw new Error(`Page is missing required element #${id}`);
      return node;
    };
    return {
      inputPanel: byId('input-panel'),
      dropZone: byId('drop-zone'),
      fileInput: byId('file-input'),
      paste: byId('paste-input'),
      analyzeButton: byId('analyze-btn'),
      sampleButtons: byId('sample-buttons'),
      clearButton: byId('clear-btn'),
      profilesList: byId('profiles-list'),
      profileFileInput: byId('profile-file-input'),
      stubButton: byId('stub-btn'),
      status: byId('status'),
      envelope: byId('envelope'),
      nav: byId('record-nav'),
      prev: byId('prev-btn'),
      next: byId('next-btn'),
      select: byId('record-select'),
      position: byId('record-position'),
      showEmpty: byId('show-empty'),
      output: byId('output'),
    };
  }

  HCX.startShell = startShell;
})(globalThis);
