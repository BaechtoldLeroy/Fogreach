// js/storyScenes.js — inszenierte Schlüsselszenen (Feature 063 WP04).
//
// Drei Beats als Overlay-Inszenierungen im bestehenden Szenen-Kontext, gerendert
// über window.DialogChoice (WP02) + einfache Tweens/Kamera. Story v4 §13.1-13.3.
//   playOeffentlicheSitzung -> #159: die Ratssitzung vor den Buergern (Ratssaal),
//                            feuert observe oeffentliche_sitzung.
//   playGeheimeSitzung    -> #159: die geheime Sitzung, belauscht im Dungeon
//                            (Spionage in der Ratskammer), mit dem Zeichen.
//   Beide Sitzungen spielen auf der gemalten Buehne (js/sitzungsBuehne.js,
//   #166/#167), ein Sprecher pro Seite, und halten nach jeder Seite an.
//   playElaraFirstCrack   -> Elaras erster Riss, feuert observe erster_riss_gesehen.
//   playWiedersehen       -> #155: Harren sieht seine Tochter wieder (Ende Akt 2).
//   playNachtNachDemBruch -> #155: Elara versteckt Dich nach dem Bruch.
//   playMaulwurfEnthuellung -> #155: Du siehst Elara mit Aldric, das Zeichen am Ring.
//   (Das fruehere Elara-Lager ist die Werkstatt-Szene im Dungeon, roomManager.js.)
//
// Einheitliche Signatur (scene, onDone). Defensiv: fehlt DialogChoice/questSystem,
// läuft die Szene minimal ab statt zu crashen. Alle GameObjects scrollFactor(0).
// Szenenübergreifende Zeit über Date.now().
(function () {
  'use strict';

  // Wie lange der fertige Text noch stehen bleibt, bevor die Szene weitergeht.
  // Frueher war das die GESAMTE Anzeigedauer (900 ms fuer zwei Saetze); jetzt
  // laeuft sie erst NACH dem Aufbau an.

  // #87: zweisprachig wie js/finale.js.
  function _en() { return !!(window.i18n && typeof window.i18n.getLanguage === 'function' && window.i18n.getLanguage() === 'en'); }
  function _t(de, en) { return _en() ? en : de; }

  function _fireObserve(target) {
    if (window.questSystem && typeof window.questSystem.updateQuestProgress === 'function') {
      window.questSystem.updateQuestProgress('observe', target, 1);
    }
  }

  function _lines(scene, arr, cx, cy) {
    var text = scene.add.text(cx, cy, arr.join('\n\n'), {
      fontFamily: 'monospace', fontSize: 15, color: '#d8d2c3',
      align: 'center', wordWrap: { width: 520 }, lineSpacing: 4
    }).setOrigin(0.5, 0.5).setDepth(1550).setScrollFactor(0);
    return text;
  }

  /**
   * Wie _lines, aber der Text baut sich Wort fuer Wort auf (#139).
   *
   * Der volle Text wird zuerst gesetzt und damit VERMESSEN — bei origin
   * 0.5/0.5 waechst der Block sonst waehrend des Schreibens aus der Mitte
   * heraus, und die Zeilen wandern unter dem Lesen weg.
   *
   * Der Sprecher kommt aus der ersten Zeile, die mit "NAME:" beginnt. Damit
   * klingt Elara ueberall gleich, ohne dass hier eine Stimmentabelle stuende.
   *
   * @param {function} [fertig]  laeuft, wenn der Aufbau durch ist
   */
  function _zeilenAufbauen(scene, arr, cx, cy, fertig) {
    var text = _lines(scene, arr, cx, cy);
    var voll = arr.join('\n\n');
    var sprecher = '';
    for (var i = 0; i < arr.length; i++) {
      var m = /^([A-ZÄÖÜ][A-ZÄÖÜ ]+):/.exec(arr[i] || '');
      if (m) { sprecher = m[1]; break; }
    }
    var TW = window.DialogTypewriter;
    if (!TW || typeof TW.anTextobjekt !== 'function') {
      if (typeof fertig === 'function') fertig();
      return { text: text, lauf: null };
    }
    var lauf = TW.anTextobjekt(scene, text, voll, { sprecher: sprecher, onFertig: fertig });

    // Klicken ueberspringt den Aufbau — dieselbe Geste wie im Hub. Eine Taste
    // ebenso: vorher tat sie waehrend des Aufbaus gar nichts, und wer wie in
    // jedem anderen Dialog drueckte, um den Satz zu Ende zu sehen, wartete.
    if (scene.input && typeof scene.input.on === 'function') {
      var beiKlick = function () { lauf.ueberspringen(); };
      var beiTaste = function (ev) {
        if (ev && ev.repeat) return;
        lauf.ueberspringen();
      };
      scene.input.on('pointerdown', beiKlick);
      var kb = scene.input.keyboard;
      if (kb && typeof kb.on === 'function') kb.on('keydown', beiTaste);
      // Loesbar, BEVOR der Weiter-Halt bindet: sonst wuerde ein einziger
      // Klick beides ausloesen — ueberspringen und gleich weiterschalten.
      // (Der Halt bindet im selben Tastendruck, der hier ueberspringt; Phaser
      // ruft dabei nur die Hoerer, die vor dem Druck schon standen.)
      lauf.skipLoesen = function () {
        try { scene.input.off('pointerdown', beiKlick); } catch (e) {}
        try { if (kb && typeof kb.off === 'function') kb.off('keydown', beiTaste); } catch (e) {}
        lauf.skipLoesen = function () {};
      };
      var altAbbrechen = lauf.abbrechen;
      lauf.abbrechen = function () {
        lauf.skipLoesen();
        altAbbrechen();
      };
    }
    return { text: text, lauf: lauf };
  }

  /**
   * Haelt die Szene an, bis der Spieler weiterwinkt.
   *
   * Vorher lief sie nach einer festen Lesepause von selbst weiter. Wer
   * langsamer liest — oder waehrend der Zeile kurz wegschaut — verlor den
   * Satz, und die Szenen tragen die Geschichte. Ein Hinweis sagt jetzt, dass
   * es an einem liegt, und nichts verschwindet ungefragt.
   *
   * @param {object} auf  Rueckgabe von _zeilenAufbauen (fuer skipLoesen)
   * @param {function} weiter  laeuft genau einmal
   */
  function _warteAufWeiter(scene, auf, cx, cy, weiter) {
    var fertig = false;
    var hinweis = null;
    var loesen = function () {};
    var ausloesen = function () {
      if (fertig) return;
      fertig = true;
      loesen();
      if (hinweis && hinweis.destroy) hinweis.destroy();
      try { if (scene.__szeneWartet && scene.__szeneWartet.ausloesen === ausloesen) scene.__szeneWartet = null; } catch (e) {}
      weiter();
    };
    // Ohne Eingabe (Testkopf ohne Tastatur) sofort weiter — eine Szene darf
    // nie haengenbleiben, nur weil eine Bindung fehlt.
    if (!scene || !scene.input) { ausloesen(); return { ausloesen: ausloesen }; }
    if (auf && auf.lauf && typeof auf.lauf.skipLoesen === 'function') auf.lauf.skipLoesen();

    try {
      var cam = scene.cameras && scene.cameras.main;
      hinweis = scene.add.text(cx, cy + (cam ? cam.height * 0.30 : 160),
        _t('Taste drücken', 'Press any key'), {
          fontFamily: 'monospace', fontSize: 13, color: '#8a8478'
        }).setOrigin(0.5).setDepth(1552).setScrollFactor(0);
      if (scene.tweens) {
        scene.tweens.add({ targets: hinweis, alpha: 0.35, duration: 900,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    } catch (e) { hinweis = null; }

    // Eine gehaltene Taste wiederholt sich; sie soll nicht durch alle Seiten
    // einer Sitzung blaettern.
    var beiTaste = function (ev) { if (ev && ev.repeat) return; ausloesen(); };
    var gebunden = [];
    try {
      if (scene.input.keyboard && typeof scene.input.keyboard.on === 'function') {
        scene.input.keyboard.on('keydown', beiTaste);
        gebunden.push(function () { scene.input.keyboard.off('keydown', beiTaste); });
      }
      if (typeof scene.input.on === 'function') {
        scene.input.on('pointerdown', beiTaste);
        gebunden.push(function () { scene.input.off('pointerdown', beiTaste); });
      }
    } catch (e) {}
    loesen = function () { gebunden.forEach(function (f) { try { f(); } catch (e) {} }); };
    // Offenlegen, damit der Testkopf den Halt aufloesen kann, ohne eine
    // echte Tastatur nachzubauen.
    scene.__szeneWartet = { ausloesen: ausloesen, gebunden: gebunden.length };
    if (!gebunden.length) { ausloesen(); }
    return { ausloesen: ausloesen };
  }

  function _choiceOrDone(scene, sceneKey, onFinished) {
    var cfg = (window.storyDialog && window.storyDialog.byScene && window.storyDialog.byScene[sceneKey]) || null;
    if (cfg && window.DialogChoice && typeof window.DialogChoice.present === 'function') {
      window.DialogChoice.present(scene, {
        prompt: cfg.prompt,
        choices: cfg.choices,
        onResolved: function () { onFinished(); }
      });
    } else {
      onFinished();
    }
  }

  // --- #159 Die oeffentliche Ratssitzung (Ratssaal) --------------------------
  // Die Scheindemokratie ZEIGEN statt erklaeren (Story-Bibel v5): drei Pulte,
  // drei Farben, die Buerger rufen durcheinander — es sieht aus wie eine Wahl.
  // Direkt danach belauscht der Spieler dieselben drei in der Nacht.
  function _ratssaal(scene, cx, cy) {
    var teile = [];
    var cam = scene.cameras.main;
    var w = cam.width, h = cam.height;
    var g = scene.add.graphics().setDepth(1548).setScrollFactor(0);
    g.fillStyle(0x0c0b10, 0.9); g.fillRect(0, 0, w, h);
    // Drei Pulte in den Farben der Fraktionen, oben im Bild.
    var farben = [0x3a5a9a, 0xc8b26a, 0x9a3a3a];
    var namen = _en() ? ['MAGISTRATE', 'CLERGY', 'GUARD'] : ['MAGISTRAT', 'KLERUS', 'GARDE'];
    for (var i = 0; i < 3; i++) {
      var px = w / 2 + (i - 1) * 170;
      g.fillStyle(farben[i], 0.9); g.fillRect(px - 50, 40, 100, 58);
      g.fillStyle(0x2a2420, 1); g.fillRect(px - 60, 98, 120, 16);
      var t = scene.add.text(px, 69, namen[i], {
        fontFamily: 'monospace', fontSize: 12, color: '#f0ead8'
      }).setOrigin(0.5).setDepth(1549).setScrollFactor(0);
      teile.push(t);
    }
    // Die Buerger: eine Reihe Koepfe am unteren Rand.
    g.fillStyle(0x1e1c24, 1);
    for (var k = 0; k < 22; k++) {
      var bx = 20 + k * (w - 40) / 21, by = h - 34 + (k % 3) * 6;
      g.fillCircle(bx, by, 14); g.fillRect(bx - 16, by + 10, 32, 30);
    }
    teile.push(g);
    return teile;
  }

  // #160: Welches Edikt hat die Abstimmung gewonnen? Das, das oben hing.
  function _siegerText(s) {
    var de = {
      magistrat: 'Die Stimmen sind gezählt. Gewonnen hat das Edikt des Magistrats.',
      klerus: 'Die Stimmen sind gezählt. Gewonnen hat das Edikt des Klerus.',
      garde: 'Die Stimmen sind gezählt. Gewonnen hat das Edikt der Garde.'
    };
    var en = {
      magistrat: "The votes are counted. The Magistrate's edict has won.",
      klerus: "The votes are counted. The Clergy's edict has won.",
      garde: "The votes are counted. The Guard's edict has won."
    };
    return (_en() ? en : de)[s];
  }
  function ediktSieger() {
    var qs = window.questSystem;
    var f = function (n) { return !!(qs && typeof qs.hasFlag === 'function' && qs.hasFlag(n)); };
    if (f('edikt_garde')) return 'garde';
    if (f('edikt_klerus')) return 'klerus';
    if (f('edikt_magistrat')) return 'magistrat';
    return null;
  }

  // Die Seiten der oeffentlichen Sitzung. Jeder Sprecher und jede Erzaehlzeile
  // ist eine eigene Seite: die Szene haelt nach jeder an, bis der Spieler
  // weiterwinkt. Frueher stand alles auf einer Seite und lief in einem Zug
  // durch — der Streit der drei soll aber Wortmeldung fuer Wortmeldung kommen.
  function _seitenOeffentlich() {
    var sieger = ediktSieger();
    var zeilen = [_t('(Der Ratssaal ist voll. Bürger bis an die Wände. Vorn drei Pulte, drei Farben.)', '(The council hall is full. Citizens up to the walls. At the front three lecterns, three colors.)')];
    // #160: Die Sitzung verkuendet das Ergebnis der Abstimmung.
    if (sieger) {
      zeilen.push(_t('MAGISTRAT: ', 'MAGISTRATE: ') + _siegerText(sieger));
      zeilen.push(_t('(Es ist das Plakat, das ganz oben hing.)', '(It is the poster that hung at the very top.)'));
    }
    zeilen.push(
      _t('KLERUS: Ein Edikt ist beschlossen, und trotzdem verliert die Stadt ihre Seele, während der Magistrat Münzen zählt!', 'CLERGY: An edict is passed, and still the city loses its soul while the Magistrate counts coins!'),
      // v6.1: Das Ergebnis wird oeffentlich verkuendet, und gleich was gewann,
      // die Patrouillen verdoppeln sich.
      _t('GARDE: Streitet Ihr nur. Ab morgen verdoppeln sich die Patrouillen, gleich welches Edikt gilt. Dann ist Ruhe.', 'GUARD: You go on arguing. From tomorrow the patrols are doubled, whichever edict holds. Then there will be peace.'),
      _t('(Die Bürger rufen durcheinander. Jeder hat eine Seite gewählt. Es sieht aus wie eine Wahl.)', '(The citizens shout over each other. Everyone has picked a side. It looks like a choice.)')
    );
    return zeilen;
  }

  function playOeffentlicheSitzung(scene, onDone) {
    var seiten = _seitenOeffentlich();
    var ende = function () {
      // v6.1: verkuendet ist verkuendet. Die Patrouillen stehen ab jetzt doppelt
      // auf dem Platz (HubSceneV2), nicht erst nach der geheimen Sitzung.
      var qs = window.questSystem;
      if (qs && typeof qs.setFlag === 'function') { try { qs.setFlag('patrouillen_verdoppelt'); } catch (e) {} }
      _fireObserve('oeffentliche_sitzung');
      if (typeof onDone === 'function') onDone();
    };
    // #166: fest auf der gemalten Buehne (js/sitzungsBuehne.js). Die
    // gezeichneten Kaesten (_ratssaal) bleiben nur der Rueckfall, falls die
    // Buehne fehlt.
    var SB = window.SitzungsBuehne || null;
    if (SB) {
      SB.laden(scene, function () { _szeneSpielen(scene, seiten, 'oeffentliche_sitzung', ende, false, SB.oeffentlich, true); });
      return;
    }
    _szeneSpielen(scene, seiten, 'oeffentliche_sitzung', ende, false, _ratssaal, true);
  }

  // --- #159 Die geheime Sitzung, belauscht in der Ratskammer ----------------
  // Laeuft im Dungeon, wenn die Abhoerzone der Ratskammer abgehoert ist
  // (espionageSystem). Dieselben drei, dieselbe Nacht — und in zwei Saetzen
  // einig. Die Dialoge halten die Spieluhr an, die Wachen warten also.
  //
  // Ein Sprecher pro Seite, wie in der oeffentlichen Sitzung: die Einigung
  // der drei waren frueher drei Saetze auf einer Seite, jetzt hat jeder seine.
  // Die Erzaehlzeile nach Aldrics Lachen ("Du hast es selbst aufgehaengt")
  // steht allein: sie ist der Schlag, der sitzen soll.
  function _seitenGeheim() {
    var qs = window.questSystem;
    var flag = function (n) { return !!(qs && typeof qs.hasFlag === 'function' && qs.hasFlag(n)); };
    // #145: Die Siegel-Entscheidung aus Akt 1 kommt hier zurueck. v6.1:
    // verification_refused heisst jetzt "unbemerkt beschaedigt".
    // Verweigern hat Vorrang: alte Spielstaende tragen beide Flaggen, weil
    // magistrat_verification frueher 'verification_sealed' als Vorgabe setzte.
    var siegel = flag('verification_refused')
      ? _t('Eines der drei Siegel ist gesprungen. Im Wachs Dein Daumenabdruck. Keiner am Tisch hat es bemerkt. Geändert hat es nichts. Noch nicht.', 'One of the three seals is cracked. In the wax, your thumbprint. Nobody at the table has noticed. It changed nothing. Not yet.')
      : flag('verification_sealed')
        ? _t('Eines der drei Siegel kennst Du. Du hast es selbst unter ein Dokument gesetzt, damals, als es eine Formalie war.', 'You know one of the three seals. You put it under a document yourself, back when it was a formality.')
        : null;
    var seiten = [
      _t('(Die Ratskammer bei Nacht. Magistrat, Klerus und Garde legen die Farben ab. Vor ihnen ein einziges Blatt, drei Siegel, und auf jedem dasselbe Zeichen: drei Ketten, ineinander verschlungen.)', '(The council chamber at night. Magistrate, Clergy and Guard take off their colors. Before them a single sheet, three seals, and on each the same sign: three chains, intertwined.)'),
      _t('ALDRIC: Solange die Stadt glaubt, wir stritten, glaubt sie, sie habe eine Wahl.', 'ALDRIC: As long as the city believes we quarrel, it believes it has a choice.'),
      _t('KLERUS: Die Patrouillen sind verdoppelt. Das stand fest, bevor die erste Stimme gezählt war.', 'CLERGY: The patrols are doubled. That was settled before the first vote was counted.'),
      _t('GARDE: Wie jede Woche.', 'GUARD: Like every week.')
    ];
    // #160: Die Abstimmung. Gewonnen hat, was oben hing — und das wussten sie.
    if (ediktSieger()) {
      seiten.push(
        _t('ALDRIC: Und die Abstimmung? (Er lacht leise.) Wer oben hängt, gewinnt. Das weiss jeder, der je eine Wand beklebt hat. Wir lassen einen Handwerker kleben und nennen es den Willen der Stadt.', 'ALDRIC: And the vote? (He laughs quietly.) Whoever hangs on top wins. Anyone who has ever pasted up a wall knows that. We let a craftsman do the pasting and call it the will of the city.'),
        _t('(Du hast es selbst aufgehängt.)', '(You hung it up yourself.)'));
    }
    if (siegel) seiten.push(siegel);
    seiten.push(_t('(Du ziehst Dich zurück, bevor die Wachen die Runde drehen. Harren wartet oben.)', '(You withdraw before the guards make their round. Harren is waiting upstairs.)'));
    return seiten;
  }

  /** Die Seiten einer Sitzung ('oeffentlich' oder 'geheim'), so wie sie gerade spielen wuerde. */
  function sitzungSeiten(art) {
    return art === 'geheim' ? _seitenGeheim() : _seitenOeffentlich();
  }

  function playGeheimeSitzung(scene, onDone) {
    var ES = window.EventSystem;
    if (!scene || !ES || typeof ES.showEventChoiceDialog !== 'function') {
      if (typeof onDone === 'function') onDone();
      return false;
    }
    var seiten = _seitenGeheim();

    // #167: die drei sitzen sichtbar am Tisch (fest eingebaut, ohne Flagge).
    // Das Zeichen steht auf den drei Siegeln des Blattes statt gross darueber.
    // Die gezeichnete Fassung unten bleibt der Rueckfall ohne Buehne.
    var SB = window.SitzungsBuehne || null;
    if (SB) {
      // Bis die Bilder da sind, darf im Dungeon nichts weiterlaufen.
      if (typeof window.pauseGameClock === 'function') window.pauseGameClock(scene);
      SB.laden(scene, function () { _geheimMitBuehne(scene, SB, seiten, onDone); });
      return true;
    }

    // Das Zeichen ueber dem ersten Blatt: hier lernt der Spieler es kennen (#156).
    var bild = null;
    try {
      if (window.Zeichen && scene.cameras && scene.cameras.main) {
        var cam = scene.cameras.main;
        bild = window.Zeichen.bild(scene, cam.width / 2, cam.height / 2 - 150, 64);
        if (bild) bild.setDepth(2600).setScrollFactor(0);
      }
    } catch (e) { bild = null; }

    var i = 0;
    var naechste = function () {
      if (i === 1 && bild) { try { bild.destroy(); } catch (e) {} bild = null; }
      if (i >= seiten.length) {
        _fireObserve('collusion_reveal_seen');
        if (typeof onDone === 'function') onDone();
        return;
      }
      _sitzungsSeite(scene, seiten[i++], naechste);
    };
    naechste();
    return true;
  }

  /**
   * Eine Seite der geheimen Sitzung als Dialog mit "Weiter". Der Dialog nimmt
   * Leertaste, Enter und ESC schon selbst; E kommt hier dazu, weil es im
   * Dungeon die Taste fuer "weiter/benutzen" ist. Nur fuer die Sitzung: bei
   * anderen Ein-Knopf-Dialogen bliebe E der Faehigkeit vorbehalten.
   * Gibt die neu angelegten Objekte des Dialogs zurueck.
   */
  function _sitzungsSeite(scene, text, weiter) {
    var ES = window.EventSystem;
    var mitE = null;
    var tasteLoesen = function () {
      if (!mitE) return;
      try { scene.input.keyboard.off('keydown-E', mitE); } catch (e) {}
      mitE = null;
    };
    var vorher = scene.children ? scene.children.list.slice() : [];
    var dialog = ES.showEventChoiceDialog(scene, text, [{ label: _t('Weiter', 'Continue'), callback: function () {
      tasteLoesen();
      weiter();
    } }]);
    var neue = scene.children ? scene.children.list.filter(function (o) { return vorher.indexOf(o) < 0; }) : [];
    var knopf = neue.filter(function (o) { return o && o.type === 'Rectangle' && o.depth === 2502 && o.input; })[0];
    if (knopf && scene.input && scene.input.keyboard && typeof scene.input.keyboard.on === 'function') {
      mitE = function (ev) {
        // Gehaltenes E blaettert nicht durch alle Seiten.
        if (ev && ev.repeat) return;
        // Dasselbe E darf nicht zusaetzlich die Faehigkeit auf Slot 3 ausloesen.
        try { window.__eventConsumedEAt = Date.now(); window.__eventConsumedE = true; } catch (e) {}
        // Wie Leertaste und Enter: steht der Satz noch nicht ganz da, zeigt E
        // ihn erst zu Ende. Vorher blaetterte E mitten im Aufbau weiter.
        if (dialog && typeof dialog.ueberspringen === 'function' && dialog.ueberspringen()) return;
        knopf.emit('pointerdown');
      };
      scene.input.keyboard.on('keydown-E', mitE);
    }
    return neue;
  }

  // Dieselben Seiten wie oben, aber vor der Kammer mit den drei am Tisch.
  // Der Dialog rueckt unter die Figuren; wer spricht, tritt hervor.
  function _geheimMitBuehne(scene, SB, seiten, onDone) {
    var buehne = SB.geheim(scene);
    var i = 0;
    var naechste = function () {
      if (i >= seiten.length) {
        buehne.destroy();
        _fireObserve('collusion_reveal_seen');
        if (typeof onDone === 'function') onDone();
        return;
      }
      var neue = _sitzungsSeite(scene, seiten[i++], naechste);
      var titel = SB.dialogUnterBuehne(scene, neue, buehne.textOben);
      if (titel) buehne.folgen(titel);
    };
    naechste();
  }

  // --- 13.3 Elaras erster Riss -----------------------------------------------
  function playElaraFirstCrack(scene, onDone) {
    var cam = scene.cameras.main;
    var cx = cam.width / 2, cy = cam.height / 2 - 20;
    // Die Lesepause laeuft erst, wenn der Text fertig geschrieben ist.
    // Vorher stand hier eine feste Verzoegerung von 900 ms — sie haette
    // den Aufbau mitten im Satz abgeschnitten.
    var auf = _zeilenAufbauen(scene, [
      _t('(Ein Bote bringt eine Meldung. Elara liest, faltet das Blatt weg.)', '(A messenger brings a report. Elara reads it and folds the sheet away.)'),
      _t('ELARA: Das kommt nicht in die Presse.', 'ELARA: This does not go to the press.')
    ], cx, cy, function () {
      _warteAufWeiter(scene, auf, cx, cy, step);
    });
    var intro = auf.text;
    function step() {
      if (auf.lauf) auf.lauf.abbrechen();
      if (intro && intro.destroy) intro.destroy();
      _choiceOrDone(scene, 'elara_first_crack', function () {
        _fireObserve('erster_riss_gesehen');          // Trigger am Ende der Szene
        if (typeof onDone === 'function') onDone();
      });
    }
  }

  /**
   * Zeilen aufbauen, Lesepause, dann die Auswahl aus storyDialog.byScene.
   * Die Lesepause laeuft erst, wenn der Text fertig geschrieben ist.
   *
   * @param {boolean} [jeSeite]  jede Zeile eine eigene Seite: nach jeder haelt
   *   die Szene an, bis der Spieler weiterwinkt (die Ratssitzung, ein Sprecher
   *   pro Seite). Ohne steht alles auf einer Seite.
   */
  function _szeneSpielen(scene, zeilen, sceneKey, onDone, mitZeichen, kulisse, jeSeite) {
    var cam = scene.cameras.main;
    var cx = cam.width / 2, cy = cam.height / 2 - 20;
    var weiter = false;
    var seiten = jeSeite ? zeilen.map(function (z) { return [z]; }) : [zeilen];
    var nr = 0;
    // #159: optional ein gezeichneter Ort hinter dem Text (der Ratssaal).
    var kulissenTeile = (typeof kulisse === 'function') ? (kulisse(scene, cx, cy) || []) : [];
    // #166: Die gemalte Buehne kommt als ein Objekt mit eigener Texttafel.
    var buehne = Array.isArray(kulissenTeile) ? null : kulissenTeile;
    if (buehne) kulissenTeile = [buehne];
    // #156: Szenen, in denen das Zeichen vorkommt, zeigen es auch.
    var zeichenBild = (mitZeichen && window.Zeichen) ? window.Zeichen.bild(scene, cx, cy - 170, 64) : null;
    if (zeichenBild) {
      zeichenBild.setDepth(1551).setScrollFactor(0).setAlpha(0);
      if (scene.tweens) scene.tweens.add({ targets: zeichenBild, alpha: 1, duration: 900, delay: 600 });
      else zeichenBild.setAlpha(1);
    }
    // Eine Seite aufbauen; ist sie fertig geschrieben, haelt die Szene an.
    function seiteZeigen() {
      var seite = { auf: null, bereit: false };
      var halten = function () {
        var naechste = function () { seiteWeg(seite); };
        // Mit Buehne steht der Hinweis am unteren Rand der Tafel.
        if (buehne) _warteAufWeiter(scene, seite.auf, buehne.hinweisX, buehne.hinweisY - scene.cameras.main.height * 0.30, naechste);
        else _warteAufWeiter(scene, seite.auf, cx, cy, naechste);
      };
      // Ohne Aufbau meldet _zeilenAufbauen "fertig", bevor es zurueckkehrt —
      // dann erst halten, wenn die Seite vollstaendig steht.
      seite.auf = _zeilenAufbauen(scene, seiten[nr], cx, cy, function () {
        if (seite.auf) halten(); else seite.bereit = true;
      });
      var intro = seite.auf.text;
      if (buehne && intro) {
        // Oben buendig: der Text waechst nach unten in die Tafel hinein.
        intro.setOrigin(0.5, 0).setPosition(cx, buehne.textY).setWordWrapWidth(buehne.textBreite)
          .setFontSize(14).setLineSpacing(2);
        buehne.folgen(intro);
      }
      if (seite.bereit) halten();
    }
    function seiteWeg(seite) {
      if (weiter || seite.weg) return;
      seite.weg = true;
      if (seite.auf.lauf) seite.auf.lauf.abbrechen();
      if (seite.auf.text && seite.auf.text.destroy) seite.auf.text.destroy();
      nr++;
      if (nr < seiten.length) { seiteZeigen(); return; }
      step();
    }
    seiteZeigen();
    function step() {
      if (weiter) return;
      weiter = true;
      if (zeichenBild && zeichenBild.destroy) zeichenBild.destroy();
      kulissenTeile.forEach(function (o) { if (o && o.destroy) o.destroy(); });
      _choiceOrDone(scene, sceneKey, function () {
        if (typeof onDone === 'function') onDone();
      });
    }
  }

  // --- #155 Das Wiedersehen (Ende Akt 2) -------------------------------------
  // Hier erfaehrt der Spieler, wer Elara ist. Das Licht im Fenster hat sie ihm
  // im Dungeon beschrieben ("jemand, der jeden Abend auf mich wartet").
  // Seit b485 eine Zwischenszene mit drei Tableaus (js/wiedersehenSzene.js),
  // danach Harrens Frage. Ohne das Modul die fruehere Textfassung.
  function playWiedersehen(scene, onDone) {
    var WS = window.WiedersehenSzene;
    if (WS && typeof WS.spielen === 'function') {
      WS.spielen(scene, function () {
        _choiceOrDone(scene, 'wiedersehen', function () {
          if (typeof onDone === 'function') onDone();
        });
      });
      return;
    }
    _szeneSpielen(scene, [
      _t('(Spät am Abend. Im Fenster des Bürgermeisters brennt ein Licht, wie jeden Abend.)', '(Late in the evening. A light burns in the mayor\'s window, as it does every evening.)'),
      _t('(Eine Gestalt in der Gasse. Die Kapuze fällt. Es ist Elara.)', '(A figure in the alley. The hood falls. It is Elara.)'),
      'HARREN: Lene.',
      _t('(Sie zögert einen Atemzug zu lang. Dann liegt sie in seinen Armen.)', '(She hesitates one breath too long. Then she is in his arms.)'),
      // v6.1: Ihm erzaehlt sie, sie sei aus eigenem Willen geflohen.
      _t('ELARA: Ich bin fortgegangen, Vater. Aus eigenem Willen. Und ich kann nicht bleiben, noch nicht.', 'ELARA: I left, Father. Of my own will. And I cannot stay, not yet.')
    ], 'wiedersehen', onDone);
  }

  // --- #155 Die Nacht nach dem Bruch ------------------------------------------
  // Das tiefste Vertrauen, direkt vor dem Verrat. Seit b484 eine
  // Zwischenszene mit drei Tableaus (js/bruchNachtSzene.js); die Textfassung
  // unten bleibt der Rueckfall ohne Bilder.
  function playNachtNachDemBruch(scene, onDone) {
    var BN = window.BruchNachtSzene;
    var text = function () { _nachtNachDemBruchText(scene, onDone); };
    if (BN && typeof BN.spielen === 'function' && BN.spielen(scene, onDone, text)) return;
    text();
  }

  function _nachtNachDemBruchText(scene, onDone) {
    _szeneSpielen(scene, [
      // v6.1: Branka hat Dich hergebracht (bruch_confrontation).
      _t('(Die Nacht nach dem Bruch. Aldrics Wachen durchkämmen die Gassen. Branka hat Dich bis an den Spalt in der Kellerwand gebracht. Dahinter, in ihrem Versteck, wartet Elara.)', '(The night after the break. Aldric\'s guards comb the alleys. Branka has brought you as far as the crack in the cellar wall. Behind it, in her hideout, Elara is waiting.)'),
      _t('ELARA: Hier findet Dich keiner. Schlaf. Ich halte Wache.', 'ELARA: Nobody will find you here. Sleep. I will keep watch.'),
      _t('(Du wachst einmal auf. Sie sitzt an der Tür, die Klinge über den Knien, und sieht Dich an. Lange.)', '(You wake once. She sits by the door, the blade across her knees, and looks at you. For a long time.)')
    ], 'bruch_nacht', onDone);
  }

  // --- #155 Der Maulwurf: Elara mit Aldric --------------------------------------
  // Der Verrat. #156: das Zeichen an ihrem Ring — dasselbe wie auf den Siegeln
  // der geheimen Sitzung und auf dem Buendel, das der Spieler ihr gebracht hat.
  // v6.1: Neben den beiden steht der Kettenwaechter aus dem Keller, und ein
  // Rueckblick spielt Elaras Rettung noch einmal ab, diesmal mit dem Blick
  // auf das, was gespielt war (js/rettungsSzene.js). Alte Spielstaende ohne
  // die inszenierte Rettung bekommen die allgemeine Fassung, ein Stand ganz
  // ohne Rettung gar keinen Rueckblick.
  function _maulwurfWaechter(art) {
    if (art === 'voll') return _t('(An der Tür, neben den beiden, ein Kettenwächter. Auf seinem Helm ein roter Helmbusch. Du kennst ihn. Aus dem Keller.)', '(By the door, beside the two of them, a Chain Guard. On his helmet a red plume. You know him. From the cellar.)');
    if (art === 'allgemein') return _t('(An der Tür, neben den beiden, ein Kettenwächter. Er sieht Dich an, als würde er Dich kennen. Aus dem Keller?)', '(By the door, beside the two of them, a Chain Guard. He looks at you as if he knew you. From the cellar?)');
    return null;
  }

  function playMaulwurfEnthuellung(scene, onDone) {
    var RS = window.RettungsSzene;
    var art = (RS && typeof RS.rueckblickArt === 'function') ? RS.rueckblickArt() : null;
    var mitRueckblick = !!(_maulwurfWaechter(art) && RS && typeof RS.rueckblick === 'function');
    var danach = function () {
      if (mitRueckblick) RS.rueckblick(scene, art, function () { _maulwurfRest(scene, onDone); });
      else _maulwurfRest(scene, onDone);
    };
    // Der Weg zur Ratskammer als Zwischensequenz mit drei Bildern
    // (js/zettelSzene.js): der Zettel, die Treppe mit dem Waechter, der
    // Tuerspalt. Erst danach der Rueckblick und der Ring. Fehlen die Bilder,
    // die fruehere Textseite.
    var ZS = window.ZettelSzene;
    if (ZS && typeof ZS.laden === 'function') {
      ZS.laden(scene, function (ok) {
        if (ok) ZS.spielen(scene, art, danach, { abBild: ZS.startBildNehmen() });
        else _maulwurfOhneBilder(scene, art, mitRueckblick, danach, onDone);
      });
      return;
    }
    _maulwurfOhneBilder(scene, art, mitRueckblick, danach, onDone);
  }

  // Die fruehere Fassung als Textseite, falls die Bilder nicht laden.
  function _maulwurfOhneBilder(scene, art, mitRueckblick, danach, onDone) {
    var vorn = [
      _t('(Du bist dem gefalteten Zettel gefolgt. Durch die Kanäle, hinauf ins Rathaus, in die Ratskammer. Es ist Nacht.)', '(You followed the folded note. Through the canals, up into the town hall, into the council chamber. It is night.)'),
      _t('(Aldric steht am Tisch. Ihm gegenüber, ohne Kapuze: Elara.)', '(Aldric stands at the table. Across from him, hood down: Elara.)')
    ];
    if (mitRueckblick) {
      vorn.push(_maulwurfWaechter(art));
      _szeneSpielen(scene, vorn, null, danach, true, _nachtKulisse);
      return;
    }
    _szeneSpielen(scene, vorn.concat(_maulwurfZeilen()), 'maulwurf_reveal', onDone, true, _nachtKulisse);
  }

  // Die Ratskammer bei Nacht: dunkel hinter dem Text, damit der Platz nicht
  // durchscheint (die Szene spielt nicht im Hub, sondern in der Kammer).
  function _nachtKulisse(scene) {
    var cam = scene.cameras.main;
    var teile = [];
    // Hinter dem Ring bleibt der Tuerspalt aus der Zwischensequenz stehen,
    // abgedunkelt: Du stehst noch immer dort.
    if (scene.textures && scene.textures.exists('zettel_spalt')) {
      var bild = scene.add.image(cam.width / 2, cam.height / 2, 'zettel_spalt').setScrollFactor(0).setDepth(1547);
      bild.setScale(Math.max(cam.width / bild.width, cam.height / bild.height));
      teile.push(bild);
    }
    teile.push(scene.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, 0x050407, teile.length ? 0.84 : 0.86)
      .setScrollFactor(0).setDepth(1548));
    return teile;
  }

  function _maulwurfRest(scene, onDone) {
    _szeneSpielen(scene, _maulwurfZeilen(), 'maulwurf_reveal', onDone, true, _nachtKulisse);
  }

  function _maulwurfZeilen() {
    return [
      _t('ALDRIC: Er vertraut Dir. Gut. Sorg dafür, dass er hinabsteigt.', 'ALDRIC: He trusts you. Good. Make sure he goes down.'),
      _t('ELARA: Er wird gehen. Er hat niemanden mehr ausser mir.', 'ELARA: He will go. He has no one left but me.'),
      _t('(Als sie den Zettel übergibt, fällt Licht auf ihre Hand. Ein Ring: drei Ketten, ineinander verschlungen. Dasselbe Zeichen wie auf den Siegeln der geheimen Sitzung. Wie auf dem Bündel, das Du ihr gebracht hast.)', '(As she hands over the note, light falls on her hand. A ring: three chains, intertwined. The same sign as on the seals of the secret session. As on the bundle you brought her.)')
    ];
  }

  window.storyScenes = {
    playOeffentlicheSitzung: playOeffentlicheSitzung,
    playGeheimeSitzung: playGeheimeSitzung,
    ediktSieger: ediktSieger,
    sitzungSeiten: sitzungSeiten,
    playElaraFirstCrack: playElaraFirstCrack,
    playWiedersehen: playWiedersehen,
    playNachtNachDemBruch: playNachtNachDemBruch,
    playMaulwurfEnthuellung: playMaulwurfEnthuellung
  };
})();
