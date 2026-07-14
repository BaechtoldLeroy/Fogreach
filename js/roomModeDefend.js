/* =====================================================================
 * roomModeDefend.js — Raum-Modus "defend" (Feature 061, WP03)
 * ---------------------------------------------------------------------
 * Schütze einen Altar in der Raummitte: er wird durch die PRÄSENZ lebender
 * Gegner korrumpiert (HP-Drain pro Gegner/Sekunde). Der Modus spawnt seinen
 * Nachschub in einem RING UM DEN ALTAR (nicht im ganzen Raum verteilt), sodass
 * der Kampf sich um den Altar abspielt. Überstehe die Dauer mit lebendem Altar
 * = Erfolg (Bonus-Truhe); Altar zerstört = objectiveFailed (Raum bleibt offen,
 * kein Bonus, #1). Die Gegner werden über einen Ziel-Override (window.
 * __ENEMY_CHASE_OVERRIDE__) zum Altar GEZOGEN, damit sich der Kampf dort
 * konzentriert — sonst lockt man sie in großen Räumen einfach weg.
 * HP-Balken/Banner rendert das Visuals-Modul (WP05) aus getState().
 * ===================================================================== */
(function () {
  'use strict';

  if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', {
      'roommode.defend.banner': 'Verteidige den Altar!',
      'roommode.defend.info': 'Der Altar zerfällt, solange Gegner leben. Halte sie {seconds}s vom Altar fern.',
      'roommode.defend.hud': 'Altar: {hp}   ·   {seconds}s'
    });
    window.i18n.register('en', {
      'roommode.defend.banner': 'Defend the altar!',
      'roommode.defend.info': 'The altar decays while enemies live. Keep them off it for {seconds}s.',
      'roommode.defend.hud': 'Altar: {hp}   ·   {seconds}s'
    });
  }

  var BASE_HP = 150;                  // Altar-HP
  var DRAIN_PER_ENEMY_PER_SEC = 1.5;  // je Gegner in der Zone (Basis)
  var DRAIN_ESCALATION = 0.2;         // +20% Gesamt-Drain je ZUSÄTZLICHEM Gegner
                                      // im Kreis -> Swarm senkt die HP überproportional
  var BASE_SECONDS = 30;              // Ansturm-Dauer (Basis)
  var MAX_BONUS = 20;                 // +bis 20s in der Tiefe (30..50s)
  var SPAWN_INTERVAL = 4.0;           // s zwischen Nachschub-Schüben am Altar
  var SPAWN_BATCH = 2;                // Gegner pro Schub
  var MAX_CONCURRENT = 8;             // Deckel gleichzeitiger Gegner
  var RING_MIN = 150, RING_MAX = 240; // Spawn-Ring um den Altar (in die Drain-Zone)
  var DRAIN_RADIUS = 190;             // NUR Gegner in diesem Radius drainen den Altar (kleiner)
  var DEPTH_TEX = 'roommode_defend_altar';

  function _depthSeconds() {
    var d = 1;
    if (typeof window !== 'undefined' && typeof window.DUNGEON_DEPTH === 'number' && window.DUNGEON_DEPTH > 0) d = window.DUNGEON_DEPTH;
    return Math.round(BASE_SECONDS + Math.min(MAX_BONUS, (d - 1) * 1));
  }

  // Hübscherer, glühender Rune-Altar (Stein-Podest + Kristall + Halo).
  function _ensureTex(scene) {
    if (!scene || !scene.textures || scene.textures.exists(DEPTH_TEX)) return;
    try {
      var g = scene.make.graphics({ add: false });
      // Halo/Glow
      g.fillStyle(0x7a3ff0, 0.16); g.fillCircle(32, 30, 30);
      g.fillStyle(0x7a3ff0, 0.10); g.fillCircle(32, 30, 40);
      // Stein-Podest (drei Stufen)
      g.fillStyle(0x241f30, 1); g.fillRect(8, 46, 48, 10);
      g.fillStyle(0x342d46, 1); g.fillRect(14, 40, 36, 8);
      g.fillStyle(0x463c60, 1); g.fillRect(20, 34, 24, 7);
      // Säule
      g.fillStyle(0x342d46, 1); g.fillRect(26, 18, 12, 18);
      // Kristall (aussen dunkel, innen hell) + Kante
      g.fillStyle(0x9a5cff, 1);
      g.beginPath(); g.moveTo(32, 2); g.lineTo(42, 18); g.lineTo(32, 27); g.lineTo(22, 18); g.closePath(); g.fillPath();
      g.fillStyle(0xd8c4ff, 0.92);
      g.beginPath(); g.moveTo(32, 7); g.lineTo(37, 16); g.lineTo(32, 22); g.lineTo(27, 16); g.closePath(); g.fillPath();
      g.lineStyle(1.5, 0xe6d8ff, 0.95);
      g.beginPath(); g.moveTo(32, 2); g.lineTo(42, 18); g.lineTo(32, 27); g.lineTo(22, 18); g.closePath(); g.strokePath();
      g.generateTexture(DEPTH_TEX, 64, 60); g.destroy();
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

  // Nur Gegner INNERHALB der Drain-Zone um den Altar zählen (kleinere, markierte
  // Fläche statt raumweit). Ohne Positionsdaten -> Fallback auf raumweite Zahl.
  function _enemiesNearAltar(cx, cy) {
    try {
      if (typeof window !== 'undefined' && window.enemies && typeof window.enemies.getChildren === 'function') {
        var arr = window.enemies.getChildren();
        var r2 = DRAIN_RADIUS * DRAIN_RADIUS, n = 0;
        for (var i = 0; i < arr.length; i++) {
          var e = arr[i];
          if (e && e.active && typeof e.x === 'number' && typeof e.y === 'number') {
            var dx = e.x - cx, dy = e.y - cy;
            if (dx * dx + dy * dy <= r2) n++;
          }
        }
        return n;
      }
    } catch (e) {}
    return _aliveEnemies();
  }

  // Ring-Position um den Altar; bevorzugt begehbar, sonst am Altar (spawnEnemy
  // rückt lokal auf eine freie Kachel bzw. respektiert seinen Mindestabstand).
  function _ringAroundAltar(scene, cx, cy) {
    for (var i = 0; i < 16; i++) {
      var a = Math.random() * Math.PI * 2;
      var r = RING_MIN + Math.random() * (RING_MAX - RING_MIN);
      var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (x <= 0 || y <= 0) continue;
      if (scene && typeof scene.isPointAccessible === 'function' && !scene.isPointAccessible(x, y)) continue;
      return { x: x, y: y };
    }
    return { x: cx, y: cy };
  }

  function DefendMode() {
    var scene = null, sprite = null;
    var maxHp = BASE_HP, hp = BASE_HP;
    var objX = 0, objY = 0;
    var duration = _depthSeconds(), remaining = duration, spawnAcc = 0;
    return {
      start: function (sc) {
        scene = sc || null;
        maxHp = hp = BASE_HP;
        duration = remaining = _depthSeconds();
        spawnAcc = 0;
        // Altar FIX in der Raummitte (begehbar); Fallbacks für prozedurale Räume.
        objX = objY = 0;
        var b = scene && scene.physics && scene.physics.world && scene.physics.world.bounds;
        if (b) { objX = b.centerX; objY = b.centerY; }
        if (scene && typeof scene.isPointAccessible === 'function' && !scene.isPointAccessible(objX, objY)) {
          if (typeof scene.pickAccessibleSpawnPoint === 'function') {
            var sp = scene.pickAccessibleSpawnPoint({ maxAttempts: 24 });
            if (sp) { objX = sp.x; objY = sp.y; }
          } else if (window.player) { objX = window.player.x; objY = window.player.y; }
        }
        if (!objX && !objY && typeof window !== 'undefined' && window.player) {
          objX = window.player.x; objY = window.player.y - 120;
        }
        if (scene && scene.add) {
          _ensureTex(scene);
          try { sprite = scene.add.sprite(objX, objY, DEPTH_TEX).setDepth(400).setScrollFactor(1); }
          catch (e) { sprite = null; }
        }
        // Gegner zum Altar ZIEHEN (Melee-Ziel-Override in enemy.js). So spielt
        // sich der Kampf am Altar ab, unabhängig von der Raumgröße.
        if (typeof window !== 'undefined') window.__ENEMY_CHASE_OVERRIDE__ = { x: objX, y: objY };
      },
      update: function (dtMs) {
        var dt = (typeof dtMs === 'number' && dtMs > 0 ? dtMs : 16) / 1000;
        // Nachschub um den Altar (solange Ansturm läuft + Altar lebt).
        if (hp > 0 && remaining > 0 && scene && typeof window !== 'undefined' && typeof window.spawnEnemy === 'function') {
          spawnAcc += dt;
          if (spawnAcc >= SPAWN_INTERVAL) {
            spawnAcc = 0;
            var active = _aliveEnemies();
            var n = Math.min(SPAWN_BATCH, Math.max(0, MAX_CONCURRENT - active));
            for (var i = 0; i < n; i++) {
              var pos = _ringAroundAltar(scene, objX, objY);
              try { window.spawnEnemy.call(scene, pos.x, pos.y, 'enemy'); } catch (e) {}
            }
          }
        }
        if (remaining > 0) remaining = Math.max(0, remaining - dt);
        // Drain nur durch Gegner IN DER ZONE — ÜBERPROPORTIONAL: je mehr Gegner
        // gleichzeitig im Kreis, desto schneller fällt der Altar (Swarm-Druck).
        if (hp > 0) {
          var _n = _enemiesNearAltar(objX, objY);
          if (_n > 0) {
            var drain = _n * DRAIN_PER_ENEMY_PER_SEC * (1 + (_n - 1) * DRAIN_ESCALATION) * dt;
            hp = Math.max(0, hp - drain);
          }
        }
        if (sprite) {
          try {
            var frac = maxHp > 0 ? hp / maxHp : 0;
            if (hp <= 0) { sprite.setTint(0x555555); sprite.setAlpha(0.6); }
            else if (frac < 0.35) sprite.setTint(0xff6a6a);
            else sprite.clearTint();
          } catch (e) {}
        }
        // Ist der Ansturm vorbei (Altar tot / Zeit um), den Ziel-Override
        // freigeben -> Gegner jagen wieder den Spieler.
        if ((remaining <= 0 || hp <= 0) && typeof window !== 'undefined') {
          window.__ENEMY_CHASE_OVERRIDE__ = null;
        }
      },
      // Räumt den Altar-Sprite auf + gibt den Ziel-Override frei (Raum-/Modus-
      // Wechsel) — sonst bleibt der Sprite hängen bzw. Gegner laufen weiter zum
      // alten Altar-Punkt.
      stop: function () {
        if (sprite) { try { sprite.destroy(); } catch (e) {} sprite = null; }
        if (typeof window !== 'undefined') window.__ENEMY_CHASE_OVERRIDE__ = null;
      },
      // Zeit-basiert: Ansturm überstanden ODER Altar gefallen -> Raum öffnet.
      isComplete: function () { return remaining <= 0 || hp <= 0; },
      objectiveFailed: function () { return hp <= 0; },
      getState: function () {
        return {
          mode: 'defend', hp: Math.ceil(hp), maxHp: maxHp, x: objX, y: objY,
          drainRadius: DRAIN_RADIUS,
          seconds: Math.ceil(remaining), remaining: remaining, failed: hp <= 0
        };
      }
    };
  }

  if (typeof window !== 'undefined' && window.RoomMode && typeof window.RoomMode.register === 'function') {
    window.RoomMode.register('defend', DefendMode);
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DefendMode: DefendMode, _depthSeconds: _depthSeconds };
  }
})();
