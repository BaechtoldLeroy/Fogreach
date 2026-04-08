// Shared test setup: stub the bare minimum browser globals so we can load
// the game's IIFE-wrapped systems (which expect window + localStorage) under
// node:test without a real DOM.

const _store = {};
const localStorageStub = {
  get _data() { return _store; },
  getItem(key) { return Object.prototype.hasOwnProperty.call(_store, key) ? _store[key] : null; },
  setItem(key, value) { _store[key] = String(value); },
  removeItem(key) { delete _store[key]; },
  clear() { for (const k of Object.keys(_store)) delete _store[k]; }
};

if (!globalThis.window) globalThis.window = {};
if (!globalThis.localStorage) globalThis.localStorage = localStorageStub;
// Some game files reference these globals directly
if (!globalThis.console) globalThis.console = console;

// Reset helper for tests that want a clean slate between cases
function resetStore() {
  for (const k of Object.keys(_store)) delete _store[k];
}

module.exports = { localStorageStub, resetStore };
