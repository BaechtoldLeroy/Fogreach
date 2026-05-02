// tutorialOverlay.js — Phaser overlay that visualizes the active tutorial step.
//
// Subscribes to window.TutorialSystem.onChange and renders two things:
//   1) A persistent hint banner pinned bottom-center, displaying the current
//      step's localized hint text (via window.i18n.t).
//   2) A pulsing yellow outline around the current step's targetRef (entrance
//      hitbox rectangle or NPC sprite circle).
//
// Public surface (window.TutorialOverlay):
//   create(scene) -> overlay
//   overlay.mount()    — subscribe + initial render
//   overlay.unmount()  — unsubscribe + destroy all visuals + tweens
//
// Conventions follow js/hudV2.js (depth ordering, monospace fonts, scrollFactor)
// and js/inputScheme.js (IIFE attaching window.X namespace).
//
// Depth budget (chosen to sit above gameplay, below modal dialogs which use
// 2000+ in HUDv2):
//   highlight outline : 1490
//   banner background : 1500
//   banner text       : 1501
//
// Target ref resolution (T005): HUB_HITBOXES is a struct
// `{ colliders, entrances, npcs }`. For a given { type, name } we scan the
// matching list and accept either an exact id match or a case-insensitive
// substring match against entrance.label / npc.name (the data-model ref names
// like "Werkstatt" / "Branka" map to "Werkstatt [E]" / "Schmiedemeisterin
// Branka" in the hitbox table). If HUB_HITBOXES is unavailable we fall back
// to scanning scene.children.list for objects with data.get('hitboxName')
// matching the ref name. If both fail we log a warning and skip the highlight
// (NEVER throw — NFR-03 forbids overlay errors from breaking gameplay).

