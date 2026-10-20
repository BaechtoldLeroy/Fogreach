/* =====================================================================
 * zettelSzene.js — "Du bist dem gefalteten Zettel gefolgt" als
 * Zwischensequenz (#155, Abgabe von "Der Maulwurf" bei Mara).
 * ---------------------------------------------------------------------
 * Vor dem Verrat drei Bilder statt Textseiten: der Zettel mit dem Siegel
 * der drei Ketten in Deiner Hand, der Schatten des Maulwurfs auf der
 * Treppe zur Ratskammer (an der Tuer der Waechter mit dem roten Helmbusch
 * aus Elaras Rettung), und durch den Tuerspalt Aldric und Elara. Danach
 * spielt storyScenes.playMaulwurfEnthuellung den Rueckblick
 * (js/rettungsSzene.js) und den Ring mit der Auswahl wie bisher.
 *
 * Wie die Akt-Zwischenszenen (js/aktwechsel.js): ein Pixel-Tableau je Bild
 * (PixelLab, 384x192, assets/sprites/zettel/) mit langsamem Schwenk, unten
 * die Messing-Platte. Der Text baut sich Wort fuer Wort auf
 * (DialogTypewriter). Die erste Taste (oder ein Klick/Tipp) zeigt den Satz
 * ganz, die naechste blaettert weiter. ESC oder der Knopf beenden die
 * Bilder, nie mehr: eine Auswahl trifft diese Szene nie, sie ist vorbei,
 * bevor die Auswahl kommt.
 *
 * Die Spieluhr steht, solange die Szene laeuft. Darum haengt nichts an
 * scene.time: Schwenk und Blenden sind Tweens, die Sperrfrist misst Date.now.
 * Fehlen die Bilder, meldet laden() das, und die Szene faellt auf die
 * fruehere Textseite zurueck.
 *
 * Debug: ?zettel=1|2|3 startet im Hub die ganze Maulwurf-Szene ab diesem
 * Bild (siehe docs/debug-modus.md).
 * ===================================================================== */
