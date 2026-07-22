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
      dialogueOffer: 'Wilde Tiere in den Kellern. Räum sie aus.\n\nWillst du diese Aufgabe übernehmen?',
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
    // all 6 in one playthrough — faction-standing accumulates as a
    // consequence, not a content-gate. The Council-collusion reveal in Q6
    // is the political-thesis payoff (constitution §Setting).
    //
    // Legacy Akt-1 quests deleted: aldric_intruders, harren_daughter,
    // branka_armor (see WP02 T010). No save migration — unknown IDs in old
    // save files are silently dropped by loadQuestSaveData.
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
      rewards: { xp: 50, factionStanding: { independent: 1 }, fragments: 1 },
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
      dialogueOffer: 'Meine Tochter ist verschwunden. Aldric sagt, Eindringlinge hätten sie entführt. Der Klerus spricht von Besessenheit. Die Garde redet von Pflichtversäumnis.\n\nIch glaube keinem der drei, bevor ich nicht ihre eigenen Worte gelesen habe. Bring mir das Tagebuchfragment, das sie zurückgelassen hat. Du findest es im Rathauskeller — irgendwo, wo der Rat nicht hingeschaut hat.\n\nVertrau niemandem, bis du es selbst gesehen hast.',
      dialogueProgress: 'Such weiter — das Fragment ist da unten. Aldric, Klerus und Garde streiten sich oben, weil sie alle eine andere Version hören wollen. Du findest die echte.',
      dialogueComplete: 'Du hast es. Sie ist nicht entführt worden. Sie ist geflohen. Und sie hatte Grund dazu — alle drei Ratsfraktionen werden im Fragment namentlich erwähnt. Du wirst gleich von allen vier Seiten gefragt werden. Hör dir alles an. Mach alle vier Aufträge. Dann komm zurück zu mir.'
    },
    magistrat_verification: {
      id: 'magistrat_verification',
      title: 'Verifikation des Magistrats',
      description: 'Sichere die Umgebung — beseitige 8 Störer während der Magistrat die Akten ordnet.',
      npcId: 'aldric',
      type: 'fetch',
      chain: 2,
      // Feature 062: 'fetch verification_seal' — als Quest-Item-Drop von WP05
      // (js/loot.js) verdrahtet (Muster journal_fragment). Das Ratssiegel wird
      // in der Archivschmiede gesetzt. completionFlags setzt den Backbone-Default
      // 'verification_sealed' (die Szenen-Wahl sealed/refused folgt später).
      objectives: [
        { type: 'fetch', target: 'verification_seal', current: 0, required: 1 }
      ],
      rewards: { xp: 75, factionStanding: { magistrat: 1 } },
      completionFlags: ['verification_sealed'],
      prerequisites: ['harren_daughter_investigation'],
      requiredAct: 1,
      dialogueOffer: 'Du hast das Fragment gesehen. Gut. Dann weisst du auch, dass die Tochter neu klassifiziert werden muss — von "geflohen" zu "vermisste Person von Interesse". Eine reine Verwaltungsangelegenheit, verstehst du. Akten müssen ordnungsgemäss geführt werden.\n\nGeh zu Branka in die Archivschmiede und lass das ratsgesiegelte Verifikationsdokument anfertigen. Sie wird Fragen stellen — beantworte sie nicht. Der Magistrat trägt die Verantwortung, nicht der Bürger.\n\nNimmst du den Auftrag an?',
      dialogueProgress: 'Das Dokument muss in der Archivschmiede gefertigt werden. Branka kennt das Verfahren. Geh und lass sie ihre Arbeit tun.',
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
      rewards: { xp: 90, factionStanding: { klerus: 1 } },
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
      rewards: { xp: 75, factionStanding: { garde: 1 } },
      prerequisites: ['harren_daughter_investigation'],
      requiredAct: 1,
      dialogueOffer: 'Wenn eine Tochter aus dem Rathaus verschwinden kann, ist das ein Versagen der Garde — und das wird sich ändern. Ich brauche eine Patrouillen-Erweiterung. Heute. Geh in die unteren Kammern und demonstriere Kraft — zehn Störer fallen, das Edikt trägt sich von selbst durch die Strassen.\n\nFrag nicht, ob die Patrouillen schoner Lebensweise zuträglich sind. Frag nicht, wer entscheidet, wohin sie laufen. Loyalität ist die einzige Münze, die zählt. Das Edikt ist die Münze, die du in meine Hand legst.\n\nNimmst du den Auftrag an, Archivschmied?',
      dialogueProgress: 'Zehn Störer noch. Jeder gefallene Körper ist eine Zeile mehr im Bericht. Die Garde wartet auf das Ergebnis.',
      dialogueComplete: 'Das Edikt ist veröffentlicht. Die Patrouillen verdoppeln sich ab morgen. Niemand wird mehr verschwinden — oder zumindest niemand, der zählt. Die Garde merkt sich, wer schnell antwortet.'
    },
    widerstand_proof: {
      id: 'widerstand_proof',
      title: 'Beweise aus der Ritualkammer',
      description: 'Finde ein verstecktes Ratsdokument in einer Ritualkammer im Rathauskeller.',
      npcId: 'elara',
      type: 'fetch',
      chain: 2,
      // 'council_document' target wired in js/loot.js as a quest-item drop
      // (10% chance per enemy kill while the quest is active).
      objectives: [
        { type: 'fetch', target: 'council_document', current: 0, required: 1 }
      ],
      rewards: { xp: 100, factionStanding: { widerstand: 1 }, fragments: 1 },
      prerequisites: ['harren_daughter_investigation'],
      requiredAct: 1,
      dialogueOffer: 'Du hast also das Fragment gefunden. Gut — dann lebst du nicht mehr ganz in ihrer Erzählung. Aldric will mich zurückholen. Der Klerus will mich verbrennen. Die Garde will mich kassieren.\n\nUnd ich? Ich will dass DU siehst, was ich gesehen habe, bevor du weiter ihre Aufträge erledigst. Unten im Rathauskeller gibt es eine Ritualkammer. Dort liegt ein Dokument, das die drei Ratsfraktionen nie zusammen unterzeichnet haben sollten — und doch ist ihr Siegel darauf. Alle drei.\n\nBring es mir. Dann reden wir.',
      dialogueProgress: 'Such die Ritualkammer. Drei Räume tiefer. Das Dokument ist klein, aber das Siegel darauf wird dir den Atem nehmen.',
      dialogueComplete: 'Drei Siegel. Eine Unterschrift. Magistrat, Klerus, Garde — sie behaupten in der Öffentlichkeit, sie wären Rivalen. Hinter verschlossenen Türen stimmen sie überein. Geh zu Harren. Er wartet auf den Moment, in dem du das verstehst.'
    },
    council_collusion_reveal: {
      id: 'council_collusion_reveal',
      title: 'Die geheime Sitzung',
      description: 'Folge Harren zur geheimen Sitzung der drei Ratsfraktionen.',
      npcId: 'harren',
      type: 'dialogue',
      chain: 3,
      objectives: [
        { type: 'observe', target: 'collusion_reveal_seen', current: 0, required: 1 }
      ],
      rewards: { xp: 150, fragments: 1 },
      prerequisites: ['magistrat_verification', 'klerus_purification', 'garde_patrol_expansion', 'widerstand_proof'],
      requiredAct: 1,
      // Trigger -> Akt 2 (Das Doppelspiel). advanceAct + der hartverdrahtete
      // advanceToAct(2) in completeQuest (idempotent) — beides führt auf 2.
      // Objective bleibt 'dialogue' (Auto-Complete): der observe-Trigger der
      // inszenierten Sitzung kommt mit dem Inszenierungs-Feature (Feature 062
      // Scope: Rückgrat, keine Szenen). Ein Wechsel auf 'observe' ohne diese
      // Szene machte Akt 2 unerreichbar.
      advanceAct: 2,
      dialogueOffer: 'Komm mit. Kein Wort, keine Klinge. Was du gleich siehst, kannst du nicht mehr vergessen, auch nicht, wenn der Nebel es versucht.',
      dialogueProgress: 'Folge mir. Es ist Zeit.',
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
      dialogueOffer: 'Ich bin nicht entführt worden. Ich bin geflohen. Hier — lies das.\n\nFinde zwei Dokumente, die ich im Keller versteckt habe.',
      dialogueProgress: 'Die Dokumente sind gut versteckt. Suche weiter.',
      dialogueComplete: 'Jetzt siehst du die Wahrheit. Der Rat hat mich benutzt — für ihre Rituale.\n\n(Die Abschriften sind in einer ruhigen, geübten Hand. Für etwas, das sie angeblich in Panik im Keller versteckt hat, wirken sie seltsam ordentlich. Du schiebst den Gedanken beiseite.)'
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
      dialogueComplete: 'Gib her.\n\n(Bevor du sie abgibst, fällt dein Blick auf eine Zeile. Es sind keine Pamphlete. Es sind Gesuche — Bürger, die nach verschwundenen Angehörigen fragen. Du gibst sie trotzdem ab. Mara wird wissen wollen, wer da fragt.)'
    },
    council_surveillance: {
      id: 'council_surveillance',
      title: 'Überwachung',
      description: 'Überwache einen "unruhigen" Bezirk für den Rat — sichte 3 Bereiche.',
      npcId: 'aldric',
      type: 'explore',
      chain: 2,
      objectives: [
        { type: 'explore', target: 'room', current: 0, required: 3 }
      ],
      rewards: { xp: 70, druckblaetter: 1 },
      prerequisites: ['council_seizure'],
      requiredAct: 2,
      dialogueOffer: 'Ein Bezirk gilt als aufsässig. Sichte drei Bereiche und melde, wer sich zusammenrottet.\n\nBereit?',
      dialogueProgress: 'Noch nicht alle Bereiche gesichtet. Beobachte weiter.',
      dialogueComplete: 'Bericht angenommen.\n\n(Du hast keine Verschwörer gesehen — nur Familien, die Brot teilen und leise zählen, wer als Nächstes nicht mehr heimkam.)'
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
      dialogueComplete: 'Du hast es gehört. Keine Vorräte, keine Waffen. Reagenzien, versiegelte Phiolen, Kreidesteine — Ritual-Komponenten. Der Rat schickt keine Patrouille los. Er rüstet eine Beschwörung aus. Gut gemacht, dass du die Klinge stecken liessest.'
    },
    espionage_archive: {
      id: 'espionage_archive',
      title: 'Das versiegelte Archiv',
      description: 'Infiltriere verkleidet das Council-Archiv, höre die Schreiber ab und birg den versiegelten Akt.',
      npcId: 'harren',
      type: 'observe',
      chain: 7,
      objectives: [
        { type: 'observe', target: 'archive_record', current: 0, required: 1 }
      ],
      rewards: { xp: 110, fragments: 1 },
      prerequisites: ['espionage_convoy'],
      requiredAct: 3,
      dialogueOffer: 'Im Archiv des Rats liegt ein versiegelter Akt — und ich muss wissen, was darin steht. Geh als Schreiber verkleidet hinein, hör ab, was die anderen flüstern, und birg den Akt. Werde nicht gesehen.\n\nTust du das für mich?',
      dialogueProgress: 'Die Schreiber haben noch nichts Verwertbares gesagt. Bleib im Archiv, unauffällig, und hör weiter ab, bis du an den versiegelten Akt kommst.',
      dialogueComplete: 'Du hast den Akt. "Vermisst, Fall geschlossen" — Elaras Verschwinden, sauber abgelegt, Datum, Siegel, Unterschrift. Zu sauber. Wer in Panik flieht, hinterlässt kein ordentlich abgeheftetes Protokoll. Und das Datum... es liegt vor dem Tag, von dem Harren mir erzählt hat. Ich sage noch nichts. Aber irgendwas an dieser Akte stimmt nicht.'
    },
    espionage_informant: {
      id: 'espionage_informant',
      title: 'Der Maulwurf',
      description: 'Enttarne verkleidet einen Council-Maulwurf in den Reihen des Widerstands.',
      npcId: 'mara',
      type: 'observe',
      chain: 8,
      objectives: [
        { type: 'observe', target: 'informant_id', current: 0, required: 1 }
      ],
      rewards: { xp: 120, fragments: 1 },
      // Feature 062: setzt mole_evidence (Regler 3 im Finale). observe informant_id
      // von WP05 (espionageSystem) verdrahtet.
      completionFlags: ['mole_evidence'],
      prerequisites: ['espionage_archive'],
      requiredAct: 3,
      dialogueOffer: 'Jemand verrät uns. Was wir hinter verschlossenen Türen beschliessen, weiss der Rat am nächsten Morgen. Misch dich verkleidet unter unsere eigenen Leute am Treffpunkt und finde heraus, wer der Maulwurf ist. Beweg dich leise — sie kennen dein Gesicht nicht in dieser Montur.\n\nFindest du den Verräter?',
      dialogueProgress: 'Noch hast du den Maulwurf nicht. Bleib unauffällig am Treffpunkt und hör ab, wer Nachrichten nach draussen schmuggelt.',
      dialogueComplete: 'Du hast die Übergabe gesehen. Ein gefalteter Zettel, eine Hand, ein Wort — und in der Handschrift derselbe sauber gezogene Bogen wie auf den Belegen, die uns jemand aus dem Inneren des Rats zugespielt hat. Die Spur zeigt nach innen, näher als uns lieb ist. Ich nenne keinen Namen. Aber vertrau ab jetzt niemandem blind — nicht einmal denen, die uns "die Wahrheit" bringen.'
    },

    // =======================================================
    // === Act 4: Die Wahrheit sickert durch ===
    // =======================================================
    // -------------------------------------------------------
    // Faction-gated showcase quest (feature 045). Only offered
    // when Resistance standing >= 25. Demonstrates the gate()
    // predicate path; QA can adjust standing via DevTools to
    // surface or hide the offer at will.
    // -------------------------------------------------------
    resistance_fetch_01: {
      id: 'resistance_fetch_01',
      title: 'Botengang für die Resistance',
      description: 'Hol das versiegelte Bündel aus dem Keller. Niemand darf es sehen.',
      npcId: 'elara',
      type: 'kill',
      chain: 0,
      objectives: [
        { type: 'kill', target: 'enemy', current: 0, required: 5 }
      ],
      rewards: { xp: 25, materials: { MAT: 3 } },
      prerequisites: [],
      requiredAct: 0,
      gate: function () {
        return !!(window.FactionSystem
          && typeof window.FactionSystem.getStanding === 'function'
          && window.FactionSystem.getStanding('widerstand') >= 25);
      },
      dialogueOffer: 'Es gibt da etwas im Keller... ein Bündel, versiegelt. Bring es mir, ohne dass jemand sieht.\n\nNimmst du den Auftrag an?',
      dialogueProgress: 'Schau dich im Keller um. Räum ein paar Wachen aus dem Weg, falls nötig.',
      dialogueComplete: 'Du hast es. Niemand hat dich gesehen — gut. Die Resistance vergisst das nicht.'
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
      description: 'Finde 5 Druckplatten mit den verbotenen Wahrheiten über den Rat.',
      npcId: 'thom',
      type: 'fetch',
      chain: 1,
      objectives: [
        { type: 'fetch', target: 'print_plate', current: 0, required: 5 }
      ],
      rewards: { xp: 100, materials: { MAT: 20 } },
      prerequisites: [],
      requiredAct: 3,
      dialogueOffer: 'Ich habe genug gedruckt, was der Rat will. Zeit für die Wahrheit.\n\nFinde fünf Druckplatten im Keller — sie enthalten die echte Geschichte.',
      dialogueProgress: 'Die Druckplatten sind irgendwo im Rathauskeller verborgen. Suche weiter.',
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
      rewards: { xp: 0, items: [{ type: 'weapon', key: 'ELARAS_KLINGE', name: 'Elaras Klinge', nameKey: 'quest.reward.ELARAS_KLINGE', iconKey: 'itWeapon', rarity: 'legendary', rarityLabel: 'Legendär', rarityKey: 'quest.rarity.legendary', rarityValue: 4, itemLevel: 15, damage: 22, speed: 1.3, range: 120, armor: 0, crit: 0.15, hp: 0, elaraGift: true }] },
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
      title: 'Der Sturm auf den Rat',
      description: 'Dringe bis Welle 30 vor, um den Rat zu stürzen.',
      npcId: 'mara',
      type: 'wave',
      chain: 3,
      objectives: [
        { type: 'wave', target: 'reach_wave', current: 0, required: 30 }
      ],
      rewards: { xp: 300 },
      prerequisites: ['schattenrat_finale'],
      requiredAct: 4,
      dialogueOffer: 'Es ist soweit. Der Rat fällt heute. Dringe bis Welle 30 vor.\n\nBist du bereit für den Sturm?',
      dialogueProgress: 'Der Rat wartet in der Tiefe. Dringe weiter vor — Welle 30.',
      dialogueComplete: 'Der Rat ist gestürzt! Fogreach atmet auf. Aber die Schatten sind noch nicht besiegt...'
    },
    // Feature 062: umbenannt von 'harren_rescue'. Akt 4, die Quelle selbst.
    schattenrat_finale: {
      id: 'schattenrat_finale',
      title: 'Die Quelle',
      description: 'Steige auf Tiefe 30 hinab und besiege den Schattenrat, der die Quelle des Nebels hält.',
      npcId: 'harren',
      type: 'boss',
      chain: 2,
      objectives: [
        { type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }
      ],
      rewards: { xp: 250 },
      prerequisites: [],
      requiredAct: 4,
      dialogueOffer: 'Unter der Stadt sitzt das, dem der Nebel dient, über Rat und Widerstand hinaus. Der Schattenrat hält die Quelle auf Tiefe 30. Steig hinab. Danach entscheidest du, was die Stadt erfährt.',
      dialogueProgress: 'Der Schattenrat lebt noch, Tiefe 30.',
      dialogueComplete: 'Der Schattenrat ist gefallen, die Quelle liegt offen. Jetzt gehört die Presse dir. Komm hoch, es ist Zeit.'
    },

    // =======================================================
    // === Feature 062 — neue v4-Quests ===
    // =======================================================
    faction_campaign: {
      id: 'faction_campaign',
      title: 'Das Edikt der Woche',
      description: 'Plakatiere die drei Fraktions-Edikte an den Anschlagtafeln — sammle 3 Proklamationen.',
      npcId: 'aldric',
      type: 'fetch',
      chain: 3,
      // 'proclamation' als Quest-Item-Drop von WP05 (loot.js) verdrahtet.
      objectives: [
        { type: 'fetch', target: 'proclamation', current: 0, required: 3 }
      ],
      rewards: { xp: 60, factionStanding: { magistrat: 1 } },
      prerequisites: ['harren_daughter_investigation'],
      requiredAct: 1,
      dialogueOffer: 'Die Stadt muss wissen, wer die Ordnung hält, während die anderen schwatzen. Häng die drei Edikte an den Anschlagtafeln aus. Wer oben klebt, hat recht.',
      dialogueProgress: 'Noch nicht alle Edikte ausgehängt. Weiter.',
      dialogueComplete: 'Drei Edikte, drei Farben, drei Versionen derselben Tochter. Erst beim letzten fällt dir das Papier auf. Dieselbe Körnung, alle drei. Du hast es in Thoms Druckerei gesehen. Du schiebst den Gedanken beiseite.'
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
      rewards: { xp: 70, factionStanding: { klerus: 1 } },
      prerequisites: [],
      requiredAct: 2,
      dialogueOffer: 'Ein Bezirk ist befallen. Reinige ihn. Wer das Licht scheut, hat etwas zu verbergen. Bring mir die Namen der Befallenen.',
      dialogueProgress: 'Noch nicht gereinigt. Die Befallenen zeigen sich in der Tiefe.',
      dialogueComplete: 'Du bringst die Namen. (Eine Abschrift steckt schon bei Mara, bevor der Rat die Liste sieht. Wer draufsteht, verschwindet. Aber vielleicht nicht mehr alle. Vielleicht warnt jemand rechtzeitig.)'
    },
    garde_night_escort: {
      id: 'garde_night_escort',
      title: 'Nachteskorte',
      description: 'Sichere verdeckt einen nächtlichen Transport — beobachte die Eskorten-Route.',
      npcId: 'stadtwache',
      type: 'observe',
      chain: 3,
      // 'escort_route' als Spionage-Zone von WP05 (espionageSystem.js) verdrahtet.
      objectives: [
        { type: 'observe', target: 'escort_route', current: 0, required: 1 }
      ],
      rewards: { xp: 90, factionStanding: { garde: 1 } },
      prerequisites: [],
      requiredAct: 3,
      dialogueOffer: 'Heute Nacht geht ein Transport. Sicher die Route, frag nicht, was drin ist. Loyalität zahlt sich aus.',
      dialogueProgress: 'Der Transport rollt noch nicht. Halt die Route im Auge, bleib unauffällig.',
      dialogueComplete: 'Die Route ist sicher. (Und in deinem Kopf, Weg, Zeit und Fracht, bereit für Mara. Es waren keine Waffen. Es waren dieselben Phiolen wie im Konvoi.)'
    },
    who_you_were: {
      id: 'who_you_were',
      title: 'Wer du warst',
      description: 'Bring Branka drei Splitter deiner alten Akte aus der Tiefe (ab Tiefe 5).',
      npcId: 'branka',
      type: 'fetch',
      chain: 4,
      minDepth: 5,
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
      dialogueProgress: 'Die Splitter liegen tief — ab Tiefe 5. Such weiter.',
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
        { type: 'observe', target: 'three_hands_seen', current: 0, required: 1 }
      ],
      rewards: { xp: 200, fragments: 2 },
      prerequisites: ['thom_truth', 'elara_ritual'],
      requiredAct: 3,
      dialogueOffer: 'Bevor du das Letzte tust, sollst du wissen, für wen. Komm, nur wir zwei.',
      dialogueProgress: 'Elara wartet mit den drei Blättern.',
      dialogueComplete: 'Drei Blätter, eine Hand. Elara ist Harrens Tochter, und der Widerstand hat kuratiert, nicht der Rat allein. Nicht Branka, nicht Mara. Sie. Aber sie erfindet nichts, sie wählt aus. Merk dir den Unterschied.'
    },

    // Feature 062: 'final_truth' entfernt (ging ins Finale auf). the_reckoning
    // schaltet story_ending frei und macht damit das Story-Ende erreichbar (#44).
    // Objective 'dialogue' (Auto-Complete bei Annahme): die Vier-Regler-
    // Auswertung + Vatermord-Inszenierung kommen mit dem Finale-Folge-Feature.
    the_reckoning: {
      id: 'the_reckoning',
      title: 'Die Abrechnung',
      description: 'Nach dem Sturz des Schattenrats gehört dir die Presse. Entscheide, was die Stadt erfährt.',
      npcId: 'thom',
      type: 'dialogue',
      chain: 6,
      objectives: [
        { type: 'dialogue', target: 'press_decision', current: 0, required: 1 }
      ],
      rewards: { xp: 500, unlocks: ['story_ending'] },
      prerequisites: ['schattenrat_finale'],
      requiredAct: 4,
      dialogueOffer: 'Die Platten liegen, das Archiv ist entschlüsselt. Was ich setze, liest morgen die ganze Stadt. Es ist Zeit.',
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
      'quest.magistrat_verification.description': 'Secure the area — defeat 8 trespassers while the Magistrate handles the paperwork.',
      'quest.klerus_purification.title': 'Purification of the Lower Chambers',
      'quest.klerus_purification.description': 'Cleanse the lower Rathauskeller chambers — defeat 3 elite enemies. The heretic leaders only lurk from depth 3.',
      'quest.garde_patrol_expansion.title': 'Patrol Expansion',
      'quest.garde_patrol_expansion.description': 'Demonstrate force for the new patrols — defeat 10 trespassers.',
      'quest.widerstand_proof.title': 'Evidence from the Ritual Chamber',
      'quest.widerstand_proof.description': 'Find a hidden Council document in a ritual chamber in the Rathauskeller.',
      'quest.council_collusion_reveal.title': 'The Secret Meeting',
      'quest.council_collusion_reveal.description': 'Follow Harren to the secret meeting of the three Council factions.',
      'quest.mara_contact.title': 'The Scout',
      'quest.mara_contact.description': 'Scout three Council cellar rooms for Mara.',
      'quest.elara_meeting.title': "Elara's Secret",
      'quest.elara_meeting.description': 'Find 2 secret documents Elara has hidden.',
      'quest.branka_doubt.title': "The Smith's Doubt",
      'quest.branka_doubt.description': "Defeat 5 elite enemies to find evidence for Branka's suspicions.",
      'quest.elara_ritual.title': 'The Ritual Chamber',
      'quest.elara_ritual.description': 'Reach wave 20 to find the council\'s ritual chamber.',
      'quest.thom_truth.title': 'Forbidden Truths',
      'quest.thom_truth.description': 'Find 5 print plates with the forbidden truths about the council.',
      'quest.mara_warning.title': "Mara's Warning",
      'quest.mara_warning.description': 'Defeat the Chainmaster boss who guards the first real evidence.',
      'quest.branka_weapons.title': 'Weapons for the Resistance',
      'quest.branka_weapons.description': 'Craft 3 items at the Archive Forge.',
      'quest.thom_pamphlets.title': 'The Pamphlets',
      'quest.thom_pamphlets.description': 'Complete 3 deep dungeon runs (from depth 22) to spread the leaflets into the lowest passages.',
      'quest.elara_blade.title': "Elara's Gift",
      'quest.elara_blade.description': 'Elara has forged a special weapon for you.',
      'quest.mara_assault.title': 'Storming the Council',
      'quest.mara_assault.description': 'Reach wave 30 to topple the council.',
      // Feature 062: umbenannt harren_rescue -> schattenrat_finale; final_truth
      // entfernt (-> the_reckoning). Neue/umbenannte Quests ohne EN fallen über
      // die i18n-Kaskade auf Deutsch zurück (Deutsch = Source-of-Truth).
      'quest.schattenrat_finale.title': 'The Source',
      'quest.schattenrat_finale.description': 'Descend to depth 30 and defeat the Shadow Council that holds the source of the fog.',

      // === Quest dialogues — English ===
      'quest.aldric_cleanup.dialogueOffer': 'Wild beasts in the cellars. Clear them out.\n\nWill you take this task?',
      'quest.aldric_cleanup.dialogueProgress': 'The cellars are not safe yet. Keep fighting.',
      'quest.aldric_cleanup.dialogueComplete': 'Good. The cellars are cleared. Here is your reward.',

      'quest.aldric_patrol.dialogueOffer': 'Make sure all corridors are secure. Patrol three rooms.\n\nReady?',
      'quest.aldric_patrol.dialogueProgress': 'Not all corridors are secure yet. Keep patrolling.',
      'quest.aldric_patrol.dialogueComplete': 'All corridors are safe. Good work, Archivesmith.',

      // === Akt 1 Vertical Slice (feature 050) — quest dialogues ===
      'quest.harren_daughter_investigation.dialogueOffer': "My daughter has vanished. Aldric says intruders abducted her. The Clergy speaks of possession. The Guard talks of dereliction of duty.\n\nI trust none of the three until I have read her own words. Bring me the journal fragment she left behind. You'll find it in the Rathauskeller — somewhere the Council has not looked.\n\nTrust no one until you have seen it yourself.",
      'quest.harren_daughter_investigation.dialogueProgress': 'Keep searching — the fragment is down there. Aldric, the Clergy and the Guard quarrel upstairs because each wants its own version. You will find the real one.',
      'quest.harren_daughter_investigation.dialogueComplete': "You have it. She wasn't abducted. She fled. And she had reason — all three Council factions are named in the fragment. You will be approached from four sides now. Hear everyone out. Do all four jobs. Then come back to me.",

      'quest.magistrat_verification.dialogueOffer': 'You have seen the fragment. Good. Then you also know that the daughter must be reclassified — from "fled" to "missing person of interest". A pure administrative matter, you understand. Records must be kept properly.\n\nGo to Branka at the Archive Forge and have the council-sealed verification document made. She will ask questions — do not answer them. The Magistrate carries the responsibility, not the citizen.\n\nDo you accept?',
      'quest.magistrat_verification.dialogueProgress': 'The document must be forged at the Archive Forge. Branka knows the procedure. Go and let her do her work.',
      'quest.magistrat_verification.dialogueComplete': 'Excellent. The document is in the archive. The daughter is now officially a person of interest. What that means in practice is none of your concern. The Magistrate thanks you.',

      'quest.klerus_purification.dialogueOffer': "You have seen the fragment, Archivesmith. Then you know the daughter did not flee of her own will. She was led by a dark hand — the lower chambers teem with such shadows.\n\nPurify them. Three leaders of this heretical presence still lurk down there. Strike them down in the name of Order. The daughter's soul will thank you — if the Light finds her again.\n\nPurification is a sacred duty. Accept it.",
      'quest.klerus_purification.dialogueProgress': 'The leaders lurk deep — only from depth 3. Descend, find them, strike them down. Every heresy you end opens another path to purity.',
      'quest.klerus_purification.dialogueComplete': 'You have broken the heresy. The lower chambers breathe again. Order endures — through you. The Clergy blesses your hand. Bring it onward where the Light demands.',

      'quest.garde_patrol_expansion.dialogueOffer': 'If a daughter can vanish from the Town Hall itself, that is a failure of the Guard — and it will change. I need a patrol expansion. Today. Go into the lower chambers and demonstrate force — ten troublemakers fall, and the edict carries itself through the streets.\n\nDo not ask whether the patrols favor a comfortable way of life. Do not ask who decides where they run. Loyalty is the only coin that counts. The edict is the coin you place in my hand.\n\nDo you accept, Archivesmith?',
      'quest.garde_patrol_expansion.dialogueProgress': 'Ten troublemakers remain. Each fallen body is one more line in the report. The Guard waits on the outcome.',
      'quest.garde_patrol_expansion.dialogueComplete': 'The edict is published. Patrols double tomorrow. No one else will vanish — or at least no one who matters. The Guard remembers who answers quickly.',

      'quest.widerstand_proof.dialogueOffer': "So you found the fragment. Good — you no longer live entirely inside their story. Aldric wants to bring me back. The Clergy wants to burn me. The Guard wants to collect me.\n\nAnd me? I want YOU to see what I have seen before you go on running their errands. Down in the Rathauskeller there is a ritual chamber. There lies a document the three Council factions should never have signed together — and yet all three seals are upon it.\n\nBring it to me. Then we will talk.",
      'quest.widerstand_proof.dialogueProgress': 'Find the ritual chamber. Three rooms deeper. The document is small, but the seal upon it will take your breath away.',
      'quest.widerstand_proof.dialogueComplete': 'Three seals. One signature. Magistrate, Clergy, Guard — in public they pretend to be rivals. Behind closed doors they agree. Go to Harren. He has been waiting for the moment you would understand.',

      'quest.council_collusion_reveal.dialogueOffer': 'Come with me. You must see something. (Climax scene ships in WP03 — this 1-page placeholder keeps Q6 playable in WP02; full 4-page reveal arrives with the next work package.)',
      'quest.council_collusion_reveal.dialogueProgress': 'Follow me. It is time.',
      'quest.council_collusion_reveal.dialogueComplete': 'You have seen it now. The fog was never the weather — it was a story. You have already worked for each of the three masks, and it is only a single face. Act 2 begins here — in the same city, beneath the same masks.',

      // === Feature 050 side-dialogue keys (consumed by WP03) ===
      'sidedialog.branka.q2_eyebrow': 'Branka raises an eyebrow when she sees the Magistrat seal. "Another verification seal. Do you actually know what ends up written on these documents?"',
      'sidedialog.thom.q4_eyebrow': "Thom glances up, then back at the press. \"Patrol expansion. The edict sounds reasonable. Go ask someone at the gazebo what 'reasonable' has meant this month.\"",

      'quest.mara_contact.dialogueOffer': "You don't remember me. But I remember you — you were an Archivesmith before the fog took your memory, and you asked questions the Council wanted buried.\n\nI am the resistance's scout. Before I open my network to you, I want to see whether you can still see: go down and scout three cellar rooms. Mark what the Council hides there.",
      'quest.mara_contact.dialogueProgress': 'Not enough seen yet. Three rooms — and burn each one into your memory.',
      'quest.mara_contact.dialogueComplete': "Three rooms, the same in each: empty cells, fresh chains, lists of names. The missing don't vanish by chance — the Council makes them vanish, and every faction covers for the others.\n\nNow I know you're still the one you were. My network is open to you — there's work only someone no one remembers can do. Like you.",

      'quest.elara_meeting.dialogueOffer': "I wasn't kidnapped. I escaped. Here — read this.\n\nFind two documents I hid in the cellar.",
      'quest.elara_meeting.dialogueProgress': 'The documents are well hidden. Keep searching.',
      'quest.elara_meeting.dialogueComplete': 'Now you see the truth. The council used me — for their rituals.\n\n(The transcripts are in a calm, practiced hand. For something she supposedly hid in the cellar in a panic, they look strangely neat. You push the thought aside.)',

      'quest.branka_doubt.dialogueOffer': 'This armor is for prisoners, not soldiers. Help me find proof.\n\nDefeat five elite guards and bring me their orders.',
      'quest.branka_doubt.dialogueProgress': 'The elite guards carry the proof on them. Keep fighting.',
      'quest.branka_doubt.dialogueComplete': 'I was right. The council is building prisons, not barracks. We must act.',

      // Feature 055 — Akt 2 (Obedience vs. Memory)
      'quest.council_seizure.title': 'Confiscation',
      'quest.council_seizure.description': 'Confiscate the "subversive writings" — collect 3 bundles from the cellars.',
      'quest.council_seizure.dialogueOffer': 'Rabble in the cellars is hoarding subversive writings against the council. Confiscate them — three bundles. Do not read them. Bring them.\n\nWill you take the task?',
      'quest.council_seizure.dialogueProgress': 'Not all writings secured yet. Keep looking.',
      'quest.council_seizure.dialogueComplete': 'Hand them over.\n\n(Before you turn them in, your eye catches a line. These are not pamphlets. They are petitions — citizens asking after vanished kin. You hand them over anyway.)',

      'quest.council_surveillance.title': 'Surveillance',
      'quest.council_surveillance.description': 'Surveil a "restless" district for the council — sight 3 areas.',
      'quest.council_surveillance.dialogueOffer': 'A district is said to be unruly. Sight three areas and report who gathers.\n\nReady?',
      'quest.council_surveillance.dialogueProgress': 'Not all areas sighted yet. Keep watching.',
      'quest.council_surveillance.dialogueComplete': 'Report accepted.\n\n(You saw no conspirators — only families sharing bread and quietly counting who failed to come home next.)',

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
      'quest.bruch_confrontation.dialogueOffer': 'You saw the chamber — and Aldric knows it. His guards are already on you. Cut through and come to me at the forge.\n\nWill you survive it?',
      'quest.bruch_confrontation.dialogueProgress': "Aldric's elite guards hold the deep — you only meet them from depth 8. Descend and fight through.",
      'quest.bruch_confrontation.dialogueComplete': '"You ask too many questions," he said. Now you ask none — you know. The break has come. Mara, Thom, I — we are ready. Act 3 begins.',

      'quest.espionage_convoy.title': 'The Convoy',
      'quest.espionage_convoy.description': 'Shadow a council convoy in the warehouse in disguise and eavesdrop on it.',
      'quest.espionage_convoy.dialogueOffer': 'Tonight they unload a council convoy at the old warehouse. Put on the guard uniform, stay in the shadows and listen — but draw no blade, or the disguise falls.\n\nWill you take this on?',
      'quest.espionage_convoy.dialogueProgress': "You're not close enough yet. Blend in with the guards at the convoy and eavesdrop on what's being unloaded — undetected.",
      'quest.espionage_convoy.dialogueComplete': "You heard it. No supplies, no weapons. Reagents, sealed vials, chalkstones — ritual components. The council isn't sending out a patrol. It's outfitting a summoning. Good that you kept the blade sheathed.",

      'quest.espionage_archive.title': 'The Sealed Archive',
      'quest.espionage_archive.description': 'Infiltrate the council archive in disguise, eavesdrop on the scribes and recover the sealed file.',
      'quest.espionage_archive.dialogueOffer': "In the council's archive lies a sealed file — and I must know what it holds. Go in disguised as a scribe, listen to what the others whisper, and recover the file. Do not be seen.\n\nWill you do this for me?",
      'quest.espionage_archive.dialogueProgress': 'The scribes have said nothing useful yet. Stay in the archive, inconspicuous, and keep eavesdropping until you reach the sealed file.',
      'quest.espionage_archive.dialogueComplete': '"Missing, case closed" — Elara\'s disappearance, neatly filed, date, seal, signature. Too neat. Someone fleeing in panic leaves no tidily archived record. And the date... it falls before the day Harren told me about. I say nothing yet. But something about this file is wrong.',

      'quest.espionage_informant.title': 'The Mole',
      'quest.espionage_informant.description': "Unmask a council mole within the resistance's ranks, in disguise.",
      'quest.espionage_informant.dialogueOffer': 'Someone is betraying us. Whatever we decide behind closed doors, the council knows it by next morning. Blend in disguised among our own people at the meeting point and find out who the mole is. Move quietly — they do not know your face in this getup.\n\nWill you find the traitor?',
      'quest.espionage_informant.dialogueProgress': "You don't have the mole yet. Stay inconspicuous at the meeting point and listen for who smuggles messages outside.",
      'quest.espionage_informant.dialogueComplete': "You saw the handoff. A folded note, a hand, a word — and in the handwriting the same cleanly drawn curve as on the records someone from inside the council slipped us. The trail points inward, closer than we'd like. I name no name. But from now on, trust no one blindly — not even those who bring us \"the truth.\"",

      'quest.elara_ritual.dialogueOffer': "Deep below there is a chamber... I'll show you where. Reach wave 20.\n\nAre you ready for the truth?",
      'quest.elara_ritual.dialogueProgress': 'You must press deeper. The ritual chamber lies at wave 20.',
      'quest.elara_ritual.dialogueComplete': "You found it. The council's summoning chamber. Take this amulet — it shields against their dark magic.",

      'quest.thom_truth.dialogueOffer': "I've printed enough of what the council wants. Time for the truth.\n\nFind five print plates in the cellar — they hold the real history.",
      'quest.thom_truth.dialogueProgress': 'The print plates are hidden somewhere in the town hall cellar. Keep searching.',
      'quest.thom_truth.dialogueComplete': 'Fantastic! These plates contain proof the council wanted to destroy. The truth goes to print.',

      'quest.mara_warning.dialogueOffer': 'The Chainmaster guards the first real evidence. Defeat him.\n\nWithout that proof we can prove nothing.',
      'quest.mara_warning.dialogueProgress': 'The Chainmaster still lives. Find and defeat him.',
      'quest.mara_warning.dialogueComplete': 'The Chainmaster has fallen! The evidence is secure. Now no one can deny what the council has done.',

      'quest.branka_weapons.dialogueOffer': 'We need weapons. Not for the council — for US.\n\nCraft three items at the forge.',
      'quest.branka_weapons.dialogueProgress': 'The forge waits. Craft more items.',
      'quest.branka_weapons.dialogueComplete': 'Well forged. These weapons will make the difference.',

      'quest.thom_pamphlets.dialogueOffer': 'Every run is a chance to spread leaflets.\n\nComplete three runs and all of Fogreach will read the truth.',
      'quest.thom_pamphlets.dialogueProgress': 'Only deep runs count — from depth 22. Complete three; each spreads our message into the lowest passages.',
      'quest.thom_pamphlets.dialogueComplete': 'The whole city reads our truths! The citizens have awakened. Your experience now grows faster. (+10% XP)',

      'quest.elara_blade.dialogueOffer': "Take this. I forged it for you. In case...\n\nWill you accept Elara's Blade?",
      'quest.elara_blade.dialogueProgress': 'The blade waits for you.',
      'quest.elara_blade.dialogueComplete': 'May it protect you. No matter what comes.',

      'quest.mara_assault.dialogueOffer': "It's time. The council falls today. Reach wave 30.\n\nAre you ready for the assault?",
      'quest.mara_assault.dialogueProgress': 'The council waits in the depths. Press on — wave 30.',
      'quest.mara_assault.dialogueComplete': 'The council has fallen! Fogreach breathes again. But the shadows are not yet defeated...',

      'quest.schattenrat_finale.dialogueOffer': 'Beneath the city sits that which the fog serves, beyond council and resistance. The Shadow Council holds the source at depth 30. Descend. Then you decide what the city learns.',
      'quest.schattenrat_finale.dialogueProgress': 'The Shadow Council still lives, depth 30.',
      'quest.schattenrat_finale.dialogueComplete': 'The Shadow Council has fallen, the source lies open. The press is yours now. Come up, it is time.',

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
      // offered if the predicate returns true. Used for faction-standing
      // gating; the predicate runs on every offer-list refresh, so it
      // dynamically appears/disappears as standing changes.
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

    questState[questId].status = 'completed';

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
          var idx = inventory.findIndex(function (slot) { return !slot; });
          if (idx >= 0) inventory[idx] = Object.assign({}, item);
          else inventory[0] = Object.assign({}, item);
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

    // Feature 050: faction-standing reward dispatcher. Each entry in
    // rewards.factionStanding is applied via FactionSystem.adjustStanding
    // (which fires its existing toast subscribers). Backward-compatible —
    // legacy quests without this field are unaffected.
    if (rewards && rewards.factionStanding && window.FactionSystem
        && typeof window.FactionSystem.adjustStanding === 'function') {
      try {
        Object.keys(rewards.factionStanding).forEach(function (factionId) {
          var delta = rewards.factionStanding[factionId];
          if (typeof delta === 'number' && delta !== 0) {
            window.FactionSystem.adjustStanding(factionId, delta);
            console.log('[QuestSystem] Granted ' + (delta > 0 ? '+' : '') + delta + ' ' + factionId + ' standing');
          }
        });
      } catch (err) {
        console.warn('[QuestSystem] factionStanding grant failed', err);
      }
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
    onWaveCompleted: onWaveCompleted,
    onDungeonCompleted: onDungeonCompleted,
    onBossKilled: onBossKilled,
    onItemCrafted: onItemCrafted,
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
