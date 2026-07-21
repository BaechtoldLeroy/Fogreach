// js/hubPhase.js — Hub-Phasen-Logik (Feature 064).
//
// Reine Ableitung des Hub-Zustands aus Akt-Index + Story-Flags, plus die pro
// Phase definierten Darstellungs-/Verhaltens-Daten. Fundament fuer die View
// (hubPhaseView.js) und die Integration (HubSceneV2). Kontrakt:
// kitty-specs/064-hub-evolution/contracts/hub-phase-contract.md.
//
// Classic Script: haengt window.HubPhase an. `derivePhase` ist rein (kein
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
    // ersten Mal klar — deshalb weder Nebel noch Entsaettigung, nur ein heller,
    // sauberer Tint. (Vorher trug ausgerechnet der Epilog mit fog 0.30 den
    // dichtesten Nebel von allen Phasen; das lief der Geschichte zuwider.)
    epilogue:    { tint: 0xeef0f2, desaturate: 0.00, fog: 0.00, posters: 'gone',  assetKey: 'hub_epilogue',    rathausHostile: false }
  };

  // Phasenabhaengige NPC-Flavor-Overrides. Fehlt ein Eintrag, bleibt die
  // bestehende Flavor-Zeile unveraendert. ASCII-NPC-IDs; Umlaute im Text ok.
  var npcFlavorByPhase = {
    doubleAgent: {
      aldric: [
        'Der Wahlkampf laeuft praechtig, Archivschmied. Drei Farben, ein Ergebnis. Frag nicht, welches.',
        'Du raeumst zuverlaessig. Der Rat merkt sich, wer zuverlaessig ist.'
      ]
    },
    broken: {
      aldric: [
        'Du. Ich weiss, was Du bist. Ein Handwerker, der zu viel gesehen hat.',
        'Das Rathaus ist nicht mehr Deine Tuer. Verschwinde, bevor die Garde Deinen Namen lernt.'
      ]
    },
    epilogue: {
      buerger: [
        '(Der Buerger steht auf dem Platz und liest laut aus einem frischen Blatt.)',
        'BUERGER: "...und hier stehen die Namen. Alle. Lies mit, wenn Du kannst."'
      ]
    }
  };

  window.HubPhase = {
    derivePhase: derivePhase,
    current: current,
    aldricBlocksQuests: aldricBlocksQuests,
    PHASE_STYLE: PHASE_STYLE,
    npcFlavorByPhase: npcFlavorByPhase
  };
})();
