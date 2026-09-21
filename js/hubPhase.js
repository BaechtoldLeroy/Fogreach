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
    if (a >= 4) return 'broken';
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
    broken: {
      aldric: [
        'Du. Ich weiss, was Du bist. Ein Handwerker, der zu viel gesehen hat.',
        'Das Rathaus ist nicht mehr Deine Tür. Verschwinde, bevor die Garde Deinen Namen lernt.'
      ]
    },
    epilogue: {
      buerger: [
        '(Der Bürger steht auf dem Platz und liest laut aus einem frischen Blatt.)',
        'BUERGER: "...und hier stehen die Namen. Alle. Lies mit, wenn Du kannst."'
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
      'hub.phase.doubleAgent.aldric.0': 'The campaign is going splendidly, Archivesmith. Three colours, one result. Do not ask which.',
      'hub.phase.doubleAgent.aldric.1': 'You clean up reliably. The council remembers who is reliable.',
      'hub.phase.broken.aldric.0': 'You. I know what you are. A craftsman who has seen too much.',
      'hub.phase.broken.aldric.1': 'The town hall is no longer your door. Disappear before the guard learns your name.',
      'hub.phase.epilogue.buerger.0': '(The citizen stands on the square and reads aloud from a fresh sheet.)',
      'hub.phase.epilogue.buerger.1': 'CITIZEN: "...and here are the names. All of them. Read along if you can."'
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
      return st.allies.mara
        ? [_t('MARA: Mein Netz verteilt die Blätter. Jede Gasse, jede Tür.', 'MARA: My network hands out the sheets. Every alley, every door.')]
        : [_t('MARA: Ich habe die Liste noch. Einige kommen zurück. Nicht alle.', 'MARA: I still have the list. Some come back. Not all.')];
    }
    return null;
  }

  /** Wie viele Buerger im Epilog auf dem Platz vorlesen (wie viele zurueckkamen). */
  function epilogVorleser(flags) {
    var f = flags || {};
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
