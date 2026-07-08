// Unit tests for js/roomModeVisuals.js (Feature 061 WP05 — pure helpers).
//
// The rendering (sync) needs Phaser and is covered by the browser smoke. Here
// we test the pure banner-key / hud-text mapping.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

function fresh() {
  if (!globalThis.window) require('./setup');
  delete globalThis.window.RoomModeVisuals;
  loadGameModule('js/roomModeVisuals.js');
  return globalThis.window.RoomModeVisuals;
}

beforeEach(() => { fresh(); });

test('bannerKeyFor maps each special mode to its banner key; clear -> null', () => {
  const V = globalThis.window.RoomModeVisuals;
  assert.strictEqual(V.bannerKeyFor('survival'), 'roommode.survival.banner');
  assert.strictEqual(V.bannerKeyFor('defend'), 'roommode.defend.banner');
  assert.strictEqual(V.bannerKeyFor('hunt'), 'roommode.hunt.banner');
  assert.strictEqual(V.bannerKeyFor('escape'), 'roommode.escape.banner');
  assert.strictEqual(V.bannerKeyFor('clear'), null);
  assert.strictEqual(V.bannerKeyFor('unknown'), null);
});

test('hudTextFor returns a non-empty string for special modes, empty for clear', () => {
  const V = globalThis.window.RoomModeVisuals;
  assert.ok(V.hudTextFor('survival', { seconds: 30 }).length > 0);
  assert.ok(V.hudTextFor('defend', { hp: 80 }).length > 0);
  assert.ok(V.hudTextFor('hunt', {}).length > 0);
  assert.strictEqual(V.hudTextFor('clear', {}), '');
  assert.strictEqual(V.hudTextFor('unknown', {}), '');
});
