// mobileControls.js — Single entry point for mobile control UI.
//
// Responsibilities (WP01):
//   - Build the inventory button (top-right, safe-area aware).
//   - Create the virtual joystick (fixed for now — WP03 makes it floating).
//   - Build the 6 ability buttons via a declarative grid layout.
//   - Wire ability handlers (attack / spin / charge / dash / dagger / shield).
//   - Dispatch a minimal CustomEvent bus for downstream WPs.
//
// Emitted window-level CustomEvents (contract for WP02/03/04/05):
//   - 'demonfall:ability-tap'      detail: { ability: 'attack' | 'spin' | ... }
//       Dispatched at pointerdown BEFORE the ability handler runs so consumers
//       (e.g. WP04 auto-aim) can adjust state ahead of the swing.
//   - 'demonfall:ability-release'  detail: { ability: 'charge' }
//       Only fires for buttons with an onUp handler (currently: charge).
//   - 'demonfall:mobile-layout-ready' detail: { scene, buttons, joystick, inventoryBtn }
//       Fired once after the first positioning pass of a scene's mobile UI.
//   - 'demonfall:mobile-layout-changed' detail: { scene, width, height }
//       Fired on each scale resize, after UI is re-positioned.
//
// Exported globals:
//   window.initMobileControls(scene)         — call from initControls() when isMobile.
//   window.getMobileAbilityButtonAnchor()    — {x, y, cellWidth, cellHeight} for the cluster origin.
//   window.getMobileLeftPointerRegion()      — {x, y, width, height} where WP03 may spawn the joystick.
//   window.getMobileAbilityButtonHitRects()  — [{key, x, y, halfW, halfH}, ...] for overlap checks.

