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

  var BANNER_DEPTH    = 1500;
  var BANNER_TEXT_DEPTH = 1501;
  var HIGHLIGHT_DEPTH = 1490;
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
  var HIGHLIGHT_STROKE_W = 3;
  var HIGHLIGHT_PULSE_DURATION_MS = 500; // 1 Hz cycle (yoyo: 500ms each way)

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
    var v;
    try { v = window.i18n.t(key); } catch (_) { return null; }
    if (typeof v !== 'string') return null;
    // i18n.t returns "[MISSING:<key>]" on miss. Treat that as "not present".
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

  function _resolveFromHubHitboxes(ref) {
    var hub = window.HUB_HITBOXES;
    if (!hub) return null;
    if (ref.type === 'entrance' && Array.isArray(hub.entrances)) {
      for (var i = 0; i < hub.entrances.length; i++) {
        var e = hub.entrances[i];
        if (_matchesName(e.id, ref.name) || _matchesName(e.label, ref.name)) {
          return {
            x: e.x, y: e.y,
            w: e.w || 64, h: e.h || 64,
            kind: 'entrance'
          };
        }
      }
    }
    if (ref.type === 'npc' && Array.isArray(hub.npcs)) {
      for (var j = 0; j < hub.npcs.length; j++) {
        var n = hub.npcs[j];
        if (_matchesName(n.id, ref.name) || _matchesName(n.name, ref.name)) {
          // NPC sprites in HUB_HITBOXES carry no width/height — they render
          // as scaled sprites at runtime. Pick a sensible default radius
          // proxy; _drawOutline uses max(w,h)*0.6 which yields ~38px.
          return {
            x: n.x, y: n.y,
            w: 64, h: 64,
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
      highlight: null,         // Phaser.Graphics
      tween: null,
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
      var x = Math.floor(cam.width / 2);
      var y = Math.floor(cam.height - BANNER_BOTTOM_OFFSET - BANNER_HEIGHT / 2);

      var bg = s.add.rectangle(x, y, bgWidth, BANNER_HEIGHT, BANNER_BG_COLOR, BANNER_BG_ALPHA)
        .setStrokeStyle(2, 0xd4a543, 0.9)
        .setScrollFactor(0)
        .setDepth(BANNER_DEPTH);
      var txt = s.add.text(x, y, text, BANNER_TEXT_STYLE)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(BANNER_TEXT_DEPTH);

      return { bg: bg, text: txt, width: bgWidth };
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
      var g = s.add.graphics();
      g.setDepth(HIGHLIGHT_DEPTH);
      // Hub doesn't scroll; dungeon does. Highlight should follow world
      // coords (sit on the hitbox/sprite), so we keep the default scroll
      // factor (1.0) — do NOT setScrollFactor(0).
      g.lineStyle(HIGHLIGHT_STROKE_W, HIGHLIGHT_COLOR, 1.0);
      if (target.kind === 'entrance') {
        var rx = target.x - target.w / 2;
        var ry = target.y - target.h / 2;
        g.strokeRect(rx, ry, target.w, target.h);
      } else {
        var r = Math.max(target.w, target.h) * 0.6;
        g.strokeCircle(target.x, target.y, r);
      }
      this.highlight = g;

      if (s.tweens && typeof s.tweens.add === 'function') {
        try {
          this.tween = s.tweens.add({
            targets: g,
            alpha: { from: 0.4, to: 1.0 },
            duration: HIGHLIGHT_PULSE_DURATION_MS,
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
      this._lastStep = step || null;
      if (!step) {
        this._destroyVisuals();
        return;
      }
      this._renderBanner(step);
      this._renderHighlight(step);
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
