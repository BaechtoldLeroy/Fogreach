// Unit tests for js/espionageSystem.js (Feature 055 — Espionage WP01 skeleton)
//
// EspionageSystem is an IIFE attaching window.EspionageSystem. We load it via
// the shared loader and assert the skeleton API: no-op outside missions,
// disguise toggling only while active, attack drops the disguise (FR-04),
// mission lifecycle resets state. WP03 will fill in detection/observe logic.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

function fresh() {
  if (!globalThis.window) require('./setup');
  delete globalThis.window.EspionageSystem;
  // Reset shared stubs so cases don't bleed into each other.
  delete globalThis.window.player;
  delete globalThis.window.questSystem;
  loadGameModule('js/espionageSystem.js');
  return globalThis.window.EspionageSystem;
}

// Minimal player stub with tint tracking (tint = visual disguise, no asset).
function stubPlayer(x, y) {
  const p = {
    x: x || 0,
    y: y || 0,
    tint: null,
    setTint(t) { this.tint = t; },
    clearTint() { this.tint = null; }
  };
  globalThis.window.player = p;
  return p;
}

// questSystem stub capturing updateQuestProgress calls.
function stubQuestSystem() {
  const calls = [];
  globalThis.window.questSystem = {
    updateQuestProgress(type, target, amount) { calls.push([type, target, amount]); }
  };
  return calls;
}

// Drive the throttled update past the 100ms gate by `ms` total, in one tick.
function tick(E, ms) {
  E.update(null, 0, ms);
}

beforeEach(() => { fresh(); });

test('attaches window.EspionageSystem with skeleton API', () => {
  const E = globalThis.window.EspionageSystem;
  assert.ok(E, 'EspionageSystem present');
  ['startMission', 'endMission', 'isActive', 'setDisguise', 'isDisguised',
   'onPlayerAttack', 'isDetected', 'getDetection', 'registerObserveZone', 'update']
    .forEach((fn) => assert.strictEqual(typeof E[fn], 'function', `${fn} is a function`));
});

test('defaults are inert (no active mission)', () => {
  const E = globalThis.window.EspionageSystem;
  assert.strictEqual(E.isActive(), false);
  assert.strictEqual(E.isDisguised(), false);
  assert.strictEqual(E.isDetected(), false);
  assert.strictEqual(E.getDetection(), 0);
});

test('disguise + attack are no-op outside a mission', () => {
  const E = globalThis.window.EspionageSystem;
  assert.strictEqual(E.setDisguise(true), false, 'cannot disguise without mission');
  assert.strictEqual(E.isDisguised(), false);
  assert.strictEqual(E.onPlayerAttack(), false, 'attack no-op without mission');
});

test('startMission activates; setDisguise works only while active', () => {
  const E = globalThis.window.EspionageSystem;
  E.startMission(null, { missionId: 'espionage_convoy' });
  assert.strictEqual(E.isActive(), true);
  assert.strictEqual(E.setDisguise(true), true);
  assert.strictEqual(E.isDisguised(), true);
});

test('attack drops the disguise and raises detection (FR-04)', () => {
  const E = globalThis.window.EspionageSystem;
  E.startMission(null, { missionId: 'espionage_archive' });
  E.setDisguise(true);
  const dropped = E.onPlayerAttack();
  assert.strictEqual(dropped, true);
  assert.strictEqual(E.isDisguised(), false, 'disguise fell on attack');
  assert.ok(E.getDetection() > 0, 'detection rose on attack');
});

test('endMission resets state to inert', () => {
  const E = globalThis.window.EspionageSystem;
  E.startMission(null, { missionId: 'm' });
  E.setDisguise(true);
  E.endMission();
  assert.strictEqual(E.isActive(), false);
  assert.strictEqual(E.isDisguised(), false);
  assert.strictEqual(E.getDetection(), 0);
});

test('update() is safe to call when inactive', () => {
  const E = globalThis.window.EspionageSystem;
  assert.doesNotThrow(() => E.update(null, 0, 16));
});

// --- WP03: disguise visual (tint) ------------------------------------------
test('setDisguise applies a tint and clearing restores it (FR-04 visual)', () => {
  const E = globalThis.window.EspionageSystem;
  const p = stubPlayer(0, 0);
  E.startMission(null, { missionId: 'm' });
  E.setDisguise(true);
  assert.strictEqual(p.tint, 0x8899cc, 'disguise tinted the player');
  E.setDisguise(false);
  assert.strictEqual(p.tint, null, 'clearing disguise cleared the tint');
});

