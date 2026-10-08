/* =====================================================================
 * hubNeuWelt.js — der neue, gekachelte Hub (#181), vorerst als Probe
 * ---------------------------------------------------------------------
 * Der bisherige Hub ist EIN gemaltes Bild (assets/hubscene.png, 194'943
 * Farben). Neben den Pixelgrafiken, die seit b313 ueberall sonst stehen,
 * faellt der Stilbruch auf. Dieser Bau ersetzt das Bild durch einen
 * Boden aus Kacheln und Haeuser als Requisiten.
 *
 * ERREICHBAR NUR UEBER DIE ADRESSE: ?debug=1&hubneu=1. Ohne die Flagge
 * aendert sich nichts — der gemalte Hub bleibt der ausgelieferte. Das
 * ist Absicht: der Platz ist das Erste, was ein Spieler sieht, und der
 * Umbau soll erst dann der Normalfall werden, wenn er das Bild schlaegt.
 *
 * Der Boden wird EINMAL in eine RenderTexture gezeichnet und liegt
 * danach als ein einziges Objekt in der Szene. 1536 einzelne Bilder
 * waeren jedes Bild neu zu sortieren; so kostet der Platz einen Zug.
 *
 * Masse: alle Tabellen stehen in Entwurfseinheiten des 960x640-Rasters,
 * genau wie HUB_HITBOXES. Umgerechnet wird erst beim Bauen (x1.6).
 * ===================================================================== */
