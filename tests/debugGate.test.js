// Tests fuer js/debugGate.js (#88).
//
// Der Kern: ohne ?debug=1 und ausserhalb von localhost darf KEINE Debug-Flagge
// wirken. Der Schalter selbst ist winzig — der Wert dieser Tests liegt darin,
// dass sie die Ausnahmen festhalten, an denen sich das Gate oeffnen laesst.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

function mit(location) {
  if (!globalThis.window) require('./setup');
  const w = globalThis.window;
  w.location = location;
  delete w.DebugGate;
  loadGameModule('js/debugGate.js');
  return w.DebugGate;
}

const FREMD = { hostname: 'baechtoldleroy.github.io', protocol: 'https:' };

beforeEach(() => { if (globalThis.window) delete globalThis.window.DebugGate; });

test('Auf der veroeffentlichten Seite ist das Gate zu', () => {
  const G = mit(Object.assign({ search: '' }, FREMD));
  assert.strictEqual(G.aktiv(), false);
});

test('?debug=1 oeffnet das Gate auch auf der veroeffentlichten Seite', () => {
  const G = mit(Object.assign({ search: '?debug=1' }, FREMD));
  assert.strictEqual(G.aktiv(), true);
});

test('Lokal ist das Gate offen, ohne dass man daran denken muss', () => {
  ['localhost', '127.0.0.1', '[::1]'].forEach((h) => {
    const G = mit({ search: '', hostname: h, protocol: 'http:' });
    assert.strictEqual(G.aktiv(), true, h);
  });
  const ausDatei = mit({ search: '', hostname: '', protocol: 'file:' });
  assert.strictEqual(ausDatei.aktiv(), true, 'file:');
});

test('Ein Hostname, der nur so AUSSIEHT, oeffnet nichts', () => {
  // Der gefaehrliche Fall: wer den Test auf Teilstring umstellt, macht
  // 'localhost.angreifer.example' zu einer Entwicklermaschine.
  ['localhost.angreifer.example', 'notlocalhost', '127.0.0.1.example.com']
    .forEach((h) => {
      const G = mit({ search: '', hostname: h, protocol: 'https:' });
      assert.strictEqual(G.aktiv(), false, h);
    });
});

test('Bei geschlossenem Gate liefert jede Flagge null', () => {
  const G = mit(Object.assign({ search: '?perf=1&dungeon=20&spy=1&modes=hunt' }, FREMD));
  ['perf', 'dungeon', 'spy', 'modes'].forEach((f) => {
    assert.strictEqual(G.flagge(f), null, f);
    assert.strictEqual(G.an(f), false, f);
  });
});

test('Bei offenem Gate kommen die Werte durch', () => {
  const G = mit(Object.assign({ search: '?debug=1&dungeon=20&modes=hunt,defend' }, FREMD));
  assert.strictEqual(G.flagge('dungeon'), '20');
  assert.strictEqual(G.flagge('modes'), 'hunt,defend');
  assert.strictEqual(G.flagge('gibtsnicht'), null, 'nicht gesetzt bleibt null');
});

test('an() unterscheidet gesetzt von ausgeschaltet', () => {
  const G = mit({ search: '?perf=1&nofog=0&nomask=false&nospot=', hostname: 'localhost', protocol: 'http:' });
  assert.strictEqual(G.an('perf'), true);
  assert.strictEqual(G.an('nofog'), false, '=0 ist aus');
  assert.strictEqual(G.an('nomask'), false, '=false ist aus');
  assert.strictEqual(G.an('nospot'), true, 'leerer Wert zaehlt als gesetzt');
});

test('Der Name muss genau passen — kein Praefix-Treffer', () => {
  // ?modes= darf nicht als ?mode= durchgehen (der Raum-Rundgang haengt daran).
  const G = mit({ search: '?modes=a,b', hostname: 'localhost', protocol: 'http:' });
  assert.strictEqual(G.flagge('modes'), 'a,b');
  assert.strictEqual(G.flagge('mode'), null);
});

test('Ohne location faellt das Gate zu, statt zu werfen', () => {
  const G = mit(null);
  assert.strictEqual(G.aktiv(), false);
  assert.strictEqual(G.flagge('perf'), null);
});
