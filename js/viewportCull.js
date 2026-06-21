/* =====================================================================
 * viewportCull.js — Off-Screen-Culling für Dungeon-Raumgeometrie (053 WP03)
 * ---------------------------------------------------------------------
 * Problem (perfProbe-Diagnose 2026-06): ein Procroom hält ~520 sichtbare
 * Welt-Objekte (269 Obstacle-Sprites, 186 Images, 91 Wand-TileSprites,
 * 65 Texts). Die Kamera (960×480) zeigt aber nur ~1/40 des 3328×2816-px-
 * Raums. Phaser cullt einzelne Sprites/Images NICHT automatisch → alle
 * ~520 erzeugen jeden Frame einen Draw-Call, obwohl die meisten off-screen
 * liegen. Das ist der dominante Draw-Call-Sink (~380 draws/frame, 20fps).
 *
 * Lösung: jeden Frame off-screen Raum-Objekte auf visible=false setzen.
 *   - NULL visuelle Regression (off-screen = ohnehin unsichtbar)
 *   - NULL Gameplay-Effekt (Arcade-Physik nutzt den Body, nicht .visible)
 *   - hilft Desktop wie Mobile → kein Mobile-Gating nötig
 *
 * Gecullt werden NUR Raum-Geometrie-Sammlungen:
 *   - scene._templateWalls (Floor, Wände, Deko-Images/Graphics, Texts)
 *   - window.obstacles (StaticGroup der Obstacle-Sprites)
 * NICHT gecullt: Gegner, Loot, Projektile, Player, HUD — die sind wenige
 * und sollen sichtbar bleiben (kein Risiko falscher Sichtbarkeit).
 * ===================================================================== */
(function () {
  'use strict';

  function centerAndHalf(o) {
    // Origin-bewusst: Center unabhängig von originX/Y bestimmen, damit der
    // mit origin (0,0) gesetzte gebackene Floor korrekt behandelt wird.
    var dw = o.displayWidth || o.width || 32;
    var dh = o.displayHeight || o.height || 32;
    var ox = (o.originX == null) ? 0.5 : o.originX;
    var oy = (o.originY == null) ? 0.5 : o.originY;
    return {
      cx: o.x + (0.5 - ox) * dw,
      cy: o.y + (0.5 - oy) * dh,
      hw: dw * 0.5,
      hh: dh * 0.5
    };
  }

  window.ViewportCull = {
    // padding: Sicherheitsrand in px, damit Objekte vor dem Kamerarand
    // einblenden statt sichtbar zu poppen.
    cull: function (scene, padding) {
      try {
        if (!scene || !scene.cameras || !scene.cameras.main) return;
        var v = scene.cameras.main.worldView;
        if (!v) return;
        var pad = (typeof padding === 'number') ? padding : 96;
        var left = v.x - pad, right = v.right + pad, top = v.y - pad, bottom = v.bottom + pad;

        var cullOne = function (o) {
          if (!o || o.scrollFactorX !== 1 || o.scrollFactorY !== 1) return; // HUD/UI auslassen
          var c = centerAndHalf(o);
          var onScreen = (c.cx + c.hw >= left) && (c.cx - c.hw <= right) &&
                         (c.cy + c.hh >= top) && (c.cy - c.hh <= bottom);
          if (o.visible !== onScreen) o.visible = onScreen;
        };

        var walls = scene._templateWalls;
        if (Array.isArray(walls)) {
          for (var i = 0; i < walls.length; i++) cullOne(walls[i]);
        }
        var obs = window.obstacles;
        if (obs && typeof obs.children !== 'undefined' && obs.children) {
          obs.children.iterate(cullOne);
        }
      } catch (e) { /* darf den Game-Loop nie brechen */ }
    }
  };
})();
