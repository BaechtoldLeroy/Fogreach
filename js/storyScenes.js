// js/storyScenes.js — inszenierte Schlüsselszenen (Feature 063 WP04).
//
// Drei Beats als Overlay-Inszenierungen im bestehenden Szenen-Kontext, gerendert
// über window.DialogChoice (WP02) + einfache Tweens/Kamera. Story v4 §13.1-13.3.
//   playOeffentlicheSitzung -> #159: die Ratssitzung vor den Buergern (Ratssaal),
//                            feuert observe oeffentliche_sitzung.
//   playGeheimeSitzung    -> #159: die geheime Sitzung, belauscht im Dungeon
//                            (Spionage in der Ratskammer), mit dem Zeichen.
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

    // Klicken ueberspringt den Aufbau — dieselbe Geste wie im Hub.
    if (scene.input && typeof scene.input.on === 'function') {
      var beiKlick = function () { lauf.ueberspringen(); };
      scene.input.on('pointerdown', beiKlick);
      // Loesbar, BEVOR der Weiter-Halt bindet: sonst wuerde ein einziger
      // Klick beides ausloesen — ueberspringen und gleich weiterschalten.
      lauf.skipLoesen = function () {
        try { scene.input.off('pointerdown', beiKlick); } catch (e) {}
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
        _t('Taste druecken', 'Press any key'), {
          fontFamily: 'monospace', fontSize: 13, color: '#8a8478'
        }).setOrigin(0.5).setDepth(1552).setScrollFactor(0);
      if (scene.tweens) {
        scene.tweens.add({ targets: hinweis, alpha: 0.35, duration: 900,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    } catch (e) { hinweis = null; }

    var beiTaste = function () { ausloesen(); };
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

  function playOeffentlicheSitzung(scene, onDone) {
    var sieger = ediktSieger();
    var zeilen = [_t('(Der Ratssaal ist voll. Bürger bis an die Wände. Vorn drei Pulte, drei Farben.)', '(The council hall is full. Citizens up to the walls. At the front three lecterns, three colours.)')];
    // #160: Die Sitzung verkuendet das Ergebnis der Abstimmung.
    if (sieger) {
      zeilen.push(_t('MAGISTRAT: ', 'MAGISTRATE: ') + _siegerText(sieger));
      zeilen.push(_t('(Es ist das Plakat, das ganz oben hing.)', '(It is the poster that hung at the very top.)'));
    }
    zeilen.push(
      _t('KLERUS: Ein Edikt ist beschlossen, und trotzdem verliert die Stadt ihre Seele, während der Magistrat Münzen zählt!', 'CLERGY: An edict is passed, and still the city loses its soul while the Magistrate counts coins!'),
      _t('GARDE: Streitet Ihr nur. Wir halten die Straßen. Mehr Patrouillen, dann ist Ruhe.', 'GUARD: You go on arguing. We hold the streets. More patrols, then there is peace.'),
      _t('(Die Bürger rufen durcheinander. Jeder hat eine Seite gewählt. Es sieht aus wie eine Wahl.)', '(The citizens shout over each other. Everyone has picked a side. It looks like a choice.)')
    );
    var ende = function () {
      _fireObserve('oeffentliche_sitzung');
      if (typeof onDone === 'function') onDone();
    };
    // #166: mit ?sitzung= die gemalte Buehne statt der Kaesten.
    var SB = _buehne();
    if (SB) {
      SB.laden(scene, function () { _szeneSpielen(scene, zeilen, 'oeffentliche_sitzung', ende, false, SB.oeffentlich); });
      return;
    }
    _szeneSpielen(scene, zeilen, 'oeffentliche_sitzung', ende, false, _ratssaal);
  }

  // #166/#167: die gemalte Buehne (js/sitzungsBuehne.js), nur hinter der Flagge.
  function _buehne() {
    var SB = window.SitzungsBuehne;
    return (SB && typeof SB.aktiv === 'function' && SB.aktiv()) ? SB : null;
  }

  // --- #159 Die geheime Sitzung, belauscht in der Ratskammer ----------------
  // Laeuft im Dungeon, wenn die Abhoerzone der Ratskammer abgehoert ist
  // (espionageSystem). Dieselben drei, dieselbe Nacht — und in zwei Saetzen
  // einig. Die Dialoge halten die Spieluhr an, die Wachen warten also.
  function playGeheimeSitzung(scene, onDone) {
    var ES = window.EventSystem;
    if (!scene || !ES || typeof ES.showEventChoiceDialog !== 'function') {
      if (typeof onDone === 'function') onDone();
      return false;
    }
    var qs = window.questSystem;
    var flag = function (n) { return !!(qs && typeof qs.hasFlag === 'function' && qs.hasFlag(n)); };
    // #145: Die Siegel-Entscheidung aus Akt 1 kommt hier zurueck.
    // Verweigern hat Vorrang: alte Spielstaende tragen beide Flaggen, weil
    // magistrat_verification frueher 'verification_sealed' als Vorgabe setzte.
    var siegel = flag('verification_refused')
      ? _t('Unter dem Siegel des Magistrats steht Brankas Zeichen. Das Dokument, das Du nicht siegeln wolltest. Geändert hat es nichts.', 'Under the Magistrate\'s seal stands Branka\'s mark. The document you would not seal. It changed nothing.')
      : flag('verification_sealed')
        ? _t('Eines der drei Siegel kennst Du. Du hast es selbst unter ein Dokument gesetzt, damals, als es eine Formalie war.', 'You know one of the three seals. You put it under a document yourself, back when it was a formality.')
        : null;
    var seiten = [
      _t('(Die Ratskammer bei Nacht. Magistrat, Klerus und Garde legen die Farben ab. Vor ihnen ein einziges Blatt, drei Siegel, und auf jedem dasselbe Zeichen: drei Ketten, ineinander verschlungen.)', '(The council chamber at night. Magistrate, Clergy and Guard take off their colours. Before them a single sheet, three seals, and on each the same sign: three chains, intertwined.)'),
      _t('ALDRIC: Solange die Stadt glaubt, wir stritten, glaubt sie, sie habe eine Wahl.\n\nKLERUS: Die Patrouillen verdoppeln wir trotzdem.\n\nGARDE: Wie jede Woche.', 'ALDRIC: As long as the city believes we quarrel, it believes it has a choice.\n\nCLERGY: We double the patrols anyway.\n\nGUARD: Like every week.')
    ];
    // #160: Die Abstimmung. Gewonnen hat, was oben hing — und das wussten sie.
    if (ediktSieger()) {
      seiten.push(_t('ALDRIC: Und die Abstimmung? (Er lacht leise.) Wer oben hängt, gewinnt. Das weiss jeder, der je eine Wand beklebt hat. Wir lassen einen Handwerker kleben und nennen es den Willen der Stadt.\n\n(Du hast es selbst aufgehängt.)', 'ALDRIC: And the vote? (He laughs quietly.) Whoever hangs on top wins. Anyone who has ever pasted up a wall knows that. We let a craftsman do the pasting and call it the will of the city.\n\n(You hung it up yourself.)'));
    }
    if (siegel) seiten.push(siegel);
    seiten.push(_t('(Du ziehst Dich zurück, bevor die Wachen die Runde drehen. Harren wartet oben.)', '(You withdraw before the guards make their round. Harren is waiting upstairs.)'));

    // #167: mit ?sitzung= sitzen die drei sichtbar am Tisch. Das Zeichen
    // steht dann auf den drei Siegeln des Blattes statt gross darueber.
    var SB = _buehne();
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
      var text = seiten[i++];
      ES.showEventChoiceDialog(scene, text, [{ label: _t('Weiter', 'Continue'), callback: naechste }]);
    };
    naechste();
    return true;
  }

  // Dieselben Seiten wie oben, aber vor der Kammer mit den drei am Tisch.
  // Der Dialog rueckt unter die Figuren; wer spricht, tritt hervor.
  function _geheimMitBuehne(scene, SB, seiten, onDone) {
    var ES = window.EventSystem;
    var buehne = SB.geheim(scene);
    var i = 0;
    var naechste = function () {
      if (i >= seiten.length) {
        buehne.destroy();
        _fireObserve('collusion_reveal_seen');
        if (typeof onDone === 'function') onDone();
        return;
      }
      var text = seiten[i++];
      var vorher = scene.children.list.slice();
      ES.showEventChoiceDialog(scene, text, [{ label: _t('Weiter', 'Continue'), callback: naechste }]);
      var neue = scene.children.list.filter(function (o) { return vorher.indexOf(o) < 0; });
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
   */
  function _szeneSpielen(scene, zeilen, sceneKey, onDone, mitZeichen, kulisse) {
    var cam = scene.cameras.main;
    var cx = cam.width / 2, cy = cam.height / 2 - 20;
    var weiter = false;
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
    var auf = _zeilenAufbauen(scene, zeilen, cx, cy, function () {
      // Mit Buehne steht der Hinweis am unteren Rand der Tafel.
      if (buehne) _warteAufWeiter(scene, auf, buehne.hinweisX, buehne.hinweisY - scene.cameras.main.height * 0.30, step);
      else _warteAufWeiter(scene, auf, cx, cy, step);
    });
    var intro = auf.text;
    if (buehne && intro) {
      // Oben buendig: der Text waechst nach unten in die Tafel hinein.
      intro.setOrigin(0.5, 0).setPosition(cx, buehne.textY).setWordWrapWidth(buehne.textBreite)
        .setFontSize(14).setLineSpacing(2);
      buehne.folgen(intro);
    }
    function step() {
      if (weiter) return;
      weiter = true;
      if (auf.lauf) auf.lauf.abbrechen();
      if (intro && intro.destroy) intro.destroy();
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
  function playWiedersehen(scene, onDone) {
    _szeneSpielen(scene, [
      _t('(Spät am Abend. Im Fenster des Bürgermeisters brennt ein Licht, wie jeden Abend.)', '(Late in the evening. A light burns in the mayor\'s window, as it does every evening.)'),
      _t('(Eine Gestalt in der Gasse. Die Kapuze fällt. Es ist Elara.)', '(A figure in the alley. The hood falls. It is Elara.)'),
      'HARREN: Lene.',
      _t('(Sie zögert einen Atemzug zu lang. Dann liegt sie in seinen Armen.)', '(She hesitates one breath too long. Then she is in his arms.)'),
      _t('ELARA: Ich kann nicht bleiben, Vater. Noch nicht.', 'ELARA: I cannot stay, Father. Not yet.')
    ], 'wiedersehen', onDone);
  }

  // --- #155 Die Nacht nach dem Bruch ------------------------------------------
  // Das tiefste Vertrauen, direkt vor dem Verrat.
  function playNachtNachDemBruch(scene, onDone) {
    _szeneSpielen(scene, [
      _t('(Die Nacht nach dem Bruch. Aldrics Wachen durchkämmen die Gassen. Elara zieht Dich in ihr Versteck unter der Stadt.)', '(The night after the break. Aldric\'s guards comb the alleys. Elara pulls you into her hideout beneath the city.)'),
      _t('ELARA: Hier findet Dich keiner. Schlaf. Ich halte Wache.', 'ELARA: Nobody will find you here. Sleep. I will keep watch.'),
      _t('(Du wachst einmal auf. Sie sitzt an der Tür, die Klinge über den Knien, und sieht Dich an. Lange.)', '(You wake once. She sits by the door, the blade across her knees, and looks at you. For a long time.)')
    ], 'bruch_nacht', onDone);
  }

  // --- #155 Der Maulwurf: Elara mit Aldric --------------------------------------
  // Der Verrat. #156: das Zeichen an ihrem Ring — dasselbe wie auf den Siegeln
  // der geheimen Sitzung und auf dem Buendel, das der Spieler ihr gebracht hat.
  function playMaulwurfEnthuellung(scene, onDone) {
    _szeneSpielen(scene, [
      _t('(Du bist dem gefalteten Zettel gefolgt. Durch die Kanäle, hinauf ins Rathaus, in die Ratskammer. Es ist Nacht.)', '(You followed the folded note. Through the canals, up into the town hall, into the council chamber. It is night.)'),
      _t('(Aldric steht am Tisch. Ihm gegenüber, ohne Kapuze: Elara.)', '(Aldric stands at the table. Across from him, hood down: Elara.)'),
      _t('ALDRIC: Er vertraut Dir. Gut. Sorg dafür, dass er hinabsteigt.', 'ALDRIC: He trusts you. Good. Make sure he goes down.'),
      _t('ELARA: Er wird gehen. Er hat niemanden mehr ausser mir.', 'ELARA: He will go. He has no one left but me.'),
      _t('(Als sie den Zettel übergibt, fällt Licht auf ihre Hand. Ein Ring: drei Ketten, ineinander verschlungen. Dasselbe Zeichen wie auf den Siegeln der geheimen Sitzung. Wie auf dem Bündel, das Du ihr gebracht hast.)', '(As she hands over the note, light falls on her hand. A ring: three chains, intertwined. The same sign as on the seals of the secret session. As on the bundle you brought her.)')
    ], 'maulwurf_reveal', onDone, true);
  }

  window.storyScenes = {
    playOeffentlicheSitzung: playOeffentlicheSitzung,
    playGeheimeSitzung: playGeheimeSitzung,
    ediktSieger: ediktSieger,
    playElaraFirstCrack: playElaraFirstCrack,
    playWiedersehen: playWiedersehen,
    playNachtNachDemBruch: playNachtNachDemBruch,
    playMaulwurfEnthuellung: playMaulwurfEnthuellung
  };
})();
