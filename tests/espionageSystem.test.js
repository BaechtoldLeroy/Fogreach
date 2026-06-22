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
  loadGameModule('js/espionageSystem.js');
  return globalThis.window.EspionageSystem;
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
