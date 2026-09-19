/*
 * Copies core/ from a sibling checkout of HL7-Helper, which is where the
 * shared shell, registry, code look-ups and styles are maintained.
 *
 *   node tools/sync-core.js ../HL7-Helper
 *   node tools/sync-core.js ../HL7-Helper --check   (fails if out of step)
 *
 * See docs/adr/0004-separate-repos.md for why the copy exists.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SHARED_FILES = ['registry.js', 'codes.js', 'records.js', 'shell.js', 'dom.js', 'styles.css'];
const [sourceRepo, flag] = process.argv.slice(2);
const checkOnly = flag === '--check';

if (!sourceRepo) {
  console.error('Usage: node tools/sync-core.js <path to HL7-Helper checkout> [--check]');
  process.exit(2);
}

const missing = SHARED_FILES.filter((file) => !fs.existsSync(path.join(sourceRepo, 'core', file)));
if (missing.length) {
  console.error(`${sourceRepo} does not look like an HL7-Helper checkout — no core/${missing[0]}.`);
  process.exit(2);
}

const differences = SHARED_FILES.filter((file) => {
  const from = path.join(sourceRepo, 'core', file);
  const to = path.join(__dirname, '..', 'core', file);
  const incoming = fs.readFileSync(from, 'utf8');
  const current = fs.existsSync(to) ? fs.readFileSync(to, 'utf8') : null;
  if (incoming === current) return false;
  if (!checkOnly) {
    fs.writeFileSync(to, incoming);
    console.log(`updated core/${file}`);
  }
  return true;
});

if (checkOnly && differences.length) {
  console.error(`core/ is out of step with ${sourceRepo}: ${differences.join(', ')}`);
  process.exit(1);
}
console.log(checkOnly ? 'core/ matches the source repo.' : `Sync complete (${differences.length} file(s) changed).`);
