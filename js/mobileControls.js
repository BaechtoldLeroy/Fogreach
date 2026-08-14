// mobileControls.js — Single entry point for mobile control UI.

if (window.i18n) {
  window.i18n.register('de', { 'mobile.close': 'Schliessen' });
  window.i18n.register('en', { 'mobile.close': 'Close' });
}

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
  // ----- "Diablo-Immortal"-Layout: Tuning-Konstanten -----
  // (Muss VOR ABILITY_LAYOUT stehen — die *_FACTOR-Konstanten werden dort beim
  // Init genutzt.) Geometrie in _fanLayout() umgesetzt, gegen Overlap und
  // Bildschirmgrenzen für alle Button-Scales (0.8/1.0/1.2) und Safe-Area-
  // Insets numerisch verifiziert (Rechercheskript, siehe tools/fanlayout.js).
  // Vorbild Diablo Immortal: EIN grosser Angriff/Aktion-Button in der Ecke,
  // ein enger Faecher aus deutlich KLEINEREN Skill-Buttons direkt daran
  // (kein gleich grosser Ring — das war der Schluessel, um DIs Look zu
  // treffen), Dash separat und bodennah, Trank oben rechts. Nur 6 Buttons
  // im Cluster (wie DI) + der Trank on top, den DI nicht hat.
  const PRIMAR_FACTOR = 1.9;    // Angriff/Aktion — deutlich groesstes Ziel
  const SKILL_FACTOR  = 0.9;    // Skills 1-4 — kleiner als Primär, eng gefaechert
  const TRANK_FACTOR  = 0.85;   // Trank — etwas kleiner als Basis
  const CORNER_INSET_X = 50;    // Primär-Versatz von der Ecke (X)
  const SKILL_GAP       = 12;   // Rand-Abstand zwischen benachbarten Skills
  const SKILL_ARC_START = 35;   // Winkel (° ab Horizontale) des ersten Skills (S1, rechts)
  const DASH_OFFSET_X   = 130;  // Dash-Versatz links vom Primär-Zentrum
  const TRANK_GAP        = 4;   // Rand-Abstand Trank -> Skills 1/2
  const TRANK_EDGE_PAD   = 4;   // Trank-Abstand vom rechten Bildschirmrand

  // 054 (slot-index Layout): die 4 mittleren Cells sind generische Slot-
  // Buttons (slot1-4) die zur Laufzeit von AbilitySystem.getActiveLoadout()
  // mit der equipped-Ability gefüllt werden. abilityId matcht isEquipped()-IDs;
  // null = immer sichtbar (Angriff, Trank).
  // #80/Diablo-Immortal-Layout: `pos` ist ein STABILER Positions-Schlüssel
  // (überlebt _runtimeSpec, das spec.key auf die Ability-id umschreibt) — die
  // Geometrie liegt in _fanLayout.
  //  - primar: großer kontext-sensitiver Angriff/Aktion-Button in der Ecke.
  //  - dash:   eigener, bodennaher Button links vom Primär.
  //  - S1..S4: enger Skill-Fächer direkt am Primär (kleinere Buttons).
  //  - trank:  oben rechts über Skill 1+2.
  const ABILITY_LAYOUT = [
    { key: 'attack',   pos: 'primar', radiusFactor: PRIMAR_FACTOR, color: 0xff0000, abilityId: null },
    { key: 'slot1',    pos: 'S1',     radiusFactor: SKILL_FACTOR, color: 0x888888, slotIndex: 1 },
    { key: 'slot2',    pos: 'S2',     radiusFactor: SKILL_FACTOR, color: 0x888888, slotIndex: 2 },
    { key: 'slot3',    pos: 'S3',     radiusFactor: SKILL_FACTOR, color: 0x888888, slotIndex: 3 },
    { key: 'slot4',    pos: 'S4',     radiusFactor: SKILL_FACTOR, color: 0x888888, slotIndex: 4 },
    { key: 'roll',     pos: 'dash',   color: 0x8844cc, abilityId: null },
    { key: 'potion',   pos: 'trank',  radiusFactor: TRANK_FACTOR, color: 0xd02040, abilityId: null },
  ];

  // Mapping classic-ability-id → desktop-Cooldown-Window-Refs.
  // startCooldownTimer in player.js setzt diese refs für den Tween/Label —
  // wir wired sie pro Rebuild damit der Cooldown-Visual am richtigen Mobile-
  // Button sitzt. Neue Abilities (heilwunde etc.) haben keine refs, deren
  // Cooldown wird via AbilitySystem.getCooldownRemaining gepollt.
  const CLASSIC_REFS = {
    spinAttack:  { btnRef: 'spinBtn',          cdRef: 'spinBtnCooldownText'     },
    chargeSlash: { btnRef: 'chargeSlashBtn',   cdRef: 'chargeSlashCooldownText' },
    dashSlash:   { btnRef: 'dashSlashBtn',     cdRef: 'dashSlashCooldownText'   },
    daggerThrow: { btnRef: 'daggerThrowBtn',   cdRef: 'daggerThrowCooldownText' },
    shieldBash:  { btnRef: 'shieldBashBtn',    cdRef: 'shieldBashCooldownText'  },
  };

  // Ability-Info aus AbilitySystem.ABILITY_DEFS — funktioniert für ALLE
  // Abilities (Classic + neue: heilwunde/frostnova/blutopfer/schattenschritt).
  // Handler gehen über AbilitySystem.tryActivate/tryRelease — selber Pfad
  // wie Desktop-Slot-Keys (Q/W/E/R).
  function _abilityInfo(id, slotKey) {
    const defs = window.AbilitySystem && window.AbilitySystem.ABILITY_DEFS;
    if (!defs || !defs[id]) return null;
    const def = defs[id];
    const isCharge = def.type === 'charge';
    const refs = CLASSIC_REFS[id] || {};
    return {
      color: def.color || 0x888888,
      glyph: def.icon || '?',
      label: def.name || id,
      decKey: id, // ability-id wird als spec.key benutzt; mobileAbilityButtons fällt auf spec._glyph/_label zurück
      btnRef: refs.btnRef || null,
      cdRef: refs.cdRef || null,
      onDown: function () {
        if (window.AbilitySystem && typeof window.AbilitySystem.tryActivate === 'function') {
          window.AbilitySystem.tryActivate(slotKey, this);
        }
      },
      onUp: isCharge ? function () {
        if (window.AbilitySystem && typeof window.AbilitySystem.tryRelease === 'function') {
          window.AbilitySystem.tryRelease(slotKey, this);
        }
      } : null,
    };
  }

  function _resolveSlot(spec) {
    if (!spec.slotIndex) return null;
    const loadout = window.AbilitySystem && typeof window.AbilitySystem.getActiveLoadout === 'function'
      ? window.AbilitySystem.getActiveLoadout()
      : null;
    if (!loadout) return null;
    const slotKey = 'slot' + spec.slotIndex;
    const id = loadout[slotKey];
    if (!id) return null;
    const info = _abilityInfo(id, slotKey);
    if (!info) return null;
    return Object.assign({ id }, info);
  }

  function _runtimeSpec(origSpec) {
    if (!origSpec.slotIndex) return Object.assign({}, origSpec);
    const info = _resolveSlot(origSpec);
    if (!info) return null;
    return Object.assign({}, origSpec, {
      key: info.decKey,
      color: info.color,
      _abilityId: info.id,
      _glyph: info.glyph,
      _label: info.label,
      _onDown: info.onDown,
      _onUp: info.onUp,
      _btnRef: info.btnRef,
      _cdRef: info.cdRef,
    });
  }

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

  // Polar "Daumen-Bogen"-Layout: liefert die Button-Zentren je Positions-Schlüssel
  // (primar/dash/S1..S4/trank) im 960×480-Canvas. Primär hugt die Ecke; Skills
  // 1-4 faechern eng um ihn herum (kleinerer Radius als Primär — DAS ist der
  // Schluessel zum DI-Look: ein reiner Ring aus GLEICH grossen Buttons zwingt
  // 4 Kreise mathematisch auf einen Bogen von >150° [siehe Recherche-Skripte
  // di.js-di8.js in der Session] — mit kleineren Skills bleibt der Faecher eng
  // UND kollisionsfrei). Dash ist bodennah UND vom Primär-Radius komplett
  // getrennt platziert (Primär ist riesig — dashDx muss gross genug sein, um
  // den Primär-Umkreis zu meiden). Trank oben rechts ueber Skill 1+2.
  // Alle Werte fuer Scale 0.8/1.0/1.2 + Safe-Area-Insets numerisch verifiziert.
  function _fanLayout(screenW, screenH) {
    const scale = _buttonScale();
    const sa = _safeArea();
    const BR = BASE_RADIUS * scale;
    const PR = BR * PRIMAR_FACTOR;
    const SR = BR * SKILL_FACTOR;
    const TR = BR * TRANK_FACTOR;
    const Gs = SKILL_GAP * scale;
    const Cx = screenW - (CORNER_PAD + sa.right);   // untere-rechte Ecke
    const Cy = screenH - (CORNER_PAD + sa.bottom);
    const Px = Cx - PR - CORNER_INSET_X * scale;
    const Py = Cy - PR;                              // Primär bodenbuendig

    const pos = {};
    pos.primar = { x: Px, y: Py };
    // Dash: eigener bodenbuendiger Anker, links vom Primär-Zentrum versetzt.
    pos.dash = { x: Px - DASH_OFFSET_X * scale, y: Cy - BR };

    // Skill-Faecher: enger Bogen um Primär, Winkelschritt aus Skillgroesse
    // abgeleitet (wie beim vorherigen Layout) -> kein Overlap/keine Luecken.
    const Rs = PR + SR + Gs;
    const chord = 2 * SR + Gs;
    const dBeta = 2 * Math.asin(Math.min(1, chord / (2 * Rs)));
    const start = SKILL_ARC_START * Math.PI / 180;
    const skillY = [];
    for (let k = 0; k < 4; k++) {
      const th = start + k * dBeta;
      const sx = Px + Rs * Math.cos(th);
      const sy = Py - Rs * Math.sin(th);
      pos['S' + (k + 1)] = { x: sx, y: sy };
      skillY.push(sy);
    }

    // Trank: rechter Bildschirmrand, ueber Skill 1+2 (grosser Horizontal-
    // Abstand zu S3/S4 -> braucht keinen vollen Durchmesser Vertikalpuffer).
    const minSkillY = Math.min(skillY[0], skillY[1]);
    pos.trank = {
      x: Cx - TR - TRANK_EDGE_PAD * scale,
      y: minSkillY - TR - SR - TRANK_GAP * scale,
    };
    return pos;
  }

  function _anchorOrigin(screenW, screenH) {
    const sa = _safeArea();
    const cs = _cellSide();
    const cols = 4, rows = 2;  // 054 final: 2×4-Grid (Roll ersetzt Shield in row 1)
    const right = screenW - (CORNER_PAD + sa.right);
    const bottom = screenH - (CORNER_PAD + sa.bottom);
    return { x: right - cs * cols, y: bottom - cs * rows, cellWidth: cs, cellHeight: cs };
  }

  function _dispatch(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); }
    catch (err) { /* ignore */ }
  }

  function _isAbilityVisible(spec) {
    if (spec.slotIndex) return !!_resolveSlot(spec);
    if (!spec.abilityId) return true;
    if (window.AbilitySystem && typeof window.AbilitySystem.isEquipped === 'function') {
      return !!window.AbilitySystem.isEquipped(spec.abilityId);
    }
    return true; // fall back to visible if system isn't ready
  }

  function _makeAbilityButton(scene, spec, onDown, onUp) {
    const scale = _buttonScale();
    const rf = (typeof spec.radiusFactor === 'number' && spec.radiusFactor > 0) ? spec.radiusFactor : 1;
    const visualRadius = BASE_RADIUS * scale * rf;
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
    const fan = _fanLayout(screenW, screenH);
    state.buttons.forEach(({ circle, spec }) => {
      const pos = fan[spec.pos] || fan.primar;
      circle.setPosition(pos.x, pos.y);
    });
    Object.keys(state.cooldownTexts).forEach((key) => {
      // Cooldown-Text-Position folgt der Button-Position desselben Keys.
      // Bei slot-Cells ist key = decKey (z.B. 'spin') = aktueller spec.key;
      // spec.pos (Positions-Schlüssel) überlebt _runtimeSpec.
      const btn = state.buttons.find((b) => b.spec.key === key);
      if (!btn) return;
      const pos = fan[btn.spec.pos] || fan.primar;
      state.cooldownTexts[key].setPosition(pos.x, pos.y);
    });

    // (Removed: Bag + Skills mobile button positioning. Both functions
    // now live on the HUDv2 top-right icons, shared between desktop and
    // mobile.)

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

  // #065 Kontext-Primärbutton: ist ein FRIEDLICHES Interaktionsziel in Reichweite?
  // (NPC/Tür/Loot/Event/Treppe — NICHT Gegner, NICHT zerstörbare Props). Reine
  // Query aus bestehenden Signalen (C-003):
  //  - Hub: HubSceneV2._activeInteractable.
  //  - Dungeon: Tür in Reichweite (DoorSystem.isDoorInRange) ODER ein sichtbarer
  //    "[E]"-Interakt-Prompt (Tür/Händler/Schrein/Treppe/Loot zeigen alle "[E] …";
  //    zerstörbare Props/Gegner zeigen KEINEN [E]-Prompt -> bleiben Angriff).
  // Defensiv: im Zweifel false (Angriff bleibt möglich).
  function _hasVisibleInteractPrompt(scene) {
    try {
      const list = scene && scene.children && scene.children.list;
      if (!list) return false;
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c && c.type === 'Text' && c.visible !== false &&
            typeof c.text === 'string' && c.text.indexOf('[E]') === 0) return true;
      }
    } catch (e) { /* defensiv */ }
    return false;
  }
  // Ist ein lebender Gegner näher als `range` am Spieler? (Kampf-Nähe)
  const _PEACE_ENEMY_RANGE = 240;
  function _enemyNearby(p, range) {
    try {
      const grp = (typeof enemies !== 'undefined' && enemies) ? enemies : window.enemies;
      if (!grp || typeof grp.getChildren !== 'function') return false;
      const arr = grp.getChildren();
      const r2 = range * range;
      for (let i = 0; i < arr.length; i++) {
        const e = arr[i];
        if (!e || !e.active) continue;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < r2) return true;
      }
    } catch (e) { /* defensiv */ }
    return false;
  }
  function hasPeacefulTarget(scene) {
    if (!scene) return false;
    const p = (typeof player !== 'undefined' && player) ? player : window.player;
    // #065-Refinement (Nutzer): "Aktion" NUR wenn keine Gegner in der Nähe sind —
    // im Kampf will man neben Tür/Loot angreifen, nicht interagieren.
    if (p && _enemyNearby(p, _PEACE_ENEMY_RANGE)) return false;
    if (scene._activeInteractable) return true; // Hub-NPC/Gebäude
    if (window.DoorSystem && typeof window.DoorSystem.isDoorInRange === 'function'
        && p && window.DoorSystem.isDoorInRange(scene, p)) return true; // Dungeon-Tür
    return _hasVisibleInteractPrompt(scene); // Events/Treppe/Händler/Loot ([E]-Prompt)
  }
  window.hasPeacefulTarget = hasPeacefulTarget;

  function _rebuildAbilityButtons() {
    const scene = state.scene;
    if (!scene) return;

    // Tear down existing buttons + their cooldown texts (ability buttons only;
    // joystick, bag, and potion glue stay intact).
    state.buttons.forEach(({ circle }) => { if (circle && circle.destroy) circle.destroy(); });
    Object.values(state.cooldownTexts).forEach((t) => { if (t && t.destroy) t.destroy(); });
    state.buttons = [];
    state.cooldownTexts = {};

    _buildButtonsAndCooldowns(scene);
    _positionAll(scene.scale.width, scene.scale.height);
    _dispatch('demonfall:mobile-layout-ready', {
      scene,
      buttons: state.buttons.map(({ spec, circle, hitHalf }) => ({ spec, circle, hitHalf })),
      joystick: state.joystick,
      inventoryBtn: state.inventoryBtn,
      cooldownTexts: Object.assign({}, state.cooldownTexts),
    });
  }

  // Shared build logic für initMobileControls + _rebuildAbilityButtons.
  // Iteriert ABILITY_LAYOUT, resolved slot-Cells zur aktuellen Loadout-
  // Ability, baut Circle + Cooldown-Label + wired window.*Btn-refs.
  function _buildButtonsAndCooldowns(scene) {
    const staticHandlers = {
      // #065 Primärbutton: kontext-sensitiv. Friedliches Ziel in Reichweite ->
      // Interaktion (Dialog/Tür/Loot), sonst Angriff. Genau EIN Pfad pro Tap,
      // entschieden nach dem zum Tap-Zeitpunkt gültigen Kontext.
      attack:   { onDown: function () {
        if (hasPeacefulTarget(this)) { _interact(); }
        else if (typeof attack === 'function') { attack.call(this); }
      }, onUp: null },
      potion:   { onDown: _usePotion, onUp: null },
      interact: { onDown: _interact,  onUp: null }, // Legacy-Handler (Zelle entfernt), harmlos
      roll:     { onDown: performRoll, onUp: null },
    };

    // Reset alle ability-id-basierten window-Refs — werden unten neu gesetzt
    // wenn die Ability im aktuellen Loadout ist. Sonst bleiben sie null und
    // startCooldownTimer behandelt das via null-guard.
    window.spinBtn = null;
    window.chargeSlashBtn = null;
    window.dashSlashBtn = null;
    window.daggerThrowBtn = null;
    window.shieldBashBtn = null;
    window.spinBtnCooldownText = null;
    window.chargeSlashCooldownText = null;
    window.dashSlashCooldownText = null;
    window.daggerThrowCooldownText = null;
    window.shieldBashCooldownText = null;

    ABILITY_LAYOUT.forEach((origSpec) => {
      const spec = _runtimeSpec(origSpec);
      if (!spec) return; // slot leer
      let onDown, onUp;
      if (spec._onDown) {
        onDown = spec._onDown;
        onUp = spec._onUp || null;
      } else {
        const h = staticHandlers[spec.key];
        if (!h) return;
        onDown = h.onDown;
        onUp = h.onUp;
      }
      const { circle, hitHalf } = _makeAbilityButton(scene, spec, onDown, onUp);
      state.buttons.push({ spec, circle, hitHalf });
      if (spec.key === 'attack') window.attackBtn = circle;
      if (spec._btnRef) window[spec._btnRef] = circle;
    });

    const cdFor = (key) => {
      if (!state.buttons.some((b) => b.spec.key === key)) return null;
      const t = _makeCooldownLabel(scene);
      state.cooldownTexts[key] = t;
      return t;
    };
    window.attackBtnCooldownText = cdFor('attack');
    state.buttons.forEach((b) => {
      if (b.spec._cdRef) {
        window[b.spec._cdRef] = cdFor(b.spec.key);
      }
    });
  }

  function initMobileControls(scene) {
    state.scene = scene;
    state.buttons = [];
    state.cooldownTexts = {};

    // (Removed: dedicated 'Bag' mobile button + 'Skills' mobile button.
    // Both functions now live on the HUDv2 top-right icons (inventory icon
    // + burger menu's Loadout entry), shared between desktop and mobile.)

    // ----- Joystick (fixed bottom-left) -----
    // Plugin defensiv: fehlt es (CDN-Fehler/Tracking-Prevention), läuft der Rest
    // der Mobile-Steuerung (Ability-Buttons etc.) weiter — nur ohne Joystick.
    // Downstream-Code prüft state.joystick bereits auf null.
    const joystickPlugin = scene.plugins.get('rexVirtualJoystick');
    if (joystickPlugin) {
      const joystickBase = scene.add.circle(0, 0, 60, 0x888888, 0.3);
      const joystickThumb = scene.add.circle(0, 0, 30, 0xcccccc, 0.5);
      const joystick = joystickPlugin.add(scene, {
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
    } else {
      console.warn('[mobileControls] rexVirtualJoystick plugin missing — joystick disabled');
      state.joystick = null;
    }

    // Destroy previous cooldown texts if any, then create fresh per equipped button.
    [
      'attackBtnCooldownText', 'spinBtnCooldownText',
      'chargeSlashCooldownText', 'dashSlashCooldownText',
      'daggerThrowCooldownText', 'shieldBashCooldownText',
    ].forEach((g) => { if (window[g] && window[g].destroy) window[g].destroy(); });

    // ----- Ability + potion buttons -----
    _buildButtonsAndCooldowns(scene);

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
      // #80/RW-07 Floating Joystick: der Bewegungs-Stick erscheint dort, wo der
      // LINKE Daumen aufsetzt (statt fest unten-links). Reposition der rex-Basis
      // auf den Touch — rex startet das Tracking via pointerover-Recapture (KEIN
      // setVisible, das war der alte Blocker). Additiv: Tap-to-Move bleibt als
      // Fallback, falls rex nicht recaptured -> Bewegung kann nicht ganz brechen.
      let _floating = false;
      if (state.joystick && pointer.x < scene.scale.width * 0.5) {
        try {
          state.joystick.base.setPosition(pointer.x, pointer.y);
          if (state.joystick.thumb) state.joystick.thumb.setPosition(pointer.x, pointer.y);
          _floating = true;
        } catch (e) { /* defensiv */ }
      }
      // Ignore if in joystick zone — aber NICHT wenn wir gerade floating
      // repositioniert haben (dann soll Tap-to-Move als Fallback durchlaufen).
      if (!_floating) {
        const jx = state.joystick ? state.joystick.base.x : 100;
        const jy = state.joystick ? state.joystick.base.y : scene.scale.height - 100;
        const jdx = pointer.x - jx, jdy = pointer.y - jy;
        if (jdx * jdx + jdy * jdy < JOYSTICK_ZONE_RADIUS * JOYSTICK_ZONE_RADIUS) return;
      }
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
    scene.input.on('pointerup', (pointer) => {
      // Don't clear target — let player walk to last tapped position.
      // #80/RW-07: Floating Joystick beim Loslassen (linke Seite) auf die feste
      // Ruheposition zurücksetzen, damit er nicht mitten im Bild hängen bleibt.
      if (state.joystick && pointer && pointer.x < scene.scale.width * 0.5) {
        try {
          const rx = 100, ry = scene.scale.height - 100;
          state.joystick.base.setPosition(rx, ry);
          if (state.joystick.thumb) state.joystick.thumb.setPosition(rx, ry);
        } catch (e) { /* defensiv */ }
      }
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
    var closeText = scene.add.text(cx, cy + 110, (window.i18n ? window.i18n.t('mobile.close') : 'Schliessen'), {
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

    var title = scene.add.text(cx, 40, 'Wähle Skill für ' + slot.toUpperCase(), {
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