test('onPlayerAttack drops the disguise tint and spikes detection', () => {
  const E = globalThis.window.EspionageSystem;
  const p = stubPlayer(0, 0);
  E.startMission(null, { missionId: 'm' });
  E.setDisguise(true);
  assert.strictEqual(p.tint, 0x8899cc);
  E.onPlayerAttack();
  assert.strictEqual(p.tint, null, 'attack cleared the disguise tint');
  assert.ok(E.getDetection() >= 0.5, 'attack spiked detection');
});

// --- WP03: detection rise / decay -----------------------------------------
test('detection rises when an in-range guard sees an undisguised player', () => {
  const E = globalThis.window.EspionageSystem;
  stubPlayer(100, 100);
  E.startMission(null, { missionId: 'm', guards: [{ x: 100, y: 100, range: 150 }] });
  const before = E.getDetection();
  tick(E, 500); // half a second in sight
  assert.ok(E.getDetection() > before, 'detection rose under guard sight');
});

test('detection decays when no guard sees the player', () => {
  const E = globalThis.window.EspionageSystem;
  stubPlayer(100, 100);
  E.startMission(null, { missionId: 'm', guards: [{ x: 1000, y: 1000, range: 80 }] });
  // First raise detection via an attack spike...
  E.onPlayerAttack();
  const raised = E.getDetection();
  assert.ok(raised > 0);
  tick(E, 500); // out of range -> should decay
  assert.ok(E.getDetection() < raised, 'detection decayed out of sight');
});

test('normal (blue) guards never expose a disguised player — even point-blank (#54)', () => {
  const E = globalThis.window.EspionageSystem;
  // A NORMAL guard (alert:false). Even standing right on top of it, the
  // disguise holds: only alert (red) guards see through it.
  stubPlayer(100, 100); // point-blank -> max cone intensity
  E.startMission(null, { missionId: 'm', guards: [{ x: 100, y: 100, range: 150, facing: 0, scanArc: 0, alert: false }] });
  E.setDisguise(true);
  tick(E, 1500);
  assert.strictEqual(E.getDetection(), 0, 'blue guard never raises suspicion against the disguise');
});

test('alert guard sees through the disguise; a normal guard at the same spot does not (#54)', () => {
  // Normal guard: disguised player in a LOW-intensity cone (below tolerance)
  // stays unseen.
  const E = globalThis.window.EspionageSystem;
  stubPlayer(220, 100); // dist 120 in a range-150 cone -> intensity ~0.2 (< 0.5)
  E.startMission(null, { missionId: 'm', guards: [{ x: 100, y: 100, range: 150, facing: 0, scanArc: 0, alert: false }] });
  E.setDisguise(true);
  tick(E, 1000);
  assert.strictEqual(E.getDetection(), 0, 'normal guard ignores the disguised player at low intensity');

  // Alert guard at the EXACT same geometry: detection rises despite disguise.
  fresh();
  const E2 = globalThis.window.EspionageSystem;
  stubPlayer(220, 100);
  E2.startMission(null, { missionId: 'm', guards: [{ x: 100, y: 100, range: 150, facing: 0, scanArc: 0, alert: true }] });
  E2.setDisguise(true);
  tick(E2, 1000);
  assert.ok(E2.getDetection() > 0, 'alert guard raises suspicion even against the disguise');
});

test('attackGuards downs a guard after enough hits and removes it as a threat (#54)', () => {
  const E = globalThis.window.EspionageSystem;
  stubPlayer(100, 100);
  E.startMission(null, { missionId: 'm', guards: [{ x: 130, y: 100, range: 150, facing: 0, alert: true, hp: 2 }] });
  // Swing toward +x (the guard is 30px to the right).
  assert.strictEqual(E.attackGuards(100, 100, 1, 0, 120), 1, 'first swing hits the guard');
  assert.strictEqual(E.attackGuards(100, 100, 1, 0, 120), 1, 'second swing hits the guard');
  assert.strictEqual(E.getState().guards[0].knocked, true, 'guard down after 2 hits');
  assert.strictEqual(E.attackGuards(100, 100, 1, 0, 120), 0, 'a downed guard is no longer hit');
  // A guard behind the swing direction is not hit.
  fresh();
  const E2 = globalThis.window.EspionageSystem;
  stubPlayer(100, 100);
  E2.startMission(null, { missionId: 'm', guards: [{ x: 60, y: 100, range: 150, facing: 0, alert: true, hp: 3 }] });
  assert.strictEqual(E2.attackGuards(100, 100, 1, 0, 120), 0, 'guard behind the swing is missed');
});

