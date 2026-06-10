// Unit tests for js/renderQuality.js
//
// RenderQuality is an IIFE attaching window.RenderQuality. We rebuild the
// global between tests by re-loading the module and resetting mocked
// matchMedia / navigator / devicePixelRatio.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

function reloadModule(opts) {
  // Reset window state used by isMobile / getDPR
  delete globalThis.window.RenderQuality;
  globalThis.window.matchMedia = opts && opts.matchMedia ? opts.matchMedia : null;
  globalThis.window.navigator = { userAgent: (opts && opts.ua) || '' };
  globalThis.window.devicePixelRatio = (opts && typeof opts.dpr === 'number') ? opts.dpr : 1;
  loadGameModule('js/renderQuality.js');
  return globalThis.window.RenderQuality;
}

function makeScene(textureKeys, opts) {
  const setFilterCalls = {};
  const list = {};
  textureKeys.forEach((key) => {
    list[key] = {
      key: key,
      setFilter: function (mode) {
        setFilterCalls[key] = mode;
      }
    };
  });
  // Sentinel for missing-key lookups (matches Phaser TextureManager behavior)
  const missing = { key: '__MISSING', setFilter: function () {} };
  return {
    _setFilterCalls: setFilterCalls,
    textures: {
      list: list,
      get: function (key) {
        if (Object.prototype.hasOwnProperty.call(list, key)) return list[key];
        return missing;
      }
    }
  };
}

test('isMobile: pointer-coarse match returns true', () => {
  const RQ = reloadModule({
    matchMedia: () => ({ matches: true })
  });
  assert.strictEqual(RQ.isMobile(), true);
});

test('isMobile: UA Android returns true even without matchMedia', () => {
  const RQ = reloadModule({
    matchMedia: null,
    ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/124.0.0.0'
  });
  assert.strictEqual(RQ.isMobile(), true);
});

test('isMobile: UA iPhone returns true', () => {
  const RQ = reloadModule({
    matchMedia: null,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari'
  });
  assert.strictEqual(RQ.isMobile(), true);
});

test('isMobile: Desktop Chrome returns false', () => {
  const RQ = reloadModule({
    matchMedia: () => ({ matches: false }),
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0'
  });
  assert.strictEqual(RQ.isMobile(), false);
});

test('isMobile: missing matchMedia + desktop UA returns false', () => {
  const RQ = reloadModule({
    matchMedia: null,
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari'
  });
  assert.strictEqual(RQ.isMobile(), false);
});

test('getDPR: returns devicePixelRatio when ≤ MAX_DPR', () => {
  const RQ = reloadModule({ dpr: 1.5 });
  assert.strictEqual(RQ.getDPR(), 1.5);
});

test('getDPR: caps at MAX_DPR (2)', () => {
  const RQ = reloadModule({ dpr: 3 });
  assert.strictEqual(RQ.getDPR(), 2);
});

test('getDPR: returns 1 for invalid input', () => {
  const RQ = reloadModule({ dpr: 0 });
  assert.strictEqual(RQ.getDPR(), 1);
});

test('getDPR: returns 1 when devicePixelRatio is NaN/undefined', () => {
  const RQ = reloadModule({ dpr: NaN });
  assert.strictEqual(RQ.getDPR(), 1);
});

test('applyLinearFilter: filters existing keys, skips missing', () => {
  const RQ = reloadModule({});
  const scene = makeScene(['hubscene_bg', 'mara']);
  const count = RQ.applyLinearFilter(scene, ['hubscene_bg', 'mara', 'nonexistent']);
  assert.strictEqual(count, 2);
  assert.ok(scene._setFilterCalls.hubscene_bg !== undefined);
  assert.ok(scene._setFilterCalls.mara !== undefined);
  assert.strictEqual(scene._setFilterCalls.nonexistent, undefined);
});

test('applyLinearFilter: returns 0 on empty/invalid input', () => {
  const RQ = reloadModule({});
  const scene = makeScene([]);
  assert.strictEqual(RQ.applyLinearFilter(scene, []), 0);
  assert.strictEqual(RQ.applyLinearFilter(scene, null), 0);
  assert.strictEqual(RQ.applyLinearFilter(scene, undefined), 0);
});

test('applyLinearFilter: handles missing scene/textures gracefully', () => {
  const RQ = reloadModule({});
  assert.strictEqual(RQ.applyLinearFilter(null, ['x']), 0);
  assert.strictEqual(RQ.applyLinearFilter({}, ['x']), 0);
  assert.strictEqual(RQ.applyLinearFilter({ textures: {} }, ['x']), 0);
});

test('applyLinearFilterByPrefix: matches by prefix and applies', () => {
  const RQ = reloadModule({});
  const scene = makeScene([
    'brute_left0', 'brute_right1',
    'imp_left0',
    'hubscene_bg',
    'aldric_left0'
  ]);
  const count = RQ.applyLinearFilterByPrefix(scene, ['brute_', 'imp_']);
  assert.strictEqual(count, 3);
  assert.ok(scene._setFilterCalls.brute_left0 !== undefined);
  assert.ok(scene._setFilterCalls.brute_right1 !== undefined);
  assert.ok(scene._setFilterCalls.imp_left0 !== undefined);
  // Non-matched stay untouched
  assert.strictEqual(scene._setFilterCalls.hubscene_bg, undefined);
  assert.strictEqual(scene._setFilterCalls.aldric_left0, undefined);
});

test('applyLinearFilterByPrefix: returns 0 on empty prefixes', () => {
  const RQ = reloadModule({});
  const scene = makeScene(['x', 'y']);
  assert.strictEqual(RQ.applyLinearFilterByPrefix(scene, []), 0);
  assert.strictEqual(RQ.applyLinearFilterByPrefix(scene, null), 0);
});

test('applyLinearFilterByPrefix: empty prefix string is no-op', () => {
  const RQ = reloadModule({});
  const scene = makeScene(['a', 'b']);
  // Empty-string prefix would otherwise match everything — guard against
  // accidental "filter every texture" calls
  assert.strictEqual(RQ.applyLinearFilterByPrefix(scene, ['']), 0);
});

test('applyLinearFilter: __MISSING sentinel is skipped', () => {
  const RQ = reloadModule({});
  const scene = makeScene(['real']);
  // The mock scene.textures.get returns the __MISSING sentinel for unknown
  // keys — applyLinearFilter must NOT call setFilter on it
  const count = RQ.applyLinearFilter(scene, ['fake_unloaded_key']);
  assert.strictEqual(count, 0);
});

test('MAX_DPR constant exposed', () => {
  const RQ = reloadModule({});
  assert.strictEqual(RQ.MAX_DPR, 2);
});
