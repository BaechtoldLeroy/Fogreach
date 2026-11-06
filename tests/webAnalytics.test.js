// tests/webAnalytics.test.js: Cloudflare Web Analytics zaehlt nur echte
// Besuche auf der Tester-Adresse, nie lokal, im Debug-Modus oder in Tests.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function laden(ort, opts) {
  opts = opts || {};
  const angehaengt = [];
  const listener = {};
  const doc = {
    readyState: opts.readyState || 'complete',
    head: { appendChild(el) { angehaengt.push(el); } },
    createElement() {
      return { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
    }
  };
  const win = {
    location: ort,
    document: doc,
    navigator: { webdriver: !!opts.webdriver },
    DebugGate: { aktiv() { return !!opts.debug; } },
    addEventListener(t, f) { listener[t] = f; }
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/webAnalytics.js'), 'utf8'), win);
  return { win, angehaengt, listener };
}

const TESTER = { hostname: 'fogreach.fogreach.workers.dev', search: '' };

test('Auf der Tester-Adresse wird das Beacon mit dem Token eingebunden', () => {
  const { angehaengt } = laden(TESTER);
  assert.strictEqual(angehaengt.length, 1);
  assert.strictEqual(angehaengt[0].src, 'https://static.cloudflareinsights.com/beacon.min.js');
  assert.ok(angehaengt[0].defer, 'Beacon nicht verzoegert');
  assert.deepStrictEqual(JSON.parse(angehaengt[0].attrs['data-cf-beacon']), { token: 'c5caf2605f0f4605b689bb84f39d0700' });
});

test('Laedt die Seite noch, kommt das Beacon erst nach load', () => {
  const { angehaengt, listener } = laden(TESTER, { readyState: 'loading' });
  assert.strictEqual(angehaengt.length, 0, 'Beacon vor load');
  listener.load();
  assert.strictEqual(angehaengt.length, 1);
});

test('Nicht gezaehlt: andere Adressen, Debug-Modus, automatisierte Browser', () => {
  assert.strictEqual(laden({ hostname: 'baechtoldleroy.github.io' }).angehaengt.length, 0, 'GitHub Pages');
  assert.strictEqual(laden({ hostname: 'localhost' }).angehaengt.length, 0, 'lokal');
  assert.strictEqual(laden(TESTER, { debug: true }).angehaengt.length, 0, 'Debug-Modus');
  assert.strictEqual(laden(TESTER, { webdriver: true }).angehaengt.length, 0, 'automatisiert');
});
