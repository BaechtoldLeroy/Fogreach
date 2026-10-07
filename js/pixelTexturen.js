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
    //
    // 'stairDown' ist nur noch der RUECKGRIFF; im Raum wird aus TREPPEN
    // gewuerfelt (siehe treppenBild unten).
    stairDown: 'stairDown.png'
  };

  // Sechzehn Treppen, aus denen jeder Raum eine zieht.
  //
  // Die alte war ein Spiralabgang von GENAU oben — ein Rad mit schwarzer Nabe,
  // das sich nicht als Treppe lesen liess. Die Kamera schaut schraeg (low
  // top-down), also gehoert da ein Abgang hin, dessen Stufen nach hinten
  // laufen.
  //
  // Diese Schluessel zeichnet graphics.js NICHT — sie werden darum direkt
  // unter ihrem Namen geladen, nicht nachtraeglich getauscht.
  // Gegenstands-Icons (48x48) und drei Weltrequisiten. Schluessel und
  // Dateiname sind hier immer gleich, darum nur Namen statt einer Tabelle.
  //
  // Die Icons sind der groesste Posten, den graphics.js noch zeichnete: 41
  // von Hand gesetzte Umrisse. Sie tragen den Charakter der Waffenart (kurz
  // beim Dolch, ein Block beim Hammer) — die Pixelbilder muessen das
  // halten, sonst erkennt man im 48er Feld nichts mehr.
  var NAMENSGLEICH = [
    'itWeapon', 'itSword', 'itDagger', 'itFlail',
    'itAxe', 'itGreatsword', 'itHammer', 'itBow',
    'itBowEsche', 'itBowHorn', 'itBowGlut', 'itBowNebel',
    'itHead', 'itHeadBronze', 'itHeadKettenhaube', 'itHeadSchlangenmaske',
    'itBody', 'itBodyLeder', 'itBodyPlatte', 'itBodySchattenkutte',
    'itBoots', 'itBootsLeder', 'itBootsStahl', 'itBootsWindlaeufer',
    'itOffBuchbinder', 'itOffPavese', 'itOffWandschirm', 'itOffTalglicht',
    'itOffBannlaterne', 'itOffGlutschale', 'itOffFangdolch', 'itOffKettenhaken',
    'itPotionMinor', 'itPotionNormal', 'itPotionMajor', 'itPotionSuper',
    'itPortalScroll', 'itStairScroll', 'itAmulet', 'itConsumable',
    'itMat'
  ].concat([
    'obstacleTree', 'obstacleRock', 'prop_puddle', 'healthDrop',
    'xpDrop', 'projectileTexture'
  ]);

  // Die Feuerschale flackert: neun Bilder, in denen nur die Flamme lebt.
  var FEUERSCHALE_BILDER = 9;
  // Und das Feuer, das aus einer zerschlagenen Schale auf den Boden laeuft.
  var BODENFEUER_BILDER = 9;
  var BODENFEUER_ANIM = 'bodenfeuer_brennen';
  // Und das Feuer, das aus einer zerschlagenen Schale auf den Boden laeuft.
  var BODENFEUER_BILDER = 9;
  var BODENFEUER_ANIM = 'bodenfeuer_brennen';
  var FEUERSCHALE_ANIM = 'feuerschale_flackern';

  function _feuerschaleSchluessel() {
    var out = [];
    for (var i = 0; i < FEUERSCHALE_BILDER; i++) out.push('brazier' + i);
    return out;
  }

  function _bodenfeuerSchluessel() {
    var out = [];
    for (var i = 0; i < BODENFEUER_BILDER; i++) out.push('floorFire' + i);
    return out;
  }

  function _bodenfeuerSchluessel() {
    var out = [];
    for (var i = 0; i < BODENFEUER_BILDER; i++) out.push('floorFire' + i);
    return out;
  }

  var TREPPEN_ANZAHL = 16;

  // Beute mit Varianten: Schluessel -> wie viele es gibt. Anders als die
  // Treppen brauchen diese keine Masse — tools/requisitenBauen.js hat jede
  // Variante bereits in genau das Mass eingepasst, das graphics.js fuer
  // ihren Schluessel zeichnet. Der Tausch ist damit reine Namenssache.
  var BEUTE_VARIANTEN = {
    chest_small: 8, chest_medium: 8, chest_large: 8,
    goldPile: 8, goldHoard: 8
  };

  /** Alle Variantenschluessel eines Grundnamens, z. B. chest_small0..7. */
  function _variantenVon(basis) {
    var n = BEUTE_VARIANTEN[basis] || 0;
    var out = [];
    for (var i = 0; i < n; i++) out.push(basis + i);
    return out;
  }

  function _treppenSchluessel() {
    var out = [];
    for (var i = 0; i < TREPPEN_ANZAHL; i++) out.push('stairDown' + i);
    return out;
  }

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
    NAMENSGLEICH.forEach(function (k) { out[k] = k + '.png'; });
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
    // Die Flammenbilder des Bodenfeuers.
    _bodenfeuerSchluessel().forEach(function (k) {
      if (scene.textures.exists(k)) return;
      scene.load.image(k, ORDNER + k + '.png');
    });
    // Die Flammenbilder des Bodenfeuers.
    _bodenfeuerSchluessel().forEach(function (k) {
      if (scene.textures.exists(k)) return;
      scene.load.image(k, ORDNER + k + '.png');
    });
    // Die Flammenbilder der Feuerschale, ebenfalls unter eigenem Namen.
    _feuerschaleSchluessel().forEach(function (k) {
      if (scene.textures.exists(k)) return;
      scene.load.image(k, ORDNER + k + '.png');
    });
    // Die Treppen direkt unter ihrem Endnamen: diese Schluessel sind frei.
    _treppenSchluessel().forEach(function (k) {
      if (scene.textures.exists(k)) return;
      scene.load.image(k, ORDNER + k + '.png');
    });
    // Ebenso die Beute-Varianten (chest_small0..7, goldPile0..7, ...).
    Object.keys(BEUTE_VARIANTEN).forEach(function (basis) {
      _variantenVon(basis).forEach(function (k) {
        if (scene.textures.exists(k)) return;
        scene.load.image(k, ORDNER + k + '.png');
      });
    });
  };

  /**
   * Eine Treppe auswuerfeln — Bild und Anzeigemasse.
   *
   * Die Masse gehoeren dazu, weil sie am BILD haengen muessen und nicht an
   * einer festen Zahl: die Aufrufstelle setzte 80x80 quadratisch, geeicht auf
   * die alte quadratische Zeichnung. Die neuen Treppen sind hochkant (etwa
   * 48x61), ein Quadrat haette sie in die Breite gequetscht — dieselbe Falle
   * wie bei Spieler und Tieren in b313.
   *
   * @param {Phaser.Scene} scene
   * @param {number} [zielHoehe] gewuenschte Anzeigehoehe, Vorgabe 80
   * @returns {{bild: string, breite: number, hoehe: number}}
   */
  /**
   * Eine Variante eines Beute-Schluessels auswuerfeln.
   *
   * Gibt den UNVERAENDERTEN Schluessel zurueck, wenn es keine Varianten
   * gibt oder keine geladen ist — eine Truhe darf nie unsichtbar werden,
   * in ihr liegt die Beute.
   *
   * @param {Phaser.Scene} scene
   * @param {string} basis z. B. "chest_small" oder "goldHoard"
   * @returns {string} der zu verwendende Texturschluessel
   */
  window.beuteBild = function (scene, basis) {
    if (!basis || !scene || !scene.textures) return basis;
    var da = _variantenVon(basis).filter(function (k) { return scene.textures.exists(k); });
    if (!da.length) return basis;
    return da[Math.floor(Math.random() * da.length)];
  };

  /**
   * Laesst eine Feuerschale flackern.
   *
   * Die Animation wird beim ersten Aufruf angelegt und danach nur noch
   * gespielt. Fehlt ein Bild, passiert nichts und die Schale bleibt das
   * stehende Bild — besser eine stille Flamme als gar keine.
   *
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.Sprite} sprite
   * @returns {boolean} ob gespielt wird
   */
  window.feuerschaleFlackern = function (scene, sprite) {
    if (!scene || !scene.anims || !sprite || typeof sprite.play !== 'function') return false;
    var keys = _feuerschaleSchluessel();
    for (var i = 0; i < keys.length; i++) {
      if (!scene.textures.exists(keys[i])) return false;
    }
    if (!scene.anims.exists(FEUERSCHALE_ANIM)) {
      scene.anims.create({
        key: FEUERSCHALE_ANIM,
        frames: keys.map(function (k) { return { key: k }; }),
        frameRate: 10,
        repeat: -1,
        yoyo: true          // sonst faellt die Flamme in sich zusammen und springt hoch
      });
    }
    try { sprite.play(FEUERSCHALE_ANIM); } catch (e) { return false; }
    return true;
  };

  /**
   * Setzt ein brennendes Bodenfeuer an eine Stelle.
   *
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {number} breite gewuenschte Anzeigebreite
   * @param {number} tiefe Zeichenebene
   * @returns {Phaser.GameObjects.Sprite|null} null, wenn Bilder fehlen —
   *          dann bleibt es beim gezeichneten Feuer des Aufrufers.
   */
  window.bodenfeuerSetzen = function (scene, x, y, breite, tiefe) {
    if (!scene || !scene.add || !scene.anims || typeof scene.add.sprite !== 'function') return null;
    var keys = _bodenfeuerSchluessel();
    for (var i = 0; i < keys.length; i++) {
      if (!scene.textures.exists(keys[i])) return null;
    }
    if (!scene.anims.exists(BODENFEUER_ANIM)) {
      scene.anims.create({
        key: BODENFEUER_ANIM,
        frames: keys.map(function (k) { return { key: k }; }),
        frameRate: 12,
        repeat: -1,
        yoyo: true
      });
    }
    var s = scene.add.sprite(x, y, keys[0]);
    // Das Bild ist quadratisch, das Feuer darin breiter als hoch. Auf die
    // Breite rechnen und die Hoehe mitziehen — nicht quadratisch strecken.
    var q = scene.textures.get(keys[0]).getSourceImage();
    var f = (q && q.width) ? (breite / q.width) : 1;
    s.setScale(f);
    if (typeof tiefe === 'number') s.setDepth(tiefe);
    try { s.play(BODENFEUER_ANIM); } catch (e) {}
    return s;
  };

  /**
   * Setzt ein brennendes Bodenfeuer an eine Stelle.
   *
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {number} breite gewuenschte Anzeigebreite
   * @param {number} tiefe Zeichenebene
   * @returns {Phaser.GameObjects.Sprite|null} null, wenn Bilder fehlen —
   *          dann bleibt es beim gezeichneten Feuer des Aufrufers.
   */
  window.bodenfeuerSetzen = function (scene, x, y, breite, tiefe) {
    if (!scene || !scene.add || !scene.anims || typeof scene.add.sprite !== 'function') return null;
    var keys = _bodenfeuerSchluessel();
    for (var i = 0; i < keys.length; i++) {
      if (!scene.textures.exists(keys[i])) return null;
    }
    if (!scene.anims.exists(BODENFEUER_ANIM)) {
      scene.anims.create({
        key: BODENFEUER_ANIM,
        frames: keys.map(function (k) { return { key: k }; }),
        frameRate: 12,
        repeat: -1,
        yoyo: true
      });
    }
    var s = scene.add.sprite(x, y, keys[0]);
    // Das Bild ist quadratisch, das Feuer darin breiter als hoch. Auf die
    // Breite rechnen und die Hoehe mitziehen — nicht quadratisch strecken.
    var q = scene.textures.get(keys[0]).getSourceImage();
    var f = (q && q.width) ? (breite / q.width) : 1;
    s.setScale(f);
    if (typeof tiefe === 'number') s.setDepth(tiefe);
    try { s.play(BODENFEUER_ANIM); } catch (e) {}
    return s;
  };

  window.treppenBild = function (scene, zielHoehe) {
    var h = (typeof zielHoehe === 'number' && zielHoehe > 0) ? zielHoehe : 80;
    var da = [];
    if (scene && scene.textures) {
      da = _treppenSchluessel().filter(function (k) { return scene.textures.exists(k); });
    }
    // Keine geladen (Test ohne Dateien, abgebrochener Ladevorgang): der alte
    // Schluessel bleibt der Rueckgriff, damit nie eine Treppe FEHLT — sie ist
    // der einzige Weg aus dem Raum.
    var bild = da.length ? da[Math.floor(Math.random() * da.length)] : 'stairDown';
    var b = h;
    try {
      var q = scene.textures.get(bild).getSourceImage();
      if (q && q.width > 0 && q.height > 0) b = Math.round(h * (q.width / q.height));
    } catch (e) {}
    return { bild: bild, breite: b, hoehe: h };
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
