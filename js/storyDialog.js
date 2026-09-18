// js/storyDialog.js — Dialog-Content-Pass (Feature 063 WP03).
//
// Datenbank aller [Spieler: ...]-Auswahlen aus dem Dialog-Skript v1 über Akt
// 0-4, in den Datenformen des dialog-ui-contract (DialogChoice: label, response?,
// setFlags?, showIf?). Reine Daten — keine Phaser-/questSystem-Aufrufe hier;
// WP05 hängt sie über window.DialogChoice in die Hub-/Quest-Dialoge ein.
//
// Flag-Abgleich (finale-contract): die vom Finale gelesenen Flags haben genau
// einen Setzer im Content:
//   verification_sealed/verification_refused  -> magistrat_verification
//   petitions_surrendered/petitions_kept      -> council_seizure
//   branka_ally                               -> who_you_were (Branka-Vertrauen)
//   thom_ally                                 -> thom_truth   (Thom-Vertrauen)
//   mole_evidence/self_remembered/elara_trust -> 062-Quests (nicht hier)
// Weitere Skript-Flags (truth_told ...) treiben Reaktivität und werden hier
// ebenfalls gesetzt. convoy_*, harren_dead und elara_spared/killed setzt das
// Finale an der Quelle bzw. der Konvoi (js/finale.js, #158).
(function () {
  'use strict';

  var byQuest = {
    // ------------------------------------------------------------------ AKT 0
    hub_intro_a0: {
      prompt: 'BRANKA: Du siegelst Akten, an die Du Dich am nächsten Tag nicht erinnerst. Ist Dir das nie unheimlich?',
      choices: [
        { label: 'Der Nebel nimmt jedem etwas.', response: 'BRANKA: Jedem. Nur nimmt er manchen mehr. Pass auf Dich auf.' },
        { label: 'Ich denke nicht darüber nach.', response: 'BRANKA: Nein. Das tut hier keiner. Das ist ja das Problem.' }
      ]
    },
    resistance_fetch_01: {
      prompt: 'ELARA: Im Keller liegt ein Bündel, versiegelt. Bring es mir, ohne dass jemand sieht.',
      choices: [
        { label: 'Wer bist Du?', response: 'ELARA: Jemand, der aufhebt, was der Rat verschwinden lassen will. Mehr später.' },
        { label: 'Was ist drin?', response: 'ELARA: Nichts, das Dich in Gefahr bringt. Noch nicht. Geh.' }
      ]
    },
    harren_daughter_investigation: {
      prompt: 'HARREN: Finde heraus, was mit meiner Tochter geschah. Die Wahrheit, nicht den Trost.',
      choices: [
        { label: 'Warum ich?', response: 'HARREN: Weil Du keiner Fraktion gehörst. Noch nicht.' },
        { label: 'Was, wenn es schlecht aussieht für Dich?', response: 'HARREN: Dann will ich es trotzdem wissen. Ein Vater will die Wahrheit, nicht den Trost.' }
      ]
    },

    // ------------------------------------------------------------------ AKT 1
    magistrat_verification: {
      prompt: 'ALDRIC: Setz das Siegel unter das Dokument. Eine Formalie.',
      choices: [
        { label: 'Siegel setzen', setFlags: ['verification_sealed'], response: 'ALDRIC: Das Dokument ist im Archiv. Was das in der Praxis bedeutet, geht Dich nichts an. Der Magistrat dankt Dir.' },
        { label: 'Verweigern', setFlags: ['verification_refused'], response: 'ALDRIC: Ein Handwerker mit Gewissen. Ich merke mir das. Branka siegelt es dann eben selbst. Geändert hat sich nichts, ausser dass ich jetzt weiss, wo Du stehst.' }
      ]
    },
    faction_campaign: {
      prompt: 'Aldrics Auftrag: dieselbe Woche, drei Edikte — Magistrat, Klerus, Garde, alle auf einem Karren, damit die Stadt glaubt, sie stritten. Nur eines kann ganz oben hängen, wo es zuerst gelesen wird. Wessen Farbe zeigst Du am deutlichsten?',
      choices: [
        { label: 'Magistrat oben — Recht und Ordnung', setFlags: ['rep_magistrat'], response: 'Du hängst das Magistrats-Siegel nach oben. Wer es liest, denkt an Gesetze, nicht an Ketten.' },
        { label: 'Klerus oben — das Licht des Rats', setFlags: ['rep_klerus'], response: 'Das Klerus-Edikt kommt zuoberst. Segen und Drohung im selben Satz — die Leute senken den Blick.' },
        { label: 'Garde oben — Schutz durch Stärke', setFlags: ['rep_garde'], response: 'Die Garde-Order ganz oben. Mehr Patrouillen, weniger Fragen. Man nickt und geht schneller weiter.' }
      ]
    },

    // ------------------------------------------------------------------ AKT 2
    hub_buerger_a2: {
      prompt: 'BUERGER: Wem soll ich glauben, dem Rat oder den Gerüchten? Wem gehörst Du?',
      choices: [
        { label: 'Keinem von beiden.', setFlags: ['truth_told'], response: 'BUERGER: (starrt Dich an) Das ist keine Antwort, die einem Vater hilft.' },
        { label: '(schweigen)', response: '(Du gehst weiter. Es gibt keine Antwort, die ihm hilft.)' }
      ]
    },
    council_seizure: {
      prompt: 'ALDRIC: Bring mir die beschlagnahmten Gesuche. Alle.',
      choices: [
        { label: 'Abgeben', setFlags: ['petitions_surrendered'], response: 'Du gibst sie ab.' },
        { label: 'Heimlich behalten', setFlags: ['petitions_kept'], response: 'Du steckst sie ein. Mara wird wissen wollen, wer da fragt.' }
      ]
    },
    council_seizure_followup: {
      prompt: 'ALDRIC: War alles da?',
      choices: [
        { label: 'Es war alles da.', showIf: function (f) { return !!f.petitions_kept; }, response: 'ALDRIC: Hm. (lässt es gehen, diesmal)' },
        { label: 'Alles abgegeben.', showIf: function (f) { return !f.petitions_kept; }, response: 'ALDRIC: Gut.' }
      ]
    },
    klerus_district_purge: {
      prompt: 'PRIESTER: Reinige den Bezirk. Bring mir die Namen.',
      choices: [
        { label: 'Und wenn sie unschuldig sind?', response: 'PRIESTER: Unschuld ist eine Frage des Lichts, nicht Deine. Bring die Namen.' }
      ]
    },
    mara_contact: {
      prompt: 'MARA: Du hast früher Fragen gestellt, Archivschmied.',
      choices: [
        { label: 'Ich habe Fragen gestellt? Früher?', response: 'MARA: Und wie. Vielleicht hat der Nebel Dich deshalb geholt. Denk drüber nach.' }
      ]
    },
    elara_meeting: {
      prompt: 'ELARA: (legt Dir ein Blatt hin) Lies. Und dann sag mir, wem Du noch glaubst.',
      choices: [
        { label: 'Woher hast Du das?', response: 'ELARA: Man hebt auf, was der Rat wegwirft. Irgendwer muss es tun.' }
      ]
    },

    // ------------------------------------------------------------------ AKT 3
    elara_blade: {
      prompt: 'ELARA: Nimm die Klinge. Für den Fall.',
      choices: [
        { label: 'Für welchen Fall?', response: 'ELARA: (zögert) Für jeden. Man weiss nie, wer am Ende vor einem steht.' }
      ]
    },
    // who_you_were: Branka hilft Dir, Dich zu erinnern -> Branka-Vertrauen.
    who_you_were: {
      prompt: 'BRANKA: Das lag in Deiner alten Werkstatt. Ich habe es aufgehoben. Willst Du wissen, wer Du warst?',
      choices: [
        { label: 'Ja. Sag es mir.', setFlags: ['branka_ally'], response: 'BRANKA: Jemand, der nicht aufhören konnte zu fragen. Wie jetzt. Wir stehen zusammen, wenn es soweit ist.' },
        { label: 'Später. Erst der Rat.', setFlags: ['branka_ally'], response: 'BRANKA: Auch recht. Aber ich vergesse nicht, dass Du gefragt hast.' }
      ]
    },
    // thom_truth: Thom vertraut Dir die Presse an -> Thom-Vertrauen.
    thom_truth: {
      prompt: 'THOM: Ich drucke, was wahr ist. Stehst Du dahinter, wenn es eng wird?',
      choices: [
        { label: 'Ich stehe dahinter.', setFlags: ['thom_ally'], response: 'THOM: Dann sind wir zwei. Das reicht, um anzufangen.' },
        { label: 'Wahrheit hat einen Preis.', setFlags: ['thom_ally'], response: 'THOM: Den zahle ich. Gut, dass Du ihn kennst. Wir halten zusammen.' }
      ]
    },

    // ------------------------------------------------------------------ AKT 4
    schattenrat_finale: {
      prompt: 'HARREN: Geh zur Quelle. Bring mir, was Du findest.',
      choices: [
        { label: 'Und Deine Tochter?', response: 'HARREN: (lange Pause) Bring mir Wahrheit. Auch die. Ein Vater will wissen, nicht träumen.' }
      ]
    }
  };

  // Szenen-gebundene Auswahlen (von storyScenes/WP04 bzw. dem Finale/WP05 genutzt).
  var byScene = {
    // #159: nach der oeffentlichen Sitzung, beim Hinausgehen.
    oeffentliche_sitzung: {
      prompt: 'HARREN: (leise, beim Hinausgehen) Heute Nacht treffen sie sich noch einmal. Unten, in der Ratskammer. Ohne Publikum.',
      choices: [
        { label: 'Und dann?', response: 'HARREN: Dann hörst Du zu, was sie sagen, wenn keiner zusieht. Zieh die Uniform der Wache an. Bleib im Schatten.' },
        { label: 'Warum ich?', response: 'HARREN: Weil man Dich dort unten kennt. Ein Handwerker, der Akten trägt, fällt keinem auf.' }
      ]
    },
    elara_first_crack: {
      prompt: 'ELARA: (faltet das Blatt weg) Das kommt nicht in die Presse.',
      choices: [
        { label: 'Was steht drin?', response: 'ELARA: Einer von uns hat im Suff jemanden verraten. Ein Guter. Es würde die Bewegung spalten.' },
        { label: 'Es ist wahr.', response: 'ELARA: Vieles ist wahr. Nicht alles hilft. Frag Dich, wem es nützt, bevor Du es druckst.' }
      ]
    },
    // #155: Die Hub-Szenen aus Story-Bibel v5, Abschnitt 6. (Die frueheren
    // Eintraege elara_second_truth, elara_camp und bruch waren ungenutzt oder
    // gehoerten zur Blaetter-Fassung aus v4.)
    wiedersehen: {
      prompt: 'HARREN: (leise, als sie gegangen ist) Du wusstest es?',
      choices: [
        { label: 'Nein. Ich wusste es nicht.', response: 'HARREN: Sie nennt sich jetzt Elara. Für mich bleibt sie Lene. Pass auf sie auf, da unten.' },
        { label: 'Ich habe es geahnt.', response: 'HARREN: Dann bist Du klüger als ich. Pass auf sie auf, da unten. Sie lässt sich nicht helfen.' }
      ]
    },
    bruch_nacht: {
      prompt: 'ELARA: Du hast mir vertraut. Die ganze Zeit.',
      choices: [
        { label: 'Das tue ich noch.', response: 'ELARA: (leise) Ich weiss.' },
        { label: 'Hätte ich es nicht sollen?', response: '(Sie antwortet nicht. Sie sieht zur Tür.)' }
      ]
    },
    maulwurf_reveal: {
      prompt: 'MARA: (als Du zurückkommst) Und? Wer ist es?',
      choices: [
        { label: 'Elara.', response: 'MARA: (lange Stille) Dann hat sie uns alle geführt. Direkt in seine Hände.' },
        { label: 'Ich weiss es nicht.', response: 'MARA: Du lügst schlecht, Archivschmied. Gut. Behalt es, bis Du weisst, was Du tust.' }
      ]
    },
    // (#158: reckoning_elara_fate entfernt. Die Wahl ueber Elara faellt jetzt
    // unten an der Quelle, nach dem Kampf — js/finale.js.)
  };

  window.storyDialog = {
    byQuest: byQuest,
    byScene: byScene
  };
})();
