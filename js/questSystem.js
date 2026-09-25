// js/questSystem.js — Quest System for Demonfall

(function () {
  'use strict';

  // Story-Schema-Version (Feature 062, v4). Steht im Quest-Save-Blob. Beim Laden
  // eines Stands mit fehlender oder älterer Version wird der Story-/Quest-/Flag-
  // Teil verworfen und auf Akt 0 zurückgesetzt (Charakter-State liegt ausserhalb
  // und bleibt). Die v3-Struktur (andere Quest-IDs, entfernte final_truth) ist
  // nicht kompatibel -> sauberer Reset statt fragiler Teilmigration.
  const STORY_VERSION = 4;

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
      prerequisites: [],
      requiredAct: 0,
      // Auftakt-Seiten VOR dem eigentlichen Auftrag (nur beim ERSTEN Aldric-
      // Gespraech, siehe _showNpcDialogue: completedCount === 0). Etablieren
      // Aldric als kuehlen Rat-Aufseher, der den alten Dich kannte, und
      // schatten das Erinnerungs-Thema vor, ohne die Verschwoerung zu spoilern.
      dialogueIntro: [
        'Der Archivschmied. Man sagte mir, du seist wieder auf den Beinen.\n\nErinnerst du dich an mich? … Nein. Natürlich nicht.',
        'Wir kannten uns, du und ich. Du hast Akten gesiegelt, an die niemand mehr rühren sollte — ordentliche, verlässliche Arbeit.\n\nVon dieser Verlässlichkeit hätte ich gern wieder etwas.'
      ],
      dialogueOffer: 'Unten in den Kellern hat sich Ungeziefer eingenistet. Wilde Tiere, sagen die Wachen. Räum sie aus — zehn Stück, dann reden wir weiter.\n\nWillst du diese Aufgabe übernehmen?',
      dialogueProgress: 'Die Keller sind noch nicht sicher. Kämpfe weiter.',
      dialogueComplete: 'Gut. Die Keller sind gesäubert. Hier ist dein Lohn.'
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
    //
    // Wer sie liegen laesst, bekommt sie nicht nachgereicht: sie bleibt beim
    // NPC stehen und ist jederzeit abholbar.
    einfuehrung_schmiede: {
      id: 'einfuehrung_schmiede',
      title: 'Der erste Schliff',
      description: 'Werte in der Archivschmiede ein Ausrüstungsstück auf.',
      npcId: 'branka',
      type: 'system',
      chain: 1,
      objectives: [
        { type: 'system', target: 'upgrade', current: 0, required: 1 }
      ],
      rewards: { xp: 40, gold: 30 },
      prerequisites: ['aldric_cleanup'],
      requiredAct: 0,
      dialogueOffer: 'Du trägst das, was Du unten gefunden hast, und Du trägst es, wie man ein Werkzeug trägt, das einem fremd ist.\n\nBring mir irgendetwas davon. Ich zeig Dir, wie man es ausbaut — Gold, ein paar Eisenbrocken, und es wird Deins. Danach machst Du es allein.',
      dialogueProgress: 'Du hast es noch nicht gemacht. Leg ein Stück auf den Tisch und drück auf Ausbauen. Das Gold und die Brocken hast Du.',
      dialogueComplete: '(Sie dreht es einmal ins Licht.) Siehst Du. Dasselbe Stück, nur nicht mehr dasselbe.\n\nJedes Mal, wenn Du hochkommst, kommst Du hier vorbei. Nicht weil ich das sage, sondern weil Du sonst mit dem runtergehst, was letzte Woche gereicht hat.'
    },
    einfuehrung_presse: {
      id: 'einfuehrung_presse',
      title: 'Eine Zeile, die bleibt',
      description: 'Lass Setzer Thom ein Edikt drucken.',
      npcId: 'thom',
      type: 'system',
      chain: 1,
      objectives: [
        { type: 'system', target: 'edikt', current: 0, required: 1 }
      ],
      rewards: { xp: 40, gold: 30 },
      prerequisites: ['aldric_cleanup'],
      requiredAct: 0,
      dialogueOffer: 'Der Rat schreibt jede Woche vor, was die Stadt denken soll. Wir können dasselbe — kleiner, aber wir können es.\n\nDu hast Druckblätter dabei, ich sehe sie. Such Dir eine Zeile aus und lass sie mich setzen. Sie wirkt, solange sie hängt, und sie kostet Dich Aufmerksamkeit beim Rat. Beides sollst Du einmal gespürt haben, bevor es darauf ankommt.',
      dialogueProgress: 'Noch hängt nichts. Geh rein, such eine Zeile aus, ich setze sie.',
      dialogueComplete: '(Er wischt sich die Finger am Kittel ab.) Jetzt steht es an jeder Ecke, und irgendwer liest es laut vor.\n\nMerk Dir nur eins: Jede Zeile, die wir drucken, legt der Rat auf seine Waage. Druck nicht mehr, als Du unten wieder gutmachen kannst.'
    },
    einfuehrung_markt: {
      id: 'einfuehrung_markt',
      title: 'Was unter dem Tisch liegt',
      description: 'Kauf Mara auf dem Schwarzmarkt etwas ab (ab Tiefe 4).',
      npcId: 'mara',
      type: 'system',
      chain: 1,
      minDepth: 4,
      objectives: [
        { type: 'system', target: 'markt', current: 0, required: 1 }
      ],
      rewards: { xp: 40, gold: 30 },
      prerequisites: ['aldric_cleanup'],
      requiredAct: 0,
      dialogueOffer: 'Du schleppst Gold herum, als wüsstest Du nicht, wofür. Ich schon.\n\nAb Tiefe 4 habe ich einen Stand — nicht hier oben, frag nicht wo. Nimm irgendetwas, das Billigste reicht. Danach weisst Du, dass es ihn gibt, und das ist der ganze Punkt.',
      dialogueProgress: 'Ab Tiefe 4. Nimm irgendetwas. Ich schreibe nicht auf, was.',
      dialogueComplete: '(Sie zählt das Gold nicht nach.) Gut. Und jetzt vergiss, dass ich Dir das gezeigt habe.\n\nDer Stand wechselt seinen Platz, aber er ist jeden Lauf irgendwo. Wer mit vollen Taschen hochkommt und sie wieder mit runternimmt, hat etwas nicht verstanden.'
    },
    einfuehrung_talente: {
      id: 'einfuehrung_talente',
      title: 'Wofür du taugst',
      description: 'Setz einen Punkt im Talentbaum.',
      npcId: 'aldric',
      type: 'system',
      chain: 1,
      objectives: [
        { type: 'system', target: 'talent', current: 0, required: 1 }
      ],
      rewards: { xp: 40, gold: 30 },
      prerequisites: ['aldric_cleanup'],
      requiredAct: 0,
      dialogueOffer: 'Der Rat führt über jeden Bürger eine Akte, und in Deiner steht ein Wort, das mich stört: unbestimmt.\n\nDas lässt sich ändern. Du sammelst unten Erfahrung, und Erfahrung wird zu Punkten. Setz einen. Wut, Ketten oder Schatten — such es Dir aus. Der Rat schätzt Leute, die sich festlegen.',
      dialogueProgress: 'Noch immer unbestimmt. Öffne den Baum und setz einen Punkt. Welchen, ist Deine Sache.',
      dialogueComplete: '(Er notiert etwas, ohne aufzusehen.) Festgelegt. Gut.\n\nDie Akte wird Dich überleben, Archivschmied. Das ist keine Drohung, das ist Verwaltung.'
    },
    // Der Wissensbaum bei Branka: ihre erste Zeile im Hub macht die Begruendung
    // schon selbst — "Erst wenn jede Klinge Wissen traegt, faellt ihre Maske".
    // Voraussetzung ist Harrens Auftrag, weil der ein Fragment auszahlt: ohne
    // eines liesse sich der Auftrag nicht erfuellen, und genau das soll eine
    // Einfuehrung nie sein.
    einfuehrung_wissen: {
      id: 'einfuehrung_wissen',
      title: 'Was die Mauern wissen',
      description: 'Verbau ein Erinnerungsfragment im Wissensbaum.',
      npcId: 'branka',
      type: 'system',
      chain: 2,
      objectives: [
        { type: 'system', target: 'wissen', current: 0, required: 1 }
      ],
      rewards: { xp: 40, gold: 30 },
      prerequisites: ['einfuehrung_schmiede', 'harren_daughter_investigation'],
      // requiredAct 0, obwohl sie fruehestens in Akt 1 auftaucht: die
      // Voraussetzung oeffnet den Akt selbst, und der Akt-1-Bestand soll eine
      // Aussage ueber die GESCHICHTE bleiben, nicht ueber Einfuehrungen.
      requiredAct: 0,
      dialogueOffer: 'Stahl allein schneidet die Lügen des Rates nicht. Das sage ich jedem, und jeder nickt und versteht es nicht.\n\nDu trägst ein Fragment bei Dir. Ein Stück von etwas, das jemand aufgeschrieben und der Rat verbrannt hat. Verbau es — nicht in einer Klinge, in Dir. Dann weisst Du, was ich meine.',
      dialogueProgress: 'Das Fragment liegt noch bei Dir herum. Öffne den Baum und setz es ein. Es wird nicht mehr wert, wenn Du wartest.',
      dialogueComplete: '(Sie sieht Dich einen Moment zu lange an.) Und? Nichts blitzt, nichts klingelt. So ist Wissen.\n\nJedes Fragment, das Du unten findest, gehört da hinein. Der Rat sammelt sie auch — nur verbrennt er sie.'
    },
    // Die Amulette fuehrt NUR der wandernde Haendler unten (ShopScene mit
    // _dungeonMerchant); Maras Stand hat sie nicht. Darum schickt sie einen
    // hinunter, statt selbst zu verkaufen. Keine Mindesttiefe: der Haendler
    // ist ein Ereignis, kein Versprechen — ihr eigener Stand (Tiefe 4) haengt
    // als Voraussetzung ohnehin davor.
    einfuehrung_amulett: {
      id: 'einfuehrung_amulett',
      title: 'Der Alte mit dem Karren',
      description: 'Kauf dem wandernden Händler in der Tiefe ein Amulett ab.',
      npcId: 'mara',
      type: 'system',
      chain: 2,
      objectives: [
        { type: 'system', target: 'amulett', current: 0, required: 1 }
      ],
      rewards: { xp: 40, gold: 30 },
      prerequisites: ['einfuehrung_markt'],
      requiredAct: 0,
      dialogueOffer: 'Da unten läuft ein Alter mit einem Karren herum. Frag mich nicht, wie er hineinkommt — ich weiss es nicht, und ich will es nicht wissen.\n\nEr führt Amulette. Ich fasse die Dinger nicht an, aber Du solltest eines getragen haben, bevor Du entscheidest, ob Du sie magst. Sie ändern einen ganzen Lauf, nicht nur eine Zahl.',
      dialogueProgress: 'Der Alte taucht auf, wenn er will. Lauf weiter runter, dann triffst Du ihn. Und nimm genug Gold mit — billig ist er nicht.',
      dialogueComplete: '(Sie betrachtet es aus sicherem Abstand.) Du hast es also wirklich getan.\n\nBehalt es im Auge. Was ein Amulett Dir gibt, gilt nur für diesen einen Lauf — und was es Dir nimmt, merkst Du meistens später.'
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
      prerequisites: ['harren_daughter_investigation'],
      requiredAct: 1,
      dialogueOffer: 'Du hast das Fragment gesehen. Gut. Dann weisst du auch, dass die Tochter neu klassifiziert werden muss — von "geflohen" zu "vermisste Person von Interesse". Eine reine Verwaltungsangelegenheit, verstehst du. Akten müssen ordnungsgemäss geführt werden.\n\nDas ratsgesiegelte Verifikationsdokument liegt in der versunkenen Registratur — dort unten, wo der Nebel die alten Akten verschluckt hat. Steig hinab, birg das Ratssiegel und bring es mir. Was dir dabei begegnet, ist nicht mein Ressort. Der Magistrat trägt die Verantwortung, nicht der Bürger.\n\nNimmst du den Auftrag an?',
      dialogueProgress: 'Das Ratssiegel liegt noch da unten in der versunkenen Registratur. Steig weiter hinab und birg es. Ohne das Dokument ist die Neuklassifizierung nicht rechtskräftig.',
      dialogueComplete: 'Hervorragend. Das Dokument ist im Archiv. Die Tochter ist nun offiziell eine Person von Interesse. Was das in der Praxis bedeutet, geht dich nichts an. Der Magistrat dankt dir.'
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
      prerequisites: ['harren_daughter_investigation'],
      requiredAct: 1,
      dialogueOffer: 'Du hast das Fragment gesehen, Archivschmied. Dann weisst du, dass die Tochter nicht aus eigenem Willen geflohen ist. Sie wurde von einer dunklen Hand geführt — die untere Kammern bersten vor solchen Schatten.\n\nReinige sie. Drei der Anführer dieser ketzerischen Präsenz lauern noch dort unten, tiefer als die ersten Gänge — steige bis Tiefe 3 hinab. Fälle sie im Namen der Ordnung. Die Seele der Tochter wird es dir danken — wenn das Licht sie wiederfindet.\n\nDie Reinigung ist eine geistliche Pflicht. Nimm sie an.',
      dialogueProgress: 'Die Anführer lauern tief — erst ab Tiefe 3. Steige hinab, finde sie, fälle sie. Jede Ketzerei, die du beendest, öffnet einen weiteren Pfad zur Reinheit.',
      dialogueComplete: 'Du hast die Ketzerei geschlagen. Die untere Kammern atmen wieder. Die Ordnung bleibt — durch dich. Der Klerus segnet deine Hand. Bring sie weiter dorthin, wo das Licht es verlangt.'
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
      npcId: 'elara',
      type: 'fetch',
      chain: 2,
      // 'council_document' target wired in js/loot.js as a quest-item drop
      // (10% chance per enemy kill while the quest is active).
      objectives: [
        { type: 'fetch', target: 'council_document', current: 0, required: 1 }
      ],
      rewards: { xp: 100, fragments: 1 },
      prerequisites: ['harren_daughter_investigation'],
      requiredAct: 1,
      dialogueOffer: 'Du hast also das Fragment gefunden. Gut — dann lebst du nicht mehr ganz in ihrer Erzählung.\n\nIch will, dass DU siehst, was ich gesehen habe, bevor du weiter ihre Aufträge erledigst. Unten im Rathauskeller liegt ein Dokument, das die drei Ratsfraktionen nie zusammen unterzeichnet haben sollten — und doch ist ihr Siegel darauf. Alle drei.\n\nBring es mir. Dann reden wir.',
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
      dialogueComplete: 'Jetzt hast du es gesehen. Ein Gesicht, drei Masken. Du hast für jede gearbeitet. Du könntest fliehen — aber ein Handwerker, der weiter im Rathaus aus und ein geht, sieht Dinge, die ein Flüchtiger nie sieht. Bleib, wo du bist. Räum weiter für sie, und räum heimlich für uns. Es ist gefährlicher. Es ist auch das Einzige, was nützt.'
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
      prerequisites: [],
      requiredAct: 2,
      dialogueOffer: 'Du erinnerst dich nicht an mich. Aber ich an dich — du warst Archivschmied, bevor der Nebel dir die Erinnerung nahm, und du hast Fragen gestellt, die der Rat begraben wollte.\n\nIch bin die Späherin des Widerstands. Bevor ich dir mein Netzwerk öffne, will ich sehen, ob du noch sehen kannst: Geh hinab und kundschafte drei Kellerräume aus. Präg dir ein, was der Rat dort versteckt.',
      dialogueProgress: 'Noch nicht genug gesehen. Drei Räume — und präg dir jeden ein.',
      dialogueComplete: 'Drei Räume, in jedem dasselbe: leere Zellen, frische Ketten, Listen mit Namen. Die Vermissten verschwinden nicht zufällig — der Rat lässt sie verschwinden, und jede Fraktion deckt die andere.\n\nJetzt weiss ich, dass du noch der Alte bist. Mein Netzwerk steht dir offen — es gibt Arbeit, die nur jemand erledigen kann, an den sich niemand erinnert. Wie dich.'
    },
    elara_meeting: {
      id: 'elara_meeting',
      title: 'Elaras Geheimnis',
      description: 'Finde 2 geheime Dokumente, die Elara versteckt hat.',
      npcId: 'elara',
      type: 'fetch',
      chain: 1,
      objectives: [
        { type: 'fetch', target: 'document', current: 0, required: 2 }
      ],
      rewards: { xp: 100, unlocks: ['elara_trust'] },
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
      // Feature 062: Backbone-Default der Gesuche-Wahl. Die Szenen-Wahl
      // (kept/surrendered) folgt mit dem Inszenierungs-Feature.
      completionFlags: ['petitions_surrendered'],
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
      description: 'Aldric schickt dich, eine "verseuchte" Kammer zu reinigen. Dring bis zu ihr vor.',
      npcId: 'aldric',
      type: 'explore',
      chain: 4,
      objectives: [
        { type: 'explore', target: 'room', current: 0, required: 2 }
      ],
      rewards: { xp: 120, fragments: 1 },
      prerequisites: ['council_surveillance'],
      requiredAct: 3,
      dialogueOffer: 'Eine untere Kammer ist verseucht — Ketzerei. Reinige sie. Frag nicht, was du findest.\n\nGeh.',
      dialogueProgress: 'Die Kammer liegt tiefer. Dring weiter vor.',
      dialogueComplete: 'Du stehst in der Kammer. Blut, Symbole, Ketten — und kein Ketzer weit und breit. Das ist keine Verseuchung. Das ist eine Beschwörungskammer. Aldric hat dich hergeschickt, um seine eigene Spur zu verwischen. (Du prägst dir jedes Symbol ein. Mara soll das sehen. Und Aldric soll glauben, du hättest nur geputzt.)'
    },
    bruch_confrontation: {
      id: 'bruch_confrontation',
      title: 'Der Bruch',
      description: 'Aldric hat Wachen auf dich gehetzt. Schlag dich zu Branka durch — besiege 3 Elite-Wachen. Sie stellen dich erst in der Tiefe (ab Tiefe 8).',
      npcId: 'branka',
      type: 'kill',
      chain: 5,
      minDepth: 8,
      objectives: [
        { type: 'kill', target: 'elite_enemy', current: 0, required: 3 }
      ],
      rewards: { xp: 200 },
      // Feature 062: der Bruch (Enttarnung) triggert jetzt Akt 4. Vorbedingungen:
      // die verseuchte Kammer gesehen UND Elaras zweite Wahrheit erfahren.
      prerequisites: ['verseuchte_kammer', 'elara_second_truth'],
      requiredAct: 3,
      advanceAct: 4,
      dialogueOffer: 'Aldric weiss es. Dein Doppelspiel ist aufgeflogen, seine Elite-Wachen riegeln die tiefen Gänge ab, ab Tiefe 8 stellst du sie. Schlag dich durch und komm zu mir.',
      dialogueProgress: 'Aldrics Elite-Wachen halten die Tiefe. Ab Tiefe 8 stellst du sie.',
      dialogueComplete: 'Du stellst zu viele Fragen, hat er gesagt. Jetzt stellst du gar keine mehr, du weisst es. Die Tarnung ist verbrannt, der Bruch ist da. Mara, Thom, ich, wir sind bereit.'
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
      description: 'Beschatte verkleidet einen Council-Konvoi im Lagerhaus und höre ihn ab.',
      npcId: 'mara',
      type: 'observe',
      chain: 6,
      objectives: [
        { type: 'observe', target: 'convoy_intel', current: 0, required: 1 }
      ],
      rewards: { xp: 90, druckblaetter: 2 },
      prerequisites: ['mara_contact'],
      requiredAct: 2,
      dialogueOffer: 'Heute Nacht entladen sie im alten Lagerhaus einen Konvoi des Rats. Zieh die Wachuniform an, bleib im Schatten und hör zu — aber zieh keine Klinge, sonst fliegt die Verkleidung auf.\n\nUebernimmst du das?',
      dialogueProgress: 'Du bist noch nicht nah genug. Misch dich unter die Wachen am Konvoi und hör ab, was verladen wird — unentdeckt.',
      dialogueComplete: 'Du hast es gehört. Keine Vorräte, keine Waffen. Reagenzien, versiegelte Phiolen, Kreidesteine — Ritual-Komponenten. Der Rat schickt keine Patrouille los. Er rüstet eine Beschwörung aus.'
    },
    espionage_archive: {
      id: 'espionage_archive',
      title: 'Das versiegelte Archiv',
      description: 'Infiltriere verkleidet das Council-Archiv (ab Tiefe 12), höre die Schreiber ab und birg den versiegelten Akt.',
      npcId: 'harren',
      type: 'observe',
      chain: 7,
      // #72: gestaffelt, damit Akt 3 nicht in einem Lauf erledigt ist.
      minDepth: 12,
      objectives: [
        { type: 'observe', target: 'archive_record', current: 0, required: 1 }
      ],
      rewards: { xp: 110, fragments: 1 },
      prerequisites: ['espionage_convoy'],
      requiredAct: 3,
      dialogueOffer: 'Im Archiv des Rats liegt ein versiegelter Akt — und ich muss wissen, was darin steht. Das Archiv liegt tief unter dem Rathaus, ab Tiefe 12. Geh als Schreiber verkleidet hinein, hör ab, was die anderen flüstern, und birg den Akt. Werde nicht gesehen.\n\nTust du das für mich?',
      dialogueProgress: 'Das Archiv liegt ab Tiefe 12. Die Schreiber haben noch nichts Verwertbares gesagt. Bleib im Archiv, unauffällig, und hör weiter ab, bis du an den versiegelten Akt kommst.',
      dialogueComplete: 'Du hast den Akt. "Vermisst, Fall geschlossen" — das Verschwinden seiner Tochter, sauber abgelegt, Datum, Siegel, Unterschrift. Und das Datum liegt vor dem Tag, an dem sie verschwand.\n\n(Harren liest es zweimal.) Sie haben es geplant. Jemand im Rat hat Lenes Verschwinden abgeheftet, bevor es geschah.'
    },
    espionage_informant: {
      id: 'espionage_informant',
      title: 'Der Maulwurf',
      description: 'Enttarne verkleidet einen Council-Maulwurf in den Reihen des Widerstands (ab Tiefe 23).',
      npcId: 'mara',
      type: 'observe',
      chain: 8,
      // #72: gestaffelt, damit Akt 4 nicht in einem Lauf erledigt ist.
      minDepth: 23,
      objectives: [
        { type: 'observe', target: 'informant_id', current: 0, required: 1 }
      ],
      rewards: { xp: 120, fragments: 1 },
      // Feature 062: setzt mole_evidence (Regler 3 im Finale). observe informant_id
      // von WP05 (espionageSystem) verdrahtet.
      completionFlags: ['mole_evidence'],
      // #155: Nach dem Bruch (Story-Bibel v5): erst die Nacht, in der Elara Dich
      // versteckt, dann die Spur zu ihr. Vorher konnte der Maulwurf VOR dem
      // Bruch fallen, und der Verrat kam vor dem tiefsten Vertrauen.
      prerequisites: ['espionage_archive', 'bruch_confrontation'],
      requiredAct: 4,
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
      prerequisites: [],
      requiredAct: 0,
      dialogueOffer: 'Es gibt da etwas im Keller... ein Bündel, versiegelt. Bring es mir, ohne dass jemand es sieht. Und öffne es nicht.\n\nNimmst du den Auftrag an?',
      dialogueProgress: 'Das Bündel liegt irgendwo da unten. Sieh dich um — und lass es zu.',
      dialogueComplete: 'Du hast es. Und du hast es nicht geöffnet. Gut.\n\n(Auf dem Wachs des Siegels: drei Ketten, ineinander verschlungen. Du hast dieses Zeichen noch nie gesehen.)'
    },

    elara_ritual: {
      id: 'elara_ritual',
      title: 'Die Ritualkammer',
      description: 'Steige auf Tiefe 20 hinab und besiege den Zeremonienmeister, der die Ritualkammer des Rats hält.',
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
      rewards: { xp: 150, items: [{ type: 'accessory', key: 'RITUAL_AMULETT', name: 'Ritualamulett', nameKey: 'quest.reward.RITUAL_AMULETT', iconKey: 'itAccessory', rarity: 'epic', rarityLabel: 'Episch', rarityKey: 'quest.rarity.epic', rarityValue: 3, itemLevel: 12, damage: 0, speed: 0, range: 0, armor: 5, crit: 0.05, hp: 20 }] },
      prerequisites: ['elara_meeting'],
      requiredAct: 3,
      dialogueOffer: 'Tief unten ist eine Kammer — die Beschwörungskammer des Rats. Sie wird vom Zeremonienmeister gehalten, dem Meister der verbotenen Rituale. Steig auf Tiefe 20 hinab und fälle ihn.\n\nBist du bereit für die Wahrheit?',
      dialogueProgress: 'Der Zeremonienmeister hält die Kammer noch. Du findest ihn auf Tiefe 20 — solange er lebt, kommst du nicht an die Wahrheit.',
      dialogueComplete: 'Der Zeremonienmeister ist gefallen. Du hast sie gefunden — die Beschwörungskammer des Rats. Nimm dieses Amulett; es schützt vor ihrer dunklen Magie.'
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
      prerequisites: [],
      requiredAct: 3,
      dialogueOffer: 'Ich habe genug gedruckt, was der Rat will. Zeit für die Wahrheit.\n\nFinde fünf Druckplatten, tief im Keller, ab Tiefe 14 — sie enthalten die echte Geschichte.',
      dialogueProgress: 'Die Druckplatten liegen tief im Rathauskeller, ab Tiefe 14. Suche weiter.',
      dialogueComplete: 'Fantastisch! Diese Platten enthalten Beweise, die der Rat vernichten wollte. Die Wahrheit geht in Druck.'
    },
    mara_warning: {
      id: 'mara_warning',
      title: 'Maras Warnung',
      description: 'Besiege den Kettenmeister-Boss, der die ersten echten Beweise bewacht.',
      npcId: 'mara',
      type: 'boss',
      chain: 2,
      objectives: [
        { type: 'boss_kill', target: 'kettenmeister', current: 0, required: 1 }
      ],
      rewards: { xp: 200 },
      // Feature 062: Spionage zuerst, damit die Doppelphase atmet. Der Fall des
      // Kettenmeisters (Tiefe 10) sichert die ersten harten Beweise.
      prerequisites: ['mara_contact', 'espionage_convoy'],
      requiredAct: 2,
      // Trigger -> Akt 3 (Die Enttarnung).
      advanceAct: 3,
      dialogueOffer: 'Der Kettenmeister hält die Siegel auf Tiefe 10. Er fesselt, was er fangen will. Fäll ihn, dann haben wir den ersten harten Beweis.',
      dialogueProgress: 'Der Kettenmeister lebt noch, auf Tiefe 10. Wenn er dich kettet, schlag die Kette, sonst hält er dich.',
      dialogueComplete: 'Der Kettenmeister ist gefallen, die Beweise gesichert. Jetzt kann niemand mehr leugnen, dass der Rat Menschen verarbeitet.'
    },

    // =======================================================
    // === Act 5: Der Bruch ===
    // =======================================================
    branka_weapons: {
      id: 'branka_weapons',
      title: 'Waffen für den Widerstand',
      description: 'Stelle 3 Gegenstände in der Archivschmiede her.',
      npcId: 'branka',
      type: 'craft',
      chain: 3,
      objectives: [
        { type: 'craft', target: 'craft_item', current: 0, required: 3 }
      ],
      rewards: { xp: 150 },
      prerequisites: ['branka_doubt'],
      requiredAct: 4,
      dialogueOffer: 'Wir brauchen Waffen. Nicht für den Rat — für UNS.\n\nStelle drei Gegenstände in der Schmiede her.',
      dialogueProgress: 'Die Schmiede wartet. Stelle weitere Gegenstände her.',
      dialogueComplete: 'Gut geschmiedet. Diese Waffen werden den Unterschied machen.'
    },
    thom_pamphlets: {
      id: 'thom_pamphlets',
      title: 'Die Pamphlete',
      description: 'Schliesse 3 tiefe Dungeon-Durchläufe ab (ab Tiefe 22), um Flugblätter bis in die untersten Gänge zu verteilen.',
      npcId: 'thom',
      type: 'dungeon_runs',
      chain: 2,
      minDepth: 22,
      objectives: [
        { type: 'dungeon_run', target: 'dungeon_complete', current: 0, required: 3 }
      ],
      rewards: { xp: 200, unlocks: ['xp_bonus_10'] },
      prerequisites: ['thom_truth'],
      requiredAct: 4,
      dialogueOffer: 'Die oberen Gänge lesen unsere Wahrheit schon. Jetzt brauchen wir die Tiefe — dort, wo der Rat seine Geheimnisse hält.\n\nSchliesse drei Durchläufe ab Tiefe 22 ab, und ganz Fogreach wird die Wahrheit lesen.',
      dialogueProgress: 'Nur tiefe Durchläufe zählen — ab Tiefe 22. Schliess drei davon ab; jeder verbreitet unsere Botschaft in die untersten Gänge.',
      dialogueComplete: 'Die ganze Stadt liest unsere Wahrheiten! Die Bürger sind aufgewacht. Deine Erfahrung wächst nun schneller. (+10% XP)'
    },
    elara_blade: {
      id: 'elara_blade',
      title: 'Elaras Geschenk',
      description: 'Elara hat eine besondere Waffe für dich geschmiedet.',
      npcId: 'elara',
      type: 'dialogue',
      chain: 3,
      elaraGift: true,
      objectives: [
        { type: 'dialogue', target: 'elara_gift', current: 0, required: 1 }
      ],
      rewards: { xp: 0, items: [{ type: 'weapon', key: 'ELARAS_KLINGE', name: 'Elaras Klinge', nameKey: 'quest.reward.ELARAS_KLINGE', iconKey: 'itSword', rarity: 'legendary', rarityLabel: 'Legendär', rarityKey: 'quest.rarity.legendary', rarityValue: 4, itemLevel: 15, damage: 7, speed: 1.3, range: 120, armor: 0, crit: 0.15, hp: 0, elaraGift: true }] },
      prerequisites: ['elara_ritual'],
      requiredAct: 3,
      dialogueOffer: 'Nimm das. Ich habe es für dich geschmiedet. Für den Fall, dass...\n\nNimm Elaras Klinge an?',
      dialogueProgress: 'Die Klinge wartet auf dich.',
      dialogueComplete: 'Möge sie dich beschützen. Egal was kommt.'
    },

    // =======================================================
    // === Act 6: Rebellion ===
    // =======================================================
    mara_assault: {
      id: 'mara_assault',
      title: 'Die letzte Wache',
      description: 'Dring bis Welle 30 vor und zerschlag, was von der Kettenwache übrig ist.',
      npcId: 'mara',
      type: 'wave',
      chain: 3,
      objectives: [
        { type: 'wave', target: 'reach_wave', current: 0, required: 30 }
      ],
      rewards: { xp: 300 },
      prerequisites: ['schattenrat_finale'],
      requiredAct: 4,
      dialogueOffer: 'Aldric ist unter der Stadt verschwunden, mit dem Rest seiner Kettenwache. Solange sie da unten sind, schlafen die Gassen nicht. Dring bis Welle 30 vor und räum auf.\n\nBist du dabei?',
      dialogueProgress: 'Die Kettenwache hält sich noch in der Tiefe. Dring weiter vor — Welle 30.',
      dialogueComplete: 'Die Kettenwache ist zerschlagen. Die Gänge unter der Stadt gehören wieder niemandem. Das ist mehr, als diese Stadt lange hatte.'
    },
    // Feature 062: umbenannt von 'harren_rescue'. Akt 4, die Quelle selbst.
    schattenrat_finale: {
      id: 'schattenrat_finale',
      title: 'Die Quelle',
      description: 'Steige auf Tiefe 30 hinab, zur Quelle des Nebels. Elara ist schon dort.',
      npcId: 'harren',
      type: 'boss',
      chain: 2,
      objectives: [
        { type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }
      ],
      rewards: { xp: 250 },
      prerequisites: [],
      requiredAct: 4,
      // #157: Nicht mehr der Schattenrat — Elara ist zur Quelle hinabgestiegen.
      dialogueOffer: 'Elara ist hinabgestiegen. Zur Quelle, auf Tiefe 30. Ich weiss jetzt, was sie ist, Archivschmied. Sie ist trotzdem meine Tochter. Geh. Ich komme nach.',
      dialogueProgress: 'Die Quelle liegt auf Tiefe 30. Beeil Dich.',
      dialogueComplete: 'Die Quelle ist zerbrochen. Jetzt gehört die Presse Dir. Geh zu Thom, es ist Zeit.'
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
      description: 'Ein Rats-Aushang: besiege 3 Elite-Gegner ab Tiefe 6.',
      npcId: 'anschlagtafel',
      type: 'kill',
      chain: 2,
      minDepth: 6,
      repeatable: true,
      objectives: [
        { type: 'kill', target: 'elite_enemy', current: 0, required: 3 }
      ],
      rewards: { xp: 90, gold: 200 },
      prerequisites: [],
      requiredAct: 0,
      gate: function () { return window.Anschlagtafel && window.Anschlagtafel.haengt('brett_anfuehrer'); },
      dialogueOffer: 'GARDE: Drei Anführer, ab Tiefe 6. Wer zahlt, fragt nicht, wer sie waren.\n\n(Der Aushang ist frisch. Der darunter, halb verdeckt, sucht eine vermisste Näherin.)',
      dialogueProgress: 'Drei Anführer, ab Tiefe 6. Der Aushang wartet.',
      dialogueComplete: 'Die Garde zahlt bar und sofort. Den Aushang nimmt niemand ab; er hängt am nächsten Morgen wieder da.'
    },
    brett_aufruf: {
      id: 'brett_aufruf',
      title: 'Aufruf der Druckerei',
      description: 'Ein Aufruf des Widerstands: räume 5 Kammern ab Tiefe 10.',
      npcId: 'anschlagtafel',
      type: 'explore',
      chain: 3,
      minDepth: 10,
      repeatable: true,
      objectives: [
        { type: 'explore', target: 'room', current: 0, required: 5 }
      ],
      rewards: { xp: 120, gold: 150, druckblaetter: 4 },
      prerequisites: [],
      requiredAct: 0,
      gate: function () { return window.Anschlagtafel && window.Anschlagtafel.haengt('brett_aufruf'); },
      dialogueOffer: 'Über den zerfetzten Rats-Plakaten klebt ein frisch gedrucktes Blatt:\n\n"Wer unten aufräumt, macht Platz für die Wahrheit. Fünf Kammern, ab Tiefe 10. Papier gibt es bei Thom."',
      dialogueProgress: 'Fünf Kammern ab Tiefe 10. Das Blatt hängt noch, jemand hat es festgenagelt.',
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
      prerequisites: [],
      requiredAct: 4,
      dialogueOffer: 'Die zwei Händler vor meiner Werkstatt streiten seit Tagen, wessen Waage lügt. Jeden Morgen, laut, vor meiner Tür. Das alte Eichgewicht der Zunft liegt irgendwo unten, ab Tiefe 26, seit die Zunft sich aufgelöst hat. Bring es mir, und ich mache dem ein Ende. Bitte.',
      dialogueProgress: 'Ein Messingzylinder mit dem Zunftstempel. Ab Tiefe 26. Und beeil Dich, sie haben heute schon zweimal angefangen.',
      dialogueComplete: 'Das ist es. (Sie legt es auf beide Waagen.) Beide falsch. Um genau dasselbe. (Sie seufzt.) Jetzt streiten sie darüber, wer es zuerst gesagt hat. Aber leiser. Danke.'
    },
    klerus_district_purge: {
      id: 'klerus_district_purge',
      title: 'Reinigung eines Bezirks',
      description: 'Reinige einen "befallenen" Bezirk — besiege 8 Gegner und bring die Namen.',
      npcId: 'klerus_priester',
      type: 'kill',
      chain: 3,
      objectives: [
        { type: 'kill', target: 'enemy', current: 0, required: 8 }
      ],
      rewards: { xp: 70 },
      prerequisites: [],
      requiredAct: 2,
      dialogueOffer: 'Ein Bezirk ist befallen. Reinige ihn. Wer das Licht scheut, hat etwas zu verbergen. Bring mir die Namen der Befallenen.',
      dialogueProgress: 'Noch nicht gereinigt. Die Befallenen zeigen sich in der Tiefe.',
      dialogueComplete: 'Du bringst die Namen. (Die Befallenen hatten Gesichter. Keins davon kanntest Du, und doch kam Dir jedes bekannt vor.) (Eine Abschrift steckt schon bei Mara, bevor der Rat die Liste sieht. Wer draufsteht, verschwindet. Aber vielleicht nicht mehr alle. Vielleicht warnt jemand rechtzeitig.)'
    },
    garde_night_escort: {
      id: 'garde_night_escort',
      title: 'Nachteskorte',
      description: 'Sichere verdeckt einen nächtlichen Transport — beobachte die Eskorten-Route (ab Tiefe 16).',
      npcId: 'stadtwache',
      type: 'observe',
      chain: 3,
      // #72: gestaffelt.
      minDepth: 16,
      // 'escort_route' als Spionage-Zone von WP05 (espionageSystem.js) verdrahtet.
      objectives: [
        { type: 'observe', target: 'escort_route', current: 0, required: 1 }
      ],
      rewards: { xp: 90 },
      prerequisites: [],
      requiredAct: 3,
      dialogueOffer: 'Heute Nacht geht ein Transport. Die Route führt tief hinab, ab Tiefe 16. Sicher sie, frag nicht, was drin ist. Loyalität zahlt sich aus.',
      dialogueProgress: 'Der Transport rollt erst ab Tiefe 16. Halt die Route im Auge, bleib unauffällig.',
      dialogueComplete: 'Die Route ist sicher. (Und in deinem Kopf, Weg, Zeit und Fracht, bereit für Mara. Es waren keine Waffen. Es waren dieselben Phiolen wie im Konvoi.)'
    },
    who_you_were: {
      id: 'who_you_were',
      title: 'Wer du warst',
      description: 'Bring Branka drei Splitter deiner alten Akte aus der Tiefe (ab Tiefe 17).',
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
      // Regler 4 im Finale (self_remembered).
      completionFlags: ['self_remembered'],
      prerequisites: ['branka_doubt'],
      requiredAct: 3,
      dialogueOffer: 'Ich habe etwas gefunden, das dich betrifft. Eine Akte mit deinem Zeichen, halb vom Nebel gefressen. Bring mir drei Splitter davon aus der Tiefe, dann setzen wir zusammen, wer du warst.',
      dialogueProgress: 'Die Splitter liegen tief — ab Tiefe 17. Such weiter.',
      dialogueComplete: 'Da bist du. Vor dem Unfall, vor dem Nebel. Du hast nicht immer nur aufgeräumt. Du hast einmal dieselben Fragen gestellt, die du jetzt wieder stellst. Der Nebel hat dich nicht zufällig getroffen. Man hat ihn nach dir geschickt.'
    },
    elara_second_truth: {
      id: 'elara_second_truth',
      title: 'Elaras zweite Wahrheit',
      description: 'Elara zeigt dir, für wen du das Letzte tust.',
      npcId: 'elara',
      type: 'dialogue',
      chain: 4,
      // Teil-Reveal, KEIN advanceAct (der Bruch triggert den Aktwechsel). Objective
      // 'dialogue' (Auto-Complete): die inszenierte Szene folgt später.
      objectives: [
        { type: 'observe', target: 'erster_riss_gesehen', current: 0, required: 1 }
      ],
      rewards: { xp: 200, fragments: 2 },
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
      description: 'Die Quelle ist zerbrochen. Thom wartet an der Presse. Die Stadt soll alles erfahren.',
      npcId: 'thom',
      type: 'dialogue',
      chain: 6,
      objectives: [
        { type: 'dialogue', target: 'press_decision', current: 0, required: 1 }
      ],
      rewards: { xp: 500, unlocks: ['story_ending'] },
      // `unlocks` landet in window._questUnlocks, die Hub-Phase liest aber die
      // Flags (hubPhase.js -> getFlags()). Ohne diesen Zwilling bleibt der Hub
      // nach dem Story-Ende dauerhaft in Phase 'broken' und der gesamte
      // Epilog-Zustand aus Feature 064 ist unerreichbar (#100). Gleiches
      // Doppel-Muster wie bei elara_meeting (elara_trust).
      completionFlags: ['story_ending'],
      prerequisites: ['schattenrat_finale'],
      requiredAct: 4,
      dialogueOffer: 'Die Platten liegen. Alles, was Du gesehen hast, kommt drauf: der Rat, Aldric, der Widerstand, sie. Morgen liest es die ganze Stadt.',
      dialogueProgress: 'Die Presse wartet.',
      dialogueComplete: 'Der Nebel dünnt aus — nicht weil jemand ihn vertreibt, sondern weil zu viele Menschen sich zu vieles gleichzeitig merken. Hart erkämpft, unvollständig, und frei.'
    }
  };

  // ---- i18n bootstrap ----
  // Auto-register German strings from QUEST_DEFINITIONS so consumers can use
  // i18n.t('quest.<id>.<field>'). German is source-of-truth — fallback for any
  // EN translation that is missing returns the German value via the i18n
  // lookup cascade (active → de → [MISSING:key]).
  if (window.i18n) {
    var QUEST_FIELDS = ['title', 'description', 'dialogueOffer', 'dialogueProgress', 'dialogueComplete'];
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
      'quest.einfuehrung_wissen.description': 'Spend a memory fragment in the knowledge tree.',
      'quest.einfuehrung_wissen.dialogueOffer': "Steel alone does not cut through the council's lies. I say that to everyone, and everyone nods and does not understand it.\n\nYou are carrying a fragment. A piece of something somebody wrote down and the council burned. Spend it - not in a blade, in yourself. Then you will know what I mean.",
      'quest.einfuehrung_wissen.dialogueProgress': 'The fragment is still lying around on you. Open the tree and spend it. It will not be worth more if you wait.',
      'quest.einfuehrung_wissen.dialogueComplete': "(She looks at you a moment too long.) And? Nothing flashes, nothing chimes. That is what knowledge is like.\n\nEvery fragment you find down there belongs in that tree. The council collects them too - it just burns them.",

      'quest.einfuehrung_amulett.title': 'The Old Man with the Cart',
      'quest.einfuehrung_amulett.description': 'Buy an amulet from the wandering merchant in the depths.',
      'quest.einfuehrung_amulett.dialogueOffer': "There is an old man wandering about down there with a cart. Do not ask me how he gets in - I do not know, and I do not want to know.\n\nHe carries amulets. I do not touch the things, but you should have worn one before you decide whether you like them. They change a whole run, not just a number.",
      'quest.einfuehrung_amulett.dialogueProgress': 'The old man turns up when he feels like it. Keep going deeper and you will meet him. And bring enough gold - he is not cheap.',
      'quest.einfuehrung_amulett.dialogueComplete': "(She studies it from a safe distance.) So you really did it.\n\nKeep an eye on it. What an amulet gives you lasts for this one run - and what it takes from you, you usually notice later.",

      'quest.einfuehrung_schmiede.title': 'The First Edge',
      'quest.einfuehrung_schmiede.description': 'Upgrade a piece of equipment at the Archive Forge.',
      'quest.einfuehrung_schmiede.dialogueOffer': "You wear what you found down there, and you wear it the way you carry a tool that is strange to you.\n\nBring me any of it. I will show you how it is upgraded - gold, a few iron lumps, and it becomes yours. After that you do it alone.",
      'quest.einfuehrung_schmiede.dialogueProgress': 'You have not done it yet. Put a piece on the table and press Upgrade. You have the gold and the lumps.',
      'quest.einfuehrung_schmiede.dialogueComplete': "(She turns it once into the light.) You see. The same piece, only no longer the same.\n\nEvery time you come back up, you stop by here. Not because I say so, but because otherwise you go back down with what was good enough last week.",

      'quest.einfuehrung_presse.title': 'A Line That Stays',
      'quest.einfuehrung_presse.description': 'Have Thom the typesetter print an edict.',
      'quest.einfuehrung_presse.dialogueOffer': "The council prescribes every week what this city is to think. We can do the same - smaller, but we can do it.\n\nYou have printing sheets on you, I can see them. Pick a line and let me set it. It works as long as it hangs, and it costs you the council's attention. You should have felt both once, before it matters.",
      'quest.einfuehrung_presse.dialogueProgress': 'Nothing is hanging yet. Go in, pick a line, I will set it.',
      'quest.einfuehrung_presse.dialogueComplete': "(He wipes his fingers on his smock.) Now it is on every corner, and somebody is reading it out loud.\n\nJust remember one thing: every line we print, the council puts on its scales. Do not print more than you can make good again down below.",

      'quest.einfuehrung_markt.title': 'What Lies Under the Table',
      'quest.einfuehrung_markt.description': 'Buy something from Mara at the black market (from depth 4).',
      'quest.einfuehrung_markt.dialogueOffer': "You lug gold around as if you did not know what for. I do.\n\nFrom depth 4 I keep a stall - not up here, do not ask where. Take anything, the cheapest will do. After that you know it exists, and that is the whole point.",
      'quest.einfuehrung_markt.dialogueProgress': 'From depth 4. Take anything. I do not write down what.',
      'quest.einfuehrung_markt.dialogueComplete': "(She does not count the gold.) Good. And now forget that I showed you.\n\nThe stall moves, but it is somewhere every run. Anyone who comes back up with full pockets and takes them down again has missed something.",

      'quest.einfuehrung_talente.title': 'What You Are Good For',
      'quest.einfuehrung_talente.description': 'Spend a point in the talent tree.',
      'quest.einfuehrung_talente.dialogueOffer': "The council keeps a file on every citizen, and in yours there is a word that bothers me: undetermined.\n\nThat can be changed. You gather experience down there, and experience becomes points. Spend one. Fury, Chains or Shadow - take your pick. The council values people who commit.",
      'quest.einfuehrung_talente.dialogueProgress': 'Still undetermined. Open the tree and spend a point. Which one is your business.',
      'quest.einfuehrung_talente.dialogueComplete': "(He notes something without looking up.) Committed. Good.\n\nThe file will outlive you, archive-smith. That is not a threat, that is administration.",

      'quest.tracker.short_suffix': '..',
      'quest.toast.completed': 'Objective complete: {title}',
      // Akt 0 — Aldric warmup (tutorial extension)
      'quest.aldric_cleanup.title': 'Cellar Cleanup',
      'quest.aldric_cleanup.description': 'Defeat 10 enemies in the cellars beneath the Archive Forge.',
      'quest.aldric_patrol.title': 'Cellar Patrol',
      'quest.aldric_patrol.description': 'Clear 3 rooms in the cellars to secure all corridors.',
      // Akt 1 — Vertical Slice chain (feature 050)
      'quest.harren_daughter_investigation.title': 'The Vanished Daughter',
      'quest.harren_daughter_investigation.description': 'Find the mayor daughter\'s journal fragment in the Rathauskeller.',
      'quest.magistrat_verification.title': 'Magistrate Verification',
      'quest.magistrat_verification.description': 'Obtain the council-sealed verification document for the Magistrate.',
      'quest.klerus_purification.title': 'Purification of the Lower Chambers',
      'quest.klerus_purification.description': 'Cleanse the lower Rathauskeller chambers — defeat 3 elite enemies. The heretic leaders only lurk from depth 3.',
      'quest.garde_patrol_expansion.title': 'Patrol Expansion',
      'quest.garde_patrol_expansion.description': 'Demonstrate force for the new patrols — defeat 10 trespassers.',
      'quest.widerstand_proof.title': "The Council Document",
      'quest.widerstand_proof.description': "Find a hidden council document in the Rathauskeller, a few rooms deeper.",
      'quest.council_collusion_reveal.title': 'The Secret Meeting',
      'quest.council_collusion_reveal.description': 'Watch the public council session. Then eavesdrop on the secret session in the council chamber beneath the town hall.',
      'quest.mara_contact.title': 'The Scout',
      'quest.mara_contact.description': 'Scout three Council cellar rooms for Mara.',
      'quest.elara_meeting.title': "Elara's Secret",
      'quest.elara_meeting.description': 'Find 2 secret documents Elara has hidden.',
      'quest.branka_doubt.title': "The Smith's Doubt",
      'quest.branka_doubt.description': "Defeat 5 elite enemies to find evidence for Branka's suspicions.",
      'quest.elara_ritual.title': 'The Ritual Chamber',
      'quest.elara_ritual.description': "Descend to depth 20 and defeat the Master of Ceremonies who holds the council's ritual chamber.",
      'quest.thom_truth.title': 'Forbidden Truths',
      'quest.thom_truth.description': "Find 5 print plates with the forbidden truths about the council (from depth 14).",
      'quest.mara_warning.title': "Mara's Warning",
      'quest.mara_warning.description': 'Defeat the Chainmaster boss who guards the first real evidence.',
      'quest.branka_weapons.title': 'Weapons for the Resistance',
      'quest.branka_weapons.description': 'Craft 3 items at the Archive Forge.',
      'quest.thom_pamphlets.title': 'The Pamphlets',
      'quest.thom_pamphlets.description': 'Complete 3 deep dungeon runs (from depth 22) to spread the leaflets into the lowest passages.',
      'quest.elara_blade.title': "Elara's Gift",
      'quest.elara_blade.description': 'Elara has forged a special weapon for you.',
      'quest.mara_assault.title': "The Last Watch",
      'quest.mara_assault.description': "Reach wave 30 and break what is left of the chain guard.",
      // Feature 062: umbenannt harren_rescue -> schattenrat_finale; final_truth
      // entfernt (-> the_reckoning). Neue/umbenannte Quests ohne EN fallen über
      // die i18n-Kaskade auf Deutsch zurück (Deutsch = Source-of-Truth).
      'quest.schattenrat_finale.title': 'The Source',
      'quest.schattenrat_finale.description': 'Descend to depth 30, to the source of the fog. Elara is already there.',

      // === Quest dialogues — English ===
      'quest.aldric_cleanup.dialogueOffer': "Vermin has settled in the cellars down below. Wild beasts, the guards say. Clear them out — ten of them, then we talk again.\n\nWill you take this task?",
      'quest.aldric_cleanup.dialogueProgress': 'The cellars are not safe yet. Keep fighting.',
      'quest.aldric_cleanup.dialogueComplete': 'Good. The cellars are cleared. Here is your reward.',

      'quest.aldric_patrol.dialogueOffer': 'Make sure all corridors are secure. Patrol three rooms.\n\nReady?',
      'quest.aldric_patrol.dialogueProgress': 'Not all corridors are secure yet. Keep patrolling.',
      'quest.aldric_patrol.dialogueComplete': 'All corridors are safe. Good work, Archivesmith.',

      // === Akt 1 Vertical Slice (feature 050) — quest dialogues ===
      'quest.harren_daughter_investigation.dialogueOffer': "My daughter has vanished. Aldric says she fled. The Clergy speaks of possession. The Guard talks of dereliction of duty.\n\nI trust none of the three until I have read her own words. Bring me the journal fragment she left behind. You will find it in the Rathauskeller — somewhere the council did not look.\n\nTrust no one until you have seen it yourself.",
      'quest.harren_daughter_investigation.dialogueProgress': 'Keep searching — the fragment is down there. Aldric, the Clergy and the Guard quarrel upstairs because each wants its own version. You will find the real one.',
      'quest.harren_daughter_investigation.dialogueComplete': "You have it. All three council factions are in it, by name. Lene did not simply flee, Archivesmith. Someone made her disappear.\n\nYou will get work from every side now. Take it. Listen to everything. Then come back to me.",

      'quest.magistrat_verification.dialogueOffer': 'You have seen the fragment. Good. Then you also know that the daughter must be reclassified — from "fled" to "missing person of interest". A pure administrative matter, you understand. Records must be kept properly.\n\nThe council-sealed verification document lies in the sunken registry — down there, where the fog swallowed the old records. Descend, recover the Council Seal, and bring it to me. Whatever you meet down there is not my department. The Magistrate carries the responsibility, not the citizen.\n\nDo you accept?',
      'quest.magistrat_verification.dialogueProgress': 'The Council Seal is still down there in the sunken registry. Descend further and recover it. Without the document the reclassification is not legally binding.',
      'quest.magistrat_verification.dialogueComplete': 'Excellent. The document is in the archive. The daughter is now officially a person of interest. What that means in practice is none of your concern. The Magistrate thanks you.',

      'quest.klerus_purification.dialogueOffer': "You have seen the fragment, Archivesmith. Then you know the daughter did not flee of her own will. She was led by a dark hand — the lower chambers teem with such shadows.\n\nPurify them. Three leaders of this heretical presence still lurk down there, deeper than the first passages — descend to depth 3. Strike them down in the name of Order. The daughter's soul will thank you — if the Light finds her again.\n\nPurification is a sacred duty. Accept it.",
      'quest.klerus_purification.dialogueProgress': 'The leaders lurk deep — only from depth 3. Descend, find them, strike them down. Every heresy you end opens another path to purity.',
      'quest.klerus_purification.dialogueComplete': 'You have broken the heresy. The lower chambers breathe again. Order endures — through you. The Clergy blesses your hand. Bring it onward where the Light demands.',

      'quest.garde_patrol_expansion.dialogueOffer': 'If a daughter can vanish from the Town Hall itself, that is a failure of the Guard — and it will change. I need a patrol expansion. Today. Go into the lower chambers and demonstrate force — ten troublemakers fall, and the edict carries itself through the streets.\n\nDo not ask whether the patrols favor a comfortable way of life. Do not ask who decides where they run. Loyalty is the only coin that counts. The edict is the coin you place in my hand.\n\nDo you accept, Archivesmith?',
      'quest.garde_patrol_expansion.dialogueProgress': 'Ten troublemakers remain. Each fallen body is one more line in the report. The Guard waits on the outcome.',
      'quest.garde_patrol_expansion.dialogueComplete': "The report is written. Ten troublemakers fewer, and the Guard can propose more patrols to the council. No one else will vanish — or at least no one who matters. The Guard remembers who answers quickly.",

      'quest.widerstand_proof.dialogueOffer': "So you found the fragment. Good — you no longer live entirely inside their story.\n\nI want YOU to see what I have seen before you go on running their errands. Down in the Rathauskeller lies a document the three council factions should never have signed together — and yet their seal is on it. All three.\n\nBring it to me. Then we talk.",
      'quest.widerstand_proof.dialogueProgress': "The document lies a few rooms deeper. It is small, but the seal upon it will take your breath away.",
      'quest.widerstand_proof.dialogueComplete': 'Three seals. One signature. Magistrate, Clergy, Guard — in public they pretend to be rivals. Behind closed doors they agree. Go to Harren. He has been waiting for the moment you would understand.',

      'quest.council_collusion_reveal.dialogueOffer': 'Today the council announces the result of the vote, in public, in the council hall. Magistrate, Clergy, Guard, before all the citizens. Go and listen. And then follow them in the night, when they think nobody is watching.',
      'quest.council_collusion_reveal.dialogueProgress': 'The council chamber lies down in the cellar. Put on the guard uniform, stay in the shadows and listen to what they say when nobody is watching.',
      'quest.council_collusion_reveal.dialogueComplete': "Now you have seen it. One face, three masks. You worked for each of them. You could flee — but a craftsman who keeps walking in and out of the town hall sees things a fugitive never sees. Stay where you are. Keep cleaning for them, and clean for us in secret. It is more dangerous. It is also the only thing that helps.",
      // === Feature 050 side-dialogue keys (consumed by WP03) ===
      'sidedialog.branka.q2_eyebrow': 'Branka raises an eyebrow when she sees the Magistrat seal. "Another verification seal. Do you actually know what ends up written on these documents?"',
      'sidedialog.thom.q4_eyebrow': "Thom glances up, then back at the press. \"Patrol expansion. The edict sounds reasonable. Go ask someone at the gazebo what 'reasonable' has meant this month.\"",

      'quest.mara_contact.dialogueOffer': "You don't remember me. But I remember you — you were an Archivesmith before the fog took your memory, and you asked questions the Council wanted buried.\n\nI am the resistance's scout. Before I open my network to you, I want to see whether you can still see: go down and scout three cellar rooms. Mark what the Council hides there.",
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
      'quest.verseuchte_kammer.description': 'Aldric sends you to cleanse a "tainted" chamber. Press through to it.',
      'quest.verseuchte_kammer.dialogueOffer': 'A lower chamber is tainted — heresy. Cleanse it. Do not ask what you find.\n\nGo.',
      'quest.verseuchte_kammer.dialogueProgress': 'The chamber lies deeper. Press on.',
      'quest.verseuchte_kammer.dialogueComplete': 'You stand in the chamber. Blood, symbols, chains — and no heretic in sight. This is no taint. This is a summoning chamber. Aldric sent you here to erase his own trail. (You memorize every symbol. Mara should see this. And Aldric should believe you only cleaned.)',

      'quest.bruch_confrontation.title': 'The Break',
      'quest.bruch_confrontation.description': "Aldric set guards on you. Cut your way to Branka — defeat 3 elite guards. They only confront you in the depths (from depth 8).",
      'quest.bruch_confrontation.dialogueOffer': "Aldric knows. Your double game is exposed, his elite guards are sealing off the deep passages, from depth 8 you will face them. Cut your way through and come to me.",
      'quest.bruch_confrontation.dialogueProgress': "Aldric's elite guards hold the depths. From depth 8 you will face them.",
      'quest.bruch_confrontation.dialogueComplete': "You ask too many questions, he said. Now you ask none at all, you know. The cover is burned, the break has come. Mara, Thom, I, we are ready.",
      'quest.espionage_convoy.title': 'The Convoy',
      'quest.espionage_convoy.description': 'Shadow a council convoy in the warehouse in disguise and eavesdrop on it.',
      'quest.espionage_convoy.dialogueOffer': 'Tonight they unload a council convoy at the old warehouse. Put on the guard uniform, stay in the shadows and listen — but draw no blade, or the disguise falls.\n\nWill you take this on?',
      'quest.espionage_convoy.dialogueProgress': "You're not close enough yet. Blend in with the guards at the convoy and eavesdrop on what's being unloaded — undetected.",
      'quest.espionage_convoy.dialogueComplete': "You heard it. No supplies, no weapons. Reagents, sealed vials, chalkstones — ritual components. The council isn't sending out a patrol. It's outfitting a summoning.",

      'quest.espionage_archive.title': 'The Sealed Archive',
      'quest.espionage_archive.description': "Infiltrate the council archive in disguise (from depth 12), eavesdrop on the scribes and recover the sealed file.",
      'quest.espionage_archive.dialogueOffer': "In the council's archive lies a sealed file — and I must know what it holds. The archive lies deep beneath the town hall, from depth 12. Go in disguised as a scribe, listen to what the others whisper, and recover the file. Do not be seen.\n\nWill you do this for me?",
      'quest.espionage_archive.dialogueProgress': "The archive lies from depth 12. The scribes have said nothing useful yet. Stay in the archive, inconspicuous, and keep eavesdropping until you reach the sealed file.",
      'quest.espionage_archive.dialogueComplete': "\"Missing, case closed\" — his daughter's disappearance, neatly filed, date, seal, signature. And the date falls before the day she vanished.\n\n(Harren reads it twice.) They planned it. Someone in the council filed Lene's disappearance before it happened.",

      'quest.espionage_informant.title': 'The Mole',
      'quest.espionage_informant.description': "Unmask a council mole within the resistance's ranks, in disguise (from depth 23).",
      'quest.espionage_informant.dialogueOffer': 'Someone is betraying us. Whatever we decide behind closed doors, the council knows it by next morning. Blend in disguised among our own people at the meeting point, deep down, from depth 23, and find out who the mole is. Move quietly — they do not know your face in this getup.\n\nWill you find the traitor?',
      'quest.espionage_informant.dialogueProgress': "You don't have the mole yet. Stay inconspicuous at the meeting point (from depth 23) and listen for who smuggles messages outside.",
      'quest.espionage_informant.dialogueComplete': 'You followed the note all the way into the council chamber. Elara, beside Aldric. On her ring the sign of the three chains. She led us all — straight into his hands.',

      'quest.elara_ritual.dialogueOffer': "Deep below there is a chamber — the council's summoning chamber. It is held by the Master of Ceremonies, master of the forbidden rituals. Descend to depth 20 and strike him down.\n\nAre you ready for the truth?",
      'quest.elara_ritual.dialogueProgress': "The Master of Ceremonies still holds the chamber. You will find him at depth 20 — as long as he lives, you cannot reach the truth.",
      'quest.elara_ritual.dialogueComplete': "The Master of Ceremonies has fallen. You found it — the council's summoning chamber. Take this amulet; it shields against their dark magic.",
      'quest.thom_truth.dialogueOffer': "I've printed enough of what the council wants. Time for the truth.\n\nFind five print plates, deep in the cellar, from depth 14 — they hold the real history.",
      'quest.thom_truth.dialogueProgress': "The print plates lie deep in the town hall cellar, from depth 14. Keep searching.",
      'quest.thom_truth.dialogueComplete': 'Fantastic! These plates contain proof the council wanted to destroy. The truth goes to print.',

      'quest.mara_warning.dialogueOffer': "The Chainmaster holds the seals at depth 10. He binds whatever he wants to catch. Bring him down, and we have the first hard evidence.",
      'quest.mara_warning.dialogueProgress': "The Chainmaster still lives, at depth 10. If he chains you, strike the chain, or he holds you fast.",
      'quest.mara_warning.dialogueComplete': "The Chainmaster has fallen, the evidence is secured. Now no one can deny that the council processes people.",
      'quest.branka_weapons.dialogueOffer': 'We need weapons. Not for the council — for US.\n\nCraft three items at the forge.',
      'quest.branka_weapons.dialogueProgress': 'The forge waits. Craft more items.',
      'quest.branka_weapons.dialogueComplete': 'Well forged. These weapons will make the difference.',

      'quest.thom_pamphlets.dialogueOffer': "The upper passages already read our truth. Now we need the depths — where the council keeps its secrets.\n\nComplete three runs from depth 22, and all of Fogreach will read the truth.",
      'quest.thom_pamphlets.dialogueProgress': 'Only deep runs count — from depth 22. Complete three; each spreads our message into the lowest passages.',
      'quest.thom_pamphlets.dialogueComplete': 'The whole city reads our truths! The citizens have awakened. Your experience now grows faster. (+10% XP)',

      'quest.elara_blade.dialogueOffer': "Take this. I forged it for you. In case...\n\nWill you accept Elara's Blade?",
      'quest.elara_blade.dialogueProgress': 'The blade waits for you.',
      'quest.elara_blade.dialogueComplete': 'May it protect you. No matter what comes.',

      'quest.mara_assault.dialogueOffer': "Aldric has vanished beneath the city, with what is left of his chain guard. As long as they are down there, the alleys won't sleep. Reach wave 30 and clean up.\n\nAre you in?",
      'quest.mara_assault.dialogueProgress': "The chain guard still holds out in the depths. Press on — wave 30.",
      'quest.mara_assault.dialogueComplete': "The chain guard is broken. The tunnels beneath the city belong to no one again. That is more than this city has had in a long time.",

      'quest.schattenrat_finale.dialogueOffer': 'Elara has gone down. To the source, at depth 30. I know now what she is, Archivesmith. She is still my daughter. Go. I will follow.',
      'quest.schattenrat_finale.dialogueProgress': 'The source lies at depth 30. Hurry.',
      'quest.schattenrat_finale.dialogueComplete': 'The source is broken. The press is yours now. Go to Thom, it is time.',

      // #68: die Aushaenge am Brett
      'quest.brett_stoerer.title': 'Notice: Quiet in the Cellars',
      'quest.brett_stoerer.description': 'A council notice: defeat 12 enemies from depth 3.',
      'quest.brett_stoerer.dialogueOffer': 'MAGISTRATE: The council pays for quiet in the lower passages. Twelve troublemakers from depth 3, handed in here at the board.\n\n(Below, in smaller letters: "A list of the names is kept by the archive.")',
      'quest.brett_stoerer.dialogueProgress': 'The notice is still up. Twelve troublemakers from depth 3.',
      'quest.brett_stoerer.dialogueComplete': 'You scratch a mark under the notice. The pay lies in the box beneath it, counted out, without a word.',
      'quest.brett_anfuehrer.title': 'Notice: The Leaders',
      'quest.brett_anfuehrer.description': 'A council notice: defeat 3 elite enemies from depth 6.',
      'quest.brett_anfuehrer.dialogueOffer': 'GUARD: Three leaders, from depth 6. Whoever pays does not ask who they were.\n\n(The notice is fresh. The one beneath it, half covered, is looking for a missing seamstress.)',
      'quest.brett_anfuehrer.dialogueProgress': 'Three leaders, from depth 6. The notice is waiting.',
      'quest.brett_anfuehrer.dialogueComplete': 'The Guard pays in cash, at once. Nobody takes the notice down; it hangs there again the next morning.',
      'quest.brett_aufruf.title': 'Call of the Print Shop',
      'quest.brett_aufruf.description': 'A call from the resistance: clear 5 chambers from depth 10.',
      'quest.brett_aufruf.dialogueOffer': 'Over the torn council posters someone has pasted a freshly printed sheet:\n\n"Whoever clears up down there makes room for the truth. Five chambers, from depth 10. Paper is at Thom\'s."',
      'quest.brett_aufruf.dialogueProgress': 'Five chambers from depth 10. The sheet is still up; someone nailed it down.',
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
      'quest.resistance_fetch_01.dialogueOffer': "There is something in the cellar... a bundle, sealed. Bring it to me without anyone seeing it. And do not open it.\n\nWill you take the task?",
      'quest.resistance_fetch_01.dialogueProgress': "The bundle lies somewhere down there. Look around — and leave it closed.",
      'quest.resistance_fetch_01.dialogueComplete': "You have it. And you did not open it. Good.\n\n(On the wax of the seal: three chains, intertwined. You have never seen this sign before.)",

      'quest.faction_campaign.title': "Edict of the Week",
      'quest.faction_campaign.description': "The city votes: three edicts, one wins. Have them printed at Thom's and post them on the notice boards in front of the town hall.",
      'quest.faction_campaign.dialogueOffer': "This week the city votes. Three edicts, Magistrate, Clergy, Guard, and the citizens choose one. Have them printed at Thom's and post them on the boards in front of the town hall. That is what order looks like when it is chosen.",
      'quest.faction_campaign.dialogueProgress': "First print, then post. The print shop is just across the square.",
      'quest.faction_campaign.dialogueComplete': "Good. The votes are being counted, and the council announces the result in public, in the council hall. As it should be.",

      'quest.klerus_district_purge.title': "Purging a District",
      'quest.klerus_district_purge.description': "Purge an \"infested\" district — defeat 8 enemies and bring back the names.",
      'quest.klerus_district_purge.dialogueOffer': "A district is infested. Purge it. Whoever shuns the Light has something to hide. Bring me the names of the infested.",
      'quest.klerus_district_purge.dialogueProgress': "Not purged yet. The infested show themselves in the depths.",
      'quest.klerus_district_purge.dialogueComplete': "You bring the names. (The infested had faces. You knew none of them, and yet every one seemed familiar.) (A copy is already with Mara before the council sees the list. Whoever is on it disappears. But perhaps not all of them any more. Perhaps someone warns them in time.)",

      'quest.garde_night_escort.title': "Night Escort",
      'quest.garde_night_escort.description': "Covertly secure a night transport — watch the escort route (from depth 16).",
      'quest.garde_night_escort.dialogueOffer': "A transport goes out tonight. The route leads deep down, from depth 16. Secure it, don't ask what is inside. Loyalty pays.",
      'quest.garde_night_escort.dialogueProgress': "The transport only rolls from depth 16. Keep an eye on the route, stay inconspicuous.",
      'quest.garde_night_escort.dialogueComplete': "The route is secure. (And in your head, route, time and cargo, ready for Mara. They were not weapons. They were the same vials as in the convoy.)",

      'quest.who_you_were.title': "Who You Were",
      'quest.who_you_were.description': "Bring Branka three shards of your old file from the depths (from depth 17).",
      'quest.who_you_were.dialogueOffer': "I found something that concerns you. A file with your mark, half eaten by the fog. Bring me three shards of it from the depths, and we will piece together who you were.",
      'quest.who_you_were.dialogueProgress': "The shards lie deep — from depth 17. Keep searching.",
      'quest.who_you_were.dialogueComplete': "There you are. Before the accident, before the fog. You did not always just clean up. Once you asked the same questions you are asking again now. The fog did not hit you by chance. It was sent after you.",

      'quest.elara_second_truth.title': "Elara's Second Truth",
      'quest.elara_second_truth.description': "Elara shows you who you are doing the last thing for.",
      'quest.elara_second_truth.dialogueOffer': "Before you do the last thing, you should know for whom. Come, just the two of us.",
      'quest.elara_second_truth.dialogueProgress': "Elara is waiting for you. Just the two of you.",
      'quest.elara_second_truth.dialogueComplete': "She tucked the report away. A true report, and no one will ever read it. \"Not everything helps,\" she said. You push the thought aside. For now.",

      'quest.the_reckoning.title': "The Reckoning",
      'quest.the_reckoning.description': "The source is broken. Thom waits at the press. The city shall learn everything.",
      'quest.the_reckoning.dialogueOffer': "The plates are set. Everything you have seen goes on them: the council, Aldric, the resistance, her. Tomorrow the whole city reads it.",
      'quest.the_reckoning.dialogueProgress': "The press is waiting.",
      'quest.the_reckoning.dialogueComplete': "The fog thins — not because someone drives it away, but because too many people remember too much at once. Hard-won, incomplete, and free.",

      // === Quest reward strings ===
      'quest.reward.info.mara_contact': "Mara's network revealed",
      'quest.reward.ALDRIC_SCHWERT': 'Council Sword',
      'quest.reward.RITUAL_AMULETT': 'Ritual Amulet',
      'quest.reward.ELARAS_KLINGE': "Elara's Blade",
      'quest.rarity.common': 'Common',
      'quest.rarity.rare': 'Rare',
      'quest.rarity.epic': 'Epic',
      'quest.rarity.legendary': 'Legendary'
    });

    // Auto-add the German reward strings + rarity labels (DE source-of-truth)
    window.i18n.register('de', {
      // Feature 050 side-dialogue keys (consumed by WP03)
      'sidedialog.branka.q2_eyebrow': 'Branka hebt eine Augenbraue, als sie das Magistrats-Siegel sieht. »Wieder eines dieser Verifikations-Siegel. Weisst du eigentlich, was am Ende auf diesen Dokumenten steht?«',
      'sidedialog.thom.q4_eyebrow':   'Thom blickt kurz auf, dann zurück zur Presse. »Patrouillen-Erweiterung. Der Edikt klingt vernünftig. Frag mal jemanden im Pavillon, was »vernünftig« diesen Monat bedeutet.«',
      'quest.reward.info.mara_contact': 'Maras Netzwerk enthüllt',
      'quest.reward.ALDRIC_SCHWERT': 'Ratsschwert',
      'quest.reward.RITUAL_AMULETT': 'Ritualamulett',
      'quest.reward.ELARAS_KLINGE': 'Elaras Klinge',
      'quest.rarity.common': 'Gewöhnlich',
      'quest.rarity.rare': 'Selten',
      'quest.rarity.epic': 'Episch',
      'quest.rarity.legendary': 'Legendär'
    });

    // Convert QUEST_DEFINITIONS title/description/dialogue* to live getters so
    // ANY consumer reading q.title etc. sees the active language without code
    // changes. Plain object literals are not frozen, so defineProperty works.
    Object.keys(QUEST_DEFINITIONS).forEach(function (id) {
      var q = QUEST_DEFINITIONS[id];
      QUEST_FIELDS.forEach(function (field) {
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
    return Object.assign({}, questFlags);
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
      })
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
    var def = QUEST_DEFINITIONS[id];
    if (!def || typeof def.minDepth !== 'number') return true;
    var d = (typeof window !== 'undefined' && typeof window.DUNGEON_DEPTH === 'number')
      ? window.DUNGEON_DEPTH : 1;
    return d >= def.minDepth;
  }

  /**
   * #72: Ist die Mindesttiefe dieser Quest im laufenden Lauf erreicht?
   * (Oder mit Tiefe als zweitem Argument.) Beute und Spionageraeume fragen
   * das, damit unterhalb der Tiefe nichts faellt, das dann nicht zaehlt.
   */
  function tiefeErreicht(id, tiefe) {
    var def = QUEST_DEFINITIONS[id];
    if (!def || typeof def.minDepth !== 'number') return true;
    var d = (typeof tiefe === 'number') ? tiefe
      : (typeof window !== 'undefined' && typeof window.DUNGEON_DEPTH === 'number') ? window.DUNGEON_DEPTH : 1;
    return d >= def.minDepth;
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
  /**
   * Elara in den Hub holen, sobald das Doppelspiel beginnt (#131).
   *
   * Ihr Eintrag im Hub-Layout traegt visibleAfterFlag: 'elaraReturnedToHub' —
   * und diese Flagge wurde im ganzen Projekt NIRGENDS gesetzt. Ein einziges
   * Vorkommen, im Layout selbst. Elara war damit im Hub nie sichtbar und
   * konnte KEINE ihrer vier Quests vergeben:
   *
   *     elara_meeting -> elara_ritual -> elara_second_truth -> bruch_confrontation
   *
   * Und bruch_confrontation ist der einzige Weg nach Akt 5. Der ganze Strang
   * war tot, unabhaengig von jeder Tiefe. Der Kommentar im Layout wusste es
   * sogar ("references a flag that is currently never set") — er stand nur an
   * einer Stelle, an der niemand nach der Ursache eines fehlenden Auftrags
   * sucht.
   *
   * WANN: erst in Akt 5, wenn der Rat gefallen ist. Ihre Auftraege davor
   * vergibt sie im Dungeon (roomManager: _elaraSpaetereAuftraege) — der Hub
   * ist die Stadt des Rates, und waehrend des Doppelspiels dort offen zu
   * stehen wuerde untergraben, was der Akt gerade aufbaut. Der Wechsel IST
   * die Aussage: in der Phase, in der Aldric keine Auftraege mehr vergibt,
   * steht Elara auf dem Platz.
   *
   * Laeuft bei jeder Quest-Aenderung mit, damit auch Altstaende, die schon in
   * Akt 2 oder spaeter stehen, sie beim naechsten Hub-Betreten sehen.
   */
  function _elaraSichtbarkeitNachziehen() {
    try {
      if (questFlags.elaraReturnedToHub) return;
      var a = (typeof window !== 'undefined' && window.storySystem
        && typeof window.storySystem.getCurrentActIndex === 'function')
        ? window.storySystem.getCurrentActIndex() : 0;
      if (a >= 4) {
        questFlags.elaraReturnedToHub = true;
        console.log('[QuestSystem] Elara kehrt in den Hub zurueck (Akt ' + (a + 1) + ')');
      }
    } catch (e) { /* nie den Questfluss brechen */ }
  }

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
   *   'amulett'  ein Amulett beim wandernden Haendler gekauft (ShopScene)
   */
  var SYSTEM_ZIELE = ['upgrade', 'edikt', 'markt', 'talent', 'wissen', 'amulett'];

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

    // Grant rewards
    var rewards = def.rewards;
    if (rewards.xp) {
      // Über addXP vergeben, damit Level-Up + window-Spiegelung + HUD korrekt
      // laufen. Früher wurde nur window.playerXP hochgezählt -> nie ein
      // Level-Up ausgelöst und die Anzeige lief über (z.B. 290/136).
      if (typeof addXP === 'function') addXP(rewards.xp);
      else if (typeof window !== 'undefined' && typeof window.addXP === 'function') window.addXP(rewards.xp);
      else if (typeof window !== 'undefined') { window.playerXP = (window.playerXP || 0) + rewards.xp; }
      console.log('[QuestSystem] Granted ' + rewards.xp + ' XP');
    }
    // #68: Gold. Stand als Feld in den Daten (buerger_hund), wurde aber nie
    // ausgezahlt — LootSystem.grantGold ist der einzige Weg, auf dem Gold beim
    // Spieler ankommt.
    if (typeof rewards.gold === 'number' && rewards.gold > 0
        && window.LootSystem && typeof window.LootSystem.grantGold === 'function') {
      try {
        window.LootSystem.grantGold(rewards.gold | 0);
        console.log('[QuestSystem] Granted ' + (rewards.gold | 0) + ' Gold');
      } catch (_) {}
    }
    if (rewards.materials) {
      Object.keys(rewards.materials).forEach(function (key) {
        if (typeof changeMaterialCount === 'function') {
          changeMaterialCount(key, rewards.materials[key]);
          console.log('[QuestSystem] Granted ' + rewards.materials[key] + ' ' + key);
        } else if (typeof materialCounts !== 'undefined') {
          materialCounts[key] = (materialCounts[key] || 0) + rewards.materials[key];
          console.log('[QuestSystem] Granted ' + rewards.materials[key] + ' ' + key);
        }
      });
    }
    if (rewards.items && Array.isArray(rewards.items)) {
      rewards.items.forEach(function (item) {
        if (typeof inventory !== 'undefined' && Array.isArray(inventory)) {
          var kopie = Object.assign({}, item);
          // Ueber InventoryGrid, sonst fehlt die Rasterlage und der Lohn ist
          // im Inventar unsichtbar. Und: bei vollem Inventar NICHT mehr Platz 0
          // ueberschreiben — das loeschte stillschweigend ein anderes Stueck.
          var abgelegt = false;
          if (window.InventoryGrid && typeof window.InventoryGrid.einlagern === 'function') {
            abgelegt = window.InventoryGrid.einlagern(kopie) >= 0;
          } else {
            var idx = inventory.findIndex(function (slot) { return !slot; });
            if (idx >= 0) { inventory[idx] = kopie; abgelegt = true; }
          }
          if (!abgelegt) {
            console.warn('[QuestSystem] Inventar voll — Belohnung nicht vergeben: '
              + (item.name || item.key || '?'));
          }
          if (typeof refreshInventoryUI === 'function') refreshInventoryUI();
        }
      });
    }
    if (typeof rewards.druckblaetter === 'number' && rewards.druckblaetter > 0
        && window.PrintingHouse && typeof window.PrintingHouse.addDruckblaetter === 'function') {
      try {
        window.PrintingHouse.addDruckblaetter(rewards.druckblaetter | 0);
        console.log('[QuestSystem] Granted ' + (rewards.druckblaetter | 0) + ' Druckblätter');
      } catch (_) {}
    }
    if (rewards.unlocks && Array.isArray(rewards.unlocks)) {
      rewards.unlocks.forEach(function (unlock) {
        if (!window._questUnlocks) window._questUnlocks = {};
        window._questUnlocks[unlock] = true;
        console.log('[QuestSystem] Unlocked:', unlock);
        // Apply XP bonus immediately if applicable
        if (unlock === 'xp_bonus_10') {
          window._questXpBonus = (window._questXpBonus || 0) + 0.10;
          console.log('[QuestSystem] XP bonus now:', window._questXpBonus);
        }
      });
    }

    // Feature 050: Knowledge-Tree fragment reward dispatcher (C-05). Used
    // by Q1 / Q5 / Q6 to grant lore-fragment currency via the canonical
    // KnowledgeTree.addFragments() entry point.
    if (rewards && typeof rewards.fragments === 'number' && rewards.fragments > 0
        && window.KnowledgeTree && typeof window.KnowledgeTree.addFragments === 'function') {
      try {
        window.KnowledgeTree.addFragments(rewards.fragments);
        console.log('[QuestSystem] Granted ' + rewards.fragments + ' Knowledge-Tree fragment(s)');
      } catch (err) {
        console.warn('[QuestSystem] fragment grant failed', err);
      }
    }

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
        // #131: Ab Akt 2 gehoert Elara in den Hub.
        _elaraSichtbarkeitNachziehen();
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
      flags: JSON.parse(JSON.stringify(questFlags))
    };
  }

  function loadQuestSaveData(data) {
    if (!data || typeof data !== 'object') return;
    _initQuestState();
    questFlags = {};
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
      }
      // Old quest IDs from previous saves are silently ignored,
      // preserving backward compatibility
    });
    Object.keys(srcFlags).forEach(function (k) {
      questFlags[k] = !!srcFlags[k];
    });
    _backfillAdvanceActs();
    // #131: Ein Stand, der schon in Akt 2 oder spaeter steht, bekommt Elara
    // nachgereicht. Bewusst HIER und nicht in _notifyUpdate: der Altstand-Reset
    // weiter oben kehrt vorher zurueck, und dort muessen die Flags leer
    // bleiben.
    _elaraSichtbarkeitNachziehen();
    _notifyUpdate();
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
    getCompletedQuests: getCompletedQuests,
    acceptQuest: acceptQuest,
    updateQuestProgress: updateQuestProgress,
    tiefeErreicht: tiefeErreicht,
    onWaveCompleted: onWaveCompleted,
    onDungeonCompleted: onDungeonCompleted,
    onBossKilled: onBossKilled,
    // #131: Tiefensperre vor einem Story-Boss, dessen Quest noch nicht laeuft.
    // #131: fuer die Verifikation — holt Elara nach, wenn der Akt schon passt.
    elaraSichtbarkeitNachziehen: _elaraSichtbarkeitNachziehen,
    onItemCrafted: onItemCrafted,
    onSystemUsed: onSystemUsed,
    SYSTEM_ZIELE: SYSTEM_ZIELE,
    areAllQuestChainsComplete: areAllQuestChainsComplete,
    isQuestReadyToComplete: isQuestReadyToComplete,
    completeQuest: completeQuest,
    setFlag: setFlag,
    hasFlag: hasFlag,
    getFlags: getFlags,
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
