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
      'roommode.hunt.banner': 'Erlege den Rudelführer!',
      'roommode.hunt.info': 'Töte den starken Anführer, um den Raum zu brechen — der Rest ist egal.',
      'roommode.hunt.hud': 'Rudelführer'
    });
    window.i18n.register('en', {
      'roommode.hunt.banner': 'Slay the pack leader!',
      'roommode.hunt.info': 'Kill the strong leader to break the room — the rest does not matter.',
      'roommode.hunt.hud': 'Pack Leader'
    });
  }

  // Der Rudelführer ist ein Mini-Boss: Champion-Elite (Optik/Verhalten) + ein
  // klarer HP-Boost obendrauf, damit er sich zäher als der Trash anfühlt.
  var HUNT_HP_MULT = 2.5;

  function _empowerTarget(t) {
    if (!t) return;
    try {
      if (window.EliteEnemies && typeof window.EliteEnemies.applyEliteToEnemy === 'function' && !t._eliteApplied) {
        window.EliteEnemies.applyEliteToEnemy(t, 'champion');
        t._eliteApplied = true;
      }
    } catch (e) {}
    try {
      if (typeof t.hp === 'number') { t.hp = Math.ceil(t.hp * HUNT_HP_MULT); t.maxHp = t.hp; }
      if (typeof t.setScale === 'function' && typeof t.scaleX === 'number' && t.scaleX > 0) t.setScale(t.scaleX * 1.35);
      if (typeof t.setTint === 'function') t.setTint(0xff5a5a);
    } catch (e) {}
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

  // Beim Betreten den Raum etwas voller machen (mehr Trash, aus dem der
  // Rudelführer heraussticht).
  var EXTRA_ENEMIES = 4;

  // Rudelführer tot -> der Rest des Pulks löst sich auf (kurzer Fade, dann weg).
  // Kein Kill-Reward (die verschwinden, sie werden nicht "erlegt").
  function _clearOtherEnemies() {
    try {
      if (typeof window === 'undefined' || !window.enemies || typeof window.enemies.getChildren !== 'function') return;
      window.enemies.getChildren().slice().forEach(function (e) {
        if (!e || !e.active) return;
        try { if (e.body && e.body.setVelocity) e.body.setVelocity(0, 0); } catch (_) {}
        try { if (typeof e.setActive === 'function') e.setActive(false); } catch (_) {}
        var sc = e.scene;
        if (sc && sc.tweens && typeof sc.tweens.add === 'function') {
          sc.tweens.add({ targets: e, alpha: 0, scale: (e.scale || 1) * 0.7, duration: 200,
            onComplete: function () { try { e.destroy(); } catch (_) {} } });
        } else {
          try { e.destroy(); } catch (_) {}
        }
      });
    } catch (e) {}
  }

  function HuntMode() {
    var scene = null, target = null, picked = false, cleared = false, clearedOthers = false;
    return {
      start: function (sc) {
        scene = sc || null; target = null; picked = false; cleared = false; clearedOthers = false;
        // Ein paar zusätzliche Gegner spawnen -> vollerer Raum.
        try {
          if (scene && typeof window !== 'undefined' && typeof window.spawnEnemy === 'function') {
            for (var i = 0; i < EXTRA_ENEMIES; i++) { try { window.spawnEnemy.call(scene, 0, 0, 'enemy'); } catch (e) {} }
          }
        } catch (e) {}
      },
      update: function () {
        // Ziel erst wählen, wenn die (async gespawnte) Welle da ist.
        if (!picked) {
          var t = _pickTarget();
          if (t) {
            target = t; picked = true;
            try { t.__huntTarget = true; } catch (e) {}
            _empowerTarget(t); // Rudelführer = zäher Mini-Boss
          }
        } else if (!clearedOthers && (!target || !target.active)) {
          // Rudelführer erlegt -> restlicher Pulk verschwindet.
          clearedOthers = true;
          _clearOtherEnemies();
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
