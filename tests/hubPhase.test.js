// Unit tests for js/hubPhase.js (Feature 064 WP01).
// derivePhase ist rein — wir laden das Modul mit global.window={}.

const { test } = require('node:test');
const assert = require('node:assert');

function load() {
  delete require.cache[require.resolve('../js/hubPhase.js')];
  global.window = {};
  require('../js/hubPhase.js');
  return global.window.HubPhase;
}

const H = load();

// --- derivePhase: Grundfaelle -----------------------------------------------
test('derivePhase: Akt 0/1 => council', () => {
  assert.strictEqual(H.derivePhase(0, {}), 'council');
  assert.strictEqual(H.derivePhase(1, {}), 'council');
});
test('derivePhase: Akt 2/3 => doubleAgent', () => {
  assert.strictEqual(H.derivePhase(2, {}), 'doubleAgent');
  assert.strictEqual(H.derivePhase(3, {}), 'doubleAgent');
});
test('derivePhase: Akt 4 => broken', () => {
  assert.strictEqual(H.derivePhase(4, {}), 'broken');
});

// --- Prioritaet: epilogue schlaegt broken/doubleAgent -----------------------
test('derivePhase: story_ending => epilogue, auch in Akt 4', () => {
  assert.strictEqual(H.derivePhase(4, { story_ending: true }), 'epilogue');
  assert.strictEqual(H.derivePhase(2, { story_ending: true }), 'epilogue');
  assert.strictEqual(H.derivePhase(0, { story_ending: true }), 'epilogue');
});

// --- Default / Robustheit ---------------------------------------------------
test('derivePhase: null/undefined => council, kein Wurf', () => {
  assert.doesNotThrow(() => H.derivePhase(null, undefined));
  assert.strictEqual(H.derivePhase(null, undefined), 'council');
  assert.strictEqual(H.derivePhase(undefined, null), 'council');
});
test('derivePhase: mutiert das Eingabeobjekt nicht', () => {
  const flags = { story_ending: true, other: 1 };
  const snap = JSON.stringify(flags);
  H.derivePhase(3, flags);
  assert.strictEqual(JSON.stringify(flags), snap);
});

// --- aldricBlocksQuests -----------------------------------------------------
test('aldricBlocksQuests: nur in broken true', () => {
  assert.strictEqual(H.aldricBlocksQuests('broken'), true);
  ['council', 'doubleAgent', 'epilogue'].forEach((p) => {
    assert.strictEqual(H.aldricBlocksQuests(p), false, p + ' darf nicht sperren');
  });
});

// --- PHASE_STYLE-Vollstaendigkeit -------------------------------------------
test('PHASE_STYLE: alle vier Phasen mit allen Feldern', () => {
  const fields = ['tint', 'desaturate', 'fog', 'posters', 'assetKey', 'rathausHostile'];
  ['council', 'doubleAgent', 'broken', 'epilogue'].forEach((p) => {
    const s = H.PHASE_STYLE[p];
    assert.ok(s, p + ' hat einen Style-Eintrag');
    fields.forEach((f) => assert.ok(Object.prototype.hasOwnProperty.call(s, f), p + ' hat Feld ' + f));
    assert.strictEqual(typeof s.tint, 'number');
    assert.ok(s.desaturate >= 0 && s.desaturate <= 1, p + ' desaturate 0..1');
    assert.ok(s.fog >= 0 && s.fog <= 1, p + ' fog 0..1');
    assert.ok(['fresh', 'faded', 'torn', 'gone'].indexOf(s.posters) >= 0, p + ' posters gueltig');
    assert.strictEqual(typeof s.rathausHostile, 'boolean');
  });
  // Nur broken markiert das Rathaus feindlich.
  assert.strictEqual(H.PHASE_STYLE.broken.rathausHostile, true);
  assert.strictEqual(H.PHASE_STYLE.council.rathausHostile, false);
});
