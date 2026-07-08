// Unit tests for js/roomModeDefend.js (Feature 061 WP03 — DefendMode).
//
// The core is corrupted by the PRESENCE of living enemies (HP drain per
// enemy/sec). Success = wave cleared (onWaveCleared) with the core alive;
// core at 0 = objectiveFailed (but room stays passable). Sprite creation is
// guarded by `scene`, so passing null keeps the logic Phaser-free.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

function fresh() {
  if (!globalThis.window) require('./setup');
  delete globalThis.window.RoomMode;
  delete globalThis.window.player;
  delete globalThis.window.enemies;
  loadGameModule('js/roomModes.js');
  loadGameModule('js/roomModeDefend.js');
  return globalThis.window.RoomMode;
}

function setAlive(n) { globalThis.window.enemies = { countActive: () => n }; }

beforeEach(() => { fresh(); });

test('defend registers itself into RoomMode', () => {
  const R = globalThis.window.RoomMode;
  assert.strictEqual(R.has('defend'), true);
});

test('defend: core drains by living-enemy presence over time', () => {
  const R = globalThis.window.RoomMode;
  const m = R.create('defend'); m.start(null);
  assert.strictEqual(m.getState().hp, 100);
  assert.strictEqual(m.objectiveFailed(), false);
  setAlive(5);
  m.update(1000); // 1s: 5 enemies * 2/s = -10
  assert.strictEqual(m.getState().hp, 90);
  setAlive(0);    // wave being cleared -> no more drain
  m.update(5000);
  assert.strictEqual(m.getState().hp, 90, 'no drain with zero enemies');
});

test('defend: core reaching 0 marks objectiveFailed (room stays passable)', () => {
  const R = globalThis.window.RoomMode;
  const m = R.create('defend'); m.start(null);
  setAlive(6);
  m.update(10000); // 6*2*10 = 120 > 100 -> clamps to 0
  assert.strictEqual(m.getState().hp, 0);
  assert.strictEqual(m.objectiveFailed(), true);
  // Completion is independent of the core: clearing the wave still completes.
  assert.strictEqual(m.isComplete(), false);
  m.onWaveCleared();
  assert.strictEqual(m.isComplete(), true);
});

test('defend: clearing the wave with the core alive is a clean success', () => {
  const R = globalThis.window.RoomMode;
  const m = R.create('defend'); m.start(null);
  setAlive(3);
  m.update(2000); // 3*2*2 = -12 -> 88
  m.onWaveCleared();
  assert.strictEqual(m.isComplete(), true);
  assert.strictEqual(m.objectiveFailed(), false, 'core survived -> success -> bonus chest');
  assert.ok(m.getState().hp > 0);
});
