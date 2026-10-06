/**
 * js/testGrafik.js — Austausch-Grafiken zum Ansehen, nur hinter einem Slug.
 *
 *   ?grafik=neu     Boden, Waende und Gegner aus den *Neu-Ordnern
 *   ?spieler=neu    dasselbe (der aeltere Name, bleibt gueltig)
 *
 * Ohne die Flagge passiert hier NICHTS: jede Funktion faellt sofort heraus,
 * und die ausgelieferten Wege bleiben unberuehrt.
 *
 * Warum ein eigener Weg fuer die Kacheln: Boden und Waende liegen NICHT als
 * Dateien vor, sondern werden in graphics.js gezeichnet (generateTexture).
 * Die PNGs unter assets/tiles sind tote Dateien, die niemand laedt. Ein
 * Austausch muss die fertigen Texturen also nachtraeglich ersetzen —
 * vorladen in preload, tauschen nach createAllGraphics.
 */
(function () {
  var FLAGGEN = ['grafik', 'spieler'];
  var ORDNER = 'assets/tilesNeu/';
  // Eigener Namensraum fuer die geladenen Dateien: die Zielschluessel sind zum
  // Ladezeitpunkt noch von den gezeichneten Texturen belegt.
  var VORSATZ = 'testgrafik__';

  // Schluessel, die graphics.js zeichnet -> Datei im Austausch-Ordner.
  // Die Groessen muessen uebereinstimmen (Boeden 32x32, Waende 64x64), sonst
  // kacheln sie nicht mehr sauber.
  var KACHELN = {
    floor_cobble: 'floor_cobble.png',
    floor_stone: 'floor_stone.png',
    floor_stone_dark: 'floor_stone_dark.png',
    floor_tile_ornate: 'floor_tile_ornate.png',
    wall_brick: 'wall_brick.png',
    wall_stone_large: 'wall_stone_large.png',
    wall_mossy: 'wall_mossy.png',
    wall_dungeon: 'wall_dungeon.png'
  };

  function _an() {
    try {
      for (var i = 0; i < FLAGGEN.length; i++) {
        var v = window.DebugGate && window.DebugGate.flagge(FLAGGEN[i]);
        if (v && String(v).toLowerCase() === 'neu') return true;
      }
    } catch (e) {}
    return false;
  }

  // Gegnertypen, die es im Austausch-Ordner WIRKLICH gibt. Alles andere
  // kommt weiter aus assets/enemy — sonst sucht das Spiel sechzehn Typen und
  // vier Bosse in einem Ordner, in dem zwei liegen, und die uebrigen fallen
  // stumm auf ihre prozeduralen Notnaegel zurueck.
  var NEUE_GEGNER = ['wolf', 'bat'];

  /** Hat dieser Gegnertyp ein Austausch-Bild? */
  window.testGrafikHatGegner = function (typ) {
    return _an() && NEUE_GEGNER.indexOf(String(typ)) !== -1;
  };

  // Anzeigebreite, die ein Tier im Spiel HATTE — die Austausch-Bilder sollen
  // genauso gross erscheinen. enemy.js skaliert sie sonst mit festen Faktoren
  // (Wolf 0.35, Fledermaus 0.22), die auf die alten gerenderten Quellen
  // geeicht sind (175x90 und 156x130). Die neuen Pixelbilder sind 51x32 und
  // 64x63 — derselbe Faktor machte daraus 18 und 14 px.
  var ZIEL_BREITE = { wolf: 61, bat: 34 };

  /**
   * Skaliert ein Tier auf seine gewohnte Anzeigebreite, wenn es aus dem
   * Austausch-Ordner kommt.
   *
   * @returns {boolean} true, wenn skaliert wurde — dann laesst enemy.js
   *          seinen festen Faktor aus.
   */
  window.testGrafikTierSkalieren = function (enemy, typ) {
    if (!_an() || !enemy || typeof enemy.setScale !== 'function') return false;
    if (NEUE_GEGNER.indexOf(String(typ)) === -1) return false;
    var ziel = ZIEL_BREITE[typ];
    if (!ziel) return false;
    var breite = enemy.width || ziel;
    enemy.setScale(ziel / breite);
    return true;
  };

  /** Laeuft der Testmodus? Auch von aussen gefragt (Gegner-Ordner). */
  window.testGrafikAktiv = _an;

  /** In preload: die Austausch-Kacheln unter eigenem Namen laden. */
  window.testGrafikVorladen = function (scene) {
    if (!_an() || !scene || !scene.load || !scene.textures) return;
    Object.keys(KACHELN).forEach(function (k) {
      if (scene.textures.exists(VORSATZ + k)) return;
      scene.load.image(VORSATZ + k, ORDNER + KACHELN[k]);
    });
  };

  /**
   * NACH createAllGraphics: die gezeichneten Texturen durch die geladenen
   * ersetzen. Muss nach dem Zeichnen laufen — vorher gibt es die Schluessel
   * noch nicht, und das Zeichnen wuerde den Austausch gleich wieder
   * ueberschreiben.
   */
  window.testGrafikAnwenden = function (scene) {
    if (!_an() || !scene || !scene.textures) return 0;
    var ersetzt = 0, fehlend = [];
    Object.keys(KACHELN).forEach(function (k) {
      if (!scene.textures.exists(VORSATZ + k)) { fehlend.push(k); return; }
      var bild = scene.textures.get(VORSATZ + k).getSourceImage();
      if (!bild) { fehlend.push(k); return; }
      if (scene.textures.exists(k)) scene.textures.remove(k);
      scene.textures.addImage(k, bild);
      ersetzt++;
    });
    try {
      if (typeof console !== 'undefined' && console.log) {
        console.log('[Testgrafik] ' + ersetzt + ' Kacheln ersetzt'
          + (fehlend.length ? ', nicht geladen: ' + fehlend.join(', ') : ''));
      }
    } catch (e) {}
    return ersetzt;
  };
})();
