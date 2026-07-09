// Unit tests for js/roomModeDefend.js (Feature 061 WP03 — DefendMode).
//
// Zeit-basiert: der Altar wird durch die PRÄSENZ lebender Gegner korrumpiert
// (HP-Drain pro Gegner/Sek). Überstehe die Ansturm-Dauer mit lebendem Altar =
// Erfolg; Altar bei 0 = objectiveFailed (Raum öffnet trotzdem). Sprite-/Spawn-
// Pfade sind durch `scene`/window.spawnEnemy geguardet, daher hier Phaser-frei.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

function fresh() {
  if (!globalThis.window) require('./setup');
  delete globalThis.window.RoomMode;
  delete globalThis.window.player;
  delete globalThis.window.enemies;
  delete globalThis.window.spawnEnemy;
  delete globalThis.window.DUNGEON_DEPTH;
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

test('defend: altar drains by living-enemy presence over time', () => {
  const R = globalThis.window.RoomMode;
  const m = R.create('defend'); m.start(null);
  assert.strictEqual(m.getState().hp, 150);
  assert.strictEqual(m.objectiveFailed(), false);
  setAlive(4);
  m.update(1000); // 1s: 4 Gegner * 1.5/s = -6
  assert.strictEqual(m.getState().hp, 144);
  setAlive(0);    // keine Gegner -> kein Drain
  m.update(3000);
  assert.strictEqual(m.getState().hp, 144, 'no drain with zero enemies');
});

test('defend: altar reaching 0 -> objectiveFailed AND completes (room opens)', () => {
  const R = globalThis.window.RoomMode;
  const m = R.create('defend'); m.start(null);
  setAlive(10);
  m.update(20000); // 10*1.5*20 = 300 > 150 -> clamp 0
  assert.strictEqual(m.getState().hp, 0);
  assert.strictEqual(m.objectiveFailed(), true);
  assert.strictEqual(m.isComplete(), true, 'gefallener Altar öffnet den Raum (Fehlschlag)');
});

test('defend: surviving the onslaught with the altar alive is a clean success', () => {
  const R = globalThis.window.RoomMode;
  globalThis.window.DUNGEON_DEPTH = 1; // 30s Ansturm
  const m = R.create('defend'); m.start(null);
  setAlive(1); // leichter Druck: 1*1.5*30 = 45 Drain -> Altar überlebt (150->105)
  assert.strictEqual(m.isComplete(), false);
  m.update(30000); // Timer abgelaufen
  assert.strictEqual(m.isComplete(), true);
  assert.strictEqual(m.objectiveFailed(), false, 'Altar überlebt -> Erfolg -> Bonus-Truhe');
  assert.ok(m.getState().hp > 0);
});
