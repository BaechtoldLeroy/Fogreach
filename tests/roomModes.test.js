// Unit tests for js/roomModes.js (Feature 061 WP01 — Room-Mode-Framework).
//
// roomModes.js attaches window.RoomMode (IIFE). It provides a registry, the
// default `clear` mode (behaviour-identical to today's "clear the wave"), a
// weighted per-room selection (~1-2 special rooms/run, first/boss/espionage
// excluded), and the completion/bonus-chest hooks. WP01 registers ONLY `clear`.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

function fresh() {
  if (!globalThis.window) require('./setup');
  delete globalThis.window.RoomMode;
  loadGameModule('js/roomModes.js');
  return globalThis.window.RoomMode;
}

beforeEach(() => { fresh(); });

test('attaches window.RoomMode with the expected API', () => {
  const R = globalThis.window.RoomMode;
  ['register', 'has', 'create', 'selectForRoom', 'beginRoom', 'updateActive',
   'allowWaveClearUnlock', 'onWaveCleared', 'activeModeId', 'isSpecialRoom',
   'objectiveFailed', 'activeState'].forEach((fn) => {
    assert.strictEqual(typeof R[fn], 'function', `${fn} is a function`);
  });
});

test('clear mode is registered by default; unknown ids fall back to clear', () => {
  const R = globalThis.window.RoomMode;
  assert.strictEqual(R.has('clear'), true);
  assert.strictEqual(R.has('survival'), false); // not registered in WP01
  const inst = R.create('does_not_exist', {});
  assert.ok(inst, 'unknown id yields a fallback instance');
  assert.strictEqual(typeof inst.isComplete, 'function');
});

test('ClearMode: completes only after onWaveCleared, never fails', () => {
  const R = globalThis.window.RoomMode;
  const m = R.create('clear', {});
  m.start();
  assert.strictEqual(m.isComplete(), false);
  m.onWaveCleared();
  assert.strictEqual(m.isComplete(), true);
  assert.strictEqual(m.objectiveFailed(), false);
});

test('selectForRoom: first room, boss room and espionage room are always clear', () => {
  const R = globalThis.window.RoomMode;
  R.register('survival', () => ({})); // a special mode exists
  const always0 = () => 0; // rng that would otherwise pick a special
  assert.strictEqual(R.selectForRoom({ roomIndex: 0, depth: 10 }, always0), 'clear');
  assert.strictEqual(R.selectForRoom({ roomIndex: 3, isBoss: true, depth: 10 }, always0), 'clear');
  assert.strictEqual(R.selectForRoom({ roomIndex: 3, isEspionage: true, depth: 10 }, always0), 'clear');
});

test('selectForRoom: with no special mode registered, always clear', () => {
  const R = globalThis.window.RoomMode;
  const always0 = () => 0;
  for (let i = 1; i < 12; i++) {
    assert.strictEqual(R.selectForRoom({ roomIndex: i, depth: 20 }, always0), 'clear');
  }
});

test('selectForRoom: a registered special CAN be picked on a normal room', () => {
  const R = globalThis.window.RoomMode;
  R.register('survival', () => ({}));
  // rng()<p on the first draw, then picks the (only) special weight -> 'survival'
  assert.strictEqual(R.selectForRoom({ roomIndex: 3, depth: 10 }, () => 0), 'survival');
  // rng()>=p -> clear
  assert.strictEqual(R.selectForRoom({ roomIndex: 3, depth: 10 }, () => 0.99), 'clear');
});

test('selectForRoom distribution: ~1-2 special rooms across a run (loose bound)', () => {
  const R = globalThis.window.RoomMode;
  R.register('survival', () => ({}));
  // Deterministic-ish LCG so the test is stable.
  let s = 12345;
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const RUNS = 400, ROOMS = 9; // rooms 1..9 (room 0 excluded upstream)
  let totalSpecial = 0;
  for (let r = 0; r < RUNS; r++) {
    for (let i = 1; i <= ROOMS; i++) {
      if (R.selectForRoom({ roomIndex: i, depth: 12 }, rng) !== 'clear') totalSpecial++;
    }
  }
  const avg = totalSpecial / RUNS;
  assert.ok(avg > 0.5 && avg < 3.5, `avg special rooms/run should be ~1-2 (got ${avg.toFixed(2)})`);
});

test('beginRoom + lifecycle: clear room reports non-special, allows wave-clear unlock', () => {
  const R = globalThis.window.RoomMode;
  R.beginRoom(null, { roomIndex: 0, depth: 5 });
  assert.strictEqual(R.activeModeId(), 'clear');
  assert.strictEqual(R.isSpecialRoom(), false);
  assert.strictEqual(R.allowWaveClearUnlock(), true);
  assert.strictEqual(R.objectiveFailed(), false);
});

test('beginRoom: a special room suppresses wave-clear unlock and reads as special', () => {
  const R = globalThis.window.RoomMode;
  R.register('survival', () => ({
    start() {}, update() {}, isComplete() { return false; }, objectiveFailed() { return true; }
  }));
  // Stub Math.random so selectForRoom deterministically picks the special.
  const orig = Math.random;
  Math.random = () => 0;
  try {
    R.beginRoom(null, { roomIndex: 3, depth: 10 }); // not first/boss/espionage
  } finally { Math.random = orig; }
  assert.strictEqual(R.activeModeId(), 'survival');
  assert.strictEqual(R.isSpecialRoom(), true);
  assert.strictEqual(R.allowWaveClearUnlock(), false, 'special rooms unlock via their own logic');
  assert.strictEqual(R.objectiveFailed(), true);
});

// ---------------------------------------------------------------------------
// Pause-Uhr: Modus-Timer duerfen bei offenem Inventar nicht weiterlaufen.
// main.js reicht Phasers rohes delta auch waehrend der Pause durch.
// ---------------------------------------------------------------------------

test('updateActive tickt nicht, solange die Pause-Uhr laeuft', () => {
  const R = fresh();
  let ticks = 0;
  R.register('paustest', function () {
    return {
      start: function () {},
      update: function () { ticks++; },
      isComplete: function () { return false; }
    };
  });
  // beginRoom waehlt den Modus selbst; ?mode= erzwingt ihn im ersten Raum.
  const _loc = globalThis.window.location;
  globalThis.window.location = { search: '?mode=paustest' };
  R.beginRoom(null, { roomIndex: 0 });
  globalThis.window.location = _loc;
  assert.strictEqual(R.activeModeId(), 'paustest', 'Test-Modus ist aktiv');

  delete globalThis.window.__GAME_PAUSE;
  R.updateActive(16);
  const baseline = ticks;
  assert.ok(baseline > 0, 'ohne Pause-Objekt wird normal getickt');

  // Inventar auf -> pauseGameClock() setzt `since`
  globalThis.window.__GAME_PAUSE = { offset: 0, since: 1000, _scene: null };
  R.updateActive(16);
  R.updateActive(16);
  R.updateActive(16);
  assert.strictEqual(ticks, baseline, 'waehrend der Pause kein einziger Tick');

  // Inventar zu -> resumeGameClock() raeumt `since` weg
  globalThis.window.__GAME_PAUSE = { offset: 500, since: null, _scene: null };
  R.updateActive(16);
  assert.strictEqual(ticks, baseline + 1, 'nach dem Schliessen laeuft es weiter');
});
