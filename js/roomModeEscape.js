/* =====================================================================
 * roomModeEscape.js — Raum-Modus "escape" (Feature 061, WP06, optional)
 * ---------------------------------------------------------------------
 * "Halte durch, bis der Fluchtweg frei ist": ein KURZER, dichter Gauntlet
 * mit hohem Nachschub-Druck (frenetischer als survival). Die Treppe öffnet,
 * wenn der Timer abläuft. Self-registrierend. HUD/Banner rendert WP05.
 * (Eine echte "erreiche-diesen-Ausgang"-Variante braeuchte Tür-System-
 * Integration — bewusst als spaeteres Upgrade offen gelassen.)
 * ===================================================================== */
(function () {
  'use strict';

  if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', {
      'roommode.escape.banner': 'Ausbruch!',
      'roommode.escape.info': 'Der Ausgang ist versiegelt — überlebe {seconds}s, dann brichst du aus.',
      'roommode.escape.hud': 'Ausbruch in {seconds}s'
    });
    window.i18n.register('en', {
      'roommode.escape.banner': 'Breakout!',
      'roommode.escape.info': 'The exit is sealed — survive {seconds}s, then you break out.',
      'roommode.escape.hud': 'Breakout in {seconds}s'
    });
  }

  var BASE_SECONDS = 30;      // Startdauer (war 18) — bewusster Fluchtdruck
  var MAX_BONUS = 30;         // bis +30s in der Tiefe (Deckel 60s)
  var SPAWN_INTERVAL = 2.0;   // dichter Nachschub
  var SPAWN_BATCH = 3;        // groessere Schuebe
  var MAX_CONCURRENT = 16;

  function _depthSeconds() {
    var d = 1;
    if (typeof window !== 'undefined' && typeof window.DUNGEON_DEPTH === 'number' && window.DUNGEON_DEPTH > 0) d = window.DUNGEON_DEPTH;
    return Math.round(BASE_SECONDS + Math.min(MAX_BONUS, (d - 1) * 1));
  }

  function EscapeMode() {
    var scene = null, duration = _depthSeconds(), remaining = duration, spawnAcc = 0;
    return {
      start: function (sc) { scene = sc || null; duration = remaining = _depthSeconds(); spawnAcc = 0; },
      update: function (dtMs) {
        var dt = (typeof dtMs === 'number' && dtMs > 0 ? dtMs : 16) / 1000;
        if (remaining > 0) remaining = Math.max(0, remaining - dt);
        if (remaining > 0 && scene && typeof window !== 'undefined' && typeof window.spawnEnemy === 'function') {
          spawnAcc += dt;
          if (spawnAcc >= SPAWN_INTERVAL) {
            spawnAcc = 0;
            var active = (window.enemies && typeof window.enemies.countActive === 'function') ? window.enemies.countActive(true) : 0;
            var n = Math.min(SPAWN_BATCH, Math.max(0, MAX_CONCURRENT - active));
            for (var i = 0; i < n; i++) { try { window.spawnEnemy.call(scene, 0, 0, 'enemy'); } catch (e) {} }
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
