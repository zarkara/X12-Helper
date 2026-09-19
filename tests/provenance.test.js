/*
 * The corpus is other people's work, redistributed here. That only stays
 * defensible if every file's source and licence are recorded and verifiable,
 * so this checks the paperwork rather than the parsing:
 *
 *   - every message file has a manifest entry and an .info sidecar
 *   - every file still hashes to what was recorded when it was captured
 *   - every source names a licence, a copyright holder and a licence file
 *
 * tools/build-conformance-info.js --check does the same work; it is run here
 * so a missing sidecar fails npm test rather than waiting for someone to
 * remember to run it.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { corpusFiles, CORPUS } = require('../tools/conformance-report');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(CORPUS, 'manifest.json'), 'utf8'));
const ALLOWED_LICENCES = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC0-1.0'];

test('every message file has recorded provenance and a current .info sidecar', () => {
  assert.doesNotThrow(() => execFileSync('node', [path.join(ROOT, 'tools', 'build-conformance-info.js'), '--check'], { cwd: ROOT, stdio: 'pipe' }),
    'run node tools/build-conformance-info.js to regenerate the sidecars');
});

test('the manifest and the corpus on disk describe the same set of files', () => {
  const onDisk = corpusFiles().map((file) => path.relative(CORPUS, file).split(path.sep).join('/')).sort();
  const recorded = manifest.files.map((entry) => entry.file).sort();

  assert.deepEqual(onDisk, recorded);
  assert.ok(onDisk.length > 0, 'the corpus is empty');
});

test('every file names an upstream repository, commit and path', () => {
  for (const entry of manifest.files) {
    assert.ok(manifest.sources[entry.source], `${entry.file} names an unknown source`);
    assert.match(entry.commit, /^[0-9a-f]{40}$/, `${entry.file} has no upstream commit`);
    assert.ok(entry.upstreamPath, `${entry.file} has no upstream path`);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/, `${entry.file} has no content hash`);
    assert.ok(entry.permalink.startsWith(`${manifest.sources[entry.source].repository}/blob/${entry.commit}/`), `${entry.file} has a permalink that does not point at its own commit`);
  }
});

test('every source carries a licence we are allowed to redistribute, with its text committed', () => {
  for (const [slug, source] of Object.entries(manifest.sources)) {
    assert.ok(ALLOWED_LICENCES.includes(source.licence), `${slug} is licensed ${source.licence}, which ADR-0003 does not allow us to redistribute`);
    assert.ok(source.copyright, `${slug} has no copyright line`);
    assert.ok(source.attribution, `${slug} does not say what attribution it needs`);
    assert.ok(source.licenceUrl.startsWith('https://'), `${slug} has no link to its licence text`);
    const licenceFile = path.join(CORPUS, slug, 'LICENSE');
    assert.ok(fs.existsSync(licenceFile), `${slug} has no committed copy of its licence`);
    assert.ok(fs.readFileSync(licenceFile, 'utf8').trim().length > 200, `${slug}/LICENSE looks truncated`);
  }
});

test('every source is credited in NOTICE', () => {
  const notice = fs.readFileSync(path.join(ROOT, 'conformance', 'NOTICE'), 'utf8');
  for (const source of Object.values(manifest.sources)) {
    assert.ok(notice.includes(source.repository), `${source.name} is in the corpus but not in conformance/NOTICE`);
  }
});