test('disguise returns automatically after combat once things calm down (#54)', () => {
  const E = globalThis.window.EspionageSystem;
  stubPlayer(100, 100);
  // A lone alert guard parked far away -> nothing sees the player, none hostile.
  E.startMission(null, { missionId: 'm', guards: [{ x: 2000, y: 2000, range: 80, alert: true }] });
  E.setDisguise(true);
  assert.strictEqual(E.isDisguised(), true);
  E.onPlayerAttack();                 // going loud drops the disguise
  assert.strictEqual(E.isDisguised(), false, 'disguise dropped on attack');
  for (let i = 0; i < 6; i++) tick(E, 500); // suspicion decays -> re-blend
  assert.strictEqual(E.isDisguised(), true, 're-blended into disguise once calm');
});

test('hostile guard slides along walls instead of walking through them (#54)', () => {
  const E = globalThis.window.EspionageSystem;
  stubPlayer(300, 100);
  const blockedAt = (wx) => (wx >= 200 && wx < 232); // vertical wall band
  E.startMission(null, { missionId: 'm', guards: [{ x: 150, y: 100, range: 300, facing: 0, scanArc: 0, alert: true }], blockedAt });
  E.getState().guards[0].hostile = true; // provoked (independent of line of sight)
  for (let i = 0; i < 30; i++) tick(E, 100); // chases toward player, hits the wall
  const g = E.getState().guards[0];
  assert.ok(g.x < 200, `guard stopped before the wall (x=${g.x.toFixed(1)})`);
});

test('exposure only aggros nearby guards; distant ones keep patrolling (#54)', () => {
  const E = globalThis.window.EspionageSystem;
  stubPlayer(100, 100);
  E.startMission(null, { missionId: 'm', guards: [
    { x: 130, y: 100, range: 150, alert: true },    // near the player
    { x: 3000, y: 3000, range: 150, alert: true }   // far away
  ] });
  E.onPlayerAttack(); E.onPlayerAttack();            // force exposure
  assert.strictEqual(E.isDetected(), true);
  const gs = E.getState().guards;
  assert.strictEqual(gs[0].hostile, true, 'near guard aggroed on exposure');
  assert.strictEqual(gs[1].hostile, false, 'distant guard keeps patrolling');
});

test('a wall between guard and player blocks the vision cone (line of sight) (#54)', () => {
  const E = globalThis.window.EspionageSystem;
  stubPlayer(300, 100); // straight ahead of a guard facing +x, well in range
  const blockedAt = (wx) => (wx >= 190 && wx < 210); // wall band between them
  E.startMission(null, { missionId: 'm', guards: [{ x: 100, y: 100, range: 400, facing: 0, scanArc: 0, alert: true }], blockedAt });
  tick(E, 1500);
  assert.strictEqual(E.getDetection(), 0, 'wall blocks line of sight -> no detection');

  // Control: same geometry, no wall -> the guard sees the player.
  fresh();
  const E2 = globalThis.window.EspionageSystem;
  stubPlayer(300, 100);
  E2.startMission(null, { missionId: 'm', guards: [{ x: 100, y: 100, range: 400, facing: 0, scanArc: 0, alert: true }] });
  tick(E2, 1500);
  assert.ok(E2.getDetection() > 0, 'no wall -> guard detects the player');
});

test('cover zone suppresses detection inside guard range', () => {
  const E = globalThis.window.EspionageSystem;
  stubPlayer(100, 100);
  E.startMission(null, {
    missionId: 'm',
    guards: [{ x: 100, y: 100, range: 150 }],
    cover: [{ x: 50, y: 50, w: 100, h: 100 }] // player (100,100) is inside
  });
  tick(E, 1000);
  assert.strictEqual(E.getDetection(), 0, 'covered player not detected');
});

// --- WP03: exposed threshold (consequence, not insta-fail C-04) ------------
test('detection reaching 1.0 sets exposed=true', () => {
  const E = globalThis.window.EspionageSystem;
  stubPlayer(100, 100);
  E.startMission(null, { missionId: 'm', guards: [{ x: 100, y: 100, range: 150 }] });
  assert.strictEqual(E.isDetected(), false);
  tick(E, 5000); // long enough for slow rise to cross 1.0
  assert.ok(E.getDetection() >= 1, 'detection reached cap');
  assert.strictEqual(E.isDetected(), true, 'exposed once detection >= 1');
});

