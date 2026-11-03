/* =====================================================================
 * elaraSzene.js: Elaras ruhige Momente als Zwischenszenen mit Tableaus
 * ---------------------------------------------------------------------
 * Drei Stellen liefen bisher als Textdialog ueber dem Raum. Jetzt spielt
 * jede auf PixelLab-Tableaus (create_image_pro, 384x192, im Stil von
 * Bruchnacht und Wiedersehen, assets/sprites/elaraszenen/):
 *
 *   werkstatt  hammer   im Versteck: Elara schiebt Dir Deinen alten Hammer hin
 *   klinge     klinge   sie reicht Dir die schmale Klinge, zoegernd
 *              gravur   die Gravur am Heft: drei Ringe, ineinander (das
 *                       Zeichen, nur im Bild; der Text sagt "etwas Kleines")
 *   riss       riss     ihr erster Riss: ein Bote, ein Blatt, das sie wegfaltet
 *
 * Bedienung wie bei den anderen Szenen: Bild faehrt langsam heran, Text
 * Wort fuer Wort, erste Taste/Klick zeigt die Zeile ganz, die naechste
 * blaettert. Die Wahl steht ueber dem Bild und nimmt nur Klicks, ihre
 * Antwort ist die naechste Zeile. ESC oder "Ueberspringen" springt zur
 * offenen Wahl und beendet die Szene erst danach. Die Spieluhr steht.
 *
 * Fehlen die Bilder, ruft spielen() den Rueckfall des Aufrufers (die
 * fruehere Textfassung in roomManager bzw. storyScenes).
 *
 * Debug: ?elaraszene=werkstatt|klinge|riss zeigt die Szene beim
 * Hub-Eintritt, ohne den Spielstand anzufassen (docs/debug-modus.md).
 * ===================================================================== */
