/* =====================================================================
 * bruchNachtSzene.js: Die Nacht nach dem Bruch als Zwischenszene (Akt 3)
 * ---------------------------------------------------------------------
 * Aldric hat Dich entlarvt, die Kettenwache jagt Dich, Branka bringt Dich
 * in Elaras Versteck, und Elara bleibt die Nacht bei Dir. Der leiseste
 * Moment der Geschichte, direkt bevor Du sie neben Aldric siehst.
 *
 * Drei Tableaus (PixelLab, 384x192, assets/sprites/bruchnacht/) mit
 * langsamem Heranfahren, ueberblendet von Bild zu Bild:
 *   spalt   Branka fuehrt Dich zum Spalt, oben ziehen die Laternen vorbei
 *   kerze   eine Kerze, Karten der Kanaele, Elara neben Dir
 *   morgen  die Kerze heruntergebrannt, Elara wach an der Tuer. Fuer
 *           Aufmerksame: die Hand mit dem Ring haelt sie von Dir weg.
 *
 * Unten schreibt sich jede Zeile Wort fuer Wort auf. Erste Taste (oder
 * Klick/Tippen) zeigt die Zeile ganz, die naechste blaettert weiter. ESC
 * oder "Ueberspringen" beendet die Szene, sonst nichts. Die Wahl aus
 * storyDialog.byScene.bruch_nacht kommt mitten in der Nacht und nimmt nur
 * Klicks: keine Taste trifft eine Antwort. Die Spieluhr steht.
 *
 * Fehlen die Bilder (oder ist kein Phaser da), spielt storyScenes die
 * alte Textfassung.
 *
 * Debug: ?bruchnacht=1 zeigt die Szene beim Hub-Eintritt, ohne den
 * Spielstand anzufassen (docs/debug-modus.md).
 * ===================================================================== */
