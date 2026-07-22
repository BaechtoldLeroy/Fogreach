// propRange.js — Reichweiten-Prüfung für zerstörbare Props.
//
// Bewusst eine eigene, abhängigkeitsfreie Datei: die Funktion ist reine
// Mathematik, wird aber aus player.js (breakDestructiblesInRange) heraus
// genutzt. Läge sie dort, müsste ein Test die komplette player.js samt Phaser
// laden — dafür wären ausufernde Stubs nötig.
//
// Gemessen wird bis zur OBERFLAECHE des Props, nicht bis zu seinem Mittelpunkt:
// ein Prop gilt als getroffen, sobald der Wirkkreis es berührt.
//
// Warum das zählt: früher wurde nur Mitte-zu-Mitte geprüft. Bei schmalen
// Wirkbereichen war das spürbar falsch — beim Ansturm (Radius 34) blockiert
// eine Kiste den Dash, ihr Mittelpunkt liegt dann aber bereits ~33-40px
// entfernt (halbe Spielerbreite 17 + halbe Kistenbreite 16). Der Spieler
// rammte die Kiste also, ohne sie zu zerbrechen.
//
// Classic Script: hängt window._propInRange an.
(function () {
  'use strict';

  function propInRange(obs, px, py, range) {
    if (!obs) return false;
    var dx = (obs.x || 0) - px;
    var dy = (obs.y || 0) - py;
    // Ohne Grössenangabe fällt es auf Mitte-zu-Mitte zurück (half = 0).
    var half = Math.max(obs.displayWidth || 0, obs.displayHeight || 0) * 0.5;
    return (Math.hypot(dx, dy) - half) <= range;
  }

  window._propInRange = propInRange;
})();
