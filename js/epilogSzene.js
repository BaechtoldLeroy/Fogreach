/* =====================================================================
 * epilogSzene.js — Der Epilog als Bildfolge (#158, Ende der Geschichte)
 * ---------------------------------------------------------------------
 * Bisher lief der Epilog als Aktkarte mit einem einzigen Bild und als
 * Textseiten bei Thom. Jetzt erzaehlt er auf Pixel-Tableaus (PixelLab,
 * 384x192, assets/sprites/epilog/), im Stil von Wiedersehen und Bruchnacht.
 * Der Text bleibt, was questFinale.epilogTeile liefert; jeder Absatz bekommt
 * das Bild seines Zweigs:
 *
 *   presse               Thom setzt, die Presse druckt die Wahrheit
 *   nebel                der Nebel bricht ueber Fogreach
 *   grab                 Harrens Grab am Brunnen (nur wenn er tot ist)
 *   elara_lebt/_tot      hinter den Gittern / ihre Klinge ueber dem Setzkasten
 *   rueckkehr            die Verschwundenen steigen aus den Kanaelen
 *   platz_voll/_leer     der Platz mit den Verbuendeten oder leer
 *   aldric_erzaehlt/_verschwiegen  Kammer mit Thoms Blaettern / verirrt
 *   schmiede             neue Druckplatten fuer alle (die letzten Saetze)
 *
 * Steuerung wie in den anderen Zwischenszenen: jedes Bild faehrt langsam
 * heran, unten baut sich der Text Wort fuer Wort auf; die erste Taste (oder
 * ein Klick) zeigt den Satz ganz, die naechste blaettert. ESC oder
 * "Ueberspringen" beendet bewusst. Die Spieluhr steht; darum haengt der
 * Ablauf an setTimeout und der Wanduhr, Tweens sind nur Zierde. Fehlt ein
 * Bild, laeuft die Seite auf Schwarz.
 *
 * Eingehaengt in storySystem.showStoryOverlay (actId 'ending'): die Karte,
 * die nach der Abrechnung bei Thom faellig wird.
 *
 * Debug: ?epilog=<variante> spielt den Epilog beim Betreten des Hubs, ohne
 * den Spielstand anzufassen (docs/debug-modus.md).
 * ===================================================================== */
