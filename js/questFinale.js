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
    // Regler 1 — Verrat vorhergesehen: Maulwurf-Spur ODER das Zeichen auf der
    // Klinge erkannt (#156; vorher die Handschriften-Spur three_hands_seen).
    var betrayalForeseen = flag(flags, 'mole_evidence') || flag(flags, 'zeichen_bemerkt');

    // Regler 4 — Selbst erinnert: allein aus who_you_were (self_remembered).
    var remembered = flag(flags, 'self_remembered');

    // Regler 2 — Wer steht neben dir (jeweils unabhängig).
    // Mara: resistance-freundliches Handeln (Gesuche behalten ODER Maulwurf-
    // Beweise) UND nicht im Konvoi aufgeflogen. `petitions_surrendered` allein
    // macht Mara NICHT anwesend (die petitions_kept-Bedingung greift dann nicht).
    var maraPresent = (flag(flags, 'petitions_kept') || flag(flags, 'mole_evidence'))
      && !flag(flags, 'convoy_blown');
    // Branka (#145, Bibel v5 Abschnitt 9): Das Ratssiegel entscheidet. Wer es
    // verweigert hat, dem vertraut sie; wer es gesetzt hat, der verwaltete die
    // Siegel des Schattenrats, und sie steht nicht neben ihm. Nur wenn keine
    // der beiden Antworten gespeichert ist (alte Spielstaende), zaehlt wie
    // bisher das Gespraech in who_you_were.
    var brankaPresent = flag(flags, 'verification_refused')
      || (!flag(flags, 'verification_sealed') && flag(flags, 'branka_ally'));
    var thomPresent = flag(flags, 'thom_ally');

    var allies = { branka: brankaPresent, mara: maraPresent, thom: thomPresent };

    // Regler 3 — Lebt Elara.
    // Die explizite Spieler-Wahl im Finale hat Vorrang (elara_spared/elara_killed).
    // Fehlt sie (Finale noch nicht gespielt), wird abgeleitet: verschonbar nur
    // mit Vertrauen UND Beweisen -> lebt, gebrochen; sonst ihre eigene Klinge.
    // Damit stimmt der Zustand mit dem überein, was der Spieler tatsächlich
    // gewählt hat, statt es nur zu prognostizieren.
    var hasProof = flag(flags, 'mole_evidence') || flag(flags, 'zeichen_bemerkt');
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

  // --- #158: Der Epilog -----------------------------------------------------
  // Das Ende steht fest (Bibel v5, Abschnitt 9): Endkampf, Presse, der Nebel
  // bricht. Die Entscheidungen unterwegs faerben, was danach erzaehlt wird.
  // Reine Funktion wie computeFinaleState: Flags rein, Absaetze raus.
  var EPILOG = {
    de: {
      presse: 'Thom setzt die ganze Nacht. Am Morgen hängen die Blätter an jeder Tür: der Schattenrat, Aldric, die inszenierte Flucht, der gelenkte Widerstand. Und Elara.',
      nebel: 'Der Nebel bricht. Nicht, weil ihn jemand vertreibt, sondern weil zu viele Menschen sich zu vieles zugleich merken.',
      harren: 'Harren liegt unter dem Brunnen begraben. Neben seinen Namen hat jemand einen zweiten geritzt: Lene.',
      elaraLebt: 'Elara lebt, hinter den Gittern des Rathauskellers, in den sie Dich einst hinabgeschickt hat. Jeden Tag fragt sie die Wache, ob die Presse noch läuft.',
      elaraTot: 'Elara liegt neben ihrem Vater. Ihre Klinge hängt über Thoms Setzkasten, und niemand fasst sie an.',
      vieleZurueck: 'Viele der Verschwundenen kehren zurück. Die Namen auf den Gesuchen, die Du behalten hast, wurden rechtzeitig gewarnt.',
      wenigeZurueck: 'Nur wenige der Verschwundenen kehren zurück. Die Namen auf den Gesuchen, die Du abgeliefert hast, standen zuerst auf den Listen des Rats.',
      einigeZurueck: 'Einige der Verschwundenen kehren zurück, blinzelnd, als kämen sie aus einem langen Schlaf.',
      konvoiMann: 'Einer von ihnen ist der Mann vom Konvoi. Er erkennt Dich sofort.',
      branka: 'Branka steht neben Dir an der Presse. Sie hat nicht vergessen, dass Du das Siegel verweigert hast.',
      brankaAlt: 'Branka steht neben Dir an der Presse.',
      mara: 'Mara verteilt die Blätter in den Gassen, in denen ihr Netz noch steht.',
      maraFort: 'Mara bleibt verschwunden. Ihr Netz ist seit dem Konvoi zerrissen.',
      thom: 'Thom druckt weiter, auch als die Garde vor seiner Tür steht. Sie geht wieder.',
      allein: 'Niemand steht neben Dir. Du liest die Blätter allein, auf dem leeren Platz.',
      erinnert: 'Und zwischen zwei Seiten erinnerst Du Dich an Deinen Namen. Der letzte Satz gehört Dir.',
      namenlos: 'Wer Du warst, bleibt im Nebel. Die Stadt nennt Dich den Archivschmied, und es genügt.'
    },
    en: {
      presse: 'Thom sets type all night. By morning the sheets hang on every door: the Shadow Council, Aldric, the staged escape, the steered resistance. And Elara.',
      nebel: 'The fog breaks. Not because anyone drives it away, but because too many people remember too much at once.',
      harren: 'Harren lies buried beneath the fountain. Next to his name someone has carved a second one: Lene.',
      elaraLebt: 'Elara lives, behind the bars of the town hall cellar she once sent you down into. Every day she asks the guard whether the press is still running.',
      elaraTot: 'Elara lies beside her father. Her blade hangs above Thom\'s type case, and nobody touches it.',
      vieleZurueck: 'Many of the disappeared come back. The names on the petitions you kept were warned in time.',
      wenigeZurueck: 'Only a few of the disappeared come back. The names on the petitions you handed over were the first on the council\'s lists.',
      einigeZurueck: 'Some of the disappeared come back, blinking, as if from a long sleep.',
      konvoiMann: 'One of them is the man from the convoy. He recognizes you at once.',
      branka: 'Branka stands beside you at the press. She has not forgotten that you refused the seal.',
      brankaAlt: 'Branka stands beside you at the press.',
      mara: 'Mara hands out the sheets in the alleys where her network still holds.',
      maraFort: 'Mara stays gone. Her network has been torn since the convoy.',
      thom: 'Thom keeps printing, even when the guard stands at his door. It leaves again.',
      allein: 'Nobody stands beside you. You read the sheets alone, on the empty square.',
      erinnert: 'And between two pages you remember your name. The last sentence is yours.',
      namenlos: 'Who you were stays in the fog. The city calls you the Archivesmith, and it is enough.'
    }
  };

  /**
   * Die Absaetze des Epilogs in Reihenfolge.
   * @param {object} flags
   * @param {string} [lang] 'de' (Standard) oder 'en'
   * @returns {string[]}
   */
  function epilog(flags, lang) {
    var T = EPILOG[lang === 'en' ? 'en' : 'de'];
    var st = computeFinaleState(flags);
    var out = [T.presse, T.nebel];
    if (flag(flags, 'harren_dead')) out.push(T.harren);
    out.push(st.elara === 'lives' ? T.elaraLebt : T.elaraTot);

    var zurueck = flag(flags, 'petitions_kept') ? T.vieleZurueck
      : flag(flags, 'petitions_surrendered') ? T.wenigeZurueck : T.einigeZurueck;
    if (flag(flags, 'convoy_blade_drawn')) zurueck += ' ' + T.konvoiMann;
    out.push(zurueck);

    if (st.allies.branka) out.push(flag(flags, 'verification_refused') ? T.branka : T.brankaAlt);
    if (st.allies.mara) out.push(T.mara);
    else if (flag(flags, 'convoy_blown')) out.push(T.maraFort);
    if (st.allies.thom) out.push(T.thom);
    if (st.aloneAtEnd) out.push(T.allein);

    out.push(st.remembered ? T.erinnert : T.namenlos);
    return out;
  }

  window.QuestFinale = {
    computeFinaleState: computeFinaleState,
    epilog: epilog
  };
})();
