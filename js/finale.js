// js/finale.js — das Finale an der Quelle und die Entscheidung am Konvoi (#158).
//
// Story-Bibel v5, Abschnitt 8 und 9. Das Ende steht fest: Endkampf, Presse,
// der Nebel bricht. Hier liegen die Momente im Dungeon, die dorthin fuehren:
//
//   konvoi(scene)              Akt 2: still bleiben oder die Klinge ziehen.
//                              Wer zieht, rettet einen Mann und verbrennt Maras
//                              Netz (convoy_blade_drawn, convoy_blown) — Mara
//                              kommt im Endkampf nicht.
//   vorKampf(scene, boss, weiter)
//                              Tiefe 30: Elara an der Quelle, Harren folgt ihr
//                              und stirbt (harren_dead). Danach der Kampf.
//   nachKampf(scene)           Die Quelle zerbricht, Elara liegt am Boden.
//                              Verschonen oder richten (elara_spared/killed),
//                              dann ist die letzte Quest erfuellt. Die Presse
//                              im Hub ist der Epilog (HubSceneV2, questFinale).
//
// Alle drei laufen ueber EventSystem.showEventChoiceDialog: der haelt die
// Spieluhr an, der Kampf wartet also, solange gelesen wird.
(function () {
  'use strict';

  function _en() {
    try {
      return !!(window.i18n && typeof window.i18n.getLanguage === 'function' && window.i18n.getLanguage() === 'en');
    } catch (e) { return false; }
  }
  function _t(de, en) { return _en() ? en : de; }

  function _qs() { return window.questSystem || null; }
  function _flag(name) {
    var qs = _qs();
    return !!(qs && typeof qs.hasFlag === 'function' && qs.hasFlag(name));
  }
  function _setzen(name) {
    var qs = _qs();
    if (qs && typeof qs.setFlag === 'function') qs.setFlag(name, true);
  }
  function _dialogDa() {
    return !!(window.EventSystem && typeof window.EventSystem.showEventChoiceDialog === 'function');
  }

  /**
   * Spielt Seiten nacheinander. Jede Seite: { text, weiter?, auswahl? }.
   * `auswahl` ist eine Liste { label, callback } — die letzte Seite entscheidet.
   */
  function _seiten(scene, seiten, amEnde) {
    var i = 0;
    function zeige() {
      var s = seiten[i];
      if (!s) { if (typeof amEnde === 'function') amEnde(); return; }
      var knoepfe = s.auswahl || [{
        label: s.weiter || _t('Weiter', 'Continue'),
        callback: function () { if (typeof s.danach === 'function') s.danach(); i++; zeige(); }
      }];
      window.EventSystem.showEventChoiceDialog(scene, s.text, knoepfe);
    }
    zeige();
  }

  // --- Akt 2: der Konvoi -------------------------------------------------------
  function konvoi(scene) {
    if (!scene || !_dialogDa()) return false;
    if (_flag('convoy_silent') || _flag('convoy_blade_drawn')) return false;   // nur einmal

    var ende = function (text) {
      window.EventSystem.showEventChoiceDialog(scene, text, [{ label: _t('Weiter', 'Continue'), callback: function () {} }]);
    };
    window.EventSystem.showEventChoiceDialog(scene, _t(
      '(Am Karren zerren zwei Wachen einen Mann von der Ladefläche. Kein Verbrecher: ein Bürger, die Hände gebunden. Einer der Verschwundenen.)\n\n(Er sieht Dich an, als wüsste er, dass unter der Uniform keiner von ihnen steckt.)',
      '(At the cart two guards drag a man off the bed. No criminal: a citizen, hands bound. One of the disappeared.)\n\n(He looks at you as if he knew there is none of them under that uniform.)'
    ), [
      {
        label: _t('Still bleiben', 'Stay silent'),
        callback: function () {
          _setzen('convoy_silent');
          ende(_t(
            'Du bleibst im Schatten. Sie bringen ihn fort. Du hast gehört, was Du hören solltest, und Maras Weg ins Lagerhaus bleibt offen.',
            'You stay in the shadows. They take him away. You heard what you came to hear, and Mara\'s way into the warehouse stays open.'
          ));
        }
      },
      {
        label: _t('Die Klinge ziehen', 'Draw your blade'),
        callback: function () {
          _setzen('convoy_blade_drawn');
          _setzen('convoy_blown');
          try {
            if (window.EspionageSystem && typeof window.EspionageSystem.enttarnen === 'function') window.EspionageSystem.enttarnen();
          } catch (e) {}
          ende(_t(
            'Du ziehst. Der Mann rennt, und Du hältst die Wachen auf. Er entkommt. Deine Verkleidung ist dahin, und mit ihr Maras Netz: Morgen wissen sie, wer hier ein und aus ging.',
            'You draw. The man runs, and you hold the guards back. He gets away. Your disguise is gone, and with it Mara\'s network: by tomorrow they will know who came and went here.'
          ));
        }
      }
    ]);
    return true;
  }

  // --- Tiefe 30: vor dem Kampf -------------------------------------------------
  // Gibt true zurueck, wenn die Szene laeuft (dann ruft sie `weiter` selbst).
  function vorKampf(scene, boss, weiter) {
    if (!scene || !_dialogDa()) return false;
    if (_flag('harren_dead')) return false;   // schon gesehen: gleich der Kampf

    _seiten(scene, [
      { text: _t(
        '(Die Quelle. Ein Schacht aus Licht und Nebel, und davor, ohne Kapuze: Elara.)\n\nELARA: Du bist genau so weit gekommen, wie ich Dich brauchte. Niemand sonst hätte diese Kammern überstanden. Danke.',
        '(The source. A shaft of light and fog, and before it, hood down: Elara.)\n\nELARA: You came exactly as far as I needed you to. Nobody else would have survived these chambers. Thank you.') },
      { text: _t(
        'ELARA: Die Stadt will geführt werden. Sie weiss es nur nicht. Der Nebel nimmt ihnen die Last, sich an alles zu erinnern.\n\n(Sie streckt die Hand nach der Quelle aus.)',
        'ELARA: The city wants to be led. It just does not know it. The fog takes from them the burden of remembering everything.\n\n(She reaches out toward the source.)') },
      { text: _t(
        '(Schritte hinter Dir. Harren. Er ist Dir gefolgt, den ganzen Weg.)\n\nHARREN: Lene. Komm nach Hause.\n\n(Für einen Atemzug zögert sie.)',
        '(Footsteps behind you. Harren. He followed you, all the way down.)\n\nHARREN: Lene. Come home.\n\n(For one breath, she hesitates.)') },
      { text: _t(
        '(Dann nimmt die Quelle sie. Was einmal Elara war, stösst ihn fort. Er fällt, und er steht nicht mehr auf.)',
        '(Then the source takes her. What was once Elara throws him aside. He falls, and he does not get up again.)'),
        weiter: _t('Kämpfen', 'Fight'),
        danach: function () { _setzen('harren_dead'); } }
    ], function () { if (typeof weiter === 'function') weiter(); });
    return true;
  }

  // --- Tiefe 30: nach dem Kampf ------------------------------------------------
  // Ihre letzten Worte haengen daran, was zwischen euch war.
  function _letzteWorte() {
    var teile = [];
    if (_flag('elara_trust')) {
      teile.push(_t('ELARA: Du hast mir vertraut. Bis zuletzt. Das war das Einzige, was ich nie geplant hatte.',
        'ELARA: You trusted me. Until the end. That was the only thing I never planned for.'));
    } else {
      teile.push(_t('ELARA: Du hast mir nie ganz getraut. Klug. Klüger als er.',
        'ELARA: You never fully trusted me. Wise. Wiser than him.'));
    }
    if (_flag('zeichen_bemerkt')) {
      teile.push(_t('(Sie sieht auf ihren Ring.) Du hast es erkannt. Das Zeichen. Schon damals.',
        '(She looks at her ring.) You recognized it. The sign. Even back then.'));
    }
    return teile.join('\n\n');
  }

  function _quelleAbschliessen(scene) {
    var qs = _qs();
    if (qs && typeof qs.completeQuest === 'function') {
      try { qs.completeQuest('schattenrat_finale'); } catch (e) {}
    }
    try {
      if (window.EventSystem && typeof window.EventSystem.showEventToast === 'function') {
        window.EventSystem.showEventToast(scene, _t('Kehre zurück. Thom wartet an der Presse.', 'Go back up. Thom is waiting at the press.'), 'finale');
      }
    } catch (e) {}
  }

  function nachKampf(scene) {
    if (!scene || !_dialogDa()) return false;
    if (_flag('elara_spared') || _flag('elara_killed')) return false;

    var nachWahl = function (text) {
      window.EventSystem.showEventChoiceDialog(scene, text, [{
        label: _t('Weiter', 'Continue'),
        callback: function () { _quelleAbschliessen(scene); }
      }]);
    };
    // #161: Die Quelle in der Arena erlischt.
    try {
      var glut = scene._quelleGlow;
      if (glut && glut.active && scene.tweens) {
        scene.tweens.killTweensOf(glut);
        scene.tweens.add({ targets: glut, alpha: 0, scale: 0.3, duration: 1200,
          onComplete: function () { try { glut.destroy(); } catch (e) {} } });
      } else if (glut && glut.destroy) glut.destroy();
      scene._quelleGlow = null;
    } catch (e) {}

    _seiten(scene, [
      { text: _t(
        '(Die Quelle zerbricht. Der Nebel fällt in sich zusammen wie ein nasses Tuch.)\n\n(Elara liegt am Boden. Wieder sie selbst. Gebrochen.)',
        '(The source breaks. The fog collapses like a wet cloth.)\n\n(Elara lies on the ground. Herself again. Broken.)') },
      { text: _letzteWorte() },
      { text: _t('(Ihre Klinge liegt in Deiner Hand. Was tust Du?)', '(Her blade is in your hand. What do you do?)'),
        auswahl: [
          {
            label: _t('Verschonen', 'Spare her'),
            callback: function () {
              _setzen('elara_spared');
              nachWahl(_t('Du lässt die Klinge sinken. Sie wird leben, hinter Gittern, mit dem, was sie getan hat.',
                'You lower the blade. She will live, behind bars, with what she has done.'));
            }
          },
          {
            label: _t('Richten', 'Judge her'),
            callback: function () {
              _setzen('elara_killed');
              nachWahl(_t('Du beendest es mit dem Geschenk, das sie Dir gab.',
                'You end it with the gift she gave you.'));
            }
          }
        ] }
    ]);
    return true;
  }

  window.Finale = { konvoi: konvoi, vorKampf: vorKampf, nachKampf: nachKampf };
})();