(function () {
  'use strict';

  // Depth budget — must stay BELOW 1500 because HubSceneV2._closeDialog
  // does a defensive sweep that destroys every game object with depth in
  // [1500, 1700). Banner used to live at 1500/1501 and got nuked on every
  // dialog close, leaving a blank screen for the next step's hint.
  // Chevron at 1492 sits just below the banner; dialog modals at 1500+
  // still cover the banner during dialog while the HUD remains readable.
  var BANNER_DEPTH      = 1495;
  var BANNER_TEXT_DEPTH = 1496;
  var HIGHLIGHT_DEPTH   = 1492;
  var BANNER_HEIGHT   = 64;
  var BANNER_BOTTOM_OFFSET = 32; // distance from bottom edge of camera
  var BANNER_BG_COLOR = 0x000000;
  var BANNER_BG_ALPHA = 0.78;
  var BANNER_TEXT_STYLE = {
    fontFamily: 'monospace',
    fontSize: '20px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 2,
    align: 'center'
  };
  var HIGHLIGHT_COLOR = 0xffd95a; // warm gold; contrasts hub + dungeon palettes
  var HIGHLIGHT_PULSE_DURATION_MS = 500; // 1 Hz cycle (yoyo: 500ms each way)
  // Chevron / arrow indicator dimensions. The indicator is a downward-pointing
  // triangle hovering above the target with a slight bob + alpha pulse so the
  // player's eye is drawn naturally without a hard rectangle outline.
  var INDICATOR_WIDTH = 36;
  var INDICATOR_HEIGHT = 28;
  var INDICATOR_GAP = 18;       // px above target's top edge
  var INDICATOR_BOB_PX = 6;     // amplitude of the up/down bob
  var INDICATOR_BOB_DURATION_MS = 700;

  // ---------- hint key resolution (input-scheme + mobile aware) ----------
  //
  // Some hints reference specific bindings that differ by control scheme
  // (classic = arrows + Space + QWER vs arpg = WASD + LMB + 1234) and by
  // platform (mobile uses joystick + on-screen buttons). The state machine
  // owns one base i18n key per step; the overlay tries the most specific
  // suffixed variant first and falls back to the base when missing.
  //
  // Priority: <key>.mobile  (when window.isMobile is truthy)
  //         > <key>.<scheme> (when InputScheme reports classic/arpg)
  //         > <key>          (always present)

  function _isMobile() {
    try {
      if (typeof window.isMobile === 'boolean') return window.isMobile;
    } catch (_) {}
    return false;
  }

  function _activeScheme() {
    try {
      if (window.InputScheme && typeof window.InputScheme.getScheme === 'function') {
        var s = window.InputScheme.getScheme();
        if (s === 'classic' || s === 'arpg') return s;
      }
    } catch (_) {}
    return null;
  }

  function _i18nLookup(key) {
    if (!window.i18n || typeof window.i18n.t !== 'function') return null;
    // Probe with i18n.has() first when available — it's silent on miss,
    // unlike i18n.t() which logs a [MISSING:key] warning. Resolver
    // legitimately misses on every render for steps that don't carry
    // .classic/.arpg/.mobile variants, so we want zero log spam.
    if (typeof window.i18n.has === 'function') {
      try { if (!window.i18n.has(key)) return null; } catch (_) {}
    }
    var v;
    try { v = window.i18n.t(key); } catch (_) { return null; }
    if (typeof v !== 'string') return null;
    if (v.indexOf('[MISSING:') === 0) return null;
    return v;
  }

  function resolveHintText(baseKey) {
    if (!baseKey) return '';
    // 1) mobile takes precedence over scheme — touch input doesn't have
    //    a "classic vs arpg" distinction.
    if (_isMobile()) {
      var m = _i18nLookup(baseKey + '.mobile');
      if (m) return m;
    } else {
      var scheme = _activeScheme();
      if (scheme) {
        var s = _i18nLookup(baseKey + '.' + scheme);
        if (s) return s;
      }
    }
    // 2) Fall back to the base key. If even that is missing, return the raw
    //    key so the banner stays visible (better than empty).
    var base = _i18nLookup(baseKey);
    return base !== null ? base : baseKey;
  }

  // ---------- target ref resolution ----------

  function _matchesName(candidate, refName) {
    if (!candidate || !refName) return false;
    var c = String(candidate).toLowerCase();
    var n = String(refName).toLowerCase();
    return c === n || c.indexOf(n) !== -1 || n.indexOf(c) !== -1;
  }

  // HUB_HITBOXES stores coordinates in source-art space (960 px wide). At
  // runtime HubSceneV2 multiplies x/y/w/h by SCALE_FACTOR (= 1536 / 960) to
  // place colliders, entrance hitboxes and NPC sprites in world coordinates.
  // The tutorial highlight must apply the same scale or it draws off-camera
  // to the upper-left.
  var HUB_SCALE = 1536 / 960;

  function _resolveFromHubHitboxes(ref) {
    var hub = window.HUB_HITBOXES;
    if (!hub) return null;
    if (ref.type === 'entrance' && Array.isArray(hub.entrances)) {
      for (var i = 0; i < hub.entrances.length; i++) {
        var e = hub.entrances[i];
        if (_matchesName(e.id, ref.name) || _matchesName(e.label, ref.name)) {
          return {
            x: e.x * HUB_SCALE,
            y: e.y * HUB_SCALE,
            w: (e.w || 64) * HUB_SCALE,
            h: (e.h || 64) * HUB_SCALE,
            kind: 'entrance'
          };
        }
      }
    }
    if (ref.type === 'npc' && Array.isArray(hub.npcs)) {
      for (var j = 0; j < hub.npcs.length; j++) {
        var n = hub.npcs[j];
        if (_matchesName(n.id, ref.name) || _matchesName(n.name, ref.name)) {
          // NPC sprites carry no width/height in the hitbox table — they
          // render as scaled sprites at runtime. Use the same SCALE_FACTOR
          // so the circle outline lands on the actual on-screen position.
          // _drawOutline uses max(w,h)*0.6 which yields ~62 px radius.
          return {
            x: n.x * HUB_SCALE,
            y: n.y * HUB_SCALE,
            w: 64 * HUB_SCALE,
            h: 64 * HUB_SCALE,
            kind: 'npc'
          };
        }
      }
    }
    return null;
  }

  function _resolveFromSceneChildren(scene, ref) {
    if (!scene || !scene.children || !Array.isArray(scene.children.list)) return null;
    var list = scene.children.list;
    for (var i = 0; i < list.length; i++) {
      var obj = list[i];
      if (!obj || !obj.data || typeof obj.data.get !== 'function') continue;
      var tagged = obj.data.get('hitboxName');
      if (_matchesName(tagged, ref.name)) {
        // Use Phaser's getBounds when available; otherwise fall back to
        // displayWidth/displayHeight or hardcoded defaults.
        var w = (typeof obj.displayWidth === 'number' && obj.displayWidth > 0) ? obj.displayWidth : 64;
        var h = (typeof obj.displayHeight === 'number' && obj.displayHeight > 0) ? obj.displayHeight : 64;
        var x = (typeof obj.x === 'number') ? obj.x : 0;
        var y = (typeof obj.y === 'number') ? obj.y : 0;
        return { x: x, y: y, w: w, h: h, kind: ref.type };
      }
    }
    return null;
  }

  function resolveTarget(scene, ref) {
    if (!ref || !ref.type || !ref.name) return null;
    var t = _resolveFromHubHitboxes(ref);
    if (t) return t;
    t = _resolveFromSceneChildren(scene, ref);
    if (t) return t;
    try {
      console.warn('[TutorialOverlay] could not resolve target ref', ref);
    } catch (_) {}
    return null;
  }

  // ---------- factory ----------

  function create(scene) {
    var overlay = {
      scene: scene,
      banner: null,            // { bg, text }
      highlight: null,         // Phaser.Container holding the chevron Graphics
      tween: null,             // alpha pulse tween
      bobTween: null,          // vertical bob tween
      currentTargetRef: null,  // last resolved {type,name} key (string)
      _stepUnsub: null,
      _i18nUnsub: null,
      _schemeUnsub: null,      // InputScheme.onChange unsubscribe (input-aware hints)
      _shutdownHandler: null,
      _lastStep: null
    };

    function _refKey(ref) {
      if (!ref) return null;
      return ref.type + '::' + ref.name;
    }

    overlay._buildBanner = function (text) {
      var s = this.scene;
      if (!s || !s.cameras || !s.cameras.main) return null;
      var cam = s.cameras.main;
      var bgWidth = Math.max(240, Math.floor(cam.width * 0.7));
      var paddingX = 20;
      var paddingY = 12;
      var wrapWidth = Math.max(120, bgWidth - paddingX * 2);
      var x = Math.floor(cam.width / 2);

      // Build text first with word wrap so its measured height drives the
      // banner height. Long hint texts ("Ein Item ist gefallen — bewege dich
      // mit dem Joystick darüber, um es aufzuheben") used to overflow the
      // fixed-height background; the bg now grows to fit.
      var txtStyle = {};
      Object.keys(BANNER_TEXT_STYLE).forEach(function (k) { txtStyle[k] = BANNER_TEXT_STYLE[k]; });
      txtStyle.wordWrap = { width: wrapWidth, useAdvancedWrap: true };
      var txt = s.add.text(x, 0, text, txtStyle).setOrigin(0.5).setScrollFactor(0).setDepth(BANNER_TEXT_DEPTH);

      var bgHeight = Math.max(BANNER_HEIGHT, Math.ceil(txt.height + paddingY * 2));
      var y = Math.floor(cam.height - BANNER_BOTTOM_OFFSET - bgHeight / 2);
      txt.setY(y);

      var bg = s.add.rectangle(x, y, bgWidth, bgHeight, BANNER_BG_COLOR, BANNER_BG_ALPHA)
        .setStrokeStyle(2, 0xd4a543, 0.9)
        .setScrollFactor(0)
        .setDepth(BANNER_DEPTH);

      return { bg: bg, text: txt, width: bgWidth, height: bgHeight, paddingY: paddingY };
    };

    overlay._destroyBanner = function () {
      if (!this.banner) return;
      try { this.banner.bg.destroy(); } catch (_) {}
      try { this.banner.text.destroy(); } catch (_) {}
      this.banner = null;
    };

    overlay._destroyHighlight = function () {
      if (this.tween) {
        try { this.tween.stop(); } catch (_) {}
        try { this.tween.remove(); } catch (_) {}
        this.tween = null;
      }
      if (this.bobTween) {
        try { this.bobTween.stop(); } catch (_) {}
        try { this.bobTween.remove(); } catch (_) {}
        this.bobTween = null;
      }
      if (this.highlight) {
        try { this.highlight.destroy(); } catch (_) {}
        this.highlight = null;
      }
      this.currentTargetRef = null;
    };

    overlay._destroyVisuals = function () {
      this._destroyBanner();
      this._destroyHighlight();
    };

    overlay._renderBanner = function (step) {
      // Null step or no hintKey => banner must not be visible.
      if (!step || step.hintKey === null || step.hintKey === undefined) {
        this._destroyBanner();
        return;
      }
      // resolveHintText handles input-scheme + mobile variants and falls
      // back to the base key when no variant is registered. It also
      // suppresses the i18n "[MISSING:...]" placeholder.
      var label;
      try { label = resolveHintText(step.hintKey); }
      catch (_) { label = step.hintKey; }

      // Update existing banner in place if camera/layout hasn't changed; this
      // avoids a destroy/recreate flicker on language change.
      if (this.banner && this.banner.text) {
        try {
          this.banner.text.setText(label);
          // Word wrap means a longer/shorter string can change the text
          // height. Re-fit the bg around the new text so the rectangle
          // never clips long German hints or leaves a giant gap for short
          // ones. Width is fixed (camera-relative) so wrap stays stable.
          var s = this.scene;
          if (s && s.cameras && s.cameras.main && this.banner.bg) {
            var cam = s.cameras.main;
            var newHeight = Math.max(BANNER_HEIGHT, Math.ceil(this.banner.text.height + (this.banner.paddingY || 12) * 2));
            var newY = Math.floor(cam.height - BANNER_BOTTOM_OFFSET - newHeight / 2);
            if (newHeight !== this.banner.height) {
              this.banner.bg.setSize(this.banner.width, newHeight);
              this.banner.height = newHeight;
            }
            this.banner.bg.setPosition(this.banner.bg.x, newY);
            this.banner.text.setPosition(this.banner.text.x, newY);
          }
          return;
        } catch (_) {
          // Phaser object torn down behind our back — fall through to rebuild.
          this.banner = null;
        }
      }
      this.banner = this._buildBanner(label);
    };

    overlay._drawOutline = function (target) {
      var s = this.scene;
      if (!s || !s.add) return;

      // Anchor the indicator above the target's top edge. Hub doesn't scroll;
      // dungeon does. The indicator should follow world coords (it tracks
      // the hitbox/sprite), so we keep the default scroll factor.
      var anchorX = target.x;
      var anchorY = target.y - target.h / 2 - INDICATOR_GAP;

      // Container so we can bob + alpha-pulse the whole indicator as one
      // group instead of the underlying Graphics primitive.
      var container = s.add.container(anchorX, anchorY);
      container.setDepth(HIGHLIGHT_DEPTH);

      // Filled downward-pointing triangle (chevron). Apex at (0, halfH);
      // base spans (-halfW, -halfH) to (+halfW, -halfH). A subtle dark
      // outline behind the fill keeps it readable against any background.
      var halfW = INDICATOR_WIDTH / 2;
      var halfH = INDICATOR_HEIGHT / 2;
      var g = s.add.graphics();
      // Drop shadow (offset down 2px, dark, slightly transparent).
      g.fillStyle(0x000000, 0.45);
      g.fillTriangle(0, halfH + 2, -halfW, -halfH + 2, halfW, -halfH + 2);
      // Main fill.
      g.fillStyle(HIGHLIGHT_COLOR, 1.0);
      g.fillTriangle(0, halfH, -halfW, -halfH, halfW, -halfH);
      // Thin dark stroke for crispness.
      g.lineStyle(2, 0x3d2d05, 0.9);
      g.strokeTriangle(0, halfH, -halfW, -halfH, halfW, -halfH);

      container.add(g);
      this.highlight = container;

      if (s.tweens && typeof s.tweens.add === 'function') {
        try {
          // Alpha pulse — soft "look at me" rhythm without flashing.
          this.tween = s.tweens.add({
            targets: container,
            alpha: { from: 0.55, to: 1.0 },
            duration: HIGHLIGHT_PULSE_DURATION_MS,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
          // Vertical bob — the chevron rises and falls so the eye tracks it.
          this.bobTween = s.tweens.add({
            targets: container,
            y: anchorY - INDICATOR_BOB_PX,
            duration: INDICATOR_BOB_DURATION_MS,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        } catch (_) {
          // No tween manager (headless / test env) — graphics still renders.
        }
      }
    };

    overlay._renderHighlight = function (step) {
      var ref = step ? step.targetRef : null;
      var newKey = _refKey(ref);

      // No target → tear down any existing highlight.
      if (!ref) {
        this._destroyHighlight();
        return;
      }

      // Same target ref as before → keep existing graphics + tween (avoid
      // tween thrashing per T005 guidance).
      if (this.highlight && this.currentTargetRef === newKey) return;

      // Different (or first) target → rebuild.
      this._destroyHighlight();
      var target = resolveTarget(this.scene, ref);
      if (!target) {
        // resolveTarget already logged the warning. Skip silently.
        return;
      }
      this.currentTargetRef = newKey;
      this._drawOutline(target);
    };

    overlay._render = function (step) {
      var prevStepId = this._lastStep ? this._lastStep.id : null;
      this._lastStep = step || null;
      if (!step) {
        this._destroyVisuals();
        return;
      }
      this._renderBanner(step);
      this._renderHighlight(step);
      // Apply step-entry effects (freeze) only on actual step transitions —
      // re-renders triggered by language / scheme changes must NOT re-freeze
      // physics. Skip the freeze if we're still on the same step we last
      // rendered.
      if (step.id !== prevStepId) {
        this._applyEntryEffects(step);
      }
    };

    overlay._applyEntryEffects = function (step) {
      if (!step || !step.freezePhysicsMs) return;
      var s = this.scene;
      if (!s || !s.physics || !s.physics.world) return;
      try {
        s.physics.world.pause();
      } catch (_) { return; }
      // Cancel any pending resume from a prior freeze (defensive).
      if (this._freezeTimer && typeof this._freezeTimer.remove === 'function') {
        try { this._freezeTimer.remove(false); } catch (_) {}
      }
      this._freezeTimer = null;
      try {
        if (s.time && typeof s.time.delayedCall === 'function') {
          this._freezeTimer = s.time.delayedCall(step.freezePhysicsMs, (function (scene) {
            return function () {
              try { if (scene.physics && scene.physics.world) scene.physics.world.resume(); } catch (_) {}
            };
          })(s));
        } else {
          // Fallback when no Phaser time plugin is available (tests / headless).
          // Resume immediately so we don't leave physics paused indefinitely.
          s.physics.world.resume();
        }
      } catch (_) {
        // If scheduling failed, resume immediately to keep gameplay alive.
        try { s.physics.world.resume(); } catch (_) {}
      }
    };

    overlay.mount = function () {
      var self = this;

      // Subscribe to step changes.
      try {
        if (window.TutorialSystem && typeof window.TutorialSystem.onChange === 'function') {
          this._stepUnsub = window.TutorialSystem.onChange(function (step) {
            try { self._render(step); }
            catch (err) {
              try { console.error('[TutorialOverlay] render failed', err); } catch (_) {}
            }
          });
        }
      } catch (err) {
        try { console.warn('[TutorialOverlay] failed to subscribe to TutorialSystem', err); } catch (_) {}
      }

      // Subscribe to language changes — re-render the banner against the new
      // active language (NFR-03). The highlight is language-agnostic so we
      // only need to refresh the banner, but call _render for consistency.
      try {
        if (window.i18n && typeof window.i18n.onChange === 'function') {
          this._i18nUnsub = window.i18n.onChange(function () {
            // Re-render against the most recent step we know about. Prefer
            // the live system step (it may have advanced between events) but
            // fall back to our cached one.
            var step = null;
            try {
              if (window.TutorialSystem && typeof window.TutorialSystem.getCurrentStep === 'function') {
                step = window.TutorialSystem.getCurrentStep();
              }
            } catch (_) {}
            if (!step) step = self._lastStep;
            // Only the banner depends on language. Avoid tearing down the
            // highlight tween on language change (would cause a visual blip).
            try { self._renderBanner(step); }
            catch (err) {
              try { console.error('[TutorialOverlay] i18n re-render failed', err); } catch (_) {}
            }
          });
        }
      } catch (err) {
        try { console.warn('[TutorialOverlay] failed to subscribe to i18n', err); } catch (_) {}
      }

      // Subscribe to control-scheme changes — re-render the banner when the
      // player flips classic <-> arpg via Settings, so binding-specific
      // hints stay correct mid-tutorial without a scene reload.
      try {
        if (window.InputScheme && typeof window.InputScheme.onChange === 'function') {
          this._schemeUnsub = window.InputScheme.onChange(function () {
            var step = null;
            try {
              if (window.TutorialSystem && typeof window.TutorialSystem.getCurrentStep === 'function') {
                step = window.TutorialSystem.getCurrentStep();
              }
            } catch (_) {}
            if (!step) step = self._lastStep;
            try { self._renderBanner(step); }
            catch (err) {
              try { console.error('[TutorialOverlay] scheme re-render failed', err); } catch (_) {}
            }
          });
        }
      } catch (err) {
        try { console.warn('[TutorialOverlay] failed to subscribe to InputScheme', err); } catch (_) {}
      }

      // Auto-cleanup on scene shutdown so callers don't have to remember.
      // (WP03/WP04 will also call unmount() explicitly from scene shutdown.)
      try {
        if (this.scene && this.scene.events && typeof this.scene.events.once === 'function') {
          this._shutdownHandler = function () { try { self.unmount(); } catch (_) {} };
          this.scene.events.once('shutdown', this._shutdownHandler);
          this.scene.events.once('destroy', this._shutdownHandler);
        }
      } catch (_) {}

      // Initial render against whatever step is current right now.
      var current = null;
      try {
        if (window.TutorialSystem && typeof window.TutorialSystem.getCurrentStep === 'function') {
          current = window.TutorialSystem.getCurrentStep();
        }
      } catch (_) {}
      this._render(current);
    };

    overlay.unmount = function () {
      if (this._stepUnsub)   { try { this._stepUnsub(); }   catch (_) {} this._stepUnsub = null; }
      if (this._i18nUnsub)   { try { this._i18nUnsub(); }   catch (_) {} this._i18nUnsub = null; }
      if (this._schemeUnsub) { try { this._schemeUnsub(); } catch (_) {} this._schemeUnsub = null; }
      // Cancel any pending freeze-resume timer and ensure physics is running
      // again — we never want to leave the player softlocked because the
      // overlay was torn down mid-freeze.
      if (this._freezeTimer && typeof this._freezeTimer.remove === 'function') {
        try { this._freezeTimer.remove(false); } catch (_) {}
        this._freezeTimer = null;
      }
      try {
        if (this.scene && this.scene.physics && this.scene.physics.world && this.scene.physics.world.isPaused) {
          this.scene.physics.world.resume();
        }
      } catch (_) {}
      this._shutdownHandler = null;
      this._destroyVisuals();
      this._lastStep = null;
    };

    return overlay;
  }

  window.TutorialOverlay = {
    create: create,
    // Exposed for tests + debugging; not part of the public contract.
    _resolveTarget: resolveTarget
  };
})();