(function () {
  'use strict';

  var ORDNER = 'assets/sprites/elaraszenen/';
  var TIEFE = 6000;
  var SPERRE_MS = 350;      // der E-Druck, der die Szene ausgeloest hat, zaehlt nicht
  var BLENDE_MS = 900;
  var MIN_TREFFER = 44;

  function _en() { return !!(window.i18n && typeof window.i18n.getLanguage === 'function' && window.i18n.getLanguage() === 'en'); }
  function _t(de, en) { return _en() ? en : de; }

  // Je Szene ihre Bilder und worauf die Kamera zufaehrt (Anteil an Breite/Hoehe).
  var SZENEN = {
    werkstatt: { bilder: ['hammer'], fokus: { hammer: [0.5, 0.62] } },
    klinge: { bilder: ['klinge', 'gravur'], fokus: { klinge: [0.5, 0.55], gravur: [0.6, 0.6] } },
    riss: { bilder: ['riss'], fokus: { riss: [0.38, 0.55] } }
  };

  function bildKey(n) { return 'elaraszenen_' + n; }
  function bildPfad(n) { return ORDNER + bildKey(n) + '.png'; }

  function titel(id) {
    if (id === 'werkstatt') return _t('Dein alter Hammer', 'Your Old Hammer');
    if (id === 'klinge') return _t('Die Klinge', 'The Blade');
    return _t('Ein Blatt, das nicht gedruckt wird', 'A Sheet That Will Not Be Printed');
  }

  /**
   * Die Schritte einer Szene in der gerade gewaehlten Sprache. Ein Schritt
   * ist eine Zeile ({bild, text}) oder eine Wahl ({bild, wahl}); jede Antwort
   * bringt ihre Zeilen mit. Die Worte sind dieselben wie in der Textfassung.
   */
  function schritte(id) {
    if (id === 'werkstatt') return [
      { bild: 'hammer', text: _t('(Elara legt einen Hammer vor Dich hin. Der Stiel ist dunkel und glatt, dort, wo eine Hand ihn jahrelang gehalten hat.)',
        '(Elara puts a hammer in front of you. The handle is dark and smooth where a hand held it for years.)') },
      { bild: 'hammer', text: _t('ELARA: Deiner. Ich habe ihn aufgehoben.', 'ELARA: Yours. I kept it.') },
      { bild: 'hammer', text: _t('(Du nimmst ihn. Deine Hand schliesst sich um den Stiel, als hätte sie nie losgelassen. Du selbst erinnerst Dich an nichts.)',
        '(You take it. Your hand closes around the handle as if it had never let go. You yourself remember nothing.)') },
      { bild: 'hammer', wahl: {
        prompt: _t('ELARA: Deiner. Ich habe ihn aufgehoben.', 'ELARA: Yours. I kept it.'),
        wahlen: [
          { label: _t('Wer war ich?', 'Who was I?'),
            antwort: [_t('ELARA: Ein Handwerker. Der Rest ist nicht wichtig. Wichtig ist, was Deine Hände noch können.',
              'ELARA: A craftsman. The rest does not matter. What matters is what your hands can still do.')] },
          { label: _t('Warum tust Du das?', 'Why are you doing this?'),
            antwort: [_t('ELARA: Weil niemand etwas aufhebt, wenn ich es nicht tue. (Sie lächelt. Es erreicht ihre Augen nicht ganz.)',
              'ELARA: Because nobody keeps anything if I do not. (She smiles. It does not quite reach her eyes.)')] }
        ] } }
    ];
    if (id === 'klinge') return [
      { bild: 'klinge', text: _t('ELARA: Nimm das. Ich habe sie für Dich schmieden lassen. Für den Fall, dass...',
        'ELARA: Take this. I had it forged for you. In case...') },
      { bild: 'gravur', text: _t('(Eine schmale Klinge, gut ausgewogen. Nahe am Heft ist etwas Kleines eingraviert.)',
        '(A slender blade, well balanced. Something small is engraved near the hilt.)') },
      { bild: 'klinge', wahl: {
        prompt: _t('ELARA: Für den Fall, dass...', 'ELARA: In case...'),
        wahlen: [
          { label: _t('Für welchen Fall?', 'In case of what?'),
            antwort: [_t('ELARA: (zögert) Für jeden. Man weiss nie, wer am Ende vor einem steht.',
              'ELARA: (hesitates) Any. You never know who will stand before you in the end.')] },
          { label: _t('Danke, Elara.', 'Thank you, Elara.'),
            antwort: [_t('ELARA: Möge sie Dich beschützen. Egal was kommt.', 'ELARA: May it protect you. Whatever comes.')] }
        ] } }
    ];
    if (id === 'riss') {
      // Die Wahl kommt wie bisher aus storyDialog (dort zweisprachig gebunden).
      var cfg = window.storyDialog && window.storyDialog.byScene && window.storyDialog.byScene.elara_first_crack;
      var liste = [
        { bild: 'riss', text: _t('(Ein Bote bringt eine Meldung. Elara liest, faltet das Blatt weg.)', '(A messenger brings a report. Elara reads it and folds the sheet away.)') },
        { bild: 'riss', text: _t('ELARA: Das kommt nicht in die Presse.', 'ELARA: This does not go to the press.') }
      ];
      if (cfg && cfg.choices && cfg.choices.length) {
        liste.push({ bild: 'riss', wahl: {
          prompt: cfg.prompt,
          wahlen: cfg.choices.map(function (c) { return { label: c.label, antwort: c.response ? [c.response] : [] }; })
        } });
      }
      return liste;
    }
    return [];
  }

  function _alleDa(scene, id) {
    return SZENEN[id].bilder.every(function (n) { return scene.textures.exists(bildKey(n)); });
  }

  /** Bilder nachladen; fertig(true), wenn danach alle da sind. */
  function vorladen(scene, id, fertig) {
    var melden = function () { if (typeof fertig === 'function') fertig(_alleDa(scene, id)); };
    if (!SZENEN[id] || !scene || !scene.textures || !scene.load) { if (typeof fertig === 'function') fertig(false); return; }
    if (_alleDa(scene, id)) { melden(); return; }
    SZENEN[id].bilder.forEach(function (n) {
      if (!scene.textures.exists(bildKey(n))) scene.load.image(bildKey(n), bildPfad(n));
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
   * Phaser): dann erzaehlt der Aufrufer die Textfassung.
   * @param {function} [onDone]     laeuft nach dem Ende
   * @param {function} [rueckfall]  laeuft statt der Szene, wenn die Bilder fehlen
   */
  function spielen(scene, id, onDone, rueckfall) {
    if (!SZENEN[id]) return false;
    if (!scene || !scene.add || !scene.add.image || !scene.textures || !scene.tweens || !scene.cameras) return false;
    if (scene.__elaraSzene && scene.__elaraSzene.offen()) return true;
    if (_alleDa(scene, id)) { zeigen(scene, id, onDone); return true; }
    if (!scene.load) return false;
    // Bis die Bilder da sind, darf im Dungeon nichts weiterlaufen.
    if (typeof window.pauseGameClock === 'function') { try { window.pauseGameClock(scene); } catch (e) {} }
    var choiceVorher = window.eventChoiceOpen;
    window.eventChoiceOpen = true;
    vorladen(scene, id, function (da) {
      window.eventChoiceOpen = choiceVorher;
      if (typeof window.resumeGameClock === 'function') { try { window.resumeGameClock(scene); } catch (e) {} }
      if (!scene.sys || !scene.sys.isActive || !scene.sys.isActive()) return;
      if (da) zeigen(scene, id, onDone);
      else if (typeof rueckfall === 'function') rueckfall();
      else if (typeof onDone === 'function') onDone();
    });
    return true;
  }

  function zeigen(scene, id, onDone) {
    var def = SZENEN[id];
    var cam = scene.cameras.main;
    var w = cam.width, h = cam.height;
    var start = Date.now();
    var liste = schritte(id);
    var nr = -1;
    var zu = false;
    var lauf = null;
    var wahl = null;
    var bildJetzt = null;
    var tweens = [];
    function tween(cfg) { try { var t = scene.tweens.add(cfg); tweens.push(t); return t; } catch (e) { return null; } }

    var choiceVorher = window.eventChoiceOpen;
    window.eventChoiceOpen = true;   // keine Angriffe durch die Szene hindurch
    if (typeof window.pauseGameClock === 'function') { try { window.pauseGameClock(scene); } catch (e) {} }

    var c = scene.add.container(0, 0).setDepth(TIEFE).setName('elaraSzene');
    var grund = scene.add.rectangle(w / 2, h / 2, w + 40, h + 40, 0x000000, 1).setName('elaraSzeneGrund');
    c.add(grund);

    // Die Textplatte zuerst vermessen: das Bild steht UEBER ihr, die Figuren
    // stehen in den Tableaus im unteren Drittel.
    var tpW = Math.min(780, w - 32);
    var tpH = Math.min(118, Math.round(h * 0.26));
    var tpY = h - 10 - tpH / 2;
    var flaecheH = tpY - tpH / 2 - 6;

    var bilder = {};
    def.bilder.forEach(function (n) {
      var f = def.fokus[n] || [0.5, 0.5];
      var b = scene.add.image(0, 0, bildKey(n)).setOrigin(f[0], f[1]).setAlpha(0);
      b.setName('elaraSzeneBild_' + n);
      b.__basis = Math.min(w / b.width, flaecheH / b.height);
      var bw = b.width * b.__basis, bh = b.height * b.__basis;
      b.setPosition((w - bw) / 2 + f[0] * bw, (flaecheH - bh) / 2 + f[1] * bh);
      b.setScale(b.__basis);
      bilder[n] = b;
      c.add(b);
    });
    function bildZeigen(n) {
      if (!n || bildJetzt === n || !bilder[n]) return;
      var alt = bilder[bildJetzt], neu = bilder[n];
      if (alt) tween({ targets: alt, alpha: 0, duration: BLENDE_MS });
      bildJetzt = n;
      zustand.bild = n;
      neu.setScale(neu.__basis);
      tween({ targets: neu, alpha: 1, duration: BLENDE_MS });
      // Die Gravur ist klein: dort faehrt das Bild weiter heran.
      tween({ targets: neu, scale: neu.__basis * (n === 'gravur' ? 1.25 : 1.07), duration: 26000, ease: 'Sine.easeOut' });
    }

    var kopf = scene.add.text(w / 2, 22, titel(id), {
      fontFamily: 'serif', fontSize: 24, color: '#e8d6b0', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5, 0).setAlpha(0).setName('elaraSzeneTitel');
    c.add(kopf);
    tween({ targets: kopf, alpha: 1, duration: 900 });

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
    skipFeld.setName('elaraSzeneUeberspringen');
    skipText.setPosition(skipX, skipY);
    c.add(skipFeld);
    c.add(skipText);
    if (kopf.x + kopf.width / 2 > skipX - skipW / 2 - 8) kopf.y = skipY + skipH / 2 + 6;

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
    }).setName('elaraSzeneSprecher');
    var hinweis = scene.add.text(w / 2 + tpW / 2 - 26, tpY + tpH / 2 - 9, _t('Weiter', 'Continue'), {
      fontFamily: 'monospace', fontSize: 14, color: '#c8bca4'
    }).setOrigin(1, 1).setAlpha(0).setName('elaraSzeneWeiter');
    var rede = scene.add.text(w / 2, 0, '', {
      fontFamily: 'serif', fontSize: 18, color: '#f1e9d8', align: 'center',
      wordWrap: { width: tpW - 72 }, lineSpacing: 5
    }).setOrigin(0.5, 0).setName('elaraSzeneText');
    textC.add(name);
    textC.add(rede);
    textC.add(hinweis);
    var hinweisPuls = null;

    _fest(c);

    var zustand = {
      id: id, phase: 'zeile', schritt: -1, bild: null,
      offen: function () { return !zu; },
      text: function () { return rede.text; },
      sprecher: function () { return name.text; },
      voll: '',
      gezeigt: [],
      laeuft: function () { return !!(lauf && lauf.laeuft()); }
    };
    scene.__elaraSzene = zustand;

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
      zustand.gezeigt.push(zeile);
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

    function naechster() {
      if (zu) return;
      nr++;
      zustand.schritt = nr;
      if (nr >= liste.length) { schliessen(); return; }
      var s = liste[nr];
      bildZeigen(s.bild);
      if (nr > 0 && kopf.alpha > 0) tween({ targets: kopf, alpha: 0, duration: 600 });
      if (s.wahl) { wahlZeigen(s); return; }
      zustand.phase = 'zeile';
      textC.setVisible(true);
      zeileZeigen(s.text);
    }

    // Die Wahl ueber dem Tableau (DialogChoice), nur per Klick. Ihre Zeilen
    // kommen direkt danach, auf demselben Bild.
    function wahlZeigen(s) {
      var DC = window.DialogChoice;
      var wahlen = s.wahl.wahlen;
      var antwortEinfuegen = function (gewaehlt) {
        if (!gewaehlt) return;
        var zeilen = (gewaehlt.antwort || []).map(function (t) { return { bild: s.bild, text: t }; });
        liste.splice.apply(liste, [nr + 1, 0].concat(zeilen));
      };
      if (!DC || typeof DC.present !== 'function') { naechster(); return; }
      zustand.phase = 'wahl';
      textC.setVisible(false);
      hinweisZeigen(false);
      if (lauf) { try { lauf.abbrechen(); } catch (e) {} lauf = null; }
      var vorher = scene.children.list.slice();
      wahl = DC.present(scene, {
        prompt: s.wahl.prompt,
        noCancel: true,
        choices: wahlen.map(function (x) { return { label: x.label }; }),
        onResolved: function (r) {
          wahl = null;
          if (zu) return;
          antwortEinfuegen(r ? wahlen[r.index] : null);
          naechster();
        }
      });
      // Ueber die Szene heben (die Auswahl liegt sonst bei Tiefe 1600) und an
      // den unteren Rand, wo sonst die Textplatte steht.
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
      try { c.destroy(true); } catch (e) {}
      if (scene.__elaraSzene === zustand) scene.__elaraSzene = null;
      if (typeof window.resumeGameClock === 'function') { try { window.resumeGameClock(scene); } catch (e) {} }
      return true;
    }
    function schliessen() {
      if (!aufraeumen()) return;
      // Dieselbe Taste, die die Szene schliesst, soll im Raum nicht zuschlagen.
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
    // ESC/Knopf: zur offenen Wahl springen, sonst beenden. Die Wahl selbst
    // wird nie uebersprungen.
    function ueberspringen() {
      if (zu || zustand.phase === 'wahl') return;
      for (var i = nr + 1; i < liste.length; i++) {
        if (liste[i].wahl) { nr = i - 1; naechster(); return; }
      }
      schliessen();
    }

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
    def.bilder.forEach(function (n) { bilder[n].setInteractive(); bilder[n].on('pointerdown', weiter); });
    skipFeld.setInteractive({ useHandCursor: true });
    skipFeld.on('pointerdown', function (p, x, y, ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); ueberspringen(); });

    zustand.weiter = weiter;
    zustand.ueberspringen = ueberspringen;
    zustand.beenden = schliessen;      // Szenenwechsel, Testkopf
    naechster();
    return zustand;
  }

  /**
   * Debug ?elaraszene=werkstatt|klinge|riss: die Szene beim Hub-Eintritt
   * einmal pro Laden zeigen. Spielstand und Flaggen bleiben unberuehrt.
   */
  var _vorschauGespielt = false;
  function vorschau(scene) {
    var G = window.DebugGate;
    var id = (G && typeof G.flagge === 'function') ? G.flagge('elaraszene') : null;
    if (id === '1' || id === 'true') id = 'werkstatt';
    if (_vorschauGespielt || !id || !SZENEN[id]) return false;
    _vorschauGespielt = true;
    // Die Begruessungstafel eines frischen Spiels laege sonst ueber der Szene.
    try { if (window.SlotStorage) window.SlotStorage.setItem('demonfall_seen_intro_splash', '1'); } catch (e) {}
    var los = function () {
      // Erst die Prolog-Karte eines frischen Spiels wegklicken lassen.
      var karte = scene.children && typeof scene.children.getByName === 'function' && scene.children.getByName('aktwechsel');
      if (karte && karte.active) { setTimeout(los, 400); return; }
      scene._dialogOpen = true;
      var fertig = function () { scene._dialogOpen = false; };
      if (!spielen(scene, id, fertig, fertig)) fertig();
    };
    setTimeout(los, 600);
    return true;
  }

  window.ElaraSzene = {
    SZENEN: SZENEN,
    bildKey: bildKey,
    bildPfad: bildPfad,
    schritte: schritte,
    vorladen: vorladen,
    spielen: spielen,
    vorschau: vorschau
  };
})();
