/* =====================================================================
 * tiefenSzene.js: Harrens Abstieg und Aldrics Ende als Zwischenszenen (v6.1)
 * ---------------------------------------------------------------------
 * Die Begegnungen auf dem Weg nach unten (roomManager._tiefenBegegnung)
 * liefen bisher als Textdialog ueber dem Raum. Jetzt spielt jede auf
 * PixelLab-Tableaus (384x192), im Stil von Bruchnacht und Wiedersehen:
 *
 *   abstieg1  wand        Harren an der Wand im Gang, ohne Amulett
 *   abstieg2  stufe       Harren auf einer Stufe, Reif im Bart
 *   abstieg3  schacht     Harren am Rand des gluehenden Schachts ("Lene")
 *   aldric    biegung     Mara an der Biegung, die Lampe abgeblendet
 *             leer        Aldric am Boden, ohne Mantel und Ring
 *             erzaehlt    er sieht auf seine Haende, waehrend Du erzaehlst
 *             geschwiegen er bleibt allein im Dunkeln zurueck
 *
 * Bedienung wie bei den anderen Szenen: Bild faehrt langsam heran, Text
 * Wort fuer Wort, erste Taste/Klick zeigt die Zeile ganz, die naechste
 * blaettert. ESC oder "Ueberspringen" springt zur offenen Wahl (eine Wahl
 * wird nie uebersprungen, Aldrics Antwort liest der Epilog) und beendet die
 * Szene erst danach. Die Wahl nimmt nur Klicks. Die Spieluhr steht.
 *
 * Fehlen die Bilder, ruft spielen() den Rueckfall des Aufrufers (die
 * fruehere Textfassung in roomManager).
 *
 * Debug: ?abstieg=1..3 und ?aldric=1|erzaehlt|geschwiegen zeigen die Szene
 * beim Hub-Eintritt, ohne Flaggen zu setzen (docs/debug-modus.md).
 * ===================================================================== */
