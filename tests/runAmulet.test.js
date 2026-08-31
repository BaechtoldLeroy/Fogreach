// Unit tests for Feature 059 (#42) WP01 — run-amulet data model.
//
// The unit-loadable surface lives in js/lootSystem.js (AMULET_DEFS + rollAmulet).
// The equipment.amulet SLOT + equip/swap live in main.js/inventory.js (Phaser,
// not unit-loadable) and are verified via the smoke test + manual play.

const { test, before } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

function makeRng(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function freshSystem() {
  resetStore();
  delete globalThis.window.LootSystem;
  loadGameModule('js/lootSystem.js');
  return globalThis.window.LootSystem;
}

const EFFECTS = new Set([
  'twin', 'chain', 'cleave', 'lifesteal', 'aura', 'tempo',
  'orbit', 'killburst', 'dashstrike', 'momentum', 'frost', 'glass', 'revive', 'bloodpact'
]);
const GEAR_TYPES = ['weapon', 'head', 'body', 'boots', 'potion', 'material'];

test('AMULET_DEFS: 14 well-formed, unique amulet defs (voller Pool)', () => {
  const sys = freshSystem();
  const defs = sys.AMULET_DEFS;
  assert.ok(Array.isArray(defs) && defs.length === 14, 'exactly 14 amulets');
  const keys = new Set();
  for (const d of defs) {
    assert.strictEqual(d.type, 'amulet');
    assert.ok(typeof d.key === 'string' && d.key.length > 0, 'has key');
    assert.ok(typeof d.name === 'string' && d.name.length > 0, 'has name');
    assert.ok(typeof d.iconKey === 'string' && d.iconKey.length > 0, 'has iconKey');
    assert.ok(EFFECTS.has(d.effect), 'known effect key: ' + d.effect);
    keys.add(d.key);
  }
  assert.strictEqual(keys.size, 14, 'unique keys');
});

test('AMULET_DEFS: alle effect-Keys einmalig (kein Effekt doppelt)', () => {
  const sys = freshSystem();
  const effects = sys.AMULET_DEFS.map((d) => d.effect);
  assert.strictEqual(new Set(effects).size, effects.length, 'unique effect keys');
  assert.strictEqual(effects.length, EFFECTS.size, 'pool covers exactly the known effects');
});

test('AMULET_DEFS is frozen (cannot be mutated)', () => {
  const sys = freshSystem();
  assert.strictEqual(Object.isFrozen(sys.AMULET_DEFS), true);
  assert.throws(() => { sys.AMULET_DEFS.push({}); });
});

test('rollAmulet returns a valid amulet item from the pool', () => {
  const sys = freshSystem();
  const keys = new Set(sys.AMULET_DEFS.map((d) => d.key));
  for (let s = 0; s < 200; s++) {
    const a = sys.rollAmulet(12, makeRng(s + 1));
    assert.strictEqual(a.type, 'amulet', 'only amulets');
    assert.strictEqual(a.isAmulet, true);
    assert.ok(keys.has(a.key), 'key from AMULET_DEFS: ' + a.key);
    assert.ok(EFFECTS.has(a.effect), 'effect set: ' + a.effect);
    assert.ok(typeof a.name === 'string' && a.name.length > 0);
  }
});

test('rollAmulet never returns regular gear types (separate from rollItem)', () => {
  const sys = freshSystem();
  for (let s = 0; s < 100; s++) {
    const a = sys.rollAmulet(15, makeRng(s + 100));
    assert.ok(!GEAR_TYPES.includes(a.type), 'not gear: ' + a.type);
  }
});

test('rollAmulet is deterministic for a given seed', () => {
  const sys = freshSystem();
  assert.strictEqual(sys.rollAmulet(12, makeRng(42)).key, sys.rollAmulet(12, makeRng(42)).key);
});

test('rollAmulet defaults (no rng / no depth) do not throw and return an amulet', () => {
  const sys = freshSystem();
  const a = sys.rollAmulet();
  assert.strictEqual(a.type, 'amulet');
  assert.ok(typeof a.name === 'string' && a.name.length > 0);
});

// --- WP02: Run-Lifecycle (Reset + Save-Guard) ---

test('#42 WP02: PERSISTENT_EQUIP_SLOTS excludes amulet (Save-Guard FR-12)', () => {
  const sys = freshSystem();
  assert.ok(Array.isArray(sys.PERSISTENT_EQUIP_SLOTS), 'whitelist exists');
  assert.deepStrictEqual(sys.PERSISTENT_EQUIP_SLOTS, ['weapon', 'head', 'body', 'boots']);
  assert.ok(!sys.PERSISTENT_EQUIP_SLOTS.includes('amulet'), 'amulet is never persisted');
});

test('#42 WP02: clearRunAmulet nulls the amulet slot, leaves gear untouched', () => {
  const sys = freshSystem();
  const eq = { weapon: { x: 1 }, head: null, body: null, boots: null, amulet: { effect: 'twin' } };
  const out = sys.clearRunAmulet(eq);
  assert.strictEqual(out.amulet, null, 'amulet cleared');
  assert.deepStrictEqual(out.weapon, { x: 1 }, 'weapon untouched');
});

test('#42 WP02: clearRunAmulet is null-safe (no throw)', () => {
  const sys = freshSystem();
  assert.doesNotThrow(() => sys.clearRunAmulet(null));
  assert.doesNotThrow(() => sys.clearRunAmulet(undefined));
  assert.doesNotThrow(() => sys.clearRunAmulet({}));
});

// --- WP04: Spawn-Gating + fliegender Händler (Auslage) ---

test('#42 WP04: shouldSpawnRunAmulet — keiner unter Tiefe 10 (egal welcher Roll)', () => {
  const sys = freshSystem();
  const always = () => 0; // would always pass the chance roll
  for (let d = 1; d < 10; d++) {
    assert.strictEqual(sys.shouldSpawnRunAmulet(d, always), false, 'depth ' + d + ' blocked');
  }
});

test('#42 WP04: shouldSpawnRunAmulet — ab Tiefe 10 CHANCE-basiert (Grenze inklusiv)', () => {
  const sys = freshSystem();
  // ~50% gate: roll < 0.5 passes, >= 0.5 fails.
  assert.strictEqual(sys.shouldSpawnRunAmulet(10, () => 0.10), true, 'depth 10 + low roll -> spawn');
  assert.strictEqual(sys.shouldSpawnRunAmulet(10, () => 0.49), true, 'just under threshold -> spawn');
  assert.strictEqual(sys.shouldSpawnRunAmulet(10, () => 0.50), false, 'at threshold -> no spawn (chance, not guaranteed)');
  assert.strictEqual(sys.shouldSpawnRunAmulet(10, () => 0.90), false, 'high roll -> no spawn');
  assert.strictEqual(sys.shouldSpawnRunAmulet(25, () => 0.10), true, 'deeper still gated by chance');
});

test('#42 WP04: shouldSpawnRunAmulet — defensive gegen ungueltige Tiefe', () => {
  const sys = freshSystem();
  assert.strictEqual(sys.shouldSpawnRunAmulet(NaN, () => 0), false);
  assert.strictEqual(sys.shouldSpawnRunAmulet(undefined, () => 0), false);
});

test('#42 WP04: getOrCreateAmuletShopState — keine Auslage unter Tiefe 10', () => {
  const sys = freshSystem();
  globalThis.window.dungeonRun = { runId: 'run-shallow' };
  globalThis.window.DUNGEON_DEPTH = 5;
  const state = sys.getOrCreateAmuletShopState();
  assert.ok(state && Array.isArray(state.amuletStock), 'state shape');
  assert.strictEqual(state.amuletStock.length, 0, 'no amulets below depth 10 (FR-13)');
});

test('#42 WP04: getOrCreateAmuletShopState — ab Tiefe 10 kuratierte Auslage (nur Amulette, unique)', () => {
  const sys = freshSystem();
  globalThis.window.dungeonRun = { runId: 'run-deep' };
  globalThis.window.DUNGEON_DEPTH = 12;
  const state = sys.getOrCreateAmuletShopState();
  assert.ok(state.amuletStock.length >= 1 && state.amuletStock.length <= 3, '1-3 options');
  const keys = new Set();
  for (const a of state.amuletStock) {
    assert.strictEqual(a.type, 'amulet', 'only amulets in the auslage');
    assert.strictEqual(a.isAmulet, true);
    keys.add(a.key);
  }
  assert.strictEqual(keys.size, state.amuletStock.length, 'no duplicate amulet in one auslage');
});

test('#42 WP04: getOrCreateAmuletShopState — run-fix pro runId (gleicher Run -> gleiche Auswahl)', () => {
  const sys = freshSystem();
  globalThis.window.dungeonRun = { runId: 'run-A' };
  globalThis.window.DUNGEON_DEPTH = 14;
  const first = sys.getOrCreateAmuletShopState();
  const again = sys.getOrCreateAmuletShopState();
  assert.strictEqual(again, first, 'same cached state object within a run');
  assert.deepStrictEqual(again.amuletStock.map(a => a.key), first.amuletStock.map(a => a.key));
  // New run -> fresh roll (state object replaced).
  globalThis.window.dungeonRun = { runId: 'run-B' };
  const other = sys.getOrCreateAmuletShopState();
  assert.notStrictEqual(other, first, 'new runId rebuilds the auslage');
});

test('#42 WP04: refreshShop invalidiert auch die Amulett-Auslage', () => {
  const sys = freshSystem();
  globalThis.window.dungeonRun = { runId: 'run-R' };
  globalThis.window.DUNGEON_DEPTH = 11;
  const before = sys.getOrCreateAmuletShopState();
  sys.refreshShop();
  const after = sys.getOrCreateAmuletShopState();
  assert.notStrictEqual(after, before, 'refreshShop drops the cached amulet auslage');
});

test('#42 WP04: getAmuletEffectDesc — liefert kurze Beschreibung pro Effekt', () => {
  const sys = freshSystem();
  for (const d of sys.AMULET_DEFS) {
    const desc = sys.getAmuletEffectDesc(d.effect);
    assert.ok(typeof desc === 'string' && desc.length > 0, 'desc for ' + d.effect);
  }
  assert.strictEqual(sys.getAmuletEffectDesc(''), '', 'empty effect -> empty desc');
});

// --- WP05: i18n name keys ---

test('#42 WP05: rollAmulet setzt einen i18n-Namenskey (effect-basiert)', () => {
  const sys = freshSystem();
  for (let s = 0; s < 60; s++) {
    const a = sys.rollAmulet(12, makeRng(s + 7));
    assert.strictEqual(a.nameKey, 'amulet.name.' + a.effect, 'nameKey matches effect');
  }
});

test('#42 WP05: composeName faellt ohne i18n auf den DE-Basisnamen zurueck', () => {
  const sys = freshSystem();
  const a = sys.rollAmulet(12, makeRng(3));
  // No i18n registered in the headless harness -> composeName returns _baseName.
  assert.strictEqual(sys.composeName(a), a._baseName, 'falls back to DE base name');
});

// --- Issue #120: WO im Lauf das Amulett liegt (ab Raum 3) ---
//
// Getestet wird die reine Raumregel aus js/roomManager.js. Die Frage OB
// ueberhaupt (Tiefe + Chance) bleibt in shouldSpawnRunAmulet und ist oben
// abgedeckt.

let placeHere; // window.shouldPlaceRunAmuletHere

before(() => {
  if (!globalThis.window) require('./setup');
  loadGameModule('js/roomManager.js');
  placeHere = globalThis.window.shouldPlaceRunAmuletHere;
});

test('#120: Raum 1 und 2 eines normalen Laufs bekommen das Amulett NICHT', () => {
  // 8-Raum-Lauf: roomsEntered 1 -> Index 0, roomsEntered 2 -> Index 1.
  assert.strictEqual(placeHere(1, 0, 8), false, 'Raum 1 bleibt leer');
  assert.strictEqual(placeHere(2, 1, 8), false, 'Raum 2 bleibt leer');
});

test('#120: ab Raum 3 wird abgelegt (Grenze inklusiv, danach weiterhin)', () => {
  assert.strictEqual(placeHere(3, 2, 8), true, 'Raum 3 legt ab');
  assert.strictEqual(placeHere(4, 3, 8), true, 'spaeter ebenfalls (Vormerkung traegt)');
  assert.strictEqual(placeHere(8, 7, 8), true);
});

test('#120: RUN_AMULET_MIN_ROOM ist die einzige Quelle der Schwelle', () => {
  const min = globalThis.window.RUN_AMULET_MIN_ROOM;
  assert.strictEqual(min, 3, 'Vorgabe aus #120');
  assert.strictEqual(placeHere(min - 1, 0, 8), false);
  assert.strictEqual(placeHere(min, 5, 8), true);
});

test('#120 Randfall: kurzer Lauf (< 3 Raeume) reicht im LETZTEN Raum nach', () => {
  // Zwei-Raum-Lauf: Raum 3 wird nie erreicht -> ohne Nachreichen stiller Verlust.
  assert.strictEqual(placeHere(1, 0, 2), false, 'Raum 1 noch nicht');
  assert.strictEqual(placeHere(2, 1, 2), true, 'letzter Raum reicht nach');
  // Ein-Raum-Lauf: der einzige Raum IST der letzte.
  assert.strictEqual(placeHere(1, 0, 1), true);
});

test('#120 Randfall: der Nachreich-Zweig feuert nur im letzten Raum', () => {
  assert.strictEqual(placeHere(1, 0, 3), false, 'Index 0 von 3 ist nicht der letzte');
  assert.strictEqual(placeHere(2, 1, 3), false, 'Index 1 von 3 ist nicht der letzte');
});

test('#120 Verdrahtung: Vormerkung ueberlebt Raum 1 und wird ab Raum 3 verbraucht', () => {
  const w = globalThis.window;
  const spawn = w._maybeSpawnRunAmulet;
  w._pendingRunAmulet = { type: 'amulet', effect: 'twin' };
  // Raum 1 (Index 0): zu frueh -> Vormerkung bleibt fuer den naechsten Raum stehen.
  w.runStats = { roomsEntered: 1 };
  spawn(null, 0);
  assert.ok(w._pendingRunAmulet, 'Amulett bleibt vorgemerkt, geht nicht verloren');
  // Raum 2 (Index 1): immer noch zu frueh.
  w.runStats = { roomsEntered: 2 };
  spawn(null, 1);
  assert.ok(w._pendingRunAmulet, 'auch Raum 2 legt noch nicht ab');
  // Raum 3 (Index 2): jetzt wird abgelegt -> Vormerkung verbraucht.
  w.runStats = { roomsEntered: 3 };
  spawn(null, 2);
  assert.strictEqual(w._pendingRunAmulet, null, 'ab Raum 3 verbraucht');
});

test('#120: defensiv gegen unbekannte Raumzahl / kaputte Zaehler', () => {
  assert.strictEqual(placeHere(NaN, 0, NaN), false, 'nichts bekannt -> nicht ablegen');
  assert.strictEqual(placeHere(undefined, undefined, 8), false);
  assert.strictEqual(placeHere(1, 0, 0), false, 'leere Raumliste -> kein Nachreichen');
  // Ein intakter Zaehler genuegt: roomsEntered allein traegt die Entscheidung.
  assert.strictEqual(placeHere(5, NaN, NaN), true);
});
