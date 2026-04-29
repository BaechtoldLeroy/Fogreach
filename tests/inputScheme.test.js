// Unit tests for js/inputScheme.js
//
// InputScheme is an IIFE that attaches to window. We load it once via the
// shared loader, then use its _configureForTest(primitives) entry to swap
// in stubbed input accessors per test.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

function makeStub() {
  // Mutable state the tests manipulate, then read through primitives closures.
  const keysDown = {};
  const keysJustDown = {};
  const keysJustUp = {};
  let pointer = null;
  let playerPos = null;
  let lastMoveDir = { x: 0, y: 0 };
  let suppressFlags = { invOpen: false, playerDeathHandled: false, isReturningToHub: false };
  let storedScheme = 'classic';

  const primitives = {
    getKeyDown: (name) => !!keysDown[name],
    isKeyJustDown: (name) => {
      if (keysJustDown[name]) {
        keysJustDown[name] = false; // one-shot, matches Phaser.JustDown semantics
        return true;
      }
      return false;
    },
    isKeyJustUp: (name) => {
      if (keysJustUp[name]) {
        keysJustUp[name] = false;
        return true;
      }
      return false;
    },
    getPointerWorldXY: () => pointer,
    getPlayerPos: () => playerPos,
    getLastMoveDir: () => ({ ...lastMoveDir }),
    getSuppressFlags: () => ({ ...suppressFlags }),
    persistence: {
      getControlScheme: () => storedScheme,
      setControlScheme: (v) => { storedScheme = v; }
    }
  };

  return {
    primitives,
    pressKey(name) { keysDown[name] = true; keysJustDown[name] = true; },
    releaseKey(name) { keysDown[name] = false; keysJustUp[name] = true; },
    holdKey(name, held) { keysDown[name] = !!held; },
    setPointer(x, y) { pointer = { x, y }; },
    clearPointer() { pointer = null; },
    setPlayer(x, y) { playerPos = { x, y }; },
    setLastMoveDir(x, y) { lastMoveDir = { x, y }; },
    setSuppress(flags) { suppressFlags = { ...suppressFlags, ...flags }; },
    setStoredScheme(v) { storedScheme = v; },
    getStoredScheme() { return storedScheme; }
  };
}

let loaded = false;
function ensureLoaded() {
  if (!loaded) {
    // i18n stub so inputScheme.js's module-header register calls don't crash
    if (!globalThis.window.i18n) {
      globalThis.window.i18n = {
        register: () => {},
        t: (k) => k,
        setLanguage: () => {},
        getLanguage: () => 'de',
        onChange: () => () => {}
      };
    }
    loadGameModule('js/inputScheme.js');
    loaded = true;
  }
  return globalThis.window.InputScheme;
}

function fresh() {
  const IS = ensureLoaded();
  const stub = makeStub();
  IS._configureForTest(stub.primitives);
  return { IS, stub };
}

beforeEach(() => {
  resetStore();
});

// --- Scheme state ---

test('default scheme is classic when persistence returns classic', () => {
  const { IS } = fresh();
  assert.strictEqual(IS.getScheme(), 'classic');
});

test('default scheme reads arpg when persistence returns arpg', () => {
  const { IS, stub } = fresh();
  stub.setStoredScheme('arpg');
  // force re-read
  IS._configureForTest(stub.primitives);
  assert.strictEqual(IS.getScheme(), 'arpg');
});

test('setScheme persists and returns true', () => {
  const { IS, stub } = fresh();
  assert.strictEqual(IS.setScheme('arpg'), true);
  assert.strictEqual(IS.getScheme(), 'arpg');
  assert.strictEqual(stub.getStoredScheme(), 'arpg');
});

test('setScheme rejects invalid values', () => {
  const { IS, stub } = fresh();
  assert.strictEqual(IS.setScheme('bogus'), false);
  assert.strictEqual(IS.getScheme(), 'classic');
  assert.strictEqual(stub.getStoredScheme(), 'classic');
});

test('setScheme is idempotent for same value and does not notify', () => {
  const { IS } = fresh();
  let calls = 0;
  IS.onChange(() => { calls++; });
  IS.setScheme('classic'); // same as default — no notify
  assert.strictEqual(calls, 0);
  IS.setScheme('arpg');
  assert.strictEqual(calls, 1);
  IS.setScheme('arpg'); // same again — no notify
  assert.strictEqual(calls, 1);
});