// --- WP03: info-gathering observe zones (FR-06) ----------------------------
test('observe zone fires updateQuestProgress(observe, target, 1) exactly once', () => {
  const E = globalThis.window.EspionageSystem;
  stubPlayer(200, 200);
  const calls = stubQuestSystem();
  E.startMission(null, {
    missionId: 'm',
    observeZones: [{ id: 'convoy_talk', x: 200, y: 200, r: 64, seconds: 4, questTarget: 'convoy_talk' }]
  });
  // Stay in the zone long past the 4s requirement, across several ticks.
  for (let i = 0; i < 10; i++) tick(E, 1000);
  const observeCalls = calls.filter(c => c[0] === 'observe' && c[1] === 'convoy_talk');
  assert.strictEqual(observeCalls.length, 1, 'observe fired exactly once');
  assert.deepStrictEqual(observeCalls[0], ['observe', 'convoy_talk', 1]);
});

test('observe zone does NOT fire if the player leaves before the time', () => {
  const E = globalThis.window.EspionageSystem;
  const p = stubPlayer(200, 200);
  const calls = stubQuestSystem();
  E.startMission(null, {
    missionId: 'm',
    observeZones: [{ id: 'z', x: 200, y: 200, r: 64, seconds: 4, questTarget: 'z' }]
  });
  tick(E, 1000); // 1s inside
  p.x = 9999;    // walk away
  tick(E, 5000);
  assert.strictEqual(calls.filter(c => c[0] === 'observe').length, 0, 'no observe fired');
});

test('observe does not progress while exposed', () => {
  const E = globalThis.window.EspionageSystem;
  stubPlayer(200, 200);
  const calls = stubQuestSystem();
  E.startMission(null, {
    missionId: 'm',
    guards: [{ x: 200, y: 200, range: 150 }],
    observeZones: [{ id: 'z', x: 200, y: 200, r: 64, seconds: 1, questTarget: 'z' }]
  });
  // Force exposure first.
  E.onPlayerAttack();
  E.onPlayerAttack();
  assert.strictEqual(E.isDetected(), true);
  for (let i = 0; i < 5; i++) tick(E, 1000);
  assert.strictEqual(calls.filter(c => c[0] === 'observe').length, 0, 'no observe while exposed');
});

test('exposed is recoverable: breaking sight re-blends the disguise', () => {
  const E = globalThis.window.EspionageSystem;
  const p = stubPlayer(100, 100);
  E.startMission(null, { missionId: 'm', guards: [{ x: 100, y: 100, range: 150 }] });
  // Force exposure by lingering in sight.
  tick(E, 5000);
  assert.strictEqual(E.isDetected(), true, 'exposed after lingering in guard sight');
  assert.strictEqual(E.isDisguised(), false, 'disguise dropped on exposure');
  // Break line of sight — walk far out of every guard range.
  p.x = 5000; p.y = 5000;
  for (let i = 0; i < 4; i++) tick(E, 1000); // suspicion decays to 0 -> re-blend
  assert.strictEqual(E.isDetected(), false, 'no longer exposed after escaping sight');
  assert.strictEqual(E.isDisguised(), true, 're-blended into disguise');
  assert.strictEqual(E.getDetection(), 0, 'suspicion fully decayed');
});

test('exposed stays exposed while still in guard sight (no premature re-blend)', () => {
  const E = globalThis.window.EspionageSystem;
  stubPlayer(100, 100);
  E.startMission(null, { missionId: 'm', guards: [{ x: 100, y: 100, range: 150 }] });
  tick(E, 5000);
  assert.strictEqual(E.isDetected(), true);
  // Stay put inside the guard range — must remain exposed.
  for (let i = 0; i < 5; i++) tick(E, 1000);
  assert.strictEqual(E.isDetected(), true, 'still exposed while in sight');
  assert.strictEqual(E.isDisguised(), false, 'no re-blend while seen');
});

test('update is throttled: a sub-100ms tick does not advance detection', () => {
  const E = globalThis.window.EspionageSystem;
  stubPlayer(100, 100);
  E.startMission(null, { missionId: 'm', guards: [{ x: 100, y: 100, range: 150 }] });
  tick(E, 50); // below the 100ms gate
  assert.strictEqual(E.getDetection(), 0, 'throttled tick is a no-op for detection');
});
