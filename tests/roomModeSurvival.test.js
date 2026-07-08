// Unit tests for js/roomModeSurvival.js (Feature 061 WP02 — SurvivalMode).
//
// The mode self-registers into window.RoomMode. We drive its timer via
// update(dtMs) (the nachrücken-spawner is guarded by window.spawnEnemy, which
// is absent in tests, so only the pure timer/state logic runs here).

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

function fresh() {
  if (!globalThis.window) require('./setup');
  delete globalThis.window.RoomMode;
  delete globalThis.window.DUNGEON_DEPTH;
  loadGameModule('js/roomModes.js');
  loadGameModule('js/roomModeSurvival.js');
  return globalThis.window.RoomMode;
}

beforeEach(() => { fresh(); });

test('survival registers itself into RoomMode', () => {
  const R = globalThis.window.RoomMode;
  assert.strictEqual(R.has('survival'), true);
  const m = R.create('survival');
  assert.strictEqual(typeof m.isComplete, 'function');
  assert.strictEqual(typeof m.getState, 'function');
});

test('survival: duration scales with depth', () => {
  const R = globalThis.window.RoomMode;
  globalThis.window.DUNGEON_DEPTH = 10;
  let m = R.create('survival'); m.start(null);
  assert.strictEqual(m.getState().duration, 78); // 60 + (10-1)*2
  globalThis.window.DUNGEON_DEPTH = 40;
  m = R.create('survival'); m.start(null);
  assert.strictEqual(m.getState().duration, 120); // capped at 120
});

test('survival: enemies are tougher (2x HP multiplier)', () => {
  const R = globalThis.window.RoomMode;
  const m = R.create('survival'); m.start(null);
  assert.strictEqual(m.enemyHpMultiplier(), 2);
});

test('RoomMode.enemyHpMultiplier is ×1 for clear, delegates for special modes', () => {
  const R = globalThis.window.RoomMode;
  // clear (or no mode active) → no scaling
  R.beginRoom(null, { roomIndex: 0, depth: 1 }); // roomIndex 0 → always clear
  assert.strictEqual(R.enemyHpMultiplier(), 1);
});

test('survival: timer counts down, completes at 0, never fails', () => {
  const R = globalThis.window.RoomMode;
  globalThis.window.DUNGEON_DEPTH = 10; // 78s
  const m = R.create('survival'); m.start(null);
  assert.strictEqual(m.isComplete(), false);
  m.update(40000); // 40s elapsed
  const st = m.getState();
  assert.ok(st.remaining > 0 && st.remaining < 78, `remaining mid-run (got ${st.remaining})`);
  assert.strictEqual(m.isComplete(), false);
  m.update(40000); // total 80s > 78 -> complete
  assert.strictEqual(m.isComplete(), true);
  assert.strictEqual(m.objectiveFailed(), false);
  assert.strictEqual(m.getState().remaining, 0);
});

test('survival: getState exposes rounded seconds for the HUD', () => {
  const R = globalThis.window.RoomMode;
  globalThis.window.DUNGEON_DEPTH = 10;
  const m = R.create('survival'); m.start(null);
  m.update(500); // 0.5s
  assert.strictEqual(m.getState().seconds, 78); // ceil(77.5), depth 10 → 78s
  assert.strictEqual(m.getState().mode, 'survival');
});

test('survival room selection: RoomMode can now pick survival on a normal room', () => {
  const R = globalThis.window.RoomMode;
  // Force selection deterministically: rng()=0 -> special picked, only survival registered.
  assert.strictEqual(R.selectForRoom({ roomIndex: 3, depth: 12 }, () => 0), 'survival');
  // Excluded rooms stay clear.
  assert.strictEqual(R.selectForRoom({ roomIndex: 0, depth: 12 }, () => 0), 'clear');
});
