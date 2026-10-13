/* =====================================================================
 * roomModeEscape.js — Raum-Modus "escape" (Feature 061, WP06, optional)
 * ---------------------------------------------------------------------
 * "Halte durch, bis der Fluchtweg frei ist": ein KURZER, dichter Gauntlet
 * mit hohem Nachschub-Druck (frenetischer als survival). Die Treppe öffnet,
 * wenn der Timer abläuft. Self-registrierend. HUD/Banner rendert WP05.
 * (Eine echte "erreiche-diesen-Ausgang"-Variante bräuchte Tür-System-
 * Integration — bewusst als späteres Upgrade offen gelassen.)
 * ===================================================================== */
(function () {
  'use strict';

  if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', {
      'roommode.escape.banner': 'Flucht!',
      'roommode.escape.info': 'Der Ausgang ist offen — flieh jederzeit! Wer {seconds}s im Ansturm durchhält, erhält eine Bonus-Truhe.',
      'roommode.escape.hud': 'Bonus in {seconds}s'
    });
    window.i18n.register('en', {
      'roommode.escape.banner': 'Flee!',
      'roommode.escape.info': 'The exit is open — flee anytime! Hold out {seconds}s in the onslaught for a bonus chest.',
      'roommode.escape.hud': 'Bonus in {seconds}s'
    });
  }

  var BASE_SECONDS = 30;      // Startdauer (war 18) — bewusster Fluchtdruck
  var MAX_BONUS = 30;         // bis +30s in der Tiefe (Deckel 60s)
  var SPAWN_INTERVAL = 2.0;   // dichter Nachschub
  var SPAWN_BATCH = 3;        // grössere Schübe
  var MAX_CONCURRENT = 16;

  function _depthSeconds() {
    var d = 1;
    if (typeof window !== 'undefined' && typeof window.DUNGEON_DEPTH === 'number' && window.DUNGEON_DEPTH > 0) d = window.DUNGEON_DEPTH;
    return Math.round(BASE_SECONDS + Math.min(MAX_BONUS, (d - 1) * 1));
  }

  function EscapeMode() {
    var scene = null, duration = _depthSeconds(), remaining = duration, spawnAcc = 0, typ = 'enemy', zug = 0;
    var marken = [];
    // Vorschau raummodi=neu: der Ausgang ist die Treppe — darunter ein gruenes
    // Fluchtsiegel, darueber ein schwebender Pfeil. Rein zur Anzeige; ohne
    // Bild bleibt die Treppe wie sie ist (heute gab es hier gar kein Objekt).
    function _marken(sc) {
      var B = (typeof window !== 'undefined') ? window.RoomModeBilder : null;
      var grp = sc && sc.stairsGroup;
      if (!B || !grp || typeof grp.getChildren !== 'function') return;
      var T = window.WELT_TIEFEN;
      grp.getChildren().forEach(function (s) {
        if (!s || !s.active) return;
        var fuss = s.y + s.displayHeight * (1 - s.originY);
        // Knapp unter der Treppe, so umrahmt das Siegel sie, statt sie zu verdecken.
        var sg = B.siegel(sc, 'flucht', s.x, fuss - s.displayHeight * 0.25, T ? T.TREPPE - 0.5 : 33.5);
        if (!sg) return;
        sg.setScale(Math.max(1, s.displayWidth * 1.35 / sg.width));
        marken.push(sg);
        var pf = B.schwebe(sc, 'fluchtpfeil', s.x, s.y - s.displayHeight * (s.originY) - 2);
        if (pf) marken.push(pf);
      });
    }
    return {
      // #161: ctx.gegnerTyp — nach dem Bruch jagt Dich die Kettenwache (6).
      // #12: auch als Liste; sie wird reihum abgearbeitet (Waechter mit Hunden).
      start: function (sc, ctx) {
        scene = sc || null; duration = remaining = _depthSeconds(); spawnAcc = 0; zug = 0;
        typ = (ctx && ctx.gegnerTyp) ? ctx.gegnerTyp : 'enemy';
        _marken(scene);
      },
      // Raum-/Modus-Wechsel: die Fluchtmarken bleiben nicht im naechsten Raum.
      stop: function () {
        marken.forEach(function (m) { try { m.destroy(); } catch (e) {} });
        marken = [];
      },
      update: function (dtMs) {
        var dt = (typeof dtMs === 'number' && dtMs > 0 ? dtMs : 16) / 1000;
        if (remaining > 0) remaining = Math.max(0, remaining - dt);
        if (remaining > 0 && scene && typeof window !== 'undefined' && typeof window.spawnEnemy === 'function') {
          spawnAcc += dt;
          if (spawnAcc >= SPAWN_INTERVAL) {
            spawnAcc = 0;
            var active = (window.enemies && typeof window.enemies.countActive === 'function') ? window.enemies.countActive(true) : 0;
            var n = Math.min(SPAWN_BATCH, Math.max(0, MAX_CONCURRENT - active));
            for (var i = 0; i < n; i++) {
              var t = Array.isArray(typ) ? typ[(zug++) % typ.length] : typ;
              try { window.spawnEnemy.call(scene, 0, 0, t); } catch (e) {}
            }
          }
        }
      },
      isComplete: function () { return remaining <= 0; },
      objectiveFailed: function () { return false; },
      getState: function () { return { mode: 'escape', remaining: remaining, duration: duration, seconds: Math.ceil(remaining) }; }
    };
  }

  if (typeof window !== 'undefined' && window.RoomMode && typeof window.RoomMode.register === 'function') {
    window.RoomMode.register('escape', EscapeMode);
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EscapeMode: EscapeMode, _depthSeconds: _depthSeconds };
  }
})();
