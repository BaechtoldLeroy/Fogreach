/* =====================================================================
 * roomModeDefend.js — Raum-Modus "defend" (Feature 061, WP03)
 * ---------------------------------------------------------------------
 * Schütze einen Kern/Altar: er wird durch die PRÄSENZ lebender Gegner
 * korrumpiert (HP-Drain pro Gegner/Sekunde). Verteidigen = die Welle
 * schnell räumen, bevor der Kern fällt. Erfolg = Welle geräumt bei
 * lebendem Kern; Kern zerstört = objectiveFailed (Raum bleibt offen, #1).
 * Kein KI-Umbau (siehe research.md, R1). Self-registrierend.
 * HP-Balken/Banner rendert das Visuals-Modul (WP05) aus getState().
 * ===================================================================== */
(function () {
  'use strict';

  if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', {
      'roommode.defend.banner': 'Verteidige den Altar!',
      'roommode.defend.hud': 'Altar: {hp}'
    });
    window.i18n.register('en', {
      'roommode.defend.banner': 'Defend the altar!',
      'roommode.defend.hud': 'Altar: {hp}'
    });
  }

  var BASE_HP = 100;
  var DRAIN_PER_ENEMY_PER_SEC = 2.0;  // je lebendem Gegner
  var DEPTH_TEX = 'roommode_defend_altar';

  function _ensureTex(scene) {
    if (!scene || !scene.textures || scene.textures.exists(DEPTH_TEX)) return;
    try {
      var g = scene.make.graphics({ add: false });
      g.fillStyle(0x1a1030, 1); g.fillRoundedRect(4, 22, 40, 20, 4);     // Sockel
      g.fillStyle(0x7a3ff0, 1);                                          // Kristall
      g.beginPath(); g.moveTo(24, 2); g.lineTo(38, 22); g.lineTo(24, 30); g.lineTo(10, 22); g.closePath(); g.fillPath();
      g.lineStyle(2, 0xcbb2ff, 0.9); g.strokePath();
      g.generateTexture(DEPTH_TEX, 48, 46); g.destroy();
    } catch (e) {}
  }

  function _aliveEnemies() {
    try {
      if (typeof window !== 'undefined' && window.enemies && typeof window.enemies.countActive === 'function') {
        return window.enemies.countActive(true);
      }
    } catch (e) {}
    return 0;
  }

  function DefendMode() {
    var scene = null, sprite = null;
    var maxHp = BASE_HP, hp = BASE_HP;
    var cleared = false, objX = 0, objY = 0;
    return {
      start: function (sc) {
        scene = sc || null;
        maxHp = hp = BASE_HP;
        cleared = false;
        // Kern in Spieler-Nähe platzieren (sichtbar am Start); Fallback Weltmitte.
        if (typeof window !== 'undefined' && window.player) {
          objX = window.player.x; objY = window.player.y - 140;
        } else if (scene && scene.physics && scene.physics.world && scene.physics.world.bounds) {
          objX = scene.physics.world.bounds.centerX; objY = scene.physics.world.bounds.centerY;
        }
        if (scene && scene.add) {
          _ensureTex(scene);
          try {
            sprite = scene.add.sprite(objX, objY, DEPTH_TEX).setDepth(400).setScrollFactor(1);
          } catch (e) { sprite = null; }
        }
      },
      update: function (dtMs) {
        var dt = (typeof dtMs === 'number' && dtMs > 0 ? dtMs : 16) / 1000;
        if (hp > 0) {
          var drain = _aliveEnemies() * DRAIN_PER_ENEMY_PER_SEC * dt;
          if (drain > 0) hp = Math.max(0, hp - drain);
        }
        if (sprite) {
          try {
            var frac = maxHp > 0 ? hp / maxHp : 0;
            if (hp <= 0) { sprite.setTint(0x555555); sprite.setAlpha(0.6); }
            else if (frac < 0.35) sprite.setTint(0xff6a6a);
            else sprite.clearTint();
          } catch (e) {}
        }
      },
      onWaveCleared: function () { cleared = true; },
      isComplete: function () { return cleared; },
      objectiveFailed: function () { return hp <= 0; },
      getState: function () {
        return { mode: 'defend', hp: Math.ceil(hp), maxHp: maxHp, x: objX, y: objY, failed: hp <= 0 };
      }
    };
  }

  if (typeof window !== 'undefined' && window.RoomMode && typeof window.RoomMode.register === 'function') {
    window.RoomMode.register('defend', DefendMode);
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DefendMode: DefendMode };
  }
})();
