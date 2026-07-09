/* =====================================================================
 * roomModeSurvival.js — Raum-Modus "survival" (Feature 061, WP02)
 * ---------------------------------------------------------------------
 * "Überlebe {seconds}s": zeitgesteuerte, NACHRÜCKENDE Gegner-Spawns; die
 * Treppe öffnet, wenn der Timer abläuft (nicht wenn der Raum leer ist).
 * Self-registrierend über window.RoomMode.register('survival', …). Kein
 * Rendering hier — der HUD-State kommt über getState() (Visuals = WP05).
 * ===================================================================== */
(function () {
  'use strict';

  if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', {
      'roommode.survival.banner': 'Überlebe {seconds} Sekunden!',
      'roommode.survival.hud': 'Überleben: {seconds}s'
    });
    window.i18n.register('en', {
      'roommode.survival.banner': 'Survive {seconds} seconds!',
      'roommode.survival.hud': 'Survive: {seconds}s'
    });
  }

  var BASE_SECONDS = 60;      // Grunddauer
  var MAX_SECONDS = 120;      // Deckel bei großer Tiefe
  var SPAWN_INTERVAL = 5.0;   // s zwischen Nachschub-Schüben (entschärft von 3s)
  var SPAWN_BATCH = 2;        // Gegner pro Schub
  var MAX_CONCURRENT = 14;    // Deckel gleichzeitiger Gegner (Anti-Überfüllung)
  var HP_MULT = 2;            // Gegner-HP im Überlebensmodus (× Basis) — mehr Druck

  // Nachschub spawnt in einem RING um die AKTUELLE Spieler-Position (jeder Schub
  // liest window.player LIVE, folgt also dem Spieler statt an einem festen Punkt
  // zu kleben). Radien knapp über MIN_SPAWN_DISTANCE (300px in spawnEnemy), damit
  // nichts auf dem Spieler aufpoppt, aber nah genug zum schnellen Herandrängen.
  var SPAWN_MIN_R = 320;
  var SPAWN_MAX_R = 440;

  // Dauer skaliert mit Tiefe: 60s .. 120s.
  function _depthSeconds() {
    var d = 1;
    if (typeof window !== 'undefined' && typeof window.DUNGEON_DEPTH === 'number' && window.DUNGEON_DEPTH > 0) d = window.DUNGEON_DEPTH;
    return Math.min(MAX_SECONDS, BASE_SECONDS + (d - 1) * 2);
  }

  // Zufällige Ring-Position um die AKTUELLE Spieler-Position. Bevorzugt eine
  // begehbare Stelle; findet sich keine, wird trotzdem der beste NAHE Kandidat
  // zurückgegeben (statt auf den Weit-weg-Standardspawn zu fallen — spawnEnemy
  // rückt eine leicht blockierte Stelle lokal auf eine freie Nachbarkachel).
  // null nur, wenn es (noch) keinen Spieler gibt.
  function _ringPosNearPlayer(scene) {
    var p = (typeof window !== 'undefined') ? window.player : null;
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return null;
    var fallback = null;
    for (var i = 0; i < 20; i++) {
      var ang = Math.random() * Math.PI * 2;
      var r = SPAWN_MIN_R + Math.random() * (SPAWN_MAX_R - SPAWN_MIN_R);
      var x = p.x + Math.cos(ang) * r;
      var y = p.y + Math.sin(ang) * r;
      if (x <= 0 || y <= 0) continue; // spawnEnemy nutzt explizite Coords nur > 0
      if (!fallback) fallback = { x: x, y: y }; // erster gültiger Ring-Punkt
      if (scene && typeof scene.isPointAccessible === 'function' && !scene.isPointAccessible(x, y)) continue;
      return { x: x, y: y }; // begehbar → beste Wahl
    }
    return fallback; // kein begehbarer Punkt → trotzdem NAH am Spieler
  }

  function SurvivalMode() {
    var scene = null;
    var duration = _depthSeconds();
    var remaining = duration;
    var spawnAcc = 0;
    return {
      start: function (sc) {
        scene = sc || null;
        duration = _depthSeconds();
        remaining = duration;
        spawnAcc = 0;
      },
      update: function (dtMs) {
        var dt = (typeof dtMs === 'number' && dtMs > 0 ? dtMs : 16) / 1000;
        if (remaining > 0) remaining = Math.max(0, remaining - dt);
        // Nachschub nur solange der Timer läuft + ein Concurrency-Deckel greift.
        if (remaining > 0 && scene && typeof window !== 'undefined' && typeof window.spawnEnemy === 'function') {
          spawnAcc += dt;
          if (spawnAcc >= SPAWN_INTERVAL) {
            spawnAcc = 0;
            var active = (window.enemies && typeof window.enemies.countActive === 'function') ? window.enemies.countActive(true) : 0;
            var room = Math.max(0, MAX_CONCURRENT - active);
            var n = Math.min(SPAWN_BATCH, room);
            for (var i = 0; i < n; i++) {
              try {
                var pos = _ringPosNearPlayer(scene);
                if (pos) window.spawnEnemy.call(scene, pos.x, pos.y, 'enemy');
                else window.spawnEnemy.call(scene, 0, 0, 'enemy');
              } catch (e) {}
            }
          }
        }
      },
      isComplete: function () { return remaining <= 0; },
      objectiveFailed: function () { return false; },
      // Gegner im Überlebensmodus sind zäher (× HP_MULT) — von spawnEnemy über
      // window.RoomMode.enemyHpMultiplier() pro Gegner abgefragt.
      enemyHpMultiplier: function () { return HP_MULT; },
      getState: function () {
        return { mode: 'survival', remaining: remaining, duration: duration, seconds: Math.ceil(remaining) };
      }
    };
  }

  if (typeof window !== 'undefined' && window.RoomMode && typeof window.RoomMode.register === 'function') {
    window.RoomMode.register('survival', SurvivalMode);
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SurvivalMode: SurvivalMode, _depthSeconds: _depthSeconds };
  }
})();
