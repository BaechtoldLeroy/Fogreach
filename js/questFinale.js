// js/questFinale.js — Vier-Regler-Finale-Logik (Feature 063).
//
// Reine Funktion: leitet aus dem Story-Flag-Satz den Ausgang von `the_reckoning`
// ab. Keine Seiteneffekte, kein globaler Zustand, kein Storage/DOM, kein Date/
// Math.random. Der Kontrakt steht in
// kitty-specs/063-story-v4-inszenierung/contracts/finale-contract.md.
//
// Classic Script: hängt window.QuestFinale an. In Node muss `global.window`
// gesetzt sein (die Tests tun das via tests/loadGameModule.js bzw. global.window={}).
(function () {
  'use strict';

  function flag(flags, name) {
    return !!(flags && flags[name]);
  }

  // computeFinaleState(flags) -> FinaleState (siehe finale-contract.md).
  // `flags` ist ein einfaches Objekt { flagName: true, ... }. Fehlende Flags
  // gelten als false. Das Eingabeobjekt wird NICHT mutiert.
  function computeFinaleState(flags) {
    // Regler 1 — Verrat vorhergesehen: Maulwurf- ODER Handschriften-Spur.
    var betrayalForeseen = flag(flags, 'mole_evidence') || flag(flags, 'three_hands_seen');

    // Regler 4 — Selbst erinnert: allein aus who_you_were (self_remembered).
    var remembered = flag(flags, 'self_remembered');

    // Regler 2 — Wer steht neben dir (jeweils unabhängig).
    // Mara: resistance-freundliches Handeln (Gesuche behalten ODER Maulwurf-
    // Beweise) UND nicht im Konvoi aufgeflogen. `petitions_surrendered` allein
    // macht Mara NICHT anwesend (die petitions_kept-Bedingung greift dann nicht).
    var maraPresent = (flag(flags, 'petitions_kept') || flag(flags, 'mole_evidence'))
      && !flag(flags, 'convoy_blown');
    var brankaPresent = flag(flags, 'branka_ally');
    var thomPresent = flag(flags, 'thom_ally');

    var allies = { branka: brankaPresent, mara: maraPresent, thom: thomPresent };

    // Regler 3 — Lebt Elara.
    // Die explizite Spieler-Wahl im Finale hat Vorrang (elara_spared/elara_killed).
    // Fehlt sie (Finale noch nicht gespielt), wird abgeleitet: verschonbar nur
    // mit Vertrauen UND Beweisen -> lebt, gebrochen; sonst ihre eigene Klinge.
    // Damit stimmt der Zustand mit dem überein, was der Spieler tatsächlich
    // gewählt hat, statt es nur zu prognostizieren.
    var hasProof = flag(flags, 'mole_evidence') || flag(flags, 'three_hands_seen');
    var elara;
    if (flag(flags, 'elara_spared')) {
      elara = 'lives';
    } else if (flag(flags, 'elara_killed')) {
      elara = 'dies';
    } else {
      elara = (flag(flags, 'elara_trust') && hasProof) ? 'lives' : 'dies';
    }

    // Abgeleitete Präsentations-Hinweise.
    var aloneAtEnd = !(allies.branka || allies.mara || allies.thom);
    var namelessEnding = !remembered;

    return {
      betrayalForeseen: betrayalForeseen,
      allies: allies,
      elara: elara,
      remembered: remembered,
      aloneAtEnd: aloneAtEnd,
      namelessEnding: namelessEnding
    };
  }

  window.QuestFinale = {
    computeFinaleState: computeFinaleState
  };
})();
