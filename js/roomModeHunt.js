/* =====================================================================
 * roomModeHunt.js — Raum-Modus "hunt" (Feature 061, WP04)
 * ---------------------------------------------------------------------
 * Unter dem Trash-Pulk gibt es EIN markiertes Ziel (bevorzugt ein Elite).
 * Der Kill des Ziels schließt den Raum ab — unabhängig vom restlichen
 * Trash. Kein Verfehlen möglich. Self-registrierend. Der Ziel-Marker
 * rendert das Visuals-Modul (WP05) aus getState().
 * ===================================================================== */
(function () {
  'use strict';

  if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', {
      'roommode.hunt.banner': 'Töte das markierte Ziel!',
      'roommode.hunt.hud': 'Ziel'
    });
    window.i18n.register('en', {
      'roommode.hunt.banner': 'Kill the marked target!',
      'roommode.hunt.hud': 'Target'
    });
  }

  function _pickTarget() {
    try {
      if (typeof window !== 'undefined' && window.enemies) {
        if (window.EliteEnemies && typeof window.EliteEnemies.pickHuntTarget === 'function') {
          return window.EliteEnemies.pickHuntTarget(window.enemies);
        }
        // Fallback ohne EliteEnemies: erster aktiver Gegner.
        if (typeof window.enemies.getChildren === 'function') {
          var l = window.enemies.getChildren();
          for (var i = 0; i < l.length; i++) if (l[i] && l[i].active) return l[i];
        }
      }
    } catch (e) {}
    return null;
  }

  function HuntMode() {
    var target = null, picked = false, cleared = false;
    return {
      start: function () { target = null; picked = false; cleared = false; },
      update: function () {
        // Ziel erst wählen, wenn die (async gespawnte) Welle da ist.
        if (!picked) {
          var t = _pickTarget();
          if (t) { target = t; picked = true; try { t.__huntTarget = true; } catch (e) {} }
        }
      },
      onWaveCleared: function () { cleared = true; },
      isComplete: function () {
        if (picked) return !target || !target.active;
        return cleared; // Fallback: konnte kein Ziel gewählt werden, Raum-Clear zählt
      },
      objectiveFailed: function () { return false; },
      getState: function () {
        var alive = !!(target && target.active);
        return {
          mode: 'hunt', picked: picked, targetAlive: alive,
          x: alive ? target.x : 0, y: alive ? target.y : 0
        };
      }
    };
  }

  if (typeof window !== 'undefined' && window.RoomMode && typeof window.RoomMode.register === 'function') {
    window.RoomMode.register('hunt', HuntMode);
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HuntMode: HuntMode };
  }
})();
