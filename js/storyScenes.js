// js/storyScenes.js — inszenierte Schlüsselszenen (Feature 063 WP04).
//
// Drei Beats als Overlay-Inszenierungen im bestehenden Szenen-Kontext, gerendert
// über window.DialogChoice (WP02) + einfache Tweens/Kamera. Story v4 §13.1-13.3.
//   playCollusionSession  -> geheime Sitzung mit "Zuhören"-Leiste, feuert
//                            observe collusion_reveal_seen bei Abschluss.
//   playElaraFirstCrack   -> Elaras erster Riss, feuert observe three_hands_seen.
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

  // --- 13.1 Geheime Sitzung mit "Zuhören"-Fortschrittsleiste -----------------
  function playCollusionSession(scene, onDone) {
    var cam = scene.cameras.main;
    var cx = cam.width / 2;
    var cy = cam.height / 2 - 40;
    var done = false;

    var auf = _zeilenAufbauen(scene, [
      // #156: Hier lernt der Spieler das Zeichen des Schattenrats kennen.
      '(Die drei legen die Farben ab. Ein Blatt. Drei Siegel, und auf jedem dasselbe Zeichen: drei Ketten, ineinander verschlungen.)',
      'ALDRIC: Solange die Stadt glaubt, wir stritten, glaubt sie, sie habe eine Wahl.',
      '(Du bleibst im Schatten und hörst zu.)'
    ], cx, cy);
    var intro = auf.text;

    // Zuhören-Leiste
    var barW = 360, barH = 16;
    var barX = cx - barW / 2, barY = cy + 110;
    var frame = scene.add.graphics().setDepth(1551).setScrollFactor(0);
    frame.lineStyle(2, 0x8a8270, 0.9).strokeRect(barX, barY, barW, barH);
    var fill = scene.add.graphics().setDepth(1552).setScrollFactor(0);
    var label = scene.add.text(cx, barY - 18, 'Zuhören...', {
      fontFamily: 'monospace', fontSize: 13, color: '#b9b090'
    }).setOrigin(0.5, 0.5).setDepth(1552).setScrollFactor(0);

    var progress = { v: 0 };
    function cleanup() {
      if (auf.lauf) auf.lauf.abbrechen();
      [intro, frame, fill, label].forEach(function (o) { if (o && o.destroy) o.destroy(); });
    }
    function finish() {
      if (done) return;
      done = true;
      _fireObserve('collusion_reveal_seen');          // echter Trigger NUR bei Abschluss
      cleanup();
      // Harrens Doppelspiel-Weiche als Auswahl, dann onDone.
      _choiceOrDone(scene, 'collusion_session', function () {
        if (typeof onDone === 'function') onDone();
      });
    }

    var tween = scene.tweens.add({
      targets: progress, v: 1, duration: 4200, ease: 'Linear',
      onUpdate: function () {
        fill.clear();
        fill.fillStyle(0xc8b26a, 0.95).fillRect(barX + 2, barY + 2, (barW - 4) * progress.v, barH - 4);
      },
      onComplete: finish
    });

    // Defensive: falls tweens fehlen, direkt abschliessen.
    if (!tween) finish();
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
        _fireObserve('three_hands_seen');             // Trigger am Ende der Szene
        if (typeof onDone === 'function') onDone();
      });
    }
  }

  /**
   * Zeilen aufbauen, Lesepause, dann die Auswahl aus storyDialog.byScene.
   * Die Lesepause laeuft erst, wenn der Text fertig geschrieben ist.
   */
  function _szeneSpielen(scene, zeilen, sceneKey, onDone) {
    var cam = scene.cameras.main;
    var cx = cam.width / 2, cy = cam.height / 2 - 20;
    var weiter = false;
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
    ], 'maulwurf_reveal', onDone);
  }

  window.storyScenes = {
    playCollusionSession: playCollusionSession,
    playElaraFirstCrack: playElaraFirstCrack,
    playWiedersehen: playWiedersehen,
    playNachtNachDemBruch: playNachtNachDemBruch,
    playMaulwurfEnthuellung: playMaulwurfEnthuellung
  };
})();
