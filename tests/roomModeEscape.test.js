// Unit tests for js/roomModeEscape.js (Feature 061 WP06 — EscapeMode).
// A short, dense timed gauntlet; completes when the timer hits 0, never fails.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

function fresh() {
  if (!globalThis.window) require('./setup');
  delete globalThis.window.RoomMode;
  delete globalThis.window.DUNGEON_DEPTH;
  loadGameModule('js/roomModes.js');
  loadGameModule('js/roomModeEscape.js');
  return globalThis.window.RoomMode;
}

beforeEach(() => { fresh(); });

test('escape registers itself into RoomMode', () => {
  assert.strictEqual(globalThis.window.RoomMode.has('escape'), true);
});

test('escape: shorter duration than survival, scales with depth', () => {
  const R = globalThis.window.RoomMode;
  globalThis.window.DUNGEON_DEPTH = 10;
  const m = R.create('escape'); m.start(null);
  assert.strictEqual(m.getState().duration, 21); // 18 + min(12, 10*0.3=3)
});

test('escape: timer counts down, completes at 0, never fails', () => {
  const R = globalThis.window.RoomMode;
  globalThis.window.DUNGEON_DEPTH = 10; // 21s
  const m = R.create('escape'); m.start(null);
  assert.strictEqual(m.isComplete(), false);
  m.update(10000);
  assert.strictEqual(m.isComplete(), false);
  m.update(12000); // total 22 > 21
  assert.strictEqual(m.isComplete(), true);
  assert.strictEqual(m.objectiveFailed(), false);
});
