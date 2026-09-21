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
    // #160: Die Wahl, welches Edikt oben haengt, faellt jetzt an der
    // Anschlagtafel selbst (byScene.edikt_anschlag).

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
    // #160: An der Anschlagtafel — welches Edikt haengt ganz oben? Wer oben
    // haengt, gewinnt die Abstimmung. Das merkt der Spieler erst beim Ergebnis.
    edikt_anschlag: {
      prompt: 'Drei Edikte, eine Tafel. Nur eines hängt ganz oben, wo es zuerst gelesen wird. Wessen Farbe hängst Du nach oben?',
      choices: [
        { label: 'Magistrat oben — Recht und Ordnung', setFlags: ['edikt_magistrat'], response: 'Das Magistrats-Siegel kommt nach oben. Wer es liest, denkt an Gesetze, nicht an Ketten.' },
        { label: 'Klerus oben — das Licht des Rats', setFlags: ['edikt_klerus'], response: 'Das Klerus-Edikt kommt zuoberst. Segen und Drohung im selben Satz.' },
        { label: 'Garde oben — Schutz durch Stärke', setFlags: ['edikt_garde'], response: 'Die Garde-Order ganz oben. Mehr Patrouillen, weniger Fragen.' }
      ]
    },
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

  // #87: Die deutschen Texte oben sind die Quelle. Jedes Feld wird an einen
  // Key gebunden (storydialog.<id>.prompt, storydialog.<id>.<n>.label/.response)
  // und liefert danach die aktive Sprache.
  var EN = {
    'storydialog.hub_intro_a0.prompt': 'BRANKA: You seal files you do not remember the next day. Does that never unsettle you?',
    'storydialog.hub_intro_a0.0.label': 'The fog takes something from everyone.',
    'storydialog.hub_intro_a0.0.response': 'BRANKA: Everyone. It just takes more from some. Take care of yourself.',
    'storydialog.hub_intro_a0.1.label': "I don't think about it.",
    'storydialog.hub_intro_a0.1.response': 'BRANKA: No. Nobody here does. That is exactly the problem.',

    'storydialog.resistance_fetch_01.prompt': 'ELARA: There is a bundle in the cellar, sealed. Bring it to me without anyone seeing.',
    'storydialog.resistance_fetch_01.0.label': 'Who are you?',
    'storydialog.resistance_fetch_01.0.response': 'ELARA: Someone who keeps what the council wants to make disappear. More later.',
    'storydialog.resistance_fetch_01.1.label': "What's inside?",
    'storydialog.resistance_fetch_01.1.response': 'ELARA: Nothing that puts you in danger. Not yet. Go.',

    'storydialog.harren_daughter_investigation.prompt': 'HARREN: Find out what happened to my daughter. The truth, not comfort.',
    'storydialog.harren_daughter_investigation.0.label': 'Why me?',
    'storydialog.harren_daughter_investigation.0.response': 'HARREN: Because you belong to no faction. Not yet.',
    'storydialog.harren_daughter_investigation.1.label': 'What if it looks bad for you?',
    'storydialog.harren_daughter_investigation.1.response': 'HARREN: Then I still want to know. A father wants the truth, not comfort.',

    'storydialog.magistrat_verification.prompt': 'ALDRIC: Put the seal on the document. A formality.',
    'storydialog.magistrat_verification.0.label': 'Set the seal',
    'storydialog.magistrat_verification.0.response': 'ALDRIC: The document is in the archive. What that means in practice is none of your concern. The Magistrate thanks you.',
    'storydialog.magistrat_verification.1.label': 'Refuse',
    'storydialog.magistrat_verification.1.response': 'ALDRIC: A craftsman with a conscience. I will remember that. Branka will seal it herself, then. Nothing has changed, except that now I know where you stand.',

    'storydialog.hub_buerger_a2.prompt': 'CITIZEN: Whom should I believe, the council or the rumours? Whose are you?',
    'storydialog.hub_buerger_a2.0.label': 'Neither.',
    'storydialog.hub_buerger_a2.0.response': 'CITIZEN: (stares at you) That is no answer that helps a father.',
    'storydialog.hub_buerger_a2.1.label': '(stay silent)',
    'storydialog.hub_buerger_a2.1.response': '(You walk on. There is no answer that helps him.)',

    'storydialog.council_seizure.prompt': 'ALDRIC: Bring me the confiscated petitions. All of them.',
    'storydialog.council_seizure.0.label': 'Hand them over',
    'storydialog.council_seizure.0.response': 'You hand them over.',
    'storydialog.council_seizure.1.label': 'Keep them secretly',
    'storydialog.council_seizure.1.response': 'You pocket them. Mara will want to know who is asking.',

    'storydialog.council_seizure_followup.prompt': 'ALDRIC: Was everything there?',
    'storydialog.council_seizure_followup.0.label': 'Everything was there.',
    'storydialog.council_seizure_followup.0.response': 'ALDRIC: Hm. (lets it go, this time)',
    'storydialog.council_seizure_followup.1.label': 'All handed over.',
    'storydialog.council_seizure_followup.1.response': 'ALDRIC: Good.',

    'storydialog.klerus_district_purge.prompt': 'PRIEST: Purge the district. Bring me the names.',
    'storydialog.klerus_district_purge.0.label': 'And if they are innocent?',
    'storydialog.klerus_district_purge.0.response': 'PRIEST: Innocence is a question for the Light, not for you. Bring the names.',

    'storydialog.mara_contact.prompt': 'MARA: You used to ask questions, Archivesmith.',
    'storydialog.mara_contact.0.label': 'I asked questions? Before?',
    'storydialog.mara_contact.0.response': 'MARA: Oh, you did. Maybe that is why the fog took you. Think about it.',

    'storydialog.elara_meeting.prompt': 'ELARA: (puts a sheet in front of you) Read. And then tell me whom you still believe.',
    'storydialog.elara_meeting.0.label': 'Where did you get this?',
    'storydialog.elara_meeting.0.response': 'ELARA: You keep what the council throws away. Somebody has to.',

    'storydialog.elara_blade.prompt': 'ELARA: Take the blade. Just in case.',
    'storydialog.elara_blade.0.label': 'In case of what?',
    'storydialog.elara_blade.0.response': 'ELARA: (hesitates) Of anything. You never know who will stand before you in the end.',

    'storydialog.who_you_were.prompt': 'BRANKA: This was in your old workshop. I kept it. Do you want to know who you were?',
    'storydialog.who_you_were.0.label': 'Yes. Tell me.',
    'storydialog.who_you_were.0.response': 'BRANKA: Someone who could not stop asking. Like now. We stand together when the time comes.',
    'storydialog.who_you_were.1.label': 'Later. The council first.',
    'storydialog.who_you_were.1.response': 'BRANKA: Fair enough. But I will not forget that you asked.',

    'storydialog.thom_truth.prompt': 'THOM: I print what is true. Will you stand behind it when things get tight?',
    'storydialog.thom_truth.0.label': 'I stand behind it.',
    'storydialog.thom_truth.0.response': 'THOM: Then there are two of us. That is enough to start.',
    'storydialog.thom_truth.1.label': 'Truth has a price.',
    'storydialog.thom_truth.1.response': 'THOM: I will pay it. Good that you know it. We stick together.',

    'storydialog.schattenrat_finale.prompt': 'HARREN: Go to the source. Bring me what you find.',
    'storydialog.schattenrat_finale.0.label': 'And your daughter?',
    'storydialog.schattenrat_finale.0.response': 'HARREN: (long pause) Bring me the truth. That one too. A father wants to know, not to dream.',

    'storydialog.edikt_anschlag.prompt': 'Three edicts, one board. Only one hangs at the very top, where it is read first. Whose colour do you hang on top?',
    'storydialog.edikt_anschlag.0.label': 'Magistrate on top — law and order',
    'storydialog.edikt_anschlag.0.response': 'The Magistrate\'s seal goes on top. Whoever reads it thinks of laws, not of chains.',
    'storydialog.edikt_anschlag.1.label': 'Clergy on top — the light of the council',
    'storydialog.edikt_anschlag.1.response': 'The Clergy\'s edict goes uppermost. Blessing and threat in the same sentence.',
    'storydialog.edikt_anschlag.2.label': 'Guard on top — protection through strength',
    'storydialog.edikt_anschlag.2.response': 'The Guard\'s order at the very top. More patrols, fewer questions.',

    'storydialog.oeffentliche_sitzung.prompt': 'HARREN: (quietly, on the way out) Tonight they meet once more. Down in the council chamber. Without an audience.',
    'storydialog.oeffentliche_sitzung.0.label': 'And then?',
    'storydialog.oeffentliche_sitzung.0.response': 'HARREN: Then you listen to what they say when nobody is watching. Put on the guard uniform. Stay in the shadows.',
    'storydialog.oeffentliche_sitzung.1.label': 'Why me?',
    'storydialog.oeffentliche_sitzung.1.response': 'HARREN: Because they know you down there. A craftsman carrying files catches nobody\'s eye.',

    'storydialog.elara_first_crack.prompt': 'ELARA: (folds the sheet away) This does not go to the press.',
    'storydialog.elara_first_crack.0.label': 'What does it say?',
    'storydialog.elara_first_crack.0.response': 'ELARA: One of ours betrayed someone while drunk. A good one. It would split the movement.',
    'storydialog.elara_first_crack.1.label': 'It is true.',
    'storydialog.elara_first_crack.1.response': 'ELARA: Much is true. Not everything helps. Ask yourself who it serves before you print it.',

    'storydialog.wiedersehen.prompt': 'HARREN: (quietly, once she has gone) You knew?',
    'storydialog.wiedersehen.0.label': 'No. I did not know.',
    'storydialog.wiedersehen.0.response': 'HARREN: She calls herself Elara now. To me she stays Lene. Look after her, down there.',
    'storydialog.wiedersehen.1.label': 'I suspected it.',
    'storydialog.wiedersehen.1.response': 'HARREN: Then you are wiser than I am. Look after her, down there. She will not let anyone help her.',

    'storydialog.bruch_nacht.prompt': 'ELARA: You trusted me. All this time.',
    'storydialog.bruch_nacht.0.label': 'I still do.',
    'storydialog.bruch_nacht.0.response': 'ELARA: (quietly) I know.',
    'storydialog.bruch_nacht.1.label': 'Should I not have?',
    'storydialog.bruch_nacht.1.response': '(She does not answer. She looks at the door.)',

    'storydialog.maulwurf_reveal.prompt': 'MARA: (as you return) Well? Who is it?',
    'storydialog.maulwurf_reveal.0.label': 'Elara.',
    'storydialog.maulwurf_reveal.0.response': 'MARA: (long silence) Then she led us all. Straight into his hands.',
    'storydialog.maulwurf_reveal.1.label': "I don't know.",
    'storydialog.maulwurf_reveal.1.response': 'MARA: You lie badly, Archivesmith. Good. Keep it until you know what you are doing.'
  };

  var I = window.i18n;
  if (I && typeof I.binden === 'function') {
    [byQuest, byScene].forEach(function (gruppe) {
      Object.keys(gruppe).forEach(function (id) {
        var e = gruppe[id], p = 'storydialog.' + id;
        I.binden(e, 'prompt', p + '.prompt');
        (e.choices || []).forEach(function (c, n) {
          I.binden(c, 'label', p + '.' + n + '.label');
          I.binden(c, 'response', p + '.' + n + '.response');
        });
      });
    });
    I.register('en', EN);
  }

  window.storyDialog = {
    byQuest: byQuest,
    byScene: byScene
  };
})();
