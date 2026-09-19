/* Boots the X12 835 page. Kept in its own file because the page's CSP forbids inline scripts. */
(function (root) {
  'use strict';
  root.HCX.startShell({ adapter: root.HCX.adapters['x12-835'], samples: root.HCX.samples['x12-835'] });
})(globalThis);
