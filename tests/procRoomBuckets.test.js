// Unit tests for Feature 056 (#43) — Proc-room SIZE buckets.
//
// The weighted size-bucket logic lives in js/proceduralRooms.js (a pure,
// load-able IIFE) rather than js/roomManager.js (which needs Phaser globals at
// load time and can't be unit-loaded). roomManager only WIRES these helpers in.
//
// Covered:
//   - weightedPick honours the [20,60,20] distribution
//   - rollBucket: ~20/60/20 bucket distribution + dims within each bucket range
//   - pickProcStyle: both 'cave' and 'bsp' appear for every bucket (FR-02)
//   - rollBucket defaults to Math.random when no rng passed

const { test } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

function freshModule() {
  if (globalThis.window) delete globalThis.window.ProceduralRooms;
  loadGameModule('js/proceduralRooms.js');
  return globalThis.window.ProceduralRooms;
}

test('weightedPick honours the weight distribution (~20/60/20)', () => {
  const PR = freshModule();
  assert.strictEqual(typeof PR.weightedPick, 'function', 'weightedPick must be exported');
  const rng = PR.mulberry32(12345);
  const N = 6000;
  const counts = [0, 0, 0];
  for (let i = 0; i < N; i++) counts[PR.weightedPick(rng, [20, 60, 20])]++;
  const pct = counts.map((c) => (c / N) * 100);
  assert.ok(Math.abs(pct[0] - 20) <= 4, `index0 ~20%, got ${pct[0].toFixed(1)}`);
  assert.ok(Math.abs(pct[1] - 60) <= 4, `index1 ~60%, got ${pct[1].toFixed(1)}`);
  assert.ok(Math.abs(pct[2] - 20) <= 4, `index2 ~20%, got ${pct[2].toFixed(1)}`);
});

test('rollBucket: ~20/60/20 distribution and dims within bucket range', () => {
  const PR = freshModule();
  assert.strictEqual(typeof PR.rollBucket, 'function', 'rollBucket must be exported');
  assert.ok(Array.isArray(PR.SIZE_BUCKETS) && PR.SIZE_BUCKETS.length === 3, 'SIZE_BUCKETS has 3 entries');
  const byKey = {};
  PR.SIZE_BUCKETS.forEach((b) => { byKey[b.key] = b; });
  const rng = PR.mulberry32(999);
  const N = 6000;
  const counts = { small: 0, medium: 0, large: 0 };
  for (let i = 0; i < N; i++) {
    const r = PR.rollBucket(rng);
    const b = byKey[r.key];
    assert.ok(b, 'rollBucket returns a known bucket key, got: ' + r.key);
    counts[r.key]++;
    assert.ok(r.width >= b.w[0] && r.width <= b.w[1], `${r.key} width ${r.width} in [${b.w[0]},${b.w[1]}]`);
    assert.ok(r.height >= b.h[0] && r.height <= b.h[1], `${r.key} height ${r.height} in [${b.h[0]},${b.h[1]}]`);
  }
  assert.ok(Math.abs((counts.small / N) * 100 - 20) <= 4, `small ~20%, got ${((counts.small / N) * 100).toFixed(1)}`);
  assert.ok(Math.abs((counts.medium / N) * 100 - 60) <= 4, `medium ~60%, got ${((counts.medium / N) * 100).toFixed(1)}`);
  assert.ok(Math.abs((counts.large / N) * 100 - 20) <= 4, `large ~20%, got ${((counts.large / N) * 100).toFixed(1)}`);
});

test('pickProcStyle yields BOTH cave and bsp for every bucket (FR-02)', () => {
  const PR = freshModule();
  assert.strictEqual(typeof PR.pickProcStyle, 'function', 'pickProcStyle must be exported');
  const rng = PR.mulberry32(7);
  for (const key of ['small', 'medium', 'large']) {
    const seen = new Set();
    for (let i = 0; i < 400; i++) seen.add(PR.pickProcStyle(rng, key));
    assert.ok(seen.has('cave'), `${key} bucket must be able to roll cave`);
    assert.ok(seen.has('bsp'), `${key} bucket must be able to roll bsp`);
  }
});

test('rollBucket defaults to Math.random when no rng is passed (no throw)', () => {
  const PR = freshModule();
  const r = PR.rollBucket();
  assert.ok(r && typeof r.width === 'number' && typeof r.height === 'number', 'returns numeric dims');
});
