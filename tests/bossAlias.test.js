// tests/bossAlias.test.js — Aufloesung von ?boss=<name> (#88-Gate).
//
// Der Debug-Zweig in wave.js darf nur greifen, wenn der Name AUFLOESBAR ist.
// Gemessen: ohne diese Bedingung landete ?boss=quatsch im Boss-Zweig ohne
// Definition und riss das Spiel mit ("Cannot read properties of undefined").

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;
loadGameModule('js/enemy.js');

function mitFlagge(wert) {
  W.location = { search: wert === null ? '' : ('?boss=' + wert), hostname: 'localhost', protocol: 'http:' };
  delete W.DebugGate;
  loadGameModule('js/debugGate.js');
  return W.debugForcedBoss ? W.debugForcedBoss() : null;
}

test('Interne Id, deutscher Name und Nummer fuehren zum selben Boss', () => {
  ['chainMaster', 'kettenmeister', 'ketten', '1'].forEach((n) => {
    const d = mitFlagge(n);
    assert.ok(d, n + ' muss aufloesen');
    assert.strictEqual(d.id, 'chainMaster', n);
  });
  assert.strictEqual(mitFlagge('zeremonienmeister').id, 'ceremonyMaster');
  assert.strictEqual(mitFlagge('schattenrat').id, 'shadowCouncillor');
  assert.strictEqual(mitFlagge('3').id, 'shadowCouncillor');
});

test('Ein unbekannter Name loest NICHT auf — sonst stuerzt der Boss-Zweig ab', () => {
  assert.strictEqual(mitFlagge('quatsch'), null);
  assert.strictEqual(mitFlagge(''), null);
  assert.strictEqual(mitFlagge(null), null, 'ohne Flagge erst recht nicht');
});

test('Ohne Debug-Modus loest gar nichts auf', () => {
  W.location = { search: '?boss=kettenmeister', hostname: 'baechtoldleroy.github.io', protocol: 'https:' };
  delete W.DebugGate;
  loadGameModule('js/debugGate.js');
  assert.strictEqual(W.debugForcedBoss(), null);
});
