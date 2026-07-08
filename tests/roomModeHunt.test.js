// Unit tests for js/roomModeHunt.js (Feature 061 WP04 — HuntMode).
//
// The mode marks one target (preferring an elite) from window.enemies once the
// wave has spawned, and completes when that target dies. We stub window.enemies
// + window.EliteEnemies so the logic runs Phaser-free.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

function fresh() {
  if (!globalThis.window) require('./setup');
  delete globalThis.window.RoomMode;
  delete globalThis.window.enemies;
  delete globalThis.window.EliteEnemies;
  loadGameModule('js/roomModes.js');
  loadGameModule('js/roomModeHunt.js');
  return globalThis.window.RoomMode;
}

function group(list) { return { getChildren: () => list }; }
function stubElitePicker() {
  globalThis.window.EliteEnemies = {
    pickHuntTarget: (grp) => {
      const l = grp.getChildren();
      return l.find((e) => e.active && e.isElite) || l.find((e) => e.active) || null;
    }
  };
}

beforeEach(() => { fresh(); });

test('hunt registers itself into RoomMode', () => {
  assert.strictEqual(globalThis.window.RoomMode.has('hunt'), true);
});

test('hunt: picks a target once enemies exist, prefers an elite, marks it', () => {
  const R = globalThis.window.RoomMode;
  stubElitePicker();
  const trash = { active: true, isElite: false, x: 10, y: 10 };
  const elite = { active: true, isElite: true, x: 50, y: 60 };
  globalThis.window.enemies = group([trash, elite]);
  const m = R.create('hunt'); m.start();
  assert.strictEqual(m.getState().picked, false); // not picked before first update
  m.update();
  assert.strictEqual(m.getState().picked, true);
  assert.strictEqual(elite.__huntTarget, true, 'the elite is flagged as the hunt target');
  assert.strictEqual(m.getState().targetAlive, true);
  assert.strictEqual(m.isComplete(), false);
});

test('hunt: completes when the target dies, regardless of remaining trash', () => {
  const R = globalThis.window.RoomMode;
  stubElitePicker();
  const trash = { active: true, isElite: false };
  const elite = { active: true, isElite: true };
  globalThis.window.enemies = group([trash, elite]);
  const m = R.create('hunt'); m.start();
  m.update();
  assert.strictEqual(m.isComplete(), false);
  elite.active = false; // player killed the target
  assert.strictEqual(m.isComplete(), true, 'target dead -> complete even with trash alive');
  assert.strictEqual(trash.active, true);
  assert.strictEqual(m.objectiveFailed(), false);
});

test('hunt: falls back to wave-clear if no target could be picked', () => {
  const R = globalThis.window.RoomMode;
  globalThis.window.enemies = group([]); // never any enemies to pick
  const m = R.create('hunt'); m.start();
  m.update();
  assert.strictEqual(m.getState().picked, false);
  assert.strictEqual(m.isComplete(), false);
  m.onWaveCleared();
  assert.strictEqual(m.isComplete(), true);
});
