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
  var LESEPAUSE_MS = 900;

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
      var altAbbrechen = lauf.abbrechen;
      lauf.abbrechen = function () {
        try { scene.input.off('pointerdown', beiKlick); } catch (e) {}
        altAbbrechen();
      };
    }
    return { text: text, lauf: lauf };
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
    var namen = ['MAGISTRAT', 'KLERUS', 'GARDE'];
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

  function playOeffentlicheSitzung(scene, onDone) {
    _szeneSpielen(scene, [
      '(Der Ratssaal ist voll. Bürger bis an die Wände. Vorn drei Pulte, drei Farben.)',
      'MAGISTRAT: Die Abgaben bleiben. Ordnung kostet.',
      'KLERUS: Ordnung? Die Stadt verliert ihre Seele, und der Magistrat zählt Münzen!',
      'GARDE: Streitet Ihr nur. Wir halten die Straßen. Mehr Patrouillen, dann ist Ruhe.',
      '(Die Bürger rufen durcheinander. Jeder hat eine Seite gewählt. Es sieht aus wie eine Wahl.)'
    ], 'oeffentliche_sitzung', function () {
      _fireObserve('oeffentliche_sitzung');
      if (typeof onDone === 'function') onDone();
    }, false, _ratssaal);
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
    var siegel = flag('verification_sealed')
      ? 'Eines der drei Siegel kennst Du. Du hast es selbst unter ein Dokument gesetzt, damals, als es eine Formalie war.'
      : flag('verification_refused')
        ? 'Unter dem Siegel des Magistrats steht Brankas Zeichen. Das Dokument, das Du nicht siegeln wolltest. Geändert hat es nichts.'
        : null;
    var seiten = [
      '(Die Ratskammer bei Nacht. Magistrat, Klerus und Garde legen die Farben ab. Vor ihnen ein einziges Blatt, drei Siegel, und auf jedem dasselbe Zeichen: drei Ketten, ineinander verschlungen.)',
      'ALDRIC: Solange die Stadt glaubt, wir stritten, glaubt sie, sie habe eine Wahl.\n\nKLERUS: Die Patrouillen verdoppeln wir trotzdem.\n\nGARDE: Wie jede Woche.'
    ];
    if (siegel) seiten.push(siegel);
    seiten.push('(Du ziehst Dich zurück, bevor die Wachen die Runde drehen. Harren wartet oben.)');

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
      ES.showEventChoiceDialog(scene, text, [{ label: 'Weiter', callback: naechste }]);
    };
    naechste();
    return true;
  }

  // --- 13.3 Elaras erster Riss -----------------------------------------------
  function playElaraFirstCrack(scene, onDone) {
    var cam = scene.cameras.main;
    var cx = cam.width / 2, cy = cam.height / 2 - 20;
    // Die Lesepause laeuft erst, wenn der Text fertig geschrieben ist.
    // Vorher stand hier eine feste Verzoegerung von 900 ms — sie haette
    // den Aufbau mitten im Satz abgeschnitten.
    var auf = _zeilenAufbauen(scene, [
      '(Ein Bote bringt eine Meldung. Elara liest, faltet das Blatt weg.)',
      'ELARA: Das kommt nicht in die Presse.'
    ], cx, cy, function () {
      if (scene.time && scene.time.delayedCall) scene.time.delayedCall(LESEPAUSE_MS, step);
      else step();
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
    // #156: Szenen, in denen das Zeichen vorkommt, zeigen es auch.
    var zeichenBild = (mitZeichen && window.Zeichen) ? window.Zeichen.bild(scene, cx, cy - 170, 64) : null;
    if (zeichenBild) {
      zeichenBild.setDepth(1551).setScrollFactor(0).setAlpha(0);
      if (scene.tweens) scene.tweens.add({ targets: zeichenBild, alpha: 1, duration: 900, delay: 600 });
      else zeichenBild.setAlpha(1);
    }
    var auf = _zeilenAufbauen(scene, zeilen, cx, cy, function () {
      if (scene.time && scene.time.delayedCall) scene.time.delayedCall(LESEPAUSE_MS, step);
      else step();
    });
    var intro = auf.text;
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
      '(Spät am Abend. Im Fenster des Bürgermeisters brennt ein Licht, wie jeden Abend.)',
      '(Eine Gestalt in der Gasse. Die Kapuze fällt. Es ist Elara.)',
      'HARREN: Lene.',
      '(Sie zögert einen Atemzug zu lang. Dann liegt sie in seinen Armen.)',
      'ELARA: Ich kann nicht bleiben, Vater. Noch nicht.'
    ], 'wiedersehen', onDone);
  }

  // --- #155 Die Nacht nach dem Bruch ------------------------------------------
  // Das tiefste Vertrauen, direkt vor dem Verrat.
  function playNachtNachDemBruch(scene, onDone) {
    _szeneSpielen(scene, [
      '(Die Nacht nach dem Bruch. Aldrics Wachen durchkämmen die Gassen. Elara zieht Dich in ihr Versteck unter der Stadt.)',
      'ELARA: Hier findet Dich keiner. Schlaf. Ich halte Wache.',
      '(Du wachst einmal auf. Sie sitzt an der Tür, die Klinge über den Knien, und sieht Dich an. Lange.)'
    ], 'bruch_nacht', onDone);
  }

  // --- #155 Der Maulwurf: Elara mit Aldric --------------------------------------
  // Der Verrat. #156: das Zeichen an ihrem Ring — dasselbe wie auf den Siegeln
  // der geheimen Sitzung und auf dem Buendel, das der Spieler ihr gebracht hat.
  function playMaulwurfEnthuellung(scene, onDone) {
    _szeneSpielen(scene, [
      '(Du bist dem gefalteten Zettel gefolgt. Durch die Kanäle, hinauf ins Rathaus, in die Ratskammer. Es ist Nacht.)',
      '(Aldric steht am Tisch. Ihm gegenüber, ohne Kapuze: Elara.)',
      'ALDRIC: Er vertraut Dir. Gut. Sorg dafür, dass er hinabsteigt.',
      'ELARA: Er wird gehen. Er hat niemanden mehr ausser mir.',
      '(Als sie den Zettel übergibt, fällt Licht auf ihre Hand. Ein Ring: drei Ketten, ineinander verschlungen. Dasselbe Zeichen wie auf den Siegeln der geheimen Sitzung. Wie auf dem Bündel, das Du ihr gebracht hast.)'
    ], 'maulwurf_reveal', onDone, true);
  }

  window.storyScenes = {
    playOeffentlicheSitzung: playOeffentlicheSitzung,
    playGeheimeSitzung: playGeheimeSitzung,
    playElaraFirstCrack: playElaraFirstCrack,
    playWiedersehen: playWiedersehen,
    playNachtNachDemBruch: playNachtNachDemBruch,
    playMaulwurfEnthuellung: playMaulwurfEnthuellung
  };
})();
