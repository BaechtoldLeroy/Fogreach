// tests/seltenheitDeckel.test.js — Seltenheits-Deckel der flachen Tiefen.
//
// Auf Tiefe 1-3 gibt es hoechstens Blau (Stufe 1), auf 4-6 hoechstens Gelb
// (Stufe 2), Orange (Stufe 3) erst ab Tiefe 7. Gedeckelt wird VOR den Affixen,
// ein gedeckeltes Stueck ist also ein richtiges blaues bzw. gelbes Stueck.
//
// Farben (js/loot.js TIER_COLORS): 0 grau, 1 blau, 2 gelb, 3 orange.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

loadGameModule('js/lootSystem.js');
const LS = globalThis.window.LootSystem;

test('tierDeckel: blau bis Tiefe 3, gelb bis 6, orange ab 7', () => {
  const ist = [1, 2, 3, 4, 5, 6, 7, 20].map((t) => LS.tierDeckel(t));
  assert.deepStrictEqual(ist, [1, 1, 1, 2, 2, 2, 3, 3]);
  assert.strictEqual(LS.tierDeckel(undefined), 1, 'ohne Tiefe die vorsichtigste Annahme');
});

test('Auf den ersten drei Tiefen faellt nichts ueber Blau — auch nicht erzwungen', () => {
  [1, 2, 3].forEach((tiefe) => {
    [2, 3].forEach((stufe) => {
      const it = LS.rollItem(null, tiefe, stufe);
      assert.strictEqual(it.tier, 1, 'Tiefe ' + tiefe + ', erzwungen ' + stufe + ' -> ' + it.tier);
      assert.strictEqual((it.affixes || []).length, 1, 'die Affixe passen nicht zur neuen Stufe');
    });
  });
});

test('Auf Tiefe 4 bis 6 wird Orange zu Gelb, Gelb bleibt', () => {
  [4, 5, 6].forEach((tiefe) => {
    const orange = LS.rollItem(null, tiefe, 3);
    assert.strictEqual(orange.tier, 2, 'Tiefe ' + tiefe);
    assert.strictEqual((orange.affixes || []).length, 2);
    assert.strictEqual(LS.rollItem(null, tiefe, 2).tier, 2, 'Gelb wurde gedeckelt');
  });
});

test('Ab Tiefe 7 bleibt Orange orange', () => {
  const it = LS.rollItem(null, 7, 3);
  assert.strictEqual(it.tier, 3);
  assert.strictEqual((it.affixes || []).length, 3);
});

test('Ueber viele Wuerfe faellt auf flacher Tiefe nie etwas Besseres', () => {
  // Mit hohem Qualitaets-Bias wuerde ohne Deckel regelmaessig Gelb fallen.
  const gesehen = new Set();
  for (let i = 0; i < 300; i++) gesehen.add(LS.rollItem(null, 3, null, 8).tier);
  assert.ok(Math.max(...gesehen) <= 1, 'gefundene Stufen: ' + [...gesehen].sort().join(','));
  const tief = new Set();
  for (let i = 0; i < 300; i++) tief.add(LS.rollItem(null, 12, null, 8).tier);
  assert.ok(Math.max(...tief) >= 2, 'tief faellt nichts Besseres: ' + [...tief].sort().join(','));
});

test('Stufe 0 (grau) bleibt unberuehrt', () => {
  const it = LS.rollItem(null, 2, 0);
  assert.strictEqual(it.tier, 0);
  assert.strictEqual((it.affixes || []).length, 0);
});

test('Der Opferstein darf am Deckel vorbei — er behaelt die Seltenheit', () => {
  const ohne = LS.rollItem(null, 1, 2, undefined, { ohneDeckel: true });
  assert.strictEqual(ohne.tier, 2, 'der Umwurf wurde gedeckelt');
  assert.strictEqual(LS.rollItem(null, 1, 2).tier, 1, 'ohne die Ausnahme greift der Deckel nicht mehr');
});
