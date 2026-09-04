/**
 * js/hubTruheUI.js — die Oberfläche der Hub-Truhe (#127).
 *
 * Zwei Raster übereinander: oben die Truhe, unten das Laufinventar. Ziehen
 * geht in beide Richtungen und innerhalb jedes Rasters.
 *
 * WARUM EIN EIGENES PANEL statt einer Erweiterung des Inventars: die
 * Zieh-Mechanik in inventory.js (zugVormerken/zugBewegen/zugBeenden) ist auf
 * GENAU EIN Raster plus die Ausrüstungsplätze gebaut — `inventory` steht dort
 * überall fest verdrahtet, in einer Datei mit 1962 Zeilen. Ein zweites Raster
 * hindurchzufädeln hätte jede dieser Stellen angefasst und das funktionierende
 * Inventar aufs Spiel gesetzt. Hier ist die Zieh-Logik neu, aber klein: die
 * Packrechnung kommt aus InventoryGrid, die Übertragung aus HubTruhe. Beide
 * sind getestet.
 *
 * Die Truhe ist der sichere Hafen: nichts hier drin geht bei einem Tod im
 * Dungeon verloren. Deshalb wird beim Schliessen gespeichert.
 */
(function () {
  'use strict';

  var TIEFE = 5000;
  var ZELLE = 34;                 // Kantenlänge einer Rasterzelle
  var LUFT = 10;                  // Abstand zwischen den Rastern und zum Rand

  var offen = false;
  var elemente = [];
  var scene = null;
  var gfx = null;
  var schemen = null;
  var vorschau = null;
  var hinweis = null;
  var zug = null;
  var geometrie = null;

  function _t(key, fallback) {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var v = window.i18n.t(key);
        if (v && String(v).indexOf('[MISSING:') !== 0 && v !== key) return v;
      }
    } catch (e) {}
    return fallback;
  }

  function _symbol(item) {
    try {
      if (typeof resolveItemIconKey === 'function') {
        var k = resolveItemIconKey(item);
        if (k) return k;
      }
    } catch (e) {}
    return (item && item.iconKey) || 'itMat';
  }

  function _inventar() {
    return Array.isArray(window.inventory) ? window.inventory : [];
  }

  /** Rastermass des jeweiligen Behälters — die Truhe ist niedriger. */
  function _mass(welches) {
    return (welches === 'truhe') ? window.HubTruhe.mass() : undefined;
  }

  function _behaelter(welches) {
    return (welches === 'truhe') ? window.HubTruhe.faecher() : _inventar();
  }

  // -------------------------------------------------------------------------
  // Aufbau
  // -------------------------------------------------------------------------

  function _rechneGeometrie() {
    var cam = scene.cameras.main;
    var G = window.InventoryGrid;
    var truheZ = window.HubTruhe.zeilen();
    var breite = G.COLS * ZELLE;
    var hoeheT = truheZ * ZELLE;
    var hoeheI = G.ROWS * ZELLE;
    var panelB = breite + LUFT * 4;
    var panelH = hoeheT + hoeheI + 118;
    var px = Math.round((cam.width - panelB) / 2);
    var py = Math.round((cam.height - panelH) / 2);
    return {
      panel: { x: px, y: py, b: panelB, h: panelH },
      truhe: { x: px + LUFT * 2, y: py + 52, b: breite, h: hoeheT, spalten: G.COLS, zeilen: truheZ },
      inv: { x: px + LUFT * 2, y: py + 52 + hoeheT + 34, b: breite, h: hoeheI, spalten: G.COLS, zeilen: G.ROWS }
    };
  }

  /** Welches Raster und welche Zelle liegt unter (x, y)? */
  function _zelleAus(x, y) {
    for (var i = 0; i < 2; i++) {
      var welches = i === 0 ? 'truhe' : 'inv';
      var r = geometrie[welches];
      if (x < r.x || y < r.y || x >= r.x + r.b || y >= r.y + r.h) continue;
      return {
        welches: welches,
        c: Math.floor((x - r.x) / ZELLE),
        r: Math.floor((y - r.y) / ZELLE)
      };
    }
    return null;
  }

  function _halten(o) {
    if (o) { o.setScrollFactor(0); o.setDepth(TIEFE); elemente.push(o); }
    return o;
  }

  function _zeichne() {
    var G = window.InventoryGrid;
    gfx.clear();
    var p = geometrie.panel;
    // Panel
    gfx.fillStyle(0x0d0b12, 0.97);
    gfx.fillRoundedRect(p.x, p.y, p.b, p.h, 10);
    gfx.lineStyle(2, 0x6b5426, 1);
    gfx.strokeRoundedRect(p.x, p.y, p.b, p.h, 10);

    ['truhe', 'inv'].forEach(function (welches) {
      var r = geometrie[welches];
      // Rasterfläche
      gfx.fillStyle(0x16131e, 1);
      gfx.fillRect(r.x - 3, r.y - 3, r.b + 6, r.h + 6);
      for (var y = 0; y < r.zeilen; y++) {
        for (var x = 0; x < r.spalten; x++) {
          gfx.fillStyle(0x221d2c, 1);
          gfx.fillRect(r.x + x * ZELLE + 1, r.y + y * ZELLE + 1, ZELLE - 2, ZELLE - 2);
        }
      }
      gfx.lineStyle(1, 0x3a3446, 1);
      gfx.strokeRect(r.x - 3, r.y - 3, r.b + 6, r.h + 6);
    });
  }

  /** Die Gegenstände beider Raster neu setzen. */
  function _zeichneStuecke() {
    // Alte Bilder weg
    for (var i = elemente.length - 1; i >= 0; i--) {
      if (elemente[i] && elemente[i].__stueck) {
        try { elemente[i].destroy(); } catch (e) {}
        elemente.splice(i, 1);
      }
    }
    var G = window.InventoryGrid;
    ['truhe', 'inv'].forEach(function (welches) {
      var r = geometrie[welches];
      var liste = _behaelter(welches);
      var m = _mass(welches);
      for (var k = 0; k < liste.length; k++) {
        var it = liste[k];
        if (!it || typeof it.gridX !== 'number') continue;
        if (zug && zug.welches === welches && zug.index === k) continue;   // in der Hand
        var g = G.groesse(it, m);
        var bild = scene.add.image(
          r.x + (it.gridX + g.b / 2) * ZELLE,
          r.y + (it.gridY + g.h / 2) * ZELLE,
          _symbol(it));
        bild.setDisplaySize(g.b * ZELLE * 0.86, g.h * ZELLE * 0.86);
        bild.__stueck = true;
        _halten(bild);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Ziehen
  // -------------------------------------------------------------------------

  function _griff(zeiger) {
    if (!offen || zug) return;
    var z = _zelleAus(zeiger.x, zeiger.y);
    if (!z) return;
    var idx = window.InventoryGrid.indexAn(_behaelter(z.welches), z.c, z.r, _mass(z.welches));
    if (idx < 0) return;
    var it = _behaelter(z.welches)[idx];
    if (!it) return;
    zug = {
      welches: z.welches, index: idx,
      griffC: z.c - it.gridX, griffR: z.r - it.gridY
    };
    var g = window.InventoryGrid.groesse(it, _mass(z.welches));
    schemen.setTexture(_symbol(it));
    schemen.setDisplaySize(g.b * ZELLE * 0.8, g.h * ZELLE * 0.8);
    schemen.setPosition(zeiger.x, zeiger.y).setVisible(true);
    _zeichneStuecke();
  }

  function _bewege(zeiger) {
    if (!zug) return;
    schemen.setPosition(zeiger.x, zeiger.y);
    var it = _behaelter(zug.welches)[zug.index];
    if (!it) return;
    var z = _zelleAus(zeiger.x, zeiger.y);
    if (!z) { vorschau.setVisible(false); return; }
    var m = _mass(z.welches);
    var g = window.InventoryGrid.groesse(it, m);
    var zx = z.c - zug.griffC, zy = z.r - zug.griffR;
    var eigen = (z.welches === zug.welches) ? zug.index : -2;
    var geht = window.InventoryGrid.passt(
      window.InventoryGrid.belegung(_behaelter(z.welches), m), zx, zy, g.b, g.h, eigen, m);
    if (z.welches === 'truhe' && !window.HubTruhe.darfHinein(it)) geht = false;
    var r = geometrie[z.welches];
    vorschau.setPosition(r.x + (Math.max(0, zx) + g.b / 2) * ZELLE,
                         r.y + (Math.max(0, zy) + g.h / 2) * ZELLE);
    vorschau.setSize(g.b * ZELLE - 3, g.h * ZELLE - 3);
    vorschau.setFillStyle(geht ? 0x66ff88 : 0xff6666, 0.22);
    vorschau.setVisible(true);
  }

  function _lass(zeiger) {
    if (!zug) return;
    var q = zug; zug = null;
    schemen.setVisible(false);
    vorschau.setVisible(false);

    var it = _behaelter(q.welches)[q.index];
    var z = _zelleAus(zeiger.x, zeiger.y);
    if (it && z) {
      var zx = z.c - q.griffC, zy = z.r - q.griffR;
      if (z.welches === q.welches) {
        if (q.welches === 'truhe') window.HubTruhe.verschiebe(q.index, zx, zy);
        else window.InventoryGrid.verschiebe(_inventar(), q.index, zx, zy);
      } else if (z.welches === 'truhe') {
        // Zwei verschiedene Absagen — und sie muessen sich unterscheiden.
        // Vorher hiess jede Absage "Die Truhe ist voll", auch die bei einem
        // Stueck, das gar nicht hineindarf. Wer dann in eine leere Truhe sah,
        // hielt die Truhe fuer kaputt.
        if (!window.HubTruhe.darfHinein(it)) _meldung('nicht.erlaubt');
        else if (!window.HubTruhe.hineinlegen(_inventar(), q.index, zx, zy)) _meldung('truhe.voll');
      } else {
        if (!window.HubTruhe.herausnehmen(_inventar(), q.index, zx, zy)) _meldung('inv.voll');
      }
    }
    _zeichneStuecke();
  }

  function _meldung(art) {
    if (!hinweis) return;
    hinweis.setColor('#ff9d6b');
    var text;
    if (art === 'truhe.voll') text = _t('stash.full', 'Die Truhe ist voll.');
    else if (art === 'nicht.erlaubt') {
      text = _t('stash.rejected', 'Das gehört nicht in die Truhe — Material hat seinen eigenen Vorrat.');
    } else text = _t('stash.inv_full', 'Kein Platz im Inventar.');
    hinweis.setText(text);
    if (scene.time && scene.time.delayedCall) {
      scene.time.delayedCall(1600, function () {
        if (hinweis && hinweis.active) { hinweis.setColor('#8d8798'); hinweis.setText(_hinweisText()); }
      });
    }
  }

  function _hinweisText() {
    return _t('stash.hint', 'Ziehen zum Umlegen  ·  E oder Esc schliesst');
  }

  // -------------------------------------------------------------------------
  // Öffnen und Schliessen
  // -------------------------------------------------------------------------

  function oeffne(sc) {
    if (offen || !sc || !sc.add) return false;
    if (!window.HubTruhe || !window.InventoryGrid) return false;
    scene = sc;
    offen = true;
    geometrie = _rechneGeometrie();

    var cam = scene.cameras.main;
    _halten(scene.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, 0x000000, 0.72));
    gfx = _halten(scene.add.graphics());

    _halten(scene.add.text(geometrie.panel.x + geometrie.panel.b / 2, geometrie.panel.y + 24,
      _t('stash.title', 'Truhe'), {
        fontFamily: 'serif', fontSize: '22px', color: '#ffd166', fontStyle: 'bold',
        stroke: '#2a1c00', strokeThickness: 4
      }).setOrigin(0.5));
    _halten(scene.add.text(geometrie.truhe.x, geometrie.truhe.y - 18,
      _t('stash.label.stash', 'In der Truhe — bleibt über Läufe hinweg liegen'), {
        fontFamily: 'monospace', fontSize: '11px', color: '#9a94a8'
      }));
    _halten(scene.add.text(geometrie.inv.x, geometrie.inv.y - 18,
      _t('stash.label.bag', 'Dein Gepäck — kommt mit in den Dungeon'), {
        fontFamily: 'monospace', fontSize: '11px', color: '#9a94a8'
      }));
    hinweis = _halten(scene.add.text(geometrie.panel.x + geometrie.panel.b / 2,
      geometrie.panel.y + geometrie.panel.h - 20, _hinweisText(), {
        fontFamily: 'monospace', fontSize: '12px', color: '#8d8798'
      }).setOrigin(0.5));

    vorschau = _halten(scene.add.rectangle(0, 0, ZELLE, ZELLE, 0x66ff88, 0.22).setVisible(false));
    schemen = _halten(scene.add.image(0, 0, 'itMat').setVisible(false));
    schemen.setDepth(TIEFE + 2);
    vorschau.setDepth(TIEFE + 1);

    _zeichne();
    _zeichneStuecke();

    // Spiel anhalten und die Kampf-/Bewegungseingabe stilllegen — dasselbe
    // Muster wie beim Ereignis-Dialog.
    window.eventChoiceOpen = true;
    try {
      if (typeof window.pauseGameClock === 'function') window.pauseGameClock(scene);
    } catch (e) {}
    try { window.__eventConsumedEAt = Date.now(); } catch (e) {}

    scene.input.on('pointerdown', _griff);
    scene.input.on('pointermove', _bewege);
    scene.input.on('pointerup', _lass);
    if (scene.input.keyboard) {
      scene.input.keyboard.on('keydown-E', schliesse);
      scene.input.keyboard.on('keydown-ESC', schliesse);
    }
    return true;
  }

  function schliesse() {
    if (!offen) return;
    offen = false;
    zug = null;
    try {
      scene.input.off('pointerdown', _griff);
      scene.input.off('pointermove', _bewege);
      scene.input.off('pointerup', _lass);
      if (scene.input.keyboard) {
        // NUR die eigenen Horcher abmelden. Kein removeKey: das nähme dem
        // Plugin die Taste weg, die createCursorKeys für die Laufsteuerung
        // angelegt hat — genau der Fehler aus b158 beim Kettenschloss.
        scene.input.keyboard.off('keydown-E', schliesse);
        scene.input.keyboard.off('keydown-ESC', schliesse);
      }
    } catch (e) {}
    for (var i = 0; i < elemente.length; i++) {
      try { if (elemente[i] && elemente[i].destroy) elemente[i].destroy(); } catch (e) {}
    }
    elemente.length = 0;
    gfx = schemen = vorschau = hinweis = null;
    window.eventChoiceOpen = false;
    try {
      if (typeof window.resumeGameClock === 'function') window.resumeGameClock(scene);
    } catch (e) {}
    // Speichern: die Truhe ist der sichere Hafen, ihr Inhalt darf nicht an
    // einem Absturz zwischen zwei Läufen hängen.
    try { if (typeof window.saveGame === 'function') window.saveGame(); } catch (e) {}
    scene = null;
  }

  window.HubTruheUI = {
    ZELLE: ZELLE,
    oeffne: oeffne,
    schliesse: schliesse,
    istOffen: function () { return offen; },
    // Für die Verifikation: die gerechnete Lage der beiden Raster.
    geometrie: function () { return geometrie; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.HubTruheUI;
})();
