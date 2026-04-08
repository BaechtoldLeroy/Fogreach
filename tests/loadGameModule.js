// Loads a browser-IIFE game module into the test process.
// The game files attach to window/globals, so we eval them inside a Function
// scope that has window/localStorage/console explicitly bound.

const fs = require('fs');
const path = require('path');

function loadGameModule(relPath) {
  const absPath = path.join(__dirname, '..', relPath);
  const code = fs.readFileSync(absPath, 'utf8');
  // Make sure the test setup ran first so window/localStorage exist
  if (!globalThis.window) require('./setup');
  // Wrap and execute. Pass through the test's globals as locals so the IIFE
  // sees them with the same names it expects in the browser.
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', 'localStorage', 'console', code);
  fn(globalThis.window, globalThis.localStorage, console);
}

module.exports = { loadGameModule };
