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
  m.update(1000); // 1s: 4 * 1.5 * (1 + 3*0.2) = 9.6 -> ceil(140.4) = 141
  assert.strictEqual(m.getState().hp, 141);
  setAlive(0);    // keine Gegner -> kein Drain
  m.update(3000);
  assert.strictEqual(m.getState().hp, 141, 'no drain with zero enemies');
});

test('defend: only enemies inside the drain zone damage the altar', () => {
  const R = globalThis.window.RoomMode;
  const m = R.create('defend'); m.start(null); // Altar im Test bei (0,0)
  // 2 Gegner IN der Zone (<=300px), 3 weit draussen -> nur 2 drainen.
  globalThis.window.enemies = { getChildren: () => ([
    { active: true, x: 100, y: 0 }, { active: true, x: 0, y: 150 },
    { active: true, x: 900, y: 0 }, { active: true, x: 0, y: 900 }, { active: true, x: 800, y: 800 }
  ]) };
  m.update(1000); // 2 in Zone (<=190) * 1.5/s = -3
  assert.strictEqual(m.getState().hp, 147);
  assert.strictEqual(m.getState().drainRadius, 190);
});

test('defend: stop() destroys the altar sprite (no leak into next room)', () => {
  const R = globalThis.window.RoomMode;
  let destroyed = false;
  const mockSprite = {
    setDepth() { return this; }, setScrollFactor() { return this; },
    setTint() { return this; }, clearTint() { return this; }, setAlpha() { return this; },
    destroy() { destroyed = true; }
  };
  const scene = {
    textures: { exists: () => true },
    add: { sprite: () => mockSprite },
    physics: { world: { bounds: { centerX: 0, centerY: 0 } } },
    isPointAccessible: () => true
  };
  const m = R.create('defend'); m.start(scene);
  assert.strictEqual(typeof m.stop, 'function');
  m.stop();
  assert.strictEqual(destroyed, true, 'Altar-Sprite beim stop() zerstört');
});

test('defend: more enemies in the zone drain the altar super-linearly', () => {
  const R = globalThis.window.RoomMode;
  const m = R.create('defend'); m.start(null);
  globalThis.window.enemies = { countActive: () => 6 }; // 6 Gegner
  m.update(1000);
  // linear wäre 6*1.5 = 9; mit Eskalation 6*1.5*(1+5*0.2) = 18 -> deutlich mehr.
  assert.strictEqual(m.getState().hp, 132); // ceil(150 - 18)
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
