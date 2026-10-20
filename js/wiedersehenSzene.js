/* =====================================================================
 * wiedersehenSzene.js — «Das Wiedersehen» als Zwischenszene (#155, Ende Akt 2)
 * ---------------------------------------------------------------------
 * Harren sieht seine Tochter wieder, und der Spieler erfaehrt, wer Elara ist.
 * Story v6, Akt 2 Schritt 7: Beim Wiedersehen zoegert sie einen Atemzug zu
 * lang, und ihm erzaehlt sie, sie sei aus eigenem Willen geflohen. Harren
 * will es glauben.
 *
 * Drei Tableaus (PixelLab, assets/sprites/wiedersehen/), jedes faehrt langsam
 * heran, unten baut sich der Text Wort fuer Wort auf:
 *   licht     Harren am Abend, das Licht im Fenster, eine alte Kinderzeichnung
 *   zoegern   Elara in der Tuer: er breitet die Arme aus, sie bleibt stehen
 *   umarmung  er haelt sie; ihr Blick geht ueber seine Schulter hinweg zur Tuer
 *             (die leise Spur fuer Aufmerksame, nur im Bild, nicht im Text)
 *
 * Steuerung wie in jedem Dialog: die erste Taste (oder ein Klick) zeigt den
 * Satz ganz, die naechste blaettert weiter. ESC oder "Ueberspringen" beendet
 * die Szene bewusst. Danach erst kommt Harrens Frage (storyDialog
 * 'wiedersehen'); kein Druck aus der Szene waehlt dort etwas aus: das Ende
 * blendet aus und wartet, bis der Zeiger losgelassen ist.
 *
 * Die Spieluhr steht, solange die Szene laeuft. Darum haengt der Ablauf an
 * setTimeout und der Aufbau auf der Wanduhr (pauseGameClock friert scene.time
 * ein); Tweens sind nur Zierde. Fehlt ein Bild, laeuft die Szene auf Schwarz.
 *
 * Debug: ?wiedersehen=1 spielt die Szene beim Betreten des Hubs, ohne den
 * Spielstand anzufassen (docs/debug-modus.md).
 * ===================================================================== */
