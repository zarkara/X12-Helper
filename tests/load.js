/* Loads the browser scripts into Node's globalThis for testing (no DOM needed). */
const path = require('node:path');
const root = path.join(__dirname, '..');

function loadCore() {
  for (const file of [
    'core/registry.js',
    'core/codes.js',
    'core/records.js',
    'standards/x12-835/parser.js',
    'standards/x12-835/interpret.js',
    'standards/x12-835/dictionary.js',
    'standards/x12-835/sample.js',
    'profiles/x12-835/example-payer.js',
  ]) {
    require(path.join(root, file));
  }
  return globalThis.HCX;
}

module.exports = { loadCore };