(function () {
  'use strict';

  var MASSSTAB = 1536 / 960;     // SCALE_FACTOR aus HubSceneV2
  var BODEN_BILDER = 16;
  var TIEFE_BODEN = -20;

  // Haeuser: Fusspunkt (x = Mitte, y = Standlinie) und Breite, alles in
  // Entwurfseinheiten. Die Standlinie ist die UNTERKANTE des zugehoerigen
  // Colliders — damit steht das Haus auf dem, was es blockiert.
  var HAEUSER = [
    // Das Rathaus ist der Sitz des Kettenrats und soll den Platz beherrschen.
    // Es kam ausserdem deutlich heller heraus als alles andere — der Farbstich
    // holt es zurueck in den Nebel, statt es als Kapelle dastehen zu lassen.
    { key: 'hub_rathaus',    datei: 'rathaus.png',    x: 480, y: 292, breite: 310, farbe: 0x8d97a6 },
    { key: 'hub_werkstatt',  datei: 'werkstatt.png',  x: 234, y: 312, breite: 170 },
    { key: 'hub_druckerei',  datei: 'druckerei.png',  x: 726, y: 312, breite: 170 },
    { key: 'hub_kate_a',     datei: 'kate_a.png',     x: 190, y: 548, breite: 175 },
    { key: 'hub_kate_b',     datei: 'kate_b.png',     x: 770, y: 548, breite: 175 }
  ];

  // Die Stadtmauer wird aus EINEM Segment ueber die ganze Breite gekachelt.
  var MAUER = { key: 'hub_mauer', datei: 'mauer.png', y: 296, breite: 160 };

  // Requisiten auf dem Platz. Dieselben Fusspunkte wie die Collider, damit
  // der Spieler an dem stehenbleibt, was er sieht.
  var REQUISITEN = [
    { key: 'hub_brunnen',  x: 470, y: 404, breite: 120 },
    { key: 'hub_bank',     x: 414, y: 500, breite: 62 },
    { key: 'hub_bank',     x: 546, y: 500, breite: 62, spiegeln: true },
    { key: 'hub_laterne',  x: 348, y: 450, breite: 34 },
    { key: 'hub_laterne',  x: 610, y: 450, breite: 34, spiegeln: true },
    { key: 'hub_kuebel',   x: 407, y: 316, breite: 42 },
    { key: 'hub_kuebel',   x: 553, y: 316, breite: 42, spiegeln: true },
    { key: 'hub_tafel',    x: 412, y: 300, breite: 40 },
    { key: 'hub_tafel',    x: 548, y: 300, breite: 40, spiegeln: true },
    { key: 'hub_fass',     x: 318, y: 360, breite: 30 },
    { key: 'hub_kisten',   x: 640, y: 362, breite: 38 },
    { key: 'hub_karren',   x: 268, y: 470, breite: 70 },
    { key: 'hub_stand',    x: 660, y: 470, breite: 80 },
    { key: 'hub_trog',     x: 300, y: 560, breite: 60 },
    { key: 'hub_holz',     x: 668, y: 556, breite: 46 },
    { key: 'hub_schutt',   x: 530, y: 596, breite: 44 },
    { key: 'hub_statue',   x: 480, y: 468, breite: 54 },
    { key: 'hub_schild',   x: 350, y: 596, breite: 38 }
  ];

  // Die Waldraender: in diesen Rechtecken (Entwurfseinheiten, aus den
  // forest_*-Collidern) werden Baeume gestreut, bis der Rand dicht ist.
  var WALD = [
    [0, 292, 133, 68], [0, 360, 187, 130], [0, 490, 133, 150],
    [827, 292, 133, 68], [773, 360, 187, 130], [827, 490, 133, 150]
  ];
  var BAUM_BILDER = ['hub_kiefer', 'hub_baum'];

  /** Ist der neue Hub eingeschaltet? Nur ueber die Adresse, nie im Spielstand. */
  function aktiv() {
    try { return !!(window.DebugGate && window.DebugGate.an('hubneu')); }
    catch (e) { return false; }
  }

  /**
   * Ein fester Wuerfel: dieselbe Stelle gibt immer dieselbe Zahl.
   *
   * Math.random waere hier falsch. Der Platz wird bei jeder Rueckkehr aus
   * dem Dungeon neu gebaut — mit echtem Zufall laege nach jedem Besuch ein
   * anderes Pflaster da, und das sieht man sofort.
   */
  function streu(x, y, salz) {
    var h = (x * 73856093) ^ (y * 19349663) ^ ((salz || 0) * 83492791);
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /** Alle Bilder des neuen Hubs anmelden. Ohne Flagge: nichts. */
  function vorladen(scene) {
    if (!aktiv() || !scene || !scene.load || !scene.textures) return 0;
    var n = 0;
    var nimm = function (key, pfad) {
      if (scene.textures.exists(key)) return;
      scene.load.image(key, pfad); n++;
    };
    for (var i = 0; i < BODEN_BILDER; i++) nimm('hub_boden' + i, 'assets/hub/boden' + i + '.png');
    HAEUSER.forEach(function (h) { nimm(h.key, 'assets/hub/' + h.datei); });
    nimm(MAUER.key, 'assets/hub/' + MAUER.datei);
    ['brunnen', 'bank', 'laterne', 'kuebel', 'fass', 'kisten', 'schild', 'karren',
      'stand', 'tafel', 'statue', 'trog', 'holz', 'kiefer', 'baum', 'schutt'
    ].forEach(function (r) { nimm('hub_' + r, 'assets/hub/' + r + '.png'); });
    return n;
  }

  /** Den Boden in EINE RenderTexture zeichnen. */
  function _bodenZeichnen(scene) {
    var K = window.HUB_NEU_KARTE;
    if (!K || !K.zeilen || !K.zeilen.length) return null;
    var z = K.kachel;
    var rt = scene.add.renderTexture(0, 0, K.breite * z, K.hoehe * z).setOrigin(0, 0);
    rt.setDepth(TIEFE_BODEN);
    var stapel = (typeof rt.beginDraw === 'function');
    if (stapel) rt.beginDraw();
    for (var ty = 0; ty < K.hoehe; ty++) {
      var zeile = K.zeilen[ty] || '';
      for (var tx = 0; tx < K.breite; tx++) {
        var auswahl = K.legende[zeile.charAt(tx)];
        if (!auswahl || !auswahl.length) continue;
        var nr = auswahl[Math.floor(streu(tx, ty, 1) * auswahl.length) % auswahl.length];
        var key = 'hub_boden' + nr;
        if (!scene.textures.exists(key)) continue;
        if (stapel) rt.batchDraw(key, tx * z, ty * z);
        else rt.draw(key, tx * z, ty * z);
      }
    }
    if (stapel) rt.endDraw();
    return rt;
  }

  /**
   * Ein Bild auf seinen Fusspunkt setzen.
   *
   * Breite statt Massstab: die Vorlagen kommen in verschiedenen Groessen,
   * und was zaehlt, ist wie breit das Haus auf dem Platz steht.
   */
  function _stellen(scene, key, xE, yE, breiteE, spiegeln, farbe) {
    if (!scene.textures.exists(key)) return null;
    var bild = scene.add.image(xE * MASSSTAB, yE * MASSSTAB, key).setOrigin(0.5, 1);
    if (farbe) bild.setTint(farbe);
    if (bild.width > 0) {
      var s = (breiteE * MASSSTAB) / bild.width;
      bild.setScale(spiegeln ? -s : s, s);
    }
    bild.setDepth(yE * MASSSTAB);
    return bild;
  }

  /** Den ganzen Platz bauen. Gibt zurueck, was entstanden ist. */
  function bauen(scene) {
    if (!aktiv() || !scene || !scene.add) return null;
    var ergebnis = { boden: null, haeuser: [], requisiten: [], baeume: [] };

    ergebnis.boden = _bodenZeichnen(scene);

    // Stadtmauer: ueber die ganze Breite gekachelt, mit halbem Segment
    // Ueberlappung an den Enden, damit kein Spalt entsteht.
    if (scene.textures.exists(MAUER.key)) {
      for (var mx = 0; mx < 960; mx += MAUER.breite) {
        var m = _stellen(scene, MAUER.key, mx + MAUER.breite / 2, MAUER.y, MAUER.breite);
        if (m) { m.setDepth(MAUER.y * MASSSTAB - 2); ergebnis.haeuser.push(m); }
      }
    }

    HAEUSER.forEach(function (h) {
      var b = _stellen(scene, h.key, h.x, h.y, h.breite, false, h.farbe);
      if (b) ergebnis.haeuser.push(b);
    });

    REQUISITEN.forEach(function (r) {
      var b = _stellen(scene, r.key, r.x, r.y, r.breite, r.spiegeln);
      if (b) ergebnis.requisiten.push(b);
    });

    // Waldrand: Baeume streuen, bis die Rechtecke dicht sind.
    var vorhanden = BAUM_BILDER.filter(function (k) { return scene.textures.exists(k); });
    if (vorhanden.length) {
      WALD.forEach(function (r, ri) {
        var schritt = 30;   // Entwurfseinheiten zwischen zwei Staemmen
        for (var y = r[1]; y < r[1] + r[3]; y += schritt) {
          for (var x = r[0]; x < r[0] + r[2]; x += schritt) {
            var w = streu(x, y, 7 + ri);
            var bx = x + (w - 0.5) * schritt * 0.8;
            var by = y + (streu(x, y, 13 + ri) - 0.5) * schritt * 0.8 + schritt;
            var key = vorhanden[Math.floor(w * vorhanden.length) % vorhanden.length];
            var b = _stellen(scene, key, bx, by, 44 + w * 22, w > 0.5);
            if (b) ergebnis.baeume.push(b);
          }
        }
      });
    }

    return ergebnis;
  }

  var HubNeuWelt = {
    aktiv: aktiv, vorladen: vorladen, bauen: bauen,
    _streu: streu, _HAEUSER: HAEUSER, _REQUISITEN: REQUISITEN, _WALD: WALD
  };
  if (typeof window !== 'undefined') window.HubNeuWelt = HubNeuWelt;
  if (typeof module !== 'undefined' && module.exports) module.exports = HubNeuWelt;
})();
