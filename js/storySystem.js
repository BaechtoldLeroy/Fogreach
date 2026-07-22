// js/storySystem.js — Narrative Story Progression for Demonfall

(function () {
  'use strict';

  // ---- Act Definitions (Feature 062, v4-Doppelagenten-Struktur) ----
  // Fünf Akte (Index 0-4). Die internen ids bleiben aus Kompatibilität
  // erhalten (ACT_NARRATIVES, NPC_DIALOGUE und die i18n-Keys hängen daran) —
  // nur die ANZEIGENAMEN sind v4. Die alten Akte 5/6 (rebellion/offenbarung)
  // entfallen; das Ende ist jetzt Teil von Akt 4. triggerWave/triggerQuests
  // sind weg (nur das entfernte _computeActIndex nutzte sie — Aufstieg ist rein
  // quest-getrieben).
  const STORY_ACTS = [
    { id: 'auftrag',       name: 'Der Dienst' },
    { id: 'treuer_diener', name: 'Treuer Diener' },
    { id: 'erste_risse',   name: 'Das Doppelspiel' },
    { id: 'wahrheit',      name: 'Die Enttarnung' },
    { id: 'bruch',         name: 'Der Verrat und die Presse' }
  ];

  // ---- Narrative texts shown at act transitions ----
  const ACT_NARRATIVES = {
    auftrag:       'Du erwachst in der Archivschmiede. Dein Kopf dröhnt. Ein Mann in Ratsketten steht über dir: \'Der Keller muss gesäubert werden, Archivschmied. Wilde Tiere treiben sich dort herum.\'',
    treuer_diener: 'Ratsherr Aldric klopft dir auf die Schulter. \'Gut gemacht. Aber es gibt grössere Bedrohungen — Eindringlinge stehlen unsere Archive. Wir brauchen dich.\'',
    erste_risse:   'Die Dokumente des besiegten Anführers tragen das Siegel des Kettenrats. Aldric lacht nervös: \'Fälschungen. Natürlich Fälschungen.\' Aber Branka blickt dir schweigend in die Augen.',
    wahrheit:      'In der Ritualkammer: Blut, Symbole, Ketten. Das ist kein Lager der Eindringlinge. Das ist eine Beschwörungskammer. Der Rat lügt.',
    bruch:         '\'Du stellst zu viele Fragen, Archivschmied.\' Aldrics Stimme ist kalt. Hinter ihm stehen bewaffnete Wachen. \'Erledige deinen Auftrag — oder wir erledigen dich.\''
  };

  // ---- Dynamic NPC dialogue per act ----
  const NPC_DIALOGUE = {
    aldric: {
      auftrag: [
        'Der Keller ist voller Ungeziefer. Räum das auf, Archivschmied.',
        'Der Rat hat dich aus gutem Grund hierher gestellt. Zeig, dass du nützlich bist.',
        'Frag nicht so viel. Tu einfach, was man dir sagt.'
      ],
      treuer_diener: [
        'Du hast dich bewährt. Jetzt kommen die wahren Aufgaben.',
        'Eindringlinge bedrohen unsere Archive. Stoppe sie, bevor sie Schaden anrichten.',
        'Der Rat vertraut dir. Enttäusche uns nicht.'
      ],
      erste_risse: [
        'Fälschungen, sage ich dir! Glaub nicht alles, was du findest.',
        'Manche Dokumente sind... vertraulich. Lass die Finger davon.',
        'Du arbeitest für den Rat. Vergiss das nicht.'
      ],
      wahrheit: [
        'Was du gesehen hast, bleibt unter uns. Verstanden?',
        'Der Rat hat seine Gründe. Hinterfrage sie nicht.',
        'Noch kannst du zurück. Wähle weise, Archivschmied.'
      ],
      bruch: [
        'Du stellst zu viele Fragen. Das endet nie gut.',
        'Ich habe dich gewarnt. Der Rat ist nicht geduldig.',
        'Letzte Chance, Archivschmied. Gehorche — oder verschwinde.'
      ]
    },
    branka: {
      auftrag: [
        'Stahl allein schneidet die Lügen des Rates nicht. Erst wenn jede Klinge Wissen trägt, fällt ihre Maske.',
        'Im Keller unter dem Rathaus lagern Protokolle aus Dämonenverhören. Bring mir Abschriften, und ich veredele deine Artefakte.',
        'Sprich draussen leise. Die Aufseher des Kettenrats tragen inzwischen die Farben der Stadtgarde.'
      ],
      treuer_diener: [
        'Deine Fortschritte sind bemerkenswert. Die alten Protokolle enthalten mehr, als der Rat zugeben will.',
        'Ich habe verbotene Schmiedetechniken gefunden. Die Dämonen selbst haben sie einst gelehrt.',
        'Der Rat verbietet bestimmte Legierungen. Frag dich, warum.'
      ],
      erste_risse: [
        'Diese Rüstungen... die Masse stimmen nicht. Sie sind für Gefangene, nicht für Soldaten.',
        'Ich schmiede, was der Rat verlangt. Aber ich beginne zu zweifeln.',
        'Jemand muss die Wahrheit herausfinden. Bist du bereit?'
      ],
      wahrheit: [
        'Die Siegel unter dem Rathaus pulsieren stärker. Jemand füttert sie mit Angst.',
        'Ich schmiede jetzt im Verborgenen. Der Rat darf nichts von den neuen Klingen erfahren.',
        'Jede Waffe, die ich fertige, trägt ein Zeichen des Widerstands.'
      ],
      bruch: [
        'Der Rat hat meine Werkstatt durchsucht. Sie wissen, dass ich zweifle.',
        'Wir brauchen Waffen. Nicht für den Rat — für UNS.',
        'Die Zeit der Geheimnisse ist vorbei. Wir müssen handeln.'
      ]
    },
    thom: {
      auftrag: [
        'Der Kettenrat verordnet Gebete, Mahlzeiten, sogar Träume. Wir antworten mit Pamphleten voller Namen und Zahlen.',
        'Bring mir Beweise aus dem Rathauskeller. Jede Spalte, die wir drucken, nimmt der Angst einen Zoll.',
        'Verteile nichts Ungeprüftes. Eine falsche Zeile, und sie sperren wieder zehn Familien ein.'
      ],
      treuer_diener: [
        'Die ersten Beweise sind erschütternd. Der Rat hat Dämonen nicht verbannt — er hat sie eingeladen.',
        'Meine Druckerpresse läuft heiss. Die Wahrheit will ans Licht.',
        'Jedes Dokument, das du findest, ist eine Kugel gegen die Lügen des Rates.'
      ],
      erste_risse: [
        'Die Dokumente, die du gefunden hast... sie tragen das Siegel des Rats. Offiziell.',
        'Ich drucke seit Jahren. Aber das hier — das ist grösser als alles zuvor.',
        'Wir müssen vorsichtig sein. Der Rat hat Augen überall.'
      ],
      wahrheit: [
        'Ich habe genug gedruckt, was der Rat will. Zeit für die Wahrheit.',
        'Die Druckerpresse braucht mehr Tinte. Die Wahrheit ist umfangreicher als gedacht.',
        'Ich drucke jetzt auch Karten der unterirdischen Gänge. Mara liefert die Skizzen.'
      ],
      bruch: [
        'Der Rat hat meine alte Presse zerstört. Aber ich habe längst drei neue versteckt.',
        'Jeder Durchlauf ist eine Chance, Flugblätter zu verteilen.',
        'Die Bürger müssen wissen, was unter ihren Füssen geschieht.'
      ]
    },
    mara: {
      auftrag: [
        'Die Schreiber des Rates markieren Häuser mit Kreideketten. Wer widerspricht, verschwindet in Ritualschachten.',
        'Der Zeremonienmeister besitzt neue Siegel. Sie holen Dämonen als stilles Archiv.',
        'Sichere Augen im Rathauskeller. Jedes Siegel, das du brichst, lockert ihre Ketten an der Stadt.'
      ],
      treuer_diener: [
        'Meine Späher haben neue Gänge unter dem Rathaus entdeckt. Die Siegel werden stärker.',
        'Der Zeremonienmeister wechselt seine Routen. Er ahnt, dass wir ihm folgen.',
        'Jedes gebrochene Siegel schwächt seinen Griff. Mach weiter.'
      ],
      erste_risse: [
        'Du erinnerst dich nicht. Aber ich kenne dich.',
        'Die Risse in der Fassade des Rats werden grösser. Nutze sie.',
        'Vertraue nicht blind. Auch nicht mir. Aber hör zu.'
      ],
      wahrheit: [
        'Der Kettenmeister bewacht die ersten echten Beweise. Besiege ihn.',
        'Die unterirdischen Gänge führen tiefer als gedacht. Dort unten lebt etwas.',
        'Ich habe Karten gezeichnet. Die Siegel bilden ein Muster — ein Beschwörungskreis unter der ganzen Stadt.'
      ],
      bruch: [
        'Aldric hat seine Maske fallen lassen. Gut. Jetzt wissen alle, woran sie sind.',
        'Mein Netzwerk ist bereit. Wir brauchen nur noch den Funken.',
        'Wir müssen vorsichtig sein. Der Zeremonienmeister weiss, dass wir kommen.'
      ]
    },
    harren: {
      auftrag: [
        'Ich bin nur ein alter Handwerker. Aber meine Tochter... sie ist alles, was ich habe.',
        'Hast du Elara gesehen? Sie ist seit Wochen verschwunden.',
        'Der Rat sagt, sie sei in Sicherheit. Aber ich glaube ihnen nicht.'
      ],
      treuer_diener: [
        'Bitte, finde meine Tochter. Ich flehe dich an.',
        'Mara hat mir erzählt, du seist vertrauenswürdig. Hilf mir.',
        'Elara hat ein Tagebuch geführt. Wenn du es findest...'
      ],
      erste_risse: [
        'Du hast Hinweise gefunden? Erzähl mir alles!',
        'Elara lebt... das ist alles, was zählt.',
        'Was hat der Rat mit meiner Tochter zu tun?'
      ],
      wahrheit: [
        'Der Rat hat meine Tochter benutzt? Für ihre Rituale?',
        'Ich werde ihnen nie vergeben. Nie.',
        'Finde Elara. Bring sie zurück. Bitte.'
      ],
      bruch: [
        'Aldric hat uns alle belogen. Auch über Elara.',
        'Meine Tochter ist stärker, als sie denken. Sie wird überleben.',
        'Ich bin zu alt zum Kämpfen. Aber ich kann helfen.'
      ]
    },
    elara: {
      erste_risse: [
        'Ich bin nicht entführt worden. Ich bin geflohen.',
        'Hier — lies das. Dann verstehst du.',
        'Der Rat hat mich benutzt. Aber ich habe gelernt.'
      ],
      wahrheit: [
        'Tief unten ist eine Kammer... ich zeige dir wo.',
        'Die Rituale des Rats nutzen menschliche Energie. Meine Energie.',
        'Ich kenne ihre Geheimnisse. Alle.'
      ],
      bruch: [
        'Nimm das. Ich habe es für dich geschmiedet. Für den Fall, dass...',
        'Aldric wird dich jagen. Sei vorsichtig.',
        'Ich muss allein weiter. Vertrau mir.'
      ]
    }
  };

  // ---- Wave Milestone Events (ENTFERNT) ----
  // Die "Tiefe N erreicht"-Splashes (Wave 5/10/15/20/30/40) wurden entfernt: sie
  // trugen keine Story mehr (die Akte laufen seit v4 rein quest-getrieben) und
  // häuften sich beim Hub-Rücksprung mit den Akt-Titelkarten. Die "Tiefe
  // erreicht"-Info liefert ohnehin die Run-Summary. Kein pendingMilestone,
  // kein Priority-2-Zweig in consumePendingEvent mehr.

  // ---- Special Ending Text ----
  const ALL_QUESTS_ENDING = 'Die Ketten von Fogreach sind gebrochen.\n\nDie Druckerpresse verbreitet die Wahrheit.\nDie Schmiede hämmert für die Freiheit.\nDas Untergrund-Netzwerk wacht.\n\nDoch wo Elara einst stand, ist nur Leere. Sie verschwand mit dem Schattenrat — und mit ihr eine Wahrheit, die du nie ganz begreifen wirst.\n\nDu hast die Stadt befreit. Doch der Nebel flüstert noch ihren Namen.';

  // ---- i18n bootstrap ----
  // Auto-register all German strings so consumers + EN translations can layer
  // on top. Convert STORY_ACTS[].name into getters so external readers (HUD,
  // journal) automatically follow the active language.
  if (window.i18n) {
    var _autoStoryDe = {};
    STORY_ACTS.forEach(function (a) {
      _autoStoryDe['story.act.' + a.id + '.name'] = a.name;
      _autoStoryDe['story.act.' + a.id + '.narrative'] = ACT_NARRATIVES[a.id] || '';
    });
    _autoStoryDe['story.all_quests_ending'] = ALL_QUESTS_ENDING;
    // NPC dialogues: register every line under story.npc.<npcId>.<actId>.<index>
    Object.keys(NPC_DIALOGUE).forEach(function (npcId) {
      var byAct = NPC_DIALOGUE[npcId] || {};
      Object.keys(byAct).forEach(function (actId) {
        var lines = byAct[actId] || [];
        lines.forEach(function (line, i) {
          _autoStoryDe['story.npc.' + npcId + '.' + actId + '.' + i] = line;
        });
      });
    });
    window.i18n.register('de', _autoStoryDe);

    // English translations: act names, narratives, milestones, ending,
    // generic UI helpers. NPC act-dialogues fall back to German via the
    // i18n cascade until iterative translation work fills them in (~150
    // lines of lore-heavy text).
    window.i18n.register('en', {
      // Feature 062: v4-Aktnamen (Index 0-4). rebellion/offenbarung entfallen.
      'story.act.auftrag.name': 'The Service',
      'story.act.treuer_diener.name': 'The Loyal Servant',
      'story.act.erste_risse.name': 'The Double Game',
      'story.act.wahrheit.name': 'The Unmasking',
      'story.act.bruch.name': 'The Betrayal and the Press',

      'story.act.auftrag.narrative': "You wake in the Archive Forge. Your head throbs. A man in council chains stands over you: 'The cellar must be cleansed, Archivesmith. Wild beasts are loose down there.'",
      'story.act.treuer_diener.narrative': "Councillor Aldric pats your shoulder. 'Well done. But greater threats remain — intruders are stealing our archives. We need you.'",
      'story.act.erste_risse.narrative': "The defeated leader's documents bear the Chain Council's seal. Aldric laughs nervously: 'Forgeries. Forgeries, of course.' But Branka stares at you in silence.",
      'story.act.wahrheit.narrative': 'In the ritual chamber: blood, symbols, chains. This is no intruder camp. This is a summoning chamber. The council lies.',
      'story.act.bruch.narrative': "'You ask too many questions, Archivesmith.' Aldric's voice is cold. Armed guards stand behind him. 'Finish your assignment — or we will finish you.'",

      'story.all_quests_ending': "The chains of Fogreach are broken.\n\nThe printing press spreads the truth.\nThe forge hammers for freedom.\nThe underground network keeps watch.\n\nBut where Elara once stood, there is only emptiness. She vanished with the Shadow Council — and with her, a truth you may never fully grasp.\n\nYou have freed the city. Yet the fog still whispers her name.",

      'story.epilog.label': 'Epilogue',
      'story.unlock.enhanced_crafting': 'Advanced Crafting',
      'story.unlock.xp_bonus_10': '+10% XP',
      'story.unlock.shadow_skill': 'Shadow Arts',
      'story.unlock.story_ending': 'Epilogue',
      'story.unlock.elara_trust': "Elara's Trust",

      // === NPC dialogues — English ===
      // aldric — councillor / antagonist
      'story.npc.aldric.auftrag.0': "The cellar is full of vermin. Clean it up, Archivesmith.",
      'story.npc.aldric.auftrag.1': "The council placed you here for good reason. Show that you're useful.",
      'story.npc.aldric.auftrag.2': "Don't ask so many questions. Just do what you're told.",
      'story.npc.aldric.treuer_diener.0': "You've proven yourself. Now the real tasks begin.",
      'story.npc.aldric.treuer_diener.1': "Intruders threaten our archives. Stop them before they cause damage.",
      'story.npc.aldric.treuer_diener.2': "The council trusts you. Do not disappoint us.",
      'story.npc.aldric.erste_risse.0': "Forgeries, I tell you! Don't believe everything you find.",
      'story.npc.aldric.erste_risse.1': "Some documents are... confidential. Keep your hands off.",
      'story.npc.aldric.erste_risse.2': "You work for the council. Don't forget that.",
      'story.npc.aldric.wahrheit.0': "What you've seen stays between us. Understood?",
      'story.npc.aldric.wahrheit.1': "The council has its reasons. Do not question them.",
      'story.npc.aldric.wahrheit.2': "You can still turn back. Choose wisely, Archivesmith.",
      'story.npc.aldric.bruch.0': "You ask too many questions. That never ends well.",
      'story.npc.aldric.bruch.1': "I warned you. The council is not patient.",
      'story.npc.aldric.bruch.2': "Last chance, Archivesmith. Obey — or disappear.",

      // branka — smith / ally
      'story.npc.branka.auftrag.0': "Steel alone does not cut the council's lies. Only when every blade carries knowledge does their mask fall.",
      'story.npc.branka.auftrag.1': "Records of demon interrogations are stored beneath the town hall. Bring me transcripts and I'll refine your artifacts.",
      'story.npc.branka.auftrag.2': "Speak quietly outside. The Chain Council's overseers now wear the city guard's colors.",
      'story.npc.branka.treuer_diener.0': "Your progress is remarkable. The old records contain more than the council will admit.",
      'story.npc.branka.treuer_diener.1': "I've found forbidden smithing techniques. The demons themselves once taught them.",
      'story.npc.branka.treuer_diener.2': "The council forbids certain alloys. Ask yourself why.",
      'story.npc.branka.erste_risse.0': "This armor... the dimensions are wrong. It's for prisoners, not soldiers.",
      'story.npc.branka.erste_risse.1': "I forge what the council demands. But I am beginning to doubt.",
      'story.npc.branka.erste_risse.2': "Someone has to find the truth. Are you ready?",
      'story.npc.branka.wahrheit.0': "The seals beneath the town hall pulse stronger. Someone is feeding them with fear.",
      'story.npc.branka.wahrheit.1': "I now forge in secret. The council must learn nothing of the new blades.",
      'story.npc.branka.wahrheit.2': "Every weapon I finish carries a mark of the resistance.",
      'story.npc.branka.bruch.0': "The council searched my workshop. They know I doubt.",
      'story.npc.branka.bruch.1': "We need weapons. Not for the council — for US.",
      'story.npc.branka.bruch.2': "The time of secrets is over. We must act.",

      // thom — printer / propagandist-turned-rebel
      'story.npc.thom.auftrag.0': "The Chain Council orders prayers, meals, even dreams. We answer with pamphlets full of names and numbers.",
      'story.npc.thom.auftrag.1': "Bring me proof from the town hall cellar. Every column we print takes an inch from fear.",
      'story.npc.thom.auftrag.2': "Distribute nothing unverified. One false line and they lock up ten more families.",
      'story.npc.thom.treuer_diener.0': "The first proofs are devastating. The council did not banish demons — it invited them.",
      'story.npc.thom.treuer_diener.1': "My printing press runs hot. The truth wants to come out.",
      'story.npc.thom.treuer_diener.2': "Every document you find is a bullet against the council's lies.",
      'story.npc.thom.erste_risse.0': "The documents you found... they bear the council's seal. Official.",
      'story.npc.thom.erste_risse.1': "I've been printing for years. But this — this is bigger than anything before.",
      'story.npc.thom.erste_risse.2': "We must be careful. The council has eyes everywhere.",
      'story.npc.thom.wahrheit.0': "I've printed enough of what the council wants. Time for the truth.",
      'story.npc.thom.wahrheit.1': "The press needs more ink. The truth is more extensive than thought.",
      'story.npc.thom.wahrheit.2': "I now also print maps of the underground passages. Mara provides the sketches.",
      'story.npc.thom.bruch.0': "The council destroyed my old press. But I hid three new ones long ago.",
      'story.npc.thom.bruch.1': "Every run is a chance to spread leaflets.",
      'story.npc.thom.bruch.2': "The citizens must know what happens beneath their feet.",

      // mara — scout / network leader
      'story.npc.mara.auftrag.0': "The council's scribes mark houses with chalk-chains. Whoever objects vanishes into ritual shafts.",
      'story.npc.mara.auftrag.1': "The Ceremoniarch holds new seals. They summon demons as silent archives.",
      'story.npc.mara.auftrag.2': "Watchful eyes in the town hall cellar. Every seal you break loosens their chains on the city.",
      'story.npc.mara.treuer_diener.0': "My scouts have found new passages beneath the town hall. The seals grow stronger.",
      'story.npc.mara.treuer_diener.1': "The Ceremoniarch changes his routes. He suspects we follow him.",
      'story.npc.mara.treuer_diener.2': "Every broken seal weakens his grip. Keep going.",
      'story.npc.mara.erste_risse.0': "You don't remember. But I know you.",
      'story.npc.mara.erste_risse.1': "The cracks in the council's facade are growing. Use them.",
      'story.npc.mara.erste_risse.2': "Don't trust blindly. Not even me. But listen.",
      'story.npc.mara.wahrheit.0': "The Chainmaster guards the first real evidence. Defeat him.",
      'story.npc.mara.wahrheit.1': "The underground passages run deeper than thought. Something lives down there.",
      'story.npc.mara.wahrheit.2': "I've drawn maps. The seals form a pattern — a summoning circle beneath the entire city.",
      'story.npc.mara.bruch.0': "Aldric has dropped his mask. Good. Now everyone knows where they stand.",
      'story.npc.mara.bruch.1': "My network is ready. We just need the spark.",
      'story.npc.mara.bruch.2': "We must be careful. The Ceremoniarch knows we are coming.",

      // harren — the missing daughter's father
      'story.npc.harren.auftrag.0': "I'm only an old craftsman. But my daughter... she's all I have.",
      'story.npc.harren.auftrag.1': "Have you seen Elara? She's been missing for weeks.",
      'story.npc.harren.auftrag.2': "The council says she's safe. But I don't believe them.",
      'story.npc.harren.treuer_diener.0': "Please, find my daughter. I'm begging you.",
      'story.npc.harren.treuer_diener.1': "Mara told me you're trustworthy. Help me.",
      'story.npc.harren.treuer_diener.2': "Elara kept a diary. If you find it...",
      'story.npc.harren.erste_risse.0': "You found leads? Tell me everything!",
      'story.npc.harren.erste_risse.1': "Elara is alive... that's all that matters.",
      'story.npc.harren.erste_risse.2': "What does the council want with my daughter?",
      'story.npc.harren.wahrheit.0': "The council used my daughter? For their rituals?",
      'story.npc.harren.wahrheit.1': "I will never forgive them. Never.",
      'story.npc.harren.wahrheit.2': "Find Elara. Bring her back. Please.",
      'story.npc.harren.bruch.0': "Aldric lied to us all. Even about Elara.",
      'story.npc.harren.bruch.1': "My daughter is stronger than they think. She will survive.",
      'story.npc.harren.bruch.2': "I'm too old to fight. But I can help.",

      // elara — the daughter / morally complex
      'story.npc.elara.erste_risse.0': "I wasn't kidnapped. I escaped.",
      'story.npc.elara.erste_risse.1': "Here — read this. Then you'll understand.",
      'story.npc.elara.erste_risse.2': "The council used me. But I learned.",
      'story.npc.elara.wahrheit.0': "Deep below there is a chamber... I'll show you where.",
      'story.npc.elara.wahrheit.1': "The council's rituals use human energy. My energy.",
      'story.npc.elara.wahrheit.2': "I know all their secrets.",
      'story.npc.elara.bruch.0': "Take this. I forged it for you. In case...",
      'story.npc.elara.bruch.1': "Aldric will hunt you. Be careful.",
      'story.npc.elara.bruch.2': "I have to go on alone. Trust me."
    });

    // German registrations for unlock labels (DE source-of-truth, supplement)
    window.i18n.register('de', {
      'story.epilog.label': 'Epilog',
      'story.unlock.enhanced_crafting': 'Erweiterte Schmiede',
      'story.unlock.xp_bonus_10': '+10% XP',
      'story.unlock.shadow_skill': 'Schattenkunst',
      'story.unlock.story_ending': 'Epilog',
      'story.unlock.elara_trust': 'Elaras Vertrauen'
    });

    // Convert STORY_ACTS[].name into getters
    STORY_ACTS.forEach(function (a) {
      var nameKey = 'story.act.' + a.id + '.name';
      try {
        Object.defineProperty(a, 'name', {
          get: function () {
            var v = window.i18n.t(nameKey);
            return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : a.id;
          },
          configurable: true, enumerable: true
        });
      } catch (e) { /* swallow */ }
    });
  }

  // i18n-aware accessors: prefer these over reading the raw maps directly
  // so consumers automatically follow the active language.
  function _i18nLookup(key, fallback) {
    if (!window.i18n) return fallback;
    var v = window.i18n.t(key);
    return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : fallback;
  }
  function getActNarrative(actId) {
    return _i18nLookup('story.act.' + actId + '.narrative', ACT_NARRATIVES[actId] || '');
  }
  function getAllQuestsEnding() {
    return _i18nLookup('story.all_quests_ending', ALL_QUESTS_ENDING);
  }

  // ---- Story State ----
  let storyState = {
    currentActIndex: 0,
    highestWave: 0,
    eventsSeen: [],       // act IDs whose narrative overlay has been shown
    pendingEvent: null,   // act ID to show on next hub visit
    endingShown: false,   // whether the all-quests-complete ending has been shown
    totalKills: 0,
    totalRoomsCleared: 0,
    totalWavesSurvived: 0
  };

  // ---- Core Functions ----

  function getCurrentAct() {
    return STORY_ACTS[storyState.currentActIndex] || STORY_ACTS[0];
  }

  function getCurrentActIndex() {
    return storyState.currentActIndex;
  }

  function getActById(actId) {
    return STORY_ACTS.find(function (a) { return a.id === actId; });
  }

  // Feature 062: _computeActIndex + _getCompletedQuestCount (tiefen-/quest-zahl-
  // basierter Aufstieg) entfernt. Sie waren seit Feature 050 tot — der Aufstieg
  // ist rein quest-getrieben über advanceToAct(). Damit fielen auch die
  // triggerWave/triggerQuests-Felder in STORY_ACTS weg.

  // Feature 050 FR-08: explicit quest-triggered act advancement.
  // The legacy onWaveCompleted/onBossKilled paths advance acts derivatively
  // (highestWave + completedQuestCount → _computeActIndex). Quest 6
  // ("council_collusion_reveal") needs to jump the player to Act 2 = index 2
  // (erste_risse) on completion, regardless of wave progress. This is the
  // single explicit hook for that — guards against same-or-lower so it's
  // idempotent and can't accidentally roll the story back.
  function advanceToAct(targetActIndex) {
    if (typeof targetActIndex !== 'number' || !isFinite(targetActIndex)) return false;
    var clamped = Math.max(0, Math.min(STORY_ACTS.length - 1, Math.floor(targetActIndex)));
    if (clamped <= storyState.currentActIndex) return false;
    var newAct = STORY_ACTS[clamped];
    storyState.currentActIndex = clamped;
    if (storyState.eventsSeen.indexOf(newAct.id) === -1) {
      storyState.pendingEvent = newAct.id;
    }
    try { console.log('[StorySystem] Act jump -> ' + newAct.name + ' (Act ' + (clamped + 1) + ') via advanceToAct'); } catch (_) {}
    return true;
  }

  // Feature 062: expliziter Reset auf Akt 0. advanceToAct ist monoton (nur
  // aufwärts) — beim Laden eines Alt-Spielstands (questSystem.loadQuestSaveData
  // mit storyVersion < 4) muss der Akt hart auf 0 zurück. Setzt die narrative
  // Fortschritts-Sicht zurück (Akt, gesehene Ereignisse, Pending-Splashes),
  // damit die neue Story von vorn beginnt.
  function resetToAct0() {
    storyState.currentActIndex = 0;
    storyState.eventsSeen = [];
    storyState.pendingEvent = null;
    storyState.endingShown = false;
    try { console.log('[StorySystem] Reset auf Akt 0 (Story v4).'); } catch (_) {}
    return true;
  }

  /**
   * Called after a wave is completed. Records the wave for stats. Does NOT
   * advance the story act (quest-driven via advanceToAct() since feature 050)
   * and no longer queues a "Tiefe N erreicht"-Splash (die Meilensteine wurden
   * entfernt — siehe Kommentar oben bei WAVE_MILESTONES).
   */
  function onWaveCompleted(waveNumber) {
    var wave = Math.max(1, waveNumber || 0);
    if (wave > storyState.highestWave) {
      storyState.highestWave = wave;
    }
    storyState.totalWavesSurvived = (storyState.totalWavesSurvived || 0) + 1;

    // Depth-based act advancement REMOVED (feature 050 / Q6 owns this).
    // The story arc is now entirely quest-driven — players can dive to any
    // wave depth in Akt 1 without accidentally jumping the story forward.
    return false;
  }

  /**
   * Track enemy kill for stats.
   */
  function onEnemyKilled() {
    storyState.totalKills = (storyState.totalKills || 0) + 1;
  }

  /**
   * Track room cleared for stats.
   */
  function onRoomCleared() {
    storyState.totalRoomsCleared = (storyState.totalRoomsCleared || 0) + 1;
  }

  /**
   * Check for pending story events (call on hub create).
   * Returns { actId, actName, narrative } or null.
   */
  function consumePendingEvent() {
    // Priority 1: Act transitions
    if (storyState.pendingEvent) {
      var actId = storyState.pendingEvent;
      storyState.pendingEvent = null;
      storyState.eventsSeen.push(actId);

      var act = getActById(actId);
      return {
        actId: actId,
        actName: act ? act.name : actId,
        actNumber: act ? STORY_ACTS.indexOf(act) + 1 : 0,
        narrative: getActNarrative(actId)
      };
    }

    // Priority 2: All quest chains complete ending
    if (!storyState.endingShown && window.questSystem && typeof window.questSystem.areAllQuestChainsComplete === 'function') {
      if (window.questSystem.areAllQuestChainsComplete()) {
        storyState.endingShown = true;
        return {
          actId: 'ending',
          actName: _i18nLookup('story.epilog.label', 'Epilog'),
          actNumber: null,
          narrative: getAllQuestsEnding()
        };
      }
    }

    return null;
  }

  /**
   * Get dynamic NPC dialogue lines for current act.
   */
  function getNpcDialogue(npcId) {
    var act = getCurrentAct();
    var npcLines = NPC_DIALOGUE[npcId];
    if (!npcLines) return null;
    var actLines = npcLines[act.id] || npcLines.auftrag || null;
    if (!actLines) return null;
    var actId = npcLines[act.id] ? act.id : 'auftrag';
    // Resolve each line via i18n (falls back to original German via cascade).
    return actLines.map(function (line, i) {
      return _i18nLookup('story.npc.' + npcId + '.' + actId + '.' + i, line);
    });
  }

  // ---- Journal Data ----

  function getJournalData() {
    var act = getCurrentAct();
    var completedQuests = [];
    var activeQuests = [];

    if (window.questSystem) {
      completedQuests = window.questSystem.getCompletedQuests().map(function (q) {
        var rewardStr = '';
        if (q.rewards) {
          var parts = [];
          if (q.rewards.xp) parts.push(q.rewards.xp + ' XP');
          if (q.rewards.materials && q.rewards.materials.MAT) {
            parts.push(q.rewards.materials.MAT + ' ' + _i18nLookup('inventory.material.MAT', 'Eisenbrocken'));
          }
          if (q.rewards.items && q.rewards.items.length > 0) {
            var item = q.rewards.items[0];
            parts.push((window.questSystem && window.questSystem.getRewardItemName)
              ? window.questSystem.getRewardItemName(item)
              : item.name);
          }
          if (q.rewards.unlocks) {
            q.rewards.unlocks.forEach(function (u) {
              parts.push(_i18nLookup('story.unlock.' + u, u));
            });
          }
          if (q.rewards.info) {
            parts.push((window.questSystem && window.questSystem.getRewardInfo)
              ? window.questSystem.getRewardInfo(q)
              : q.rewards.info);
          }
          rewardStr = parts.join(', ');
        }
        var qTitle = window.questSystem && window.questSystem.getQuestTitle
          ? window.questSystem.getQuestTitle(q) : q.title;
        var qDesc = window.questSystem && window.questSystem.getQuestDescription
          ? window.questSystem.getQuestDescription(q) : q.description;
        return { title: qTitle, description: qDesc, rewards: rewardStr, npcId: q.npcId };
      });
      activeQuests = window.questSystem.getActiveQuests().map(function (q) {
        var obj = q.objectives[0];
        var progress = obj ? (obj.current + '/' + obj.required) : '';
        var progressPct = obj ? Math.floor((obj.current / obj.required) * 100) : 0;
        var qTitle = window.questSystem && window.questSystem.getQuestTitle
          ? window.questSystem.getQuestTitle(q) : q.title;
        var qDesc = window.questSystem && window.questSystem.getQuestDescription
          ? window.questSystem.getQuestDescription(q) : q.description;
        return { title: qTitle, description: qDesc, progress: progress, progressPct: progressPct, npcId: q.npcId };
      });
    }

    return {
      actNumber: storyState.currentActIndex + 1,
      actName: act.name,
      actNarrative: getActNarrative(act.id),
      highestWave: storyState.highestWave,
      completedQuests: completedQuests,
      activeQuests: activeQuests,
      totalActs: STORY_ACTS.length,
      totalKills: storyState.totalKills || 0,
      totalRoomsCleared: storyState.totalRoomsCleared || 0,
      totalWavesSurvived: storyState.totalWavesSurvived || 0
    };
  }

  // ---- Persistence ----

  function getStorySaveData() {
    return {
      currentActIndex: storyState.currentActIndex,
      highestWave: storyState.highestWave,
      eventsSeen: storyState.eventsSeen.slice(),
      pendingEvent: storyState.pendingEvent,
      endingShown: storyState.endingShown || false,
      totalKills: storyState.totalKills || 0,
      totalRoomsCleared: storyState.totalRoomsCleared || 0,
      totalWavesSurvived: storyState.totalWavesSurvived || 0
    };
  }

  function loadStorySaveData(data) {
    if (!data || typeof data !== 'object') return;
    storyState.currentActIndex = typeof data.currentActIndex === 'number' ? data.currentActIndex : 0;
    storyState.highestWave = typeof data.highestWave === 'number' ? data.highestWave : 0;
    storyState.eventsSeen = Array.isArray(data.eventsSeen) ? data.eventsSeen.slice() : [];
    storyState.pendingEvent = data.pendingEvent || null;
    storyState.endingShown = !!data.endingShown;
    storyState.totalKills = typeof data.totalKills === 'number' ? data.totalKills : 0;
    storyState.totalRoomsCleared = typeof data.totalRoomsCleared === 'number' ? data.totalRoomsCleared : 0;
    storyState.totalWavesSurvived = typeof data.totalWavesSurvived === 'number' ? data.totalWavesSurvived : 0;
  }

  // ---- Story Overlay UI (Phaser scene method) ----

  /**
   * Show a full-screen narrative overlay. Call on a Phaser scene.
   * @param {Phaser.Scene} scene
   * @param {object} eventData - { actName, actNumber, narrative }
   * @param {function} [onDismiss] - callback when overlay is dismissed
   */
  function showStoryOverlay(scene, eventData, onDismiss) {
    if (!scene || !eventData) return;

    var cam = scene.cameras.main;
    var w = cam.width;
    var h = cam.height;

    var overlay = scene.add.rectangle(w / 2, h / 2, w + 40, h + 40, 0x000000, 0.85)
      .setDepth(6000)
      .setScrollFactor(0);

    var container = scene.add.container(w / 2, h / 2).setDepth(6001).setScrollFactor(0);

    // Act number label (only for act transitions, not milestones)
    // Nur Akt-Übergänge tragen eine Nummer ("Akt N"). Der Epilog
    // (actNumber null) läuft ohne Label — früher stand hier "Meilenstein",
    // was seit dem Wegfall der Wave-Meilensteine irreführend war.
    if (eventData.actNumber) {
      var actLabel = scene.add.text(0, -80, 'Akt ' + eventData.actNumber, {
        fontFamily: 'serif',
        fontSize: 22,
        color: '#a89878'
      }).setOrigin(0.5);
      container.add(actLabel);
    }

    // Act title in gold
    var titleText = scene.add.text(0, -40, eventData.actName, {
      fontFamily: 'serif',
      fontSize: 38,
      color: '#ffd700',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(titleText);

    // Divider line
    var divider = scene.add.graphics();
    divider.lineStyle(1, 0xffd700, 0.5);
    divider.lineBetween(-200, 0, 200, 0);
    container.add(divider);

    // Narrative text in parchment color
    var narrativeText = scene.add.text(0, 40, eventData.narrative, {
      fontFamily: 'serif',
      fontSize: 20,
      color: '#f1e9d8',
      wordWrap: { width: 500 },
      lineSpacing: 6,
      align: 'center'
    }).setOrigin(0.5, 0);
    container.add(narrativeText);

    // Dismiss hint
    var hintText = scene.add.text(0, narrativeText.y + narrativeText.height + 50, 'Weiter [LEERTASTE]', {
      fontFamily: 'monospace',
      fontSize: 16,
      color: '#888888'
    }).setOrigin(0.5);
    container.add(hintText);

    // Blink the hint
    scene.tweens.add({
      targets: hintText,
      alpha: { from: 1, to: 0.3 },
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    var dismissed = false;
    var dismiss = function () {
      if (dismissed) return;
      dismissed = true;
      overlay.destroy();
      container.destroy(true);
      if (typeof onDismiss === 'function') onDismiss();
    };

    scene.input.keyboard.once('keydown-SPACE', dismiss);
    scene.input.keyboard.once('keydown-ENTER', dismiss);
    scene.input.keyboard.once('keydown-ESC', dismiss);
    scene.time.delayedCall(500, function () {
      overlay.setInteractive();
      overlay.once('pointerdown', dismiss);
    });
  }

  // ---- Journal Overlay UI ----

  /**
   * Show story journal overlay. Call on a Phaser scene.
   * @param {Phaser.Scene} scene
   * @param {function} [onClose] - callback when closed
   */
  function showJournalOverlay(scene, onClose) {
    if (!scene) return;

    // Spiel pausieren, solange das Tagebuch offen ist (im Hub ein No-Op, im
    // Dungeon friert es Gegner/Timer ein — sonst laeuft der Kampf weiter, waehrend
    // man liest).
    if (typeof window.pauseGameClock === 'function') {
      try { window.pauseGameClock(scene); } catch (e) {}
    }

    var data = getJournalData();
    var cam = scene.cameras.main;
    var w = cam.width;
    var h = cam.height;

    var overlay = scene.add.rectangle(w / 2, h / 2, w + 40, h + 40, 0x000000, 0.8)
      .setDepth(6000)
      .setScrollFactor(0)
      .setInteractive();

    var panelW = Math.min(560, w - 20);
    var panelH = Math.min(440, h - 20);
    var pad = 18;

    var container = scene.add.container(w / 2, h / 2).setDepth(6001).setScrollFactor(0);

    var bg = scene.add.graphics();
    bg.fillStyle(0x0c0c14, 0.95).fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
    bg.lineStyle(2, 0x484850, 0.9).strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
    container.add(bg);

    var innerW = panelW - pad * 2;
    var leftX = -panelW / 2 + pad;

    // Titel bleibt fest oben stehen (scrollt nicht mit).
    var title = scene.add.text(0, -panelH / 2 + pad, 'Tagebuch', {
      fontFamily: 'serif',
      fontSize: 26,
      color: '#ffd700'
    }).setOrigin(0.5, 0);
    container.add(title);

    // Alles Weitere kommt in einen scrollbaren Inhalts-Container zwischen
    // Titel und Schliess-Hinweis. y ist ab hier lokal (0 = Oberkante Inhalt).
    var contentTopRel = -panelH / 2 + pad + title.height + 14;
    var content = scene.add.container(0, contentTopRel).setScrollFactor(0);
    container.add(content);
    var y = 0;

    // Current act
    var actInfo = scene.add.text(leftX, y,
      'Akt ' + data.actNumber + ' von ' + data.totalActs + ': ' + data.actName, {
      fontFamily: 'serif',
      fontSize: 18,
      color: '#f1e9d8'
    }).setOrigin(0, 0);
    content.add(actInfo);
    y += actInfo.height + 6;

    // Act narrative
    var narrative = scene.add.text(leftX, y, data.actNarrative, {
      fontFamily: 'serif',
      fontSize: 14,
      color: '#a89878',
      wordWrap: { width: innerW },
      fontStyle: 'italic',
      lineSpacing: 3
    }).setOrigin(0, 0);
    content.add(narrative);
    y += narrative.height + 14;

    // Stats bar
    var statsStr = 'H\u00f6chste Welle: ' + data.highestWave
      + '  |  Gegner besiegt: ' + data.totalKills
      + '  |  R\u00e4ume: ' + data.totalRoomsCleared
      + '  |  Wellen: ' + data.totalWavesSurvived;
    var statsText = scene.add.text(leftX, y, statsStr, {
      fontFamily: 'monospace',
      fontSize: 12,
      color: '#8a8a9a'
    }).setOrigin(0, 0);
    content.add(statsText);
    y += statsText.height + 14;

    // Divider
    var divGfx = scene.add.graphics();
    divGfx.lineStyle(1, 0x484850, 0.6);
    divGfx.lineBetween(leftX, y, leftX + innerW, y);
    content.add(divGfx);
    y += 10;

    // Active quests with progress bars
    var activeHeader = scene.add.text(leftX, y, 'Aktive Aufgaben:', {
      fontFamily: 'serif',
      fontSize: 16,
      color: '#88bbff'
    }).setOrigin(0, 0);
    content.add(activeHeader);
    y += activeHeader.height + 6;

    if (data.activeQuests.length === 0) {
      var noActive = scene.add.text(leftX + 12, y, 'Keine aktiven Aufgaben', {
        fontFamily: 'monospace',
        fontSize: 13,
        color: '#666666'
      }).setOrigin(0, 0);
      content.add(noActive);
      y += noActive.height + 8;
    } else {
      data.activeQuests.forEach(function (q) {
        var line = scene.add.text(leftX + 12, y,
          q.title + '  (' + q.progress + ')', {
          fontFamily: 'monospace',
          fontSize: 13,
          color: '#d8d2c3',
          wordWrap: { width: innerW - 16 }
        }).setOrigin(0, 0);
        content.add(line);
        y += line.height + 3;

        // Progress bar
        var barW = innerW - 16;
        var barH = 8;
        var barBg = scene.add.graphics();
        barBg.fillStyle(0x222230, 0.8).fillRoundedRect(leftX + 12, y, barW, barH, 3);
        content.add(barBg);

        var fillW = Math.max(2, Math.floor(barW * (q.progressPct / 100)));
        var barFill = scene.add.graphics();
        barFill.fillStyle(0x4488ff, 0.9).fillRoundedRect(leftX + 12, y, fillW, barH, 3);
        content.add(barFill);
        y += barH + 6;

        // Description
        var desc = scene.add.text(leftX + 16, y, q.description, {
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#8a8a9a',
          wordWrap: { width: innerW - 24 }
        }).setOrigin(0, 0);
        content.add(desc);
        y += desc.height + 8;
      });
    }
    y += 6;

    // Completed quests with rewards
    var completedHeader = scene.add.text(leftX, y, 'Abgeschlossene Aufgaben:', {
      fontFamily: 'serif',
      fontSize: 16,
      color: '#88ff88'
    }).setOrigin(0, 0);
    content.add(completedHeader);
    y += completedHeader.height + 6;

    if (data.completedQuests.length === 0) {
      var noCompleted = scene.add.text(leftX + 12, y, 'Keine abgeschlossenen Aufgaben', {
        fontFamily: 'monospace',
        fontSize: 13,
        color: '#666666'
      }).setOrigin(0, 0);
      content.add(noCompleted);
    } else {
      data.completedQuests.forEach(function (q) {
        var line = scene.add.text(leftX + 12, y,
          '\u2713 ' + q.title, {
          fontFamily: 'monospace',
          fontSize: 13,
          color: '#88aa88',
          wordWrap: { width: innerW - 16 }
        }).setOrigin(0, 0);
        content.add(line);
        y += line.height + 2;

        if (q.rewards) {
          var rewardLine = scene.add.text(leftX + 24, y,
            'Belohnung: ' + q.rewards, {
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#6a8a6a',
            wordWrap: { width: innerW - 28 }
          }).setOrigin(0, 0);
          content.add(rewardLine);
          y += rewardLine.height + 4;
        }
      });
    }

    var contentH = y;

    // Schliess-Hinweis bleibt fest unten stehen (scrollt nicht mit).
    var hint = scene.add.text(0, panelH / 2 - pad, 'J / ESC: schliessen', {
      fontFamily: 'monospace',
      fontSize: 14,
      color: '#888888'
    }).setOrigin(0.5, 1);
    container.add(hint);

    // Sichtbarer Ausschnitt zwischen Titel-Unterkante und Hinweis-Oberkante.
    var viewTopScreen = h / 2 + contentTopRel;
    var viewBottomRel = panelH / 2 - pad - hint.height - 8;
    var viewH = (h / 2 + viewBottomRel) - viewTopScreen;

    // Scroll nur einrichten, wenn der Inhalt wirklich überläuft — sonst
    // überlappen abgeschlossene Aufgaben die untere Menükante.
    var maskG = null, track = null, thumb = null, wheelHandler = null;
    var scrollMax = Math.max(0, contentH - viewH);
    if (scrollMax > 0) {
      maskG = scene.make.graphics();
      if (typeof maskG.setScrollFactor === 'function') maskG.setScrollFactor(0);
      maskG.fillStyle(0xffffff).fillRect(w / 2 - panelW / 2 + 4, viewTopScreen, panelW - 8, viewH);
      content.setMask(maskG.createGeometryMask());

      var trackX = w / 2 + panelW / 2 - 12;
      track = scene.add.rectangle(trackX, viewTopScreen + viewH / 2, 6, viewH, 0x000000, 0.35)
        .setScrollFactor(0).setDepth(6002);
      var thumbH = Math.max(24, Math.round(viewH * (viewH / contentH)));
      var minThumbY = viewTopScreen + thumbH / 2;
      var maxThumbY = viewTopScreen + viewH - thumbH / 2;
      thumb = scene.add.rectangle(trackX, minThumbY, 9, thumbH, 0xd4a543, 0.9)
        .setScrollFactor(0).setDepth(6003).setInteractive({ useHandCursor: true });
      var scrollY = 0;
      var applyScroll = function () {
        scrollY = Phaser.Math.Clamp(scrollY, 0, scrollMax);
        content.y = contentTopRel - scrollY;
        var frac = scrollMax > 0 ? scrollY / scrollMax : 0;
        thumb.y = minThumbY + frac * (maxThumbY - minThumbY);
      };
      scene.input.setDraggable(thumb);
      thumb.on('drag', function (p, dx, dy) {
        var span = Math.max(1, maxThumbY - minThumbY);
        scrollY = Phaser.Math.Clamp((dy - minThumbY) / span, 0, 1) * scrollMax;
        applyScroll();
      });
      wheelHandler = function (p, over, dx, dy) { scrollY += dy * 0.5; applyScroll(); };
      scene.input.on('wheel', wheelHandler);
    }

    var closed = false;
    var close = function () {
      if (closed) return;
      closed = true;
      if (wheelHandler) { try { scene.input.off('wheel', wheelHandler); } catch (e) {} }
      if (track) { try { track.destroy(); } catch (e) {} }
      if (thumb) { try { thumb.destroy(); } catch (e) {} }
      if (maskG) { try { maskG.destroy(); } catch (e) {} }
      overlay.destroy();
      container.destroy(true);
      scene.input.keyboard.off('keydown-J', close);
      scene.input.keyboard.off('keydown-ESC', close);
      if (typeof window.resumeGameClock === 'function') {
        try { window.resumeGameClock(scene); } catch (e) {}
      }
      if (typeof onClose === 'function') onClose();
    };

    scene.input.keyboard.once('keydown-J', close);
    scene.input.keyboard.once('keydown-ESC', close);
    overlay.once('pointerdown', close);
  }

  // ---- Export ----
  var storySystem = {
    STORY_ACTS: STORY_ACTS,
    ACT_NARRATIVES: ACT_NARRATIVES,
    NPC_DIALOGUE: NPC_DIALOGUE,
    getCurrentAct: getCurrentAct,
    getCurrentActIndex: getCurrentActIndex,
    getActById: getActById,
    onWaveCompleted: onWaveCompleted,
    onEnemyKilled: onEnemyKilled,
    onRoomCleared: onRoomCleared,
    advanceToAct: advanceToAct,
    resetToAct0: resetToAct0,
    consumePendingEvent: consumePendingEvent,
    getNpcDialogue: getNpcDialogue,
    getJournalData: getJournalData,
    getStorySaveData: getStorySaveData,
    loadStorySaveData: loadStorySaveData,
    showStoryOverlay: showStoryOverlay,
    showJournalOverlay: showJournalOverlay
  };

  window.storySystem = storySystem;
})();
