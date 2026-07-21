// propRange.js — Reichweiten-Pruefung fuer zerstoerbare Props.
//
// Bewusst eine eigene, abhaengigkeitsfreie Datei: die Funktion ist reine
// Mathematik, wird aber aus player.js (breakDestructiblesInRange) heraus
// genutzt. Laege sie dort, muesste ein Test die komplette player.js samt Phaser
// laden — dafuer waeren ausufernde Stubs noetig.
//
// Gemessen wird bis zur OBERFLAECHE des Props, nicht bis zu seinem Mittelpunkt:
// ein Prop gilt als getroffen, sobald der Wirkkreis es beruehrt.
//
// Warum das zaehlt: frueher wurde nur Mitte-zu-Mitte geprueft. Bei schmalen
// Wirkbereichen war das spuerbar falsch — beim Ansturm (Radius 34) blockiert
// eine Kiste den Dash, ihr Mittelpunkt liegt dann aber bereits ~33-40px
// entfernt (halbe Spielerbreite 17 + halbe Kistenbreite 16). Der Spieler
// rammte die Kiste also, ohne sie zu zerbrechen.
//
// Classic Script: haengt window._propInRange an.
(function () {
  'use strict';

  function propInRange(obs, px, py, range) {
    if (!obs) return false;
    var dx = (obs.x || 0) - px;
    var dy = (obs.y || 0) - py;
    // Ohne Groessenangabe faellt es auf Mitte-zu-Mitte zurueck (half = 0).
    var half = Math.max(obs.displayWidth || 0, obs.displayHeight || 0) * 0.5;
    return (Math.hypot(dx, dy) - half) <= range;
  }

  window._propInRange = propInRange;
})();
