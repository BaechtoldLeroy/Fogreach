// js/questSystem.js — Quest System for Fogreach

(function () {
  'use strict';

  // Story-Schema-Version (Feature 062, v4). Steht im Quest-Save-Blob. Beim Laden
  // eines Stands mit fehlender oder älterer Version wird der Story-/Quest-/Flag-
  // Teil verworfen und auf Akt 0 zurückgesetzt (Charakter-State liegt ausserhalb
  // und bleibt). Die v3-Struktur (andere Quest-IDs, entfernte final_truth) ist
  // nicht kompatibel -> sauberer Reset statt fragiler Teilmigration.
  const STORY_VERSION = 4;

  // Spielerstufe fuer Angebots-Sperren. playerLevel ist ein script-scoped
  // `let` in main.js; der Spiegel auf window wird nur bei Erfahrungsgewinn
  // nachgezogen (addXP) und kann nach dem Laden fehlen. Darum zuerst der echte.
  function _spielerStufe() {
    try { if (typeof playerLevel === 'number') return playerLevel; } catch (e) { /* nicht geladen */ }
    if (typeof window !== 'undefined' && typeof window.playerLevel === 'number') return window.playerLevel;
    return 1;
  }

  // Mindestens ein Lauf ganz durchgespielt? Jeder abgeschlossene Lauf an der
  // Tiefengrenze hebt sie um eins (RunDepth.tryCompleteRun), der erste also
  // von 1 auf 2. Gilt damit auch fuer Altstaende ohne eigenen Zaehler.
  function _laeufeAbgeschlossen() {
    var P = (typeof window !== 'undefined') ? window.Persistence : null;
    return !!(P && typeof P.getMaxDepth === 'function' && P.getMaxDepth() >= 2);
  }

  // ---- Quest Definitions ----
  const QUEST_DEFINITIONS = {
    // =======================================================
    // === Act 1: Der Auftrag ===
    // =======================================================
    aldric_cleanup: {
      id: 'aldric_cleanup',
      title: 'Säuberung der Keller',
      description: 'Besiege 10 Gegner in den Kellern unter der Archivschmiede.',
      npcId: 'aldric',
      type: 'kill',
      chain: 1,
      objectives: [
        { type: 'kill', target: 'enemy', current: 0, required: 10 }
      ],
      rewards: { xp: 30, materials: { MAT: 5 }, druckblaetter: 2 },
      rewardTier: 'neben',
      prerequisites: [],
      requiredAct: 0,
      // Auftakt-Seiten VOR dem eigentlichen Auftrag (nur beim ERSTEN Aldric-
      // Gespraech, siehe _showNpcDialogue: completedCount === 0). Etablieren
      // Aldric als kuehlen Rat-Aufseher, der den alten Dich kannte, und
      // schatten das Erinnerungs-Thema vor, ohne die Verschwoerung zu spoilern.
      dialogueIntro: [
        'Der Archivschmied. Man sagte mir, Du seist wieder auf den Beinen.\n\nErinnerst Du Dich an mich? … Nein. Natürlich nicht.',
        'Wir kannten uns, Du und ich. Du hast Akten gesiegelt, an die niemand mehr rühren sollte: ordentliche, verlässliche Arbeit.\n\nVon dieser Verlässlichkeit hätte ich gern wieder etwas.'
      ],
      dialogueOffer: 'Unten in den Kellern hat sich Ungeziefer eingenistet. Wilde Tiere, sagen die Wachen. Räum sie aus — zehn Stück, dann reden wir weiter.\n\nWillst du diese Aufgabe übernehmen?',
      dialogueProgress: 'Die Keller sind noch nicht sicher. Kämpfe weiter.',
      // Der Hinweis aufs Journal steht hier, weil ab jetzt mehrere Auftraege
      // gleichzeitig offen sind (die Einfuehrungen haengen alle an diesem).
      dialogueComplete: 'Gut. Die Keller sind gesäubert. Hier ist dein Lohn.\n\n(Was offen ist, steht in Deinem Journal — Taste J oder das Journal-Symbol oben rechts.)'
    },
    aldric_patrol: {
      id: 'aldric_patrol',
      title: 'Keller-Patrouille',
      description: 'Räume 3 Räume in den Kellern, um alle Gänge zu sichern.',
      npcId: 'aldric',
      type: 'explore',
      chain: 2,
      objectives: [
        { type: 'explore', target: 'room', current: 0, required: 3 }
      ],
      rewards: { xp: 40, druckblaetter: 1 },
      rewardTier: 'neben',
      prerequisites: [],
      requiredAct: 0,
      dialogueOffer: 'Stell sicher, dass alle Gänge sicher sind. Patrouilliere drei Räume.\n\nBist du bereit?',
      dialogueProgress: 'Noch nicht alle Gänge gesichert. Weiter patrouillieren.',
      dialogueComplete: 'Alle Gänge sind sicher. Gute Arbeit, Archivschmied.'
    },

    // =======================================================
    // === Akt 1: Awakening (Feature 050 — Vertical Slice) ===
    // =======================================================
    // 6-quest linear chain. Q1 (Harren) unlocks Q2-Q5 simultaneously;
    // Q6 unlocks when all 4 Council/Widerstand jobs are done. Player does
    // all 6 in one playthrough. The Council-collusion reveal in Q6
    // is the political-thesis payoff (constitution §Setting).
    //
    // Legacy Akt-1 quests deleted: aldric_intruders, harren_daughter,
    // branka_armor (see WP02 T010). No save migration — unknown IDs in old
    // save files are silently dropped by loadQuestSaveData.
    // -----------------------------------------------------------------------
    // #143: Einfuehrungsquests — jedes System kommt ueber eine Quest herein,
    // nicht ueber einen Tutorialkasten.
    //
    // Ein Tutorialschritt haelt das Spiel an, sagt etwas und wartet. Eine
    // Quest ist ein Grund: nach ihr hat man in der Schmiede einmal etwas
    // verbessert und weiss, wozu sie taugt. Die Belohnung ist bewusst klein
    // — gross genug, sie anzunehmen, zu klein, um zum Pflichtweg zu werden.
    // Erfahrung fest 10 (rewardTier 'einfuehrung', waechst nicht mit dem
    // Stufenbedarf); der Lohn ist das Geschenk zum System.
    //
    // Wer sie liegen laesst, bekommt sie nicht nachgereicht: sie bleibt beim
    // NPC stehen und ist jederzeit abholbar.
    einfuehrung_schmiede: {
      id: 'einfuehrung_schmiede',
      title: 'Der erste Schliff',
      description: 'Geh in die Schmiede und baue dort an der Werkbank ein Ausrüstungsstück aus.',
      npcId: 'branka',
      type: 'system',
      chain: 1,
      objectives: [
        { type: 'system', target: 'upgrade', current: 0, required: 1 }
      ],
      rewards: { xp: 10, materials: { MAT: 8 } },
      rewardTier: 'einfuehrung',
      prerequisites: ['aldric_cleanup'],
      requiredAct: 0,
      dialogueOffer: 'Du trägst das, was Du unten gefunden hast, und Du trägst es, wie man ein Werkzeug trägt, das einem fremd ist.\n\nKomm mit in die Schmiede, die Tür gleich neben mir. Leg eines Deiner Stücke auf die Werkbank und drück auf „Ausbauen“ — dann wird es Deins. Diesmal geht es auf mich; danach kostet es Gold und Eisenbrocken, und Du machst es allein.',
      dialogueProgress: 'Du hast es noch nicht gemacht. Geh in die Schmiede, leg ein Stück auf die Werkbank und drück auf „Ausbauen“. Diesmal zahle ich.',
      dialogueComplete: '(Sie dreht es einmal ins Licht.) Siehst Du. Dasselbe Stück, nur nicht mehr dasselbe.\n\nJedes Mal, wenn Du hochkommst, kommst Du hier vorbei. Nicht weil ich das sage, sondern weil Du sonst mit dem runtergehst, was letzte Woche gereicht hat.'
    },
    einfuehrung_presse: {
      id: 'einfuehrung_presse',
      title: 'Eine Zeile, die bleibt',
      description: 'Geh in die Druckerei und lass Setzer Thom dort ein Edikt drucken.',
      npcId: 'thom',
      type: 'system',
      chain: 1,
      objectives: [
        { type: 'system', target: 'edikt', current: 0, required: 1 }
      ],
      rewards: { xp: 10, druckblaetter: 2 },
      rewardTier: 'einfuehrung',
      prerequisites: ['aldric_cleanup'],
      requiredAct: 0,
      dialogueOffer: 'Der Rat schreibt jede Woche vor, was die Stadt denken soll. Wir können dasselbe — kleiner, aber wir können es.\n\nDu hast Druckblätter dabei, ich sehe sie. Komm rein in die Druckerei, gleich neben mir, und such Dir ein Edikt aus — ich setze es. Es wirkt, solange es hängt, und es kostet Dich Aufmerksamkeit beim Rat. Beides sollst Du einmal gespürt haben, bevor es darauf ankommt.',
      dialogueProgress: 'Noch hängt nichts. Geh in die Druckerei, such Dir ein Edikt aus, ich setze es.',
      dialogueComplete: '(Er wischt sich die Finger am Kittel ab.) Jetzt steht es an jeder Ecke, und irgendwer liest es laut vor.\n\nMerk Dir nur eins: Jede Zeile, die wir drucken, legt der Rat auf seine Waage. Druck nicht mehr, als Du unten wieder gutmachen kannst.'
    },
    einfuehrung_markt: {
      id: 'einfuehrung_markt',
      title: 'Was unter dem Tisch liegt',
      description: 'Kauf Mara auf dem Schwarzmarkt etwas ab.',
      npcId: 'mara',
      type: 'system',
      chain: 1,
      objectives: [
        { type: 'system', target: 'markt', current: 0, required: 1 }
      ],
      rewards: { xp: 10, gold: 30 },
      rewardTier: 'einfuehrung',
      prerequisites: ['aldric_cleanup'],
      requiredAct: 0,
      // Angeboten erst, wenn ihr Stand offen ist (Schwarzmarkt ab erreichter
      // Tiefe 4, LootSystem). Vorher stand die Tiefe als Hinweis im Text, und
      // ein minDepth fror den Kauf ein, solange der LAUFENDE Lauf flacher war —
      // gekauft wird aber oben bei ihr.
      gate: function () {
        var ls = (typeof window !== 'undefined') ? window.LootSystem : null;
        return !ls || typeof ls.isBlackMarketUnlocked !== 'function' || ls.isBlackMarketUnlocked();
      },
      dialogueOffer: 'Du schleppst Gold herum, als wüsstest Du nicht, wofür. Ich schon.\n\nIch habe einen Stand — hier, unter dem Tisch. Frag nicht, woher die Ware kommt. Nimm irgendetwas, das Billigste reicht. Danach weisst Du, dass es ihn gibt, und das ist der ganze Punkt.',
      dialogueProgress: 'Nimm irgendetwas. Ich schreibe nicht auf, was.',
      // v6.1: Mara kennt Dich von früher (Akt 2, Die Späherin). Hier verrät sie
      // es nur, ohne es auszusprechen.
      dialogueComplete: '(Sie zählt das Gold nicht nach.) Gut. Du legst es immer noch zuerst auf den Tisch und fragst erst danach. (Sie stockt, als hätte sie schon zu viel gesagt.) Und jetzt vergiss, dass ich Dir das gezeigt habe.\n\nWas ich nicht habe, hat vielleicht der Alte mit dem Karren, da unten. Wer mit vollen Taschen hochkommt und sie wieder mit runternimmt, hat etwas nicht verstanden.'
    },
    einfuehrung_talente: {
      id: 'einfuehrung_talente',
      title: 'Wofür du taugst',
      description: 'Setz einen Punkt im Talentbaum (T) und leg die neue Fähigkeit im Loadout (K) auf eine Taste.',
      npcId: 'aldric',
      type: 'system',
      chain: 1,
      // Zwei Schritte in dieser Reihenfolge: erst der Punkt (er lehrt die
      // Faehigkeit), dann der Platz auf der Leiste. Ohne den zweiten liegt die
      // gelernte Faehigkeit ungenutzt im Loadout — gelernt, aber nie benutzt.
      objectives: [
        { type: 'system', target: 'talent', current: 0, required: 1 },
        { type: 'system', target: 'loadout', current: 0, required: 1 }
      ],
      rewards: { xp: 10, potions: 1 },
      rewardTier: 'einfuehrung',
      prerequisites: ['aldric_cleanup'],
      requiredAct: 0,
      dialogueOffer: 'Der Rat führt über jeden Bürger eine Akte, und in Deiner steht ein Wort, das mich stört: unbestimmt.\n\nDas lässt sich ändern. Du sammelst unten Erfahrung, und Erfahrung wird zu Punkten. Setz einen. Wut, Ketten oder Schatten — such es Dir aus. Der Rat schätzt Leute, die sich festlegen.\n\nUnd dann: Ein Werkzeug, das Du nicht griffbereit hast, ist kein Werkzeug. Leg es auf eine Taste.',
      dialogueProgress: 'Noch immer unbestimmt. Öffne den Baum und setz einen Punkt. Welchen, ist Deine Sache.',
      // Wenn der Punkt gesetzt ist, die Faehigkeit aber noch auf keiner Taste liegt.
      dialogueProgressNext: 'Festgelegt, gut. Aber ein Werkzeug, das Du nicht griffbereit hast, ist kein Werkzeug. Leg es auf eine Taste — im Loadout, K oder über das Menü.',
      dialogueComplete: '(Er notiert etwas, ohne aufzusehen.) Festgelegt. Gut.\n\nDie Akte wird Dich überleben, Archivschmied. Das ist keine Drohung, das ist Verwaltung.'
    },
    // Die Charakterwerte: vorher nur hinter dem Portraet und im Menue. Erst
    // nach dem ersten Stufenaufstieg — vorher steht im Bogen nichts, was sich
    // je veraendert haette.
    einfuehrung_akte: {
      id: 'einfuehrung_akte',
      title: 'Deine Akte',
      description: 'Sieh Dir Deine Charakterwerte an (C oder Dein Porträt oben links).',
      npcId: 'aldric',
      type: 'system',
      chain: 1,
      objectives: [
        { type: 'system', target: 'charakterwerte', current: 0, required: 1 }
      ],
      rewards: { xp: 10, potions: 1 },
      rewardTier: 'einfuehrung',
      prerequisites: ['aldric_cleanup'],
      requiredAct: 0,
      gate: function () { return _spielerStufe() >= 2; },
      dialogueOffer: 'Der Rat führt eine Akte über Dich. Sieh nach, was darin steht.\n\nStärke, Geschick, Vitalität — das ist jetzt aktenkundig. Wer weiss, was über ihn geschrieben steht, kann sich danach richten. Die anderen werden danach gerichtet.',
      dialogueProgress: 'Du hast noch nicht hineingesehen. Die Akte liegt offen — C, oder Dein Porträt oben links.',
      dialogueComplete: '(Er schlägt die Akte zu.) Jetzt weisst Du, was der Rat weiss. Nicht mehr.\n\nSieh wieder hinein, wenn Du etwas Neues trägst. Die Akte lügt nicht — das überlässt sie anderen.'
    },
    // Die Truhe im Hub (#127). Erst nach dem ersten abgeschlossenen Lauf: erst
    // dann hat man mehr gefunden, als ins Laufinventar passt, und die Frage
    // "was hebe ich auf" ist eine echte.
    einfuehrung_truhe: {
      id: 'einfuehrung_truhe',
      title: 'Was sich lohnt aufzuheben',
      description: 'Leg in der Truhe unter der Schmiede einen Gegenstand ab.',
      npcId: 'branka',
      type: 'system',
      chain: 2,
      objectives: [
        { type: 'system', target: 'truhe', current: 0, required: 1 }
      ],
      rewards: { xp: 10, gold: 30 },
      rewardTier: 'einfuehrung',
      prerequisites: ['einfuehrung_schmiede'],
      requiredAct: 0,
      gate: function () { return _laeufeAbgeschlossen(); },
      dialogueOffer: 'Du kommst mit vollen Taschen hoch und wirfst unten die Hälfte weg, weil kein Platz mehr ist. Das ist kein Abwägen, das ist Verschwendung.\n\nDie Truhe unter der Schmiede gehört Dir. Was Du erst in drei Läufen brauchst, gehört hinein — sie bleibt, auch wenn Du unten liegen bleibst. Leg ein Stück hinein, dann weisst Du, wie es geht.',
      dialogueProgress: 'Die Truhe ist noch leer. Geh zu ihr, unter der Schmiede, mach sie auf und zieh ein Stück hinüber.',
      dialogueComplete: '(Sie nickt zur Truhe hin.) So. Jetzt hast Du einen Ort, an dem nichts verloren geht.\n\nAber pass auf: Eine Truhe voller Zeug, das Du nie wieder anfasst, ist auch nur ein Haufen. Leg hinein, was Du brauchen wirst — nicht, was Du nicht wegwerfen magst.'
    },
    // Der Wissensbaum bei Branka: ihre erste Zeile im Hub macht die Begruendung
    // schon selbst — "Erst wenn jede Klinge Wissen traegt, faellt ihre Maske".
    // Voraussetzung ist Harrens Auftrag, weil der ein Fragment auszahlt: ohne
    // eines liesse sich der Auftrag nicht erfuellen, und genau das soll eine
    // Einfuehrung nie sein.
    einfuehrung_wissen: {
      id: 'einfuehrung_wissen',
      title: 'Was die Mauern wissen',
      description: 'Bind bei Branka in der Archivschmiede ein Erinnerungsfragment in Metall (Wissensbaum).',
      npcId: 'branka',
      type: 'system',
      chain: 2,
      objectives: [
        { type: 'system', target: 'wissen', current: 0, required: 1 }
      ],
      rewards: { xp: 10, fragments: 1 },
      rewardTier: 'einfuehrung',
      prerequisites: ['einfuehrung_schmiede', 'harren_daughter_investigation'],
      // requiredAct 0, obwohl sie fruehestens in Akt 1 auftaucht: die
      // Voraussetzung oeffnet den Akt selbst, und der Akt-1-Bestand soll eine
      // Aussage ueber die GESCHICHTE bleiben, nicht ueber Einfuehrungen.
      requiredAct: 0,
      dialogueOffer: 'Stahl allein schneidet die Lügen des Rates nicht. Das sage ich jedem, und jeder nickt und versteht es nicht.\n\nDu trägst ein Fragment bei Dir. Ein Stück von etwas, das jemand aufgeschrieben und der Rat verbrannt hat. Früher haben die Archivschmiede so etwas hier in Metall gebunden, damit die Stadt es nie verliert. Bind es in Metall, dann kann der Nebel es nicht nehmen. Ich zeig Dir, wie.',
      dialogueProgress: 'Das Fragment liegt noch bei Dir herum. Komm an den Amboss und bind es in Metall. Es wird nicht mehr wert, wenn Du wartest.',
      dialogueComplete: '(Sie sieht Dich einen Moment zu lange an.) Und? Nichts blitzt, nichts klingelt. So ist Wissen, wenn es hält.\n\nJedes Fragment, das Du unten findest, bindest Du hier. Der Rat sammelt sie auch, nur verbrennt er sie.'
    },
    // Die Amulette fuehrt NUR der wandernde Haendler unten (ShopScene mit
    // _dungeonMerchant); Maras Stand hat sie nicht. Darum schickt sie einen
    // hinunter, statt selbst zu verkaufen. Keine Mindesttiefe: der Haendler
    // ist ein Ereignis, kein Versprechen — ihr eigener Stand (Tiefe 4) haengt
    // als Voraussetzung ohnehin davor.
    einfuehrung_amulett: {
      id: 'einfuehrung_amulett',
      title: 'Der Alte mit dem Karren',
      description: 'Kauf dem wandernden Händler in der Tiefe etwas ab.',
      npcId: 'mara',
      type: 'system',
      chain: 2,
      objectives: [
        { type: 'system', target: 'haendler', current: 0, required: 1 }
      ],
      rewards: { xp: 10, gold: 45 },
      rewardTier: 'einfuehrung',
      prerequisites: ['einfuehrung_markt'],
      requiredAct: 0,
      dialogueOffer: 'Da unten läuft ein Alter mit einem Karren herum. Frag mich nicht, wie er hineinkommt — ich weiss es nicht, und ich will es nicht wissen.\n\nKauf ihm etwas ab. Irgendetwas. Er führt Zeug, das über meinen Tisch nie gehen würde, und tiefer unten hängen Amulette an seinem Karren. Ich will nur, dass Du einmal bei ihm gestanden hast.',
      dialogueProgress: 'Der Alte taucht auf, wenn er will. Lauf weiter runter, dann triffst Du ihn. Und nimm Gold mit — billig ist er nicht.',
      dialogueComplete: '(Sie betrachtet es aus sicherem Abstand.) Du hast also bei ihm gekauft.\n\nGeh wieder hin, wenn Du tiefer kommst. Was er dann führt, ändert einen ganzen Lauf — und was es Dir nimmt, merkst Du meistens später.'
    },
    harren_daughter_investigation: {
      id: 'harren_daughter_investigation',
      title: 'Die verschwundene Tochter',
      description: 'Finde das Tagebuchfragment der Bürgermeistertochter im Rathauskeller.',
      npcId: 'harren',
      type: 'fetch',
      chain: 1,
      // 'journal_fragment' target wired in js/loot.js as a quest-item drop
      // (10% chance per enemy kill while the quest is active). On pickup,
      // loot.js:416 calls updateQuestProgress('fetch', target, 1). Player
      // sees the item drop, picks it up, quest ticks — natural flow.
      objectives: [
        { type: 'fetch', target: 'journal_fragment', current: 0, required: 1 }
      ],
      rewards: { xp: 50, fragments: 1 },
      rewardTier: 'boss',
      // Akt 0 onboarding gates Akt 1: the player must complete Aldric's two
      // warmup quests (cleanup + patrol) before Harren approaches with the
      // mayor's-daughter investigation. Keeps the tutorial-to-narrative
      // ramp legible — generic kill/explore quests first, then story.
      prerequisites: ['aldric_cleanup', 'aldric_patrol'],
      requiredAct: 0,
      // Öffnet Akt 1 ("Der treue Diener"): ab hier arbeitet der Spieler die
      // vier Fraktionsaufträge ab. Der Akt existierte vorher nur dem Namen
      // nach — die Quests hingen alle in Akt 0, niemand sprang je auf 1.
      advanceAct: 1,
      dialogueOffer: 'Meine Tochter ist verschwunden. Aldric sagt, sie sei geflohen. Der Klerus spricht von Besessenheit. Die Garde redet von Pflichtversäumnis.\n\nIch glaube keinem der drei, bevor ich nicht ihre eigenen Worte gelesen habe. Bring mir das Tagebuchfragment, das sie zurückgelassen hat. Du findest es im Rathauskeller — irgendwo, wo der Rat nicht hingeschaut hat.\n\nVertrau niemandem, bis du es selbst gesehen hast.',
      dialogueProgress: 'Such weiter — das Fragment ist da unten. Aldric, Klerus und Garde streiten sich oben, weil sie alle eine andere Version hören wollen. Du findest die echte.',
      dialogueComplete: 'Du hast es. Alle drei Ratsfraktionen stehen darin, mit Namen. Lene ist nicht einfach geflohen, Archivschmied. Jemand hat sie verschwinden lassen.\n\nDu wirst gleich von allen Seiten Aufträge bekommen. Nimm sie an. Hör Dir alles an. Dann komm zurück zu mir.'
    },
    magistrat_verification: {
      id: 'magistrat_verification',
      title: 'Verifikation des Magistrats',
      description: 'Beschaffe das ratsgesiegelte Verifikationsdokument für den Magistrat.',
      npcId: 'aldric',
      type: 'fetch',
      chain: 2,
      // Feature 062: 'fetch verification_seal' — als Quest-Item-Drop von WP05
      // (js/loot.js) verdrahtet (Muster journal_fragment). Das Ratssiegel wird
      // in der Archivschmiede gesetzt. Ob gesiegelt oder verweigert, setzt die
      // Wahl beim Abgeben (storyDialog). Frueher setzte completionFlags hier
      // 'verification_sealed' als Vorgabe — auch fuer den, der VERWEIGERT
      // hatte; er trug danach beide Flaggen (#145).
      objectives: [
        { type: 'fetch', target: 'verification_seal', current: 0, required: 1 }
      ],
      rewards: { xp: 75 },
      rewardTier: 'story',
      prerequisites: ['harren_daughter_investigation'],
      requiredAct: 1,
      dialogueOffer: 'Du hast das Fragment gesehen. Gut. Dann weisst du auch, dass die Tochter neu klassifiziert werden muss — von "geflohen" zu "vermisste Person von Interesse". Eine reine Verwaltungsangelegenheit, verstehst du. Akten müssen ordnungsgemäss geführt werden.\n\nDas ratsgesiegelte Verifikationsdokument liegt in der versunkenen Registratur — dort unten, wo der Nebel die alten Akten verschluckt hat. Steig hinab, birg das Ratssiegel und bring es mir. Was dir dabei begegnet, ist nicht mein Ressort. Der Magistrat trägt die Verantwortung, nicht der Bürger.\n\nNimmst du den Auftrag an?',
      dialogueProgress: 'Das Ratssiegel liegt noch da unten in der versunkenen Registratur. Steig weiter hinab und birg es. Ohne das Dokument ist die Neuklassifizierung nicht rechtskräftig.',
      // v6.1: zwei Abschluesse, Siegel abliefern oder unbemerkt beschaedigen.
      // Die Wahl folgt auf diesen Text (storyDialog.byQuest.magistrat_verification)
      // und setzt verification_sealed bzw. verification_refused. Die Namen der
      // Flaggen bleiben aus v5 (Spielstaende, Finale), "refused" heisst jetzt:
      // das Siegel ist beschaedigt.
      dialogueComplete: '(Aldric streckt die Hand aus, ohne von seinen Akten aufzusehen.) Das Siegel, Archivschmied. Die Neuklassifizierung wartet.\n\n(Das Wachs in Deiner Hand ist noch weich. Ein Druck mit dem Daumen, und es hält nicht mehr. Niemand würde es merken, ausser jemand, der Siegel macht.)'
    },
    klerus_purification: {
      id: 'klerus_purification',
      title: 'Reinigung der unteren Kammern',
      description: 'Reinige die unteren Kammern des Rathauskellers — besiege 3 Elite-Gegner. Die Ketzer-Anführer lauern erst ab Tiefe 3.',
      npcId: 'klerus_priester',
      type: 'kill',
      chain: 2,
      minDepth: 3,
      objectives: [
        { type: 'kill', target: 'elite_enemy', current: 0, required: 3 }
      ],
      rewards: { xp: 90 },
      rewardTier: 'story',
      prerequisites: ['harren_daughter_investigation'],
      requiredAct: 1,
      dialogueOffer: 'Du hast das Fragment gesehen, Archivschmied. Dann weisst Du, dass die Tochter nicht aus eigenem Willen geflohen ist. Sie wurde von einer dunklen Hand geführt, die unteren Kammern bersten vor solchen Schatten.\n\nReinige sie. Drei der Anführer dieser ketzerischen Präsenz lauern noch dort unten, tiefer als die ersten Gänge. Steige bis Tiefe 3 hinab. Fälle sie im Namen der Ordnung. Die Seele der Tochter wird es Dir danken, wenn das Licht sie wiederfindet.\n\nDie Reinigung ist eine geistliche Pflicht. Nimm sie an.',
      dialogueProgress: 'Die Anführer lauern tief — erst ab Tiefe 3. Steige hinab, finde sie, fälle sie. Jede Ketzerei, die du beendest, öffnet einen weiteren Pfad zur Reinheit.',
      dialogueComplete: 'Du hast die Ketzerei geschlagen. Die unteren Kammern atmen wieder. Die Ordnung bleibt, durch Dich. Der Klerus segnet Deine Hand. Bring sie weiter dorthin, wo das Licht es verlangt.'
    },
    garde_patrol_expansion: {
      id: 'garde_patrol_expansion',
      title: 'Patrouillen-Erweiterung',
      description: 'Demonstriere Kraft für die nächsten Patrouillen — besiege 10 Störer.',
      npcId: 'stadtwache',
      type: 'kill',
      chain: 2,
      // Trigger fix: 'edict patrol_expansion' had no Printing-House hook —
      // quest couldn't complete. Switched to 'kill enemy x 10' which uses
      // the existing enemy-kill trigger. Narratively the player "bolsters
      // patrol effectiveness by force demonstration".
      objectives: [
        { type: 'kill', target: 'enemy', current: 0, required: 10 }
      ],
      rewards: { xp: 75 },
      rewardTier: 'story',
      prerequisites: ['harren_daughter_investigation'],
      requiredAct: 1,
      dialogueOffer: 'Wenn eine Tochter aus dem Rathaus verschwinden kann, ist das ein Versagen der Garde — und das wird sich ändern. Ich brauche eine Patrouillen-Erweiterung. Heute. Geh in die unteren Kammern und demonstriere Kraft — zehn Störer fallen, das Edikt trägt sich von selbst durch die Strassen.\n\nFrag nicht, ob die Patrouillen schoner Lebensweise zuträglich sind. Frag nicht, wer entscheidet, wohin sie laufen. Loyalität ist die einzige Münze, die zählt. Das Edikt ist die Münze, die du in meine Hand legst.\n\nNimmst du den Auftrag an, Archivschmied?',
      dialogueProgress: 'Zehn Störer noch. Jeder gefallene Körper ist eine Zeile mehr im Bericht. Die Garde wartet auf das Ergebnis.',
      dialogueComplete: 'Der Bericht ist geschrieben. Zehn Störer weniger, und die Garde kann dem Rat mehr Patrouillen vorschlagen. Niemand wird mehr verschwinden — oder zumindest niemand, der zählt. Die Garde merkt sich, wer schnell antwortet.'
    },
    widerstand_proof: {
      id: 'widerstand_proof',
      title: 'Das Ratsdokument',
      description: 'Finde ein verstecktes Ratsdokument im Rathauskeller, ein paar Räume tiefer.',
      // Elara kommt nicht in den Hub; abgegeben wird, wenn sie unten
      // auftaucht (roomManager, ELARA_AUFTRAEGE). Der Hinweis sagt das,
      // sobald der Auftrag fertig ist (getAbgabeHinweis).
      abgabeHinweis: 'Bring Elara das Ratsdokument. Sie findet Dich im Keller.',
      npcId: 'elara',
      type: 'fetch',
      chain: 2,
      // 'council_document' target wired in js/loot.js as a quest-item drop
      // (10% chance per enemy kill while the quest is active).
      objectives: [
        { type: 'fetch', target: 'council_document', current: 0, required: 1 }
      ],
      rewards: { xp: 100, fragments: 1 },
      rewardTier: 'story',
      // v6.1: Elara rettet Dich, gibt Dir das Buendel und erst danach dieses
      // Dokument. Angeboten im Dungeon (roomManager, ELARA_AUFTRAEGE).
      prerequisites: ['harren_daughter_investigation', 'resistance_fetch_01'],
      requiredAct: 1,
      dialogueOffer: 'Du hast mir das Bündel gebracht und es nicht geöffnet. Gut. Dann kann ich Dir zeigen, was ich gesehen habe, bevor Du weiter ihre Aufträge erledigst.\n\nIch will, dass DU siehst, was ich gesehen habe, bevor du weiter ihre Aufträge erledigst. Unten im Rathauskeller liegt ein Dokument, das die drei Ratsfraktionen nie zusammen unterzeichnet haben sollten — und doch ist ihr Siegel darauf. Alle drei.\n\nBring es mir. Dann reden wir.',
      dialogueProgress: 'Das Dokument liegt ein paar Räume tiefer. Es ist klein, aber das Siegel darauf wird dir den Atem nehmen.',
      dialogueComplete: 'Drei Siegel. Eine Unterschrift. Magistrat, Klerus, Garde — sie behaupten in der Öffentlichkeit, sie wären Rivalen. Hinter verschlossenen Türen stimmen sie überein. Geh zu Harren. Er wartet auf den Moment, in dem du das verstehst.'
    },
    council_collusion_reveal: {
      id: 'council_collusion_reveal',
      title: 'Die geheime Sitzung',
      description: 'Sieh Dir die öffentliche Ratssitzung an. Dann belausche die geheime Sitzung in der Ratskammer unter dem Rathaus.',
      npcId: 'harren',
      // #159/#147: zwei echte Schritte statt Abhaken beim Annehmen — erst die
      // oeffentliche Sitzung (Hub, storyScenes.playOeffentlicheSitzung), dann
      // die geheime (Spionage in der Ratskammer, storyScenes.playGeheimeSitzung).
      type: 'observe',
      chain: 3,
      objectives: [
        { type: 'observe', target: 'oeffentliche_sitzung', current: 0, required: 1 },
        { type: 'observe', target: 'collusion_reveal_seen', current: 0, required: 1 }
      ],
      rewards: { xp: 150, fragments: 1 },
      rewardTier: 'boss',
      // #160: Die oeffentliche Sitzung verkuendet das Ergebnis der Abstimmung
      // aus faction_campaign — sie setzt sie deshalb voraus.
      prerequisites: ['magistrat_verification', 'klerus_purification', 'garde_patrol_expansion', 'widerstand_proof', 'faction_campaign'],
      requiredAct: 1,
      // Egal welches Edikt gewann: die Patrouillen verdoppeln sich (Hub).
      completionFlags: ['patrouillen_verdoppelt'],
      // Trigger -> Akt 2 (Das Doppelspiel). advanceAct + der hartverdrahtete
      // advanceToAct(2) in completeQuest (idempotent) — beides führt auf 2.
      // Objective bleibt 'dialogue' (Auto-Complete): der observe-Trigger der
      // inszenierten Sitzung kommt mit dem Inszenierungs-Feature (Feature 062
      // Scope: Rückgrat, keine Szenen). Ein Wechsel auf 'observe' ohne diese
      // Szene machte Akt 2 unerreichbar.
      advanceAct: 2,
      dialogueOffer: 'Heute verkündet der Rat das Ergebnis der Abstimmung, öffentlich, im Ratssaal. Magistrat, Klerus, Garde, vor allen Bürgern. Geh hin und hör zu. Und dann folge ihnen in der Nacht, wenn sie glauben, dass keiner zusieht.',
      dialogueProgress: 'Die Ratskammer liegt unten im Keller. Zieh die Uniform der Wache an, bleib im Schatten und hör zu, was sie sagen, wenn keiner zusieht.',
      // v6.1: Harren gehoert nicht zum Widerstand. "fuer mich", nicht "fuer uns".
      dialogueComplete: 'Jetzt hast Du es gesehen. Ein Gesicht, drei Masken. Du hast für jede gearbeitet. Du könntest fliehen, aber ein Handwerker, der weiter im Rathaus aus und ein geht, sieht Dinge, die ein Flüchtiger nie sieht. Bleib, wo Du bist. Räum weiter für sie, und heimlich für mich. Es ist gefährlicher. Es ist auch das Einzige, was nützt.'
    },

    // =======================================================
    // === Act 3: Erste Risse ===
    // =======================================================
    mara_contact: {
      id: 'mara_contact',
      title: 'Die Späherin',
      description: 'Kundschafte für Mara drei Kellerräume des Rats aus.',
      npcId: 'mara',
      type: 'explore',
      chain: 1,
      objectives: [
        { type: 'explore', target: 'room', current: 0, required: 3 }
      ],
      rewards: { xp: 60, info: 'Maras Netzwerk enthüllt', infoKey: 'quest.reward.info.mara_contact' },
      rewardTier: 'story',
      prerequisites: [],
      requiredAct: 2,
      // v6.1: keine Selbstvorstellung mehr. Ihr kennt euch vom Schwarzmarkt
      // (einfuehrung_markt), und dort hat sie schon zu viel gesagt.
      dialogueOffer: 'Du hast an meinem Tisch gekauft und nie gefragt, warum ich weiss, wie Du bezahlst. (Sie schiebt die Ware beiseite.) Ich kenne Dich von früher, Archivschmied. Von bevor Du Dein Gedächtnis verloren hast. Du hast damals Fragen gestellt, die der Rat begraben wollte.\n\nBevor ich Dir mein Netz öffne, will ich sehen, ob Du noch sehen kannst. Geh hinab und kundschafte drei Kellerräume aus. Präg Dir ein, was der Rat dort versteckt.',
      dialogueProgress: 'Noch nicht genug gesehen. Drei Räume — und präg dir jeden ein.',
      dialogueComplete: 'Drei Räume, in jedem dasselbe: leere Zellen, frische Ketten, Listen mit Namen. Die Vermissten verschwinden nicht zufällig — der Rat lässt sie verschwinden, und jede Fraktion deckt die andere.\n\nJetzt weiss ich, dass du noch der Alte bist. Mein Netzwerk steht dir offen — es gibt Arbeit, die nur jemand erledigen kann, an den sich niemand erinnert. Wie dich.'
    },
    elara_meeting: {
      id: 'elara_meeting',
      title: 'Elaras Geheimnis',
      description: 'Finde 2 geheime Dokumente, die Elara versteckt hat.',
      abgabeHinweis: 'Bring Elara die beiden Dokumente. Sie findet Dich im Keller.',
      npcId: 'elara',
      type: 'fetch',
      chain: 1,
      objectives: [
        { type: 'fetch', target: 'document', current: 0, required: 2 }
      ],
      rewards: { xp: 100, unlocks: ['elara_trust'] },
      rewardTier: 'story',
      // Feature 062: elara_trust auch als Story-Flag setzen (Regler 3 im Finale).
      completionFlags: ['elara_trust'],
      prerequisites: [],
      requiredAct: 2,
      dialogueOffer: 'Du willst wissen, wofür wir das tun? Hier — lies das.\n\nFinde zwei Dokumente, die ich im Keller versteckt habe.',
      dialogueProgress: 'Die Dokumente sind gut versteckt. Suche weiter.',
      dialogueComplete: 'Jetzt siehst du es. Das tut der Rat mit denen, die verschwinden: Er braucht sie für seine Rituale. Namen, die niemand mehr ausspricht, weil sich niemand an sie erinnert.'
    },
    branka_doubt: {
      id: 'branka_doubt',
      title: 'Zweifel der Schmiedin',
      description: 'Besiege 5 Elite-Gegner, um Beweise für Brankas Verdacht zu finden.',
      npcId: 'branka',
      type: 'kill',
      chain: 2,
      objectives: [
        { type: 'kill', target: 'elite_enemy', current: 0, required: 5 }
      ],
      rewards: { xp: 80 },
      rewardTier: 'story',
      prerequisites: [],
      requiredAct: 2,
      dialogueOffer: 'Diese Rüstungen sind für Gefangene, nicht Soldaten. Hilf mir, Beweise zu finden.\n\nBesiege fünf Elite-Wachen und bring mir ihre Befehle.',
      dialogueProgress: 'Die Elite-Wachen tragen die Beweise bei sich. Kämpfe weiter.',
      dialogueComplete: 'Ich hatte recht. Der Rat baut Gefängnisse, keine Kasernen. Wir müssen handeln.'
    },

    // =======================================================
    // === Feature 055 — Akt 2: Gehorsam vs. Erinnerung ===
    // requiredAct 2; Story DURCH Quests (keine Entscheidungen/Gates).
    // Council-Strang (Aldric) + privater Strang (Mara/Branka) laufen
    // parallel und münden in den scripted Wendepunkt (advanceAct).
    // =======================================================
    council_seizure: {
      id: 'council_seizure',
      title: 'Beschlagnahme',
      description: 'Beschlagnahme die "subversiven Schriften" — sammle 3 Bündel aus den Kellern.',
      npcId: 'aldric',
      type: 'fetch',
      chain: 1,
      objectives: [
        { type: 'fetch', target: 'seized_writings', current: 0, required: 3 }
      ],
      rewards: { xp: 60, druckblaetter: 2 },
      rewardTier: 'story',
      // Stufe 1b: Kein Vorgabe-Flag mehr. Bis b459 setzte der Abschluss immer
      // petitions_surrendered, auch wer die Gesuche heimlich behielt: beide
      // Flags standen, und 'abgegeben oder nichts gewaehlt' liess sich nie
      // unterscheiden. Die Wahl beim Abgeben (storyDialog) setzt genau eines.
      prerequisites: [],
      requiredAct: 2,
      dialogueOffer: 'Im Keller hortet Gesindel subversive Schriften gegen den Rat. Beschlagnahme sie — drei Bündel. Lies sie nicht. Bring sie.\n\nNimmst du den Auftrag an?',
      dialogueProgress: 'Noch nicht alle Schriften sichergestellt. Such weiter.',
      dialogueComplete: 'Gib her.\n\n(Bevor du sie abgibst, fällt dein Blick auf eine Zeile. Es sind keine Pamphlete. Es sind Gesuche — Bürger, die nach verschwundenen Angehörigen fragen.)'
    },
    council_surveillance: {
      id: 'council_surveillance',
      title: 'Überwachung',
      description: 'Überwache die Kellergänge unter dem Rathaus für den Rat — durchsuche 3 Kammern.',
      npcId: 'aldric',
      type: 'explore',
      chain: 2,
      objectives: [
        { type: 'explore', target: 'room', current: 0, required: 3 }
      ],
      rewards: { xp: 70, druckblaetter: 1 },
      rewardTier: 'story',
      prerequisites: ['council_seizure'],
      requiredAct: 2,
      dialogueOffer: 'Unten in den alten Gängen soll sich Gesindel zusammenrotten, heisst es. Durchkämm drei Kammern und melde, wer sich dort versammelt.\n\nBereit?',
      dialogueProgress: 'Noch nicht alle Kammern durchsucht. Sieh weiter nach.',
      dialogueComplete: 'Bericht angenommen.\n\n(Keine Verschwörer. Nur Menschen, die sich im Dunkeln verstecken — vor dem Rat, nicht gegen ihn.)'
    },
    branka_transcripts: {
      id: 'branka_transcripts',
      title: 'Verbotene Abschriften',
      description: 'Bring Branka 2 Verhörprotokolle aus den Kellern.',
      npcId: 'branka',
      type: 'fetch',
      chain: 3,
      objectives: [
        { type: 'fetch', target: 'interrogation_record', current: 0, required: 2 }
      ],
      rewards: { xp: 80, fragments: 1 },
      rewardTier: 'story',
      prerequisites: ['mara_contact'],
      requiredAct: 2,
      dialogueOffer: 'Im Keller lagern Protokolle aus Verhören. Nicht von Dämonen — von Menschen. Bring mir zwei Abschriften. Vorsichtig.',
      dialogueProgress: 'Die Protokolle sind tief im Keller. Such weiter.',
      dialogueComplete: 'Lies das. "Befragt bis zum Geständnis." Der Rat verhört Bürger wie Beschworene. Das ist kein Schutz — das ist Jagd.'
    },
    // Feature 062: umbenannt von 'ritual_chamber'. Kein advanceAct mehr — der
    // Aktwechsel liegt jetzt am Bruch (bruch_confrontation). Akt 3, Doppel-Tonspur.
    verseuchte_kammer: {
      id: 'verseuchte_kammer',
      title: 'Die verseuchte Kammer',
      description: 'Aldric schickt dich, eine "verseuchte" Kammer zu reinigen. Dring bis zu ihr vor, sie liegt ab Tiefe 15.',
      npcId: 'aldric',
      type: 'explore',
      chain: 4,
      minDepth: 15,
      angebotAb: 15,
      objectives: [
        { type: 'explore', target: 'room', current: 0, required: 2 }
      ],
      rewards: { xp: 120, fragments: 1 },
      rewardTier: 'story',
      prerequisites: ['council_surveillance'],
      requiredAct: 3,
      dialogueOffer: 'Eine untere Kammer ist verseucht — Ketzerei, ab Tiefe 15. Reinige sie. Frag nicht, was du findest.\n\nGeh.',
      dialogueProgress: 'Die Kammer liegt tiefer, ab Tiefe 15. Dring weiter vor.',
      // v6.1: Hier siehst Du, WO Menschen abgefuellt werden. Was in den Phiolen
      // ist und wohin sie gehen, zeigt erst der Schacht (elara_ritual).
      dialogueComplete: 'Du stehst in der Kammer. Kein Ketzer weit und breit. Auf dem Boden ein Kreidekreis, an seinem Rand Ketten, in den Stein geschlagen. Daneben Kisten voller leerer Phiolen, sauber aufgereiht, jede mit einem Etikett, auf dem noch kein Name steht.\n\n(Hier werden Menschen abgefüllt. Aldric hat Dich geschickt, um die Spuren zu verwischen. Du prägst Dir alles ein. Mara soll es wissen, und Aldric soll glauben, Du hättest nur geputzt.)'
    },
    bruch_confrontation: {
      id: 'bruch_confrontation',
      title: 'Der Bruch',
      description: 'Aldric hat Wachen auf Dich gehetzt. Schlag Dich durch, besiege 3 Elite-Wachen. Sie stellen Dich erst in der Tiefe (ab Tiefe 20). Branka weiss ein Versteck.',
      npcId: 'branka',
      type: 'kill',
      chain: 5,
      minDepth: 20,
      angebotAb: 20,
      objectives: [
        { type: 'kill', target: 'elite_enemy', current: 0, required: 3 }
      ],
      rewards: { xp: 200 },
      rewardTier: 'boss',
      // Vorbedingungen: die verseuchte Kammer gesehen UND Elaras zweite
      // Wahrheit erfahren. v6.1: Der Bruch gehoert noch zu Akt 3 (Die
      // Enttarnung), den Akt beendet erst der Maulwurf (espionage_informant).
      // 'enttarnt' schliesst ab hier das Rathaus (hubPhase: 'broken').
      prerequisites: ['verseuchte_kammer', 'elara_second_truth'],
      requiredAct: 3,
      completionFlags: ['enttarnt'],
      dialogueOffer: 'Aldric weiss es. Dein Doppelspiel ist aufgeflogen, seine Elite-Wachen riegeln die tiefen Gänge ab, ab Tiefe 20 stellst Du sie. Schlag Dich durch und komm zu mir. Ich kenne einen Ort, an dem Dich keiner sucht.',
      dialogueProgress: 'Aldrics Elite-Wachen halten die Tiefe. Ab Tiefe 20 stellst Du sie.',
      // v6.1: Branka versteckt Dich nicht selbst, sie bringt Dich zu Elara.
      dialogueComplete: 'Du stellst zu viele Fragen, hat er gesagt. Jetzt fragst Du nicht mehr, Du weisst es. Die Tarnung ist verbrannt, oben ist kein Ort mehr für Dich.\n\n(Branka zieht Dir eine Kapuze über und führt Dich durch die Kanäle, bis zu einem Spalt in der Kellerwand.) Elara wartet dort unten. Bei ihr findet Dich keiner. Geh. Ich halte die Schmiede offen.'
    },

    // -------------------------------------------------------
    // Espionage-Missionen (WP04). Abschluss via 'observe'-
    // Objective, das die Espionage-Mechanik in kuratierten
    // Räumen feuert. Targets sind FIXER VERTRAG mit der
    // Mechanik: convoy_intel / archive_record / informant_id.
    // Kein gate, kein advanceAct — prerequisites nur Erzähl-
    // Reihenfolge. Q7/Q9 säen Elara-Foreshadow + Paranoia.
    // -------------------------------------------------------
    espionage_convoy: {
      id: 'espionage_convoy',
      title: 'Der Konvoi',
      description: 'Beschatte verkleidet einen Konvoi des Rats im Lagerhaus und höre ihn ab.',
      npcId: 'mara',
      type: 'observe',
      chain: 6,
      objectives: [
        { type: 'observe', target: 'convoy_intel', current: 0, required: 1 }
      ],
      rewards: { xp: 90, druckblaetter: 2 },
      rewardTier: 'story',
      prerequisites: ['mara_contact'],
      requiredAct: 2,
      dialogueOffer: 'Heute Nacht entladen sie im alten Lagerhaus einen Konvoi des Rats. Zieh die Wachuniform an, bleib im Schatten und hör zu — aber zieh keine Klinge, sonst fliegt die Verkleidung auf.\n\nUebernimmst du das?',
      dialogueProgress: 'Du bist noch nicht nah genug. Misch dich unter die Wachen am Konvoi und hör ab, was verladen wird — unentdeckt.',
      // v6.1: Nur versiegelte Phiolen, Inhalt unbekannt. Was darin ist, siehst
      // Du erst am Schacht zur Esse (elara_ritual).
      dialogueComplete: 'Du hast es gehört. Keine Vorräte, keine Waffen. Kisten voller Phiolen, jede mit dem Wachs des Rats versiegelt. Was darin ist, sagt keiner, auch nicht, wenn sie unter sich sind. Nur wohin sie gehen: hinab, mit dem nächsten Transport.'
    },
    espionage_archive: {
      id: 'espionage_archive',
      title: 'Das versiegelte Archiv',
      description: 'Infiltriere verkleidet das Archiv des Rats (ab Tiefe 12), höre die Schreiber ab und birg den versiegelten Akt.',
      npcId: 'harren',
      type: 'observe',
      chain: 7,
      // #72: gestaffelt, damit Akt 3 nicht in einem Lauf erledigt ist.
      minDepth: 12,
      objectives: [
        { type: 'observe', target: 'archive_record', current: 0, required: 1 }
      ],
      rewards: { xp: 110, fragments: 1 },
      rewardTier: 'story',
      // v6.1: Vorgaenger ist das Wiedersehen (HubSceneV2, Flag elara_ist_lene).
      // Elara hat ihm erzaehlt, sie sei geflohen; er will es glauben, aber lesen.
      prerequisites: [],
      gate: function () { return !!questFlags.elara_ist_lene; },
      requiredAct: 3,
      dialogueOffer: 'Sie war hier. Lene. Sie sagt, sie sei geflohen, aus eigenem Willen, und dass sie nicht bleiben kann. (Er dreht den Amtsring an seinem Finger.) Ich will ihr glauben, Archivschmied. Aber ich will es lesen.\n\nIm Archiv des Rats liegt ihre Akte, versiegelt, tief unter dem Rathaus, ab Tiefe 12. Geh als Schreiber verkleidet hinein, hör ab, was die anderen flüstern, und bring mir die Akte. Werde nicht gesehen.\n\nTust Du das für mich?',
      dialogueProgress: 'Das Archiv liegt ab Tiefe 12. Die Schreiber haben noch nichts Verwertbares gesagt. Bleib im Archiv, unauffällig, und hör weiter ab, bis du an den versiegelten Akt kommst.',
      dialogueComplete: 'Du hast den Akt. "Vermisst, Fall geschlossen" — das Verschwinden seiner Tochter, sauber abgelegt, Datum, Siegel, Unterschrift. Und das Datum liegt vor dem Tag, an dem sie verschwand.\n\n(Harren liest es zweimal.) Sie haben es geplant. Jemand im Rat hat Lenes Verschwinden abgeheftet, bevor es geschah.'
    },
    espionage_informant: {
      id: 'espionage_informant',
      title: 'Der Maulwurf',
      description: 'Enttarne verkleidet einen Maulwurf des Rats in den Reihen des Widerstands (ab Tiefe 23).',
      npcId: 'mara',
      type: 'observe',
      chain: 8,
      // #72: gestaffelt, damit Akt 4 nicht in einem Lauf erledigt ist.
      minDepth: 23,
      objectives: [
        { type: 'observe', target: 'informant_id', current: 0, required: 1 }
      ],
      rewards: { xp: 120, fragments: 1 },
      rewardTier: 'story',
      // Feature 062: setzt mole_evidence (Regler 3 im Finale). observe informant_id
      // von WP05 (espionageSystem) verdrahtet.
      completionFlags: ['mole_evidence'],
      // #155: Nach dem Bruch (Story-Bibel v5): erst die Nacht, in der Elara Dich
      // versteckt, dann die Spur zu ihr. Vorher konnte der Maulwurf VOR dem
      // Bruch fallen, und der Verrat kam vor dem tiefsten Vertrauen.
      // v6.1: Der Maulwurf ist das Ende von Akt 3 und oeffnet Akt 4 (Die
      // Quelle). Bis b457 oeffnete der Bruch den Akt.
      prerequisites: ['espionage_archive', 'bruch_confrontation'],
      requiredAct: 3,
      advanceAct: 4,
      dialogueOffer: 'Jemand verrät uns. Was wir hinter verschlossenen Türen beschliessen, weiss der Rat am nächsten Morgen. Misch dich verkleidet unter unsere eigenen Leute am Treffpunkt, tief unten, ab Tiefe 23, und finde heraus, wer der Maulwurf ist. Beweg dich leise — sie kennen dein Gesicht nicht in dieser Montur.\n\nFindest du den Verräter?',
      dialogueProgress: 'Noch hast du den Maulwurf nicht. Bleib unauffällig am Treffpunkt (ab Tiefe 23) und hör ab, wer Nachrichten nach draussen schmuggelt.',
dialogueComplete: 'Du bist dem Zettel gefolgt, bis in die Ratskammer. Elara, neben Aldric. An ihrem Ring das Zeichen der drei Ketten. Sie hat uns alle geführt — direkt in seine Hände.'
    },

    // =======================================================
    // === Act 4: Die Wahrheit sickert durch ===
    // =======================================================
    // -------------------------------------------------------
    // Elaras erster Auftrag. Bis #154 nur ab Widerstands-Ansehen
    // >= 25 angeboten — bei +1 je Quest praktisch nie (#85). Das
    // Ansehen ist entfernt, der Auftrag steht von Anfang an offen.
    // -------------------------------------------------------
    resistance_fetch_01: {
      id: 'resistance_fetch_01',
      title: 'Das versiegelte Bündel',
      description: 'Hol das versiegelte Bündel aus dem Keller. Niemand darf es sehen, und öffne es nicht.',
      abgabeHinweis: 'Bring Elara das Bündel. Sie findet Dich im Keller.',
      npcId: 'elara',
      // #155/#156: Vorher "kill enemy x5" — der Auftrag sprach von einem Buendel,
      // es gab aber keines. Jetzt ein echter Fund (loot.js: sealed_bundle). Das
      // Siegel traegt das Zeichen des Schattenrats: der Spieler bringt Elara
      // ihre eigenen Befehle, ohne es zu wissen (Story-Bibel v5, Abschnitt 5).
      type: 'fetch',
      chain: 0,
      objectives: [
        { type: 'fetch', target: 'sealed_bundle', current: 0, required: 1 }
      ],
      rewards: { xp: 25, materials: { MAT: 3 } },
      rewardTier: 'neben',
      // v6.1: Akt 1, nach der Rettung im Keller (elaraMet, roomManager:
      // _showElaraDialog Stufe 1 nimmt ihn an). Danach erst das Ratsdokument
      // (widerstand_proof). Vorher stand das Buendel im Prolog, vor ihr.
      prerequisites: ['harren_daughter_investigation'],
      requiredAct: 1,
      gate: function () { return !!questFlags.elaraMet; },
      dialogueOffer: 'Du stehst noch. Gut. Dann kannst Du mir gleich einen Gefallen tun.\n\nIrgendwo hier unten liegt ein Bündel, versiegelt. Bring es mir, ohne dass jemand es sieht. Und öffne es nicht. Danach reden wir über den Rat.',
      dialogueProgress: 'Das Bündel liegt irgendwo da unten. Sieh Dich um, und lass es zu.',
      dialogueComplete: 'Du hast es. Und Du hast es nicht geöffnet. Gut. Jetzt weiss ich, dass ich Dir trauen kann.\n\n(Auf dem Wachs des Siegels: drei Ketten, ineinander verschlungen. Du hast dieses Zeichen noch nie gesehen.)'
    },

    elara_ritual: {
      id: 'elara_ritual',
      title: 'Die Ritualkammer',
      description: 'Steige auf Tiefe 20 hinab und besiege den Zeremonienmeister, der die Ritualkammer des Rats hält.',
      abgabeHinweis: 'Elara wartet im Keller auf Dich.',
      npcId: 'elara',
      type: 'boss',
      chain: 2,
      // Vorher: abstraktes `wave:reach_wave 20`. Jetzt der Boss, der auf genau
      // dieser Tiefe (Tier-Gate 20) sitzt — gleiche Tiefen-Anforderung, aber ein
      // echtes Ziel, und der Zeremonienmeister bekommt endlich Story-Zweck
      // (Elaras Ritualkammer <-> der Meister der verbotenen Rituale).
      objectives: [
        { type: 'boss_kill', target: 'zeremonienmeister', current: 0, required: 1 }
      ],
      // Stufe 1b (Story v6.1): eines der wenigen echten Nebelamulette des Rats.
      rewards: { xp: 150, items: [{ key: 'RITUAL_AMULETT', basis: 'HD_SCHLANGENMASKE', tier: 2, name: 'Nebelamulett des Rats', nameKey: 'quest.reward.RITUAL_AMULETT', iconKey: 'itHeadSchlangenmaske', signatur: { armor: 0.12 } }] },
      rewardTier: 'boss',
      prerequisites: ['elara_meeting'],
      requiredAct: 3,
      // v6.1: Am Schacht zur Esse. Hier lehrt Elara Dich, wie man die Esse
      // "zerstoert": indem man ihre Bindung loest. In Wahrheit ist genau dieses
      // Loesen das Erneuern (Finale, js/finale.js). 'bindung_gelehrt' haelt
      // fest, dass der Spieler es gehoert hat.
      completionFlags: ['bindung_gelehrt'],
      dialogueOffer: 'Unter der Ritualkammer des Rats liegt ein Schacht. Er führt hinab zu dem, was den Nebel macht. Der Zeremonienmeister hält die Kammer davor. Steig auf Tiefe 20 hinab und fälle ihn. Dann zeige ich Dir, wohin der Schacht führt.\n\nBist Du bereit für die Wahrheit?',
      dialogueProgress: 'Der Zeremonienmeister hält die Kammer noch. Du findest ihn auf Tiefe 20. Solange er lebt, kommst Du nicht an den Schacht.',
      dialogueComplete: 'Der Zeremonienmeister ist gefallen. (Hinter ihm der Schacht. Tief unten ein Glühen, rot wie eine Esse, und daraus steigt der Rauch auf, grau und dicht.)\n\nDas ist sie. Die Esse. Sie verbrennt, was in den Phiolen ist: Erinnerungen. Ihr Rauch ist der Nebel.\n\nZerschlagen kann man sie nicht. Man muss ihre Bindung lösen, so wie Du ein Siegel löst. Ein Schlag an der richtigen Stelle, in der richtigen Richtung. Deine Hände wissen, wie das geht. Ich zeige Dir die Stelle, wenn es so weit ist.\n\nNimm dieses Amulett. Es schützt vor dem Nebel, wenn Du tiefer gehst.'
    },
    thom_truth: {
      id: 'thom_truth',
      title: 'Verbotene Wahrheiten',
      description: 'Finde 5 Druckplatten mit den verbotenen Wahrheiten über den Rat (ab Tiefe 14).',
      npcId: 'thom',
      type: 'fetch',
      chain: 1,
      // #72: gestaffelt.
      minDepth: 14,
      objectives: [
        { type: 'fetch', target: 'print_plate', current: 0, required: 5 }
      ],
      rewards: { xp: 100, materials: { MAT: 20 } },
      rewardTier: 'story',
      prerequisites: [],
      requiredAct: 3,
      dialogueOffer: 'Ich habe genug gedruckt, was der Rat will. Zeit für die Wahrheit.\n\nFinde fünf Druckplatten, tief im Keller, ab Tiefe 14 — sie enthalten die echte Geschichte.',
      dialogueProgress: 'Die Druckplatten liegen tief im Rathauskeller, ab Tiefe 14. Suche weiter.',
      dialogueComplete: 'Fantastisch! Diese Platten enthalten Beweise, die der Rat vernichten wollte. Die Wahrheit geht in Druck.'
    },
    mara_warning: {
      id: 'mara_warning',
      // v6.1: umbenannt (vorher "Maras Warnung"), es ist ein Bosskampf.
      title: 'Der Kettenmeister',
      description: 'Besiege den Kettenmeister auf Tiefe 10, der den Weg zu den Siegelkammern des Rats bewacht.',
      npcId: 'mara',
      type: 'boss',
      chain: 2,
      objectives: [
        { type: 'boss_kill', target: 'kettenmeister', current: 0, required: 1 }
      ],
      rewards: { xp: 200, items: [{ tier: 2 }] },
      rewardTier: 'boss',
      // Feature 062: Spionage zuerst, damit die Doppelphase atmet. Der Fall des
      // Kettenmeisters (Tiefe 10) sichert die ersten harten Beweise.
      prerequisites: ['mara_contact', 'espionage_convoy'],
      requiredAct: 2,
      // Trigger -> Akt 3 (Die Enttarnung).
      advanceAct: 3,
      dialogueOffer: 'Auf Tiefe 10 hält der Kettenmeister den Weg. Früher war er Hauptmann der Garde, heute ist nur noch sein Befehl übrig. Er fesselt, wen er fangen will. Fäll ihn, dann sehen wir, was er bewacht.',
      dialogueProgress: 'Der Kettenmeister lebt noch, auf Tiefe 10. Wenn er Dich kettet, schlag die Kette, sonst hält er Dich.',
      dialogueComplete: 'Der Kettenmeister ist gefallen. Hinter ihm lagen Kammern voller Siegel. Der Rat versiegelt dort unten mehr als Akten, und jetzt haben wir den ersten Beweis dafür.'
    },

    // =======================================================
    // === Act 5: Der Bruch ===
    // =======================================================
    // b479: "Waffen für den Widerstand" (branka_weapons, drei Gegenstaende
    // schmieden) entfernt, er passte nicht mehr in die Geschichte. Alte
    // Staende laden ohne ihn: unbekannte Ids ueberspringt loadQuestSaveData.
    thom_pamphlets: {
      id: 'thom_pamphlets',
      title: 'Die Pamphlete',
      description: 'Schliesse 3 tiefe Läufe in die Keller ab (ab Tiefe 27), um Flugblätter bis in die untersten Gänge zu verteilen.',
      npcId: 'thom',
      type: 'dungeon_runs',
      chain: 2,
      minDepth: 27,
      angebotAb: 27,
      objectives: [
        { type: 'dungeon_run', target: 'dungeon_complete', current: 0, required: 3 }
      ],
      rewards: { xp: 200, unlocks: ['xp_bonus_10'] },
      rewardTier: 'story',
      prerequisites: ['thom_truth'],
      requiredAct: 4,
      dialogueOffer: 'Die oberen Gänge lesen unsere Wahrheit schon. Jetzt brauchen wir die Tiefe, dort, wo der Rat seine Geheimnisse hält.\n\nSchliess drei Durchläufe ab Tiefe 27 ab und nimm die Blätter mit hinunter. Wer dort unten liest, liest dort, wo der Rat es nicht erwartet.',
      dialogueProgress: 'Nur tiefe Durchläufe zählen, ab Tiefe 27. Schliess drei davon ab. Jeder trägt unsere Blätter weiter hinunter.',
      // v6.1: abgeschwaecht. Aufwachen tut die Stadt erst im Finale.
      dialogueComplete: 'Die unteren Gänge lesen mit. Die Blätter wandern von Hand zu Hand, bis hinab zu den Kammern des Rats. Und der Rat merkt es: Gestern hat die Garde zwei Drucker verhört, die nie für mich gearbeitet haben. (Er grinst schief.)\n\nDeine Erfahrung wächst nun schneller. (+10% XP)'
    },
    elara_blade: {
      id: 'elara_blade',
      title: 'Elaras Geschenk',
      description: 'Elara hat eine besondere Klinge für Dich schmieden lassen.',
      abgabeHinweis: 'Elara wartet im Keller auf Dich.',
      npcId: 'elara',
      type: 'dialogue',
      chain: 3,
      elaraGift: true,
      // Angebot erst ab Tiefe 20 (nach dem Zeremonienmeister). Kein minDepth:
      // Annahme und Abschluss sind eine Szene, kein Kellerziel.
      angebotAb: 20,
      objectives: [
        { type: 'dialogue', target: 'elara_gift', current: 0, required: 1 }
      ],
      rewards: { xp: 100, items: [{ key: 'ELARAS_KLINGE', basis: 'WPN_EISENKLINGE', tier: 3, name: 'Elaras Klinge', nameKey: 'quest.reward.ELARAS_KLINGE', iconKey: 'itSword', elaraGift: true, signatur: { crit: 0.15 } }] },
      rewardTier: 'story',
      prerequisites: ['elara_ritual'],
      requiredAct: 3,
      // v6.1: Elara ist keine Schmiedin. Das Zeichen der drei Ketten im Stahl
      // findet, wer die Klinge im Inventar genauer ansieht (inventory.js,
      // ITEM_INSCHRIFTEN, Flag zeichen_bemerkt = "Zeichen entdeckt").
      dialogueOffer: 'Nimm das. Ich habe sie für Dich schmieden lassen. Für den Fall, dass...\n\nNimmst Du Elaras Klinge an?',
      dialogueProgress: 'Die Klinge wartet auf Dich.',
      dialogueComplete: 'Möge sie Dich beschützen. Egal was kommt.'
    },

    // =======================================================
    // === Act 6: Rebellion ===
    // =======================================================
    mara_assault: {
      id: 'mara_assault',
      title: 'Die letzte Wache',
      description: 'Dring bis Welle 30 vor. Dort unten führt Mara Dich zu Aldric.',
      npcId: 'mara',
      type: 'wave',
      chain: 3,
      // v6.1: Aldrics Ende. Erst die Tiefe, dann die Begegnung mit ihm
      // (roomManager, _aldricBegegnung: observe 'aldric_gefunden'). Dort faellt
      // die Wahl, ob Du ihm sagst, wer er war (aldric_erzaehlt /
      // aldric_verschwiegen, fuer den Epilog). Altstaende mit laufendem
      // Auftrag bekommen das zweite Ziel beim Laden angehaengt (_zieleNachziehen).
      objectives: [
        { type: 'wave', target: 'reach_wave', current: 0, required: 30 },
        { type: 'observe', target: 'aldric_gefunden', current: 0, required: 1 }
      ],
      rewards: { xp: 300, items: [{ tier: 2 }] },
      rewardTier: 'boss',
      prerequisites: ['schattenrat_finale'],
      requiredAct: 4,
      dialogueOffer: 'Aldric ist nach dem Bruch der Esse in die Tiefe geflohen, mit dem Rest seiner Kettenwache. Oben steht sein Name schon auf jedem Blatt. Unten weiss er vielleicht nicht einmal mehr, dass es seiner ist.\n\nDring bis Welle 30 vor. Ich finde ihn, und dann bringe ich Dich zu ihm. Bist Du dabei?',
      dialogueProgress: 'Die Kettenwache hält sich noch in der Tiefe. Dring weiter vor, bis Welle 30. Dort warte ich auf Dich.',
      dialogueProgressNext: 'Ich habe ihn gefunden, ganz unten. Steig noch einmal hinab, ich führe Dich hin.',
      dialogueComplete: 'Er ist leer. Der Mann, der andere hat leeren lassen. (Mara sieht lange in die Flamme ihrer Lampe.) Ich dachte, ich würde mich freuen.\n\nDie Kettenwache ist zerschlagen. Die Gänge unter der Stadt gehören wieder niemandem. Das ist mehr, als diese Stadt lange hatte.'
    },
    // v6.1 Stufe 2: Der Nachhall auf Tiefe 25 (js/nachhall.js). Maras
    // verhaftete Leute wurden geleert, ihre Erinnerungen stecken in ihm.
    // Zwischen dem Maulwurf und der Quelle. Der Boss erscheint nur, solange
    // dieser Auftrag laeuft (Nachhall.wartet); sonst bleibt Tiefe 25 ein
    // gewoehnlicher Lauf mit Mini-Boss.
    was_der_rauch_behaelt: {
      id: 'was_der_rauch_behaelt',
      title: 'Was der Rauch behält',
      description: 'Steig auf Tiefe 25 hinab und stell Dich dem Nachhall, dem Echo aus tausend Stimmen. Bring Maras Leute nach Hause.',
      npcId: 'mara',
      type: 'boss',
      // Vor der Quelle (chain 2) einsortiert, in Journal und Uebersicht.
      chain: 1,
      minDepth: 25,
      objectives: [
        { type: 'boss_kill', target: 'nachhall', current: 0, required: 1 }
      ],
      rewards: { xp: 220 },
      rewardTier: 'boss',
      prerequisites: ['espionage_informant'],
      requiredAct: 4,
      dialogueOffer: 'Die Leute, die sie mir genommen haben, sind nicht tot. Nicht ganz. Wer tief genug hinabsteigt, hört sie, auf Tiefe 25, alle durcheinander. Die Späher nennen es den Nachhall. Er steht zwischen Dir und der Esse. Geh hin, hör nicht zu lange zu und bring sie nach Hause.',
      dialogueProgress: 'Der Nachhall wartet auf Tiefe 25. Wenn er flüstert, hör nicht hin. Schlag zu.',
      dialogueComplete: 'Du hast sie gehen lassen. (Sie schweigt lange.) Hast Du einen Namen gehört, den Du kennst? (Eine der Stimmen war Deine eigene. Du sagst es ihr nicht.) Gib Thom die Namen, die Du lesen konntest. Dann geh. Die Esse wartet, und Elara mit ihr.'
    },
    // Feature 062: umbenannt von 'harren_rescue'. Akt 4, die Quelle selbst.
    schattenrat_finale: {
      id: 'schattenrat_finale',
      title: 'Die Esse',
      description: 'Steig auf Tiefe 30 hinab, zur Esse unter der Stadt. Elara ist schon dort. Danach wartet Thom an der Presse.',
      // v6.1: Branka gibt den Auftrag (Harren steigt selbst hinab und stirbt
      // im Finale), abgegeben wird er bei Thom (turnInNpcId). Unten an der
      // Esse spielt js/finale.js; der Sieg erfuellt das Ziel, der Abschluss
      // folgt oben an der Presse.
      npcId: 'branka',
      turnInNpcId: 'thom',
      type: 'boss',
      chain: 2,
      objectives: [
        { type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }
      ],
      rewards: { xp: 250, items: [{ tier: 2 }] },
      rewardTier: 'finale',
      // v6.1 Stufe 2: "Was der Rauch behaelt" (Mara, Nachhall auf Tiefe 25)
      // liegt zwischen dem Maulwurf und diesem Auftrag. Alte Staende, in
      // denen die Quelle schon laeuft oder abgeschlossen ist, sperrt das
      // nicht: Vorbedingungen gelten nur fuer noch nicht angenommene Auftraege.
      prerequisites: ['espionage_informant', 'was_der_rauch_behaelt'],
      requiredAct: 4,
      // #157: Nicht mehr der Schattenrat — Elara ist zur Quelle hinabgestiegen.
      dialogueOffer: 'Elara ist hinabgestiegen, zur Esse, auf Tiefe 30. Sie trägt ein echtes Amulett des Rats. Du hast nur Deine Hände. (Sie sieht auf Deinen Hammer.) Der reicht, und Deine Hände auch. Du bist der Einzige, der eine solche Bindung lösen kann.\n\nUnd noch etwas. Harren hat gefragt, wohin Du gehst. Ich habe es ihm nicht gesagt. Er wird es trotzdem herausfinden.',
      dialogueProgress: 'Die Esse liegt auf Tiefe 30. Je tiefer Du gehst, desto mehr will der Nebel von Dir. Halt fest, was Du bist.',
      dialogueComplete: '(Thom wischt sich die Hände am Kittel ab, als Du hereinkommst. Er fragt nicht, wie es unten war. Er sieht es Dir an.)\n\nDie Esse ist zerbrochen. Draussen bleiben die Leute auf der Strasse stehen und sagen Namen, die sie seit Jahren nicht mehr gesagt haben. (Er klopft auf die Presse.) Jetzt glauben sie, was sie lesen, weil sie es selbst wieder wissen. Die Platten liegen bereit.'
    },

    // =======================================================
    // === Feature 062 — neue v4-Quests ===
    // =======================================================
    faction_campaign: {
      id: 'faction_campaign',
      title: 'Das Edikt der Woche',
      description: 'Die Stadt stimmt ab: drei Edikte, eines gewinnt. Lass sie bei Thom drucken und häng sie an die Anschlagtafeln vor dem Rathaus.',
      npcId: 'aldric',
      // #160 (#150, Vorschlag 5): Die demokratische Fassade sichtbar machen.
      // Drucken (Druckerei), aushaengen (Anschlagtafel, dort faellt die Wahl,
      // welches oben haengt). Das Ergebnis verkuendet der Rat in der
      // oeffentlichen Sitzung (#159, council_collusion_reveal); in der geheimen
      // hoert man, dass es vorher feststand.
      type: 'observe',
      chain: 3,
      objectives: [
        { type: 'observe', target: 'edikte_gedruckt', current: 0, required: 1 },
        { type: 'observe', target: 'edikte_plakatiert', current: 0, required: 1 }
      ],
      rewards: { xp: 60 },
      rewardTier: 'story',
      prerequisites: ['harren_daughter_investigation'],
      requiredAct: 1,
      dialogueOffer: 'Diese Woche stimmt die Stadt ab. Drei Edikte, Magistrat, Klerus, Garde, und die Bürger wählen eines. Lass sie bei Thom drucken und häng sie an die Tafeln vor dem Rathaus. So sieht Ordnung aus, die gewählt ist.',
      dialogueProgress: 'Erst drucken, dann aushängen. Die Druckerei ist gleich über dem Platz.',
      dialogueComplete: 'Gut. Die Stimmen werden gezählt, und das Ergebnis verkündet der Rat öffentlich, im Ratssaal. So gehört sich das.'
    },
    // #68: Die Anschlagtafel am Rathaus. Kopfgelder statt Kulisse — sie
    // fuellen die Laeufe zwischen den Story-Beats und kippen mit der Hub-Phase:
    // im Rats-Hub haengt der Rat aus, nach dem Bruch die Druckerei. Im Epilog
    // haengt nur noch die gedruckte Wahrheit (kein Auftrag mehr).
    //
    // Wiederholbar (repeatable) und rotierend: welcher der beiden Rats-Aushaenge
    // haengt, entscheidet die erreichte Tiefe, also wechselt er mit jedem Lauf.
    // #68: Drei weitere Rats-Aushaenge und ein zweiter Aufruf. Sie nutzen
    // nur Ziele, die im Spiel WIRKLICH gemeldet werden (explore:room,
    // dungeon_run:dungeon_complete, wave:reach_wave, kill:elite_enemy) —
    // ein Aushang, der nie fertig wird, waere schlimmer als keiner.
    brett_kammern: {
      id: 'brett_kammern',
      title: 'Aushang: Die leeren Kammern',
      description: 'Ein Rats-Aushang: räume 6 Kammern ab Tiefe 4.',
      npcId: 'anschlagtafel',
      type: 'explore',
      chain: 1,
      minDepth: 4,
      repeatable: true,
      objectives: [
        { type: 'explore', target: 'room', current: 0, required: 6 }
      ],
      rewards: { xp: 70, gold: 140 },
      rewardTier: 'neben',
      prerequisites: [],
      requiredAct: 0,
      gate: function () { return window.Anschlagtafel && window.Anschlagtafel.haengt('brett_kammern'); },
      dialogueOffer: 'MAGISTRAT: Sechs Kammern ab Tiefe 4, geräumt und gemeldet. Das Archiv führt Buch über leere Räume.\n\n(Warum, steht nicht dabei.)',
      dialogueProgress: 'Sechs Kammern ab Tiefe 4. Das Archiv wartet auf die Meldung.',
      dialogueComplete: 'Ein Schreiber streicht sechs Zeilen an. Er sieht Dich dabei nicht an. Der Lohn liegt im Kasten.'
    },
    brett_laeufe: {
      id: 'brett_laeufe',
      title: 'Aushang: Zweimal hinab',
      description: 'Ein Rats-Aushang: schliesse 2 Läufe ab Tiefe 18 ab.',
      npcId: 'anschlagtafel',
      type: 'dungeon_run',
      chain: 2,
      minDepth: 18,
      angebotAb: 18,
      repeatable: true,
      objectives: [
        { type: 'dungeon_run', target: 'dungeon_complete', current: 0, required: 2 }
      ],
      rewards: { xp: 110, gold: 220 },
      rewardTier: 'neben',
      prerequisites: [],
      requiredAct: 0,
      gate: function () { return window.Anschlagtafel && window.Anschlagtafel.haengt('brett_laeufe'); },
      dialogueOffer: 'GARDE: Zwei vollständige Gänge ab Tiefe 18. Nicht die Hälfte, nicht fast — ganz durch, beide Male.\n\n(Darunter jemand mit Kohle: "Sie zahlen für den Weg, nicht für das, was man sieht.")',
      dialogueProgress: 'Zwei ganze Gänge ab Tiefe 18. Halbe zählen nicht.',
      dialogueComplete: 'Die Garde zahlt ohne Nachfragen. Was Du unten gesehen hast, will niemand wissen.'
    },
    brett_welle: {
      id: 'brett_welle',
      title: 'Aushang: Standhalten',
      description: 'Ein Rats-Aushang: räume 6 Räume auf Tiefe 14 oder tiefer in einem Lauf, ohne zu sterben.',
      npcId: 'anschlagtafel',
      type: 'explore',
      chain: 3,
      minDepth: 14,
      angebotAb: 14,
      repeatable: true,
      // Ausdauer statt Welle: die Welle ist nur die Lauftiefe, "Welle 14 auf
      // Tiefe 14" war ein einziger Raum. 'room_lauf' zaehlt geraeumte Raeume
      // (ab minDepth) und faellt auf 0, sobald ein Lauf endet, ohne dass das
      // Ziel voll ist — durch Tod, Portal oder einen zu kurzen Lauf
      // (onLaufEnde). Alte Staende mit dem Wellenziel stellt
      // _standhaltenUmstellen beim Laden um.
      objectives: [
        { type: 'explore', target: 'room_lauf', current: 0, required: 6 }
      ],
      rewards: { xp: 100, gold: 180 },
      rewardTier: 'neben',
      prerequisites: [],
      requiredAct: 0,
      gate: function () { return window.Anschlagtafel && window.Anschlagtafel.haengt('brett_welle'); },
      dialogueOffer: 'KLERUS: Sechs Kammern in einem Gang, ab Tiefe 14, und kein Sturz. Wer fällt oder umkehrt, beginnt von vorn. Standhaftigkeit ist eine Tugend, und der Rat belohnt Tugend.\n\n(Das Siegel darunter ist frisch. Die Tinte noch feucht.)',
      dialogueProgress: 'Sechs Räume in einem Lauf, ab Tiefe 14. Wer stirbt oder umkehrt, beginnt von vorn.',
      dialogueComplete: 'Sechs Kammern, kein Sturz. Der Priester am Kasten segnet Dich, während er abzählt. Beides dauert gleich lang.'
    },
    brett_zeugen: {
      id: 'brett_zeugen',
      title: 'Aufruf: Nehmt ihnen die Anführer',
      description: 'Ein Aufruf des Widerstands: besiege 4 Elite-Gegner ab Tiefe 22.',
      npcId: 'anschlagtafel',
      type: 'kill',
      chain: 4,
      minDepth: 22,
      angebotAb: 22,
      repeatable: true,
      objectives: [
        { type: 'kill', target: 'elite_enemy', current: 0, required: 4 }
      ],
      rewards: { xp: 130, gold: 160 },
      rewardTier: 'neben',
      prerequisites: [],
      requiredAct: 0,
      gate: function () { return window.Anschlagtafel && window.Anschlagtafel.haengt('brett_zeugen'); },
      dialogueOffer: 'Aus Thoms Presse, quer über ein zerfetztes Rats-Plakat geklebt:\n\n"Vier von denen, die unten befehlen. Ab Tiefe 22. Wer befiehlt, hat einen Namen — und wir drucken Namen."',
      dialogueProgress: 'Vier Anführer ab Tiefe 22. Die Presse wartet auf die Namen.',
      dialogueComplete: 'Am nächsten Morgen stehen vier Namen im Blatt. Zwei davon kennt die Stadt.'
    },
    brett_stoerer: {
      id: 'brett_stoerer',
      title: 'Aushang: Ruhe in den Kellern',
      description: 'Ein Rats-Aushang: besiege 12 Gegner ab Tiefe 3.',
      npcId: 'anschlagtafel',
      type: 'kill',
      chain: 1,
      minDepth: 3,
      repeatable: true,
      objectives: [
        { type: 'kill', target: 'enemy', current: 0, required: 12 }
      ],
      rewards: { xp: 60, gold: 120 },
      rewardTier: 'neben',
      prerequisites: [],
      requiredAct: 0,
      gate: function () { return window.Anschlagtafel && window.Anschlagtafel.haengt('brett_stoerer'); },
      dialogueOffer: 'MAGISTRAT: Für Ruhe in den unteren Gängen zahlt der Rat. Zwölf Störer ab Tiefe 3, abzugeben hier am Brett.\n\n(Darunter, kleiner: "Eine Liste der Namen führt das Archiv.")',
      dialogueProgress: 'Der Aushang hängt noch. Zwölf Störer ab Tiefe 3.',
      dialogueComplete: 'Du ritzt einen Strich unter den Aushang. Der Lohn liegt im Kasten darunter, abgezählt, ohne ein Wort.'
    },
    brett_anfuehrer: {
      id: 'brett_anfuehrer',
      title: 'Aushang: Die Anführer',
      description: 'Ein Rats-Aushang: besiege 3 Elite-Gegner ab Tiefe 10.',
      npcId: 'anschlagtafel',
      type: 'kill',
      chain: 2,
      minDepth: 10,
      angebotAb: 10,
      repeatable: true,
      objectives: [
        { type: 'kill', target: 'elite_enemy', current: 0, required: 3 }
      ],
      rewards: { xp: 90, gold: 200 },
      rewardTier: 'neben',
      prerequisites: [],
      requiredAct: 0,
      gate: function () { return window.Anschlagtafel && window.Anschlagtafel.haengt('brett_anfuehrer'); },
      dialogueOffer: 'GARDE: Drei Anführer, ab Tiefe 10. Wer zahlt, fragt nicht, wer sie waren.\n\n(Der Aushang ist frisch. Der darunter, halb verdeckt, sucht eine vermisste Näherin.)',
      dialogueProgress: 'Drei Anführer, ab Tiefe 10. Der Aushang wartet.',
      dialogueComplete: 'Die Garde zahlt bar und sofort. Den Aushang nimmt niemand ab; er hängt am nächsten Morgen wieder da.'
    },
    brett_aufruf: {
      id: 'brett_aufruf',
      title: 'Aufruf der Druckerei',
      description: 'Ein Aufruf des Widerstands: räume 5 Kammern ab Tiefe 16.',
      npcId: 'anschlagtafel',
      type: 'explore',
      chain: 3,
      minDepth: 16,
      angebotAb: 16,
      repeatable: true,
      objectives: [
        { type: 'explore', target: 'room', current: 0, required: 5 }
      ],
      rewards: { xp: 120, gold: 150, druckblaetter: 4 },
      rewardTier: 'neben',
      prerequisites: [],
      requiredAct: 0,
      gate: function () { return window.Anschlagtafel && window.Anschlagtafel.haengt('brett_aufruf'); },
      dialogueOffer: 'Über den zerfetzten Rats-Plakaten klebt ein frisch gedrucktes Blatt:\n\n"Wer unten aufräumt, macht Platz für die Wahrheit. Fünf Kammern, ab Tiefe 16. Papier gibt es bei Thom."',
      dialogueProgress: 'Fünf Kammern ab Tiefe 16. Das Blatt hängt noch, jemand hat es festgenagelt.',
      dialogueComplete: 'Am Rand des Blattes steht jetzt ein Strich mehr. Thom legt Papier und Münzen unter den Stein daneben.'
    },
    // #148 / Story-Bibel §14: zwei rein menschliche Nebenquests ohne Bezug zur
    // These. Sie liegen genau in den Strecken, in denen die Hauptgeschichte
    // sonst stillstand (#72): Tiefe 14-19 und 25-29.
    buerger_hund: {
      id: 'buerger_hund',
      title: 'Ein Hund namens Bruno',
      description: 'Finde Brunos Halsband in den Kanälen unter der Stadt (ab Tiefe 15).',
      npcId: 'buerger',
      type: 'fetch',
      chain: 1,
      minDepth: 15,
      objectives: [
        { type: 'fetch', target: 'hundehalsband', current: 0, required: 1 }
      ],
      rewards: { xp: 80, gold: 40 },
      rewardTier: 'neben',
      prerequisites: [],
      requiredAct: 3,
      dialogueOffer: 'Du gehst doch da runter. Mein Hund, Bruno, ist mir vor einer Woche in die Kanäle gelaufen. Er jagt Ratten, er kann nicht anders. Wenn Du tief unten, ab Tiefe 15, ein Halsband mit einer Messingmarke findest, dann bring es mir. Dann weiss ich wenigstens Bescheid.',
      dialogueProgress: 'Ein braunes Halsband, Messingmarke, "Bruno" eingeritzt. Tief unten, ab Tiefe 15.',
      dialogueComplete: 'Das ist seins. (Er dreht die Marke in der Hand.) Und weisst Du was? Bruno kam gestern Nacht allein nach Hause, dreckig bis zu den Ohren und sehr zufrieden. Ohne Halsband. Er hat es sich abgestreift, um durch ein Gitter zu passen. (Er lacht, zum ersten Mal, seit Du ihn kennst.)'
    },
    branka_eichgewicht: {
      id: 'branka_eichgewicht',
      title: 'Das Eichgewicht',
      description: 'Bring Branka das alte Eichgewicht der Zunft aus der Tiefe (ab Tiefe 26).',
      npcId: 'branka',
      type: 'fetch',
      chain: 5,
      minDepth: 26,
      objectives: [
        { type: 'fetch', target: 'eichgewicht', current: 0, required: 1 }
      ],
      rewards: { xp: 150, materials: { MAT: 15 } },
      rewardTier: 'neben',
      prerequisites: [],
      requiredAct: 4,
      dialogueOffer: 'Die zwei Händler vor meiner Werkstatt streiten seit Tagen, wessen Waage lügt. Jeden Morgen, laut, vor meiner Tür. Das alte Eichgewicht der Zunft liegt irgendwo unten, ab Tiefe 26, seit die Zunft sich aufgelöst hat. Bring es mir, und ich mache dem ein Ende. Bitte.',
      dialogueProgress: 'Ein Messingzylinder mit dem Zunftstempel. Ab Tiefe 26. Und beeil Dich, sie haben heute schon zweimal angefangen.',
      dialogueComplete: 'Das ist es. (Sie legt es auf beide Waagen.) Beide falsch. Um genau dasselbe. (Sie seufzt.) Jetzt streiten sie darüber, wer es zuerst gesagt hat. Aber leiser. Danke.'
    },
    klerus_district_purge: {
      id: 'klerus_district_purge',
      title: 'Reinigung eines Bezirks',
      description: 'Reinige einen "befallenen" Bezirk — besiege 8 Gegner ab Tiefe 7 und bring die Namen.',
      npcId: 'klerus_priester',
      type: 'kill',
      chain: 3,
      minDepth: 7,
      angebotAb: 7,
      objectives: [
        { type: 'kill', target: 'enemy', current: 0, required: 8 }
      ],
      rewards: { xp: 70 },
      rewardTier: 'neben',
      prerequisites: [],
      requiredAct: 2,
      dialogueOffer: 'Ein Bezirk ist befallen. Reinige ihn. Wer das Licht scheut, hat etwas zu verbergen. Bring mir die Namen der Befallenen.',
      dialogueProgress: 'Noch nicht gereinigt. Die Befallenen zeigen sich in der Tiefe, ab Tiefe 7.',
      // v6.1: zwei Abschluesse. Die Wahl folgt auf diesen Text
      // (storyDialog.byQuest.klerus_district_purge): die Leute warnen
      // (namen_gewarnt) oder die Liste abliefern (namen_abgeliefert). Sie
      // entscheidet, wie viele Verschwundene im Epilog zurueckkehren.
      dialogueComplete: 'Du bringst die Namen? (Der Priester streckt die Hand nach der Liste aus.)\n\n(Die Befallenen hatten Gesichter. Keins davon kanntest Du, und doch kam Dir jedes bekannt vor. Mara hat Dir eine Abschrift abgenommen, bevor Du hergekommen bist. Noch hast Du die Liste in der Hand.)'
    },
    garde_night_escort: {
      id: 'garde_night_escort',
      title: 'Nachteskorte',
      description: 'Begleite verkleidet einen Transport des Rats durch die Umschlagstelle, von der Verladung bis zum Schacht (ab Tiefe 16).',
      npcId: 'stadtwache',
      type: 'observe',
      chain: 3,
      // #72: gestaffelt.
      minDepth: 16,
      // Die drei Stationen der Umschlagstelle (js/nachteskorte.js): die Zone
      // einer Station oeffnet sich, wenn der Karren dort haelt.
      objectives: [
        { type: 'observe', target: 'eskorte_verladung', current: 0, required: 1 },
        { type: 'observe', target: 'eskorte_waage', current: 0, required: 1 },
        { type: 'observe', target: 'eskorte_schacht', current: 0, required: 1 }
      ],
      rewards: { xp: 90 },
      rewardTier: 'neben',
      // Die Geleerten am Schacht: im Epilog kehren sie zurueck (questFinale).
      // Die Wahl an der Waage setzt eskorte_seite_gemerkt / _gerissen.
      completionFlags: ['geleerte_gesehen'],
      prerequisites: [],
      requiredAct: 3,
      dialogueOffer: 'Heute Nacht geht ein Transport hinab, ab Tiefe 16. Du gehst in Ratsuniform mit, von der Verladung bis zum Schacht, und bleibst neben dem Karren. Frag nicht, was drin ist. Frag nicht, wer trägt. (Er klopft auf seine Börse.) Loyalität zahlt sich aus. Meistens.',
      dialogueProgress: 'Ab Tiefe 16, in der Umschlagstelle. Bleib beim Karren, von der Verladung bis zum Schacht. Wer zurückbleibt, fällt auf.',
      dialogueComplete: 'Verzeichnet und abgeliefert? Gut. (Er zählt Dir die Münzen hin.) Siehst Du, Loyalität zahlt sich aus.\n\n(Was Du ihm nicht sagst: Jede Phiole trug einen Namen, und an der Waage liest ein Schreiber sie ab wie Ware. Einen davon kanntest Du. Die Träger am Schacht waren Geleerte, und keiner von ihnen kam wieder herauf. Das alles trägst Du zu Mara.)'
    },
    who_you_were: {
      id: 'who_you_were',
      title: 'Wer du warst',
      description: 'Bring Branka drei Splitter Deiner Phiole aus der Tiefe (ab Tiefe 17).',
      npcId: 'branka',
      type: 'fetch',
      chain: 4,
      // #72: von 5 auf 17 — Akt 3 beginnt ohnehin erst auf Tiefe 10.
      minDepth: 17,
      // 'memory_shard' als Quest-Item-Drop von WP05 (loot.js) verdrahtet.
      objectives: [
        { type: 'fetch', target: 'memory_shard', current: 0, required: 3 }
      ],
      rewards: { xp: 150, fragments: 1 },
      rewardTier: 'story',
      // Regler 4 im Finale (self_remembered).
      // v6.1: Branka sagt Dir, dass das Zeichen der drei Ketten von Dir ist
      // (schmiedemarke_erkannt, liest der Epilog).
      completionFlags: ['self_remembered', 'schmiedemarke_erkannt'],
      prerequisites: ['branka_doubt'],
      requiredAct: 3,
      // v6.1: Splitter Deiner Phiole, nicht einer Akte. Was Branka daraus
      // bindet, kann der Nebel nicht mehr nehmen, auch Elara im Finale nicht.
      dialogueOffer: 'Unten haben Leute Scherben gefunden. Dickes Glas, und in jede ist ein Zeichen geritzt. Deins. (Sie sieht Dich lange an.) Das war eine Phiole, Archivschmied. Was in ihr war, warst Du.\n\nBring mir drei Splitter aus der Tiefe. Was noch an ihnen haftet, binden wir hier an Metall. Dann kann der Nebel es Dir nicht wieder nehmen.',
      dialogueProgress: 'Die Splitter liegen tief, ab Tiefe 17. Such weiter.',
      dialogueComplete: 'Da bist Du. (Die Splitter liegen auf dem Amboss, und mit jedem Schlag kommt etwas zurück: eine Werkstatt, Siegel, Druckplatten für den Rat. Und ein Nein.)\n\nDu hast für sie geschmiedet. Das Zeichen der drei Ketten ist von Dir. Ich habe Dich daran arbeiten sehen. Dann hast Du verstanden, wofür, und Dich geweigert. Es war kein Unfall. Sie haben Dich geleert, weil sie Dich brauchten, nicht weil Du ihnen gefährlich warst.\n\n(Sie legt den Hammer weg.) Hör mir zu. Was wir hier gebunden haben, bleibt Dir. Aber Du bist nicht mehr leer, und der Nebel dort unten merkt das. Je mehr Du weisst, wer Du bist, desto mehr hat er Dir zu nehmen.'
    },
    elara_second_truth: {
      id: 'elara_second_truth',
      title: 'Elaras zweite Wahrheit',
      description: 'Elara zeigt dir, für wen du das Letzte tust.',
      abgabeHinweis: 'Elara wartet im Keller auf Dich.',
      npcId: 'elara',
      type: 'dialogue',
      chain: 4,
      // Angebot erst ab Tiefe 20. Kein minDepth: ihr Ziel feuert die Riss-
      // Szene im Hub, nicht ein Kellerlauf.
      angebotAb: 20,
      // Teil-Reveal, KEIN advanceAct (der Bruch triggert den Aktwechsel). Objective
      // 'dialogue' (Auto-Complete): die inszenierte Szene folgt später.
      objectives: [
        { type: 'observe', target: 'erster_riss_gesehen', current: 0, required: 1 }
      ],
      rewards: { xp: 200, fragments: 2 },
      rewardTier: 'story',
      // #156: Frueher "three_hands_seen" — die Blaetter-Enthuellung aus v4
      // ("drei Blaetter, eine Hand"). Die gibt es nicht mehr: Elaras Verrat
      // zeigt sich am Zeichen (Maulwurf, zeichen_bemerkt). Dieser Auftrag ist
      // jetzt ihr erster Riss, ein Vorzeichen ohne eigenen Finale-Schalter.
      prerequisites: ['thom_truth', 'elara_ritual'],
      requiredAct: 3,
      dialogueOffer: 'Bevor du das Letzte tust, sollst du wissen, für wen. Komm, nur wir zwei.',
      dialogueProgress: 'Elara wartet auf dich. Nur ihr zwei.',
      dialogueComplete: 'Sie hat die Meldung weggesteckt. Eine wahre Meldung, und niemand wird sie je lesen. "Nicht alles hilft", hat sie gesagt. Du schiebst den Gedanken beiseite. Noch.'
    },

    // Feature 062: 'final_truth' entfernt (ging ins Finale auf). the_reckoning
    // schaltet story_ending frei und macht damit das Story-Ende erreichbar (#44).
    // Objective 'dialogue' (Auto-Complete bei Annahme): die Vier-Regler-
    // Auswertung + Vatermord-Inszenierung kommen mit dem Finale-Folge-Feature.
    the_reckoning: {
      id: 'the_reckoning',
      title: 'Die Abrechnung',
      description: 'Die Esse ist zerbrochen. Thom wartet an der Presse. Die Stadt soll alles erfahren.',
      npcId: 'thom',
      type: 'dialogue',
      chain: 6,
      objectives: [
        { type: 'dialogue', target: 'press_decision', current: 0, required: 1 }
      ],
      rewards: { xp: 500, unlocks: ['story_ending'] },
      rewardTier: 'finale',
      // `unlocks` landet in window._questUnlocks, die Hub-Phase liest aber die
      // Flags (hubPhase.js -> getFlags()). Ohne diesen Zwilling bleibt der Hub
      // nach dem Story-Ende dauerhaft in Phase 'broken' und der gesamte
      // Epilog-Zustand aus Feature 064 ist unerreichbar (#100). Gleiches
      // Doppel-Muster wie bei elara_meeting (elara_trust).
      completionFlags: ['story_ending'],
      prerequisites: ['schattenrat_finale'],
      requiredAct: 4,
      // v6.1: Die Presse druckt alles. Glaubwuerdig ohne Siegel, weil die
      // Leute sich mit dem Bruch der Esse wieder erinnern.
      dialogueOffer: 'Die Platten liegen. Alles kommt drauf, zuoberst Aldrics Name. Dann der Rat, der Widerstand, sie. Und die Namen der Verschwundenen. Kein Siegel steht darunter, und die Stadt wird es trotzdem glauben, weil sie sich gerade selbst wieder erinnert.',
      dialogueProgress: 'Die Presse wartet.',
      dialogueComplete: 'Der Nebel dünnt aus. Nicht weil jemand ihn vertreibt, sondern weil zu viele Menschen sich zu vieles gleichzeitig merken. Was an tausend Orten steht, kann niemand mehr verbrennen.'
    }
  };

  // Lohnzeilen (Angebot, Abgabe, Toast, Journal), deutsch. Eine eigene
  // Tabelle, weil sie auch ohne i18n (Tests) die Rueckfallfassung liefert.
  var LOHN_DE = {
    'quest.lohn.xp': '+{n} XP',
    'quest.lohn.gold': '+{n} Gold',
    'quest.lohn.mat': '+{n} Eisenbrocken',
    'quest.lohn.druckblaetter': '+{n} Druckblätter',
    'quest.lohn.fragment': '+1 Fragment',
    'quest.lohn.fragmente': '+{n} Fragmente',
    'quest.lohn.trank': '+1 Heiltrank',
    'quest.lohn.traenke': '+{n} Heiltränke',
    'quest.lohn.stueck': '{name} ({seltenheit})',
    'quest.lohn.zufall': 'Ausrüstungsstück',
    'quest.lohn.tier.0': 'Gewöhnlich',
    'quest.lohn.tier.1': 'Magisch',
    'quest.lohn.tier.2': 'Selten',
    'quest.lohn.tier.3': 'Legendär',
    'quest.lohn.toast': 'Auftrag abgeschlossen: {title}',
    'quest.lohn.stufe': 'Stufe {level} erreicht — Talente unter [T]',
    'quest.lohn.truhe': '{name} liegt in Deiner Truhe — das Inventar war voll',
    'quest.lohn.ausstehend': '{name} wartet — Inventar und Truhe sind voll',
    'quest.lohn.nachgereicht': 'Nachgereicht: {name}'
  };

  // ---- i18n bootstrap ----
  // Auto-register German strings from QUEST_DEFINITIONS so consumers can use
  // i18n.t('quest.<id>.<field>'). German is source-of-truth — fallback for any
  // EN translation that is missing returns the German value via the i18n
  // lookup cascade (active → de → [MISSING:key]).
  if (window.i18n) {
    var QUEST_FIELDS = ['title', 'description', 'dialogueOffer', 'dialogueProgress', 'dialogueProgressNext', 'dialogueComplete', 'abgabeHinweis'];
    var _autoDe = {};
    Object.keys(QUEST_DEFINITIONS).forEach(function (id) {
      var q = QUEST_DEFINITIONS[id];
      QUEST_FIELDS.forEach(function (field) {
        if (typeof q[field] === 'string') {
          _autoDe['quest.' + id + '.' + field] = q[field];
        }
      });
    });
    // Generic tracker strings
    _autoDe['quest.tracker.progress'] = '{title}: {cur}/{required}';
    _autoDe['quest.tracker.short_suffix'] = '..';
    // #53: Quest-Abschluss-Toast (DE ist Quelle).
    _autoDe['quest.toast.completed'] = 'Quest-Ziel erfüllt: {title}';
    window.i18n.register('de', _autoDe);

    // English overrides — partial; missing keys gracefully fall back to DE.
    // Translations will expand iteratively. Quest titles + tracker translated
    // up front; dialogues to follow.
    window.i18n.register('en', {
      'quest.tracker.progress': '{title}: {cur}/{required}',
      // #143: Die sechs Einfuehrungsquests.
      'quest.einfuehrung_wissen.title': 'What the Walls Know',
      'quest.einfuehrung_wissen.description': 'Bind a memory fragment in metal with Branka at the Archive Forge (knowledge tree).',
      'quest.einfuehrung_wissen.dialogueOffer': "Steel alone does not cut through the council's lies. I say that to everyone, and everyone nods and does not understand it.\n\nYou are carrying a fragment. A piece of something somebody wrote down and the council burned. The Archivesmiths used to bind such things in metal here, so the city would never lose them. Bind it in metal, then the fog cannot take it. I will show you how.",
      'quest.einfuehrung_wissen.dialogueProgress': 'The fragment is still lying around on you. Come to the anvil and bind it in metal. It will not be worth more if you wait.',
      'quest.einfuehrung_wissen.dialogueComplete': "(She looks at you a moment too long.) And? Nothing flashes, nothing chimes. That is what knowledge is like when it holds.\n\nEvery fragment you find down there, you bind here. The council collects them too, it just burns them.",

      'quest.einfuehrung_amulett.title': 'The Old Man with the Cart',

      // #68: die vier zusaetzlichen Aushaenge.
      'quest.brett_kammern.title': 'Notice: The Empty Chambers',
      'quest.brett_kammern.description': 'A council notice: clear 6 chambers from depth 4.',
      'quest.brett_kammern.dialogueOffer': "MAGISTRATE: Six chambers from depth 4, cleared and reported. The archive keeps a record of empty rooms.\n\n(It does not say why.)",
      'quest.brett_kammern.dialogueProgress': 'Six chambers from depth 4. The archive is waiting for the report.',
      'quest.brett_kammern.dialogueComplete': 'A scribe strikes through six lines. He does not look at you while he does it. The pay is in the box.',

      'quest.brett_laeufe.title': 'Notice: Twice Below',
      'quest.brett_laeufe.description': 'A council notice: complete 2 runs from depth 18.',
      'quest.brett_laeufe.dialogueOffer': "GUARD: Two complete descents from depth 18. Not half, not nearly - all the way through, both times.\n\n(Below it, in charcoal: 'They pay for the walking, not for what you see.')",
      'quest.brett_laeufe.dialogueProgress': 'Two whole descents from depth 18. Half ones do not count.',
      'quest.brett_laeufe.dialogueComplete': 'The Guard pays without questions. Nobody wants to hear what you saw down there.',

      'quest.brett_welle.title': 'Notice: Hold the Line',
      'quest.brett_welle.description': 'A council notice: clear 6 rooms at depth 14 or deeper in a single run without dying.',
      'quest.brett_welle.dialogueOffer': "CLERGY: Six chambers in one descent, from depth 14, and no fall. Whoever falls or turns back starts over. Steadfastness is a virtue, and the council rewards virtue.\n\n(The seal below it is fresh. The ink still wet.)",
      'quest.brett_welle.dialogueProgress': 'Six rooms in a single run, from depth 14. Whoever dies or turns back starts over.',
      'quest.brett_welle.dialogueComplete': 'Six chambers, no fall. The priest at the box blesses you while he counts it out. Both take the same amount of time.',

      'quest.brett_zeugen.title': 'Call: Take Their Leaders',
      'quest.brett_zeugen.description': 'A resistance call: defeat 4 elite enemies from depth 22.',
      'quest.brett_zeugen.dialogueOffer': "From Thom's press, pasted across a shredded council poster:\n\n'Four of those who give the orders down there. From depth 22. Whoever gives orders has a name - and we print names.'",
      'quest.brett_zeugen.dialogueProgress': 'Four leaders from depth 22. The press is waiting for the names.',
      'quest.brett_zeugen.dialogueComplete': 'The next morning four names are in the paper. Two of them the city knows.',
      'quest.einfuehrung_amulett.description': 'Buy something from the wandering merchant in the depths.',
      'quest.einfuehrung_amulett.dialogueOffer': "There is an old man wandering about down there with a cart. Do not ask me how he gets in - I do not know, and I do not want to know.\n\nBuy something off him. Anything. He carries stock that would never cross my table, and deeper down there are amulets hanging from that cart. I just want you to have stood in front of him once.",
      'quest.einfuehrung_amulett.dialogueProgress': 'The old man turns up when he feels like it. Keep going deeper and you will meet him. And bring gold - he is not cheap.',
      'quest.einfuehrung_amulett.dialogueComplete': "(She studies it from a safe distance.) So you bought from him after all.\n\nGo back when you get deeper. What he carries down there changes a whole run - and what it takes from you, you usually notice later.",

      'quest.einfuehrung_schmiede.title': 'The First Edge',
      'quest.einfuehrung_schmiede.description': 'Go into the Forge and upgrade a piece of equipment at the workbench.',
      'quest.einfuehrung_schmiede.dialogueOffer': "You wear what you found down there, and you wear it the way you carry a tool that is strange to you.\n\nCome with me into the Forge, the door right next to me. Put one of your pieces on the workbench and press \"Upgrade\" - then it becomes yours. This one is on me; after that it costs gold and Iron Chunks, and you do it alone.",
      'quest.einfuehrung_schmiede.dialogueProgress': 'You have not done it yet. Go into the Forge, put a piece on the workbench and press "Upgrade". This time I pay.',
      'quest.einfuehrung_schmiede.dialogueComplete': "(She turns it once into the light.) You see. The same piece, only no longer the same.\n\nEvery time you come back up, you stop by here. Not because I say so, but because otherwise you go back down with what was good enough last week.",

      'quest.einfuehrung_presse.title': 'A Line That Stays',
      'quest.einfuehrung_presse.description': 'Go into the Printing House and have Thom the Typesetter print an edict there.',
      'quest.einfuehrung_presse.dialogueOffer': "The council prescribes every week what this city is to think. We can do the same - smaller, but we can do it.\n\nYou have Print Sheets on you, I can see them. Come into the Printing House, right next to me, and pick an edict - I will set it. It works as long as it hangs, and it costs you the council's attention. You should have felt both once, before it matters.",
      'quest.einfuehrung_presse.dialogueProgress': 'Nothing is hanging yet. Go into the Printing House, pick an edict, I will set it.',
      'quest.einfuehrung_presse.dialogueComplete': "(He wipes his fingers on his smock.) Now it is on every corner, and somebody is reading it out loud.\n\nJust remember one thing: every line we print, the council puts on its scales. Do not print more than you can make good again down below.",

      'quest.einfuehrung_markt.title': 'What Lies Under the Table',
      'quest.einfuehrung_markt.description': 'Buy something from Mara at the black market.',
      'quest.einfuehrung_markt.dialogueOffer': "You lug gold around as if you did not know what for. I do.\n\nI keep a stall - right here, under the table. Do not ask where the goods come from. Take anything, the cheapest will do. After that you know it exists, and that is the whole point.",
      'quest.einfuehrung_markt.dialogueProgress': 'Take anything. I do not write down what.',
      'quest.einfuehrung_markt.dialogueComplete': "(She does not count the gold.) Good. You still put it on the table first and only ask afterwards. (She stops short, as if she had already said too much.) And now forget that I showed you.\n\nWhat I do not have, the old man with the cart down there might. Anyone who comes back up with full pockets and takes them down again has missed something.",

      'quest.einfuehrung_talente.title': 'What You Are Good For',
      'quest.einfuehrung_talente.description': 'Spend a point in the talent tree (T) and put the new ability on a key in the loadout (K).',
      'quest.einfuehrung_talente.dialogueOffer': "The council keeps a file on every citizen, and in yours there is a word that bothers me: undetermined.\n\nThat can be changed. You gather experience down there, and experience becomes points. Spend one. Fury, Chains or Shadow - take your pick. The council values people who commit.\n\nAnd then: a tool you do not keep at hand is no tool. Put it on a key.",
      'quest.einfuehrung_talente.dialogueProgress': 'Still undetermined. Open the tree and spend a point. Which one is your business.',
      'quest.einfuehrung_talente.dialogueProgressNext': 'Committed, good. But a tool you do not keep at hand is no tool. Put it on a key - in the loadout, K or through the menu.',
      'quest.einfuehrung_talente.dialogueComplete': "(He notes something without looking up.) Committed. Good.\n\nThe file will outlive you, Archivesmith. That is not a threat, that is administration.",

      'quest.einfuehrung_akte.title': 'Your File',
      'quest.einfuehrung_akte.description': 'Look at your character stats (C or your portrait at the top left).',
      'quest.einfuehrung_akte.dialogueOffer': "The council keeps a file on you. Go and see what it says.\n\nStrength, dexterity, vitality - that is on record now. Whoever knows what is written about him can act on it. The others are acted upon.",
      'quest.einfuehrung_akte.dialogueProgress': 'You have not looked yet. The file is open - C, or your portrait at the top left.',
      'quest.einfuehrung_akte.dialogueComplete': "(He closes the file.) Now you know what the council knows. No more.\n\nLook again whenever you wear something new. The file does not lie - it leaves that to others.",

      'quest.einfuehrung_truhe.title': 'What Is Worth Keeping',
      'quest.einfuehrung_truhe.description': 'Put an item into the stash below the Forge.',
      'quest.einfuehrung_truhe.dialogueOffer': "You come up with full pockets and throw half of it away down there because there is no room left. That is not weighing things up, that is waste.\n\nThe stash below the Forge is yours. Whatever you will only need three runs from now belongs in it - it stays, even if you stay down there. Put one piece in, then you know how it works.",
      'quest.einfuehrung_truhe.dialogueProgress': 'The stash is still empty. Go to it, below the Forge, open it and drag a piece across.',
      'quest.einfuehrung_truhe.dialogueComplete': "(She nods towards the stash.) There. Now you have a place where nothing gets lost.\n\nBut mind this: a stash full of things you never touch again is just a heap. Put in what you will need - not what you cannot bring yourself to throw away.",

      'quest.tracker.short_suffix': '..',
      'quest.toast.completed': 'Objective complete: {title}',
      // Akt 0 — Aldric warmup (tutorial extension)
      'quest.aldric_cleanup.title': 'Cellar Cleanup',
      'quest.aldric_cleanup.dialogueIntro.0': 'The Archivesmith. I was told you were back on your feet.\n\nDo you remember me? … No. Of course not.',
      'quest.aldric_cleanup.dialogueIntro.1': 'We knew each other, you and I. You sealed files no one was ever supposed to touch again: orderly, reliable work.\n\nI would like a little of that reliability again.',
      'quest.aldric_cleanup.description': 'Defeat 10 enemies in the cellars beneath the Archive Forge.',
      'quest.aldric_patrol.title': 'Cellar Patrol',
      'quest.aldric_patrol.description': 'Clear 3 rooms in the cellars to secure all corridors.',
      // Akt 1 — Vertical Slice chain (feature 050)
      'quest.harren_daughter_investigation.title': 'The Vanished Daughter',
      'quest.harren_daughter_investigation.description': 'Find the mayor\'s daughter\'s journal fragment in the Town Hall Cellar.',
      'quest.magistrat_verification.title': 'Magistrate Verification',
      'quest.magistrat_verification.description': 'Obtain the council-sealed verification document for the Magistrate.',
      'quest.klerus_purification.title': 'Purification of the Lower Chambers',
      'quest.klerus_purification.description': 'Cleanse the lower chambers of the Town Hall Cellar — defeat 3 elite enemies. The heretic leaders only lurk from depth 3.',
      'quest.garde_patrol_expansion.title': 'Patrol Expansion',
      'quest.garde_patrol_expansion.description': 'Demonstrate force for the new patrols — defeat 10 trespassers.',
      'quest.widerstand_proof.title': "The Council Document",
      'quest.widerstand_proof.description': "Find a hidden council document in the Town Hall Cellar, a few rooms deeper.",
      'quest.widerstand_proof.abgabeHinweis': 'Take the council document to Elara. She will find you in the cellar.',
      'quest.council_collusion_reveal.title': 'The Secret Meeting',
      'quest.council_collusion_reveal.description': 'Watch the public council session. Then eavesdrop on the secret session in the council chamber beneath the town hall.',
      'quest.mara_contact.title': 'The Scout',
      'quest.mara_contact.description': 'Scout three Council cellar rooms for Mara.',
      'quest.elara_meeting.title': "Elara's Secret",
      'quest.elara_meeting.description': 'Find 2 secret documents Elara has hidden.',
      'quest.elara_meeting.abgabeHinweis': 'Take both documents to Elara. She will find you in the cellar.',
      'quest.branka_doubt.title': "The Smith's Doubt",
      'quest.branka_doubt.description': "Defeat 5 elite enemies to find evidence for Branka's suspicions.",
      'quest.elara_ritual.title': 'The Ritual Chamber',
      'quest.elara_ritual.description': "Descend to depth 20 and defeat the Master of Ceremonies who holds the council's ritual chamber.",
      'quest.elara_ritual.abgabeHinweis': 'Elara is waiting for you in the cellar.',
      'quest.thom_truth.title': 'Forbidden Truths',
      'quest.thom_truth.description': "Find 5 print plates with the forbidden truths about the council (from depth 14).",
      'quest.mara_warning.title': "The Chainmaster",
      'quest.mara_warning.description': 'Defeat the Chainmaster at depth 10, who guards the way to the council\'s seal chambers.',
      'quest.thom_pamphlets.title': 'The Pamphlets',
      'quest.thom_pamphlets.description': 'Complete 3 deep runs into the cellars (from depth 27) to spread the leaflets into the lowest passages.',
      'quest.elara_blade.title': "Elara's Gift",
      'quest.elara_blade.description': "Elara has had a special blade forged for you.",
      'quest.elara_blade.abgabeHinweis': 'Elara is waiting for you in the cellar.',
      'quest.mara_assault.title': "The Last Watch",
      'quest.mara_assault.description': "Reach wave 30. Down there Mara leads you to Aldric.",
      // Feature 062: umbenannt harren_rescue -> schattenrat_finale; final_truth
      // entfernt (-> the_reckoning). Neue/umbenannte Quests ohne EN fallen über
      // die i18n-Kaskade auf Deutsch zurück (Deutsch = Source-of-Truth).
      'quest.was_der_rauch_behaelt.title': 'What the Smoke Keeps',
      'quest.was_der_rauch_behaelt.description': "Descend to depth 25 and face the Echo, the echo of a thousand voices. Bring Mara's people home.",
      'quest.was_der_rauch_behaelt.dialogueOffer': "The people they took from me are not dead. Not quite. Whoever goes down deep enough hears them, at depth 25, all at once. The scouts call it the Echo. It stands between you and the Furnace. Go there, don't listen too long, and bring them home.",
      'quest.was_der_rauch_behaelt.dialogueProgress': "The Echo waits at depth 25. When it whispers, don't listen. Strike.",
      'quest.was_der_rauch_behaelt.dialogueComplete': "You let them go. (She is silent for a long time.) Did you hear a name you know? (One of the voices was your own. You don't tell her.) Give Thom the names you could read. Then go. The Furnace is waiting, and Elara with it.",
      'quest.schattenrat_finale.title': 'The Furnace',
      'quest.schattenrat_finale.description': "Descend to depth 30, to the Furnace beneath the city. Elara is already there. Afterwards Thom waits at the press.",

      // === Quest dialogues — English ===
      'quest.aldric_cleanup.dialogueOffer': "Vermin has settled in the cellars down below. Wild beasts, the guards say. Clear them out — ten of them, then we talk again.\n\nWill you take this task?",
      'quest.aldric_cleanup.dialogueProgress': 'The cellars are not safe yet. Keep fighting.',
      'quest.aldric_cleanup.dialogueComplete': 'Good. The cellars are cleared. Here is your reward.\n\n(Whatever is still open is in your journal - key J or the journal icon at the top right.)',

      'quest.aldric_patrol.dialogueOffer': 'Make sure all corridors are secure. Patrol three rooms.\n\nReady?',
      'quest.aldric_patrol.dialogueProgress': 'Not all corridors are secure yet. Keep patrolling.',
      'quest.aldric_patrol.dialogueComplete': 'All corridors are safe. Good work, Archivesmith.',

      // === Akt 1 Vertical Slice (feature 050) — quest dialogues ===
      'quest.harren_daughter_investigation.dialogueOffer': "My daughter has vanished. Aldric says she fled. The Clergy speaks of possession. The Guard talks of dereliction of duty.\n\nI trust none of the three until I have read her own words. Bring me the journal fragment she left behind. You will find it in the Town Hall Cellar — somewhere the council did not look.\n\nTrust no one until you have seen it yourself.",
      'quest.harren_daughter_investigation.dialogueProgress': 'Keep searching — the fragment is down there. Aldric, the Clergy and the Guard quarrel upstairs because each wants its own version. You will find the real one.',
      'quest.harren_daughter_investigation.dialogueComplete': "You have it. All three council factions are in it, by name. Lene did not simply flee, Archivesmith. Someone made her disappear.\n\nYou will get work from every side now. Take it. Listen to everything. Then come back to me.",

      'quest.magistrat_verification.dialogueOffer': 'You have seen the fragment. Good. Then you also know that the daughter must be reclassified — from "fled" to "missing person of interest". A pure administrative matter, you understand. Records must be kept properly.\n\nThe council-sealed verification document lies in the sunken registry — down there, where the fog swallowed the old records. Descend, recover the Council Seal, and bring it to me. Whatever you meet down there is not my department. The Magistrate carries the responsibility, not the citizen.\n\nDo you accept?',
      'quest.magistrat_verification.dialogueProgress': 'The Council Seal is still down there in the sunken registry. Descend further and recover it. Without the document the reclassification is not legally binding.',
      'quest.magistrat_verification.dialogueComplete': "(Aldric holds out his hand without looking up from his files.) The seal, Archivesmith. The reclassification is waiting.\n\n(The wax in your hand is still soft. One press of the thumb and it will no longer hold. Nobody would notice, except someone who makes seals.)",

      'quest.klerus_purification.dialogueOffer': "You have seen the fragment, Archivesmith. Then you know the daughter did not flee of her own will. She was led by a dark hand — the lower chambers teem with such shadows.\n\nPurify them. Three leaders of this heretical presence still lurk down there, deeper than the first passages — descend to depth 3. Strike them down in the name of Order. The daughter's soul will thank you — if the Light finds her again.\n\nPurification is a sacred duty. Accept it.",
      'quest.klerus_purification.dialogueProgress': 'The leaders lurk deep — only from depth 3. Descend, find them, strike them down. Every heresy you end opens another path to purity.',
      'quest.klerus_purification.dialogueComplete': 'You have broken the heresy. The lower chambers breathe again. Order endures — through you. The Clergy blesses your hand. Bring it onward where the Light demands.',

      'quest.garde_patrol_expansion.dialogueOffer': 'If a daughter can vanish from the Town Hall itself, that is a failure of the Guard — and it will change. I need a patrol expansion. Today. Go into the lower chambers and demonstrate force — ten troublemakers fall, and the edict carries itself through the streets.\n\nDo not ask whether the patrols favor a comfortable way of life. Do not ask who decides where they run. Loyalty is the only coin that counts. The edict is the coin you place in my hand.\n\nDo you accept, Archivesmith?',
      'quest.garde_patrol_expansion.dialogueProgress': 'Ten troublemakers remain. Each fallen body is one more line in the report. The Guard waits on the outcome.',
      'quest.garde_patrol_expansion.dialogueComplete': "The report is written. Ten troublemakers fewer, and the Guard can propose more patrols to the council. No one else will vanish — or at least no one who matters. The Guard remembers who answers quickly.",

      'quest.widerstand_proof.dialogueOffer': "You brought me the bundle and did not open it. Good. Then I can show you what I have seen, before you go on running their errands.\n\nI want YOU to see what I have seen. Down in the Town Hall Cellar lies a document the three council factions should never have signed together - and yet their seal is on it. All three.\n\nBring it to me. Then we talk.",
      'quest.widerstand_proof.dialogueProgress': "The document lies a few rooms deeper. It is small, but the seal upon it will take your breath away.",
      'quest.widerstand_proof.dialogueComplete': 'Three seals. One signature. Magistrate, Clergy, Guard — in public they pretend to be rivals. Behind closed doors they agree. Go to Harren. He has been waiting for the moment you would understand.',

      'quest.council_collusion_reveal.dialogueOffer': 'Today the council announces the result of the vote, in public, in the council hall. Magistrate, Clergy, Guard, before all the citizens. Go and listen. And then follow them in the night, when they think nobody is watching.',
      'quest.council_collusion_reveal.dialogueProgress': 'The council chamber lies down in the cellar. Put on the guard uniform, stay in the shadows and listen to what they say when nobody is watching.',
      'quest.council_collusion_reveal.dialogueComplete': "Now you have seen it. One face, three masks. You worked for each of them. You could flee, but a craftsman who keeps walking in and out of the town hall sees things a fugitive never sees. Stay where you are. Keep cleaning for them, and secretly for me. It is more dangerous. It is also the only thing that helps.",
      // === Feature 050 side-dialogue keys (consumed by WP03) ===
      'sidedialog.branka.q2_eyebrow': 'Branka raises an eyebrow when she sees the Magistrate\'s seal. "Another verification seal. Do you actually know what ends up written on these documents?"',
      'sidedialog.thom.q4_eyebrow': "Thom glances up, then back at the press. \"Patrol expansion. The edict sounds reasonable. Go ask someone at the pavilion what 'reasonable' has meant this month.\"",

      'quest.mara_contact.dialogueOffer': "You bought at my table and never asked how I know the way you pay. (She pushes the wares aside.) I know you from before, Archivesmith. From before you lost your memory. Back then you asked questions the council wanted buried.\n\nBefore I open my network to you, I want to see whether you can still see. Go down and scout three cellar rooms. Mark what the council hides there.",
      'quest.mara_contact.dialogueProgress': 'Not enough seen yet. Three rooms — and burn each one into your memory.',
      'quest.mara_contact.dialogueComplete': "Three rooms, the same in each: empty cells, fresh chains, lists of names. The missing don't vanish by chance — the Council makes them vanish, and every faction covers for the others.\n\nNow I know you're still the one you were. My network is open to you — there's work only someone no one remembers can do. Like you.",

      'quest.elara_meeting.dialogueOffer': "You want to know what we do this for? Here — read this.\n\nFind two documents I hid in the cellar.",
      'quest.elara_meeting.dialogueProgress': 'The documents are well hidden. Keep searching.',
      'quest.elara_meeting.dialogueComplete': 'Now you see it. This is what the council does with the ones who disappear: it needs them for its rituals. Names nobody says any more, because nobody remembers them.',

      'quest.branka_doubt.dialogueOffer': 'This armor is for prisoners, not soldiers. Help me find proof.\n\nDefeat five elite guards and bring me their orders.',
      'quest.branka_doubt.dialogueProgress': 'The elite guards carry the proof on them. Keep fighting.',
      'quest.branka_doubt.dialogueComplete': 'I was right. The council is building prisons, not barracks. We must act.',

      // Feature 055 — Akt 2 (Obedience vs. Memory)
      'quest.council_seizure.title': 'Confiscation',
      'quest.council_seizure.description': 'Confiscate the "subversive writings" — collect 3 bundles from the cellars.',
      'quest.council_seizure.dialogueOffer': 'Rabble in the cellars is hoarding subversive writings against the council. Confiscate them — three bundles. Do not read them. Bring them.\n\nWill you take the task?',
      'quest.council_seizure.dialogueProgress': 'Not all writings secured yet. Keep looking.',
      'quest.council_seizure.dialogueComplete': "Hand them over.\n\n(Before you turn them in, your eye catches a line. These are not pamphlets. They are petitions — citizens asking after vanished kin.)",

      'quest.council_surveillance.title': 'Surveillance',
      'quest.council_surveillance.description': 'Watch the cellar passages beneath the town hall for the council — search 3 chambers.',
      'quest.council_surveillance.dialogueOffer': 'Down in the old passages, they say, rabble is gathering. Sweep three chambers and report who assembles there.\n\nReady?',
      'quest.council_surveillance.dialogueProgress': 'Not all chambers searched yet. Keep looking.',
      'quest.council_surveillance.dialogueComplete': 'Report accepted.\n\n(No conspirators. Only people hiding in the dark — from the council, not against it.)',

      'quest.branka_transcripts.title': 'Forbidden Transcripts',
      'quest.branka_transcripts.description': 'Bring Branka 2 interrogation records from the cellars.',
      'quest.branka_transcripts.dialogueOffer': 'The cellars hold records from interrogations. Not of demons — of people. Bring me two transcripts. Carefully.',
      'quest.branka_transcripts.dialogueProgress': 'The records are deep in the cellar. Keep searching.',
      'quest.branka_transcripts.dialogueComplete': 'Read this. "Questioned until confession." The council interrogates citizens like the summoned. That is not protection — it is a hunt.',

      // Feature 062: umbenannt ritual_chamber -> verseuchte_kammer.
      'quest.verseuchte_kammer.title': 'The Tainted Chamber',
      'quest.verseuchte_kammer.description': 'Aldric sends you to cleanse a "tainted" chamber. Press through to it, it lies from depth 15.',
      'quest.verseuchte_kammer.dialogueOffer': 'A lower chamber is tainted — heresy, from depth 15. Cleanse it. Do not ask what you find.\n\nGo.',
      'quest.verseuchte_kammer.dialogueProgress': 'The chamber lies deeper, from depth 15. Press on.',
      'quest.verseuchte_kammer.dialogueComplete': "You stand in the chamber. No heretic in sight. On the floor a chalk circle, chains at its edge, hammered into the stone. Beside it crates full of empty vials, neatly lined up, each with a label that bears no name yet.\n\n(This is where people are drawn off into vials. Aldric sent you to wipe away the traces. You commit it all to memory. Mara should know, and Aldric should believe you only cleaned.)",

      'quest.bruch_confrontation.title': 'The Break',
      'quest.bruch_confrontation.description': "Aldric set guards on you. Cut your way through, defeat 3 elite guards. They only confront you in the depths (from depth 20). Branka knows a hiding place.",
      'quest.bruch_confrontation.dialogueOffer': "Aldric knows. Your double game is exposed, his elite guards are sealing off the deep passages, from depth 20 you will face them. Cut your way through and come to me. I know a place where nobody will look for you.",
      'quest.bruch_confrontation.dialogueProgress': "Aldric's elite guards hold the depths. From depth 20 you will face them.",
      'quest.bruch_confrontation.dialogueComplete': "You ask too many questions, he said. Now you no longer ask, you know. Your cover is burned, there is no place left for you up here.\n\n(Branka pulls a hood over your head and leads you through the canals, to a crack in the cellar wall.) Elara is waiting down there. With her nobody will find you. Go. I will keep the forge open.",
      'quest.espionage_convoy.title': 'The Convoy',
      'quest.espionage_convoy.description': 'Shadow a council convoy in the warehouse in disguise and eavesdrop on it.',
      'quest.espionage_convoy.dialogueOffer': 'Tonight they unload a council convoy at the old warehouse. Put on the guard uniform, stay in the shadows and listen — but draw no blade, or the disguise falls.\n\nWill you take this on?',
      'quest.espionage_convoy.dialogueProgress': "You're not close enough yet. Blend in with the guards at the convoy and eavesdrop on what's being unloaded — undetected.",
      'quest.espionage_convoy.dialogueComplete': "You heard it. No supplies, no weapons. Crates full of vials, each sealed with the council's wax. What is inside, nobody says, not even among themselves. Only where they go: down, with the next transport.",

      'quest.espionage_archive.title': 'The Sealed Archive',
      'quest.espionage_archive.description': "Infiltrate the council archive in disguise (from depth 12), eavesdrop on the scribes and recover the sealed file.",
      'quest.espionage_archive.dialogueOffer': "She was here. Lene. She says she fled, of her own will, and that she cannot stay. (He turns the ring of office on his finger.) I want to believe her, Archivesmith. But I want to read it.\n\nIn the council's archive lies her file, sealed, deep beneath the town hall, from depth 12. Go in disguised as a scribe, listen to what the others whisper, and bring me the file. Do not be seen.\n\nWill you do this for me?",
      'quest.espionage_archive.dialogueProgress': "The archive lies from depth 12. The scribes have said nothing useful yet. Stay in the archive, inconspicuous, and keep eavesdropping until you reach the sealed file.",
      'quest.espionage_archive.dialogueComplete': "You have the file. \"Missing, case closed\" — his daughter's disappearance, neatly filed, date, seal, signature. And the date falls before the day she vanished.\n\n(Harren reads it twice.) They planned it. Someone in the council filed Lene's disappearance before it happened.",

      'quest.espionage_informant.title': 'The Mole',
      'quest.espionage_informant.description': "Unmask a council mole within the resistance's ranks, in disguise (from depth 23).",
      'quest.espionage_informant.dialogueOffer': 'Someone is betraying us. Whatever we decide behind closed doors, the council knows it by next morning. Blend in disguised among our own people at the meeting point, deep down, from depth 23, and find out who the mole is. Move quietly — they do not know your face in this getup.\n\nWill you find the traitor?',
      'quest.espionage_informant.dialogueProgress': "You don't have the mole yet. Stay inconspicuous at the meeting point (from depth 23) and listen for who smuggles messages outside.",
      'quest.espionage_informant.dialogueComplete': 'You followed the note all the way into the council chamber. Elara, beside Aldric. On her ring the sign of the three chains. She led us all — straight into his hands.',

      'quest.elara_ritual.dialogueOffer': "Beneath the council's ritual chamber lies a shaft. It leads down to whatever makes the fog. The Master of Ceremonies holds the chamber in front of it. Descend to depth 20 and strike him down. Then I will show you where the shaft leads.\n\nAre you ready for the truth?",
      'quest.elara_ritual.dialogueProgress': "The Master of Ceremonies still holds the chamber. You will find him at depth 20. As long as he lives, you cannot reach the shaft.",
      'quest.elara_ritual.dialogueComplete': "The Master of Ceremonies has fallen. (Behind him the shaft. Far below a glow, red as a furnace, and from it the smoke rises, grey and thick.)\n\nThat is it. The Furnace. It burns what is in the vials: memories. Its smoke is the fog.\n\nYou cannot smash it. You have to loosen its binding, the way you loosen a seal. One strike in the right place, in the right direction. Your hands know how. I will show you the spot when the time comes.\n\nTake this amulet. It shields you from the fog when you go deeper.",
      'quest.thom_truth.dialogueOffer': "I've printed enough of what the council wants. Time for the truth.\n\nFind five print plates, deep in the cellar, from depth 14 — they hold the real history.",
      'quest.thom_truth.dialogueProgress': "The print plates lie deep in the Town Hall Cellar, from depth 14. Keep searching.",
      'quest.thom_truth.dialogueComplete': 'Fantastic! These plates contain proof the council wanted to destroy. The truth goes to print.',

      'quest.mara_warning.dialogueOffer': "At depth 10 the Chainmaster holds the way. He used to be a captain of the guard; now only his order is left. He binds whoever he wants to catch. Bring him down, and we will see what he guards.",
      'quest.mara_warning.dialogueProgress': "The Chainmaster still lives, at depth 10. If he chains you, strike the chain, or he holds you fast.",
      'quest.mara_warning.dialogueComplete': "The Chainmaster has fallen. Behind him lay chambers full of seals. The council seals more than files down there, and now we have the first proof of it.",

      'quest.thom_pamphlets.dialogueOffer': "The upper passages already read our truth. Now we need the depths, where the council keeps its secrets.\n\nComplete three runs from depth 27 and take the sheets down with you. Whoever reads down there reads where the council does not expect it.",
      'quest.thom_pamphlets.dialogueProgress': "Only deep runs count, from depth 27. Complete three of them. Each one carries our sheets further down.",
      'quest.thom_pamphlets.dialogueComplete': "The lower passages are reading along. The sheets travel from hand to hand, all the way down to the council's chambers. And the council notices: yesterday the guard questioned two printers who never worked for me. (He grins crookedly.)\n\nYour experience now grows faster. (+10% XP)",

      'quest.elara_blade.dialogueOffer': "Take this. I had it forged for you. In case...\n\nWill you accept Elara's Blade?",
      'quest.elara_blade.dialogueProgress': "The blade waits for you.",
      'quest.elara_blade.dialogueComplete': "May it protect you. No matter what comes.",

      'quest.mara_assault.dialogueOffer': "Aldric fled into the depths after the Furnace broke, with what is left of his Chain Guard. Up here his name is already on every sheet. Down there he may not even know any more that it is his.\n\nReach wave 30. I will find him, and then I will take you to him. Are you in?",
      'quest.mara_assault.dialogueProgress': "The Chain Guard still holds out in the depths. Press on, to wave 30. I will wait for you there.",

      'quest.mara_assault.dialogueProgressNext': "I found him, all the way down. Go down once more, I will lead you to him.",
      'quest.mara_assault.dialogueComplete': "He is empty. The man who had others emptied. (Mara stares into the flame of her lamp for a long time.) I thought I would be glad.\n\nThe Chain Guard is broken. The tunnels beneath the city belong to no one again. That is more than this city has had in a long time.",

      'quest.schattenrat_finale.dialogueOffer': "Elara has gone down, to the Furnace, at depth 30. She wears a true amulet of the council. You only have your hands. (She looks at your hammer.) That will do, and so will your hands. You are the only one who can loosen such a binding.\n\nAnd one more thing. Harren asked where you are going. I did not tell him. He will find out anyway.",
      'quest.schattenrat_finale.dialogueProgress': "The Furnace lies at depth 30. The deeper you go, the more the fog wants from you. Hold on to what you are.",
      'quest.schattenrat_finale.dialogueComplete': "(Thom wipes his hands on his smock as you come in. He does not ask what it was like down there. He can see it on you.)\n\nThe Furnace is broken. Outside, people stop in the street and say names they have not said in years. (He taps the press.) Now they believe what they read, because they know it again themselves. The plates are ready.",

      // #68: die Aushaenge am Brett
      'quest.brett_stoerer.title': 'Notice: Quiet in the Cellars',
      'quest.brett_stoerer.description': 'A council notice: defeat 12 enemies from depth 3.',
      'quest.brett_stoerer.dialogueOffer': 'MAGISTRATE: The council pays for quiet in the lower passages. Twelve troublemakers from depth 3, handed in here at the board.\n\n(Below, in smaller letters: "A list of the names is kept by the archive.")',
      'quest.brett_stoerer.dialogueProgress': 'The notice is still up. Twelve troublemakers from depth 3.',
      'quest.brett_stoerer.dialogueComplete': 'You scratch a mark under the notice. The pay lies in the box beneath it, counted out, without a word.',
      'quest.brett_anfuehrer.title': 'Notice: The Leaders',
      'quest.brett_anfuehrer.description': 'A council notice: defeat 3 elite enemies from depth 10.',
      'quest.brett_anfuehrer.dialogueOffer': 'GUARD: Three leaders, from depth 10. Whoever pays does not ask who they were.\n\n(The notice is fresh. The one beneath it, half covered, is looking for a missing seamstress.)',
      'quest.brett_anfuehrer.dialogueProgress': 'Three leaders, from depth 10. The notice is waiting.',
      'quest.brett_anfuehrer.dialogueComplete': 'The Guard pays in cash, at once. Nobody takes the notice down; it hangs there again the next morning.',
      'quest.brett_aufruf.title': 'Call of the Printing House',
      'quest.brett_aufruf.description': 'A call from the resistance: clear 5 chambers from depth 16.',
      'quest.brett_aufruf.dialogueOffer': 'Over the torn council posters someone has pasted a freshly printed sheet:\n\n"Whoever clears up down there makes room for the truth. Five chambers, from depth 16. Paper is at Thom\'s."',
      'quest.brett_aufruf.dialogueProgress': 'Five chambers from depth 16. The sheet is still up; someone nailed it down.',
      'quest.brett_aufruf.dialogueComplete': 'There is one more mark along the edge of the sheet now. Thom leaves paper and coins under the stone beside it.',

      // #148: die beiden menschlichen Nebenquests
      'quest.buerger_hund.title': 'A Dog Named Bruno',
      'quest.buerger_hund.description': "Find Bruno's collar in the canals beneath the city (from depth 15).",
      'quest.buerger_hund.dialogueOffer': "You go down there, don't you. My dog, Bruno, ran off into the canals a week ago. He hunts rats, he can't help it. If you find a collar with a brass tag deep down, from depth 15, bring it to me. Then at least I'll know.",
      'quest.buerger_hund.dialogueProgress': 'A brown collar, brass tag, "Bruno" scratched into it. Deep down, from depth 15.',
      'quest.buerger_hund.dialogueComplete': "That's his. (He turns the tag in his hand.) And you know what? Bruno came home on his own last night, filthy up to the ears and very pleased with himself. Without the collar. He slipped out of it to fit through a grate. (He laughs, for the first time since you've known him.)",
      'quest.branka_eichgewicht.title': 'The Standard Weight',
      'quest.branka_eichgewicht.description': "Bring Branka the guild's old standard weight from the depths (from depth 26).",
      'quest.branka_eichgewicht.dialogueOffer': "The two traders outside my workshop have been arguing for days about whose scales lie. Every morning, loudly, at my door. The guild's old standard weight lies somewhere down there, from depth 26, ever since the guild broke up. Bring it to me and I'll put an end to it. Please.",
      'quest.branka_eichgewicht.dialogueProgress': 'A brass cylinder with the guild stamp. From depth 26. And hurry, they have already started twice today.',
      'quest.branka_eichgewicht.dialogueComplete': "That's it. (She sets it on both scales.) Both wrong. By exactly the same amount. (She sighs.) Now they're arguing about who said it first. But more quietly. Thank you.",

      // #87: bisher ohne englische Fassung
      'quest.resistance_fetch_01.title': "The Sealed Bundle",
      'quest.resistance_fetch_01.description': "Fetch the sealed bundle from the cellar. No one may see it, and do not open it.",
      'quest.resistance_fetch_01.dialogueOffer': "You are still standing. Good. Then you can do me a favor right away.\n\nSomewhere down here lies a bundle, sealed. Bring it to me without anyone seeing it. And do not open it. After that we talk about the council.",
      'quest.resistance_fetch_01.abgabeHinweis': 'Take the bundle to Elara. She will find you in the cellar.',
      'quest.resistance_fetch_01.dialogueProgress': "The bundle lies somewhere down there. Look around, and leave it closed.",
      'quest.resistance_fetch_01.dialogueComplete': "You have it. And you did not open it. Good. Now I know I can trust you.\n\n(On the wax of the seal: three chains, intertwined. You have never seen this sign before.)",

      'quest.faction_campaign.title': "Edict of the Week",
      'quest.faction_campaign.description': "The city votes: three edicts, one wins. Have them printed at Thom's and post them on the notice boards in front of the town hall.",
      'quest.faction_campaign.dialogueOffer': "This week the city votes. Three edicts, Magistrate, Clergy, Guard, and the citizens choose one. Have them printed at Thom's and post them on the boards in front of the town hall. That is what order looks like when it is chosen.",
      'quest.faction_campaign.dialogueProgress': "First print, then post. The Printing House is just across the square.",
      'quest.faction_campaign.dialogueComplete': "Good. The votes are being counted, and the council announces the result in public, in the council hall. As it should be.",

      'quest.klerus_district_purge.title': "Purging a District",
      'quest.klerus_district_purge.description': "Purge an \"infested\" district — defeat 8 enemies from depth 7 and bring back the names.",
      'quest.klerus_district_purge.dialogueOffer': "A district is infested. Purge it. Whoever shuns the Light has something to hide. Bring me the names of the infested.",
      'quest.klerus_district_purge.dialogueProgress': "Not purged yet. The infested show themselves in the depths, from depth 7.",
      'quest.klerus_district_purge.dialogueComplete': "You bring the names? (The priest holds out his hand for the list.)\n\n(The infested had faces. You knew none of them, and yet every one seemed familiar. Mara took a copy from you before you came here. The list is still in your hand.)",

      'quest.garde_night_escort.title': "Night Escort",
      'quest.garde_night_escort.description': "Escort a council transport in disguise through the transfer point, from the loading bay to the shaft (from depth 16).",
      'quest.garde_night_escort.dialogueOffer': "A transport goes down tonight, from depth 16. You go along in council uniform, from the loading bay to the shaft, and you stay next to the cart. Do not ask what is inside. Do not ask who carries it. (He pats his purse.) Loyalty pays. Mostly.",
      'quest.garde_night_escort.dialogueProgress': "From depth 16, at the transfer point. Stay with the cart, from the loading bay to the shaft. Whoever falls behind gets noticed.",
      'quest.garde_night_escort.dialogueComplete': "Recorded and delivered? Good. (He counts the coins out for you.) You see, loyalty pays.\n\n(What you do not tell him: every vial bore a name, and at the scale a scribe reads them off like goods. You knew one of them. The porters at the shaft were emptied people, and none of them came back up. You carry all of it to Mara.)",

      'quest.who_you_were.title': "Who You Were",
      'quest.who_you_were.description': "Bring Branka three shards of your vial from the depths (from depth 17).",
      'quest.who_you_were.dialogueOffer': "People found shards down there. Thick glass, and a sign is scratched into every one. Yours. (She looks at you for a long time.) That was a vial, Archivesmith. What was inside it was you.\n\nBring me three shards from the depths. Whatever still clings to them, we bind to metal here. Then the fog cannot take it from you again.",
      'quest.who_you_were.dialogueProgress': "The shards lie deep, from depth 17. Keep searching.",
      'quest.who_you_were.dialogueComplete': "There you are. (The shards lie on the anvil, and with every strike something comes back: a workshop, seals, printing plates for the council. And a no.)\n\nYou forged for them. The sign of the three chains is yours. I watched you work on it. Then you understood what for, and you refused. It was no accident. They emptied you because they needed you, not because you were dangerous to them.\n\n(She puts the hammer down.) Listen to me. What we bound here stays yours. But you are not empty any more, and the fog down there notices. The more you know who you are, the more it has to take from you.",

      'quest.elara_second_truth.title': "Elara's Second Truth",
      'quest.elara_second_truth.description': "Elara shows you who you are doing the last thing for.",
      'quest.elara_second_truth.abgabeHinweis': 'Elara is waiting for you in the cellar.',
      'quest.elara_second_truth.dialogueOffer': "Before you do the last thing, you should know for whom. Come, just the two of us.",
      'quest.elara_second_truth.dialogueProgress': "Elara is waiting for you. Just the two of you.",
      'quest.elara_second_truth.dialogueComplete': "She tucked the report away. A true report, and no one will ever read it. \"Not everything helps,\" she said. You push the thought aside. For now.",

      'quest.the_reckoning.title': "The Reckoning",
      'quest.the_reckoning.description': "The Furnace is broken. Thom waits at the press. The city shall learn everything.",
      'quest.the_reckoning.dialogueOffer': "The plates are set. Everything goes on them, Aldric's name at the top. Then the council, the resistance, her. And the names of the disappeared. There is no seal beneath it, and the city will believe it anyway, because it is starting to remember on its own.",
      'quest.the_reckoning.dialogueProgress': "The press is waiting.",
      'quest.the_reckoning.dialogueComplete': "The fog thins. Not because someone drives it away, but because too many people remember too much at once. What stands in a thousand places, nobody can burn any more.",

      // === Quest reward strings ===
      'quest.reward.info.mara_contact': "Mara's network revealed",
      'quest.reward.ALDRIC_SCHWERT': 'Council Sword',
      'quest.reward.RITUAL_AMULETT': 'Council Fog Amulet',
      'quest.reward.ELARAS_KLINGE': "Elara's Blade",
      'quest.rarity.common': 'Common',
      'quest.rarity.rare': 'Rare',
      'quest.rarity.epic': 'Epic',
      'quest.rarity.legendary': 'Legendary',
      // Lohnzeilen (Angebot, Abgabe, Toast, Journal)
      'quest.lohn.xp': '+{n} XP',
      'quest.lohn.gold': '+{n} Gold',
      'quest.lohn.mat': '+{n} Iron Chunks',
      'quest.lohn.druckblaetter': '+{n} Print Sheets',
      'quest.lohn.fragment': '+1 Fragment',
      'quest.lohn.fragmente': '+{n} Fragments',
      'quest.lohn.trank': '+1 Healing Potion',
      'quest.lohn.traenke': '+{n} Healing Potions',
      'quest.lohn.stueck': '{name} ({seltenheit})',
      'quest.lohn.zufall': 'Piece of equipment',
      'quest.lohn.tier.0': 'Common',
      'quest.lohn.tier.1': 'Magic',
      'quest.lohn.tier.2': 'Rare',
      'quest.lohn.tier.3': 'Legendary',
      'quest.lohn.toast': 'Task complete: {title}',
      'quest.lohn.stufe': 'Level {level} reached — talents on [T]',
      'quest.lohn.truhe': '{name} is in your stash — the inventory was full',
      'quest.lohn.ausstehend': '{name} is waiting — inventory and stash are full',
      'quest.lohn.nachgereicht': 'Delivered at last: {name}'
    });

    // Auto-add the German reward strings + rarity labels (DE source-of-truth)
    window.i18n.register('de', {
      // Feature 050 side-dialogue keys (consumed by WP03)
      'sidedialog.branka.q2_eyebrow': 'Branka hebt eine Augenbraue, als sie das Magistrats-Siegel sieht. »Wieder eines dieser Verifikations-Siegel. Weisst du eigentlich, was am Ende auf diesen Dokumenten steht?«',
      'sidedialog.thom.q4_eyebrow':   'Thom blickt kurz auf, dann zurück zur Presse. »Patrouillen-Erweiterung. Der Edikt klingt vernünftig. Frag mal jemanden im Pavillon, was »vernünftig« diesen Monat bedeutet.«',
      'quest.reward.info.mara_contact': 'Maras Netzwerk enthüllt',
      'quest.reward.ALDRIC_SCHWERT': 'Ratsschwert',
      'quest.reward.RITUAL_AMULETT': 'Nebelamulett des Rats',
      'quest.reward.ELARAS_KLINGE': 'Elaras Klinge',
      'quest.rarity.common': 'Gewöhnlich',
      'quest.rarity.rare': 'Selten',
      'quest.rarity.epic': 'Episch',
      'quest.rarity.legendary': 'Legendär'
    });
    window.i18n.register('de', LOHN_DE);

    // Convert QUEST_DEFINITIONS title/description/dialogue* to live getters so
    // ANY consumer reading q.title etc. sees the active language without code
    // changes. Plain object literals are not frozen, so defineProperty works.
    Object.keys(QUEST_DEFINITIONS).forEach(function (id) {
      var q = QUEST_DEFINITIONS[id];
      QUEST_FIELDS.forEach(function (field) {
        // Optionales Feld: ohne Text kein Getter, sonst warnte jeder Lesezugriff
        // (getActiveQuests kopiert alle Felder) ueber einen fehlenden Key.
        if (field === 'dialogueProgressNext' && typeof q[field] !== 'string') return;
        var key = 'quest.' + id + '.' + field;
        var fallback = q[field];
        try {
          Object.defineProperty(q, field, {
            get: function () {
              var v = window.i18n.t(key);
              return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : (fallback || '');
            },
            configurable: true, enumerable: true
          });
        } catch (e) { /* swallow */ }
      });
      // Die Auftakt-Seiten (Liste) folgen der Sprache wie die Felder oben.
      if (Array.isArray(q.dialogueIntro) && typeof window.i18n.binden === 'function') {
        q.dialogueIntro.forEach(function (_, i) {
          window.i18n.binden(q.dialogueIntro, i, 'quest.' + id + '.dialogueIntro.' + i);
        });
      }
      // Reward item names + rarity labels: same pattern (only first item used
      // by HubSceneV2 reward UI, but iterate all for correctness).
      if (q.rewards && Array.isArray(q.rewards.items)) {
        q.rewards.items.forEach(function (item) {
          if (item && item.nameKey) {
            var nameKey = item.nameKey;
            var nameFallback = item.name;
            try {
              Object.defineProperty(item, 'name', {
                get: function () {
                  var v = window.i18n.t(nameKey);
                  return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : (nameFallback || '');
                },
                configurable: true, enumerable: true
              });
            } catch (e) { /* swallow */ }
          }
          if (item && item.rarityKey) {
            var rkey = item.rarityKey;
            var rfallback = item.rarityLabel;
            try {
              Object.defineProperty(item, 'rarityLabel', {
                get: function () {
                  var v = window.i18n.t(rkey);
                  return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : (rfallback || '');
                },
                configurable: true, enumerable: true
              });
            } catch (e) { /* swallow */ }
          }
        });
      }
      // Reward info string
      if (q.rewards && q.rewards.infoKey) {
        var infoKey = q.rewards.infoKey;
        var infoFallback = q.rewards.info;
        try {
          Object.defineProperty(q.rewards, 'info', {
            get: function () {
              var v = window.i18n.t(infoKey);
              return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : (infoFallback || '');
            },
            configurable: true, enumerable: true
          });
        } catch (e) { /* swallow */ }
      }
    });
  }

  // ---- i18n helpers ----
  // Use these helpers (or i18n.t directly with `quest.<id>.<field>`) instead of
  // reading quest.title / quest.description directly so the active language is
  // always honored. Falls back to the original field when i18n is absent.
  function getQuestField(quest, field) {
    if (!quest) return '';
    if (window.i18n) {
      var v = window.i18n.t('quest.' + quest.id + '.' + field);
      if (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) return v;
    }
    return quest[field] || '';
  }

  // ---- Quest State ----
  // status: 'available' | 'active' | 'completed'
  let questState = {};

  // Boolean side-state independent of quest status — used for narrative
  // milestones that aren't quests themselves (e.g. `elaraMet` set by the
  // Rathauskeller encounter modal). Persisted alongside questState.
  let questFlags = {};

  // #53 follow-up: once-guard for the "Quest-Ziel erfüllt" toast. The toast
  // fires when the objectives are MET (criteria fulfilled), NOT at turn-in.
  // In-memory only (per session) — on save reload no progress event fires, so
  // an already-ready quest won't re-toast.
  let _criteriaToasted = {};

  // v6.1 Stufe 2: Die Namen, die nach dem Nachhall lesbar zurueckblieben
  // (js/nachhall.js verklingen). Thom druckt sie im Epilog mit
  // (questFinale.epilog liest sie aus getFlags().nachhall_namen).
  let nachhallNamen = [];
  var NACHHALL_NAMEN_MAX = 6;

  function _initQuestState() {
    questState = {};
    _criteriaToasted = {};
    Object.keys(QUEST_DEFINITIONS).forEach(function (id) {
      questState[id] = { status: 'available', objectives: null };
    });
  }
  _initQuestState();

  function setFlag(name, value) {
    if (!name || typeof name !== 'string') return;
    // Feature 063: setFlag(name) ohne value setzt true (DialogChoice ruft so).
    if (arguments.length < 2) value = true;
    questFlags[name] = !!value;
    if (name === 'enttarnt' && value) _ratsAuftraegeBeenden();
    _notifyUpdate();
    _persistIfPossible();
  }

  function hasFlag(name) {
    return !!questFlags[name];
  }

  // Feature 062: flache Kopie aller gesetzten Story-Flags. Lesehilfe für das
  // spätere Finale-Feature (computeFinaleState), das mehrere Flags gleichzeitig
  // auswertet.
  function getFlags() {
    var f = Object.assign({}, questFlags);
    // Keine Flagge, sondern eine Liste: steht nur da, wenn es Namen gibt.
    if (nachhallNamen.length) f.nachhall_namen = nachhallNamen.slice();
    return f;
  }

  /** Die Namen aus dem Nachhall (Kopie). */
  function getNachhallNamen() {
    return nachhallNamen.slice();
  }

  /**
   * Namen aus dem Nachhall festhalten. Spaetere Siege ergaenzen die Liste,
   * ohne Doppelte, hoechstens NACHHALL_NAMEN_MAX.
   */
  function setNachhallNamen(liste) {
    if (!Array.isArray(liste)) return;
    liste.forEach(function (n) {
      if (typeof n !== 'string' || !n.trim()) return;
      if (nachhallNamen.indexOf(n) >= 0 || nachhallNamen.length >= NACHHALL_NAMEN_MAX) return;
      nachhallNamen.push(n);
    });
    _notifyUpdate();
    _persistIfPossible();
  }

  // ---- Core Functions ----

  function _getCurrentActIndex() {
    if (window.storySystem && typeof window.storySystem.getCurrentActIndex === 'function') {
      return window.storySystem.getCurrentActIndex();
    }
    return 0;
  }

  function getAvailableQuests(npcId) {
    var currentAct = _getCurrentActIndex();
    return Object.keys(QUEST_DEFINITIONS).filter(function (id) {
      var def = QUEST_DEFINITIONS[id];
      var state = questState[id];
      if (!state || state.status !== 'available') return false;
      if (def.npcId !== npcId) return false;
      // Check act requirement
      if (typeof def.requiredAct === 'number' && currentAct < def.requiredAct) return false;
      // Angebotstiefe: erst, wenn die erreichte Tiefe so weit ist.
      if (_erreichteTiefe() < angebotsTiefe(def)) return false;
      // Check prerequisites
      if (Array.isArray(def.prerequisites) && def.prerequisites.length > 0) {
        for (var i = 0; i < def.prerequisites.length; i++) {
          var preState = questState[def.prerequisites[i]];
          if (!preState || preState.status !== 'completed') return false;
        }
      }
      // Optional gate predicate (feature 045). When set, the quest is only
      // offered if the predicate returns true. The predicate runs on every
      // offer-list refresh, so the quest appears/disappears dynamically.
      if (typeof def.gate === 'function') {
        try {
          if (!def.gate()) return false;
        } catch (_) {
          // Defensive: a throwing gate shouldn't crash the dialog. Hide the
          // quest until the gate is fixed.
          return false;
        }
      }
      return true;
    }).map(function (id) { return QUEST_DEFINITIONS[id]; });
  }

  function getActiveQuests(npcId) {
    return Object.keys(QUEST_DEFINITIONS).filter(function (id) {
      var state = questState[id];
      if (!state || state.status !== 'active') return false;
      if (npcId && QUEST_DEFINITIONS[id].npcId !== npcId) return false;
      return true;
    }).map(function (id) {
      var def = QUEST_DEFINITIONS[id];
      var objectives = questState[id].objectives || def.objectives.map(function (o) {
        return { type: o.type, target: o.target, current: 0, required: o.required };
      });
      return Object.assign({}, def, { objectives: objectives, status: 'active' });
    });
  }

  /**
   * Gehoert der Auftrag zur Geschichte? Massgeblich ist sein Gewicht
   * (rewardTier): story, boss und finale tragen die Handlung, 'neben' sind
   * Einfuehrungen, Aushaenge und Gefaelligkeiten. Story-Auftraege bietet eine
   * Figur immer zuerst an, auch wenn bei ihr gerade ein Nebenauftrag laeuft.
   */
  function istStoryAuftrag(questOrId) {
    var def = (typeof questOrId === 'string') ? QUEST_DEFINITIONS[questOrId]
      : (questOrId && QUEST_DEFINITIONS[questOrId.id]) || questOrId;
    var tier = def && def.rewardTier;
    return tier === 'story' || tier === 'boss' || tier === 'finale';
  }

  /** Bei wem ein Auftrag abgegeben wird (v6.1: turnInNpcId, sonst der Geber). */
  function abgabeNpc(questOrId) {
    var def = (typeof questOrId === 'string') ? QUEST_DEFINITIONS[questOrId]
      : (questOrId && QUEST_DEFINITIONS[questOrId.id]) || questOrId;
    return (def && (def.turnInNpcId || def.npcId)) || null;
  }

  /**
   * Wo ein fertiger Auftrag abgegeben wird, wenn nicht im Hub. Elaras
   * Auftraege nimmt sie unten im Keller ab — sie kommt nicht in die Stadt.
   * Ohne den Hinweis stand der Auftrag fertig im Journal, und keiner im Hub
   * nahm ihn ab. Leer, solange er nicht fertig ist oder oben abgegeben wird.
   */
  function getAbgabeHinweis(questOrId) {
    var id = (typeof questOrId === 'string') ? questOrId : (questOrId && questOrId.id);
    var def = id && QUEST_DEFINITIONS[id];
    if (!def || !def.abgabeHinweis || !isQuestReadyToComplete(id)) return '';
    return getQuestField(def, 'abgabeHinweis');
  }

  /**
   * Die laufenden Auftraege, ueber die man mit dieser Figur spricht: was sie
   * vergeben hat, solange es noch laeuft, und was bei ihr abzugeben ist,
   * sobald es fertig ist. Fuer Auftraege ohne turnInNpcId dasselbe wie
   * getActiveQuests(npcId).
   */
  function getActiveQuestsAt(npcId) {
    return getActiveQuests().filter(function (q) {
      var bereit = isQuestReadyToComplete(q.id);
      return (bereit ? abgabeNpc(q) : q.npcId) === npcId;
    });
  }

  function getCompletedQuests(npcId) {
    return Object.keys(QUEST_DEFINITIONS).filter(function (id) {
      var state = questState[id];
      if (!state || state.status !== 'completed') return false;
      if (npcId && QUEST_DEFINITIONS[id].npcId !== npcId) return false;
      return true;
    }).map(function (id) { return QUEST_DEFINITIONS[id]; });
  }

  /**
   * Move a quest from 'available' to 'active' state and initialise its objectives.
   * Auto-completes dialogue-type quests immediately. Fires onQuestUpdate listeners.
   * @param {string} questId
   * @returns {boolean} true if state actually changed, false on unknown id or wrong state
   */
  function acceptQuest(questId) {
    var def = QUEST_DEFINITIONS[questId];
    if (!def) return false;
    var state = questState[questId];
    if (!state || state.status !== 'available') return false;

    questState[questId] = {
      status: 'active',
      objectives: def.objectives.map(function (o) {
        return { type: o.type, target: o.target, current: 0, required: o.required };
      }),
      // Die Mindesttiefe bei Annahme (s. _mindestTiefe).
      abTiefe: (typeof def.minDepth === 'number') ? def.minDepth : null
    };

    // Auto-complete dialogue quests immediately upon acceptance
    if (def.type === 'dialogue') {
      questState[questId].objectives.forEach(function (obj) {
        obj.current = obj.required;
      });
      console.log('[QuestSystem] Auto-completed dialogue quest:', questId);
    }

    console.log('[QuestSystem] Accepted quest:', questId);
    _notifyUpdate();
    _persistIfPossible();
    return true;
  }

  /**
   * Increment progress on every active quest objective whose (type, target)
   * tuple matches. Used for kill/explore/collect/dialogue progress events.
   * @param {string} type   Objective type — 'kill' | 'explore' | 'collect' | 'dialogue' | 'boss_kill' | ...
   * @param {string} target Objective target — 'enemy' | 'room' | 'item:foo' | a boss key | ...
   * @param {number} [amount=1] How much to increment (clamped at obj.required)
   * @returns {boolean} true if any objective changed (and listeners were notified)
   */
  // Feature 058 (#41) follow-up: per-act depth gate. A quest may declare
  // `minDepth: N` — its objectives only advance once the current run is at
  // least that deep. Since depth grows +1 per completed run, this paces a key
  // quest per act to the cumulative run count (Akt 1 → T3, Akt 2 → T8,
  // Akt "Bruch" → T22; Akt 3/5/6 are already depth-gated via reach_wave
  // 20/30/40). No gate (no minDepth) → always passes.
  function _questDepthMet(id) {
    var m = _mindestTiefe(id);
    if (typeof m !== 'number') return true;
    var d = (typeof window !== 'undefined' && typeof window.DUNGEON_DEPTH === 'number')
      ? window.DUNGEON_DEPTH : 1;
    return d >= m;
  }

  // b475: Mindesttiefen verschoben (Aushaenge, Bruch, Pamphlete, ...). Ein
  // laufender Auftrag behaelt die Tiefe, mit der er angenommen wurde: neue
  // tragen sie als state.abTiefe, Altstaende ohne Vermerk die von vorher.
  // Wer also mitten im Bruch auf Tiefe 12 steht, muss nicht auf 20.
  var ALTE_MINDESTTIEFE = {
    brett_anfuehrer: 6, brett_welle: 6, brett_aufruf: 10, brett_laeufe: 8, brett_zeugen: 12,
    bruch_confrontation: 8, thom_pamphlets: 22, verseuchte_kammer: null, klerus_district_purge: null
  };
  function _mindestTiefe(id) {
    var def = QUEST_DEFINITIONS[id];
    var st = questState[id];
    if (st && st.status === 'active') {
      if (Object.prototype.hasOwnProperty.call(st, 'abTiefe')) return st.abTiefe;
      if (Object.prototype.hasOwnProperty.call(ALTE_MINDESTTIEFE, id)) return ALTE_MINDESTTIEFE[id];
    }
    return (def && typeof def.minDepth === 'number') ? def.minDepth : null;
  }

  /**
   * Ab welcher ERREICHTEN Tiefe (Persistence.getMaxDepth) der Auftrag
   * angeboten wird. Eigenes Feld statt minDepth: minDepth bindet zusaetzlich
   * den Fortschritt an die Tiefe des laufenden Laufs, und das waere fuer
   * Ziele im Hub falsch (Schmieden, Elaras Szenen). Laufende und
   * abgeschlossene Auftraege beruehrt es nicht, es filtert nur das Angebot.
   */
  function angebotsTiefe(questOrId) {
    var def = (typeof questOrId === 'string') ? QUEST_DEFINITIONS[questOrId] : questOrId;
    return (def && typeof def.angebotAb === 'number') ? def.angebotAb : 1;
  }

  function _erreichteTiefe() {
    try {
      var P = window.Persistence;
      if (P && typeof P.getMaxDepth === 'function') return Math.max(1, P.getMaxDepth() | 0);
    } catch (e) {}
    return 1;
  }

  /**
   * #72: Ist die Mindesttiefe dieser Quest im laufenden Lauf erreicht?
   * (Oder mit Tiefe als zweitem Argument.) Beute und Spionageraeume fragen
   * das, damit unterhalb der Tiefe nichts faellt, das dann nicht zaehlt.
   */
  function tiefeErreicht(id, tiefe) {
    var m = _mindestTiefe(id);
    if (typeof m !== 'number') return true;
    var d = (typeof tiefe === 'number') ? tiefe
      : (typeof window !== 'undefined' && typeof window.DUNGEON_DEPTH === 'number') ? window.DUNGEON_DEPTH : 1;
    return d >= m;
  }

  function updateQuestProgress(type, target, amount) {
    var changed = false;
    Object.keys(questState).forEach(function (id) {
      var state = questState[id];
      if (!state || state.status !== 'active' || !state.objectives) return;
      if (!_questDepthMet(id)) return; // depth-gated quest: frozen until deep enough
      state.objectives.forEach(function (obj) {
        if (obj.type === type && obj.target === target && obj.current < obj.required) {
          obj.current = Math.min(obj.required, obj.current + (amount || 1));
          changed = true;
        }
      });
    });
    if (changed) {
      _notifyUpdate();
      _persistIfPossible();
      _fireReadyToasts();
    }
    return changed;
  }

  // Trigger a full game save if saveGame is reachable. We save on every
  // material quest-state change (accept / complete / progress) so a
  // browser crash mid-dungeon doesn't lose objective progress that
  // would otherwise sit in memory until the next scene transition.
  // saveGame writes the entire payload (inventory, equipment, quests,
  // story, etc.) so it's idempotent — no risk of partial state.
  function _persistIfPossible() {
    if (typeof window === 'undefined' || typeof window.saveGame !== 'function') return;
    try { window.saveGame(); } catch (err) {
      // Don't let a save failure break gameplay — log once and continue.
      try { console.warn('[QuestSystem] persist failed', err); } catch (_) {}
    }
  }

  /**
   * Ein Lauf endet (Tod, Portal, Abschluss). Laufgebundene Ziele
   * ('room_lauf', Aushang Standhalten), die noch nicht voll sind, fallen auf
   * 0: sie zaehlen nur innerhalb EINES Laufs, und wer stirbt, faengt neu an.
   * Volle bleiben stehen (der Auftrag ist dann abzugeben).
   * @returns {boolean} ob sich etwas geaendert hat
   */
  function onLaufEnde() {
    var changed = false;
    Object.keys(questState).forEach(function (id) {
      var st = questState[id];
      if (!st || st.status !== 'active' || !Array.isArray(st.objectives)) return;
      st.objectives.forEach(function (o) {
        if (o.target === 'room_lauf' && o.current > 0 && o.current < o.required) { o.current = 0; changed = true; }
      });
    });
    if (changed) { _notifyUpdate(); _persistIfPossible(); }
    return changed;
  }

  /**
   * Called when a wave is completed. Updates wave-type objectives
   * and dungeon_run objectives.
   */
  function onWaveCompleted(waveNumber) {
    var changed = false;
    Object.keys(questState).forEach(function (id) {
      var state = questState[id];
      if (!state || state.status !== 'active' || !state.objectives) return;
      state.objectives.forEach(function (obj) {
        // Wave reach objectives: set current to the highest depth reached.
        // Feature 058 (#41): depth is run-constant, so `waveNumber` (= the run's
        // DUNGEON_DEPTH/currentWave) no longer climbs per room — running AT or
        // above the target depth satisfies the objective. Still completable;
        // it just requires reaching that depth (which now grows per completed
        // run, not per room).
        if (obj.type === 'wave' && obj.target === 'reach_wave') {
          if (waveNumber > obj.current) {
            obj.current = Math.min(obj.required, waveNumber);
            changed = true;
          }
        }
        // Feature 058 (#41): dungeon_run objectives moved OUT of the per-wave
        // path — under run-constant depth a single run fires onWaveCompleted
        // once per room, which would massively over-count. They now advance
        // exactly +1 per completed run via onDungeonCompleted() (T015).
      });
    });
    if (changed) {
      _notifyUpdate();
      _persistIfPossible();
      _fireReadyToasts();
    }
    return changed;
  }

  /**
   * Feature 058 (#41): called exactly once per successfully COMPLETED dungeon
   * run (from main.js leaveDungeonForHub on reason 'dungeon_complete', same
   * hook as RunDepth.tryCompleteRun). Advances dungeon_run objectives by +1 per
   * run — NOT per wave/room. Idempotency is owned by the caller's run latch.
   */
  function onDungeonCompleted() {
    var changed = false;
    Object.keys(questState).forEach(function (id) {
      var state = questState[id];
      if (!state || state.status !== 'active' || !state.objectives) return;
      if (!_questDepthMet(id)) return; // depth-gated: only runs at/above minDepth count
      state.objectives.forEach(function (obj) {
        if (obj.type === 'dungeon_run' && obj.target === 'dungeon_complete' && obj.current < obj.required) {
          obj.current = Math.min(obj.required, obj.current + 1);
          changed = true;
        }
      });
    });
    if (changed) {
      _notifyUpdate();
      _persistIfPossible();
      _fireReadyToasts();
    }
    return changed;
  }

  /**
   * Called when a boss is killed. Updates boss_kill objectives.
   * @param {string} bossType - e.g. 'kettenmeister', 'schattenrat'
   */
  // v6.1: Elara kommt nicht mehr in den Hub. Bis b457 stand sie dort ab Akt 4
  // (#131, elaraReturnedToHub). Akt 4 beginnt jetzt mit dem Maulwurf, und
  // danach ist sie zur Esse hinabgestiegen. Ihre Auftraege vergibt sie
  // weiter im Dungeon (roomManager: _elaraSpaetereAuftraege).

  function onBossKilled(bossType) {
    var changed = false;
    Object.keys(questState).forEach(function (id) {
      var state = questState[id];
      if (!state || state.status !== 'active' || !state.objectives) return;
      state.objectives.forEach(function (obj) {
        if (obj.type === 'boss_kill' && obj.target === bossType && obj.current < obj.required) {
          obj.current = Math.min(obj.required, obj.current + 1);
          changed = true;
        }
      });
    });
    if (changed) {
      _notifyUpdate();
      _persistIfPossible();
      _fireReadyToasts();
    }
    return changed;
  }

  /**
   * Called when an item is crafted. Updates craft-type objectives.
   */
  function onItemCrafted() {
    return updateQuestProgress('craft', 'craft_item', 1);
  }

  /**
   * #143: Ein System des Spiels wurde benutzt — Schmiede, Presse,
   * Schwarzmarkt, Talentbaum. Traegt die Einfuehrungsquests, die diese
   * Systeme vorstellen, statt sie ueber Tutorialkaesten zu erklaeren.
   *
   * Gueltige Ziele (mehr gibt es nicht; ein Tippfehler waere eine Quest,
   * die sich nicht abschliessen laesst):
   *   'upgrade'  ein Ausruestungsstueck aufgewertet (CraftingScene)
   *   'edikt'    ein Edikt gedruckt (printingHouse.publishEdict)
   *   'markt'    im Schwarzmarkt gekauft (ShopScene)
   *   'talent'   einen Talentpunkt gesetzt (skillTree.investPoint)
   *   'wissen'   ein Fragment im Wissensbaum verbaut (knowledgeTree.invest)
   *   'haendler' beim wandernden Haendler gekauft — irgendetwas (ShopScene)
   *   'charakterwerte' die Charakterwerte geoeffnet, egal von wo (hudV2)
   *   'loadout'  eine Faehigkeit vom Spieler auf eine Taste gelegt
   *              (loadoutOverlay, mobile Slotwahl) — nicht beim Laden
   *   'truhe'    ein Stueck in die Hub-Truhe gelegt (hubTruhe.hineinlegen)
   */
  var SYSTEM_ZIELE = ['upgrade', 'edikt', 'markt', 'talent', 'wissen', 'haendler',
    'charakterwerte', 'loadout', 'truhe'];

  function onSystemUsed(ziel) {
    if (SYSTEM_ZIELE.indexOf(ziel) === -1) {
      try { console.warn('[quest] unbekanntes System-Ziel: ' + ziel); } catch (e) {}
      return false;
    }
    return updateQuestProgress('system', ziel, 1);
  }

  /**
   * Check if all quest chains for all NPCs are completed.
   */
  function areAllQuestChainsComplete() {
    var chainEnders = ['the_reckoning'];
    return chainEnders.every(function (id) {
      var state = questState[id];
      return state && state.status === 'completed';
    });
  }

  function isQuestReadyToComplete(questId) {
    var state = questState[questId];
    if (!state || state.status !== 'active' || !state.objectives) return false;
    return state.objectives.every(function (obj) { return obj.current >= obj.required; });
  }

  // ---- Lohn ----
  //
  // Die Zahlen in den Definitionen sind der Lohn zu Beginn des Spiels. Fest
  // gelassen, waeren sie spaeter Kleingeld: der Stufenbedarf waechst mit
  // L^1.8, die Preise mit der Tiefe (preisNachTiefeneinkommen). Deshalb
  // wird beim Abgeben skaliert — und die Zahl aus der Definition bleibt die
  // Untergrenze, damit sich am Anfang nichts verschiebt.
  //
  // Erfahrung: ein Anteil des Bedarfs fuer die NAECHSTE Stufe, je nach Gewicht
  // des Auftrags (rewardTier). Ein Bosskampf ist rund eine Stufe wert, ein
  // Nebenauftrag knapp die Haelfte.
  //
  // Einfuehrungen (einfuehrung_*) wachsen NICHT mit: sie fuehren ein System
  // vor, ihr eigentlicher Lohn ist das Geschenk dazu (Material, Druckblaetter,
  // Gold, Trank, Fragment). Mit je 40 XP hoben sie zusammen mit dem ersten
  // Lauf auf Stufe 7 — jetzt fest 10 XP, Anteil 0.
  var LOHN_ANTEIL = { einfuehrung: 0, neben: 0.4, story: 0.7, boss: 1.0, finale: 1.5 };

  /**
   * Erfahrung und Gold, die dieser Auftrag JETZT einbringt. Reine Funktion.
   *
   * Gold waechst wie die Preise mit der tiefsten erreichten Tiefe: die Zahl in
   * der Definition gilt auf der Tiefe, ab der der Auftrag zaehlt (minDepth,
   * sonst 1), und bleibt damit auf jeder Tiefe gleich viele Tiefeneinkommen
   * wert.
   *
   * @param {object} def   Quest-Definition (rewards, rewardTier, minDepth)
   * @param {object} lage  { xpFuerStufe, maxTiefe }
   * @returns {{xp:number, gold:number}}
   */
  function lohnBerechnen(def, lage) {
    var r = (def && def.rewards) || {};
    var l = lage || {};
    // Nicht "|| neben": der Anteil 0 der Einfuehrungen ist gewollt und darf
    // nicht auf den Neben-Anteil zurueckfallen.
    var tier = def && def.rewardTier;
    var anteil = Object.prototype.hasOwnProperty.call(LOHN_ANTEIL, tier) ? LOHN_ANTEIL[tier] : LOHN_ANTEIL.neben;
    var bedarf = Math.max(0, Number(l.xpFuerStufe) || 0);
    var xp = Math.max(Number(r.xp) || 0, Math.round(anteil * bedarf));
    var gold = 0;
    var grund = Number(r.gold) || 0;
    if (grund > 0) {
      var bezug = Math.max(1, Number(def.minDepth) || 1);
      var tiefe = Math.max(1, Number(l.maxTiefe) || 1);
      gold = Math.max(grund, Math.round(grund * Math.max(1, tiefe / bezug)));
    }
    return { xp: Math.round(xp), gold: Math.round(gold) };
  }

  function _lohnLage() {
    var stufe = _spielerStufe();
    var bedarf = (typeof window.getNeededXP === 'function') ? window.getNeededXP(stufe) : 0;
    var P = window.Persistence;
    var tiefe = (P && typeof P.getMaxDepth === 'function') ? P.getMaxDepth() : 1;
    return { stufe: stufe, xpFuerStufe: bedarf, maxTiefe: tiefe };
  }

  /**
   * Alles, was der Auftrag jetzt einbringt — mit skalierter Erfahrung und Gold.
   * Mit lageVorgabe { xpFuerStufe: 0, maxTiefe: 1 } die Grundwerte.
   */
  function getQuestLohn(questOrId, lageVorgabe) {
    var def = (typeof questOrId === 'string') ? QUEST_DEFINITIONS[questOrId]
      : (questOrId && QUEST_DEFINITIONS[questOrId.id]) || questOrId;
    var r = (def && def.rewards) || {};
    var lage = lageVorgabe || _lohnLage();
    var zahl = lohnBerechnen(def, lage);
    return {
      xp: zahl.xp,
      gold: zahl.gold,
      mat: (r.materials && r.materials.MAT) | 0,
      druckblaetter: r.druckblaetter | 0,
      fragments: r.fragments | 0,
      potions: r.potions | 0,
      // Noch nicht gewuerfelt: Name und Seltenheit stehen fest, die Werte nicht.
      items: (Array.isArray(r.items) ? r.items : []).map(function (spec) {
        return { name: spec.nameKey ? questSystem.getRewardItemName(spec) : null,
          nameKey: spec.nameKey || null, tier: spec.tier | 0 };
      }),
      unlocks: Array.isArray(r.unlocks) ? r.unlocks.slice() : [],
      info: questSystem.getRewardInfo(def)
    };
  }

  function _lohnT(key, params) {
    var v = null;
    if (window.i18n && typeof window.i18n.t === 'function') {
      v = window.i18n.t(key, params);
      if (typeof v !== 'string' || v.indexOf('[MISSING:') === 0) v = null;
    }
    if (v === null) {
      v = LOHN_DE[key] || key;
      Object.keys(params || {}).forEach(function (k) { v = v.split('{' + k + '}').join(String(params[k])); });
    }
    return v;
  }

  /**
   * Der Lohn als einzelne, uebersetzte Zeilen ("+180 XP", "+650 Gold", …).
   * Nimmt getQuestLohn() oder den Vermerk eines abgegebenen Auftrags.
   */
  function lohnTeile(lohn) {
    if (!lohn) return [];
    var t = [];
    if (lohn.xp > 0) t.push(_lohnT('quest.lohn.xp', { n: lohn.xp }));
    if (lohn.gold > 0) t.push(_lohnT('quest.lohn.gold', { n: lohn.gold }));
    if (lohn.mat > 0) t.push(_lohnT('quest.lohn.mat', { n: lohn.mat }));
    if (lohn.druckblaetter > 0) t.push(_lohnT('quest.lohn.druckblaetter', { n: lohn.druckblaetter }));
    if (lohn.fragments > 0) t.push(lohn.fragments === 1 ? _lohnT('quest.lohn.fragment')
      : _lohnT('quest.lohn.fragmente', { n: lohn.fragments }));
    if (lohn.potions > 0) t.push(lohn.potions === 1 ? _lohnT('quest.lohn.trank')
      : _lohnT('quest.lohn.traenke', { n: lohn.potions }));
    (lohn.items || []).forEach(function (it) {
      var name = it.nameKey ? questSystem.getRewardItemName(it) : (it.name || _lohnT('quest.lohn.zufall'));
      t.push(_lohnT('quest.lohn.stueck', { name: name, seltenheit: _lohnT('quest.lohn.tier.' + (it.tier | 0)) }));
    });
    (lohn.unlocks || []).forEach(function (u) {
      var v = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('story.unlock.' + u) : null;
      t.push((typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : u);
    });
    if (lohn.info) t.push(lohn.info);
    return t;
  }

  /** Was ein abgegebener Auftrag tatsaechlich eingebracht hat (oder null). */
  function getErhaltenerLohn(questId) {
    var st = questState[questId];
    return (st && st.lohn) ? st.lohn : null;
  }

  /**
   * Erfahrungsbonus aus Freischaltungen ("+10 % XP", Die Pamphlete). Aus den
   * abgeschlossenen Auftraegen abgeleitet statt in einem eigenen Feld
   * gemerkt: er steht damit im Quest-Spielstand und gilt auch fuer Staende,
   * die den Auftrag schon vor dieser Aenderung abgeschlossen hatten.
   */
  function getXpBonus() {
    var b = 0;
    Object.keys(QUEST_DEFINITIONS).forEach(function (id) {
      var st = questState[id];
      var u = QUEST_DEFINITIONS[id].rewards && QUEST_DEFINITIONS[id].rewards.unlocks;
      if (st && st.status === 'completed' && Array.isArray(u) && u.indexOf('xp_bonus_10') >= 0) b += 0.10;
    });
    return b;
  }

  /**
   * Wuerfelt ein Lohnstueck auf der Stufe des Spielers — mit derselben
   * Wuerfelmaschine wie jeder Fund, damit es Seltenheit, Affixe und
   * Mindeststufe traegt wie alles andere und nicht als Sonderling neben der
   * Beute steht. Story-Stuecke behalten Namen, Bild und ihr Kennzeichen
   * (signatur: Zielanteil je Wert, wie die wertKurve der Basen).
   */
  function _lohnStueckRollen(spec, stufe) {
    var LS = window.LootSystem;
    if (!spec || !LS || typeof LS.rollItem !== 'function') return null;
    var iLevel = Math.max(1, stufe | 0);
    var it;
    try {
      it = LS.rollItem(spec.basis || null, iLevel, spec.tier | 0, null, { ohneDeckel: true });
    } catch (e) {
      console.warn('[QuestSystem] Lohnstueck nicht gewuerfelt', e);
      return null;
    }
    if (spec.key) it.key = spec.key;
    if (spec.iconKey) it.iconKey = spec.iconKey;
    if (spec.nameKey) {
      it.nameKey = spec.nameKey;
      it.name = it._baseName = questSystem.getRewardItemName(spec);
      it.festerName = true;
    }
    if (spec.signatur && typeof LS.affixPunkte === 'function') {
      Object.keys(spec.signatur).forEach(function (stat) {
        var p = Math.round(LS.affixPunkte(spec.signatur[stat], iLevel) * 10) / 10;
        it.baseStats[stat] = p;
        it[stat] = p;
      });
    }
    if (spec.elaraGift) it.elaraGift = true;
    // Die Signatur hebt Werte, nicht die Gegenstandsstufe: die bleibt die
    // Stufe des Wurfs (rollItem setzt iLevel und itemLevel gleich).
    if (typeof LS.composeName === 'function') it.displayName = LS.composeName(it);
    return it;
  }

  /** Ein kleiner Heiltrank — dasselbe Stueck, das unten faellt. */
  function _lohnTrank() {
    if (typeof window.makePotionDrop === 'function') return window.makePotionDrop(1);
    return { type: 'potion', potionTier: 1, name: 'Heiltrank (S)', nameKey: 'loot.potion.t1',
      iconKey: 'itPotionMinor', stack: 1 };
  }

  function _stueckName(it) {
    if (it && it.nameKey && window.i18n) {
      var v = window.i18n.t(it.nameKey);
      if (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) return v;
    }
    return (it && (it.displayName || it.name)) || '?';
  }

  // Lohnstuecke, die weder ins Inventar noch in die Truhe passten. Sie gehen
  // nicht verloren, sondern warten im Quest-Spielstand auf Platz.
  var _ausstehend = [];

  function _laufInventar() {
    if (typeof inventory !== 'undefined' && Array.isArray(inventory)) return inventory;
    return Array.isArray(window.inventory) ? window.inventory : null;
  }

  /**
   * Legt ein Lohnstueck ab: Inventar, sonst Hub-Truhe, sonst Warteliste.
   * @returns {'inventar'|'truhe'|'ausstehend'}
   */
  function _stueckAblegen(it) {
    var inv = _laufInventar();
    // Traenke stapeln wie beim Aufheben unten (loot.js collectLoot).
    if (it.type === 'potion' && inv) {
      for (var i = 0; i < inv.length; i++) {
        var s = inv[i];
        if (s && s.type === 'potion' && s.potionTier === it.potionTier) {
          s.stack = (s.stack || 1) + (it.stack || 1);
          return 'inventar';
        }
      }
    }
    // Ueber InventoryGrid, sonst fehlt die Rasterlage und der Lohn ist im
    // Inventar unsichtbar.
    if (inv && window.InventoryGrid && typeof window.InventoryGrid.einfuegen === 'function') {
      if (window.InventoryGrid.einfuegen(inv, it) >= 0) return 'inventar';
    } else if (inv) {
      var frei = inv.findIndex(function (slot) { return !slot; });
      if (frei >= 0) { inv[frei] = it; return 'inventar'; }
    }
    if (window.HubTruhe && typeof window.HubTruhe.einlagern === 'function' && window.HubTruhe.einlagern(it)) {
      return 'truhe';
    }
    _ausstehend.push(it);
    return 'ausstehend';
  }

  /**
   * Versucht, wartende Lohnstuecke abzulegen. Mit einer Szene meldet ein
   * Toast, was angekommen ist.
   * @returns {number} wie viele abgelegt wurden
   */
  function _ausstehendeAusliefern(scene) {
    if (!_ausstehend.length) return 0;
    var warten = _ausstehend;
    _ausstehend = [];
    var namen = [];
    warten.forEach(function (it) {
      if (_stueckAblegen(it) !== 'ausstehend') namen.push(it.displayName || _stueckName(it));
    });
    if (namen.length && scene && window.EventSystem && typeof window.EventSystem.showToast === 'function') {
      try { window.EventSystem.showToast(scene, _lohnT('quest.lohn.nachgereicht', { name: namen.join(', ') }), 'quest_objective_done'); } catch (e) {}
    }
    if (namen.length && typeof refreshInventoryUI === 'function') { try { refreshInventoryUI(); } catch (e) {} }
    return namen.length;
  }

  /** Ein Toast je Abgabe — aus completeQuest, damit kein Abgabeweg ihn vergisst. */
  function _lohnToast(def, vermerk, stufeVorher, hinweise) {
    try {
      var teile = lohnTeile(vermerk);
      var stufe = _spielerStufe();
      if (stufe > stufeVorher) teile.push(_lohnT('quest.lohn.stufe', { level: stufe }));
      var unter = [teile.join(' · ')].concat(hinweise || []).filter(Boolean).join('\n');
      var title = getQuestField(def, 'title') || def.title || '';
      var scene = _resolveActiveScene();
      if (scene && window.EventSystem && typeof window.EventSystem.showToast === 'function') {
        window.EventSystem.showToast(scene, _lohnT('quest.lohn.toast', { title: title }),
          'quest_objective_done', false, unter ? { unter: unter } : undefined);
      }
    } catch (e) {
      try { console.warn('[QuestSystem] Lohn-Toast fehlgeschlagen', e); } catch (_) {}
    }
  }

  function completeQuest(questId) {
    if (!isQuestReadyToComplete(questId)) return false;
    var def = QUEST_DEFINITIONS[questId];
    if (!def) return false;

    // #68: Kopfgelder vom Brett sind wiederholbar — sie kehren nach der
    // Abgabe in die Auslage zurueck, mit zurueckgesetztem Fortschritt.
    // Alles andere (Story) wird abgeschlossen und bleibt es.
    questState[questId].status = def.repeatable ? 'available' : 'completed';
    if (def.repeatable && Array.isArray(questState[questId].objectives)) {
      questState[questId].objectives.forEach(function (o) { o.current = 0; });
      questState[questId].abgeschlossen = (questState[questId].abgeschlossen || 0) + 1;
    }

    // Lohn: skaliert im Moment der Abgabe, dann einzeln vergeben. Was
    // tatsaechlich ankam, steht im Auftrag (Journal) und im Toast.
    _ausstehendeAusliefern();
    var rewards = def.rewards || {};
    var stufeVorher = _spielerStufe();
    var lohn = getQuestLohn(def);
    var vermerk = { xp: lohn.xp, gold: lohn.gold, mat: lohn.mat, druckblaetter: lohn.druckblaetter,
      fragments: lohn.fragments, potions: lohn.potions, unlocks: lohn.unlocks.slice(), items: [] };
    var hinweise = [];
    if (lohn.xp > 0) {
      // Über addXP vergeben, damit Level-Up + window-Spiegelung + HUD korrekt
      // laufen. Früher wurde nur window.playerXP hochgezählt -> nie ein
      // Level-Up ausgelöst und die Anzeige lief über (z.B. 290/136).
      if (typeof addXP === 'function') addXP(lohn.xp);
      else if (typeof window !== 'undefined' && typeof window.addXP === 'function') window.addXP(lohn.xp);
      else if (typeof window !== 'undefined') { window.playerXP = (window.playerXP || 0) + lohn.xp; }
    }
    // #68: LootSystem.grantGold ist der einzige Weg, auf dem Gold beim
    // Spieler ankommt.
    if (lohn.gold > 0 && window.LootSystem && typeof window.LootSystem.grantGold === 'function') {
      try { window.LootSystem.grantGold(lohn.gold); } catch (_) {}
    }
    if (rewards.materials) {
      Object.keys(rewards.materials).forEach(function (key) {
        if (typeof changeMaterialCount === 'function') {
          changeMaterialCount(key, rewards.materials[key]);
        } else if (typeof materialCounts !== 'undefined') {
          materialCounts[key] = (materialCounts[key] || 0) + rewards.materials[key];
        }
      });
    }
    var stuecke = [];
    if (Array.isArray(rewards.items)) {
      rewards.items.forEach(function (spec) {
        var it = _lohnStueckRollen(spec, stufeVorher);
        if (it) stuecke.push(it);
      });
    }
    for (var _t = 0; _t < (lohn.potions | 0); _t++) stuecke.push(_lohnTrank());
    stuecke.forEach(function (it) {
      if (it.type !== 'potion') {
        vermerk.items.push({ name: it.displayName || it.name, nameKey: it.festerName ? it.nameKey : null, tier: it.tier | 0 });
      }
      var wohin = _stueckAblegen(it);
      var name = it.displayName || _stueckName(it);
      if (wohin === 'truhe') hinweise.push(_lohnT('quest.lohn.truhe', { name: name }));
      else if (wohin === 'ausstehend') hinweise.push(_lohnT('quest.lohn.ausstehend', { name: name }));
    });
    if (stuecke.length && typeof refreshInventoryUI === 'function') {
      try { refreshInventoryUI(); } catch (_) {}
    }
    if (lohn.druckblaetter > 0
        && window.PrintingHouse && typeof window.PrintingHouse.addDruckblaetter === 'function') {
      try { window.PrintingHouse.addDruckblaetter(lohn.druckblaetter); } catch (_) {}
    }
    if (lohn.unlocks.length) {
      if (!window._questUnlocks) window._questUnlocks = {};
      lohn.unlocks.forEach(function (unlock) { window._questUnlocks[unlock] = true; });
    }
    // Feature 050: Wissens-Fragmente ueber den einen Eingang des Wissensbaums.
    if (lohn.fragments > 0
        && window.KnowledgeTree && typeof window.KnowledgeTree.addFragments === 'function') {
      try {
        window.KnowledgeTree.addFragments(lohn.fragments);
      } catch (err) {
        console.warn('[QuestSystem] fragment grant failed', err);
      }
    }
    questState[questId].lohn = vermerk;
    _lohnToast(def, vermerk, stufeVorher, hinweise);

    // Feature 050 FR-08: Q6 completion advances the story arc to Act 2
    // (storySystem index 2 = 'erste_risse' — the "first cracks" beat that
    // matches the Council-collusion reveal). storySystem.advanceToAct is
    // idempotent + monotonic: same-or-lower targets are no-ops.
    if (questId === 'council_collusion_reveal' && window.storySystem
        && typeof window.storySystem.advanceToAct === 'function') {
      try {
        window.storySystem.advanceToAct(2);
      } catch (err) {
        console.warn('[QuestSystem] storySystem.advanceToAct(2) failed', err);
      }
    }

    // Feature 055: data-driven story advancement. A quest may declare
    // `advanceAct: <STORY_ACTS index>`; on completion it advances the arc to
    // that index (advanceToAct is idempotent/monotonic — same-or-lower = no-op).
    // Used by Akt-2-Climax-Quests: ritual_chamber -> 3 (wahrheit),
    // bruch_confrontation -> 4 (bruch). Avoids growing the hardcoded list above.
    var _advDef = QUEST_DEFINITIONS[questId];
    if (_advDef && typeof _advDef.advanceAct === 'number' && window.storySystem
        && typeof window.storySystem.advanceToAct === 'function') {
      try {
        window.storySystem.advanceToAct(_advDef.advanceAct);
      } catch (err) {
        console.warn('[QuestSystem] advanceToAct(' + _advDef.advanceAct + ') failed', err);
      }
    }

    // Feature 062: Story-Flags bei Abschluss setzen (bestehender questFlags-
    // Speicher, kein neues Modul). `completionFlags` ist die Backbone-Form der
    // Entscheidungs-Flags — die Szenen-Wahl (sealed/refused etc.) folgt mit dem
    // Inszenierungs-Feature; hier wird der Default-Zweig gesetzt.
    if (_advDef && Array.isArray(_advDef.completionFlags)) {
      _advDef.completionFlags.forEach(function (fn) {
        if (fn && typeof fn === 'string') questFlags[fn] = true;
      });
    }
    // Der Bruch: ab hier gibt der Rat keine Auftraege mehr.
    _ratsAuftraegeBeenden();

    console.log('[QuestSystem] Completed quest:', questId);
    if (window.AbilitySystem && typeof window.AbilitySystem.onQuestCompleted === 'function') {
      window.AbilitySystem.onQuestCompleted(questId);
    }
    _notifyUpdate();
    _persistIfPossible();
    // #53 follow-up: the visible toast now fires when the CRITERIA are met
    // (see _fireReadyToasts), not here at turn-in. Clear the once-guard so a
    // re-accepted/repeatable quest can toast again next time.
    delete _criteriaToasted[questId];
    return true;
  }

  // #53 (+ follow-up): show a toast the moment a quest's objectives are
  // FULFILLED — i.e. on the transition to ready-to-complete during gameplay
  // (10th kill, 3rd crafted item, target depth reached …), NOT when the player
  // turns it in at the NPC. Once per quest per session via _criteriaToasted.
  // Called from every objective-advancing function below.
  function _fireReadyToasts() {
    try {
      Object.keys(questState).forEach(function (id) {
        var state = questState[id];
        if (!state || state.status !== 'active') return;
        if (_criteriaToasted[id]) return;
        if (!isQuestReadyToComplete(id)) return;
        _criteriaToasted[id] = true;
        _showQuestCriteriaToast(QUEST_DEFINITIONS[id]);
      });
    } catch (e) {
      try { console.warn('[QuestSystem] ready-toast scan failed', e); } catch (_) {}
    }
  }

  // Reuses EventSystem.showToast (panel style + scrollFactor(0) so it stays
  // fixed on the camera). Resolves the currently-active scene (GameScene in the
  // dungeon, HubSceneV2 in town). Wrapped in try/catch — never break gameplay.
  function _showQuestCriteriaToast(def) {
    try {
      if (!def) return;
      var title = getQuestField(def, 'title') || def.title || '';
      var msg = (window.i18n && typeof window.i18n.t === 'function')
        ? window.i18n.t('quest.toast.completed', { title: title })
        : ('Quest-Ziel erfüllt: ' + title);
      var hinweis = getAbgabeHinweis(def.id);
      if (hinweis) msg += '\n' + hinweis;
      // #197: waehrend einer Spionage-Mission wird der Text zur
      // letzten Seite der Abhoer-Szene statt eines Toasts.
      if (window.SpionageSzenen && typeof window.SpionageSzenen.zielToast === 'function'
          && window.SpionageSzenen.zielToast(msg)) return;
      var scene = _resolveActiveScene();
      if (scene && window.EventSystem && typeof window.EventSystem.showToast === 'function') {
        window.EventSystem.showToast(scene, msg, 'quest_objective_done');
      }
    } catch (e) {
      try { console.warn('[QuestSystem] objective toast failed', e); } catch (_) {}
    }
  }

  function _resolveActiveScene() {
    // Prefer the live GameScene reference set in main.js; fall back to scanning
    // for any active scene that can render (has add + cameras).
    var s = window.gameScene;
    if (s && s.sys && s.sys.isActive && s.sys.isActive() && s.add) return s;
    var game = window.game;
    if (game && game.scene && Array.isArray(game.scene.scenes)) {
      for (var i = 0; i < game.scene.scenes.length; i++) {
        var sc = game.scene.scenes[i];
        if (sc && sc.sys && sc.sys.isActive && sc.sys.isActive()
            && sc.add && sc.cameras && sc.cameras.main) {
          return sc;
        }
      }
    }
    return null;
  }

  // ---- Persistence ----

  function getQuestSaveData() {
    return {
      storyVersion: STORY_VERSION,
      quests: JSON.parse(JSON.stringify(questState)),
      flags: JSON.parse(JSON.stringify(questFlags)),
      nachhallNamen: nachhallNamen.slice(),
      ausstehend: JSON.parse(JSON.stringify(_ausstehend))
    };
  }

  function loadQuestSaveData(data) {
    if (!data || typeof data !== 'object') return;
    _initQuestState();
    questFlags = {};
    nachhallNamen = [];
    // Wartende Lohnstuecke gehoeren zum Charakter, nicht zur Story — sie
    // ueberstehen auch den Altstand-Reset unten.
    _ausstehend = Array.isArray(data.ausstehend) ? data.ausstehend.filter(Boolean) : [];
    // Feature 062: Altstand-Reset. Ein Stand mit fehlender oder älterer
    // storyVersion trägt die inkompatible v3-Struktur (andere Quest-IDs,
    // entfernte final_truth). Statt fragiler Teilmigration: Story-/Quest-/Flag-
    // Teil verwerfen und frisch auf Akt 0 initialisieren. Charakter-State
    // (Level/Inventar/Gold/Skillbaum) liegt ausserhalb dieses Blobs -> bleibt.
    var _sv = (typeof data.storyVersion === 'number') ? data.storyVersion : 0;
    if (_sv < STORY_VERSION) {
      // questState + Flags bleiben auf dem frischen _initQuestState()-Stand.
      try {
        if (window.storySystem && typeof window.storySystem.resetToAct0 === 'function') {
          window.storySystem.resetToAct0();
        } else if (window.storySystem && typeof window.storySystem.advanceToAct === 'function') {
          window.storySystem.advanceToAct(0);
        }
      } catch (err) { console.warn('[QuestSystem] story reset on old save failed', err); }
      console.log('[QuestSystem] Alter Story-Stand (v' + _sv + ') -> Reset auf Akt 0 (v' + STORY_VERSION + ').');
      _notifyUpdate();
      return;
    }
    // Backward compat: legacy saves are flat questState (no .quests wrapper).
    // Detect the wrapper by checking if .quests is itself an object whose
    // values look like quest entries ({status,objectives}).
    var srcQuests = data;
    var srcFlags = {};
    if (data.quests && typeof data.quests === 'object'
        && (data.flags === undefined || typeof data.flags === 'object')) {
      srcQuests = data.quests;
      srcFlags = data.flags || {};
    }
    Object.keys(srcQuests).forEach(function (id) {
      if (questState[id] && srcQuests[id] && typeof srcQuests[id] === 'object') {
        questState[id] = srcQuests[id];
        _standhaltenUmstellen(id);
        _eskorteUmstellen(id);
        _zieleNachziehen(id);
      }
      // Old quest IDs from previous saves are silently ignored,
      // preserving backward compatibility
    });
    Object.keys(srcFlags).forEach(function (k) {
      questFlags[k] = !!srcFlags[k];
    });
    if (Array.isArray(data.nachhallNamen)) {
      nachhallNamen = data.nachhallNamen.filter(function (n) { return typeof n === 'string' && n; })
        .slice(0, NACHHALL_NAMEN_MAX);
    }
    _backfillAdvanceActs();
    // Stufe 1b: Staende, die schon hinter dem Bruch liegen. Aeltere trugen
    // das Flag noch nicht (completionFlags kam spaeter): der abgeschlossene
    // Bruch genuegt.
    if (questState.bruch_confrontation && questState.bruch_confrontation.status === 'completed') {
      questFlags.enttarnt = true;
    }
    // Stufe 1b: Altstaende tragen beide Gesuche-Flags (s. council_seizure);
    // behalten war dann die echte Wahl.
    if (questFlags.petitions_kept && questFlags.petitions_surrendered) delete questFlags.petitions_surrendered;
    _ratsAuftraegeBeenden();
    _notifyUpdate();
  }

  /**
   * Stufe 1b: Ab dem Bruch (Flag 'enttarnt') sitzt Aldric im verschlossenen
   * Rathaus und steht nicht mehr im Hub. Was er noch vergeben hatte, laufend
   * oder nie angenommen, endet hier: Status 'entfallen', ohne Lohn und ohne
   * Ziele (also auch ohne Anzeige im Tracker). Laufende behalten den Vermerk
   * warAngenommen, damit das Journal schreibt: "Der Rat gibt Dir keine
   * Auftraege mehr." Idempotent; laeuft beim Setzen des Flags, beim
   * Abschluss des Bruchs und beim Laden.
   * @returns {string[]} die eben beendeten Auftraege
   */
  function _ratsAuftraegeBeenden() {
    if (!questFlags.enttarnt) return [];
    var beendet = [];
    Object.keys(QUEST_DEFINITIONS).forEach(function (id) {
      if (QUEST_DEFINITIONS[id].npcId !== 'aldric') return;
      var st = questState[id];
      if (!st || st.status === 'completed' || st.status === 'entfallen') return;
      questState[id] = { status: 'entfallen', objectives: null, warAngenommen: st.status === 'active' };
      delete _criteriaToasted[id];
      beendet.push(id);
    });
    if (beendet.length) console.log('[QuestSystem] Der Rat gibt keine Auftraege mehr, entfallen: ' + beendet.join(', '));
    return beendet;
  }

  /** Die Auftraege, die beim Bruch entfallen sind und die man angenommen hatte (Journal). */
  function getEntfalleneQuests() {
    return Object.keys(QUEST_DEFINITIONS).filter(function (id) {
      var st = questState[id];
      return st && st.status === 'entfallen' && st.warAngenommen;
    }).map(function (id) { return QUEST_DEFINITIONS[id]; });
  }

  // Ein laufender Auftrag, dessen Definition seit dem Speichern ein Ziel
  // DAZUBEKOMMEN hat (einfuehrung_talente: Loadout), bekommt es angehaengt —
  // sonst schloesse er mit dem alten Zielsatz ab und der neue Schritt fiele
  // still weg. Nur bei einer reinen Erweiterung: liegt im Stand ein Ziel, das
  // die Definition nicht mehr kennt (umbenannt), bleibt alles, wie es ist —
  // ein angehaengtes zweites Ziel neben einem toten machte es nicht besser.
  // Standhalten war bis b476 ein Wellenziel. Ein laufender Altstand bekommt
  // das Raumziel; war die Welle schon erreicht, bleibt er abgabebereit.
  function _standhaltenUmstellen(id) {
    var st = questState[id];
    if (id !== 'brett_welle' || !st || st.status !== 'active' || !Array.isArray(st.objectives)) return;
    var welle = st.objectives.filter(function (o) { return o && o.type === 'wave'; })[0];
    if (!welle) return;
    var fertig = welle.current >= welle.required;
    st.objectives = QUEST_DEFINITIONS.brett_welle.objectives.map(function (o) {
      return { type: o.type, target: o.target, current: fertig ? o.required : 0, required: o.required };
    });
  }

  /**
   * Die Nachteskorte belauschte frueher nur 'escort_route' im Konvoi-Lager.
   * Ein laufender alter Stand bekommt die drei Stationen der Umschlagstelle;
   * war die Route schon belauscht, gelten sie als erledigt (abgabebereit).
   */
  function _eskorteUmstellen(id) {
    var st = questState[id];
    if (id !== 'garde_night_escort' || !st || st.status !== 'active' || !Array.isArray(st.objectives)) return;
    var alt = st.objectives.filter(function (o) { return o && o.target === 'escort_route'; })[0];
    if (!alt) return;
    var fertig = (alt.current || 0) >= (alt.required || 1);
    st.objectives = QUEST_DEFINITIONS[id].objectives.map(function (o) {
      return { type: o.type, target: o.target, current: fertig ? o.required : 0, required: o.required };
    });
  }

  function _zieleNachziehen(id) {
    var def = QUEST_DEFINITIONS[id];
    var st = questState[id];
    if (!def || !st || st.status !== 'active' || !Array.isArray(st.objectives)) return;
    var gleich = function (a, b) { return a && b && a.type === b.type && a.target === b.target; };
    var erweiterung = st.objectives.every(function (o) {
      return def.objectives.some(function (d) { return gleich(o, d); });
    });
    if (!erweiterung) return;
    def.objectives.forEach(function (d) {
      if (st.objectives.some(function (o) { return gleich(o, d); })) return;
      st.objectives.push({ type: d.type, target: d.target, current: 0, required: d.required });
    });
  }

  // Migration: `advanceAct` feuert nur im Moment des Quest-Abschlusses. Saves,
  // die eine Advancer-Quest bereits abgeschlossen haben BEVOR sie ihr Feld
  // bekam, hängen sonst unter dem Akt fest, den die Folge-Quests verlangen —
  // die Kette bricht lautlos. Beim Laden den höchsten fälligen Akt nachziehen.
  // advanceToAct ist monoton (gleich/niedriger = no-op), also ist das gefahrlos.
  function _backfillAdvanceActs() {
    if (!window.storySystem || typeof window.storySystem.advanceToAct !== 'function') return;
    var due = -1;
    Object.keys(QUEST_DEFINITIONS).forEach(function (id) {
      var def = QUEST_DEFINITIONS[id];
      var st = questState[id];
      if (!st || st.status !== 'completed') return;
      // council_collusion_reveal advanciert hart auf 2 (siehe completeQuest).
      var target = (id === 'council_collusion_reveal') ? 2 : def.advanceAct;
      if (typeof target === 'number' && target > due) due = target;
    });
    if (due < 0) return;
    try {
      window.storySystem.advanceToAct(due);
    } catch (err) {
      console.warn('[QuestSystem] advanceAct backfill failed', err);
    }
  }

  // ---- HUD Update Notification ----
  var _updateListeners = [];

  function onQuestUpdate(fn) {
    _updateListeners.push(fn);
  }

  function offQuestUpdate(fn) {
    _updateListeners = _updateListeners.filter(function (f) { return f !== fn; });
  }

  function _notifyUpdate() {
    var active = getActiveQuests();
    _updateListeners.forEach(function (fn) {
      try { fn(active); } catch (e) { console.warn('[QuestSystem] listener error', e); }
    });
  }

  // ---- Quest Tracker HUD helpers ----

  function getTrackerText() {
    var active = getActiveQuests();
    if (!active.length) return '';
    var suffix = (window.i18n ? window.i18n.t('quest.tracker.short_suffix') : '..');
    var lines = [];
    active.forEach(function (q) {
      var fullTitle = getQuestField(q, 'title');
      var shortName = fullTitle.length > 16 ? fullTitle.substring(0, 14) + suffix : fullTitle;
      var hinweis = getAbgabeHinweis(q);
      if (hinweis) { lines.push(shortName + ': ' + hinweis); return; }
      q.objectives.forEach(function (obj) {
        if (window.i18n) {
          lines.push(window.i18n.t('quest.tracker.progress', {
            title: shortName, cur: obj.current, required: obj.required
          }));
        } else {
          lines.push(shortName + ': ' + obj.current + '/' + obj.required);
        }
      });
    });
    return lines.join('\n');
  }

  // ---- Export ----
  var questSystem = {
    QUEST_DEFINITIONS: QUEST_DEFINITIONS,
    getAvailableQuests: getAvailableQuests,
    getActiveQuests: getActiveQuests,
    getActiveQuestsAt: getActiveQuestsAt,
    istStoryAuftrag: istStoryAuftrag,
    getEntfalleneQuests: getEntfalleneQuests,
    abgabeNpc: abgabeNpc,
    getAbgabeHinweis: getAbgabeHinweis,
    getCompletedQuests: getCompletedQuests,
    acceptQuest: acceptQuest,
    updateQuestProgress: updateQuestProgress,
    tiefeErreicht: tiefeErreicht,
    angebotsTiefe: angebotsTiefe,
    onWaveCompleted: onWaveCompleted,
    onLaufEnde: onLaufEnde,
    onDungeonCompleted: onDungeonCompleted,
    onBossKilled: onBossKilled,
    // #131: Tiefensperre vor einem Story-Boss, dessen Quest noch nicht laeuft.
    onItemCrafted: onItemCrafted,
    onSystemUsed: onSystemUsed,
    SYSTEM_ZIELE: SYSTEM_ZIELE,
    areAllQuestChainsComplete: areAllQuestChainsComplete,
    isQuestReadyToComplete: isQuestReadyToComplete,
    completeQuest: completeQuest,
    // Lohn: skaliert, als Zeilen, und was ein Auftrag tatsaechlich brachte.
    LOHN_ANTEIL: LOHN_ANTEIL,
    lohnBerechnen: lohnBerechnen,
    getQuestLohn: getQuestLohn,
    lohnTeile: lohnTeile,
    getErhaltenerLohn: getErhaltenerLohn,
    getXpBonus: getXpBonus,
    ausstehendeAusliefern: _ausstehendeAusliefern,
    getAusstehend: function () { return _ausstehend.slice(); },
    setFlag: setFlag,
    hasFlag: hasFlag,
    getFlags: getFlags,
    getNachhallNamen: getNachhallNamen,
    setNachhallNamen: setNachhallNamen,
    STORY_VERSION: STORY_VERSION,
    getQuestSaveData: getQuestSaveData,
    loadQuestSaveData: loadQuestSaveData,
    onQuestUpdate: onQuestUpdate,
    offQuestUpdate: offQuestUpdate,
    getTrackerText: getTrackerText,
    getQuestField: getQuestField,
    getQuestTitle: function (q) { return getQuestField(q, 'title'); },
    getQuestDescription: function (q) { return getQuestField(q, 'description'); },
    getQuestDialogue: function (q, phase) {
      var key = 'dialogue' + phase[0].toUpperCase() + phase.slice(1);
      return getQuestField(q, key);
    },
    // i18n helper for reward strings: prefer rewards.infoKey lookup over the
    // hardcoded German rewards.info field.
    getRewardInfo: function (q) {
      if (!q || !q.rewards) return '';
      if (window.i18n && q.rewards.infoKey) {
        var v = window.i18n.t(q.rewards.infoKey);
        if (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) return v;
      }
      return q.rewards.info || '';
    },
    // i18n helper for reward item names + rarity labels (consumed by quest
    // dialog renderers + journal). Snaps onto whichever key the item carries.
    getRewardItemName: function (item) {
      if (!item) return '';
      if (window.i18n && item.nameKey) {
        var v = window.i18n.t(item.nameKey);
        if (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) return v;
      }
      return item.name || '';
    },
    getRewardRarityLabel: function (item) {
      if (!item) return '';
      if (window.i18n && item.rarityKey) {
        var v = window.i18n.t(item.rarityKey);
        if (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) return v;
      }
      return item.rarityLabel || '';
    }
  };

  // Re-render living quest tracker on language change.
  if (window.i18n) {
    window.i18n.onChange(function () {
      _notifyUpdate();
    });
  }

  window.questSystem = questSystem;
})();
