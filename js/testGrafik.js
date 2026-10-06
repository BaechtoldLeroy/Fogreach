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
    wall_dungeon: 'wall_dungeon.png',
    // Die FUENFTE Wand, und die haeufigste: obstacleWall ist die Vorgabe
    // zweier Raumthemen (proceduralRooms 'dungeon', caveGenerator). Sie
    // fehlte, deshalb sahen viele Raeume unveraendert aus.
    obstacleWall: 'obstacleWall.png'
  };

  // Requisiten. Dieselbe Mechanik wie bei den Kacheln — auch sie werden in
  // graphics.js gezeichnet, jede mit eigenem Mass (Fass 24x32, Statue 48x64,
  // Geroell 32x24 ...). tools/requisitenBauen.js passt die Austauschbilder
  // proportionstreu in genau diese Masse ein, unten buendig: die Dinge stehen
  // auf dem Boden.
  var REQUISITEN = {
    barrel: 'barrel.png',
    crate: 'crate.png',
    pillar_small: 'pillar_small.png',
    pillar_large: 'pillar_large.png',
    statue_knight: 'statue_knight.png',
    brazier: 'brazier.png',
    rubble: 'rubble.png',
    altar: 'altar.png',
    cobweb: 'cobweb.png',
    // Die kleinen Deko-Varianten (roomTemplates ruft createPropTextures).
    prop_barrel: 'prop_barrel.png',
    prop_crate: 'prop_crate.png',
    prop_pillar: 'prop_pillar.png',
    prop_rubble: 'prop_rubble.png',
    prop_cobweb: 'prop_cobweb.png',
    // Die Treppe ist der einzige Schluessel, der im Spiel ZWEIMAL entsteht:
    // startScene laedt assets/tiles/stairDown.png, graphics.js zeichnet ihn
    // danach neu. Der Tausch laeuft nach beidem und gewinnt deshalb.
    stairDown: 'stairDown.png'
  };

  /**
   * Alles, was ersetzt wird — Kacheln UND Requisiten.
   *
   * Beide Durchlaeufe (Vorladen und Anwenden) fragen hier, damit keiner von
   * beiden eine Haelfte vergisst: geladen, aber nicht getauscht faellt nicht
   * auf, es bleibt nur still beim alten Bild.
   */
  function _alleTexturen() {
    var out = {};
    Object.keys(KACHELN).forEach(function (k) { out[k] = KACHELN[k]; });
    Object.keys(REQUISITEN).forEach(function (k) { out[k] = REQUISITEN[k]; });
    return out;
  }

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
  var NEUE_GEGNER = ['wolf', 'bat', 'rat', 'imp'];

  /** Hat dieser Gegnertyp ein Austausch-Bild? */
  window.testGrafikHatGegner = function (typ) {
    return _an() && NEUE_GEGNER.indexOf(String(typ)) !== -1;
  };

  // Anzeigebreite, die ein Tier im Spiel HATTE — die Austausch-Bilder sollen
  // genauso gross erscheinen. enemy.js skaliert sie sonst mit festen Faktoren
  // (Wolf 0.35, Fledermaus 0.22), die auf die alten gerenderten Quellen
  // geeicht sind (175x90 und 156x130). Die neuen Pixelbilder sind 51x32 und
  // 64x63 — derselbe Faktor machte daraus 18 und 14 px.
  // Der Imp fehlt hier mit Absicht: er skaliert in enemy.js hoehenbasiert
  // (48 / impH) und passt sich jeder Bildgroesse von selbst an.
  var ZIEL_BREITE = { wolf: 61, bat: 34, rat: 50 };

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
    var alle = _alleTexturen();
    Object.keys(alle).forEach(function (k) {
      if (scene.textures.exists(VORSATZ + k)) return;
      scene.load.image(VORSATZ + k, ORDNER + alle[k]);
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
    Object.keys(_alleTexturen()).forEach(function (k) {
      if (!scene.textures.exists(VORSATZ + k)) { fehlend.push(k); return; }
      var bild = scene.textures.get(VORSATZ + k).getSourceImage();
      if (!bild) { fehlend.push(k); return; }
      if (scene.textures.exists(k)) scene.textures.remove(k);
      scene.textures.addImage(k, bild);
      ersetzt++;
    });
    try {
      if (typeof console !== 'undefined' && console.log) {
        console.log('[Testgrafik] ' + ersetzt + ' Texturen ersetzt'
          + (fehlend.length ? ', nicht geladen: ' + fehlend.join(', ') : ''));
      }
    } catch (e) {}
    return ersetzt;
  };
})();