(function () {
  'use strict';

  var ORDNER = 'assets/sprites/zettel/';
  var V = 1;
  var BILDER = ['zettel_hand', 'zettel_treppe', 'zettel_spalt'];
  // Worauf der Schwenk zufaehrt (Anteil an Bildbreite/-hoehe).
  var FOKUS = {
    zettel_hand: [0.45, 0.5],     // das Siegel
    zettel_treppe: [0.66, 0.42],  // der Waechter an der Tuer
    zettel_spalt: [0.55, 0.6]     // die uebergebene Hand
  };
  var TIEFE = 6000;
  var SPERRE_MS = 350;     // der ausloesende Tastendruck blaettert nicht gleich weiter
  var VORSPANN_MS = 900;   // so lange steht ein Bild allein, bevor der Text kommt
  var BLENDE_MS = 600;
  var KNOPF_MIN_H = 44;

  var DE = {
    'zettel.ueberspringen': 'Überspringen (ESC)',
    'zettel.ueberspringen_mobil': 'Überspringen',
    'zettel.weiter': 'Weiter',
    'zettel.1': '(Der Zettel des Maulwurfs. Ein Befehl, zweimal gefaltet. Im Wachs drei Ketten, ineinander verschlungen.)',
    'zettel.2': '(Du bist ihm gefolgt, dem Zettel und dem, der ihn trug. Durch die Kanäle, hinauf ins Rathaus. Es ist Nacht.)',
    'zettel.3': '(Ein Schatten vor Dir auf der Treppe. Er sieht sich nie um. Er kennt den Weg.)',
    'zettel.4_voll': '(Oben die Tür der Ratskammer. Davor ein Kettenwächter, auf dem Helm ein roter Helmbusch. Du kennst ihn. Aus dem Keller.)',
    'zettel.4_allgemein': '(Oben die Tür der Ratskammer. Davor ein Kettenwächter. Irgendwoher kennst Du ihn. Aus dem Keller?)',
    'zettel.4_keiner': '(Oben die Tür der Ratskammer. Davor steht eine Wache.)',
    'zettel.5': '(Der Schatten geht an ihm vorbei, und er hält ihn nicht auf. Die Tür bleibt einen Spalt offen.)',
    'zettel.6': '(Durch den Spalt: Aldric steht am Tisch. Ihm gegenüber, ohne Kapuze: Elara.)',
    'zettel.7': '(An ihrer Hand blitzt etwas im Kerzenlicht.)'
  };
  var EN = {
    'zettel.ueberspringen': 'Skip (ESC)',
    'zettel.ueberspringen_mobil': 'Skip',
    'zettel.weiter': 'Continue',
    'zettel.1': '(The mole\'s note. An order, folded twice. In the wax, three chains, intertwined.)',
    'zettel.2': '(You followed it, the note and the one who carried it. Through the canals, up into the town hall. It is night.)',
    'zettel.3': '(A shadow ahead of you on the stairs. It never looks back. It knows the way.)',
    'zettel.4_voll': '(At the top, the door of the council chamber. Before it a Chain Guard, a red plume on his helmet. You know him. From the cellar.)',
    'zettel.4_allgemein': '(At the top, the door of the council chamber. Before it a Chain Guard. You know him from somewhere. From the cellar?)',
    'zettel.4_keiner': '(At the top, the door of the council chamber. A guard stands before it.)',
    'zettel.5': '(The shadow walks past him, and he does not stop it. The door stays open a crack.)',
    'zettel.6': '(Through the crack: Aldric stands at the table. Across from him, hood down: Elara.)',
    'zettel.7': '(Something on her hand flashes in the candlelight.)'
  };
  if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', DE);
    window.i18n.register('en', EN);
  }
  function _t(key) {
    var I = (typeof window !== 'undefined') ? window.i18n : null;
    if (I && typeof I.t === 'function') {
      var s = I.t(key);
      if (s && s !== key && s.indexOf('[') !== 0) return s;
    }
    var en = !!(I && typeof I.getLanguage === 'function' && I.getLanguage() === 'en');
    return (en ? EN : DE)[key] || key;
  }

  /** Die Bilder mit ihren Zeilen. art: 'voll' | 'allgemein' | null (wie RettungsSzene.rueckblickArt). */
  function bilder(art) {
    var wache = art === 'voll' ? 'zettel.4_voll' : (art === 'allgemein' ? 'zettel.4_allgemein' : 'zettel.4_keiner');
    return [
      { key: 'zettel_hand', zeilen: [_t('zettel.1'), _t('zettel.2')] },
      { key: 'zettel_treppe', zeilen: [_t('zettel.3'), _t(wache), _t('zettel.5')] },
      { key: 'zettel_spalt', zeilen: [_t('zettel.6'), _t('zettel.7')] }
    ];
  }

  /** Laedt die fehlenden Bilder; fertig(ok) — ok false, wenn eines fehlt. */
  function laden(scene, fertig) {
    var einmal = function (ok) { if (fertig) { var f = fertig; fertig = null; f(ok); } };
    var tex = scene && scene.textures, ld = scene && scene.load;
    if (!tex || !ld) { einmal(false); return; }
    var alle = function () { return BILDER.every(function (k) { return tex.exists(k); }); };
    var fehlt = BILDER.filter(function (k) { return !tex.exists(k); });
    if (!fehlt.length) { einmal(true); return; }
    fehlt.forEach(function (k) { ld.image(k, ORDNER + k + '.png?v=' + V); });
    ld.once('complete', function () { einmal(alle()); });
    try { if (!ld.isLoading()) ld.start(); } catch (e) { einmal(false); }
  }

  function _mobil(scene) {
    try { return !!(scene.sys.game.device.input.touch); } catch (e) { return false; }
  }

  /** scrollFactor 0 bis in jedes Kind (sonst treffen Mobile-Taps daneben). */
  function _fest(o) {
    if (!o) return;
    if (typeof o.setScrollFactor === 'function') o.setScrollFactor(0);
    if (o.list) o.list.forEach(_fest);
  }

  /**
   * Spielt die Bilder. Die Bilder muessen geladen sein (laden()).
   * @param {object} [o]  { abBild: Index des ersten Bildes }
   */
  function spielen(scene, art, fertig, o) {
    var einmal = function () { if (typeof fertig === 'function') { var f = fertig; fertig = null; f(); } };
    var cam = scene && scene.cameras && scene.cameras.main;
    if (!cam || !scene.add || !scene.tweens) { einmal(); return null; }
    var w = cam.width, h = cam.height;
    var folge = bilder(art);
    var nr = Math.max(0, Math.min(folge.length - 1, (o && o.abBild) | 0));
    var zeile = 0;
    var tweens = [];
    function tween(c) { var t = scene.tweens.add(c); tweens.push(t); return t; }

    // Nur loesen, was diese Szene angehalten hat: der Hub-Dialog darunter
    // haelt die Uhr womoeglich schon selbst an.
    var P = window.__GAME_PAUSE;
    var angehalten = false;
    if (typeof window.pauseGameClock === 'function' && !(P && P.since != null)) {
      try { window.pauseGameClock(scene); angehalten = true; } catch (e) {}
    }

    var c = scene.add.container(0, 0).setDepth(TIEFE);
    c.setName('zettelSzene');
    // Schwarzer Grund, interaktiv: ein Tipp soll keinen Knopf des Hub-Dialogs
    // darunter treffen (Phaser gibt ihn nur dem obersten Objekt).
    var grund = scene.add.rectangle(w / 2, h / 2, w + 40, h + 40, 0x000000, 1);
    c.add(grund);
    grund.setInteractive();
    var bildEbene = scene.add.container(0, 0);
    c.add(bildEbene);

    // ---- Textplatte unten ----
    var tpW = Math.min(780, w - 32);
    var tpH = Math.min(118, Math.round(h * 0.26));
    var tpY = h - 14 - tpH / 2;
    var platte = scene.add.container(0, 0);
    c.add(platte);
    var UR = window.uiRahmen;
    var teile = UR && typeof UR.bereit === 'function' && UR.bereit(scene)
      ? UR.platte(scene, w / 2, tpY, tpW, tpH, TIEFE + 2, 0.5) : null;
    if (teile) teile.forEach(function (t) { platte.add(t); });
    else {
      var g = scene.add.graphics();
      g.fillStyle(0x1c191f, 0.94).fillRoundedRect(w / 2 - tpW / 2, tpY - tpH / 2, tpW, tpH, 10);
      g.lineStyle(2, 0xa8a090, 0.8).strokeRoundedRect(w / 2 - tpW / 2, tpY - tpH / 2, tpW, tpH, 10);
      platte.add(g);
    }
    var text = scene.add.text(w / 2, tpY - 6, '', {
      fontFamily: 'serif', fontSize: 18, color: '#f1e9d8', align: 'center',
      wordWrap: { width: tpW - 80 }, lineSpacing: 4
    }).setOrigin(0.5);
    text.setName('zettelText');
    platte.add(text);
    var hinweis = scene.add.text(w / 2 + tpW / 2 - 26, tpY + tpH / 2 - 12, _t('zettel.weiter'), {
      fontFamily: 'monospace', fontSize: 13, color: '#c8bca4'
    }).setOrigin(1, 1).setVisible(false);
    platte.add(hinweis);
    tween({ targets: hinweis, alpha: { from: 1, to: 0.45 }, duration: 900, yoyo: true, repeat: -1 });
    platte.setAlpha(0);

    // ---- Ueberspringen oben rechts (Trefferflaeche >= 44 px) ----
    var skip = scene.add.text(w - 16, 16 + KNOPF_MIN_H / 2,
      _t(_mobil(scene) ? 'zettel.ueberspringen_mobil' : 'zettel.ueberspringen'), {
        fontFamily: 'monospace', fontSize: '14px', color: '#f4efe2', align: 'center'
      }).setOrigin(1, 0.5);
    var py = Math.max(8, Math.ceil((KNOPF_MIN_H - skip.height) / 2));
    skip.setPadding(14, py, 14, py);
    skip.setName('zettelUeberspringen');
    c.add(skip);
    // Der Messing-Knopf legt sich im Container hinter den Text.
    var skipBild = (UR && UR.bereit && UR.bereit(scene) && UR.textKnopf) ? UR.textKnopf(scene, skip, null, { ton: '#3a2a1a' }) : null;
    if (!skipBild) skip.setStroke('#000000', 3);

    var zustand = {
      bild: nr, zeile: 0, phase: 'vorspann', offen: true, protokoll: [],
      tippt: function () { return !!(lauf && lauf.laeuft()); },
      weiter: function () { weiter(true); },
      ueberspringen: function () { ueberspringen(); }
    };
    scene.__zettelSzene = zustand;

    var bild = null;
    var lauf = null;
    var vorspann = null;
    var bereitAb = Date.now() + SPERRE_MS;
    var zu = false;

    function bildZeigen() {
      var e = folge[nr];
      var f = FOKUS[e.key] || [0.5, 0.5];
      var alt = bild;
      bild = scene.add.image(w * f[0], h * f[1], e.key).setOrigin(f[0], f[1]);
      bild.setName('zettelBild_' + (nr + 1));
      var basis = Math.max(w / bild.width, h / bild.height);
      bild.setScale(basis).setAlpha(0);
      bildEbene.add(bild);
      _fest(bild);
      tween({ targets: bild, alpha: 1, duration: BLENDE_MS,
        onComplete: function () { if (alt && alt.scene) alt.destroy(); } });
      tween({ targets: bild, scale: basis * 1.12, duration: 22000, ease: 'Sine.easeOut' });
      zustand.bild = nr; zustand.zeile = 0; zustand.phase = 'vorspann';
      zustand.protokoll.push({ bild: e.key });
      zeile = 0;
      text.setText('');
      hinweis.setVisible(false);
      vorspann = setTimeout(function () { vorspann = null; zeileZeigen(); }, VORSPANN_MS);
    }

    function zeileZeigen() {
      if (zu) return;
      if (vorspann) { clearTimeout(vorspann); vorspann = null; }
      if (platte.alpha < 1) tween({ targets: platte, alpha: 1, duration: 300 });
      var satz = folge[nr].zeilen[zeile];
      zustand.zeile = zeile; zustand.phase = 'text';
      zustand.protokoll.push({ bild: folge[nr].key, text: satz });
      hinweis.setVisible(false);
      text.setText(satz);
      if (lauf) lauf.abbrechen();
      var TW = window.DialogTypewriter;
      lauf = (TW && typeof TW.anTextobjekt === 'function')
        ? TW.anTextobjekt(scene, text, satz, { wanduhr: true, onFertig: function () { if (!zu) hinweis.setVisible(true); } })
        : null;
      if (!lauf || !lauf.laeuft()) hinweis.setVisible(true);
    }

    function weiter(vonAussen) {
      if (zu) return;
      if (!vonAussen && Date.now() < bereitAb) return;
      bereitAb = Date.now() + 120;
      if (vorspann) { zeileZeigen(); return; }
      // Erst den Satz zu Ende zeigen, dann weiter.
      if (lauf && lauf.laeuft()) { lauf.ueberspringen(); return; }
      if (zeile < folge[nr].zeilen.length - 1) { zeile++; zeileZeigen(); return; }
      if (nr < folge.length - 1) { nr++; bildZeigen(); return; }
      ende();
    }
    function ueberspringen() { if (!zu) { zustand.protokoll.push({ uebersprungen: true }); ende(); } }

    function ende() {
      if (zu) return;
      zu = true;
      zustand.offen = false;
      zustand.phase = 'fertig';
      if (vorspann) clearTimeout(vorspann);
      if (lauf) lauf.abbrechen();
      abmelden.forEach(function (fn) { try { fn(); } catch (e) {} });
      tweens.forEach(function (t) { try { t.stop(); t.remove(); } catch (e) {} });
      try { c.destroy(true); } catch (e) {}
      if (angehalten && typeof window.resumeGameClock === 'function') {
        try { window.resumeGameClock(scene); } catch (e) {}
      }
      einmal();
    }

    // ---- Steuerung ----
    var abmelden = [];
    var ein = scene.input;
    if (ein) {
      var beiTaste = function (ev) {
        if (ev && ev.repeat) return;
        var k = ev && (ev.key || ev.code);
        if (k === 'Escape' || (ev && ev.keyCode === 27)) { ueberspringen(); return; }
        // Dasselbe E soll nicht nebenbei eine Faehigkeit ausloesen.
        if (k === 'e' || k === 'E' || k === 'KeyE') {
          try { window.__eventConsumedEAt = Date.now(); window.__eventConsumedE = true; } catch (e) {}
        }
        weiter(false);
      };
      if (ein.keyboard && typeof ein.keyboard.on === 'function') {
        ein.keyboard.on('keydown', beiTaste);
        abmelden.push(function () { ein.keyboard.off('keydown', beiTaste); });
      }
      var beiZeiger = function () { weiter(false); };
      if (typeof ein.on === 'function') {
        ein.on('pointerdown', beiZeiger);
        abmelden.push(function () { ein.off('pointerdown', beiZeiger); });
      }
    }
    skip.setInteractive({ useHandCursor: true });
    skip.on('pointerdown', function (p, x, y, ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      ueberspringen();
    });
    var beiEnde = function () { ende(); };
    if (scene.events) {
      scene.events.once('shutdown', beiEnde);
      abmelden.push(function () { scene.events.off('shutdown', beiEnde); });
    }

    _fest(c);
    bildZeigen();
    return zustand;
  }

  // Debug: ?zettel=N, einmal pro Seitenaufruf (ausgewertet in RettungsSzene.vorschau).
  var _vorschauGenommen = false;
  function vorschauBild() {
    if (_vorschauGenommen) return null;
    var G = window.DebugGate;
    var wert = null;
    try { wert = G && typeof G.flagge === 'function' ? G.flagge('zettel') : null; } catch (e) { wert = null; }
    if (!wert) return null;
    _vorschauGenommen = true;
    var n = parseInt(wert, 10);
    return (n >= 1 && n <= BILDER.length) ? n - 1 : 0;
  }
  var _startBild = 0;

  var Z = {
    BILDER: BILDER,
    bilder: bilder,
    laden: laden,
    spielen: spielen,
    vorschauBild: vorschauBild,
    /** Einmaliger Startpunkt fuer die naechste Szene (Debug ?zettel=N). */
    startBildSetzen: function (n) { _startBild = n | 0; },
    startBildNehmen: function () { var n = _startBild; _startBild = 0; return n; }
  };
  if (typeof window !== 'undefined') window.ZettelSzene = Z;
})();
