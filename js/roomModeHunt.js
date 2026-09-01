/* =====================================================================
 * roomModeHunt.js — Raum-Modus "hunt" (Feature 061, WP04)
 * ---------------------------------------------------------------------
 * Unter dem Trash-Pulk gibt es EIN markiertes Ziel (bevorzugt ein Elite).
 * Der Kill des Ziels schließt den Raum ab — unabhängig vom restlichen
 * Trash. Kein Verfehlen möglich. Self-registrierend. Der Ziel-Marker
 * rendert das Visuals-Modul (WP05) aus getState().
 *
 * #112: Auch hier fehlte ein Objekt, an dem der Spieler das Ereignis
 * festmachen konnte. Es gibt jetzt ein BEUTELAGER — einen Knochenhaufen als
 * Bau des Rudels. Erst wenn der Spieler ihn sieht, tritt der Rudelfuehrer
 * aus dem Pulk hervor.
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
  // Kommt ZUSAETZLICH zum Champion-Elite-HP (×1.5) — effektiv also base ×6.0.
  var HUNT_HP_MULT = 4.0;

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

  var ANKER_TEX = 'roommode_hunt_beutelager';

  // Beutelager: Knochenhaufen mit Schaedel — das Rudel hat hier gefressen.
  function _ensureTex(scene) {
    if (!scene || !scene.textures || scene.textures.exists(ANKER_TEX)) return;
    try {
      var g = scene.make.graphics({ add: false });
      // Bodenschatten
      g.fillStyle(0x140f14, 0.35); g.fillEllipse(32, 44, 56, 18);
      // Knochen quer im Haufen
      g.fillStyle(0xcfc6b4, 1);
      g.fillRect(8, 36, 26, 5); g.fillCircle(8, 38, 3.5); g.fillCircle(34, 38, 3.5);
      g.fillRect(28, 30, 24, 4); g.fillCircle(28, 32, 3); g.fillCircle(52, 32, 3);
      g.fillStyle(0xb8ad99, 1);
      g.fillRect(14, 42, 30, 4); g.fillCircle(14, 44, 3); g.fillCircle(44, 44, 3);
      // Schaedel obenauf
      g.fillStyle(0xe4dccb, 1);
      g.fillEllipse(30, 20, 26, 22);
      g.fillRect(24, 27, 12, 7);
      g.fillStyle(0x241c22, 1);
      g.fillEllipse(25, 19, 7, 8); g.fillEllipse(35, 19, 7, 8);
      g.fillRect(28, 28, 2, 5); g.fillRect(32, 28, 2, 5);
      g.generateTexture(ANKER_TEX, 64, 56); g.destroy();
    } catch (e) {}
  }

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
    var sprite = null, ankerX = 0, ankerY = 0;
    return {
      // #112: Beutelager hinstellen, ohne den Rudelfuehrer schon zu bestimmen.
      arm: function (sc) {
        scene = sc || null;
        var A = (typeof window !== 'undefined') ? window.RoomModeAnchor : null;
        var mitte = (A && typeof A.mitteImRaum === 'function') ? A.mitteImRaum(scene) : { x: 0, y: 0 };
        ankerX = mitte.x; ankerY = mitte.y;
        if (scene && scene.add) {
          _ensureTex(scene);
          // Depth 80 wie liegende Beute — ein Gegenstand am Boden, kein Bauwerk.
          try { sprite = scene.add.sprite(ankerX, ankerY, ANKER_TEX).setDepth(80).setScrollFactor(1); }
          catch (e) { sprite = null; }
        }
        if (sprite && A && typeof A.ruhend === 'function') A.ruhend(sprite);
        return { x: ankerX, y: ankerY };
      },
      start: function (sc) {
        if (sc) scene = sc;
        target = null; picked = false; cleared = false; clearedOthers = false;
        if (!sprite && this.arm) { try { this.arm(scene); } catch (e) {} }
        var A = (typeof window !== 'undefined') ? window.RoomModeAnchor : null;
        if (sprite && A && typeof A.geweckt === 'function') A.geweckt(sprite);
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
      // Raum-/Modus-Wechsel: das Beutelager darf nicht mitwandern.
      stop: function () {
        if (sprite) { try { sprite.destroy(); } catch (e) {} sprite = null; }
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
          x: alive ? target.x : ankerX, y: alive ? target.y : ankerY
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
