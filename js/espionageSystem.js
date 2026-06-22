/* =====================================================================
 * espionageSystem.js — Espionage-Mission-Mechanik (Feature 055, #30)
 * ---------------------------------------------------------------------
 * Verkleidung (Identity-Switching) + Stealth (Detection) + Info-Gathering
 * für Akt-2-Spionage-Missionen. Läuft NUR während aktiver Espionage-
 * Missionen (in kuratierten Räumen) — außerhalb komplett no-op, kein
 * Effekt auf den normalen Dungeon-/Combat-Loop.
 *
 * WP01: Skeleton + API-Oberfläche (Defaults/no-op).
 * WP03: füllt Detection, Verstecken, Observe-Zonen, Visual-Swap aus.
 *
 * Design (Spec 055):
 *  - Verkleidung frei verfügbar (NICHT faction-gated), fällt bei Angriff.
 *  - Entdeckung = Erschwernis (Kampf), KEIN Insta-Fail (C-04).
 *  - Detection leichtgewichtig (NFR-02), getthrottlet.
 * ===================================================================== */
(function () {
  'use strict';

  // --- Tuning (großzügig/fair, C-04: kein punitives Stealth) ------------
  var DISGUISE_TINT = 0x8899cc;   // bläulicher Kapuzen-Look (kein neues Asset)
  var DETECT_HZ_MS = 100;         // Detection-Check ~10×/s (NFR-02 Throttle)
  var RISE_PER_SEC = 0.45;        // Verdacht steigt langsam (~2.2s bis enttarnt)
  var DECAY_PER_SEC = 0.8;        // ...und fällt schneller wieder ab (fair)
  var ATTACK_SPIKE = 0.5;         // Angriff in Tarnung treibt Verdacht hoch
  var RANGE_GRACE = 1.0;          // Detection-Range-Multiplikator (1.0 = wie konfiguriert)

  var DEFAULT_STATE = function () {
    return {
      active: false,        // läuft gerade eine Espionage-Mission?
      missionId: null,
      disguised: false,     // Verkleidung an?
      detection: 0,         // 0..1 Verdachts-/Entdeckungs-Level
      exposed: false,       // Schwelle überschritten -> enttarnt (Kampf)
      observeZones: [],     // Info-Gathering-Zonen (WP03)
      guards: [],           // Detection-Quellen (WP03)
      cover: [],            // Deckungs-/Versteck-Zonen (WP03)
      _acc: 0               // Throttle-Akkumulator (ms)
    };
  };

  var state = DEFAULT_STATE();

  // --- interne Helfer ---------------------------------------------------
  function _player() {
    return (typeof window !== 'undefined' && window.player) ? window.player : null;
  }

  function _applyTint() {
    var p = _player();
    if (p && typeof p.setTint === 'function') {
      try { p.setTint(DISGUISE_TINT); } catch (_) {}
    }
  }

  function _clearTint() {
    var p = _player();
    if (p && typeof p.clearTint === 'function') {
      try { p.clearTint(); } catch (_) {}
    }
  }

  function _dist2(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  // Player innerhalb einer Deckungs-Zone (Rechteck)? -> unsichtbar für Wachen.
  function _inCover(px, py) {
    var zones = state.cover;
    if (!zones || !zones.length) return false;
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i];
      if (!z) continue;
      var w = z.w || 0, h = z.h || 0;
      if (px >= z.x && px <= z.x + w && py >= z.y && py <= z.y + h) return true;
    }
    return false;
  }

  // Sieht IRGENDEINE Wache den (undisguised, nicht gedeckten) Player?
  function _seenByGuard(px, py) {
    var guards = state.guards;
    if (!guards || !guards.length) return false;
    for (var i = 0; i < guards.length; i++) {
      var g = guards[i];
      if (!g) continue;
      var range = (g.range || 0) * RANGE_GRACE;
      if (range <= 0) continue;
      if (_dist2(px, py, g.x, g.y) <= range * range) return true;
    }
    return false;
  }

  // Enttarnung: Konsequenz statt Insta-Fail (C-04) — Wachen werden feindlich.
  function _expose() {
    if (state.exposed) return;
    state.exposed = true;
    state.detection = 1;
    // Tarnung fällt mit der Enttarnung.
    if (state.disguised) { state.disguised = false; _clearTint(); }
    // Hook: Wachen feindlich machen / Kampf auslösen — defensiv, optional.
    try {
      if (typeof window !== 'undefined' && window.EspionageSystem
          && typeof window.EspionageSystem.onExposed === 'function') {
        window.EspionageSystem.onExposed(state);
      }
    } catch (_) {}
  }

  var EspionageSystem = {
    // --- Mission-Lifecycle -------------------------------------------
    // config: { missionId, guards:[{x,y,range}], cover:[{x,y,w,h}],
    //           observeZones:[{id,x,y,r,seconds,questTarget}] }
    startMission: function (scene, config) {
      // Falls eine vorige Mission noch eine Tarnung anhatte: sauber aufräumen.
      if (state.disguised) _clearTint();
      state = DEFAULT_STATE();
      state.active = true;
      config = config || {};
      state.missionId = config.missionId || null;
      if (config.guards && config.guards.length) state.guards = config.guards.slice();
      if (config.cover && config.cover.length) state.cover = config.cover.slice();
      if (config.observeZones && config.observeZones.length) {
        for (var i = 0; i < config.observeZones.length; i++) {
          this.registerObserveZone(config.observeZones[i]);
        }
      }
      return state;
    },

    endMission: function () {
      var prev = state;
      if (state.disguised) _clearTint();
      state = DEFAULT_STATE();
      return prev;
    },

    isActive: function () { return !!state.active; },
    getState: function () { return state; },

    // --- Verkleidung --------------------------------------------------
    setDisguise: function (on) {
      if (!state.active) return false;
      var want = !!on;
      // Nach Enttarnung keine Re-Tarnung mehr in derselben Mission.
      if (want && state.exposed) return false;
      state.disguised = want;
      if (want) _applyTint(); else _clearTint();
      return state.disguised;
    },

    isDisguised: function () { return !!(state.active && state.disguised); },

    // Vom Player-Attack-Pfad aufgerufen: Angriff lässt die Tarnung fallen
    // und treibt die Entdeckung hoch (FR-04). No-op außerhalb Mission.
    onPlayerAttack: function () {
      if (!state.active) return false;
      var hadDisguise = state.disguised;
      if (state.disguised) { state.disguised = false; _clearTint(); }
      // Angreifen umgeht den Tarn-Schutz: Verdacht spiked immer.
      state.detection = Math.min(1, state.detection + ATTACK_SPIKE);
      if (state.detection >= 1) _expose();
      return hadDisguise;
    },

    // --- Detection / Info-Gathering -----------------------------------
    isDetected: function () { return !!(state.active && state.exposed); },
    getDetection: function () { return state.active ? state.detection : 0; },

    registerObserveZone: function (zone) {
      if (!state.active || !zone) return;
      state.observeZones.push({
        id: zone.id || null,
        x: zone.x || 0,
        y: zone.y || 0,
        r: zone.r || 64,
        seconds: (typeof zone.seconds === 'number') ? zone.seconds : 4,
        questTarget: zone.questTarget || zone.target || null,
        _elapsed: 0,
        _done: false
      });
    },

    // Per-Frame-Tick (in GameScene.update gehängt). Throttled auf ~DETECT_HZ_MS
    // für NFR-02 (kein per-Frame O(n) Stealth-Geruckel).
    update: function (scene, time, delta) {
      if (!state.active) return;
      try {
        var d = (typeof delta === 'number' && delta > 0) ? delta : 16;
        state._acc += d;
        if (state._acc < DETECT_HZ_MS) return;
        var dt = state._acc / 1000; // verstrichene Zeit in Sekunden seit letztem Tick
        state._acc = 0;

        var p = _player();
        if (!p) return;
        var px = p.x, py = p.y;

        // --- Detection ---------------------------------------------------
        if (!state.exposed) {
          var inCover = _inCover(px, py);
          var seen = !state.disguised && !inCover && _seenByGuard(px, py);
          if (seen) {
            state.detection = Math.min(1, state.detection + RISE_PER_SEC * dt);
            if (state.detection >= 1) _expose();
          } else {
            state.detection = Math.max(0, state.detection - DECAY_PER_SEC * dt);
          }
        }

        // --- Info-Gathering (Observe-Zonen) ------------------------------
        // Nur sammeln solange NICHT enttarnt (Stealth-Voraussetzung, FR-06).
        if (!state.exposed) {
          for (var i = 0; i < state.observeZones.length; i++) {
            var z = state.observeZones[i];
            if (!z || z._done) continue;
            var r = z.r || 0;
            if (_dist2(px, py, z.x, z.y) <= r * r) {
              z._elapsed += dt;
              if (z._elapsed >= z.seconds) {
                z._done = true;
                if (z.questTarget && typeof window !== 'undefined'
                    && window.questSystem
                    && typeof window.questSystem.updateQuestProgress === 'function') {
                  try {
                    window.questSystem.updateQuestProgress('observe', z.questTarget, 1);
                  } catch (_) {}
                }
              }
            } else {
              // Verlässt der Spieler die Zone, Fortschritt sanft zurücksetzen
              // (verhindert „über mehrere Anläufe stückeln"-Exploits, aber fair).
              z._elapsed = 0;
            }
          }
        }
      } catch (_) {
        // NIEMALS den Game-Loop brechen (NFR-02 / C-04).
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.EspionageSystem = EspionageSystem;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EspionageSystem; // für Unit-Tests
  }
})();
