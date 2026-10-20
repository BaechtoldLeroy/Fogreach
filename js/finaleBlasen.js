// js/finaleBlasen.js — Sprechblasen fuer das Finale an der Esse.
//
// Gewuenscht: "Die Endszene bei der Esse soll nicht so grosse Toasts aus
// Messing haben. Wie waers mit Sprechblasen ueber den Charakteren?"
//
// Eine Seite des Finales (dieselben Texte wie vorher) wird in Schritte
// zerlegt: Absaetze mit Sprecher ("ELARA: ...") stehen als kleine Blase ueber
// der Figur, reine Erzaehlung in Klammern als schmale Untertitelzeile unten.
// Ein Absatz ohne Sprecher, der nicht ganz in Klammern steht, gehoert dem
// letzten Sprecher ("(Sie sieht auf ihren Ring.) Du hast es erkannt.").
//
// Es gelten die Regeln des Ereignis-Dialogs (eventSystem.js): die Spieluhr
// steht, eventChoiceOpen sperrt die Kampfeingaben, die erste Taste zeigt den
// Satz ganz, die naechste blaettert, eine gehaltene Taste blaettert nicht.
// Mehrere Wahlen (Mara verlangt das Urteil) stehen als kleine Knoepfe unten,
// Tasten 1/2 oder Tippen; Leertaste/Enter/ESC waehlen dort nie.
//
// Nur das Finale nutzt das (finale.js). Alle anderen Dialoge bleiben, wie
// sie sind.
(function () {
  'use strict';

  var SPRECHER = /^([A-ZÄÖÜ][A-ZÄÖÜ .'-]*[A-ZÄÖÜ]):[ \t]+/;
  var TIEFE = 2600;
  var BLASE_B = 250;        // hoechste Textbreite einer Blase
  var BLASE_ZEILEN = 5;     // mehr Zeilen: in mehrere Blasen teilen
  var ZEILE_B = 560;        // hoechste Breite der Untertitelzeile
  var ZEILE_ZEILEN = 3;
  var PAD = 7;
  var SCHWANZ = 9;
  var RAND = 6;             // Abstand zum Bildschirmrand
  var UNTEN = 66;           // Unterkante der Zeile: darunter die Faehigkeitsleiste
  var FARBE = { papier: 0x221b14, rand: 0xb8923e, schatten: 0x0b0a10, knopf: 0x1c1712, knopfHell: 0x3a2f22 };

  function _en() {
    try { return !!(window.i18n && typeof window.i18n.getLanguage === 'function' && window.i18n.getLanguage() === 'en'); } catch (e) { return false; }
  }
  function _t(de, en) { return _en() ? en : de; }
  function _weg(o) { if (o && o.scene) { try { o.destroy(); } catch (e) {} } }
  function _mobil(scene) {
    try { return !!(scene.sys.game.device && !scene.sys.game.device.os.desktop); } catch (e) { return false; }
  }
  function _klemmen(v, lo, hi) { return hi < lo ? lo : Math.max(lo, Math.min(hi, v)); }

  // --- Reine Logik ------------------------------------------------------------

  /** Steht der Absatz ganz in einer Klammer? "(A.) B." nicht. */
  function nurKlammer(a) {
    var s = String(a || '').trim();
    if (s.charAt(0) !== '(') return false;
    var tiefe = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === '(') tiefe++;
      else if (c === ')') {
        tiefe--;
        if (tiefe === 0) return /^[.!?…]*$/.test(s.slice(i + 1).trim());
      }
    }
    return false;
  }

  /**
   * Zerlegt einen Seitentext in Schritte.
   * @returns {Array<{art:'blase'|'zeile', sprecher:string, text:string}>}
   */
  function schritte(text) {
    var raus = [];
    var letzter = '';
    String(text || '').split(/\n[ \t]*\n\s*/).forEach(function (abs) {
      var a = abs.trim();
      if (!a) return;
      var m = SPRECHER.exec(a);
      if (m) { letzter = m[1]; raus.push({ art: 'blase', sprecher: m[1], text: a.slice(m[0].length) }); return; }
      if (!letzter || nurKlammer(a)) { raus.push({ art: 'zeile', sprecher: '', text: a }); return; }
      raus.push({ art: 'blase', sprecher: letzter, text: a });
    });
    return raus.length ? raus : [{ art: 'zeile', sprecher: '', text: String(text || '') }];
  }

  /** "ELARA" -> "Elara" (Anzeige ueber dem Text der Blase). */
  function anzeigeName(s) {
    return String(s || '').toLowerCase().replace(/(^|[ '-])([a-zäöü])/g, function (m, v, b) { return v + b.toUpperCase(); });
  }

  // --- Stile --------------------------------------------------------------------

  function _gross(scene) { return _mobil(scene) ? 16 : 14; }
  function _stilBlase(scene) {
    return { fontFamily: 'serif', fontSize: _gross(scene) + 'px', color: '#efe6d2', lineSpacing: 1,
      wordWrap: { width: BLASE_B, useAdvancedWrap: true }, resolution: 2 };
  }
  function _stilName(scene) {
    return { fontFamily: 'serif', fontSize: (_gross(scene) - 3) + 'px', fontStyle: 'bold', color: '#d9b45a', resolution: 2 };
  }
  function _zeileBreite(scene) { return Math.min(scene.cameras.main.width - 48, ZEILE_B); }
  function _stilZeile(scene) {
    return { fontFamily: 'serif', fontStyle: 'italic', fontSize: _gross(scene) + 'px', color: '#e2d8c4', align: 'center',
      lineSpacing: 1, wordWrap: { width: _zeileBreite(scene), useAdvancedWrap: true }, resolution: 2 };
  }

  /** Zu lange Schritte auf mehrere Blasen/Zeilen verteilen (DialogSeiten-Regel). */
  function _teilen(scene, liste) {
    var DS = window.DialogSeiten;
    if (!DS || typeof DS.teilen !== 'function') return liste;
    var mb = scene.add.text(0, 0, 'Ag', _stilBlase(scene)).setVisible(false);
    var zh = mb.height;
    var mz = scene.add.text(0, 0, 'Ag', _stilZeile(scene)).setVisible(false);
    var raus = [];
    liste.forEach(function (s) {
      var m = s.art === 'blase' ? mb : mz;
      var max = (s.art === 'blase' ? BLASE_ZEILEN : ZEILE_ZEILEN) * (zh + 1) + 2;
      DS.teilen(s.text, function (t) { m.setText(t); return m.height <= max; }).forEach(function (st) {
        raus.push({ art: s.art, sprecher: s.sprecher, text: st.text });
      });
    });
    mb.destroy(); mz.destroy();
    return raus;
  }

  // --- Zeichnen -----------------------------------------------------------------

  /** Wo die Figur auf dem Schirm steht (oder null, wenn sie fehlt oder unsichtbar ist). */
  function _anker(scene, fig) {
    if (!fig || !fig.scene || fig.visible === false || (typeof fig.alpha === 'number' && fig.alpha < 0.05)) return null;
    var kam = scene.cameras.main;
    var b = fig.getBounds ? fig.getBounds() : { centerX: fig.x, left: fig.x - 15, right: fig.x + 15, top: fig.y - 30, bottom: fig.y + 30 };
    return { x: b.centerX - kam.scrollX, oben: b.top - kam.scrollY, unten: b.bottom - kam.scrollY,
      links: b.left - kam.scrollX, rechts: b.right - kam.scrollX };
  }

  /**
   * Eine Blase ueber einer Figur. setzen() richtet sie neu an der Figur aus
   * (jedes Bild, postupdate), eingeklemmt in den Bildschirm.
   */
  function _blase(scene, sprecher, text, figurFn) {
    var kam = scene.cameras.main;
    var name = scene.add.text(0, 0, anzeigeName(sprecher), _stilName(scene)).setOrigin(0).setScrollFactor(0).setDepth(TIEFE + 2);
    var txt = scene.add.text(0, 0, text, _stilBlase(scene)).setOrigin(0).setScrollFactor(0).setDepth(TIEFE + 2);
    var g = scene.add.graphics().setScrollFactor(0).setDepth(TIEFE + 1);
    var w = Math.ceil(Math.max(name.width, txt.width)) + PAD * 2;
    var h = Math.ceil(name.height + 1 + txt.height) + PAD * 2;
    var o = { teile: [g, name, txt], txt: txt, name: name, w: w, h: h, lage: null, pfeil: false };
    o.setzen = function () {
      var a = _anker(scene, figurFn ? figurFn() : null);
      var W = kam.width, H = kam.height;
      // Ohne sichtbare Figur bleibt die Blase, wo sie zuletzt stand.
      if (!a) a = o.lage ? o.lage.anker : { x: W / 2, oben: H / 2, unten: H / 2, links: W / 2, rechts: W / 2 };
      // Wohin: ueber die Figur; ist oben kein Platz (Figur am oberen Rand),
      // daneben auf Kopfhoehe, rechts oder links; als Letztes darunter.
      var seite = 'oben';
      if (a.oben - SCHWANZ - h < RAND) {
        var drin = a.rechts > 0 && a.links < W;   // daneben nur, wenn sie im Bild steht
        if (drin && a.rechts + SCHWANZ + w <= W - RAND) seite = 'rechts';
        else if (drin && a.links - SCHWANZ - w >= RAND) seite = 'links';
        else seite = 'unten';
      }
      var bx, by, spitzeX, spitzeY, basis, r = 2, pts;
      if (seite === 'oben' || seite === 'unten') {
        bx = Math.round(_klemmen(a.x - w / 2, RAND, W - RAND - w));
        by = Math.round(_klemmen(seite === 'oben' ? a.oben - SCHWANZ - h : a.unten + SCHWANZ, RAND, H - RAND - h));
        basis = _klemmen(a.x, bx + 12, bx + w - 12);
        spitzeX = _klemmen(a.x, bx + 4, bx + w - 4);
        spitzeY = seite === 'oben' ? by + h + SCHWANZ : by - SCHWANZ;
      } else {
        var kopf = a.oben + Math.min(14, (a.unten - a.oben) / 4);
        bx = Math.round(seite === 'rechts' ? a.rechts + SCHWANZ : a.links - SCHWANZ - w);
        by = Math.round(_klemmen(kopf - 14, RAND, H - RAND - h));
        basis = _klemmen(kopf, by + 10, by + h - 10);
        spitzeX = seite === 'rechts' ? bx - SCHWANZ : bx + w + SCHWANZ;
        spitzeY = _klemmen(kopf, by + 4, by + h - 4);
      }
      if (seite === 'oben') {
        pts = [[bx + r, by], [bx + w - r, by], [bx + w, by + r], [bx + w, by + h - r], [bx + w - r, by + h],
          [basis + 5, by + h], [spitzeX, spitzeY], [basis - 5, by + h], [bx + r, by + h], [bx, by + h - r], [bx, by + r]];
      } else if (seite === 'unten') {
        pts = [[bx + r, by], [basis - 5, by], [spitzeX, spitzeY], [basis + 5, by], [bx + w - r, by], [bx + w, by + r],
          [bx + w, by + h - r], [bx + w - r, by + h], [bx + r, by + h], [bx, by + h - r], [bx, by + r]];
      } else if (seite === 'rechts') {
        pts = [[bx + r, by], [bx + w - r, by], [bx + w, by + r], [bx + w, by + h - r], [bx + w - r, by + h],
          [bx + r, by + h], [bx, by + h - r], [bx, basis + 5], [spitzeX, spitzeY], [bx, basis - 5], [bx, by + r]];
      } else {
        pts = [[bx + r, by], [bx + w - r, by], [bx + w, by + r], [bx + w, basis - 5], [spitzeX, spitzeY], [bx + w, basis + 5],
          [bx + w, by + h - r], [bx + w - r, by + h], [bx + r, by + h], [bx, by + h - r], [bx, by + r]];
      }
      var punkte = pts.map(function (p) { return { x: p[0], y: p[1] }; });
      g.clear();
      g.fillStyle(FARBE.schatten, 0.55);
      g.fillPoints(punkte.map(function (p) { return { x: p.x + 2, y: p.y + 2 }; }), true);
      g.fillStyle(FARBE.papier, 0.95);
      g.fillPoints(punkte, true);
      g.lineStyle(1, FARBE.rand, 1);
      g.strokePoints(punkte, true, true);
      if (o.pfeil) {
        // Kleines Dreieck unten rechts: weiter mit Taste oder Tippen.
        var px = bx + w - 9, py = by + h - 7;
        g.fillStyle(FARBE.rand, 1);
        g.fillTriangle(px - 3, py - 2, px + 3, py - 2, px, py + 1);
      }
      name.setPosition(bx + PAD, by + PAD - 1);
      txt.setPosition(bx + PAD, by + PAD + name.height);
      o.lage = { x: bx, y: by, w: w, h: h, spitze: { x: spitzeX, y: spitzeY }, seite: seite, anker: a };
    };
    o.setzen();
    return o;
  }

  /** Schmale Untertitelzeile unten. `name`: Sprecher, wenn seine Figur fehlt. */
  function _zeile(scene, text, name, unten) {
    var kam = scene.cameras.main;
    var W = kam.width;
    var voll = name ? anzeigeName(name) + ': ' + text : text;
    var txt = scene.add.text(W / 2, 0, voll, _stilZeile(scene)).setOrigin(0.5, 0).setScrollFactor(0).setDepth(TIEFE + 2);
    var w = Math.min(W - 16, Math.ceil(txt.width) + 32), h = Math.ceil(txt.height) + 12;
    var y = kam.height - (unten == null ? UNTEN : unten) - h;
    txt.setY(y + 6);
    var g = scene.add.graphics().setScrollFactor(0).setDepth(TIEFE + 1);
    var x = Math.round(W / 2 - w / 2);
    g.fillStyle(FARBE.schatten, 0.74).fillRect(x, y, w, h);
    g.fillStyle(FARBE.rand, 0.5).fillRect(x + 8, y, w - 16, 1).fillRect(x + 8, y + h - 1, w - 16, 1);
    return { teile: [g, txt], txt: txt, voll: voll, lage: { x: x, y: y, w: w, h: h } };
  }

  function _aufbauen(scene, txt, voll, sprecher) {
    var TW = window.DialogTypewriter;
    if (!TW || typeof TW.anTextobjekt !== 'function') return null;
    // wanduhr: die Seite haelt die Spieluhr an, auf scene.time laeuft kein Takt.
    return TW.anTextobjekt(scene, txt, voll, { sprecher: sprecher || '', wanduhr: true });
  }

  // --- Die Seite ------------------------------------------------------------------

  /**
   * Zeigt eine Seite des Finales als Blasen und Zeilen.
   * @param {object} scene
   * @param {string} text        der Seitentext (wie fuer showEventChoiceDialog)
   * @param {Array} wahlen       [{ label, callback }]; die letzte Blase entscheidet
   * @param {object} [opts]      figur(sprecher) -> Spielobjekt oder null
   * @returns {{laeuft:function, ueberspringen:function, zu:function}}
   */
  function zeigen(scene, text, wahlen, opts) {
    if (!scene || !scene.add || !wahlen || !wahlen.length) return null;
    opts = opts || {};
    if (scene.__finaleBlase) scene.__finaleBlase.zu();
    hinweisWeg(scene);
    // Ein kurzer Ruf (Harren: "Lene.") steht sonst doppelt neben der Seite.
    (scene.__finaleKurz || []).slice().forEach(function (k) { k.weg(); });
    var kam = scene.cameras.main;
    var W = kam.width, H = kam.height;
    var liste = _teilen(scene, schritte(text));
    var figur = function (s) {
      try { return typeof opts.figur === 'function' ? opts.figur(s) : null; } catch (e) { return null; }
    };

    scene._eventChoiceActive = true;
    window.eventChoiceOpen = true;
    if (typeof window.pauseGameClock === 'function') window.pauseGameClock(scene);
    else if (scene.physics && scene.physics.world) scene.physics.world.pause();

    // Tippen irgendwo: wie eine Taste (erst der ganze Satz, dann weiter).
    var fang = scene.add.zone(0, 0, W, H).setOrigin(0).setScrollFactor(0).setDepth(TIEFE).setInteractive();
    fang.setName('finaleBlaseFang');
    var teile = [], knoepfe = [], aufbau = null, i = -1, offen = true, folge = null;
    var weiterLabel = _t('Weiter', 'Continue');
    var zust = {
      text: String(text || ''), wahlen: wahlen.map(function (w) { return w.label; }),
      schritte: liste, fang: fang, knoepfe: knoepfe,
      schritt: function () { return i; }, aktuell: function () { return liste[i] || null; },
      lage: function () { return folge && folge.lage; },
      art: function () { return folge && folge.art; },
      laeuft: function () { return !!(aufbau && aufbau.laeuft()); },
      druecken: druecken, waehle: waehle, zu: zu
    };
    scene.__finaleBlase = zust;

    function schrittWeg() {
      if (aufbau) { try { aufbau.abbrechen(); } catch (e) {} aufbau = null; }
      teile.forEach(_weg); teile.length = 0;
      knoepfe.forEach(_weg); knoepfe.length = 0;
      folge = null;
    }
    function knopfReihe(obenGrenze) {
      var mehr = wahlen.length > 1;
      if (!mehr && wahlen[0].label === weiterLabel) return;   // "Weiter": Taste oder Tippen genuegt
      var mobil = _mobil(scene);
      var bh = mobil ? 44 : 28, abst = 10;
      var stueck = wahlen.map(function (w, k) {
        var label = (mehr && !mobil ? (k + 1) + '  ' : '') + w.label;
        var t = scene.add.text(0, 0, label, { fontFamily: 'serif', fontSize: (mobil ? 16 : 14) + 'px', color: '#f1e9d8', resolution: 2 })
          .setOrigin(0.5).setScrollFactor(0).setDepth(TIEFE + 4);
        return { t: t, w: Math.max(96, Math.ceil(t.width) + 28) };
      });
      var reihe = stueck.reduce(function (s, k) { return s + k.w; }, 0) + abst * (stueck.length - 1);
      var x = Math.round(W / 2 - reihe / 2);
      var y = Math.round(Math.min(obenGrenze, H - UNTEN) - 8 - bh / 2);
      stueck.forEach(function (k, n) {
        var bg = scene.add.rectangle(x + k.w / 2, y, k.w, bh, FARBE.knopf, 0.95).setStrokeStyle(1, FARBE.rand)
          .setScrollFactor(0).setDepth(TIEFE + 3).setInteractive({ useHandCursor: true }).setName('finaleBlaseKnopf');
        k.t.setPosition(x + k.w / 2, y);
        bg.on('pointerover', function () { bg.setFillStyle(FARBE.knopfHell, 0.95); });
        bg.on('pointerout', function () { bg.setFillStyle(FARBE.knopf, 0.95); });
        bg.on('pointerdown', function () { waehle(n); });
        bg._label = k.t;
        knoepfe.push(bg);
        teile.push(k.t);
        x += k.w + abst;
      });
    }
    function zeigeSchritt(n) {
      schrittWeg();
      i = n;
      var s = liste[n];
      var letzte = n === liste.length - 1;
      var fig = s.art === 'blase' ? figur(s.sprecher) : null;
      if (s.art === 'blase' && _anker(scene, fig)) {
        var b = _blase(scene, s.sprecher, s.text, function () { return figur(s.sprecher); });
        folge = { art: 'blase', sprecher: s.sprecher, objekt: b, lage: b.lage };
        teile.push.apply(teile, b.teile);
        aufbau = _aufbauen(scene, b.txt, s.text, s.sprecher);
      } else {
        // Erzaehlung, oder die Figur des Sprechers ist nicht im Bild.
        var z = _zeile(scene, s.text, s.art === 'blase' ? s.sprecher : '');
        folge = { art: 'zeile', sprecher: s.art === 'blase' ? s.sprecher : '', objekt: z, lage: z.lage };
        teile.push.apply(teile, z.teile);
        aufbau = _aufbauen(scene, z.txt, z.voll, s.sprecher);
      }
      if (letzte) knopfReihe(folge.art === 'zeile' ? folge.lage.y : H - UNTEN);
    }
    // Folgt der Figur (postupdate: nach Kamera und Tweens, kein Bild Verzug).
    function folgen() {
      if (!folge || folge.art !== 'blase') return;
      var b = folge.objekt;
      b.pfeil = !(aufbau && aufbau.laeuft()) && !(i === liste.length - 1 && knoepfe.length);
      b.setzen();
      folge.lage = b.lage;
    }
    function druecken() {
      if (!offen) return;
      if (aufbau && aufbau.ueberspringen()) return;
      if (i < liste.length - 1) { zeigeSchritt(i + 1); return; }
      if (wahlen.length === 1) waehle(0);
    }
    function waehle(k) {
      if (!offen) return;
      var w = wahlen[k];
      if (!w) return;
      zu();
      if (typeof w.callback === 'function') w.callback();
    }
    function taste(ev) {
      // Gehaltene Taste: nicht ueberspringen UND gleich blaettern.
      if (ev && ev.repeat) return;
      druecken();
    }
    function zahl(k) {
      return function (ev) {
        if (ev && ev.repeat) return;
        if (wahlen.length > 1 && i === liste.length - 1) waehle(k);
      };
    }
    var zahlen = ['ONE', 'TWO', 'THREE'].map(function (n, k) { return { ev: 'keydown-' + n, fn: zahl(k) }; });
    var kb = scene.input && scene.input.keyboard;
    if (kb) {
      kb.on('keydown-SPACE', taste); kb.on('keydown-ENTER', taste); kb.on('keydown-ESC', taste);
      zahlen.forEach(function (z) { kb.on(z.ev, z.fn); });
    }
    fang.on('pointerdown', function () { druecken(); });
    scene.events.on('postupdate', folgen);
    scene.events.once('shutdown', zu);

    function zu() {
      if (!offen) return;
      offen = false;
      schrittWeg();
      _weg(fang);
      if (kb) {
        kb.off('keydown-SPACE', taste); kb.off('keydown-ENTER', taste); kb.off('keydown-ESC', taste);
        zahlen.forEach(function (z) { kb.off(z.ev, z.fn); });
      }
      scene.events.off('postupdate', folgen);
      scene.events.off('shutdown', zu);
      if (scene.__finaleBlase === zust) scene.__finaleBlase = null;
      scene._eventChoiceActive = false;
      window.eventChoiceOpen = false;
      if (typeof window.resumeGameClock === 'function') window.resumeGameClock(scene);
      else if (scene.physics && scene.physics.world) scene.physics.world.resume();
    }

    zeigeSchritt(0);
    return {
      laeuft: function () { return zust.laeuft(); },
      ueberspringen: function () { return !!(aufbau && aufbau.ueberspringen()); },
      zu: zu
    };
  }

  // --- Ohne Pause: kurze Blase und Hinweiszeile -------------------------------------

  /** Eine kurze Blase, die der Figur folgt und von selbst geht (die Uhr laeuft). */
  function kurz(scene, sprecher, text, figurFn, ms) {
    if (!scene || !scene.add || !_anker(scene, figurFn && figurFn())) return null;
    var b = _blase(scene, sprecher, text, figurFn);
    b.teile.forEach(function (t) { t.setName('finaleKurzBlase'); });
    var folgen = function () { b.setzen(); };
    scene.events.on('postupdate', folgen);
    var liste = scene.__finaleKurz = scene.__finaleKurz || [];
    liste.push(b);
    var weg = function () {
      scene.events.off('postupdate', folgen);
      b.teile.forEach(_weg);
      var n = liste.indexOf(b);
      if (n >= 0) liste.splice(n, 1);
    };
    scene.time.delayedCall(ms || 2600, function () {
      if (scene.tweens) scene.tweens.add({ targets: b.teile, alpha: 0, duration: 500, onComplete: weg });
      else weg();
    });
    scene.events.once('shutdown', weg);
    b.weg = weg;
    return b;
  }

  /**
   * Eine Hinweiszeile unten, die von selbst geht. Ersetzt im Finale die
   * Messing-Toasts. Immer nur eine; eine neue Seite raeumt sie ab.
   */
  function hinweis(scene, text, ms) {
    if (!scene || !scene.add || !scene.cameras) return null;
    hinweisWeg(scene);
    var z = _zeile(scene, text, '');
    z.teile.forEach(function (t) { t.setName('finaleHinweis'); });
    var eintrag = { text: text, teile: z.teile, lage: z.lage };
    scene.__finaleHinweis = eintrag;
    var weg = function () {
      z.teile.forEach(_weg);
      if (scene.__finaleHinweis === eintrag) scene.__finaleHinweis = null;
    };
    eintrag.weg = weg;
    if (scene.time) {
      scene.time.delayedCall(ms || 4200, function () {
        if (scene.tweens && z.teile[0].scene) scene.tweens.add({ targets: z.teile, alpha: 0, duration: 500, onComplete: weg });
        else weg();
      });
    }
    scene.events.once('shutdown', weg);
    return eintrag;
  }
  function hinweisWeg(scene) {
    if (scene && scene.__finaleHinweis && scene.__finaleHinweis.weg) scene.__finaleHinweis.weg();
  }

  var API = {
    zeigen: zeigen, kurz: kurz, hinweis: hinweis, hinweisWeg: hinweisWeg,
    schritte: schritte, nurKlammer: nurKlammer, anzeigeName: anzeigeName,
    aktiv: function (scene) { return (scene && scene.__finaleBlase) || null; },
    TIEFE: TIEFE, UNTEN: UNTEN
  };
  if (typeof window !== 'undefined') window.FinaleBlasen = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
