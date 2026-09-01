/* =====================================================================
 * roomModeAnchor.js — Ankerobjekt eines Raum-Ereignisses (#112)
 * ---------------------------------------------------------------------
 * Bis hierher startete ein Spezialraum beim BETRETEN: die Uhr lief, waehrend
 * der Spieler den Altar ueberhaupt erst suchte. Jetzt stellt jeder solche
 * Modus zuerst nur sein ANKEROBJEKT hin und wartet, bis der Spieler es sieht.
 *
 * Dieses Modul haelt die zwei Dinge, die dabei alle Modi gemeinsam brauchen:
 * einen Platz in der Raummitte, und die Antwort auf "liegt der Punkt im
 * Blickbereich?".
 *
 * Rein genug fuer Tests: ohne Phaser faellt die Sichtpruefung auf den
 * Abstand zurueck, ohne Szene liefert sie false.
 * ===================================================================== */
(function () {
  'use strict';

  // Deckungsgleich mit VISION_RADIUS in roomManager.js: weiter als bis dahin
  // reicht das Sichtpolygon ohnehin nicht. Der Wert dient nur als Rueckfall,
  // wenn (noch) kein Polygon vorliegt — sonst waere das Ereignis in einem
  // Lauf ohne Nebel-Tick gar nicht ausloesbar.
  var SICHT_RADIUS = 220;

  /**
   * Liegt (x,y) im Blickbereich des Spielers?
   *
   * Bevorzugt das Sichtpolygon, das updateFogOfWar pro Nebel-Tick in
   * `scene._lastVisionPolygon` ablegt — nur so bleibt eine Wand oder eine
   * geschlossene Tuer dazwischen wirksam. Anders als bei den Gegner-Auren
   * (eliteEnemies._isInVision) ist der Rueckfall hier NICHT "sichtbar":
   * ein Ausloeser darf im Zweifel nicht feuern.
   */
  function sichtbar(scene, x, y) {
    if (!scene || typeof x !== 'number' || typeof y !== 'number') return false;
    var p = (typeof window !== 'undefined') ? window.player : null;
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return false;
    var dx = p.x - x, dy = p.y - y;
    // Erst der billige Abstand: das Polygon reicht nie weiter als SICHT_RADIUS,
    // also spart der Test in der Ferne den Polygon-Aufbau.
    if (dx * dx + dy * dy > SICHT_RADIUS * SICHT_RADIUS) return false;

    var poly = scene._lastVisionPolygon;
    var P = (typeof window !== 'undefined') ? window.Phaser : null;
    if (!poly || poly.length < 6 || !P || !P.Geom || !P.Geom.Polygon) {
      return true;   // kein Polygon verfuegbar -> Abstand entscheidet allein
    }
    try {
      // Dasselbe Zwischenspeichern wie in eliteEnemies: das Polygon-Objekt nur
      // neu bauen, wenn sich die Punktliste geaendert hat.
      if (!scene._lastVisionPolyObj || scene._lastVisionPolyData !== poly) {
        scene._lastVisionPolyObj = new P.Geom.Polygon(poly);
        scene._lastVisionPolyData = poly;
      }
      return !!P.Geom.Polygon.Contains(scene._lastVisionPolyObj, x, y);
    } catch (e) {
      return true;   // Polygon kaputt -> der Abstand oben hat schon zugestimmt
    }
  }

  /**
   * Ein begehbarer Platz fuer das Ankerobjekt, moeglichst die Raummitte.
   *
   * Die Kette stammt aus roomModeDefend (Altar-Platzierung) und liegt jetzt
   * hier, damit survival und hunt ihre Anker nicht anders platzieren als
   * defend den seinen.
   */
  function mitteImRaum(scene) {
    var x = 0, y = 0;
    var b = scene && scene.physics && scene.physics.world && scene.physics.world.bounds;
    if (b) { x = b.centerX; y = b.centerY; }
    if (scene && typeof scene.isPointAccessible === 'function' && !scene.isPointAccessible(x, y)) {
      if (typeof scene.pickAccessibleSpawnPoint === 'function') {
        // pickAccessibleSpawnPoint liefert IRGENDEINEN begehbaren Punkt — gemessen
        // landete der Altar damit auch schon im Eingangsbereich, wo der Spieler
        // ihn beim Betreten sofort vor der Nase hat. Mehrfach ziehen und den
        // Punkt behalten, der der echten Raummitte am naechsten liegt.
        var best = null, bestD = Infinity;
        for (var i = 0; i < 12; i++) {
          var sp = scene.pickAccessibleSpawnPoint({ maxAttempts: 24 });
          if (!sp) continue;
          var ddx = sp.x - x, ddy = sp.y - y, d = ddx * ddx + ddy * ddy;
          if (d < bestD) { bestD = d; best = sp; }
        }
        if (best) { x = best.x; y = best.y; }
      } else if (typeof window !== 'undefined' && window.player) {
        x = window.player.x; y = window.player.y;
      }
    }
    if (!x && !y && typeof window !== 'undefined' && window.player) {
      x = window.player.x; y = window.player.y - 120;
    }
    return { x: x, y: y };
  }

  /**
   * Der ruhende Zustand: sichtbar, aber erkennbar noch nicht aktiv.
   * Gedaempft und leicht entfaerbt — es soll neugierig machen, nicht draengen.
   */
  function ruhend(sprite) {
    if (!sprite) return sprite;
    try { sprite.setAlpha(0.55); if (sprite.setTint) sprite.setTint(0x8892aa); } catch (e) {}
    return sprite;
  }

  /** Der geweckte Zustand: volle Farbe, das Ereignis laeuft. */
  function geweckt(sprite) {
    if (!sprite) return sprite;
    try { sprite.setAlpha(1); if (sprite.clearTint) sprite.clearTint(); } catch (e) {}
    return sprite;
  }

  var RoomModeAnchor = {
    SICHT_RADIUS: SICHT_RADIUS,
    sichtbar: sichtbar,
    mitteImRaum: mitteImRaum,
    ruhend: ruhend,
    geweckt: geweckt
  };
  if (typeof window !== 'undefined') window.RoomModeAnchor = RoomModeAnchor;
  if (typeof module !== 'undefined' && module.exports) module.exports = RoomModeAnchor;
})();
