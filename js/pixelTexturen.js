/**
 * js/pixelTexturen.js — Boden, Waende, Requisiten und Treppe aus Dateien.
 *
 * Diese Texturen liegen NICHT als Dateien im Ladeweg, sondern werden in
 * graphics.js gezeichnet (generateTexture). Die Pixelbilder muessen die
 * fertigen Texturen deshalb NACHTRAEGLICH ersetzen:
 *
 *   preload            -> unter eigenem Namen laden (pixelTexturenVorladen)
 *   nach createAllGraphics -> tauschen (pixelTexturenAnwenden)
 *
 * Frueher hing das an einer Debug-Flagge (?grafik=neu). Seit die
 * Pixelgrafik die Vorgabe ist, laeuft es immer.
 */
(function () {
  var FLAGGEN = ['grafik', 'spieler'];
  var ORDNER = 'assets/tiles/';
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

  // Frueher die Abfrage der Debug-Flagge. Die Pixelgrafik ist jetzt die
  // Vorgabe, also immer an. Die Funktion bleibt, weil mehrere Stellen sie
  // fragen — eine Konstante haette dieselben Stellen anfassen muessen.
  function _an() { return true; }

  /** In preload: die Austausch-Kacheln unter eigenem Namen laden. */
  window.pixelTexturenVorladen = function (scene) {
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
  window.pixelTexturenAnwenden = function (scene) {
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
        console.log('[Pixeltexturen] ' + ersetzt + ' Texturen ersetzt'
          + (fehlend.length ? ', nicht geladen: ' + fehlend.join(', ') : ''));
      }
    } catch (e) {}
    return ersetzt;
  };
})();
