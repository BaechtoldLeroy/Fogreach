/* =====================================================================
 * roomModeSurvival.js — Raum-Modus "survival" (Feature 061, WP02)
 * ---------------------------------------------------------------------
 * "Überlebe {seconds}s": zeitgesteuerte, NACHRÜCKENDE Gegner-Spawns; die
 * Treppe öffnet, wenn der Timer abläuft (nicht wenn der Raum leer ist).
 * Self-registrierend über window.RoomMode.register('survival', …). Kein
 * Rendering hier — der HUD-State kommt über getState() (Visuals = WP05).
 *
 * #112: Der Modus hatte als einziger KEIN Objekt im Raum — die Uhr lief los,
 * sobald man eintrat, ohne dass irgendwo stand warum. Er bekommt deshalb einen
 * BANNKREIS als Anker: ein Runenring am Boden, der ruhend daliegt und den
 * Ansturm erst ausloest, wenn der Spieler ihn sieht.
 * ===================================================================== */
(function () {
  'use strict';

  if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', {
      'roommode.survival.banner': 'Überlebe {seconds} Sekunden!',
      'roommode.survival.info': 'Es rückt ständig Nachschub nach — und die Gegner hier sind zäher als üblich. Überlebe, bis der Timer abläuft.',
      'roommode.survival.hud': 'Überleben: {seconds}s'
    });
    window.i18n.register('en', {
      'roommode.survival.banner': 'Survive {seconds} seconds!',
      'roommode.survival.info': 'Reinforcements keep coming — and the enemies here are tougher than usual. Stay alive until the timer runs out.',
      'roommode.survival.hud': 'Survive: {seconds}s'
    });
  }

  var BASE_SECONDS = 60;      // Grunddauer
  var MAX_SECONDS = 120;      // Deckel bei großer Tiefe
  var SPAWN_INTERVAL = 2.5;   // s zwischen Nachschub-Schüben (halbiert -> schwerer)
  var SPAWN_BATCH = 2;        // Gegner pro Schub
  var MAX_CONCURRENT = 14;    // Deckel gleichzeitiger Gegner (Anti-Überfüllung)
  // Gegner-HP im Überlebensmodus (× Basis) — mehr Druck. Wird im Banner
  // ANGESAGT ('roommode.survival.info'): wer hier dreht, muss den Text mitziehen.
  var HP_MULT = 2;

  // Nachschub spawnt in einem RING um die AKTUELLE Spieler-Position (jeder Schub
  // liest window.player LIVE, folgt also dem Spieler statt an einem festen Punkt
  // zu kleben). Radien knapp über MIN_SPAWN_DISTANCE (300px in spawnEnemy), damit
  // nichts auf dem Spieler aufpoppt, aber nah genug zum schnellen Herandrängen.
  var SPAWN_MIN_R = 320;
  var SPAWN_MAX_R = 440;

  var ANKER_TEX = 'roommode_survival_bannkreis';

  // Bannkreis: ein flacher Runenring am Boden. Bewusst KEIN Hindernis und
  // KEIN Sprite in Augenhoehe — er markiert eine Stelle, er versperrt sie nicht.
  function _ensureTex(scene) {
    if (!scene || !scene.textures || scene.textures.exists(ANKER_TEX)) return;
    try {
      // Bildsprache wie beim Altar: dunkler Koerper, heller Akzent, weicher
      // Schein. Eine flaechig gefuellte Scheibe verschwindet auf dem dunklen
      // Boden — es traegt der leuchtende Ring, nicht die Flaeche.
      var g = scene.make.graphics({ add: false });
      var c = 48;
      // Schein
      g.fillStyle(0x7a3ff0, 0.14); g.fillCircle(c, c, 46);
      g.fillStyle(0x7a3ff0, 0.10); g.fillCircle(c, c, 34);
      // Dunkles Steinband, darauf die glimmende Rune
      g.lineStyle(8, 0x241f30, 0.9); g.strokeCircle(c, c, 40);
      g.lineStyle(3, 0x9a5cff, 0.95); g.strokeCircle(c, c, 40);
      g.lineStyle(2, 0x7a3ff0, 0.7); g.strokeCircle(c, c, 26);
      // Acht Runenstriche zwischen den Ringen
      g.lineStyle(3.5, 0xd8c4ff, 0.9);
      for (var i = 0; i < 8; i++) {
        var a = (Math.PI * 2 / 8) * i;
        var ca = Math.cos(a), sa = Math.sin(a);
        g.beginPath();
        g.moveTo(c + ca * 26, c + sa * 26);
        g.lineTo(c + ca * 40, c + sa * 40);
        g.strokePath();
      }
      // Kristallzeichen in der Mitte — dieselbe Raute wie auf dem Altar.
      g.fillStyle(0x9a5cff, 1);
      g.beginPath(); g.moveTo(c, c - 14); g.lineTo(c + 9, c); g.lineTo(c, c + 14); g.lineTo(c - 9, c); g.closePath(); g.fillPath();
      g.fillStyle(0xe6d8ff, 0.95);
      g.beginPath(); g.moveTo(c, c - 8); g.lineTo(c + 5, c); g.lineTo(c, c + 8); g.lineTo(c - 5, c); g.closePath(); g.fillPath();
      g.generateTexture(ANKER_TEX, 96, 96); g.destroy();
    } catch (e) {}
  }

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
    var sprite = null, ankerX = 0, ankerY = 0;
    return {
      // #112: Bannkreis hinlegen, ohne die Uhr zu starten.
      arm: function (sc) {
        scene = sc || null;
        var A = (typeof window !== 'undefined') ? window.RoomModeAnchor : null;
        var mitte = (A && typeof A.mitteImRaum === 'function') ? A.mitteImRaum(scene) : { x: 0, y: 0 };
        ankerX = mitte.x; ankerY = mitte.y;
        if (scene && scene.add) {
          _ensureTex(scene);
          // Depth -2: ueber der Bodenzeichnung (-5..-3), unter allem Beweglichen.
          try { sprite = scene.add.sprite(ankerX, ankerY, ANKER_TEX).setDepth(-2).setScrollFactor(1); }
          catch (e) { sprite = null; }
        }
        if (sprite && A && typeof A.ruhend === 'function') A.ruhend(sprite);
        return { x: ankerX, y: ankerY };
      },
      start: function (sc) {
        if (sc) scene = sc;
        if (!sprite && this.arm) { try { this.arm(scene); } catch (e) {} }
        duration = _depthSeconds();
        remaining = duration;
        spawnAcc = 0;
        var A = (typeof window !== 'undefined') ? window.RoomModeAnchor : null;
        if (sprite && A && typeof A.geweckt === 'function') A.geweckt(sprite);
      },
      // Raum-/Modus-Wechsel: der Bannkreis darf nicht in den naechsten Raum haengen.
      stop: function () {
        if (sprite) { try { sprite.destroy(); } catch (e) {} sprite = null; }
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
        return { mode: 'survival', remaining: remaining, duration: duration,
                 seconds: Math.ceil(remaining), x: ankerX, y: ankerY };
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