(function () {
  'use strict';

  var TIEFE = 6000;
  var SPERRE_MS = 350;      // der E-Druck, der die Szene ausgeloest hat, zaehlt nicht
  var BLENDE_MS = 900;
  var MIN_TREFFER = 44;

  function _en() { return !!(window.i18n && typeof window.i18n.getLanguage === 'function' && window.i18n.getLanguage() === 'en'); }
  function _t(de, en) { return _en() ? en : de; }

  // Je Szene: Ordner, Bilder (Dateiname = Ordnername_bild), Fokus fuer die Fahrt.
  var SZENEN = {
    abstieg1: { ordner: 'abstieg', bilder: ['wand'], fokus: { wand: [0.62, 0.6] } },
    abstieg2: { ordner: 'abstieg', bilder: ['stufe'], fokus: { stufe: [0.56, 0.68] } },
    abstieg3: { ordner: 'abstieg', bilder: ['schacht'], fokus: { schacht: [0.45, 0.6] } },
    aldric: { ordner: 'aldricende', bilder: ['biegung', 'leer', 'erzaehlt', 'geschwiegen'],
      fokus: { biegung: [0.4, 0.6], leer: [0.5, 0.6], erzaehlt: [0.4, 0.6], geschwiegen: [0.3, 0.65] } }
  };

  function bildKey(id, n) { return SZENEN[id].ordner + '_' + n; }
  function bildPfad(id, n) { return 'assets/sprites/' + SZENEN[id].ordner + '/' + bildKey(id, n) + '.png'; }

  function titel(id) {
    if (id === 'aldric') return _t('Die letzte Wache', 'The Last Watch');
    return _t('Harrens Abstieg', 'Harren\'s Descent');
  }

  /**
   * Die Schritte einer Szene in der gerade gewaehlten Sprache. Ein Schritt
   * ist eine Zeile ({bild, text}) oder eine Wahl ({bild, wahl}); jede
   * Antwort bringt ihre eigenen Zeilen und darf das Bild wechseln.
   */
  function schritte(id) {
    if (id === 'abstieg1') return [
      { bild: 'wand', text: _t('(Mitten im Gang, an die Wand gelehnt: Harren. Kein Amulett, nur sein Mantel, schwer vom Nebel. Er hat auf Dich gewartet.)',
        '(In the middle of the passage, leaning against the wall: Harren. No amulet, only his coat, heavy with fog. He has been waiting for you.)') },
      { bild: 'wand', text: _t('HARREN: Archivschmied. Gut. Ich wusste, dass Du hier entlang kommst.', 'HARREN: Archivesmith. Good. I knew you would come this way.') },
      { bild: 'wand', text: _t('HARREN: Sie sagen, ich hätte ein Amt. Oben.', 'HARREN: They say I hold an office. Up above.') },
      { bild: 'wand', text: _t('(Er tastet nach der Kette um seinen Hals und findet sie nicht.)', '(He gropes for the chain around his neck and does not find it.)') },
      { bild: 'wand', text: _t('HARREN: Ich weiss nicht mehr, welches. Es war wohl nicht wichtig.', 'HARREN: I no longer know which. It cannot have mattered much.') },
      { bild: 'wand', wahl: {
        prompt: _t('HARREN: Ich weiss nicht mehr, welches. Es war wohl nicht wichtig.', 'HARREN: I no longer know which. It cannot have mattered much.'),
        wahlen: [
          { label: _t('Geh zurück nach oben, Harren.', 'Go back up, Harren.'),
            antwort: [_t('HARREN: Oben wartet niemand auf mich. Sie ist unten.', 'HARREN: Nobody is waiting for me up there. She is down here.')] },
          { label: _t('Bleib bei mir.', 'Stay with me.'),
            antwort: [_t('HARREN: Geh Du voraus. Ich finde den Weg. Ich muss nur an sie denken.', 'HARREN: You go ahead. I will find the way. I only have to think of her.')] }
        ] } }
    ];
    if (id === 'abstieg2') return [
      { bild: 'stufe', text: _t('(Harren sitzt auf einer Stufe und sieht Dir entgegen. Der Nebel hängt in seinem Bart wie Reif.)',
        '(Harren sits on a step and watches you come. The fog hangs in his beard like frost.)') },
      { bild: 'stufe', text: _t('HARREN: Archivschmied. Du kommst von oben? (Er runzelt die Stirn.) Was ist oben?',
        'HARREN: Archivesmith. You come from above? (He frowns.) What is above?') },
      { bild: 'stufe', text: _t('HARREN: Da war eine Stadt, glaube ich. Ein Platz mit einem Brunnen. Und ein Fenster, in das ich jeden Abend ein Licht gestellt habe.',
        'HARREN: There was a city, I think. A square with a fountain. And a window where I put a light every evening.') },
      { bild: 'stufe', text: _t('HARREN: (Er schüttelt den Kopf.) Wie sie hiess, weiss ich nicht mehr. Nur das Licht.',
        'HARREN: (He shakes his head.) What it was called, I no longer know. Only the light.') },
      { bild: 'stufe', wahl: {
        prompt: _t('HARREN: Wie sie hiess, weiss ich nicht mehr. Nur das Licht.', 'HARREN: What it was called, I no longer know. Only the light.'),
        wahlen: [
          { label: _t('Fogreach. Die Stadt heisst Fogreach.', 'Fogreach. The city is called Fogreach.'),
            antwort: [_t('(Er wiederholt es leise, zweimal. Es bleibt nicht.)', '(He repeats it quietly, twice. It does not stay.)'),
              _t('HARREN: Danke. Sag es mir noch einmal, wenn wir uns wiedersehen.', 'HARREN: Thank you. Tell me again when we meet next.')] },
          { label: _t('(schweigen)', '(stay silent)'),
            antwort: [_t('(Er wartet nicht auf eine Antwort. Er steht auf und geht weiter hinab.)', '(He does not wait for an answer. He gets up and goes on down.)')] }
        ] } }
    ];
    if (id === 'abstieg3') return [
      { bild: 'schacht', text: _t('(Harren steht am Rand eines Schachts und sieht hinunter, wo es rot glimmt.)',
        '(Harren stands at the edge of a shaft and looks down to where something glows red.)') },
      { bild: 'schacht', text: _t('(Als Du näher kommst, dreht er sich um. In seinem Blick ist nichts mehr, das Dich kennt.)',
        '(As you come closer he turns. There is nothing left in his eyes that knows you.)') },
      { bild: 'schacht', text: _t('HARREN: Lene.', 'HARREN: Lene.') },
      { bild: 'schacht', text: _t('(Mehr sagt er nicht, und er sagt es nicht zu Dir. Dann geht er weiter, hinab, auf die Glut zu.)',
        '(That is all he says, and he does not say it to you. Then he goes on, down, towards the glow.)') }
    ];
    if (id === 'aldric') return [
      { bild: 'biegung', text: _t('(Mara wartet an einer Biegung, die Lampe abgeblendet. Sie sagt nichts, sie nickt nur in die Kammer dahinter.)',
        '(Mara waits at a bend, her lamp shuttered. She says nothing, she only nods towards the chamber beyond.)') },
      { bild: 'leer', text: _t('(Auf dem Boden, an die Wand gelehnt: Aldric. Kein Mantel, kein Siegelring.)',
        '(On the floor, leaning against the wall: Aldric. No coat, no signet ring.)') },
      { bild: 'leer', text: _t('(Seine Augen gehen über Dich hinweg, so wie Deine damals in der Schmiede über alles hinweggingen.)',
        '(His eyes pass over you, the way yours once passed over everything in the smithy.)') },
      { bild: 'leer', text: _t('ALDRIC: Du... kennst Du mich? Weisst Du, wer ich bin?', 'ALDRIC: You... do you know me? Do you know who I am?') },
      { bild: 'leer', wahl: {
        prompt: _t('ALDRIC: Weisst Du, wer ich bin?', 'ALDRIC: Do you know who I am?'),
        wahlen: [
          { label: _t('Ihm sagen, wer er war', 'Tell him who he was'), flags: ['aldric_erzaehlt'], bild: 'erzaehlt', variante: 'erzaehlt',
            antwort: [_t('(Du sagst es ihm. Ratsherr Aldric. Der Kettenrat, die Esse, die Phiolen, Dein eigener Amboss.)',
                '(You tell him. Councillor Aldric. The Chain Council, the Furnace, the vials, your own anvil.)'),
              _t('(Er hört zu wie jemand, dem man von einem Fremden erzählt.)', '(He listens like someone being told about a stranger.)'),
              _t('ALDRIC: Das klingt nach einem schlechten Menschen. (Er sieht auf seine Hände.) Danke, dass Du es mir gesagt hast.',
                'ALDRIC: That sounds like a bad man. (He looks at his hands.) Thank you for telling me.')] },
          { label: _t('Schweigen', 'Stay silent'), flags: ['aldric_verschwiegen'], bild: 'geschwiegen', variante: 'geschwiegen',
            antwort: [_t('(Du sagst nichts. Er wartet, dann senkt er den Blick.)', '(You say nothing. He waits, then lowers his eyes.)'),
              _t('ALDRIC: Schon gut. Vielleicht ist es besser so.', 'ALDRIC: Never mind. Perhaps it is better this way.'),
              _t('(Der Mann, der andere geleert hat, ist selbst leer. Seine Geschichte bleibt bei Dir.)',
                '(The man who emptied others is empty himself. His story stays with you.)')] }
        ] } },
      { text: _t('MARA: (leise) Lass ihn hier. Hier unten tut er niemandem mehr etwas.',
        'MARA: (quietly) Leave him here. Down here he can no longer hurt anyone.') }
    ];
    return [];
  }

  function _alleDa(scene, id) {
    return SZENEN[id].bilder.every(function (n) { return scene.textures.exists(bildKey(id, n)); });
  }

  /** Bilder nachladen; fertig(true), wenn danach alle da sind. */
  function vorladen(scene, id, fertig) {
    var melden = function () { if (typeof fertig === 'function') fertig(_alleDa(scene, id)); };
    if (!SZENEN[id] || !scene || !scene.textures || !scene.load) { if (typeof fertig === 'function') fertig(false); return; }
    if (_alleDa(scene, id)) { melden(); return; }
    SZENEN[id].bilder.forEach(function (n) {
      if (!scene.textures.exists(bildKey(id, n))) scene.load.image(bildKey(id, n), bildPfad(id, n));
    });
    scene.load.once('complete', melden);
    try { if (!scene.load.isLoading()) scene.load.start(); } catch (e) { melden(); }
  }

  function _fest(o) {
    if (!o) return;
    if (typeof o.setScrollFactor === 'function') o.setScrollFactor(0);
    if (o.list) o.list.forEach(_fest);
  }

  function _mobil(scene) {
    try { return !!(scene.sys.game.device && !scene.sys.game.device.os.desktop); } catch (e) { return false; }
  }

  /** "HARREN: Text" -> Sprecher und Rede; "(Erzaehlung)" ohne Klammern. */
  function _teilen(zeile) {
    var m = /^([A-ZÄÖÜ][A-ZÄÖÜ ]+):\s*([\s\S]*)$/.exec(zeile || '');
    if (m) return { sprecher: m[1], rede: m[2], erzaehlt: false };
    var e = /^\(([\s\S]*)\)$/.exec(zeile || '');
    return { sprecher: '', rede: e ? e[1] : String(zeile || ''), erzaehlt: true };
  }

  /**
   * Die Szene spielen. Liefert false, wenn sie hier nicht laufen kann (kein
   * Phaser): dann erzaehlt der Aufrufer die Textfassung.
   * @param {function} [onDone]     laeuft nach dem Ende, mit der gewaehlten
   *                                Variante ('erzaehlt'|'geschwiegen'|null)
   * @param {function} [rueckfall]  laeuft statt der Szene, wenn die Bilder fehlen
   * @param {object} [opt]  { probe: keine Flaggen setzen, variante: Wahl vorweg }
   */
  function spielen(scene, id, onDone, rueckfall, opt) {
    if (!SZENEN[id]) return false;
    if (!scene || !scene.add || !scene.add.image || !scene.textures || !scene.tweens || !scene.cameras) return false;
    if (scene.__tiefenSzene && scene.__tiefenSzene.offen()) return true;
    if (_alleDa(scene, id)) { zeigen(scene, id, onDone, opt || {}); return true; }
    if (!scene.load) return false;
    // Bis die Bilder da sind, darf im Dungeon nichts weiterlaufen.
    if (typeof window.pauseGameClock === 'function') { try { window.pauseGameClock(scene); } catch (e) {} }
    var choiceVorher = window.eventChoiceOpen;
    window.eventChoiceOpen = true;
    vorladen(scene, id, function (da) {
      window.eventChoiceOpen = choiceVorher;
      if (typeof window.resumeGameClock === 'function') { try { window.resumeGameClock(scene); } catch (e) {} }
      if (!scene.sys || !scene.sys.isActive || !scene.sys.isActive()) return;
      if (da) zeigen(scene, id, onDone, opt || {});
      else if (typeof rueckfall === 'function') rueckfall();
      else if (typeof onDone === 'function') onDone(null);
    });
    return true;
  }

  function zeigen(scene, id, onDone, opt) {
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
    var variante = null;
    var tweens = [];
    function tween(cfg) { try { var t = scene.tweens.add(cfg); tweens.push(t); return t; } catch (e) { return null; } }

    // Debug: die Wahl steht schon fest, ihre Zeilen ersetzen die Auswahl.
    if (opt.variante) {
      liste.forEach(function (s, i) {
        if (!s.wahl) return;
        var w2 = s.wahl.wahlen.filter(function (x) { return x.variante === opt.variante; })[0];
        if (!w2) return;
        variante = w2.variante;
        var zeilen = w2.antwort.map(function (t) { return { bild: w2.bild || s.bild, text: t }; });
        liste.splice.apply(liste, [i, 1].concat(zeilen));
      });
    }

    var choiceVorher = window.eventChoiceOpen;
    window.eventChoiceOpen = true;   // keine Angriffe durch die Szene hindurch
    if (typeof window.pauseGameClock === 'function') { try { window.pauseGameClock(scene); } catch (e) {} }

    var c = scene.add.container(0, 0).setDepth(TIEFE).setName('tiefenSzene');
    var grund = scene.add.rectangle(w / 2, h / 2, w + 40, h + 40, 0x000000, 1).setName('tiefenSzeneGrund');
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
      var b = scene.add.image(0, 0, bildKey(id, n)).setOrigin(f[0], f[1]).setAlpha(0);
      b.setName('tiefenSzeneBild_' + n);
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
      tween({ targets: neu, scale: neu.__basis * 1.07, duration: 26000, ease: 'Sine.easeOut' });
    }

    var kopf = scene.add.text(w / 2, 22, titel(id), {
      fontFamily: 'serif', fontSize: 24, color: '#e8d6b0', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5, 0).setAlpha(0).setName('tiefenSzeneTitel');
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
    skipFeld.setName('tiefenSzeneUeberspringen');
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
    }).setName('tiefenSzeneSprecher');
    var hinweis = scene.add.text(w / 2 + tpW / 2 - 26, tpY + tpH / 2 - 9, _t('Weiter', 'Continue'), {
      fontFamily: 'monospace', fontSize: 14, color: '#c8bca4'
    }).setOrigin(1, 1).setAlpha(0).setName('tiefenSzeneWeiter');
    var rede = scene.add.text(w / 2, 0, '', {
      fontFamily: 'serif', fontSize: 18, color: '#f1e9d8', align: 'center',
      wordWrap: { width: tpW - 72 }, lineSpacing: 5
    }).setOrigin(0.5, 0).setName('tiefenSzeneText');
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
      variante: function () { return variante; },
      laeuft: function () { return !!(lauf && lauf.laeuft()); }
    };
    scene.__tiefenSzene = zustand;

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
    // kommen direkt danach, auf dem Bild der gewaehlten Antwort.
    function wahlZeigen(s) {
      var DC = window.DialogChoice;
      var wahlen = s.wahl.wahlen;
      var antwortEinfuegen = function (gewaehlt) {
        if (!gewaehlt) return;
        if (gewaehlt.variante) variante = gewaehlt.variante;
        var zeilen = gewaehlt.antwort.map(function (t) { return { bild: gewaehlt.bild || s.bild, text: t }; });
        liste.splice.apply(liste, [nr + 1, 0].concat(zeilen));
      };
      if (!DC || typeof DC.present !== 'function') {
        // Ohne Auswahl-Baustein die erste Antwort (sollte nie vorkommen).
        if (!opt.probe) (wahlen[0].flags || []).forEach(_flagSetzen);
        antwortEinfuegen(wahlen[0]);
        naechster();
        return;
      }
      zustand.phase = 'wahl';
      textC.setVisible(false);
      hinweisZeigen(false);
      if (lauf) { try { lauf.abbrechen(); } catch (e) {} lauf = null; }
      var vorher = scene.children.list.slice();
      wahl = DC.present(scene, {
        prompt: s.wahl.prompt,
        noCancel: true,
        choices: wahlen.map(function (x) { return { label: x.label, setFlags: opt.probe ? [] : (x.flags || []).slice() }; }),
        onResolved: function (r) {
          wahl = null;
          if (zu) return;
          antwortEinfuegen(r ? wahlen[r.index] : null);
          naechster();
        }
      });
      scene.children.list.forEach(function (o) {
        if (vorher.indexOf(o) < 0 && o.name === 'dialogChoiceContainer') {
          o.setDepth(TIEFE + 20);
          try { var r = o.getBounds(); o.y += Math.max(0, (h - 10) - (r.y + r.height)); } catch (e) {}
        }
      });
      zustand.wahlOffen = wahl;
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
      if (scene.__tiefenSzene === zustand) scene.__tiefenSzene = null;
      if (typeof window.resumeGameClock === 'function') { try { window.resumeGameClock(scene); } catch (e) {} }
      return true;
    }
    function schliessen() {
      if (!aufraeumen()) return;
      // Dieselbe Taste, die die Szene schliesst, soll im Raum nicht zuschlagen.
      setTimeout(function () { window.eventChoiceOpen = choiceVorher; }, 150);
      if (typeof onDone === 'function') { try { onDone(variante); } catch (e) {} }
    }
    function beiEnde() { aufraeumen(); window.eventChoiceOpen = choiceVorher; }

    function weiter() {
      if (zu || zustand.phase !== 'zeile') return;     // nie in die Wahl hinein
      if (Date.now() - start < SPERRE_MS) return;
      if (lauf && lauf.ueberspringen()) return;        // erste Taste: Zeile ganz zeigen
      naechster();
    }
    // ESC/Knopf: zur offenen Wahl springen, sonst beenden. Eine Wahl wird
    // nie uebersprungen (Aldrics Antwort liest der Epilog).
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
    naechster();
    return zustand;
  }

  function _flagSetzen(f) {
    var qs = window.questSystem;
    if (qs && typeof qs.setFlag === 'function') qs.setFlag(f);
  }

  /**
   * Debug ?abstieg=1..3 bzw. ?aldric=1|erzaehlt|geschwiegen: die Szene beim
   * Hub-Eintritt einmal pro Laden zeigen. Setzt keine Flaggen.
   */
  var _probeGezeigt = false;
  function probe(scene, fertig) {
    var G = window.DebugGate;
    if (_probeGezeigt || !G || typeof G.flagge !== 'function') return false;
    var a = G.flagge('abstieg'), b = G.flagge('aldric');
    var id = null, opt = { probe: true };
    if (a && /^[123]$/.test(a)) id = 'abstieg' + a;
    else if (b && b !== '0') {
      id = 'aldric';
      if (b === 'erzaehlt' || b === 'geschwiegen') opt.variante = b;
    }
    if (!id) return false;
    _probeGezeigt = true;
    return spielen(scene, id, fertig, fertig, opt);
  }

  window.TiefenSzene = {
    SZENEN: SZENEN,
    bildKey: bildKey,
    bildPfad: bildPfad,
    schritte: schritte,
    vorladen: vorladen,
    spielen: spielen,
    probe: probe
  };
})();
