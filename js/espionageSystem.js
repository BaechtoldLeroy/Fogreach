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

  var DEFAULT_STATE = function () {
    return {
      active: false,        // läuft gerade eine Espionage-Mission?
      missionId: null,
      disguised: false,     // Verkleidung an?
      detection: 0,         // 0..1 Verdachts-/Entdeckungs-Level
      exposed: false,       // Schwelle überschritten -> enttarnt (Kampf)
      observeZones: [],      // Info-Gathering-Zonen (WP03)
      guards: []             // Detection-Quellen (WP03)
    };
  };

  var state = DEFAULT_STATE();

  var EspionageSystem = {
    // --- Mission-Lifecycle -------------------------------------------
    startMission: function (scene, config) {
      state = DEFAULT_STATE();
      state.active = true;
      state.missionId = (config && config.missionId) || null;
      // WP03: Verkleidung anbieten, Wachen/Zonen aus config/Room laden.
      return state;
    },

    endMission: function () {
      var prev = state;
      state = DEFAULT_STATE();
      return prev;
    },

    isActive: function () { return !!state.active; },
    getState: function () { return state; },

    // --- Verkleidung --------------------------------------------------
    setDisguise: function (on) {
      if (!state.active) return false;
      state.disguised = !!on;
      // WP03: Sprite-Swap/Tint.
      return state.disguised;
    },

    isDisguised: function () { return !!(state.active && state.disguised); },

    // Vom Player-Attack-Pfad aufgerufen: Angriff lässt die Tarnung fallen
    // und treibt die Entdeckung hoch (FR-04). No-op außerhalb Mission.
    onPlayerAttack: function () {
      if (!state.active || !state.disguised) return false;
      state.disguised = false;
      state.detection = Math.min(1, state.detection + 0.5);
      // WP03: Detection-Spike sauber + ggf. exposed setzen.
      return true;
    },

    // --- Detection / Info-Gathering (WP03 füllt aus) -----------------
    isDetected: function () { return !!(state.active && state.exposed); },
    getDetection: function () { return state.active ? state.detection : 0; },

    registerObserveZone: function (zone) {
      if (!state.active || !zone) return;
      state.observeZones.push(zone);
    },

    // Per-Frame-Tick (in GameScene.update gehängt, WP03). Skeleton: no-op.
    update: function (scene, time, delta) {
      if (!state.active) return;
      // WP03: Guard-Detection-Range/LoS, Deckung, Observe-Increment,
      // exposed-Schwelle (Kampf statt Insta-Fail).
    }
  };

  if (typeof window !== 'undefined') {
    window.EspionageSystem = EspionageSystem;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EspionageSystem; // für Unit-Tests
  }
})();
