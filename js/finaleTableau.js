/* =====================================================================
 * finaleTableau.js — Pixel-Tableaus fuer die wichtigsten Momente an der Esse
 * ---------------------------------------------------------------------
 * Die Sprechblasen (finaleBlasen.js) tragen das Finale weiter; an acht
 * Stellen haelt es fuer ein Bild an (PixelLab, 384x192, Stil wie
 * «Das Wiedersehen», assets/sprites/finale/):
 *
 *   vor dem Kampf   hammer   der Hammer ueber der Bindung (die Erkenntnis)
 *                   lene     Harren ruft sie, sie zoegert
 *                   stoss    sie stoesst ihn weg
 *                   esse     die Esse nimmt sie
 *   nach dem Kampf  bruch    die Esse zerbricht, die Lichter steigen auf
 *                   urteil   Mara verlangt das Urteil
 *                   verschonen / richten   die Wahl
 *
 * Bedienung wie in jeder Zwischenszene: das Bild faehrt langsam heran, unten
 * baut sich eine Zeile Wort fuer Wort auf; die erste Taste (oder ein Klick)
 * zeigt sie ganz, die naechste geht weiter. ESC oder "Ueberspringen" beendet
 * das Bild sofort. Die Spieluhr steht, eventChoiceOpen sperrt die Angriffe;
 * der Ablauf haengt darum an setTimeout und der Wanduhr.
 *
 * Fehlt ein Bild (nicht geladen), laeuft das Finale ohne dieses Tableau
 * weiter: die Blasen erzaehlen dasselbe.
 * ===================================================================== */