test('onChange subscribe + unsubscribe', () => {
  const { IS } = fresh();
  let last = null;
  const unsub = IS.onChange((v) => { last = v; });
  IS.setScheme('arpg');
  assert.strictEqual(last, 'arpg');
  unsub();
  IS.setScheme('classic');
  assert.strictEqual(last, 'arpg', 'subscriber should not have fired after unsubscribe');
});

test('onChange swallows subscriber exceptions', () => {
  const { IS } = fresh();
  IS.onChange(() => { throw new Error('boom'); });
  let reached = false;
  IS.onChange(() => { reached = true; });
  assert.doesNotThrow(() => IS.setScheme('arpg'));
  assert.strictEqual(reached, true);
});

// --- Movement ---

test('getMovementInput uses arrow keys in classic', () => {
  const { IS, stub } = fresh();
  stub.holdKey('left', true);
  assert.deepStrictEqual(IS.getMovementInput(), { x: -1, y: 0 });
  stub.holdKey('left', false);
  stub.holdKey('down', true);
  assert.deepStrictEqual(IS.getMovementInput(), { x: 0, y: 1 });
});

test('getMovementInput uses WASD in arpg and ignores arrow keys', () => {
  const { IS, stub } = fresh();
  IS.setScheme('arpg');
  stub.holdKey('left', true);  // arrow key — should be ignored
  stub.holdKey('d', true);
  assert.deepStrictEqual(IS.getMovementInput(), { x: 1, y: 0 });
  stub.holdKey('w', true);
  assert.deepStrictEqual(IS.getMovementInput(), { x: 1, y: -1 });
});

test('getMovementInput with no keys down returns zero vector', () => {
  const { IS } = fresh();
  assert.deepStrictEqual(IS.getMovementInput(), { x: 0, y: 0 });
});

// --- Basic attack ---

test('isBasicAttackTriggered fires once per Space press', () => {
  const { IS, stub } = fresh();
  stub.pressKey('space');
  assert.strictEqual(IS.isBasicAttackTriggered(), true);
  assert.strictEqual(IS.isBasicAttackTriggered(), false, 'debounced');
});

test('markPrimaryButtonJustDown + isBasicAttackTriggered one-shot', () => {
  const { IS } = fresh();
  IS.markPrimaryButtonJustDown();
  assert.strictEqual(IS.isBasicAttackTriggered(), true);
  assert.strictEqual(IS.isBasicAttackTriggered(), false);
});

test('isBasicAttackTriggered suppressed when inventory is open', () => {
  const { IS, stub } = fresh();
  stub.setSuppress({ invOpen: true });
  stub.pressKey('space');
  assert.strictEqual(IS.isBasicAttackTriggered(), false);
});

// --- Ability slot triggers ---

test('consumeAbilityTrigger in classic maps 1..4 to Q/W/E/R', () => {
  const { IS, stub } = fresh();
  stub.pressKey('q');
  assert.strictEqual(IS.consumeAbilityTrigger(1), true);
  stub.pressKey('w');
  assert.strictEqual(IS.consumeAbilityTrigger(2), true);
  stub.pressKey('e');
  assert.strictEqual(IS.consumeAbilityTrigger(3), true);
  stub.pressKey('r');
  assert.strictEqual(IS.consumeAbilityTrigger(4), true);
});

test('consumeAbilityTrigger in arpg maps 1..4 to number keys', () => {
  const { IS, stub } = fresh();
  IS.setScheme('arpg');
  stub.pressKey('one');
  assert.strictEqual(IS.consumeAbilityTrigger(1), true);
  stub.pressKey('two');
  assert.strictEqual(IS.consumeAbilityTrigger(2), true);
});

test('consumeAbilityTrigger ignores Q in arpg mode', () => {
  const { IS, stub } = fresh();
  IS.setScheme('arpg');
  stub.pressKey('q'); // classic key, should not trigger in arpg
  assert.strictEqual(IS.consumeAbilityTrigger(1), false);
});

test('consumeAbilityTrigger out-of-range returns false', () => {
  const { IS } = fresh();
  assert.strictEqual(IS.consumeAbilityTrigger(0), false);
  assert.strictEqual(IS.consumeAbilityTrigger(5), false);
});

test('consumeAbilityTrigger suppressed when inventory is open', () => {
  const { IS, stub } = fresh();
  stub.setSuppress({ invOpen: true });
  stub.pressKey('q');
  assert.strictEqual(IS.consumeAbilityTrigger(1), false);
});