(function () {
  // Declarative grid — col 0 = innermost (closest to bottom-right corner).
  // row 0 = bottom row, row 1 = upper row.
  const ABILITY_LAYOUT = [
    { key: 'attack', col: 0, row: 0, baseRadius: 40, color: 0xff0000, label: 'Atk' },
    { key: 'spin',   col: 1, row: 0, baseRadius: 40, color: 0x00ffff, label: 'Spin' },
    { key: 'dagger', col: 2, row: 0, baseRadius: 34, color: 0xff8800, label: 'Dg' },
    { key: 'charge', col: 0, row: 1, baseRadius: 34, color: 0xffaa00, label: 'Ch' },
    { key: 'dash',   col: 1, row: 1, baseRadius: 34, color: 0x66ccff, label: 'Ds' },
    { key: 'shield', col: 2, row: 1, baseRadius: 34, color: 0x66ffaa, label: 'Sh' },
  ];

  const CORNER_PAD = 20;       // base padding from screen corner, added to safe-area
  const INV_CORNER_PAD = 16;
  const GRID_GAP = 16;         // gap between cells
  const MIN_HIT_HALF = 22;     // 44×44 minimum hit rect (half-width)

  // Module state (one live mobile scene at a time — Phaser pattern).
  const state = {
    scene: null,
    joystick: null,
    inventoryBtn: null,
    buttons: [],          // [{key, circle, hitHalf, dx, dy, onDown, onUp}]
    cooldownTexts: {},    // key -> Phaser.Text
    anchor: null,         // last computed {x, y, cellWidth, cellHeight}
  };

  function _safeArea() {
    return window.__SAFE_AREA__ || { top: 0, right: 0, bottom: 0, left: 0 };
  }

  function _buttonScale() {
    const s = window.__MOBILE_BUTTON_SCALE__;
    if (typeof s !== 'number' || !isFinite(s) || s <= 0) return 1.0;
    return s;
  }

  // Compute x/y of a given cell (col, row) measured from the bottom-right corner.
  // row grows UP, col grows LEFT (away from corner).
  function _cellCenter(screenW, screenH, col, row, baseRadius) {
    const scale = _buttonScale();
    const sa = _safeArea();
    const cellSide = Math.max(baseRadius * 2 * scale, 44) + GRID_GAP;
    const padRight = CORNER_PAD + sa.right;
    const padBottom = CORNER_PAD + sa.bottom;
    const x = screenW - padRight - cellSide * (col + 0.5);
    const y = screenH - padBottom - cellSide * (row + 0.5);
    return { x, y, cellSide };
  }

  function _anchorOrigin(screenW, screenH) {
    // Top-left of the ability cluster (smallest x, smallest y it occupies).
    const scale = _buttonScale();
    const sa = _safeArea();
    const cols = 3, rows = 2;
    const maxBase = 40;
    const cellSide = Math.max(maxBase * 2 * scale, 44) + GRID_GAP;
    const padRight = CORNER_PAD + sa.right;
    const padBottom = CORNER_PAD + sa.bottom;
    const right = screenW - padRight;
    const bottom = screenH - padBottom;
    const left = right - cellSide * cols;
    const top = bottom - cellSide * rows;
    return { x: left, y: top, cellWidth: cellSide, cellHeight: cellSide };
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (err) { /* ignore */ }
  }

  function _makeAbilityButton(scene, spec, onDown, onUp) {
    const scale = _buttonScale();
    const visualRadius = spec.baseRadius * scale;
    const hitHalf = Math.max(MIN_HIT_HALF, visualRadius);

    const btn = scene.add.circle(0, 0, visualRadius, spec.color, 0.6)
      .setScrollFactor(0)
      .setDepth(1200);
    btn.setInteractive(
      new Phaser.Geom.Rectangle(-hitHalf, -hitHalf, hitHalf * 2, hitHalf * 2),
      Phaser.Geom.Rectangle.Contains
    );

    btn.on('pointerdown', () => {
      _dispatch('demonfall:ability-tap', { ability: spec.key });
      try { onDown.call(scene); } catch (err) { console.warn('[mobileControls] onDown error', spec.key, err); }
    });
    if (onUp) {
      const release = () => {
        _dispatch('demonfall:ability-release', { ability: spec.key });
        try { onUp.call(scene); } catch (err) { console.warn('[mobileControls] onUp error', spec.key, err); }
      };
      btn.on('pointerup', release);
      btn.on('pointerupoutside', release);
      btn.on('pointerout', release);
    }

    return { circle: btn, hitHalf };
  }

  function _makeCooldownLabel(scene) {
    return scene.add.text(0, 0, '', { fontSize: '18px', fill: '#fff', align: 'center' })
      .setOrigin(0.5)
      .setDepth(1201)
      .setScrollFactor(0)
      .setVisible(false);
  }

  function _positionAll(screenW, screenH) {
    // Ability buttons + cooldown texts
    state.buttons.forEach(({ circle, spec }) => {
      const pos = _cellCenter(screenW, screenH, spec.col, spec.row, spec.baseRadius);
      circle.setPosition(pos.x, pos.y);
    });
    Object.keys(state.cooldownTexts).forEach((key) => {
      const spec = ABILITY_LAYOUT.find((s) => s.key === key);
      if (!spec) return;
      const pos = _cellCenter(screenW, screenH, spec.col, spec.row, spec.baseRadius);
      state.cooldownTexts[key].setPosition(pos.x, pos.y);
    });

    // Inventory button (top-right)
    if (state.inventoryBtn) {
      const sa = _safeArea();
      state.inventoryBtn.setPosition(
        screenW - INV_CORNER_PAD - sa.right,
        INV_CORNER_PAD + sa.top
      );
    }

    // Anchor cache
    state.anchor = _anchorOrigin(screenW, screenH);
  }

  function initMobileControls(scene) {
    // Snapshot scene; no behaviour on desktop.
    state.scene = scene;
    state.buttons = [];
    state.cooldownTexts = {};

    // ----- Inventory button -----
    const inventoryBtn = scene.add.text(0, 0, 'Bag', {
      fontSize: '16px', fill: '#fff', backgroundColor: '#222',
      padding: { x: 8, y: 6 }
    })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(4000);
    inventoryBtn.setInteractive(
      new Phaser.Geom.Rectangle(-44, 0, 44, 44),
      Phaser.Geom.Rectangle.Contains
    );
    inventoryBtn.on('pointerdown', () => {
      if (typeof invOpen !== 'undefined' && invOpen) {
        if (typeof closeInventory === 'function') closeInventory();
      } else if (typeof openInventory === 'function') {
        openInventory();
      }
    });
    state.inventoryBtn = inventoryBtn;

    // ----- Joystick (fixed for now; WP03 will make it floating) -----
    const joystickBase = scene.add.circle(0, 0, 60, 0x888888, 0.3);
    const joystickThumb = scene.add.circle(0, 0, 30, 0xcccccc, 0.5);
    const joystick = scene.plugins.get('rexVirtualJoystick').add(scene, {
      x: 100,
      y: scene.scale.height - 100,
      radius: 60,
      base: joystickBase,
      thumb: joystickThumb,
    });
    joystick.base.setScrollFactor(0).setDepth(1200);
    joystick.thumb.setScrollFactor(0).setDepth(1200);
    state.joystick = joystick;
    window.joystick = joystick; // existing global consumed by handleMobileMovement

    // ----- Ability buttons -----
    const handlers = {
      attack: { onDown: attack,              onUp: null },
      spin:   { onDown: spinAttack,          onUp: null },
      charge: { onDown: beginChargedSlash,   onUp: releaseChargedSlash },
      dash:   { onDown: dashSlash,           onUp: null },
      dagger: { onDown: throwDagger,         onUp: null },
      shield: { onDown: shieldBash,          onUp: null },
    };

    ABILITY_LAYOUT.forEach((spec) => {
      const h = handlers[spec.key];
      const { circle, hitHalf } = _makeAbilityButton(scene, spec, h.onDown, h.onUp);
      state.buttons.push({ spec, circle, hitHalf });
      // Legacy globals consumed elsewhere in the codebase.
      if (spec.key === 'attack') window.attackBtn = circle;
      if (spec.key === 'spin')   window.spinBtn = circle;
      if (spec.key === 'charge') window.chargeSlashBtn = circle;
      if (spec.key === 'dash')   window.dashSlashBtn = circle;
      if (spec.key === 'dagger') window.daggerThrowBtn = circle;
      if (spec.key === 'shield') window.shieldBashBtn = circle;
    });

    // Destroy old cooldown texts and create fresh.
    [
      'attackBtnCooldownText', 'spinBtnCooldownText',
      'chargeSlashCooldownText', 'dashSlashCooldownText',
      'daggerThrowCooldownText', 'shieldBashCooldownText',
    ].forEach((g) => { if (window[g] && window[g].destroy) window[g].destroy(); });

    const cdFor = (key) => {
      const t = _makeCooldownLabel(scene);
      state.cooldownTexts[key] = t;
      return t;
    };
    window.attackBtnCooldownText        = cdFor('attack');
    window.spinBtnCooldownText          = cdFor('spin');
    window.chargeSlashCooldownText      = cdFor('charge');
    window.dashSlashCooldownText        = cdFor('dash');
    window.daggerThrowCooldownText      = cdFor('dagger');
    window.shieldBashCooldownText       = cdFor('shield');

    // Initial layout pass.
    _positionAll(scene.scale.width, scene.scale.height);

    // Resize handler.
    scene.scale.on('resize', (gs) => {
      _positionAll(gs.width, gs.height);
      _dispatch('demonfall:mobile-layout-changed', {
        scene,
        width: gs.width,
        height: gs.height,
      });
    });

    // Layout-ready event for downstream WPs.
    _dispatch('demonfall:mobile-layout-ready', {
      scene,
      buttons: state.buttons.map(({ spec, circle, hitHalf }) => ({ spec, circle, hitHalf })),
      joystick: state.joystick,
      inventoryBtn: state.inventoryBtn,
      cooldownTexts: Object.assign({}, state.cooldownTexts),
    });
  }

  function getMobileAbilityButtonAnchor() {
    return state.anchor ? Object.assign({}, state.anchor) : null;
  }

  function getMobileLeftPointerRegion() {
    if (!state.scene) return null;
    const sa = _safeArea();
    const w = state.scene.scale.width;
    const h = state.scene.scale.height;
    // Exclude top band (inventory + notch) and bottom safe-area.
    const topReserved = (sa.top || 0) + 60;
    const bottomReserved = sa.bottom || 0;
    return {
      x: sa.left || 0,
      y: topReserved,
      width: w / 2,
      height: Math.max(0, h - topReserved - bottomReserved),
    };
  }

  function getMobileAbilityButtonHitRects() {
    return state.buttons.map(({ spec, circle, hitHalf }) => ({
      key: spec.key,
      x: circle.x,
      y: circle.y,
      halfW: hitHalf,
      halfH: hitHalf,
    }));
  }

  window.initMobileControls = initMobileControls;
  window.getMobileAbilityButtonAnchor = getMobileAbilityButtonAnchor;
  window.getMobileLeftPointerRegion = getMobileLeftPointerRegion;
  window.getMobileAbilityButtonHitRects = getMobileAbilityButtonHitRects;
})();