(function () {
  'use strict';

  var ORDNER = 'assets/sprites/finale/';
  var V = 1;
  var BILDER = ['hammer', 'lene', 'stoss', 'esse', 'bruch', 'urteil', 'verschonen', 'richten'];
  // Worauf die Kamera zufaehrt (Anteil an Bildbreite/-hoehe).
  var FOKUS = {
    hammer: [0.5, 0.5], lene: [0.5, 0.55], stoss: [0.5, 0.55], esse: [0.5, 0.5],
    bruch: [0.5, 0.4], urteil: [0.5, 0.6], verschonen: [0.5, 0.6], richten: [0.5, 0.55]
  };
  // Wer spricht (leer = Erzaehlung).
  var SPRECHER = {};
  var TIEFE = 6000;
  var SPERRE_MS = 350;      // so lange zaehlt kein Druck (der ausloesende)
  var BILDWECHSEL_MS = 600;
  var AUSKLANG_MS = 400;
  var LADEN_MAX_MS = 5000;  // laedt ein Bild nicht, geht es ohne weiter
  var MIN_TREFFER = 44;

  var DE = {
    'finaleTableau.weiter': 'Weiter',
    'finaleTableau.ueberspringen': 'Überspringen (ESC)',
    'finaleTableau.ueberspringen_mobil': 'Überspringen',
    'finaleTableau.hammer': '(Der Hammer über der Bindung. Deine Hände wissen den Weg.)',
    'finaleTableau.lene': '(Vater und Tochter. Zwischen ihnen nur die Glut.)',
    'finaleTableau.stoss': '(Sie sieht nicht weg.)',
    'finaleTableau.esse': '(Die Glut antwortet. Und sie nimmt sie.)',
    'finaleTableau.bruch': '(Die Esse bricht. Und was sie hielt, steigt auf.)',
    'finaleTableau.urteil': '(Mara kommt die Stufen herab. Elara kniet. Die Klinge liegt in Deiner Hand.)',
    'finaleTableau.verschonen': '(Du lässt die Klinge sinken. Sie lebt.)',
    'finaleTableau.richten': '(Sie senkt den Kopf. Du hebst die Klinge.)'
  };
  var EN = {
    'finaleTableau.weiter': 'Continue',
    'finaleTableau.ueberspringen': 'Skip (ESC)',
    'finaleTableau.ueberspringen_mobil': 'Skip',
    'finaleTableau.hammer': '(The hammer above the binding. Your hands know the way.)',
    'finaleTableau.lene': '(Father and daughter. Nothing between them but the embers.)',
    'finaleTableau.stoss': '(She does not look away.)',
    'finaleTableau.esse': '(The embers answer. And they take her.)',
    'finaleTableau.bruch': '(The Furnace breaks. And what it held rises.)',
    'finaleTableau.urteil': '(Mara comes down the steps. Elara kneels. The blade is in your hand.)',
    'finaleTableau.verschonen': '(You lower the blade. She lives.)',
    'finaleTableau.richten': '(She bows her head. You raise the blade.)'
  };
  if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', DE);
    window.i18n.register('en', EN);
  }
  function _t(key) {
    var I = (typeof window !== 'undefined') ? window.i18n : null;
    if (I && typeof I.t === 'function') {
      var s = I.t(key);
      if (s && s !== key && String(s).indexOf('[MISSING') !== 0) return s;
    }
    var en = !!(I && typeof I.getLanguage === 'function' && I.getLanguage() === 'en');
    return (en ? EN : DE)[key] || DE[key] || key;
  }

  function bildKey(n) { return 'finale_tableau_' + n; }
  function text(n) { return _t('finaleTableau.' + n); }

  /** Fehlende Bilder nachladen; fertig() laeuft genau einmal (auch ohne Bilder). */
  function laden(scene, fertig) {
    var erledigt = false;
    var los = function () { if (erledigt) return; erledigt = true; if (typeof fertig === 'function') fertig(); };
    if (!scene || !scene.load || !scene.textures) { los(); return; }
    var fehlt = BILDER.filter(function (n) { return !scene.textures.exists(bildKey(n)); });
    if (!fehlt.length) { los(); return; }
    try {
      fehlt.forEach(function (n) { scene.load.image(bildKey(n), ORDNER + 'tableau_' + n + '.png?v=' + V); });
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
   * Zeigt ein Tableau. fertig() laeuft genau einmal: nach dem Ausblenden und
   * wenn der Zeiger losgelassen ist (die naechste Blase waehlt sonst mit),
   * oder sofort, wenn das Bild fehlt. Rueckgabe: ein Griff (auch fuer Tests)
   * oder null ohne Bild.
   */
  function zeigen(scene, name, fertig) {
    var einmal = false;
    var danach = function () { if (einmal) return; einmal = true; if (typeof fertig === 'function') fertig(); };
    if (!scene || !scene.add || !scene.cameras || !scene.textures || BILDER.indexOf(name) < 0) { danach(); return null; }
    if (!scene.textures.exists(bildKey(name))) {
      // Noch nicht geladen: kurz warten (laden() lief schon beim Aufbau der Buehne).
      laden(scene, function () {
        if (scene.sys && scene.sys.isActive && !scene.sys.isActive()) { danach(); return; }
        if (scene.textures.exists(bildKey(name))) zeigen(scene, name, danach);
        else danach();
      });
      return null;
    }
    if (scene.__finaleTableau) scene.__finaleTableau.ueberspringen();

    var zustand = { name: name, phase: 'text', offen: true, text: text(name), sprecher: SPRECHER[name] || '' };
    var beendet = false;
    var uhren = [];
    var abmelden = [];
    function tween(cfg) { try { return scene.tweens.add(cfg); } catch (e) { return null; } }

    try { if (typeof window.pauseGameClock === 'function') window.pauseGameClock(scene); } catch (e) {}
    scene._eventChoiceActive = true;
    window.eventChoiceOpen = true;   // sperrt Angriffe durch das Bild hindurch
    scene.__finaleTableau = zustand;

    function aufraeumen() {
      if (beendet) return false;
      beendet = true;
      zustand.offen = false;
      zustand.phase = 'fertig';
      uhren.forEach(function (u) { try { clearTimeout(u); } catch (e) {} });
      if (zustand.lauf) { try { zustand.lauf.abbrechen(); } catch (e) {} }
      abmelden.forEach(function (f) { try { f(); } catch (e) {} });
      try { c.destroy(true); } catch (e) {}
      if (scene.__finaleTableau === zustand) scene.__finaleTableau = null;
      scene._eventChoiceActive = false;
      window.eventChoiceOpen = false;
      try { if (typeof window.resumeGameClock === 'function') window.resumeGameClock(scene); } catch (e) {}
      return true;
    }
    // Endet die Szene mittendrin (Raumwechsel, Tod), nur aufraeumen.
    var beiShutdown = function () { aufraeumen(); };
    try {
      scene.events.once('shutdown', beiShutdown);
      abmelden.push(function () { scene.events.off('shutdown', beiShutdown); });
    } catch (e) {}

    var cam = scene.cameras.main;
    var w = cam.width, h = cam.height;
    var c = scene.add.container(0, 0).setDepth(TIEFE).setName('finaleTableau');
    var grund = scene.add.rectangle(w / 2, h / 2, w + 40, h + 40, 0x000000, 1).setName('finaleTableauGrund');
    c.add(grund);

    // Textplatte unten; das Bild steht darueber und reicht nur ein Stueck darunter.
    var tpW = Math.min(780, w - 32);
    var tpH = Math.min(96, Math.round(h * 0.22));
    var tpY = h - 16 - tpH / 2;

    var f = FOKUS[name] || [0.5, 0.5];
    var bild = scene.add.image(0, 0, bildKey(name)).setName('finaleTableauBild');
    var sichtH = h - 16 - tpH * 0.6;
    var basis = Math.max(w / bild.width, sichtH / bild.height);
    bild.setOrigin(f[0], f[1]).setScale(basis).setAlpha(0);
    bild.setPosition(w / 2 + (f[0] - 0.5) * bild.width * basis, f[1] * bild.height * basis);
    c.add(bild);
    zustand.bild = bild;
    tween({ targets: bild, alpha: 1, duration: BILDWECHSEL_MS });
    tween({ targets: bild, scale: basis * 1.1, duration: 16000, ease: 'Sine.easeOut' });

    var plattenC = scene.add.container(0, 0);
    c.add(plattenC);
    _platte(scene, plattenC, w / 2, tpY, tpW, tpH);
    var sprecherText = scene.add.text(w / 2 - tpW / 2 + 30, tpY - tpH / 2 + 12, zustand.sprecher, {
      fontFamily: 'serif', fontSize: 16, color: '#d4a543', fontStyle: 'bold'
    }).setName('finaleTableauSprecher');
    var hinweis = scene.add.text(w / 2 + tpW / 2 - 26, tpY + tpH / 2 - 10, _t('finaleTableau.weiter'), {
      fontFamily: 'monospace', fontSize: 14, color: '#c8bca4'
    }).setOrigin(1, 1).setName('finaleTableauWeiter').setVisible(false);
    var erzaehl = scene.add.text(w / 2, 0, '', {
      fontFamily: 'serif', fontSize: 19, color: zustand.sprecher ? '#f1e9d8' : '#cfc4ad', align: 'center',
      fontStyle: zustand.sprecher ? '' : 'italic', wordWrap: { width: tpW - 72 }, lineSpacing: 5
    }).setOrigin(0.5, 0).setName('finaleTableauText');
    plattenC.add([sprecherText, erzaehl, hinweis]);
    tween({ targets: hinweis, alpha: { from: 1, to: 0.5 }, duration: 900, yoyo: true, repeat: -1 });

    // Ueberspringen oben rechts.
    var skipText = scene.add.text(0, 0, _t(_mobil(scene) ? 'finaleTableau.ueberspringen_mobil' : 'finaleTableau.ueberspringen'), {
      fontFamily: 'monospace', fontSize: 14, color: '#e6dcc6'
    }).setOrigin(0.5);
    var skipW = Math.max(110, skipText.width + 28), skipH = MIN_TREFFER;
    var skipX = w - 16 - skipW / 2, skipY = 8 + skipH / 2;
    var UR = window.uiRahmen;
    var kachel = UR && typeof UR.kachelBild === 'function' && UR.bereit && UR.bereit(scene)
      ? UR.kachelBild(scene, skipW, skipH) : null;
    var skipFeld = kachel ? scene.add.image(skipX, skipY, kachel)
      : scene.add.rectangle(skipX, skipY, skipW, skipH, 0x1c191f, 0.9).setStrokeStyle(1, 0xa8a090, 0.8);
    skipFeld.setName('finaleTableauUeberspringen');
    skipText.setPosition(skipX, skipY);
    c.add([skipFeld, skipText]);
    _fest(c);

    // Erst voll setzen und vermessen (passt es nicht, kleiner), dann aufbauen.
    var textMaxH = tpH - 24 - hinweis.height;
    erzaehl.setText(zustand.text);
    while (erzaehl.height > textMaxH && parseFloat(erzaehl.style.fontSize) > 13) {
      erzaehl.setFontSize(parseFloat(erzaehl.style.fontSize) - 1);
    }
    var oben = tpY - tpH / 2 + 14 + (zustand.sprecher ? 12 : 0);
    erzaehl.y = oben + Math.max(0, Math.floor((textMaxH - (zustand.sprecher ? 12 : 0) - erzaehl.height) / 2));
    var fertigGeschrieben = function () { if (!beendet) hinweis.setVisible(true); };
    var TW = window.DialogTypewriter;
    if (TW && typeof TW.anTextobjekt === 'function') {
      zustand.lauf = TW.anTextobjekt(scene, erzaehl, zustand.text, { sprecher: zustand.sprecher, onFertig: fertigGeschrieben, wanduhr: true });
    } else {
      fertigGeschrieben();
    }

    var ab = Date.now() + SPERRE_MS;
    function weiter() {
      if (beendet || zustand.phase === 'ausklang' || Date.now() < ab) return;
      // Erste Taste: die Zeile ganz zeigen. Naechste: weiter.
      if (zustand.lauf && zustand.lauf.laeuft()) { zustand.lauf.ueberspringen(); return; }
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
      uhren.push(setTimeout(function () {
        if (!aufraeumen()) return;
        // Der Zeiger, der das Bild beendet hat, soll nicht auf der naechsten
        // Blase loslassen.
        var bis = Date.now() + 2000;
        var warten = function () {
          var p = scene.input && scene.input.activePointer;
          if (p && p.isDown && Date.now() < bis) { setTimeout(warten, 50); return; }
          danach();
        };
        warten();
      }, AUSKLANG_MS));
    }

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
    bild.setInteractive();
    bild.on('pointerdown', function () { weiter(); });
    skipFeld.setInteractive({ useHandCursor: true });
    skipFeld.on('pointerdown', function (p, x, y, ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      ueberspringen();
    });

    zustand.weiter = weiter;
    zustand.ueberspringen = ueberspringen;
    zustand.container = c;
    return zustand;
  }

  /** Steht gerade ein Tableau? */
  function aktiv(scene) { return (scene && scene.__finaleTableau) || null; }

  window.FinaleTableau = {
    BILDER: BILDER, FOKUS: FOKUS, ORDNER: ORDNER,
    zeigen: zeigen, laden: laden, aktiv: aktiv, bildKey: bildKey, text: text
  };
})();