(function () {
  'use strict';

  var ORDNER = 'assets/sprites/epilog/';
  var V = 1;
  var BILDER = ['presse', 'nebel', 'grab', 'elara_lebt', 'elara_tot', 'rueckkehr',
    'platz_voll', 'platz_leer', 'aldric_erzaehlt', 'aldric_verschwiegen', 'schmiede'];
  // Welcher Absatz (questFinale.epilogTeile) auf welchem Bild steht. Die
  // Verbuendeten-Absaetze haengen am Platz: voll oder leer (s. bildFuer).
  var TEIL_BILD = {
    presse: 'presse', druck: 'presse', nachhall: 'presse', ringThom: 'presse',
    seiteGemerkt: 'presse', seiteGerissen: 'presse', glauben: 'presse',
    nebel: 'nebel',
    harren: 'grab',
    elaraLebt: 'elara_lebt', elaraTot: 'elara_tot',
    zurueck: 'rueckkehr',
    aldricErzaehlt: 'aldric_erzaehlt', aldricVerschwiegen: 'aldric_verschwiegen',
    platten: 'schmiede', plattenZeichen: 'schmiede', erinnert: 'schmiede', namenlos: 'schmiede'
  };
  var PLATZ = ['branka', 'brankaAlt', 'mara', 'maraFort', 'thom',
    'wachtmeisterWahrheit', 'wachtmeisterTrost', 'allein'];
  // Worauf die Kamera zufaehrt (Anteil an Bildbreite/-hoehe).
  var FOKUS = {
    presse: [0.45, 0.55], nebel: [0.5, 0.4], grab: [0.5, 0.7], elara_lebt: [0.45, 0.6],
    elara_tot: [0.5, 0.45], rueckkehr: [0.5, 0.6], platz_voll: [0.5, 0.6],
    platz_leer: [0.5, 0.65], aldric_erzaehlt: [0.5, 0.55], aldric_verschwiegen: [0.5, 0.6],
    schmiede: [0.5, 0.6]
  };
  var TIEFE = 6000;
  var SEITE_ZEICHEN = 190;    // laengere Absaetze an Satzenden teilen
  var SPERRE_MS = 350;        // so lange zaehlt kein Druck (der ausloesende)
  var SEITEN_SPERRE_MS = 200; // nach jedem Blaettern (gegen einen Doppeldruck)
  var VORSPANN_MS = 1400;
  var BILDWECHSEL_MS = 800;
  var AUSKLANG_MS = 450;
  var LADEN_MAX_MS = 5000;
  var MIN_TREFFER = 44;

  var DE = {
    'epilog.titel': 'Epilog',
    'epilog.weiter': 'Weiter',
    'epilog.ueberspringen': 'Überspringen (ESC)',
    'epilog.ueberspringen_mobil': 'Überspringen'
  };
  var EN = {
    'epilog.titel': 'Epilogue',
    'epilog.weiter': 'Continue',
    'epilog.ueberspringen': 'Skip (ESC)',
    'epilog.ueberspringen_mobil': 'Skip'
  };
  if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', DE);
    window.i18n.register('en', EN);
  }
  function _sprache() {
    var I = (typeof window !== 'undefined') ? window.i18n : null;
    return (I && typeof I.getLanguage === 'function' && I.getLanguage() === 'en') ? 'en' : 'de';
  }
  function _t(key) {
    var I = (typeof window !== 'undefined') ? window.i18n : null;
    if (I && typeof I.t === 'function') {
      var s = I.t(key);
      if (s && s !== key && String(s).indexOf('[MISSING') !== 0) return s;
    }
    return (_sprache() === 'en' ? EN : DE)[key] || DE[key] || key;
  }

  function _flags() {
    var qs = window.questSystem;
    return (qs && typeof qs.getFlags === 'function') ? qs.getFlags() : {};
  }

  /** Das Tableau zu einem Absatz. */
  function bildFuer(teil, flags) {
    if (PLATZ.indexOf(teil) >= 0) {
      var QF = window.QuestFinale;
      var st = QF ? QF.computeFinaleState(flags || {}) : { aloneAtEnd: true };
      return st.aloneAtEnd ? 'platz_leer' : 'platz_voll';
    }
    return TEIL_BILD[teil] || 'presse';
  }

  /** Einen langen Absatz an Satzenden in Stuecke bis ~SEITE_ZEICHEN teilen. */
  function _stuecke(text) {
    var AW = window.Aktwechsel;
    if (AW && typeof AW.seitenAus === 'function') {
      return AW.seitenAus(text, function () { return true; }, SEITE_ZEICHEN);
    }
    return [text];
  }

  /**
   * Die Seiten fuer einen Flaggen-Stand: [{ teil, bild, text }]. Jeder Absatz
   * aus questFinale.epilogTeile, lange an Satzenden geteilt.
   */
  function seiten(flags, lang) {
    flags = flags || _flags();
    var QF = window.QuestFinale;
    var teile = (QF && typeof QF.epilogTeile === 'function')
      ? QF.epilogTeile(flags, lang || _sprache())
      : [{ teil: 'nebel', text: lang === 'en' ? 'The fog breaks.' : 'Der Nebel bricht.' }];
    var out = [];
    teile.forEach(function (a) {
      var bild = bildFuer(a.teil, flags);
      _stuecke(a.text).forEach(function (s) { out.push({ teil: a.teil, bild: bild, text: s }); });
    });
    return out;
  }

  function bildKey(n) { return 'epilog_' + n; }

  /** Die gebrauchten Bilder nachladen; fertig() laeuft genau einmal. */
  function laden(scene, namen, fertig) {
    var erledigt = false;
    var los = function () { if (erledigt) return; erledigt = true; fertig(); };
    if (!scene || !scene.load || !scene.textures) { los(); return; }
    var fehlt = namen.filter(function (n) { return !scene.textures.exists(bildKey(n)); });
    if (!fehlt.length) { los(); return; }
    try {
      fehlt.forEach(function (n) { scene.load.image(bildKey(n), ORDNER + bildKey(n) + '.png?v=' + V); });
      scene.load.once('complete', los);
      if (!scene.load.isLoading()) scene.load.start();
    } catch (e) { los(); return; }
    setTimeout(los, LADEN_MAX_MS);
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

  /** Platte aus uiRahmen oder, ohne Messing-Bilder, ein dunkler Kasten. */
  function _platte(scene, c, cx, cy, w, h) {
    var UR = window.uiRahmen;
    var teile = UR && typeof UR.bereit === 'function' && UR.bereit(scene)
      ? UR.platte(scene, cx, cy, w, h, TIEFE + 2, 0.5) : null;
    if (teile) { teile.forEach(function (t) { c.add(t); }); return; }
    var g = scene.add.graphics();
    g.fillStyle(0x1c191f, 0.94).fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
    g.lineStyle(2, 0xa8a090, 0.8).strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
    c.add(g);
  }

  /**
   * Spielt den Epilog. optionen.flags ersetzt den Spielstand (Debug).
   * onDone laeuft einmal, nachdem er ausgeblendet ist und der Zeiger
   * losgelassen wurde. Rueckgabe: ein Griff fuer Aufrufer und Tests.
   */
  function spielen(scene, onDone, optionen) {
    var flags = (optionen && optionen.flags) || _flags();
    var liste = seiten(flags);
    var zustand = { phase: 'laden', seite: -1, bild: null, offen: true, seiten: liste, neu: true };
    zustand.seite = -1;
    if (!scene || !scene.add || !scene.cameras) {
      if (typeof onDone === 'function') onDone();
      return zustand;
    }
    var beendet = false;
    var uhren = [];
    var abmelden = [];
    var c = null;
    function spaeter(ms, fn) { uhren.push(setTimeout(function () { if (!beendet) fn(); }, ms)); }
    function tween(cfg) { try { return scene.tweens.add(cfg); } catch (e) { return null; } }

    try { if (typeof window.pauseGameClock === 'function') window.pauseGameClock(scene); } catch (e) {}
    scene.__epilog = zustand;

    function beiShutdown() { aufraeumen(); }
    try {
      scene.events.once('shutdown', beiShutdown);
      abmelden.push(function () { scene.events.off('shutdown', beiShutdown); });
    } catch (e) {}

    function aufraeumen() {
      if (beendet) return false;
      beendet = true;
      zustand.offen = false;
      zustand.phase = 'fertig';
      uhren.forEach(function (u) { try { clearTimeout(u); } catch (e) {} });
      if (zustand.lauf) { try { zustand.lauf.abbrechen(); } catch (e) {} }
      abmelden.forEach(function (f) { try { f(); } catch (e) {} });
      if (c) { try { c.destroy(true); } catch (e) {} }
      try { if (typeof window.resumeGameClock === 'function') window.resumeGameClock(scene); } catch (e) {}
      if (scene.__epilog === zustand) scene.__epilog = null;
      return true;
    }

    var cam = scene.cameras.main;
    var w = cam.width, h = cam.height;
    c = scene.add.container(0, 0).setDepth(TIEFE).setName('epilog');
    var grund = scene.add.rectangle(w / 2, h / 2, w + 40, h + 40, 0x000000, 1).setName('epilogGrund');
    c.add(grund);
    var bildEbene = scene.add.container(0, 0);
    c.add(bildEbene);
    _fest(c);

    var ab = Date.now() + SPERRE_MS;
    function scharf() { return Date.now() >= ab; }

    try {
      var kb = scene.input && scene.input.keyboard;
      if (kb && typeof kb.on === 'function') {
        var beiTaste = function (ev) {
          if (ev && (ev.key === 'Escape' || ev.keyCode === 27)) { ueberspringen(); return; }
          if (ev && ev.repeat) return;
          weiter();
        };
        kb.on('keydown', beiTaste);
        abmelden.push(function () { kb.off('keydown', beiTaste); });
      }
    } catch (e) {}
    grund.setInteractive();
    grund.on('pointerdown', function () { weiter(); });

    var plattenC = null, erzaehl = null, hinweis = null;
    var tpY = 0, tpH = 0, textMaxH = 0;

    function aufbauen() {
      zustand.phase = 'vorspann';
      var titel = scene.add.text(w / 2, 16, _t('epilog.titel'), {
        fontFamily: 'serif', fontSize: 26, color: '#f1e9d8', fontStyle: 'bold'
      }).setOrigin(0.5, 0);
      titel.setName('epilogTitel');
      var plW = Math.min(w - 32, titel.width + 80), plH = titel.height + 24;
      var kopfC = scene.add.container(0, 0);
      _platte(scene, kopfC, w / 2, 8 + plH / 2, plW, plH);
      titel.y = 8 + 12;
      kopfC.add(titel);
      c.add(kopfC);
      zustand.titel = kopfC;

      var skipText = scene.add.text(0, 0, _t(_mobil(scene) ? 'epilog.ueberspringen_mobil' : 'epilog.ueberspringen'), {
        fontFamily: 'monospace', fontSize: 14, color: '#e6dcc6'
      }).setOrigin(0.5);
      var skipW = Math.max(110, skipText.width + 28), skipH = MIN_TREFFER;
      var skipX = w - 16 - skipW / 2, skipY = 8 + skipH / 2;
      if (skipX - skipW / 2 < w / 2 + plW / 2 + 8) skipY = 8 + plH + 8 + skipH / 2;
      var UR = window.uiRahmen;
      var kachel = UR && typeof UR.kachelBild === 'function' && UR.bereit && UR.bereit(scene)
        ? UR.kachelBild(scene, skipW, skipH) : null;
      var skipFeld = kachel ? scene.add.image(skipX, skipY, kachel)
        : scene.add.rectangle(skipX, skipY, skipW, skipH, 0x1c191f, 0.9).setStrokeStyle(1, 0xa8a090, 0.8);
      skipFeld.setName('epilogUeberspringen');
      skipText.setPosition(skipX, skipY);
      c.add(skipFeld);
      c.add(skipText);
      skipFeld.setInteractive({ useHandCursor: true });
      skipFeld.on('pointerdown', function (p, x, y, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        ueberspringen();
      });

      plattenC = scene.add.container(0, 0);
      c.add(plattenC);
      var tpW = Math.min(780, w - 32);
      tpH = Math.min(112, Math.round(h * 0.26));
      tpY = h - 16 - tpH / 2;
      _platte(scene, plattenC, w / 2, tpY, tpW, tpH);
      hinweis = scene.add.text(w / 2 + tpW / 2 - 26, tpY + tpH / 2 - 12, _t('epilog.weiter'), {
        fontFamily: 'monospace', fontSize: 14, color: '#c8bca4'
      }).setOrigin(1, 1).setName('epilogWeiter').setVisible(false);
      erzaehl = scene.add.text(w / 2, 0, '', {
        fontFamily: 'serif', fontSize: 19, color: '#f1e9d8', align: 'center',
        wordWrap: { width: tpW - 72 }, lineSpacing: 5
      }).setOrigin(0.5, 0).setName('epilogText');
      textMaxH = tpH - 28 - 12 - hinweis.height;
      plattenC.add(erzaehl);
      plattenC.add(hinweis);
      tween({ targets: hinweis, alpha: { from: 1, to: 0.5 }, duration: 900, yoyo: true, repeat: -1 });
      _fest(c);

      bildZeigen(liste[0].bild);
      plattenC.setAlpha(0);
      uhren.push(setTimeout(vorspannEnde, VORSPANN_MS));
    }

    function vorspannEnde() {
      if (beendet || zustand.phase !== 'vorspann') return;
      zustand.phase = 'text';
      plattenC.setAlpha(1);
      plattenC.y = 12;
      tween({ targets: plattenC, y: 0, duration: 400, ease: 'Sine.easeOut' });
      seiteZeigen(0);
    }

    // Ein Tableau ueber das alte blenden; es faehrt langsam auf den Fokus zu.
    function bildZeigen(name) {
      if (zustand.bild === name) return;
      zustand.bild = name;
      var key = bildKey(name);
      var alte = bildEbene.list.slice();
      if (alte.length && zustand.titel) {
        var t = zustand.titel; zustand.titel = null;
        tween({ targets: t, alpha: 0, duration: 600 });
      }
      if (!scene.textures.exists(key)) {
        alte.forEach(function (o) { tween({ targets: o, alpha: 0, duration: BILDWECHSEL_MS }); });
        return;
      }
      var f = FOKUS[name] || [0.5, 0.5];
      var bild = scene.add.image(0, 0, key).setName('epilogBild');
      // Oben buendig, nur ein Stueck unter die Textplatte: was unten im Bild
      // liegt (Grabplatte, Figuren), bleibt sichtbar.
      var sichtH = h - 16 - tpH * 0.6;
      var basis = Math.max(w / bild.width, sichtH / bild.height);
      bild.setOrigin(f[0], f[1]).setScale(basis).setAlpha(0).setScrollFactor(0);
      bild.setPosition(w / 2 + (f[0] - 0.5) * bild.width * basis, f[1] * bild.height * basis);
      bildEbene.add(bild);
      tween({ targets: bild, alpha: 1, duration: BILDWECHSEL_MS });
      tween({ targets: bild, scale: basis * 1.12, duration: 22000, ease: 'Sine.easeOut' });
      spaeter(BILDWECHSEL_MS + 50, function () {
        alte.forEach(function (o) { try { o.destroy(); } catch (e) {} });
      });
    }

    function seiteZeigen(n) {
      zustand.seite = n;
      var s = liste[n];
      bildZeigen(s.bild);
      if (zustand.lauf) { try { zustand.lauf.abbrechen(); } catch (e) {} zustand.lauf = null; }
      // Erst voll setzen und vermessen (passt es nicht, kleiner), dann aufbauen.
      erzaehl.setFontSize(19);
      erzaehl.setText(s.text);
      while (erzaehl.height > textMaxH && parseFloat(erzaehl.style.fontSize) > 13) {
        erzaehl.setFontSize(parseFloat(erzaehl.style.fontSize) - 1);
      }
      var oben = tpY - tpH / 2 + 18;
      erzaehl.y = oben + Math.max(0, Math.floor((textMaxH - erzaehl.height) / 2));
      hinweis.setVisible(false);
      var fertig = function () { if (!beendet && zustand.seite === n) hinweis.setVisible(true); };
      var TW = window.DialogTypewriter;
      if (TW && typeof TW.anTextobjekt === 'function') {
        zustand.lauf = TW.anTextobjekt(scene, erzaehl, s.text, { sprecher: '', onFertig: fertig, wanduhr: true });
      } else {
        fertig();
      }
      ab = Date.now() + SEITEN_SPERRE_MS;
    }

    function weiter() {
      if (beendet || zustand.phase === 'ausklang' || !scharf()) return;
      if (zustand.phase === 'laden') return;
      if (zustand.phase === 'vorspann') { vorspannEnde(); return; }
      if (zustand.lauf && zustand.lauf.laeuft()) { zustand.lauf.ueberspringen(); return; }
      if (zustand.seite + 1 < liste.length) { seiteZeigen(zustand.seite + 1); return; }
      ausklang();
    }
    function ueberspringen() {
      if (beendet || zustand.phase === 'ausklang') return;
      ausklang();
    }

    function ausklang() {
      zustand.phase = 'ausklang';
      if (zustand.lauf) { try { zustand.lauf.ueberspringen(); } catch (e) {} }
      try { grund.disableInteractive(); } catch (e) {}
      tween({ targets: c, alpha: 0, duration: AUSKLANG_MS });
      setTimeout(function () {
        if (!aufraeumen()) return;
        // Der Zeiger, der den Epilog beendet hat, soll nicht im Hub loslassen.
        var bis = Date.now() + 2000;
        var warten = function () {
          var p = scene.input && scene.input.activePointer;
          if (p && p.isDown && Date.now() < bis) { setTimeout(warten, 50); return; }
          if (typeof onDone === 'function') onDone();
        };
        warten();
      }, AUSKLANG_MS);
    }

    // Nur die Bilder dieser Fassung laden; sind sie schon da, sofort aufbauen.
    var gebraucht = [];
    liste.forEach(function (s) { if (gebraucht.indexOf(s.bild) < 0) gebraucht.push(s.bild); });
    zustand.bilder = gebraucht;
    laden(scene, gebraucht, function () { if (!beendet) aufbauen(); });

    zustand.weiter = weiter;
    zustand.ueberspringen = ueberspringen;
    return zustand;
  }

  // ---- Debug ?epilog=<variante> -------------------------------------------
  // Bausteine, mit Komma kombinierbar (?epilog=tot,grab,allein,verschwiegen).
  // Ohne Baustein fuer Elara entscheidet computeFinaleState wie im Spiel;
  // ?epilog=1 nimmt den Spielstand, wie er ist.
  var VARIANTEN = {
    lebt: { elara_spared: true },
    tot: { elara_killed: true },
    grab: { harren_dead: true },
    verbuendete: { verification_refused: true, petitions_kept: true, thom_ally: true },
    allein: {},
    erzaehlt: { aldric_erzaehlt: true },
    verschwiegen: { aldric_verschwiegen: true },
    erinnert: { self_remembered: true }
  };

  /** Flaggen fuer eine Debug-Variante; null, wenn sie den Spielstand meint. */
  function variantenFlags(wert) {
    var w = String(wert || '').trim().toLowerCase();
    if (!w || w === '1' || w === 'stand') return null;
    var flags = {};
    w.split(/[,+ ]+/).forEach(function (n) {
      var v = VARIANTEN[n];
      if (v) Object.keys(v).forEach(function (k) { flags[k] = v[k]; });
    });
    return flags;
  }

  var _vorschauGespielt = false;
  function vorschau(scene) {
    var G = window.DebugGate;
    var v = (G && typeof G.flagge === 'function') ? G.flagge('epilog') : null;
    if (_vorschauGespielt || !v || v === '0') return false;
    _vorschauGespielt = true;
    try { (window.SlotStorage || window.localStorage).setItem('demonfall_seen_intro_splash', '1'); } catch (e) {}
    var flags = variantenFlags(v);
    var los = function () {
      var karte = scene.children && typeof scene.children.getByName === 'function' && scene.children.getByName('aktwechsel');
      if (karte && karte.active) { setTimeout(los, 400); return; }
      scene._dialogOpen = true;
      spielen(scene, function () { scene._dialogOpen = false; }, flags ? { flags: flags } : null);
    };
    setTimeout(los, 600);
    return true;
  }

  window.EpilogSzene = {
    BILDER: BILDER, FOKUS: FOKUS, VARIANTEN: VARIANTEN,
    spielen: spielen, seiten: seiten, bildFuer: bildFuer, laden: laden,
    vorschau: vorschau, variantenFlags: variantenFlags, bildKey: bildKey
  };
})();