(function () {
  'use strict';

  var ORDNER = 'assets/sprites/wiedersehen/';
  var V = 1;
  var BILDER = ['licht', 'zoegern', 'umarmung'];
  // Worauf die Kamera zufaehrt (Anteil an Bildbreite/-hoehe).
  var FOKUS = { licht: [0.62, 0.72], zoegern: [0.5, 0.7], umarmung: [0.5, 0.5] };
  // So weit (Anteil der Bildhoehe) ruecken die Bilder nach oben: was unten
  // liegt (Zeichnung, Fuesse), soll ueber der Textplatte stehen.
  var HOCH = { licht: 0.12, zoegern: 0.1, umarmung: 0.04 };
  var TIEFE = 6000;
  var SPERRE_MS = 350;     // so lange zaehlt kein Druck (der ausloesende)
  var SEITEN_SPERRE_MS = 200; // nach jedem Blaettern (gegen einen Doppeldruck)
  var VORSPANN_MS = 1400;  // so lange steht das erste Bild allein
  var BILDWECHSEL_MS = 800;
  var AUSKLANG_MS = 450;
  var LADEN_MAX_MS = 5000; // laedt ein Bild nicht, spielt die Szene ohne es
  var MIN_TREFFER = 44;

  var DE = {
    'wiedersehen.titel': 'Das Wiedersehen',
    'wiedersehen.weiter': 'Weiter',
    'wiedersehen.ueberspringen': 'Überspringen (ESC)',
    'wiedersehen.ueberspringen_mobil': 'Überspringen',
    'wiedersehen.1': '(Spät am Abend. Im Fenster des Bürgermeisters brennt ein Licht, wie jeden Abend.)',
    'wiedersehen.2': '(Harren hält eine alte Kinderzeichnung. Ein Haus, ein Fenster, ein Licht darin. Darunter, in krummen Buchstaben: LENE.)',
    'wiedersehen.3': 'Jeden Abend lasse ich es brennen. Damit sie den Weg nach Hause findet.',
    'wiedersehen.4': '(Schritte auf der Treppe. Eine Gestalt in der Tür. Die Kapuze fällt. Es ist Elara.)',
    'wiedersehen.5': 'Lene.',
    'wiedersehen.6': '(Er breitet die Arme aus. Sie bleibt stehen. Einen Atemzug zu lang.)',
    'wiedersehen.7': '(Dann liegt sie in seinen Armen.)',
    'wiedersehen.8': 'Ich bin fortgegangen, Vater. Aus eigenem Willen. Niemand hat mich geholt.',
    'wiedersehen.9': 'Aus eigenem Willen. Ja. So muss es gewesen sein.',
    'wiedersehen.10': 'Und ich kann nicht bleiben, noch nicht.',
    'wiedersehen.11': '(Er hält sie fest, als könnte sie wieder im Nebel verschwinden.)'
  };
  var EN = {
    'wiedersehen.titel': 'The Reunion',
    'wiedersehen.weiter': 'Continue',
    'wiedersehen.ueberspringen': 'Skip (ESC)',
    'wiedersehen.ueberspringen_mobil': 'Skip',
    'wiedersehen.1': '(Late in the evening. A light burns in the mayor\'s window, as it does every evening.)',
    'wiedersehen.2': '(Harren holds an old child\'s drawing. A house, a window, a light inside. Beneath it, in crooked letters: LENE.)',
    'wiedersehen.3': 'Every evening I keep it burning. So that she finds her way home.',
    'wiedersehen.4': '(Footsteps on the stairs. A figure in the doorway. The hood falls. It is Elara.)',
    'wiedersehen.5': 'Lene.',
    'wiedersehen.6': '(He opens his arms. She stays where she is. One breath too long.)',
    'wiedersehen.7': '(Then she is in his arms.)',
    'wiedersehen.8': 'I left, Father. Of my own will. Nobody took me.',
    'wiedersehen.9': 'Of your own will. Yes. That must be how it was.',
    'wiedersehen.10': 'And I cannot stay, not yet.',
    'wiedersehen.11': '(He holds her tight, as if she might vanish into the fog again.)'
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

  // Die Seiten: welches Bild, wer spricht (leer = Erzaehlung), welcher Text.
  var ABLAUF = [
    ['licht', '', 1], ['licht', '', 2], ['licht', 'HARREN', 3],
    ['zoegern', '', 4], ['zoegern', 'HARREN', 5], ['zoegern', '', 6],
    ['umarmung', '', 7], ['umarmung', 'ELARA', 8], ['umarmung', 'HARREN', 9],
    ['umarmung', 'ELARA', 10], ['umarmung', '', 11]
  ];
  function seiten() {
    return ABLAUF.map(function (a) { return { bild: a[0], sprecher: a[1], text: _t('wiedersehen.' + a[2]) }; });
  }

  function bildKey(n) { return 'wiedersehen_' + n; }

  /** Fehlende Bilder nachladen; fertig() laeuft genau einmal (auch ohne Bilder). */
  function laden(scene, fertig) {
    var erledigt = false;
    var los = function () { if (erledigt) return; erledigt = true; fertig(); };
    if (!scene || !scene.load || !scene.textures) { los(); return; }
    var fehlt = BILDER.filter(function (n) { return !scene.textures.exists(bildKey(n)); });
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
   * Spielt die Szene. onDone laeuft einmal, nachdem sie ausgeblendet ist und
   * der Zeiger losgelassen wurde. Rueckgabe: ein Griff fuer Tests.
   */
  function spielen(scene, onDone) {
    var zustand = { phase: 'laden', seite: -1, bild: null, offen: true };
    var liste = seiten();
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
    scene.__wiedersehen = zustand;

    // Endet die Hub-Szene mittendrin, nur aufraeumen (kein onDone).
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
      if (scene.__wiedersehen === zustand) scene.__wiedersehen = null;
      return true;
    }

    var cam = scene.cameras.main;
    var w = cam.width, h = cam.height;
    c = scene.add.container(0, 0).setDepth(TIEFE).setName('wiedersehen');
    // Schwarzer Grund = Trefferflaeche fuer "weiter" (Klick/Tippen irgendwo).
    var grund = scene.add.rectangle(w / 2, h / 2, w + 40, h + 40, 0x000000, 1).setName('wiedersehenGrund');
    c.add(grund);
    var bildEbene = scene.add.container(0, 0);
    c.add(bildEbene);
    _fest(c);

    var ab = Date.now() + SPERRE_MS;
    function scharf() { return Date.now() >= ab; }

    // --- Steuerung (sofort, damit ESC auch beim Laden wirkt) -----------------
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

    var plattenC = null, sprecherText = null, erzaehl = null, hinweis = null;
    var tpY = 0, tpH = 0, textMaxH = 0;
    var vorspann = null;

    function aufbauen() {
      zustand.phase = 'vorspann';
      // ---- Titel oben, Ueberspringen oben rechts ----
      var titel = scene.add.text(w / 2, 16, _t('wiedersehen.titel'), {
        fontFamily: 'serif', fontSize: 26, color: '#f1e9d8', fontStyle: 'bold'
      }).setOrigin(0.5, 0);
      titel.setName('wiedersehenTitel');
      var plW = Math.min(w - 32, titel.width + 80), plH = titel.height + 24;
      var kopfC = scene.add.container(0, 0);
      _platte(scene, kopfC, w / 2, 8 + plH / 2, plW, plH);
      titel.y = 8 + 12;
      kopfC.add(titel);
      c.add(kopfC);
      // Der Titel geht, sobald das zweite Bild kommt: dann zaehlt nur noch das Bild.
      zustand.titel = kopfC;

      var skipText = scene.add.text(0, 0, _t(_mobil(scene) ? 'wiedersehen.ueberspringen_mobil' : 'wiedersehen.ueberspringen'), {
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
      skipFeld.setName('wiedersehenUeberspringen');
      skipText.setPosition(skipX, skipY);
      c.add(skipFeld);
      c.add(skipText);
      skipFeld.setInteractive({ useHandCursor: true });
      skipFeld.on('pointerdown', function (p, x, y, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        ueberspringen();
      });

      // ---- Textplatte unten ----
      plattenC = scene.add.container(0, 0);
      c.add(plattenC);
      var tpW = Math.min(780, w - 32);
      tpH = Math.min(112, Math.round(h * 0.26));
      tpY = h - 16 - tpH / 2;
      _platte(scene, plattenC, w / 2, tpY, tpW, tpH);
      sprecherText = scene.add.text(w / 2 - tpW / 2 + 30, tpY - tpH / 2 + 14, '', {
        fontFamily: 'serif', fontSize: 16, color: '#d4a543', fontStyle: 'bold'
      }).setName('wiedersehenSprecher');
      hinweis = scene.add.text(w / 2 + tpW / 2 - 26, tpY + tpH / 2 - 12, _t('wiedersehen.weiter'), {
        fontFamily: 'monospace', fontSize: 14, color: '#c8bca4'
      }).setOrigin(1, 1).setName('wiedersehenWeiter').setVisible(false);
      erzaehl = scene.add.text(w / 2, 0, '', {
        fontFamily: 'serif', fontSize: 19, color: '#f1e9d8', align: 'center',
        wordWrap: { width: tpW - 72 }, lineSpacing: 5
      }).setOrigin(0.5, 0).setName('wiedersehenText');
      textMaxH = tpH - 28 - 20 - hinweis.height;
      plattenC.add(sprecherText);
      plattenC.add(erzaehl);
      plattenC.add(hinweis);
      tween({ targets: hinweis, alpha: { from: 1, to: 0.5 }, duration: 900, yoyo: true, repeat: -1 });
      _fest(c);

      bildZeigen(liste[0].bild);
      plattenC.setAlpha(0);
      zustand.phase = 'vorspann';
      vorspann = setTimeout(vorspannEnde, VORSPANN_MS);
      uhren.push(vorspann);
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
      var bild = scene.add.image(0, 0, key).setName('wiedersehenBild');
      // Das Bild steht oben buendig und reicht nur ein Stueck unter die
      // Textplatte: so verdeckt sie nicht, was unten im Bild liegt (die
      // Kinderzeichnung, die Haende).
      var sichtH = h - 16 - tpH * 0.6;
      var basis = Math.max(w / bild.width, sichtH / bild.height);
      bild.setOrigin(f[0], f[1]).setScale(basis).setAlpha(0).setScrollFactor(0);
      bild.setPosition(w / 2 + (f[0] - 0.5) * bild.width * basis, (f[1] - (HOCH[name] || 0)) * bild.height * basis);
      bildEbene.add(bild);
      tween({ targets: bild, alpha: 1, duration: BILDWECHSEL_MS });
      tween({ targets: bild, scale: basis * 1.12, duration: 22000, ease: 'Sine.easeOut' });
      // Das alte erst wegnehmen, wenn das neue darueber steht.
      spaeter(BILDWECHSEL_MS + 50, function () {
        alte.forEach(function (o) { try { o.destroy(); } catch (e) {} });
      });
    }

    function seiteZeigen(n) {
      zustand.seite = n;
      var s = liste[n];
      bildZeigen(s.bild);
      if (zustand.lauf) { try { zustand.lauf.abbrechen(); } catch (e) {} zustand.lauf = null; }
      sprecherText.setText(s.sprecher);
      var erzaehlung = !s.sprecher;
      erzaehl.setColor(erzaehlung ? '#cfc4ad' : '#f1e9d8');
      erzaehl.setFontStyle(erzaehlung ? 'italic' : '');
      // Erst voll setzen und vermessen (passt es nicht, kleiner), dann aufbauen:
      // so wandern die Zeilen beim Schreiben nicht.
      erzaehl.setFontSize(19);
      erzaehl.setText(s.text);
      while (erzaehl.height > textMaxH && parseFloat(erzaehl.style.fontSize) > 13) {
        erzaehl.setFontSize(parseFloat(erzaehl.style.fontSize) - 1);
      }
      var oben = tpY - tpH / 2 + 22 + (s.sprecher ? 12 : 0);
      erzaehl.y = oben + Math.max(0, Math.floor((textMaxH - (s.sprecher ? 12 : 0) - erzaehl.height) / 2));
      hinweis.setVisible(false);
      var fertig = function () { if (!beendet && zustand.seite === n) hinweis.setVisible(true); };
      var TW = window.DialogTypewriter;
      if (TW && typeof TW.anTextobjekt === 'function') {
        zustand.lauf = TW.anTextobjekt(scene, erzaehl, s.text, { sprecher: s.sprecher, onFertig: fertig, wanduhr: true });
      } else {
        fertig();
      }
      // Der Druck, der diese Seite brachte, soll den Aufbau nicht gleich mitnehmen.
      ab = Date.now() + SEITEN_SPERRE_MS;
    }

    function weiter() {
      if (beendet || zustand.phase === 'ausklang' || !scharf()) return;
      if (zustand.phase === 'laden') return;
      if (zustand.phase === 'vorspann') { vorspannEnde(); return; }
      // Erste Taste: den Satz ganz zeigen. Naechste: weiter.
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
        // Der Zeiger, der die Szene beendet hat, darf nicht auf Harrens Frage
        // loslassen (die Knoepfe waehlen bei pointerup).
        var bis = Date.now() + 2000;
        var warten = function () {
          var p = scene.input && scene.input.activePointer;
          if (p && p.isDown && Date.now() < bis) { setTimeout(warten, 50); return; }
          if (typeof onDone === 'function') onDone();
        };
        warten();
      }, AUSKLANG_MS);
    }

    // Erst jetzt laden: sind die Bilder schon da, baut es sofort auf.
    laden(scene, function () { if (!beendet) aufbauen(); });

    zustand.weiter = weiter;
    zustand.ueberspringen = ueberspringen;
    zustand.seiten = liste;
    return zustand;
  }

  /**
   * Debug-Vorschau: ?wiedersehen=1 spielt die Szene einmal pro Seitenaufruf
   * beim Betreten des Hubs. Setzt keine Flagge und keinen Akt.
   */
  var _vorschauGespielt = false;
  function vorschau(scene) {
    var G = window.DebugGate;
    var v = (G && typeof G.flagge === 'function') ? G.flagge('wiedersehen') : null;
    if (_vorschauGespielt || !v || v === '0') return false;
    _vorschauGespielt = true;
    try { (window.SlotStorage || window.localStorage).setItem('demonfall_seen_intro_splash', '1'); } catch (e) {}
    // Die Prolog-Karte eines frischen Spiels erst wegklicken lassen.
    var los = function () {
      var karte = scene.children && typeof scene.children.getByName === 'function' && scene.children.getByName('aktwechsel');
      if (karte && karte.active) { setTimeout(los, 400); return; }
      var S = window.storyScenes;
      scene._dialogOpen = true;
      if (S && typeof S.playWiedersehen === 'function') S.playWiedersehen(scene, function () { scene._dialogOpen = false; });
      else spielen(scene, function () {});
    };
    setTimeout(los, 600);
    return true;
  }

  window.WiedersehenSzene = {
    BILDER: BILDER, ABLAUF: ABLAUF, FOKUS: FOKUS,
    spielen: spielen, seiten: seiten, laden: laden, vorschau: vorschau, bildKey: bildKey
  };
})();
