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
  // v6.1: Die Presse druckt alles, und die Stadt glaubt es ohne Siegel, weil
  // sie sich mit dem Bruch der Esse selbst wieder erinnert. Danach gibst Du
  // neue Druckplatten weg. Stufe 2: die Namen, die nach dem Nachhall lesbar
  // zurueckblieben (flags.nachhall_namen, eine Liste aus questSystem.getFlags),
  // stehen gleich nach dem Druck.
  var EPILOG = {
    de: {
      presse: 'Mit der Esse kehren Bruchstücke zurück. Die Leute bleiben auf der Strasse stehen und erinnern sich an Namen, an Gesichter, an Tage.',
      druck: 'Thom setzt die ganze Nacht, und Du druckst alles: zuoberst Aldrics Namen, dann den Rat, den Widerstand, Elara und die Namen der Verschwundenen.',
      nachhall: 'Unter den Namen der Verschwundenen stehen auch die, die nach dem Nachhall lesbar zurückblieben: {namen}. Thom setzt jeden einzeln, in grossen Lettern.',
      und: ' und ',
      glauben: 'Kein Blatt trägt ein Siegel. Die Stadt glaubt ihnen trotzdem, denn sie bestätigen, was jeder gerade selbst wieder weiss. Was an tausend Orten steht, kann niemand mehr verbrennen.',
      platten: 'Danach schmiedest Du neue Druckplatten und gibst sie weg. Der Mann, der die Siegel des Rats gemacht hat, macht jetzt Werkzeug für alle.',
      plattenZeichen: 'Danach schmiedest Du neue Druckplatten und gibst sie weg. Der Mann, der das Zeichen der drei Ketten geschmiedet hat, macht jetzt Werkzeug für alle.',
      nebel: 'Der Nebel bricht. Nicht, weil ihn jemand vertreibt, sondern weil zu viele Menschen sich zu vieles zugleich merken.',
      harren: 'Harren liegt unter dem Brunnen begraben. Neben seinen Namen hat jemand einen zweiten geritzt: Lene.',
      elaraLebt: 'Elara lebt, hinter den Gittern des Rathauskellers, in dem sie Dich einst gerettet hat. Jeden Tag fragt sie die Wache, ob die Presse noch läuft.',
      elaraTot: 'Elara liegt neben ihrem Vater. Ihre Klinge hängt über Thoms Setzkasten, und niemand fasst sie an.',
      vieleZurueck: 'Viele der Verschwundenen kehren zurück. Die Namen auf den Gesuchen, die Du behalten hast, wurden rechtzeitig gewarnt.',
      wenigeZurueck: 'Nur wenige der Verschwundenen kehren zurück. Die Namen auf den Gesuchen, die Du abgeliefert hast, standen zuerst auf den Listen des Rats.',
      einigeZurueck: 'Einige der Verschwundenen kehren zurück, blinzelnd, als kämen sie aus einem langen Schlaf.',
      namenGewarnt: 'Viele der Verschwundenen kehren zurück. Wen Du vor der Kettenwache gewarnt hast, war rechtzeitig fort und kommt jetzt aus den Kanälen hoch.',
      namenAbgeliefert: 'Nur wenige der Verschwundenen kehren zurück. Die Namen auf der Liste, die Du dem Priester gegeben hast, standen als erste in den Büchern des Rats.',
      aldricErzaehlt: 'Aldric lebt in einer Kammer unter dem Rathaus. Er hat seine Geschichte aus Deinem Mund gehört und liest sie jeden Tag auf Thoms Blättern nach, als ginge es um einen Fremden.',
      aldricVerschwiegen: 'Aldric irrt durch die unteren Gänge. Sein Name steht an jeder Tür der Stadt, und er weiss nicht, dass es seiner ist.',
      konvoiMann: 'Unter ihnen ist einer, dessen Name auf der Phiole stand, die am Konvoi zerbrach. Er erkennt Dich sofort.',
      branka: 'Branka steht neben Dir an der Presse. Sie hat das gesprungene Siegel damals gesehen und nie ein Wort darüber verloren.',
      brankaAlt: 'Branka steht neben Dir an der Presse.',
      mara: 'Mara verteilt die Blätter in den Gassen, in denen ihr Netz noch steht.',
      maraFort: 'Maras Netz ist seit dem Konvoi zerrissen. Sie bleibt nur, bis sie Dich zu Aldric geführt hat. Danach sieht sie keiner mehr.',
      thom: 'Thom druckt weiter, auch als die Garde vor seiner Tür steht. Sie geht wieder.',
      allein: 'Niemand steht neben Dir. Du liest die Blätter allein, auf dem leeren Platz.',
      erinnert: 'Und zwischen zwei Seiten erinnerst Du Dich an Deinen Namen. Der letzte Satz gehört Dir.',
      namenlos: 'Wer Du warst, bleibt im Nebel. Die Stadt nennt Dich den Archivschmied, und es genügt.'
    },
    en: {
      presse: 'With the forge, fragments come back. People stop in the street and remember names, faces, days.',
      druck: 'Thom sets type all night, and you print everything: Aldric\'s name at the top, then the council, the resistance, Elara and the names of the disappeared.',
      nachhall: 'Among the names of the disappeared are those that stayed readable after the Echo: {namen}. Thom sets each one by hand, in large letters.',
      und: ' and ',
      glauben: 'No sheet bears a seal. The city believes them anyway, because they confirm what everyone has just come to know again. What stands in a thousand places, nobody can burn any more.',
      platten: 'Afterwards you forge new printing plates and give them away. The man who made the council\'s seals now makes tools for everyone.',
      plattenZeichen: 'Afterwards you forge new printing plates and give them away. The man who forged the sign of the three chains now makes tools for everyone.',
      nebel: 'The fog breaks. Not because anyone drives it away, but because too many people remember too much at once.',
      harren: 'Harren lies buried beneath the fountain. Next to his name someone has carved a second one: Lene.',
      elaraLebt: 'Elara lives, behind the bars of the town hall cellar where she once rescued you. Every day she asks the guard whether the press is still running.',
      elaraTot: 'Elara lies beside her father. Her blade hangs above Thom\'s type case, and nobody touches it.',
      vieleZurueck: 'Many of the disappeared come back. The names on the petitions you kept were warned in time.',
      wenigeZurueck: 'Only a few of the disappeared come back. The names on the petitions you handed over were the first on the council\'s lists.',
      einigeZurueck: 'Some of the disappeared come back, blinking, as if from a long sleep.',
      namenGewarnt: 'Many of the disappeared come back. Those you warned about the chain guard got away in time and now climb up out of the canals.',
      namenAbgeliefert: 'Only a few of the disappeared come back. The names on the list you gave the priest were the first in the council\'s books.',
      aldricErzaehlt: 'Aldric lives in a chamber beneath the town hall. He heard his story from your mouth and reads it again every day on Thom\'s sheets, as if it were about a stranger.',
      aldricVerschwiegen: 'Aldric wanders the lower passages. His name is on every door in the city, and he does not know it is his.',
      konvoiMann: 'Among them is one whose name was on the vial that broke at the convoy. He recognizes you at once.',
      branka: 'Branka stands beside you at the press. She saw the cracked seal back then and never said a word about it.',
      brankaAlt: 'Branka stands beside you at the press.',
      mara: 'Mara hands out the sheets in the alleys where her network still holds.',
      maraFort: 'Mara\'s network has been torn since the convoy. She stays only until she has led you to Aldric. After that, no one sees her again.',
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
    var out = [T.presse, T.druck];
    var namen = (flags && Array.isArray(flags.nachhall_namen)) ? flags.nachhall_namen.filter(Boolean) : [];
    if (namen.length) {
      var liste = namen.length === 1 ? namen[0]
        : namen.slice(0, -1).join(', ') + T.und + namen[namen.length - 1];
      out.push(T.nachhall.replace('{namen}', liste));
    }
    out.push(T.glauben, T.nebel);
    if (flag(flags, 'harren_dead')) out.push(T.harren);
    out.push(st.elara === 'lives' ? T.elaraLebt : T.elaraTot);

    // v6.1: Maras Namensliste (klerus_district_purge) entscheidet. Die Gesuche
    // aus v5 nur noch fuer Staende, in denen diese Wahl noch nicht fiel.
    var zurueck = flag(flags, 'namen_gewarnt') ? T.namenGewarnt
      : flag(flags, 'namen_abgeliefert') ? T.namenAbgeliefert
      : flag(flags, 'petitions_kept') ? T.vieleZurueck
      : flag(flags, 'petitions_surrendered') ? T.wenigeZurueck : T.einigeZurueck;
    if (flag(flags, 'convoy_blade_drawn')) zurueck += ' ' + T.konvoiMann;
    out.push(zurueck);

    if (st.allies.branka) out.push(flag(flags, 'verification_refused') ? T.branka : T.brankaAlt);
    if (st.allies.mara) out.push(T.mara);
    else if (flag(flags, 'convoy_blown')) out.push(T.maraFort);
    if (st.allies.thom) out.push(T.thom);
    if (st.aloneAtEnd) out.push(T.allein);

    // v6.1: Aldrics Ende, sobald Die letzte Wache gespielt ist.
    if (flag(flags, 'aldric_erzaehlt')) out.push(T.aldricErzaehlt);
    else if (flag(flags, 'aldric_verschwiegen')) out.push(T.aldricVerschwiegen);

    // v6.1, leise: Wer weiss, dass das Zeichen der drei Ketten von ihm ist
    // (Klinge im Inventar oder Branka), dem bindet der Epilog es hier an.
    out.push(flag(flags, 'schmiedemarke_erkannt') ? T.plattenZeichen : T.platten);
    out.push(st.remembered ? T.erinnert : T.namenlos);
    return out;
  }

  window.QuestFinale = {
    computeFinaleState: computeFinaleState,
    epilog: epilog
  };
})();
