// mobileControls.js — Single entry point for mobile control UI.
//
// Responsibilities:
//   - Build the inventory ("Bag") button (top-right, safe-area aware).
//   - Create the virtual joystick (fixed bottom-left).
//   - Build ability buttons on a uniform grid; only show abilities that are
//     actually equipped in the active loadout (via AbilitySystem.isEquipped).
//   - Render a dedicated potion button (F on desktop) — always visible.
//   - Wire ability handlers (attack / spin / charge / dash / dagger / shield).
//   - Dispatch a minimal CustomEvent bus for other mobile modules.
//
// Emitted window-level CustomEvents:
//   - 'demonfall:ability-tap'       detail: { ability }
//       Dispatched at pointerdown BEFORE the handler runs so consumers
//       (e.g. mobileAutoAim) can adjust state ahead of the swing.
//   - 'demonfall:ability-release'   detail: { ability }
//       Only for buttons with an onUp handler (currently: charge).
//   - 'demonfall:mobile-layout-ready'   detail: {scene, buttons, joystick, inventoryBtn, cooldownTexts}
//   - 'demonfall:mobile-layout-changed' detail: {scene, width, height}

(function () {
  // Declarative grid — col 0 = innermost (closest to bottom-right corner).
  // row 0 = bottom row, row 1 = upper row.
  // abilityId matches window.AbilitySystem.isEquipped() IDs; null means
  // the button is always visible (basic attack, potion).
  const ABILITY_LAYOUT = [
    { key: 'attack', col: 0, row: 0, color: 0xff0000, abilityId: null },
    { key: 'spin',   col: 1, row: 0, color: 0x00ffff, abilityId: 'spinAttack' },
    { key: 'dagger', col: 2, row: 0, color: 0xff8800, abilityId: 'daggerThrow' },
    { key: 'charge', col: 0, row: 1, color: 0xffaa00, abilityId: 'chargeSlash' },
    { key: 'dash',   col: 1, row: 1, color: 0x66ccff, abilityId: 'dashSlash' },
    { key: 'shield', col: 2, row: 1, color: 0x66ffaa, abilityId: 'shieldBash' },
    { key: 'potion',   col: 3, row: 0, color: 0xd02040, abilityId: null },
    { key: 'interact', col: 3, row: 1, color: 0xffdd44, abilityId: null },
  ];

  const BASE_RADIUS = 38;      // uniform button radius for all cells
  const CORNER_PAD = 20;       // base padding from screen corner, added to safe-area
  const INV_CORNER_PAD = 16;
  const GRID_GAP = 12;
  const MIN_HIT_HALF = 22;     // 44×44 minimum hit rect (half-width)

  const state = {
    scene: null,
    joystick: null,
    inventoryBtn: null,
    inventoryBtnHit: null,
    buttons: [],           // [{spec, circle, hitHalf}]
    cooldownTexts: {},     // key -> Phaser.Text
    anchor: null,
  };

  function _safeArea() {
    return window.__SAFE_AREA__ || { top: 0, right: 0, bottom: 0, left: 0 };
  }

  function _buttonScale() {
    const s = window.__MOBILE_BUTTON_SCALE__;
    if (typeof s !== 'number' || !isFinite(s) || s <= 0) return 1.0;
    return s;
  }

  function _cellSide() {
    const scale = _buttonScale();
    return Math.max(BASE_RADIUS * 2 * scale, 44) + GRID_GAP;
  }

  function _cellCenter(screenW, screenH, col, row) {
    const sa = _safeArea();
    const cs = _cellSide();
    const padRight = CORNER_PAD + sa.right;
    const padBottom = CORNER_PAD + sa.bottom;
    const x = screenW - padRight - cs * (col + 0.5);
    const y = screenH - padBottom - cs * (row + 0.5);
    return { x, y, cellSide: cs };
  }

  function _anchorOrigin(screenW, screenH) {
    const sa = _safeArea();
    const cs = _cellSide();
    const cols = 4, rows = 2;
    const right = screenW - (CORNER_PAD + sa.right);
    const bottom = screenH - (CORNER_PAD + sa.bottom);
    return { x: right - cs * cols, y: bottom - cs * rows, cellWidth: cs, cellHeight: cs };
  }

  function _dispatch(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); }
    catch (err) { /* ignore */ }
  }

  function _isAbilityVisible(spec) {
    if (!spec.abilityId) return true;
    if (window.AbilitySystem && typeof window.AbilitySystem.isEquipped === 'function') {
      return !!window.AbilitySystem.isEquipped(spec.abilityId);
    }
    return true; // fall back to visible if system isn't ready
  }

  function _makeAbilityButton(scene, spec, onDown, onUp) {
    const scale = _buttonScale();
    const visualRadius = BASE_RADIUS * scale;
    const hitHalf = Math.max(MIN_HIT_HALF, visualRadius);

    const btn = scene.add.circle(0, 0, visualRadius, spec.color, 0.6)
      .setScrollFactor(0)
      .setDepth(1200);
    // Use default interactive — for Arc the built-in hit test uses the circle
    // itself. A custom Rectangle hitArea on an Arc GameObject can fail to
    // register taps depending on Phaser's local-space handling.
    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
      _dispatch('demonfall:ability-tap', { ability: spec.key });
      try { onDown.call(scene); }
      catch (err) { console.warn('[mobileControls] onDown error', spec.key, err); }
    });
    if (onUp) {
      const release = () => {
        _dispatch('demonfall:ability-release', { ability: spec.key });
        try { onUp.call(scene); }
        catch (err) { console.warn('[mobileControls] onUp error', spec.key, err); }
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
    state.buttons.forEach(({ circle, spec }) => {
      const pos = _cellCenter(screenW, screenH, spec.col, spec.row);
      circle.setPosition(pos.x, pos.y);
    });
    Object.keys(state.cooldownTexts).forEach((key) => {
      const spec = ABILITY_LAYOUT.find((s) => s.key === key);
      if (!spec) return;
      const pos = _cellCenter(screenW, screenH, spec.col, spec.row);
      state.cooldownTexts[key].setPosition(pos.x, pos.y);
    });

    if (state.inventoryBtn) {
      const sa = _safeArea();
      const x = screenW - INV_CORNER_PAD - sa.right;
      const y = INV_CORNER_PAD + sa.top;
      state.inventoryBtn.setPosition(x, y);
      // Re-anchor the hit rect covering the whole button (origin-agnostic).
      if (state.inventoryBtnHit) {
        state.inventoryBtnHit.setPosition(x - 22, y + 18);
      }
    }

    // Position Skills button below Bag button
    if (state.skillBtn) {
      const sa = _safeArea();
      const sx = screenW - INV_CORNER_PAD - sa.right;
      const sy = INV_CORNER_PAD + sa.top + 40;
      state.skillBtn.setPosition(sx, sy);
      if (state.skillBtnHit) {
        state.skillBtnHit.setPosition(sx - 22, sy + 18);
      }
    }

    state.anchor = _anchorOrigin(screenW, screenH);
  }

  function _usePotion() {
    if (window.LootSystem && typeof window.LootSystem.onPotionKey === 'function') {
      window.LootSystem.onPotionKey();
    }
  }

  // Interact (equivalent to desktop E key): consumed by stair transitions
  // (roomManager.onStairOverlap) and hub NPC/entrance interactions
  // (HubSceneV2._handleInteract). We publish a flag + dispatch an event so
  // both polling and event-driven listeners can react.
  function _interact() {
    window.__MOBILE_INTERACT_ACTIVE__ = true;
    // Reset next frame so polling handlers see a single tap.
    setTimeout(() => { window.__MOBILE_INTERACT_ACTIVE__ = false; }, 180);
    _dispatch('demonfall:mobile-interact', {});
  }

  function _rebuildAbilityButtons() {
    const scene = state.scene;
    if (!scene) return;

    // Tear down existing buttons + their cooldown texts (ability buttons only;
    // joystick, bag, and potion glue stay intact).
    state.buttons.forEach(({ circle }) => { if (circle && circle.destroy) circle.destroy(); });
    Object.values(state.cooldownTexts).forEach((t) => { if (t && t.destroy) t.destroy(); });
    state.buttons = [];
    state.cooldownTexts = {};

    const handlers = {
      attack: { onDown: attack,              onUp: null },
      spin:   { onDown: spinAttack,          onUp: null },
      charge: { onDown: beginChargedSlash,   onUp: releaseChargedSlash },
      dash:   { onDown: dashSlash,           onUp: null },
      dagger: { onDown: throwDagger,         onUp: null },
      shield: { onDown: shieldBash,          onUp: null },
      potion:   { onDown: _usePotion, onUp: null },
      interact: { onDown: _interact,  onUp: null },
    };
    ABILITY_LAYOUT.forEach((spec) => {
      if (!_isAbilityVisible(spec)) return;
      const h = handlers[spec.key];
      if (!h) return;
      const { circle, hitHalf } = _makeAbilityButton(scene, spec, h.onDown, h.onUp);
      state.buttons.push({ spec, circle, hitHalf });
      if (spec.key === 'attack') window.attackBtn = circle;
      if (spec.key === 'spin')   window.spinBtn = circle;
      if (spec.key === 'charge') window.chargeSlashBtn = circle;
      if (spec.key === 'dash')   window.dashSlashBtn = circle;
      if (spec.key === 'dagger') window.daggerThrowBtn = circle;
      if (spec.key === 'shield') window.shieldBashBtn = circle;
    });

    const cdFor = (key) => {
      if (!state.buttons.some((b) => b.spec.key === key)) return null;
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

    _positionAll(scene.scale.width, scene.scale.height);
    _dispatch('demonfall:mobile-layout-ready', {
      scene,
      buttons: state.buttons.map(({ spec, circle, hitHalf }) => ({ spec, circle, hitHalf })),
      joystick: state.joystick,
      inventoryBtn: state.inventoryBtn,
      cooldownTexts: Object.assign({}, state.cooldownTexts),
    });
  }

  function initMobileControls(scene) {
    state.scene = scene;
    state.buttons = [];
    state.cooldownTexts = {};

    // ----- Inventory ("Bag") button -----
    // Invisible transparent rectangle as the interactive hit target (anchored
    // top-right via its own origin); a visible label rides on top. Using a
    // rectangle avoids the Text + custom hitArea origin bug that prevented
    // taps from registering.
    const bagHitW = 56, bagHitH = 36;
    const bagHit = scene.add.rectangle(0, 0, bagHitW, bagHitH, 0x222222, 0.85)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(4000)
      .setStrokeStyle(1, 0x444444)
      .setInteractive({ useHandCursor: true });
    bagHit.on('pointerdown', () => {
      if (typeof invOpen !== 'undefined' && invOpen) {
        if (typeof closeInventory === 'function') closeInventory();
      } else if (typeof openInventory === 'function') {
        openInventory();
      }
    });
    const bagLabel = scene.add.text(0, 0, 'Bag', {
      fontSize: '16px', fill: '#fff', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(4001);
    state.inventoryBtn = bagLabel;
    state.inventoryBtnHit = bagHit;

    // ----- Skills button (next to Bag) -----
    const skillHitW = 56, skillHitH = 36;
    const skillHit = scene.add.rectangle(0, 0, skillHitW, skillHitH, 0x222244, 0.85)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(4000)
      .setStrokeStyle(1, 0x444466).setInteractive({ useHandCursor: true });
    skillHit.on('pointerdown', () => openSkillSelectionOverlay(scene));
    const skillLabel = scene.add.text(0, 0, 'Skills', {
      fontSize: '14px', fill: '#aaf', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(4001);
    state.skillBtn = skillLabel;
    state.skillBtnHit = skillHit;

    // ----- Joystick (fixed bottom-left) -----
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
    window.joystick = joystick;

    // ----- Ability + potion buttons -----
    const handlers = {
      attack: { onDown: attack,              onUp: null },
      spin:   { onDown: spinAttack,          onUp: null },
      charge: { onDown: beginChargedSlash,   onUp: releaseChargedSlash },
      dash:   { onDown: dashSlash,           onUp: null },
      dagger: { onDown: throwDagger,         onUp: null },
      shield: { onDown: shieldBash,          onUp: null },
      potion:   { onDown: _usePotion, onUp: null },
      interact: { onDown: _interact,  onUp: null },
    };

    ABILITY_LAYOUT.forEach((spec) => {
      if (!_isAbilityVisible(spec)) return;
      const h = handlers[spec.key];
      if (!h) return;
      const { circle, hitHalf } = _makeAbilityButton(scene, spec, h.onDown, h.onUp);
      state.buttons.push({ spec, circle, hitHalf });
      if (spec.key === 'attack') window.attackBtn = circle;
      if (spec.key === 'spin')   window.spinBtn = circle;
      if (spec.key === 'charge') window.chargeSlashBtn = circle;
      if (spec.key === 'dash')   window.dashSlashBtn = circle;
      if (spec.key === 'dagger') window.daggerThrowBtn = circle;
      if (spec.key === 'shield') window.shieldBashBtn = circle;
    });

    // Destroy previous cooldown texts if any, then create fresh per equipped button.
    [
      'attackBtnCooldownText', 'spinBtnCooldownText',
      'chargeSlashCooldownText', 'dashSlashCooldownText',
      'daggerThrowCooldownText', 'shieldBashCooldownText',
    ].forEach((g) => { if (window[g] && window[g].destroy) window[g].destroy(); });

    const cdFor = (key) => {
      if (!state.buttons.some((b) => b.spec.key === key)) return null;
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

    _positionAll(scene.scale.width, scene.scale.height);

    scene.scale.on('resize', (gs) => {
      _positionAll(gs.width, gs.height);
      _dispatch('demonfall:mobile-layout-changed', {
        scene, width: gs.width, height: gs.height,
      });
    });

    _dispatch('demonfall:mobile-layout-ready', {
      scene,
      buttons: state.buttons.map(({ spec, circle, hitHalf }) => ({ spec, circle, hitHalf })),
      joystick: state.joystick,
      inventoryBtn: state.inventoryBtn,
      cooldownTexts: Object.assign({}, state.cooldownTexts),
    });

    // --- Tap-to-move + hold-to-move (038-mobile-d2-controls) ---
    const JOYSTICK_ZONE_RADIUS = 120; // px from joystick center
    let holdMoveThrottle = 0;
    scene.input.on('pointerdown', (pointer) => {
      // D2 controls must be enabled
      if (window.__MOBILE_D2_CONTROLS__ === false) return;
      // Ignore if tapping on UI (right side ability area or top bar)
      if (pointer.x > scene.scale.width * 0.65 && pointer.y > scene.scale.height * 0.4) return;
      if (pointer.y < 60) return; // top HUD bar
      // Ignore if in joystick zone
      const jx = state.joystick ? state.joystick.base.x : 100;
      const jy = state.joystick ? state.joystick.base.y : scene.scale.height - 100;
      const jdx = pointer.x - jx, jdy = pointer.y - jy;
      if (jdx * jdx + jdy * jdy < JOYSTICK_ZONE_RADIUS * JOYSTICK_ZONE_RADIUS) return;
      // Ignore if any interactive UI was hit
      if (pointer.camera && scene.input.hitTestPointer) {
        const hits = scene.input.hitTestPointer(pointer);
        if (hits && hits.length > 0) return;
      }
      // Convert screen to world coords
      const cam = scene.cameras.main;
      if (!cam) return;
      const worldPt = cam.getWorldPoint(pointer.x, pointer.y);
      // Check if tapped on an enemy — move toward + attack
      if (typeof enemies !== 'undefined' && enemies && enemies.children) {
        let tappedEnemy = null;
        let bestDist = 40;
        enemies.children.iterate((e) => {
          if (!e || !e.active) return;
          const edx = e.x - worldPt.x, edy = e.y - worldPt.y;
          const d = Math.hypot(edx, edy);
          if (d < bestDist) { bestDist = d; tappedEnemy = e; }
        });
        if (tappedEnemy) {
          window.__MOBILE_MOVE_TARGET__ = { x: tappedEnemy.x, y: tappedEnemy.y };
          if (typeof attack === 'function' && player) {
            const adist = Math.hypot(tappedEnemy.x - player.x, tappedEnemy.y - player.y);
            if (adist < (window.attackRange || 60) + 20) attack.call(scene);
          }
          return;
        }
      }
      window.__MOBILE_MOVE_TARGET__ = { x: worldPt.x, y: worldPt.y };
    });
    scene.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      if (!window.__MOBILE_MOVE_TARGET__) return;
      // Throttle to ~15 updates/sec
      const now = Date.now();
      if (now - holdMoveThrottle < 66) return;
      holdMoveThrottle = now;
      const cam = scene.cameras.main;
      if (!cam) return;
      const worldPt = cam.getWorldPoint(pointer.x, pointer.y);
      window.__MOBILE_MOVE_TARGET__ = { x: worldPt.x, y: worldPt.y };
    });
    scene.input.on('pointerup', () => {
      // Don't clear target — let player walk to last tapped position
    });

    // Rebuild mobile buttons whenever the desktop HUD refreshes (i.e. when
    // the loadout changes or a new ability is learned/equipped).
    const prevRefresh = window._refreshAbilityHUD;
    window._refreshAbilityHUD = function () {
      if (typeof prevRefresh === 'function') {
        try { prevRefresh.apply(this, arguments); } catch (e) { /* ignore */ }
      }
      try { _rebuildAbilityButtons(); } catch (e) { console.warn('[mobileControls] rebuild failed', e); }
    };
  }

  function getMobileAbilityButtonAnchor() {
    return state.anchor ? Object.assign({}, state.anchor) : null;
  }

  function getMobileLeftPointerRegion() {
    if (!state.scene) return null;
    const sa = _safeArea();
    const w = state.scene.scale.width;
    const h = state.scene.scale.height;
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
      key: spec.key, x: circle.x, y: circle.y, halfW: hitHalf, halfH: hitHalf,
    }));
  }

  // --- Mobile skill selection overlay (039-mobile-skill-selection) ---
  function openSkillSelectionOverlay(scene) {
    if (!scene || !window.AbilitySystem) return;
    if (scene._skillOverlayActive) return;
    scene._skillOverlayActive = true;

    var cam = scene.cameras && scene.cameras.main;
    var cw = cam ? cam.width : 960;
    var ch = cam ? cam.height : 480;
    var cx = cw / 2;
    var cy = ch / 2;
    var elements = [];

    // Dim overlay
    var overlay = scene.add.rectangle(cx, cy, cw, ch, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(4500).setInteractive();
    elements.push(overlay);

    // Title
    var title = scene.add.text(cx, cy - 100, 'Skill Auswahl', {
      fontSize: '20px', fill: '#ffd166', fontFamily: 'serif', fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(4501);
    elements.push(title);

    // Get all learned abilities
    var learned = window.AbilitySystem.getLearnedAbilities();
    var loadout = window.AbilitySystem.getActiveLoadout();
    var SLOTS = window.AbilitySystem.SLOT_KEYS;
    var DEFS = window.AbilitySystem.ABILITY_DEFS;

    var cleanup = function () {
      scene._skillOverlayActive = false;
      for (var i = 0; i < elements.length; i++) {
        if (elements[i] && elements[i].destroy) elements[i].destroy();
      }
    };

    // Show slot buttons at top
    var slotY = cy - 60;
    SLOTS.forEach(function (slot, si) {
      var abilityId = loadout[slot];
      var def = abilityId ? DEFS[abilityId] : null;
      var label = (si + 1) + ': ' + (def ? def.name : '(leer)');
      var slotBg = scene.add.rectangle(cx, slotY + si * 38, 220, 32, 0x333355)
        .setStrokeStyle(2, 0xffd166).setScrollFactor(0).setDepth(4502)
        .setInteractive({ useHandCursor: true });
      var slotText = scene.add.text(cx, slotY + si * 38, label, {
        fontSize: '13px', fill: '#f1e9d8', fontFamily: 'monospace'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(4503);
      elements.push(slotBg);
      elements.push(slotText);

      slotBg.on('pointerdown', function () {
        // Show available skills for this slot
        openSlotPicker(scene, slot, elements, cleanup);
      });
    });

    // Close button
    var closeBg = scene.add.rectangle(cx, cy + 110, 120, 32, 0x3a3a3a)
      .setStrokeStyle(2, 0xd4a543).setScrollFactor(0).setDepth(4502)
      .setInteractive({ useHandCursor: true });
    var closeText = scene.add.text(cx, cy + 110, 'Schliessen', {
      fontSize: '13px', fill: '#f1e9d8', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(4503);
    elements.push(closeBg);
    elements.push(closeText);
    closeBg.on('pointerdown', cleanup);
    overlay.on('pointerdown', cleanup);
  }

  function openSlotPicker(scene, slot, parentElements, parentCleanup) {
    var cam = scene.cameras && scene.cameras.main;
    var cw = cam ? cam.width : 960;
    var ch = cam ? cam.height : 480;
    var cx = cw / 2;
    var cy = ch / 2;
    var elements = [];

    var overlay2 = scene.add.rectangle(cx, cy, cw, ch, 0x000000, 0.5)
      .setScrollFactor(0).setDepth(4600).setInteractive();
    elements.push(overlay2);

    var title = scene.add.text(cx, 40, 'Waehle Skill fuer ' + slot.toUpperCase(), {
      fontSize: '16px', fill: '#ffd166', fontFamily: 'serif'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(4601);
    elements.push(title);

    var learned = window.AbilitySystem.getLearnedAbilities();
    var DEFS = window.AbilitySystem.ABILITY_DEFS;
    var cleanup2 = function () {
      for (var i = 0; i < elements.length; i++) {
        if (elements[i] && elements[i].destroy) elements[i].destroy();
      }
    };

    var rowY = 80;
    learned.forEach(function (id) {
      var def = DEFS[id];
      if (!def) return;
      var bg = scene.add.rectangle(cx, rowY, 200, 30, 0x2a2a5a)
        .setStrokeStyle(1, 0x6666aa).setScrollFactor(0).setDepth(4602)
        .setInteractive({ useHandCursor: true });
      var text = scene.add.text(cx, rowY, (def.icon || '') + ' ' + def.name, {
        fontSize: '13px', fill: '#f1e9d8', fontFamily: 'monospace'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(4603);
      elements.push(bg);
      elements.push(text);
      bg.on('pointerdown', function () {
        window.AbilitySystem.setSlot(slot, id);
        cleanup2();
        parentCleanup();
        // Refresh mobile buttons
        if (state.scene && typeof initMobileControls === 'function') {
          // Dispatch event so layout can refresh
          _dispatch('demonfall:skill-equipped', { slot: slot, skillKey: id });
        }
      });
      rowY += 36;
    });

    // Cancel
    var cancelBg = scene.add.rectangle(cx, rowY + 10, 120, 28, 0x3a3a3a)
      .setStrokeStyle(1, 0xd4a543).setScrollFactor(0).setDepth(4602)
      .setInteractive({ useHandCursor: true });
    var cancelText = scene.add.text(cx, rowY + 10, 'Abbrechen', {
      fontSize: '12px', fill: '#f1e9d8', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(4603);
    elements.push(cancelBg);
    elements.push(cancelText);
    cancelBg.on('pointerdown', cleanup2);
  }

  window.initMobileControls = initMobileControls;
  window.getMobileAbilityButtonAnchor = getMobileAbilityButtonAnchor;
  window.getMobileLeftPointerRegion = getMobileLeftPointerRegion;
  window.getMobileAbilityButtonHitRects = getMobileAbilityButtonHitRects;
  window.openSkillSelectionOverlay = openSkillSelectionOverlay;
})();