// --- Slot labels ---

test('getSlotLabel returns Q W E R in classic', () => {
  const { IS } = fresh();
  assert.strictEqual(IS.getSlotLabel(1), 'Q');
  assert.strictEqual(IS.getSlotLabel(2), 'W');
  assert.strictEqual(IS.getSlotLabel(3), 'E');
  assert.strictEqual(IS.getSlotLabel(4), 'R');
});

test('getSlotLabel returns 1 2 3 4 in arpg', () => {
  const { IS } = fresh();
  IS.setScheme('arpg');
  assert.strictEqual(IS.getSlotLabel(1), '1');
  assert.strictEqual(IS.getSlotLabel(2), '2');
  assert.strictEqual(IS.getSlotLabel(3), '3');
  assert.strictEqual(IS.getSlotLabel(4), '4');
});

// --- Aim direction ---

test('getAimDirection classic reads lastMoveDirection and normalizes', () => {
  const { IS, stub } = fresh();
  stub.setLastMoveDir(3, 4); // length 5 → normalized to (0.6, 0.8)
  const aim = IS.getAimDirection(null, null);
  assert.strictEqual(aim.source, 'movement');
  assert.ok(Math.abs(aim.x - 0.6) < 1e-9);
  assert.ok(Math.abs(aim.y - 0.8) < 1e-9);
});

test('getAimDirection classic with zero movement returns lastKnown', () => {
  const { IS } = fresh();
  const aim = IS.getAimDirection(null, null);
  assert.strictEqual(aim.source, 'lastKnown');
  assert.deepStrictEqual({ x: aim.x, y: aim.y }, { x: 1, y: 0 }); // initial lastAim
});

test('getAimDirection arpg: cursor far from player yields normalized cursor vector', () => {
  const { IS, stub } = fresh();
  IS.setScheme('arpg');
  stub.setPlayer(100, 100);
  stub.setPointer(200, 100); // 100 px east
  const aim = IS.getAimDirection(null, null);
  assert.strictEqual(aim.source, 'cursor');
  assert.ok(Math.abs(aim.x - 1) < 1e-9);
  assert.ok(Math.abs(aim.y) < 1e-9);
});

test('getAimDirection arpg: cursor inside dead-zone returns lastKnown', () => {
  const { IS, stub } = fresh();
  IS.setScheme('arpg');
  stub.setPlayer(100, 100);
  stub.setPointer(110, 100); // 10 px — within 20 px dead-zone
  const aim = IS.getAimDirection(null, null);
  assert.strictEqual(aim.source, 'lastKnown');
});

test('getAimDirection arpg: lastAim cache updates on cursor reads', () => {
  const { IS, stub } = fresh();
  IS.setScheme('arpg');
  stub.setPlayer(0, 0);
  stub.setPointer(100, 0);
  IS.getAimDirection(null, null); // populates lastAim → (1,0)
  stub.setPointer(0, 0); // dead-zone
  const aim = IS.getAimDirection(null, null);
  assert.strictEqual(aim.source, 'lastKnown');
  assert.strictEqual(aim.x, 1);
  assert.strictEqual(aim.y, 0);
});

test('getAimDirection arpg: missing pointer yields lastKnown', () => {
  const { IS, stub } = fresh();
  IS.setScheme('arpg');
  stub.clearPointer();
  stub.setPlayer(0, 0);
  const aim = IS.getAimDirection(null, null);
  assert.strictEqual(aim.source, 'lastKnown');
});

// --- Suppression ---

test('shouldSuppressCombatInput reads all three flags', () => {
  const { IS, stub } = fresh();
  assert.strictEqual(IS.shouldSuppressCombatInput(), false);
  stub.setSuppress({ invOpen: true });
  assert.strictEqual(IS.shouldSuppressCombatInput(), true);
  stub.setSuppress({ invOpen: false, playerDeathHandled: true });
  assert.strictEqual(IS.shouldSuppressCombatInput(), true);
  stub.setSuppress({ playerDeathHandled: false, isReturningToHub: true });
  assert.strictEqual(IS.shouldSuppressCombatInput(), true);
});

test('setScheme clears pending primary-button edge', () => {
  const { IS } = fresh();
  IS.markPrimaryButtonJustDown();
  IS.setScheme('arpg'); // should reset state.pointerJustDown
  assert.strictEqual(IS.isBasicAttackTriggered(), false);
});