(function () {
  'use strict';

  var ORDNER = 'assets/sprites/bruchnacht/';
  var BILDER = ['spalt', 'kerze', 'morgen'];
  var TIEFE = 6000;
  var SPERRE_MS = 350;      // der Tastendruck, der die Szene ausgeloest hat, zaehlt nicht
  var BLENDE_MS = 900;
  var MIN_TREFFER = 44;
  // Worauf die Kamera zufaehrt (Anteil an Bildbreite/-hoehe).
  var FOKUS = { spalt: [0.62, 0.62], kerze: [0.5, 0.6], morgen: [0.6, 0.55] };

  function _en() { return !!(window.i18n && typeof window.i18n.getLanguage === 'function' && window.i18n.getLanguage() === 'en'); }
  function _t(de, en) { return _en() ? en : de; }
  function bildKey(n) { return 'bruchnacht_' + n; }

  /** Die Schritte der Szene, in der gerade gewaehlten Sprache. */
  function schritte() {
    return [
      { bild: 'spalt', text: _t('(Die Nacht nach dem Bruch. Aldrics Kettenwache durchkämmt die Gassen. Branka führt Dich durch den Keller, zu Elaras Versteck.)',
        '(The night after the break. Aldric\'s chain guard combs the alleys. Branka leads you through the cellar, to Elara\'s hideout.)') },
      { bild: 'spalt', text: _t('(Über Dir ziehen Laternen am Gitter vorbei. Keiner der Wächter sieht nach unten.)',
        '(Above you, lanterns pass the grate. None of the guards looks down.)') },
      { bild: 'spalt', text: _t('BRANKA: Durch den Spalt. Sie wartet auf Dich. Und vergiss den Weg, sobald Du drin bist.',
        'BRANKA: Through the crack. She is waiting for you. And forget the way once you are inside.') },
      { bild: 'kerze', text: _t('(Eine einzige Kerze. An der Wand Karten der Kanäle, mit Kohle bezeichnet. Irgendwo tropft Wasser.)',
        '(A single candle. On the wall, maps of the canals, marked in charcoal. Somewhere, water drips.)') },
      { bild: 'kerze', text: _t('ELARA: Hier findet Dich keiner. Schlaf. Ich halte Wache.', 'ELARA: Nobody will find you here. Sleep. I will keep watch.') },
      { bild: 'kerze', wahl: 'bruch_nacht' },
      { bild: 'morgen', text: _t('(Du wachst auf, als es dämmert. Die Kerze ist heruntergebrannt. Elara sitzt an der Tür, die Klinge über den Knien, und sieht Dich an. Lange.)',
        '(You wake as dawn breaks. The candle has burnt down. Elara sits by the door, the blade across her knees, and looks at you. For a long time.)') },
      { bild: 'morgen', text: _t('(Sie war die ganze Nacht wach. Die eine Hand hält sie von Dir abgewandt.)',
        '(She has been awake all night. One hand she keeps turned away from you.)') },
      { bild: 'morgen', text: _t('ELARA: Es wird hell. Geh, solange der Nebel noch dicht ist.', 'ELARA: It is getting light. Go while the fog is still thick.') }
    ];
  }

  function _alleDa(scene) {
    return BILDER.every(function (n) { return scene.textures.exists(bildKey(n)); });
  }

  /** Bilder nachladen; fertig(true), wenn danach alle da sind. */
  function vorladen(scene, fertig) {
    var melden = function () { if (typeof fertig === 'function') fertig(_alleDa(scene)); };
    if (_alleDa(scene)) { melden(); return; }
    BILDER.forEach(function (n) {
      if (!scene.textures.exists(bildKey(n))) scene.load.image(bildKey(n), ORDNER + 'bruchnacht_' + n + '.png');
    });
    scene.load.once('complete', melden);
    try { if (!scene.load.isLoading()) scene.load.start(); } catch (e) { melden(); }
  }

  /** scrollFactor 0 bis in jedes Kind (sonst treffen Mobile-Taps daneben). */
  function _fest(o) {
    if (!o) return;
    if (typeof o.setScrollFactor === 'function') o.setScrollFactor(0);
    if (o.list) o.list.forEach(_fest);
  }

  function _mobil(scene) {
    try { return !!(scene.sys.game.device && !scene.sys.game.device.os.desktop); } catch (e) { return false; }
  }

  /** "ELARA: Text" -> Sprecher und Rede; "(Erzaehlung)" ohne Klammern. */
  function _teilen(zeile) {
    var m = /^([A-ZÄÖÜ][A-ZÄÖÜ ]+):\s*([\s\S]*)$/.exec(zeile || '');
    if (m) return { sprecher: m[1], rede: m[2], erzaehlt: false };
    var e = /^\(([\s\S]*)\)$/.exec(zeile || '');
    return { sprecher: '', rede: e ? e[1] : String(zeile || ''), erzaehlt: true };
  }

  /**
   * Die Szene spielen. Liefert false, wenn sie hier nicht laufen kann (kein
   * Phaser, keine Bilder): dann erzaehlt der Aufrufer die Textfassung.
   * @param {function} [rueckfall]  laeuft statt der Szene, wenn die Bilder
   *   auch nach dem Nachladen fehlen
   */
  function spielen(scene, onDone, rueckfall) {
    if (!scene || !scene.add || !scene.add.image || !scene.textures || !scene.tweens || !scene.cameras) return false;
    if (scene.__bruchNacht && scene.__bruchNacht.offen()) return true;   // laeuft schon
    if (_alleDa(scene)) { zeigen(scene, onDone); return true; }
    if (!scene.load) return false;
    // Bis die Bilder da sind, darf im Dungeon nichts weiterlaufen.
    if (typeof window.pauseGameClock === 'function') { try { window.pauseGameClock(scene); } catch (e) {} }
    vorladen(scene, function (da) {
      if (typeof window.resumeGameClock === 'function') { try { window.resumeGameClock(scene); } catch (e) {} }
      if (!scene.sys || !scene.sys.isActive || !scene.sys.isActive()) return;
      if (da) zeigen(scene, onDone);
      else if (typeof rueckfall === 'function') rueckfall();
      else if (typeof onDone === 'function') onDone();
    });
    return true;
  }

  function zeigen(scene, onDone) {
    var cam = scene.cameras.main;
    var w = cam.width, h = cam.height;
    var start = Date.now();
    var liste = schritte();
    var nr = -1;
    var zu = false;
    var lauf = null;          // Wort-fuer-Wort-Aufbau der aktuellen Zeile
    var wahl = null;          // offene Auswahl (DialogChoice)
    var bildJetzt = null;
    var tweens = [];
    var uhren = [];
    function tween(cfg) { try { var t = scene.tweens.add(cfg); tweens.push(t); return t; } catch (e) { return null; } }

    var choiceVorher = window.eventChoiceOpen;
    window.eventChoiceOpen = true;   // keine Angriffe durch die Szene hindurch
    if (typeof window.pauseGameClock === 'function') { try { window.pauseGameClock(scene); } catch (e) {} }

    var c = scene.add.container(0, 0).setDepth(TIEFE).setName('bruchNacht');
    var grund = scene.add.rectangle(w / 2, h / 2, w + 40, h + 40, 0x000000, 1).setName('bruchNachtGrund');
    c.add(grund);

    // Masse der Textplatte vorab: das Bild steht UEBER ihr. Die Figuren
    // stehen in allen drei Tableaus im unteren Drittel; ein randvolles Bild
    // verschwand mit ihnen hinter der Platte (im Bild gesehen).
    var tpW = Math.min(780, w - 32);
    var tpH = Math.min(118, Math.round(h * 0.26));
    var tpY = h - 10 - tpH / 2;
    var flaecheH = tpY - tpH / 2 - 6;

    // Alle drei Tableaus liegen bereit; sichtbar ist nur das aktuelle.
    var bilder = {};
    BILDER.forEach(function (n) {
      var f = FOKUS[n];
      var b = scene.add.image(0, 0, bildKey(n)).setOrigin(f[0], f[1]).setAlpha(0);
      b.setName('bruchNachtBild_' + n);
      b.__basis = Math.min(w / b.width, flaecheH / b.height);
      var bw = b.width * b.__basis, bh = b.height * b.__basis;
      b.setPosition((w - bw) / 2 + f[0] * bw, (flaecheH - bh) / 2 + f[1] * bh);
      b.setScale(b.__basis);
      bilder[n] = b;
      c.add(b);
    });
    function bildZeigen(n) {
      if (bildJetzt === n) return;
      var alt = bilder[bildJetzt], neu = bilder[n];
      if (alt) tween({ targets: alt, alpha: 0, duration: BLENDE_MS });
      bildJetzt = n;
      zustand.bild = n;
      neu.setScale(neu.__basis);
      tween({ targets: neu, alpha: 1, duration: BLENDE_MS });
      tween({ targets: neu, scale: neu.__basis * 1.07, duration: 26000, ease: 'Sine.easeOut' });
    }

    // Titel, verschwindet mit der ersten Zeile, die weiterblaettert.
    var titel = scene.add.text(w / 2, 22, _t('Die Nacht nach dem Bruch', 'The Night After the Break'), {
      fontFamily: 'serif', fontSize: 24, color: '#e8d6b0', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5, 0).setAlpha(0).setName('bruchNachtTitel');
    c.add(titel);
    tween({ targets: titel, alpha: 1, duration: 900 });

    // Ueberspringen oben rechts (Trefferflaeche >= 44 px).
    var skipText = scene.add.text(0, 0, _mobil(scene) ? _t('Überspringen', 'Skip') : _t('Überspringen (ESC)', 'Skip (ESC)'), {
      fontFamily: 'monospace', fontSize: 14, color: '#e6dcc6'
    }).setOrigin(0.5);
    var skipW = Math.max(110, skipText.width + 28), skipH = MIN_TREFFER;
    var skipX = w - 12 - skipW / 2, skipY = 12 + skipH / 2;
    var UR = window.uiRahmen;
    var messing = !!(UR && typeof UR.bereit === 'function' && UR.bereit(scene));
    var kachel = messing && typeof UR.kachelBild === 'function' ? UR.kachelBild(scene, skipW, skipH) : null;
    var skipFeld = kachel ? scene.add.image(skipX, skipY, kachel)
      : scene.add.rectangle(skipX, skipY, skipW, skipH, 0x1c191f, 0.9).setStrokeStyle(1, 0xa8a090, 0.8);
    skipFeld.setName('bruchNachtUeberspringen');
    skipText.setPosition(skipX, skipY);
    c.add(skipFeld);
    c.add(skipText);
    // Auf schmalem Bild nicht in den Titel ragen.
    if (titel.x + titel.width / 2 > skipX - skipW / 2 - 8) titel.y = skipY + skipH / 2 + 6;

    // Textplatte unten.
    var textC = scene.add.container(0, 0);
    c.add(textC);
    var platte = messing && typeof UR.platte === 'function' ? UR.platte(scene, w / 2, tpY, tpW, tpH, TIEFE + 2, 0.5) : null;
    if (platte) platte.forEach(function (t) { textC.add(t); });
    else {
      var g = scene.add.graphics();
      g.fillStyle(0x1c191f, 0.94).fillRoundedRect(w / 2 - tpW / 2, tpY - tpH / 2, tpW, tpH, 10);
      g.lineStyle(2, 0xa8a090, 0.8).strokeRoundedRect(w / 2 - tpW / 2, tpY - tpH / 2, tpW, tpH, 10);
      textC.add(g);
    }
    var name = scene.add.text(w / 2 - tpW / 2 + 30, tpY - tpH / 2 + 11, '', {
      fontFamily: 'serif', fontSize: 16, color: '#d4a543', fontStyle: 'bold'
    }).setName('bruchNachtSprecher');
    var hinweis = scene.add.text(w / 2 + tpW / 2 - 26, tpY + tpH / 2 - 9, _t('Weiter', 'Continue'), {
      fontFamily: 'monospace', fontSize: 14, color: '#c8bca4'
    }).setOrigin(1, 1).setAlpha(0).setName('bruchNachtWeiter');
    var textW = tpW - 72;
    var rede = scene.add.text(w / 2, 0, '', {
      fontFamily: 'serif', fontSize: 18, color: '#f1e9d8', align: 'center',
      wordWrap: { width: textW }, lineSpacing: 5
    }).setOrigin(0.5, 0).setName('bruchNachtText');
    textC.add(name);
    textC.add(rede);
    textC.add(hinweis);
    var hinweisPuls = null;

    _fest(c);

    var zustand = {
      phase: 'zeile', schritt: -1, bild: null, schritte: liste.length,
      offen: function () { return !zu; },
      text: function () { return rede.text; },
      voll: '',
      laeuft: function () { return !!(lauf && lauf.laeuft()); }
    };
    scene.__bruchNacht = zustand;

    function hinweisZeigen(an) {
      if (hinweisPuls) { hinweisPuls.stop(); hinweisPuls = null; }
      hinweis.setAlpha(an ? 1 : 0);
      if (an) hinweisPuls = tween({ targets: hinweis, alpha: { from: 1, to: 0.5 }, duration: 900, yoyo: true, repeat: -1 });
    }

    function zeileZeigen(zeile) {
      var t = _teilen(zeile);
      name.setText(t.sprecher);
      rede.setColor(t.erzaehlt ? '#cfc6b4' : '#f1e9d8');
      rede.setFontStyle(t.erzaehlt ? 'italic' : '');
      // Voll setzen und vermessen, notfalls kleiner: der Block soll beim
      // Schreiben nicht wachsen und nicht aus der Platte laufen.
      rede.setFontSize(18);
      rede.setText(t.rede);
      var oben = tpY - tpH / 2 + (t.sprecher ? 32 : 14);
      var maxH = tpY + tpH / 2 - 24 - oben;
      while (rede.height > maxH && parseFloat(rede.style.fontSize) > 13) rede.setFontSize(parseFloat(rede.style.fontSize) - 1);
      rede.y = oben + Math.max(0, Math.floor((maxH - rede.height) / 2));
      zustand.voll = t.rede;
      hinweisZeigen(false);
      if (lauf) { try { lauf.abbrechen(); } catch (e) {} }
      lauf = null;
      var TW = window.DialogTypewriter;
      var fertig = function () { if (!zu && zustand.phase === 'zeile') hinweisZeigen(true); };
      if (TW && typeof TW.anTextobjekt === 'function') {
        // wanduhr: die Spieluhr steht, auf scene.time liefe nichts.
        lauf = TW.anTextobjekt(scene, rede, t.rede, { sprecher: t.sprecher, wanduhr: true, onFertig: fertig });
        if (!lauf.laeuft()) fertig();
      } else fertig();
    }

    function naechster(einschub) {
      if (zu) return;
      if (einschub) { zustand.phase = 'zeile'; textC.setVisible(true); zeileZeigen(einschub); return; }
      nr++;
      zustand.schritt = nr;
      if (nr >= liste.length) { schliessen(); return; }
      var s = liste[nr];
      bildZeigen(s.bild);
      if (nr > 0 && titel.alpha > 0) tween({ targets: titel, alpha: 0, duration: 600 });
      if (s.wahl) { wahlZeigen(s.wahl); return; }
      zustand.phase = 'zeile';
      zeileZeigen(s.text);
    }

    // Die Wahl der Nacht: dieselbe Auswahl wie bisher (storyDialog), nur
    // ueber dem Tableau. Nur Klicks waehlen; ohne DialogChoice weiter.
    function wahlZeigen(key) {
      var cfg = window.storyDialog && window.storyDialog.byScene && window.storyDialog.byScene[key];
      var DC = window.DialogChoice;
      if (!cfg || !DC || typeof DC.present !== 'function') { naechster(); return; }
      zustand.phase = 'wahl';
      textC.setVisible(false);
      if (lauf) { try { lauf.abbrechen(); } catch (e) {} lauf = null; }
      var antwort = null;
      var vorher = scene.children.list.slice();
      wahl = DC.present(scene, {
        prompt: cfg.prompt,
        choices: cfg.choices,
        noCancel: true,
        _onResponse: function (r) { antwort = r; },
        onResolved: function () {
          wahl = null;
          if (zu) return;
          if (antwort) naechster(antwort); else naechster();
        }
      });
      // Ueber die Szene heben (die Auswahl liegt sonst bei Tiefe 1600) und an
      // den unteren Rand, wo sonst die Textplatte steht: die beiden im Bild
      // bleiben sichtbar.
      scene.children.list.forEach(function (o) {
        if (vorher.indexOf(o) < 0 && o.name === 'dialogChoiceContainer') {
          o.setDepth(TIEFE + 20);
          try { var r = o.getBounds(); o.y += Math.max(0, (h - 10) - (r.y + r.height)); } catch (e) {}
        }
      });
    }

    function aufraeumen() {
      if (zu) return false;
      zu = true;
      zustand.phase = 'fertig';
      if (lauf) { try { lauf.abbrechen(); } catch (e) {} }
      if (wahl) { try { wahl.destroy(); } catch (e) {} wahl = null; }
      try { scene.input.keyboard.off('keydown', beiTaste); } catch (e) {}
      try { scene.events.off('shutdown', beiEnde); } catch (e) {}
      tweens.forEach(function (t) { try { t.stop(); t.remove(); } catch (e) {} });
      uhren.forEach(function (u) { clearTimeout(u); });
      try { c.destroy(true); } catch (e) {}
      if (scene.__bruchNacht === zustand) scene.__bruchNacht = null;
      if (typeof window.resumeGameClock === 'function') { try { window.resumeGameClock(scene); } catch (e) {} }
      return true;
    }
    function schliessen() {
      if (!aufraeumen()) return;
      // Die Sperre gegen Angriffe noch einen Moment halten: dieselbe Taste,
      // die die Szene schliesst, soll im Spiel nicht zuschlagen.
      setTimeout(function () { window.eventChoiceOpen = choiceVorher; }, 150);
      if (typeof onDone === 'function') { try { onDone(); } catch (e) {} }
    }
    function beiEnde() { aufraeumen(); window.eventChoiceOpen = choiceVorher; }

    function weiter() {
      if (zu || zustand.phase !== 'zeile') return;     // nie in die Wahl hinein
      if (Date.now() - start < SPERRE_MS) return;
      if (lauf && lauf.ueberspringen()) return;        // erste Taste: Zeile ganz zeigen
      naechster();
    }
    function ueberspringen() { if (!zu) schliessen(); }

    function beiTaste(ev) {
      if (!ev) return;
      if (ev.key === 'Escape' || ev.keyCode === 27) { ueberspringen(); return; }
      if (ev.repeat) return;
      weiter();
    }
    try { scene.input.keyboard.on('keydown', beiTaste); } catch (e) {}
    scene.events.once('shutdown', beiEnde);
    grund.setInteractive();
    grund.on('pointerdown', weiter);
    // Tippen aufs Bild oder die Platte blaettert ebenso.
    BILDER.forEach(function (n) { bilder[n].setInteractive(); bilder[n].on('pointerdown', weiter); });
    skipFeld.setInteractive({ useHandCursor: true });
    skipFeld.on('pointerdown', function (p, x, y, ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); ueberspringen(); });

    zustand.weiter = weiter;
    zustand.ueberspringen = ueberspringen;
    naechster();
    return zustand;
  }

  /**
   * Debug ?bruchnacht=1: die Szene beim Hub-Eintritt einmal pro Laden
   * zeigen. Spielstand und Flaggen bleiben unberuehrt.
   */
  var _probeGezeigt = false;
  function probe(scene, fertig) {
    var G = window.DebugGate;
    if (_probeGezeigt || !G || !G.an('bruchnacht')) return false;
    _probeGezeigt = true;
    return spielen(scene, fertig, fertig);
  }

  window.BruchNachtSzene = {
    BILDER: BILDER,
    bildKey: bildKey,
    schritte: schritte,
    vorladen: vorladen,
    spielen: spielen,
    probe: probe
  };
})();
