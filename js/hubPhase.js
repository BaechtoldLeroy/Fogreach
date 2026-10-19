// js/hubPhase.js — Hub-Phasen-Logik (Feature 064).
//
// Reine Ableitung des Hub-Zustands aus Akt-Index + Story-Flags, plus die pro
// Phase definierten Darstellungs-/Verhaltens-Daten. Fundament für die View
// (hubPhaseView.js) und die Integration (HubSceneV2). Kontrakt:
// kitty-specs/064-hub-evolution/contracts/hub-phase-contract.md.
//
// Classic Script: hängt window.HubPhase an. `derivePhase` ist rein (kein
// Date/Math.random, keine Seiteneffekte, mutiert die Eingabe nicht). `current()`
// liest die Globals und ist NICHT im Unit-Test genutzt.
(function () {
  'use strict';

  // Vier Phasen, priorisiert: epilogue > broken > doubleAgent > council.
  function derivePhase(actIndex, flags) {
    var a = (typeof actIndex === 'number') ? actIndex : 0;
    var f = flags || {};
    if (f.story_ending) return 'epilogue';
    // v6.1: Der Bruch (Aldric enttarnt Dich) liegt jetzt am Ende von Akt 3,
    // Akt 4 beginnt erst mit dem Maulwurf. Das Rathaus ist ab dem Bruch zu.
    if (a >= 4 || f.enttarnt) return 'broken';
    if (a >= 2) return 'doubleAgent';
    return 'council';
  }

  // Laufzeit-Wrapper: liest Akt-Index + Flags aus den Globals (defensiv).
  function current() {
    var a = 0, f = {};
    if (typeof window !== 'undefined') {
      if (window.storySystem && typeof window.storySystem.getCurrentActIndex === 'function') {
        a = window.storySystem.getCurrentActIndex();
      }
      if (window.questSystem && typeof window.questSystem.getFlags === 'function') {
        f = window.questSystem.getFlags();
      }
    }
    return derivePhase(a, f);
  }

  // Bietet Aldric in dieser Phase noch Quests an? Nach dem Bruch nicht mehr.
  function aldricBlocksQuests(phase) {
    return phase === 'broken';
  }

  // Darstellungs-Parameter je Phase. Felder (Kontrakt): tint, desaturate (0..1),
  // fog (0..1), posters {fresh|faded|torn|gone}, assetKey (string|null),
  // rathausHostile (bool). Werte thematisch; konkrete Zahlen darf die View
  // feinjustieren, die FELDER sind der Kontrakt.
  var PHASE_STYLE = {
    council:     { tint: 0xffffff, desaturate: 0.00, fog: 0.00, posters: 'fresh', assetKey: null,               rathausHostile: false },
    doubleAgent: { tint: 0x9fb0c8, desaturate: 0.35, fog: 0.12, posters: 'faded', assetKey: 'hub_doubleAgent', rathausHostile: false },
    broken:      { tint: 0x8a6b6b, desaturate: 0.45, fog: 0.22, posters: 'torn',  assetKey: 'hub_broken',      rathausHostile: true  },
    // Epilog: der Nebel ist WEG. Die Wahrheit ist gedruckt, die Stadt sieht zum
    // ersten Mal klar — deshalb weder Nebel noch Entsättigung, nur ein heller,
    // sauberer Tint. (Vorher trug ausgerechnet der Epilog mit fog 0.30 den
    // dichtesten Nebel von allen Phasen; das lief der Geschichte zuwider.)
    // #161: duenner, heller Nebel (er bricht, er ist nicht weg); an den Tafeln
    // haengen Thoms gedruckte Blaetter statt der drei Fraktionsfarben.
    epilogue:    { tint: 0xeef0f2, desaturate: 0.00, fog: 0.06, posters: 'gedruckt', assetKey: 'hub_epilogue', rathausHostile: false }
  };

  // Phasenabhängige NPC-Flavor-Overrides. Fehlt ein Eintrag, bleibt die
  // bestehende Flavor-Zeile unverändert. ASCII-NPC-IDs; Umlaute im Text ok.
  var npcFlavorByPhase = {
    doubleAgent: {
      aldric: [
        'Der Wahlkampf läuft prächtig, Archivschmied. Drei Farben, ein Ergebnis. Frag nicht, welches.',
        'Du räumst zuverlässig. Der Rat merkt sich, wer zuverlässig ist.'
      ]
    },
    // Stufe 1b: Aldric steht ab dem Bruch nicht mehr im Hub (hubLayout
    // hiddenAfterFlag/hiddenInPhase), seine Zeilen hier waren tot. Dafuer
    // sprechen die Stimmen der Fraktionen und der Buerger von der Jagd.
    broken: {
      klerus_priester: [
        'Du trägst den Nebel nicht mehr in den Augen, Archivschmied. Bei uns heisst das Besessenheit.',
        'Der Rat betet für Dich. Danach schickt er die Kettenwache.'
      ],
      stadtwache: [
        'Ich habe Befehl, Dich festzunehmen. (Er sieht sich um.) Ich habe Dich nicht gesehen. Heute nicht.',
        'Das Rathaus ist zu. Wer fragt, warum, steht morgen auf der Liste.'
      ],
      buerger: [
        'Verzeih. Man sagt, Du gehst nicht mehr im Rathaus aus und ein. Man sagt, sie suchen Dich.',
        'Ich habe nichts gesehen. Das sage ich jedem, der fragt.'
      ]
    },
    epilogue: {
      buerger: [
        '(Der Bürger steht auf dem Platz und liest laut aus einem frischen Blatt.)',
        'BÜRGER: "...und hier stehen die Namen. Alle. Lies mit, wenn Du kannst."'
      ],
      klerus_priester: [
        '(Er hält ein frisches Blatt und liest es zum dritten Mal.) Hier steht mein Name. Neben dem Wort Reinigung.',
        'Ich habe gepredigt, was man mir gab. Ich weiss nicht mehr, was ich davon geglaubt habe.'
      ],
      stadtwache: [
        'Keine Befehle mehr aus dem Rathaus. Die Männer stehen trotzdem jeden Morgen hier. Aus Gewohnheit.',
        'Ich habe Leute in den Keller gebracht. Jetzt erinnere ich mich wieder an ihre Gesichter.'
      ]
    }
  };

  // #87: Die Flavor-Zeilen oben sind die deutsche Quelle; jede wird an einen
  // Key gebunden (hub.phase.<phase>.<npc>.<n>) und liefert die aktive Sprache.
  (function () {
    var I = (typeof window !== 'undefined') ? window.i18n : null;
    if (!I || typeof I.binden !== 'function') return;
    Object.keys(npcFlavorByPhase).forEach(function (ph) {
      Object.keys(npcFlavorByPhase[ph]).forEach(function (npc) {
        npcFlavorByPhase[ph][npc].forEach(function (_z, n, arr) {
          I.binden(arr, n, 'hub.phase.' + ph + '.' + npc + '.' + n);
        });
      });
    });
    I.register('en', {
      'hub.phase.doubleAgent.aldric.0': 'The campaign is going splendidly, Archivesmith. Three colors, one result. Do not ask which.',
      'hub.phase.doubleAgent.aldric.1': 'You clean up reliably. The council remembers who is reliable.',
      'hub.phase.broken.klerus_priester.0': 'The fog is gone from your eyes, Archivesmith. We call that possession.',
      'hub.phase.broken.klerus_priester.1': 'The council prays for you. Then it sends the Chain Guard.',
      'hub.phase.broken.stadtwache.0': 'I have orders to arrest you. (He looks around.) I did not see you. Not today.',
      'hub.phase.broken.stadtwache.1': 'The town hall is closed. Whoever asks why is on the list tomorrow.',
      'hub.phase.broken.buerger.0': 'Forgive me. They say you no longer go in and out of the town hall. They say they are looking for you.',
      'hub.phase.broken.buerger.1': 'I saw nothing. That is what I tell everyone who asks.',
      'hub.phase.epilogue.buerger.0': '(The citizen stands on the square and reads aloud from a fresh sheet.)',
      'hub.phase.epilogue.buerger.1': 'CITIZEN: "...and here are the names. All of them. Read along if you can."',
      'hub.phase.epilogue.klerus_priester.0': '(He holds a fresh sheet and reads it for the third time.) My name is on it. Next to the word purification.',
      'hub.phase.epilogue.klerus_priester.1': 'I preached what I was given. I no longer know how much of it I believed.',
      'hub.phase.epilogue.stadtwache.0': 'No more orders from the town hall. The men still stand here every morning. Out of habit.',
      'hub.phase.epilogue.stadtwache.1': 'I took people down into the cellar. Now I remember their faces again.'
    });
  })();

  function _t(de, en) {
    var I = (typeof window !== 'undefined') ? window.i18n : null;
    return (I && typeof I.getLanguage === 'function' && I.getLanguage() === 'en') ? en : de;
  }

  // #161: Im Epilog sprechen die Verbuendeten so, wie die Geschichte fuer sie
  // ausgegangen ist (dieselbe Rechnung wie questFinale.epilog).
  function epilogFlavor(npcId, flags) {
    var QF = (typeof window !== 'undefined') ? window.QuestFinale : null;
    var st = (QF && typeof QF.computeFinaleState === 'function') ? QF.computeFinaleState(flags || {}) : null;
    if (!st) return null;
    if (npcId === 'branka') {
      return st.allies.branka
        ? [_t('BRANKA: Die Presse läuft seit drei Tagen, und niemand hat sie angehalten. Ich hätte nicht gedacht, dass ich das noch erlebe.', 'BRANKA: The press has been running for three days, and nobody has stopped it. I did not think I would live to see this.')]
        : [_t('BRANKA: (nickt Dir knapp zu) Gedruckt ist gedruckt. Was davor war, vergesse ich nicht. Aber ich lese mit.', 'BRANKA: (gives you a curt nod) Printed is printed. I do not forget what came before. But I read along.')];
    }
    if (npcId === 'thom') {
      return st.allies.thom
        ? [_t('THOM: Die zweite Auflage ist schon weg. Die Leute kommen mit eigenem Papier.', 'THOM: The second run is already gone. People bring their own paper.')]
        : [_t('THOM: Ich drucke weiter. Irgendwer muss.', 'THOM: I keep printing. Somebody has to.')];
    }
    if (npcId === 'mara') {
      // Stufe 1b: Ist ihr Netz am Konvoi verbrannt, steht sie nur noch, bis sie
      // Dich zu Aldric gefuehrt hat (HubSceneV2._epilogOhne).
      if ((flags || {}).convoy_blown) {
        return [_t('MARA: Mein Netz ist verbrannt. Eins bleibt mir noch: Aldric. Danach bin ich weg.',
          'MARA: My network is burned. One thing is left for me: Aldric. After that, I am gone.')];
      }
      var zeilen = st.allies.mara
        ? [_t('MARA: Mein Netz verteilt die Blätter. Jede Gasse, jede Tür.', 'MARA: My network hands out the sheets. Every alley, every door.')]
        : [_t('MARA: Ich habe die Liste noch. Einige kommen zurück. Nicht alle.', 'MARA: I still have the list. Some come back. Not all.')];
      // v6.1: Aldrics Ende (Die letzte Wache).
      var f = flags || {};
      if (f.aldric_erzaehlt) {
        zeilen.push(_t('MARA: Du hast ihm gesagt, wer er war. Ich weiss nicht, ob das Gnade war oder Strafe. Vielleicht beides.',
          'MARA: You told him who he was. I do not know whether that was mercy or punishment. Maybe both.'));
      } else if (f.aldric_verschwiegen) {
        zeilen.push(_t('MARA: Du hast ihm nichts gesagt. Er läuft da unten herum und weiss nicht, wessen Namen die Stadt verflucht.',
          'MARA: You told him nothing. He wanders around down there and does not know whose name the city curses.'));
      }
      return zeilen;
    }
    return null;
  }

  /** Wie viele Buerger im Epilog auf dem Platz vorlesen (wie viele zurueckkamen). */
  function epilogVorleser(flags) {
    var f = flags || {};
    // v6.1: Maras Namensliste entscheidet; die Gesuche nur noch fuer Staende,
    // die diese Wahl noch nicht kennen.
    if (f.namen_gewarnt) return 3;
    if (f.namen_abgeliefert) return 1;
    if (f.petitions_kept) return 3;
    if (f.petitions_surrendered) return 1;
    return 2;
  }

  window.HubPhase = {
    epilogFlavor: epilogFlavor,
    epilogVorleser: epilogVorleser,
    derivePhase: derivePhase,
    current: current,
    aldricBlocksQuests: aldricBlocksQuests,
    PHASE_STYLE: PHASE_STYLE,
    npcFlavorByPhase: npcFlavorByPhase
  };
})();
