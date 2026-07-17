// js/storyScenes.js — inszenierte Schluesselszenen (Feature 063 WP04).
//
// Drei Beats als Overlay-Inszenierungen im bestehenden Szenen-Kontext, gerendert
// ueber window.DialogChoice (WP02) + einfache Tweens/Kamera. Story v4 §13.1-13.3.
//   playCollusionSession  -> geheime Sitzung mit "Zuhören"-Leiste, feuert
//                            observe collusion_reveal_seen bei Abschluss.
//   playElaraFirstCrack   -> Elaras erster Riss, feuert observe three_hands_seen.
//   playElaraCamp         -> Elara-Lager, atmosphaerisch, KEIN Trigger.
//
// Einheitliche Signatur (scene, onDone). Defensiv: fehlt DialogChoice/questSystem,
// laeuft die Szene minimal ab statt zu crashen. Alle GameObjects scrollFactor(0).
// Szenenuebergreifende Zeit ueber Date.now().
(function () {
  'use strict';

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

    var intro = _lines(scene, [
      '(Die drei legen die Farben ab. Ein Blatt. Drei Siegel.)',
      'ALDRIC: Solange die Stadt glaubt, wir stritten, glaubt sie, sie habe eine Wahl.',
      '(Du bleibst im Schatten und hoerst zu.)'
    ], cx, cy);

    // Zuhören-Leiste
    var barW = 360, barH = 16;
    var barX = cx - barW / 2, barY = cy + 110;
    var frame = scene.add.graphics().setDepth(1551).setScrollFactor(0);
    frame.lineStyle(2, 0x8a8270, 0.9).strokeRect(barX, barY, barW, barH);
    var fill = scene.add.graphics().setDepth(1552).setScrollFactor(0);
    var label = scene.add.text(cx, barY - 18, 'Zuhoeren...', {
      fontFamily: 'monospace', fontSize: 13, color: '#b9b090'
    }).setOrigin(0.5, 0.5).setDepth(1552).setScrollFactor(0);

    var progress = { v: 0 };
    function cleanup() {
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
    var intro = _lines(scene, [
      '(Ein Bote bringt eine Meldung. Elara liest, faltet das Blatt weg.)',
      'ELARA: Das kommt nicht in die Presse.'
    ], cx, cy);
    scene.time && scene.time.delayedCall ? scene.time.delayedCall(900, step) : step();
    function step() {
      if (intro && intro.destroy) intro.destroy();
      _choiceOrDone(scene, 'elara_first_crack', function () {
        _fireObserve('three_hands_seen');             // Trigger am Ende der Szene
        if (typeof onDone === 'function') onDone();
      });
    }
  }

  // --- 13.2 Elara-Lager (atmosphaerisch, KEIN Trigger) -----------------------
  function playElaraCamp(scene, onDone) {
    var cam = scene.cameras.main;
    var cx = cam.width / 2, cy = cam.height / 2 - 20;
    var intro = _lines(scene, [
      '(Elara legt etwas Kleines vor Dich hin, abgegriffen, alt. Dein Zeichen.)',
      'ELARA: Das lag in Deiner alten Werkstatt, bevor der Nebel Dich holte. Ich habe es aufgehoben.'
    ], cx, cy);
    scene.time && scene.time.delayedCall ? scene.time.delayedCall(900, step) : step();
    function step() {
      if (intro && intro.destroy) intro.destroy();
      _choiceOrDone(scene, 'elara_camp', function () {
        if (typeof onDone === 'function') onDone();   // kein Objective-Trigger
      });
    }
  }

  window.storyScenes = {
    playCollusionSession: playCollusionSession,
    playElaraFirstCrack: playElaraFirstCrack,
    playElaraCamp: playElaraCamp
  };
})();
