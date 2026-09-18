// js/zeichen.js — das Zeichen des Schattenrats (#156).
//
// Story-Bibel v5, Abschnitt 5: statt einer Blaetter-Mechanik EIN Zeichen, das
// der Spieler wiedererkennt — drei Ketten, ineinander verschlungen. Es steht
// auf den Siegeln der geheimen Sitzung, auf dem Buendel aus Elaras erstem
// Auftrag, als Gravur auf ihrer Klinge und an ihrem Ring.
//
// Damit es an allen Stellen GLEICH aussieht, wird es an genau einer Stelle
// gezeichnet: hier. Die Textur entsteht bei Bedarf in der Szene, die sie
// braucht (Hub oder Dungeon), statt beim Boot in einer bestimmten.
(function () {
  'use strict';

  var KEY = 'zeichen_schattenrat';
  var GROESSE = 64;

  // Drei Ringe im Dreieck, die sich gegenseitig durchdringen. Dieselben drei
  // Lagen wie bei den anderen Symbolen: dunkler Umriss, Metall, eine helle
  // Lichtkante — ohne die wirkt es flach.
  var RINGE = [
    { x: 32, y: 21 },
    { x: 21, y: 40 },
    { x: 43, y: 40 }
  ];
  var RADIUS = 13;

  /**
   * Malt das Zeichen auf ein Graphics-Objekt, in ein Feld von 64 x 64.
   * Eigene Funktion, damit auch createItemGraphics (graphics.js) es beim Start
   * als Item-Symbol anlegen kann — gezeichnet wird es trotzdem nur hier.
   */
  function zeichnen(g) {
    RINGE.forEach(function (r) {
      g.lineStyle(7, 0x120e08, 1);          // Umriss
      g.strokeCircle(r.x, r.y, RADIUS);
    });
    RINGE.forEach(function (r) {
      g.lineStyle(4, 0x8a7440, 1);          // Metall
      g.strokeCircle(r.x, r.y, RADIUS);
    });
    RINGE.forEach(function (r) {
      g.lineStyle(1.5, 0xe0c878, 0.9);      // Lichtkante, nur oben
      g.beginPath();
      g.arc(r.x, r.y, RADIUS - 0.5, Math.PI * 1.1, Math.PI * 1.75, false);
      g.strokePath();
    });
    // Verschlungen, nicht nur uebereinander: an der AEUSSEREN Kreuzung jedes
    // Paares liegt reihum ein Ring oben (0 ueber 1, 1 ueber 2, 2 ueber 0).
    // Ohne das lag der zuletzt gezeichnete Ring ueberall oben, und es sah
    // nach drei Muenzen aus statt nach Kettengliedern.
    var mitte = { x: 32, y: 34 };
    for (var i = 0; i < RINGE.length; i++) {
      var oben = RINGE[i], unten = RINGE[(i + 1) % RINGE.length];
      var dx = unten.x - oben.x, dy = unten.y - oben.y, d = Math.hypot(dx, dy);
      var h = Math.sqrt(Math.max(0, RADIUS * RADIUS - (d / 2) * (d / 2)));
      var mx = (oben.x + unten.x) / 2, my = (oben.y + unten.y) / 2;
      var px = -dy / d, py = dx / d;
      var p1 = { x: mx + px * h, y: my + py * h }, p2 = { x: mx - px * h, y: my - py * h };
      var aussen = (Math.hypot(p1.x - mitte.x, p1.y - mitte.y) > Math.hypot(p2.x - mitte.x, p2.y - mitte.y)) ? p1 : p2;
      var w = Math.atan2(aussen.y - oben.y, aussen.x - oben.x);
      [[7, 0x120e08, 1], [4, 0x8a7440, 1]].forEach(function (lage) {
        g.lineStyle(lage[0], lage[1], lage[2]);
        g.beginPath();
        g.arc(oben.x, oben.y, RADIUS, w - 0.42, w + 0.42, false);
        g.strokePath();
      });
    }
  }

  /** Legt die Textur an, falls sie in dieser Szene noch fehlt. */
  function sicherstellen(scene) {
    if (!scene || !scene.textures) return null;
    if (scene.textures.exists(KEY)) return KEY;
    if (!scene.make || typeof scene.make.graphics !== 'function') return null;
    var g = scene.make.graphics({ add: false });
    zeichnen(g);
    g.generateTexture(KEY, GROESSE, GROESSE);
    g.destroy();
    return KEY;
  }

  /**
   * Ein Bild des Zeichens in der Szene.
   * @param {number} [px] Kantenlaenge auf dem Bildschirm
   */
  function bild(scene, x, y, px) {
    if (!sicherstellen(scene) || !scene.add || typeof scene.add.image !== 'function') return null;
    var img = scene.add.image(x, y, KEY);
    if (px) img.setDisplaySize(px, px);
    return img;
  }

  window.Zeichen = { KEY: KEY, GROESSE: GROESSE, zeichnen: zeichnen, sicherstellen: sicherstellen, bild: bild };
})();
