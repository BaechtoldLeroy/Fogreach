// inputScheme.js — scheme-aware input dispatcher.
//
// Owns the decision of "what semantic action did the player just request?"
// Hides the raw Phaser key/pointer polling behind a small API so consumers
// (main.js, player.js, SettingsScene.js) never branch on the active scheme
// themselves.
//
// Two schemes:
//   classic — arrows + Space + QWER (original bindings)
//   arpg    — WASD + mouse-aim + 1/2/3/4 (mouse cursor drives facing/aim)
//
// Classic is the default. Switching is live (next frame). Non-combat keys
// (F/I/K/O/J/M/P) are unchanged in both schemes and are NOT routed through
// this module.
//
// See kitty-specs/042-arpg-control-scheme/contracts/input-scheme-api.md
// for the canonical public surface.

(function () {
  // i18n keys registered at module load so SettingsScene can reference them
  // without worrying about load order. window.i18n.register does Object.assign
  // so duplicate registrations in consumers are harmless.
  if (window.i18n) {
    window.i18n.register('de', {
      'input.scheme.classic': 'Klassisch',
      'input.scheme.arpg': 'ARPG',
      'settings.input_scheme.label': 'Steuerung'
    });
    window.i18n.register('en', {
      'input.scheme.classic': 'Classic',
      'input.scheme.arpg': 'ARPG',
      'settings.input_scheme.label': 'Control Scheme'
    });
  }

  const SUPPORTED = ['classic', 'arpg'];
  const DEFAULT_SCHEME = 'classic';
  const DEAD_ZONE_PX = 20;

  const state = {
    scheme: null,                 // lazy-init from Persistence on first getScheme()
    sceneRef: null,               // stashed scene for pointer world-coord reads
    lastAim: { x: 1, y: 0 },      // last non-zero aim; dead-zone fallback
    pointerJustDown: false,       // LMB edge flag, set by pointerdown listener,
                                  // consumed by isBasicAttackTriggered()
    pointerHandler: null          // so teardown can remove the listener
  };

  const subscribers = new Set();

  // Production primitives — wired by init(scene). Each is replaced by
  // _configureForTest(primitives) in Node test runs where Phaser is absent.
  let primitives = null;

  function _makeProductionPrimitives(scene) {
    const kb = scene.input.keyboard;
    // Phaser Key objects — addKey is idempotent, returning the existing key
    // on repeat calls, so double-init is safe.
    const keys = {
      up:    kb.addKey('UP'),
      down:  kb.addKey('DOWN'),
      left:  kb.addKey('LEFT'),
      right: kb.addKey('RIGHT'),
      w:     kb.addKey('W'),
      a:     kb.addKey('A'),
      s:     kb.addKey('S'),
      d:     kb.addKey('D'),
      space: kb.addKey('SPACE'),
      q:     kb.addKey('Q'),
      e:     kb.addKey('E'),
      r:     kb.addKey('R'),
      one:   kb.addKey('ONE'),
      two:   kb.addKey('TWO'),
      three: kb.addKey('THREE'),
      four:  kb.addKey('FOUR')
    };
    return {
      getKeyDown(name) {
        const k = keys[name];
        return !!(k && k.isDown);
      },
      isKeyJustDown(name) {
        const k = keys[name];
        return !!(k && Phaser.Input.Keyboard.JustDown(k));
      },
      isKeyJustUp(name) {
        const k = keys[name];
        return !!(k && Phaser.Input.Keyboard.JustUp(k));
      },
      getPointerWorldXY() {
        const p = scene.input && scene.input.activePointer;
        const cam = scene.cameras && scene.cameras.main;
        if (!p || !cam) return null;
        // activePointer.worldX/Y are only refreshed on pointer events — a
        // stationary cursor with a scrolling camera yields stale values.
        // Transform the current screen coords through the current camera.
        const wp = cam.getWorldPoint(p.x, p.y);
        return { x: wp.x, y: wp.y };
      },
      getPlayerPos() {
        const p = window.player;
        if (p && typeof p.x === 'number' && typeof p.y === 'number') {
          return { x: p.x, y: p.y };
        }
        return null;
      },
      getLastMoveDir() {
        const d = window.lastMoveDirection;
        if (d && typeof d.x === 'number' && typeof d.y === 'number') {
          return { x: d.x, y: d.y };
        }
        return { x: 0, y: 0 };
      },
      getSuppressFlags() {
        return {
          invOpen:            !!window.invOpen,
          playerDeathHandled: !!window.playerDeathHandled,
          isReturningToHub:   !!window.isReturningToHub
        };
      },
      persistence: {
        getControlScheme: () =>
          window.Persistence && typeof window.Persistence.getControlScheme === 'function'
            ? window.Persistence.getControlScheme()
            : DEFAULT_SCHEME,
        setControlScheme: (v) => {
          if (window.Persistence && typeof window.Persistence.setControlScheme === 'function') {
            window.Persistence.setControlScheme(v);
          }
        }
      }
    };
  }

  function init(scene) {
    if (!scene) return;
    // Tear down any prior primitives before rebinding.
    teardown();
    state.sceneRef = scene;
    primitives = _makeProductionPrimitives(scene);
    // NOTE: InputScheme does NOT subscribe to pointerdown itself. The consumer
    // (main.js) owns the scene-level pointerdown handler so it can apply its
    // UI-hit-test check (currentlyOver) before firing the attack. The consumer
    // calls markPrimaryButtonJustDown() when the click should register.
  }

  function teardown() {
    state.sceneRef = null;
    state.pointerHandler = null;
    state.pointerJustDown = false;
  }

  function markPrimaryButtonJustDown() {
    state.pointerJustDown = true;
  }

  function _configureForTest(testPrimitives) {
    primitives = testPrimitives || null;
    state.sceneRef = null;
    state.pointerHandler = null;
    state.pointerJustDown = false;
    state.lastAim = { x: 1, y: 0 };
    state.scheme = null;
    subscribers.clear();
  }

  function _requirePrimitives() {
    // Returns null when not initialized rather than throwing — callers default
    // gracefully so an early call (e.g., HubSceneV2.createPlayer running its
    // first updatePlayerSpriteAnimation before init) never blows up the scene.
    return primitives;
  }

  function getScheme() {
    if (state.scheme === null) {
      const p = (primitives && primitives.persistence) ? primitives.persistence : null;
      const stored = p && typeof p.getControlScheme === 'function'
        ? p.getControlScheme()
        : DEFAULT_SCHEME;
      state.scheme = SUPPORTED.indexOf(stored) !== -1 ? stored : DEFAULT_SCHEME;
    }
    return state.scheme;
  }

  function setScheme(value) {
    if (SUPPORTED.indexOf(value) === -1) {
      console.warn('[InputScheme] setScheme: invalid value', value);
      return false;
    }
    // Force lazy-init so getScheme() has primed state.scheme.
    if (state.scheme === null) getScheme();
    if (state.scheme === value) return true;

    state.scheme = value;
    if (primitives && primitives.persistence && typeof primitives.persistence.setControlScheme === 'function') {
      primitives.persistence.setControlScheme(value);
    }
    // Scheme switch clears the LMB edge flag — a click that happened under the
    // old scheme shouldn't fire the attack under the new one.
    state.pointerJustDown = false;

    subscribers.forEach(function (cb) {
      try { cb(value); } catch (err) { console.error('[InputScheme] subscriber threw', err); }
    });
    return true;
  }

  function onChange(cb) {
    if (typeof cb !== 'function') return function () {};
    subscribers.add(cb);
    return function () { subscribers.delete(cb); };
  }

  function shouldSuppressCombatInput() {
    if (!primitives || typeof primitives.getSuppressFlags !== 'function') return false;
    const flags = primitives.getSuppressFlags() || {};
    return !!(flags.invOpen || flags.playerDeathHandled || flags.isReturningToHub);
  }

  function getMovementInput() {
    const p = _requirePrimitives();
    if (!p) return { x: 0, y: 0 };
    const scheme = getScheme();
    let vx = 0, vy = 0;
    if (scheme === 'arpg') {
      if (p.getKeyDown('a')) vx -= 1;
      if (p.getKeyDown('d')) vx += 1;
      if (p.getKeyDown('w')) vy -= 1;
      if (p.getKeyDown('s')) vy += 1;
    } else {
      if (p.getKeyDown('left'))  vx -= 1;
      if (p.getKeyDown('right')) vx += 1;
      if (p.getKeyDown('up'))    vy -= 1;
      if (p.getKeyDown('down'))  vy += 1;
    }
    return { x: vx, y: vy };
  }

  function isBasicAttackTriggered() {
    if (shouldSuppressCombatInput()) return false;
    const p = _requirePrimitives();
    if (!p) return false;
    // Edge-triggered: Space OR primary mouse button. Both schemes honor both
    // (Space is the accessibility fallback for ARPG per FR-010). The mouse
    // flag is set by markPrimaryButtonJustDown() from the consumer's UI-aware
    // pointerdown handler.
    const space = typeof p.isKeyJustDown === 'function' && p.isKeyJustDown('space');
    let mouse = false;
    if (state.pointerJustDown) {
      state.pointerJustDown = false;
      mouse = true;
    }
    return space || mouse;
  }

  // Internal mapping: slot index (1..4) → physical key name per scheme.
  function _slotKey(scheme, slotIndex) {
    if (scheme === 'arpg') {
      return ['one', 'two', 'three', 'four'][slotIndex - 1] || null;
    }
    return ['q', 'w', 'e', 'r'][slotIndex - 1] || null;
  }

  function consumeAbilityTrigger(slotIndex) {
    if (slotIndex < 1 || slotIndex > 4) return false;
    if (shouldSuppressCombatInput()) return false;
    const p = _requirePrimitives();
    if (!p) return false;
    const keyName = _slotKey(getScheme(), slotIndex);
    if (!keyName) return false;
    return typeof p.isKeyJustDown === 'function' && p.isKeyJustDown(keyName);
  }

  function consumeAbilityReleaseTrigger(slotIndex) {
    // Release paths are currently handled outside this module (main.js still
    // polls JustUp for charge abilities). This hook exists so future callers
    // can move their release polling here uniformly. For now it just wraps
    // a `isKeyJustUp` primitive if the test harness provides it.
    if (slotIndex < 1 || slotIndex > 4) return false;
    const p = _requirePrimitives();
    if (!p) return false;
    const keyName = _slotKey(getScheme(), slotIndex);
    if (!keyName) return false;
    if (typeof p.isKeyJustUp !== 'function') return false;
    return p.isKeyJustUp(keyName);
  }

  function getSlotLabel(slotIndex) {
    if (slotIndex < 1 || slotIndex > 4) return '';
    if (getScheme() === 'arpg') return String(slotIndex);
    return ['Q', 'W', 'E', 'R'][slotIndex - 1];
  }

  function getAimDirection(scene, player) {
    const p = _requirePrimitives();
    if (!p) {
      // Pre-init fallback — return last known aim so updatePlayerSpriteAnimation
      // can still pick a default facing without crashing.
      return { x: state.lastAim.x, y: state.lastAim.y, source: 'lastKnown' };
    }
    const scheme = getScheme();

    if (scheme === 'classic') {
      const d = typeof p.getLastMoveDir === 'function' ? p.getLastMoveDir() : { x: 0, y: 0 };
      const len = Math.hypot(d.x, d.y);
      if (len > 0.0001) {
        return { x: d.x / len, y: d.y / len, source: 'movement' };
      }
      return { x: state.lastAim.x, y: state.lastAim.y, source: 'lastKnown' };
    }

    // ARPG — cursor-based aim with dead-zone.
    const pt = typeof p.getPointerWorldXY === 'function' ? p.getPointerWorldXY() : null;
    const pp = (player && typeof player.x === 'number' && typeof player.y === 'number')
      ? { x: player.x, y: player.y }
      : (typeof p.getPlayerPos === 'function' ? p.getPlayerPos() : null);

    if (!pt || !pp) {
      return { x: state.lastAim.x, y: state.lastAim.y, source: 'lastKnown' };
    }
    const dx = pt.x - pp.x;
    const dy = pt.y - pp.y;
    const len = Math.hypot(dx, dy);
    if (len < DEAD_ZONE_PX) {
      return { x: state.lastAim.x, y: state.lastAim.y, source: 'lastKnown' };
    }
    const nx = dx / len;
    const ny = dy / len;
    state.lastAim.x = nx;
    state.lastAim.y = ny;
    return { x: nx, y: ny, source: 'cursor' };
  }

  window.InputScheme = {
    init,
    teardown,
    getScheme,
    setScheme,
    onChange,
    getMovementInput,
    isBasicAttackTriggered,
    markPrimaryButtonJustDown,
    consumeAbilityTrigger,
    consumeAbilityReleaseTrigger,
    getSlotLabel,
    getAimDirection,
    shouldSuppressCombatInput,
    _configureForTest,
    _DEAD_ZONE_PX: DEAD_ZONE_PX,
    _SUPPORTED: SUPPORTED
  };
})();
