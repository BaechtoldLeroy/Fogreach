/* =====================================================================
 * hubNeuKarte.js — der Boden des neuen Hubs als Kachelkarte (#181)
 * ---------------------------------------------------------------------
 * Reine Daten, keine Phaser-Abhaengigkeit: 48x32 Kacheln zu je 32
 * Weltpixeln ergeben die 1536x1024 der Hub-Welt. Eine Kachel entspricht
 * damit 20 Entwurfseinheiten des 960x640-Rasters, in dem HUB_HITBOXES
 * geschrieben ist (1536/960 = 1.6 Weltpixel je Entwurfseinheit).
 *
 * Der erste Entwurf wurde aus den Layout-Rechtecken abgeleitet, damit
 * Boden und Kollisionen von Anfang an uebereinanderliegen. Ab jetzt ist
 * die Karte von Hand zu aendern — sie ist die Quelle, nicht das Erzeugte.
 *
 * Zeichen:
 *   .  Platte          die gehauenen Steinplatten des Platzes
 *   ,  Platte, rissig  verwittert; Brunnenrand und Treppenvorfeld
 *   #  Pflaster        die Gasse auf Eingangshoehe, die Strasse hinaus
 *   g  Gras            Waldrand links und rechts
 *   d  Erde            die Vorplaetze der beiden Katen
 *   w  dunkler Stein   Gebaeudesockel, Stadtmauer, Brunnenbecken
 *   x  nichts          hinter der Stadtmauer: Ferne und Nebel
 * ===================================================================== */
(function () {
  'use strict';

  var HUB_NEU_KARTE = {
    kachel: 32,          // Weltpixel je Kachel — wie TILE_PX im Dungeon
    breite: 48,
    hoehe: 32,

    // Zeichen -> Bildnummern in assets/hub/boden<n>.png. Mehrere Nummern
    // heissen: die Kachel wird gestreut, damit kein Muster entsteht.
    legende: {
      '.': [0, 1, 2, 3],
      ',': [4, 5, 6, 7],
      '#': [10, 11],
      'g': [12, 13],
      'd': [9],
      'w': [8],
      'x': []
    },

    zeilen: [
      'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'xxxxxxxxxxxxxxxxxxwwwwwwwwwwwwxxxxxxxxxxxxxxxxxx',
      'xxxxxxxxxxxxxxxxxxwwwwwwwwwwwwxxxxxxxxxxxxxxxxxx',
      'xxxxxxxxxxxxxxxxxxwwwwwwwwwwwwxxxxxxxxxxxxxxxxxx',
      'xxxxxxxxxxxxxxxxxxwwwwwwwwwwwwxxxxxxxxxxxxxxxxxx',
      'xxxxxxxxxxxxxxxxxxwwwwwwwwwwwwxxxxxxxxxxxxxxxxxx',
      'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
      'gggggggwwwwwwwwwwwwww,,,,,wwwwwwwwwwwwwwwggggggg',
      'ggggggg.wwwwwwww.....,,,,,......wwwwwwww.ggggggg',
      'ggggggg...##########,,,,,,,##########....ggggggg',
      'ggggggg...##########,wwwww,##########....ggggggg',
      'gggggggggg..........,wwwww,...........gggggggggg',
      'gggggggggg..........,wwwww,...........gggggggggg',
      'gggggggggg..........,,,,,,,...........gggggggggg',
      'gggggggggg............................gggggggggg',
      'gggggggggg............................gggggggggg',
      'gggggggggg............................gggggggggg',
      'gggggggggg............................gggggggggg',
      'gggggggwwwwwww....................wwwwwwwggggggg',
      'gggggggwwwwwww....................wwwwwwwggggggg',
      'gggggddddddddd....................dddddddddggggg',
      'gggggddddddddd....................dddddddddggggg',
      'gggggddddddddd........####........dddddddddggggg',
      'gggggddddddddd........####........dddddddddggggg',
      'ggggggg...............####...............ggggggg'
    ]
  };

  if (typeof window !== 'undefined') window.HUB_NEU_KARTE = HUB_NEU_KARTE;
  if (typeof module !== 'undefined' && module.exports) module.exports = HUB_NEU_KARTE;
})();
