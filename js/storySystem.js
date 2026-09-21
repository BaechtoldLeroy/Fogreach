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
    { id: 'bruch',         name: 'Die Quelle' }   // #89: Titel aus der Story-Bibel v5
  ];

  // ---- Narrative texts shown at act transitions ----
  // #89: auf Story-Bibel v5 nachgezogen. Jeder Text passt zu dem Moment, in
  // dem der Akt beginnt (Aufstieg quest-getrieben: harren_daughter_investigation,
  // council_collusion_reveal, mara_warning, bruch_confrontation).
  const ACT_NARRATIVES = {
    auftrag: 'Du erwachst in der Archivschmiede. Woran Du Dich erinnerst: an Deinen Rang, an Dein Werkzeug, an nichts davor. Ratsherr Aldric wartet schon. \'Der Rat hat Arbeit für Dich, Archivschmied. Unten im Keller.\'',
    treuer_diener: 'Im Tagebuch der Bürgermeistertochter stehen alle drei Fraktionen, mit Namen. Harren liest lange. \'Sie ist nicht geflohen. Jemand hat sie verschwinden lassen.\' Am nächsten Morgen hat der Rat neue Aufträge für Dich. Er lobt Dich. Er beobachtet Dich.',
    erste_risse: 'Ein Gesicht, drei Masken, ein Zeichen: drei Ketten, ineinander verschlungen. Harren bittet Dich zu bleiben. \'Räum weiter für sie, und heimlich für uns.\' Von nun an gehst Du im Rathaus aus und ein und trägst jeden Abend etwas hinaus.',
    wahrheit: 'Der Kettenmeister ist gefallen, das erste Siegel mit ihm. Doch der Widerstand verliert. Maras Leute werden verhaftet, noch bevor sie losgehen. Jemand verrät sie. Einer von euch.',
    bruch: 'Aldric weiss es. Dein Doppelspiel ist aufgeflogen, die Kettenwache jagt Dich durch die Gänge. Oben ist das Rathaus zu. Unten, irgendwo unter der Stadt, liegt die Quelle des Nebels.'
  };

  // ---- Dynamic NPC dialogue per act ----
  // #89: v5. Jede Figur weiss nur, was sie im jeweiligen Akt wissen kann.
  const NPC_DIALOGUE = {
    aldric: {
      auftrag: [
        'Der Keller ist voller Ungeziefer. Räum das auf, Archivschmied.',
        'Der Rat hat Dich aus gutem Grund in die Archivschmiede gestellt. Zeig, dass Du nützlich bist.',
        'Frag nicht so viel. Tu, was man Dir sagt.'
      ],
      treuer_diener: [
        'Du hast Dich bewährt. Magistrat, Klerus, Garde: Alle drei haben Arbeit für Dich.',
        'Die Tochter des Bürgermeisters? Geflohen. Eine traurige Sache. Lass Dich davon nicht ablenken.',
        'Der Rat streitet laut, damit die Stadt es hört. Das ist gesund.'
      ],
      erste_risse: [
        'Du räumst zuverlässig. Der Rat merkt sich, wer zuverlässig ist.',
        'Die Abstimmung hat gezeigt, was die Stadt will: Ordnung.',
        'Manche Akten sind vertraulich. Lass die Finger davon.'
      ],
      wahrheit: [
        'Der Widerstand hat in letzter Zeit viel Pech. Tragisch.',
        'Man hört, Du triffst Dich mit Leuten, die man nicht treffen sollte. Man hört viel.',
        'Noch gehst Du hier aus und ein. Noch.'
      ],
      bruch: [
        'Du stellst zu viele Fragen. Das endet nie gut.',
        'Das Rathaus ist nicht mehr Deine Tür.',
        'Lauf ruhig, Archivschmied. Alle Wege führen nach unten.'
      ]
    },
    branka: {
      auftrag: [
        'Du siegelst Akten, an die Du Dich am nächsten Tag nicht erinnerst. Pass auf Dich auf.',
        'Früher hast Du hier gestanden und Fragen gestellt, bis Aldric rot wurde. Weisst Du das noch?',
        'Der Nebel nimmt jedem etwas. Manchen nimmt er mehr.'
      ],
      treuer_diener: [
        'Der Magistrat will ein Siegel von Dir. Überleg Dir, was Du unterschreibst.',
        'Drei Fraktionen, drei Farben, und doch holen alle ihr Eisen beim selben Schmied.',
        'Harrens Tochter ist nicht die Erste, die verschwindet. Nur die Erste, nach der jemand fragt.'
      ],
      erste_risse: [
        'Du gehst im Rathaus aus und ein und kommst jeden Abend schwerer beladen heraus. Ich frage nicht.',
        'Ich schmiede, was der Rat bestellt. Aber ich lese mit, was er bestellt.',
        'Wenn Du wissen willst, wer Du warst, komm zu mir. Ich habe Deine alte Werkstatt nicht vergessen.'
      ],
      wahrheit: [
        'Maras Leute werden verhaftet, bevor sie losgehen. Jemand weiss zu viel.',
        'Die Kettenwache war heute zweimal hier. Sie sucht Dich noch nicht. Noch nicht.',
        'Pass auf, wem Du Deine Wege erzählst. Auch mir nicht alles.'
      ],
      bruch: [
        'Aldric weiss es. Hier bist Du nicht mehr sicher, aber meine Tür bleibt offen.',
        'Zeig mir die Klinge. Wer sie Dir auch geschmiedet hat, sie ist gut.',
        'Wenn Du hinabsteigst, komm zurück. Die Stadt braucht jemanden, der sich erinnert.'
      ]
    },
    thom: {
      auftrag: [
        'Ich drucke, was der Rat bestellt. Edikte, Verordnungen, Gebete.',
        'Die Presse ruht selten. Die Stadt liest viel und erinnert sich an wenig.',
        'Komm wieder, wenn Du etwas hast, das man drucken sollte.'
      ],
      treuer_diener: [
        'Drei Fraktionen, drei Auftraggeber, eine Druckerei. Ich habe nur eine Sorte Papier.',
        'Wenn der Rat streitet, verkaufe ich mehr Edikte. Merkwürdig, wie oft er streitet.',
        'Harren war hier und hat nach seiner Tochter gefragt. Ich konnte ihm nichts drucken.'
      ],
      erste_risse: [
        'Was Du aus dem Rathaus trägst, landet nicht bei mir. Noch nicht. Aber ich habe Platz.',
        'Eine falsche Zeile, und sie sperren zehn Familien ein. Ich drucke nur, was stimmt.',
        'Drei Edikte habe ich für die Abstimmung gedruckt. Die Patrouillen hat keiner gedruckt, und doch sind sie da.'
      ],
      wahrheit: [
        'Der Widerstand verliert Leute. Ich drucke keine Namen mehr, bis wir wissen, wer redet.',
        'Irgendwann muss alles raus. Nicht das halbe Bild. Alles.',
        'Ich habe eine zweite Presse im Keller. Man weiss ja nie.'
      ],
      bruch: [
        'Wenn Du zurückkommst, drucken wir alles. Den Rat, Aldric, den Widerstand. Alles.',
        'Die Garde war hier. Die Presse steht noch.',
        'Die Platten liegen bereit. Es fehlt nur noch das Ende.'
      ]
    },
    mara: {
      auftrag: [
        'Wer auf dem Schwarzmarkt fragt, zahlt doppelt. Wer im Rathaus fragt, verschwindet.',
        'Die Schreiber markieren Häuser mit Kreideketten. Merk Dir, welche.',
        'Du bist der Archivschmied? Man hört, Du hattest früher mehr Fragen.'
      ],
      treuer_diener: [
        'Harrens Tochter ist nicht geflohen. Niemand flieht aus dieser Stadt, ohne dass ich davon weiss.',
        'Die Kettenwache räumt nachts Häuser. Morgens erinnert sich kein Nachbar.',
        'Halt die Augen offen, wenn Du unten bist.'
      ],
      erste_risse: [
        'Du hast früher Fragen gestellt, Archivschmied. Stell sie wieder.',
        'Mein Netz reicht bis ins Lagerhaus des Rats. Mehr sage ich nicht.',
        'Vertrau nicht blind. Auch mir nicht. Aber hör zu.'
      ],
      wahrheit: [
        'Drei meiner Leute sind weg. Sie kannten den Treffpunkt erst einen Tag vorher.',
        'Es gibt einen Maulwurf. Jemanden, dem wir alle vertrauen.',
        'Wenn Du etwas hörst, egal von wem, sag es mir zuerst.'
      ],
      bruch: [
        'Aldric hat seine Maske fallen lassen. Gut. Jetzt wissen alle, woran sie sind.',
        'Ich folge einem Zettel, der zu oft den Besitzer wechselt. Bald weiss ich, wer redet.',
        'Wenn Du hinabsteigst, bin ich nicht weit.'
      ]
    },
    harren: {
      auftrag: [
        'Meine Tochter Lene ist verschwunden. Aldric sagt, sie sei geflohen. Lene flieht nicht.',
        'Ich stelle jeden Abend ein Licht ins Fenster. Falls sie den Weg sucht.',
        'Ich bin Bürgermeister dieser Stadt und kann niemanden fragen, ohne dass der Rat mithört.'
      ],
      treuer_diener: [
        'Das Tagebuch... alle drei Fraktionen stehen darin. Alle drei.',
        'Bleib in ihrer Nähe, Archivschmied. Du bist der Einzige, der dort aus und ein geht.',
        'Der Rat behandelt mich wie ein Möbelstück. Gut. Möbel hören viel.'
      ],
      erste_risse: [
        'Räum weiter für sie, und heimlich für uns.',
        'Jeden Abend brennt das Licht. Sie muss es sehen.',
        'Ein Gesicht, drei Masken. Und ich habe ihnen jahrelang die Hand gegeben.'
      ],
      wahrheit: [
        'Sie nennt sich jetzt Elara. Für mich bleibt sie Lene.',
        'Sie war hier. Eine Nacht. Dann ist sie wieder gegangen.',
        'Pass auf sie auf, da unten. Sie lässt sich nicht helfen.'
      ],
      bruch: [
        'Aldric hat uns alle belogen. Auch über meine Tochter.',
        'Wenn Du hinabsteigst, sag ihr, dass das Licht noch brennt.',
        'Ich bin zu alt zum Kämpfen. Aber ich lasse sie da unten nicht allein.'
      ]
    },
    elara: {
      bruch: [
        'Der Rat hört mit. Immer. Auch hier.',
        'Du hast mir vertraut, als es niemand tat. Das vergesse ich nicht.',
        'Unten liegt die Quelle. Wenn Du hinabsteigst, bin ich schon da.'
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
  const ALL_QUESTS_ENDING = 'Der Nebel bricht. Nicht, weil ihn jemand vertreibt, sondern weil zu viele Menschen sich zu vieles zugleich merken.\n\nDie Presse läuft, und die Stadt erinnert sich.';

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
      'story.act.bruch.name': 'The Source',

      'story.act.auftrag.narrative': "You wake in the Archive Forge. What you remember: your rank, your tools, nothing before. Councillor Aldric is already waiting. 'The council has work for you, Archivesmith. Down in the cellar.'",
      'story.act.treuer_diener.narrative': "The mayor's daughter's diary names all three factions. Harren reads for a long time. 'She did not flee. Someone made her disappear.' The next morning the council has new work for you. It praises you. It watches you.",
      'story.act.erste_risse.narrative': "One face, three masks, one sign: three chains, interlocked. Harren asks you to stay. 'Keep cleaning for them, and secretly for us.' From now on you come and go in the town hall and carry something out every evening.",
      'story.act.wahrheit.narrative': "The Chain Master has fallen, and the first seal with him. But the resistance is losing. Mara's people are arrested before they even set out. Someone is betraying them. One of you.",
      'story.act.bruch.narrative': "Aldric knows. Your double game is blown, the chain guard hunts you through the tunnels. Up above, the town hall is closed to you. Down below, somewhere beneath the city, lies the source of the fog.",

      'story.all_quests_ending': "The fog breaks. Not because anyone drives it away, but because too many people remember too much at once.\n\nThe press is running, and the city remembers.",

      'story.epilog.label': 'Epilogue',
      'story.unlock.enhanced_crafting': 'Advanced Crafting',
      'story.unlock.xp_bonus_10': '+10% XP',
      'story.unlock.shadow_skill': 'Shadow Arts',
      'story.unlock.story_ending': 'Epilogue',
      'story.unlock.elara_trust': "Elara's Trust",

      // === NPC dialogues — English (#89: v5) ===
      'story.npc.aldric.auftrag.0': "The cellar is full of vermin. Clean it up, Archivesmith.",
      'story.npc.aldric.auftrag.1': "The council put you in the Archive Forge for good reason. Show that you're useful.",
      'story.npc.aldric.auftrag.2': "Don't ask so many questions. Do what you're told.",
      'story.npc.aldric.treuer_diener.0': "You've proven yourself. Magistrate, Clergy, Guard: all three have work for you.",
      'story.npc.aldric.treuer_diener.1': "The mayor's daughter? Fled. A sad affair. Don't let it distract you.",
      'story.npc.aldric.treuer_diener.2': "The council argues loudly so the city can hear it. That is healthy.",
      'story.npc.aldric.erste_risse.0': "You clean up reliably. The council remembers who is reliable.",
      'story.npc.aldric.erste_risse.1': "The vote showed what the city wants: order.",
      'story.npc.aldric.erste_risse.2': "Some files are confidential. Keep your hands off them.",
      'story.npc.aldric.wahrheit.0': "The resistance has had a lot of bad luck lately. Tragic.",
      'story.npc.aldric.wahrheit.1': "One hears you meet people one shouldn't meet. One hears a lot.",
      'story.npc.aldric.wahrheit.2': "You still come and go here. For now.",
      'story.npc.aldric.bruch.0': "You ask too many questions. That never ends well.",
      'story.npc.aldric.bruch.1': "The town hall is no longer your door.",
      'story.npc.aldric.bruch.2': "Run, Archivesmith. All roads lead down.",
      'story.npc.branka.auftrag.0': "You seal files you can't remember the next day. Take care of yourself.",
      'story.npc.branka.auftrag.1': "You used to stand here asking questions until Aldric turned red. Do you remember?",
      'story.npc.branka.auftrag.2': "The fog takes something from everyone. From some it takes more.",
      'story.npc.branka.treuer_diener.0': "The Magistrate wants your seal. Think about what you sign.",
      'story.npc.branka.treuer_diener.1': "Three factions, three colours, and yet they all buy their iron from the same smith.",
      'story.npc.branka.treuer_diener.2': "Harren's daughter isn't the first to disappear. Just the first anyone asks about.",
      'story.npc.branka.erste_risse.0': "You come and go in the town hall and leave heavier every evening. I don't ask.",
      'story.npc.branka.erste_risse.1': "I forge what the council orders. But I read what it orders.",
      'story.npc.branka.erste_risse.2': "If you want to know who you were, come to me. I haven't forgotten your old workshop.",
      'story.npc.branka.wahrheit.0': "Mara's people are arrested before they set out. Someone knows too much.",
      'story.npc.branka.wahrheit.1': "The chain guard was here twice today. They aren't looking for you yet. Not yet.",
      'story.npc.branka.wahrheit.2': "Be careful who you tell your routes. Don't tell me everything either.",
      'story.npc.branka.bruch.0': "Aldric knows. You're not safe here any more, but my door stays open.",
      'story.npc.branka.bruch.1': "Show me the blade. Whoever forged it for you, it's good.",
      'story.npc.branka.bruch.2': "If you go down, come back. The city needs someone who remembers.",
      'story.npc.thom.auftrag.0': "I print what the council orders. Edicts, decrees, prayers.",
      'story.npc.thom.auftrag.1': "The press rarely rests. The city reads a lot and remembers little.",
      'story.npc.thom.auftrag.2': "Come back when you have something worth printing.",
      'story.npc.thom.treuer_diener.0': "Three factions, three clients, one print shop. I only have one kind of paper.",
      'story.npc.thom.treuer_diener.1': "When the council argues, I sell more edicts. Strange how often it argues.",
      'story.npc.thom.treuer_diener.2': "Harren came asking about his daughter. I had nothing to print for him.",
      'story.npc.thom.erste_risse.0': "What you carry out of the town hall doesn't reach me. Not yet. But I have room.",
      'story.npc.thom.erste_risse.1': "One wrong line and they lock up ten families. I only print what is true.",
      'story.npc.thom.erste_risse.2': "I printed three edicts for the vote. Nobody printed the patrols, and yet there they are.",
      'story.npc.thom.wahrheit.0': "The resistance is losing people. I print no more names until we know who talks.",
      'story.npc.thom.wahrheit.1': "Sooner or later everything has to come out. Not half the picture. All of it.",
      'story.npc.thom.wahrheit.2': "I have a second press in the cellar. You never know.",
      'story.npc.thom.bruch.0': "When you come back, we print everything. The council, Aldric, the resistance. Everything.",
      'story.npc.thom.bruch.1': "The guard was here. The press still stands.",
      'story.npc.thom.bruch.2': "The plates are ready. All that's missing is the ending.",
      'story.npc.mara.auftrag.0': "Ask on the black market and you pay double. Ask in the town hall and you disappear.",
      'story.npc.mara.auftrag.1': "The scribes mark houses with chalk chains. Remember which ones.",
      'story.npc.mara.auftrag.2': "You're the Archivesmith? They say you used to ask more questions.",
      'story.npc.mara.treuer_diener.0': "Harren's daughter didn't flee. Nobody flees this city without me knowing.",
      'story.npc.mara.treuer_diener.1': "The chain guard clears houses at night. In the morning no neighbour remembers.",
      'story.npc.mara.treuer_diener.2': "Keep your eyes open when you're down there.",
      'story.npc.mara.erste_risse.0': "You used to ask questions, Archivesmith. Ask them again.",
      'story.npc.mara.erste_risse.1': "My network reaches into the council's warehouse. That's all I'll say.",
      'story.npc.mara.erste_risse.2': "Don't trust blindly. Not me either. But listen.",
      'story.npc.mara.wahrheit.0': "Three of my people are gone. They only knew the meeting place a day before.",
      'story.npc.mara.wahrheit.1': "There is a mole. Someone we all trust.",
      'story.npc.mara.wahrheit.2': "If you hear something, no matter from whom, tell me first.",
      'story.npc.mara.bruch.0': "Aldric has dropped his mask. Good. Now everyone knows where they stand.",
      'story.npc.mara.bruch.1': "I'm following a note that changes hands too often. Soon I'll know who talks.",
      'story.npc.mara.bruch.2': "When you go down, I won't be far.",
      'story.npc.harren.auftrag.0': "My daughter Lene has disappeared. Aldric says she fled. Lene doesn't flee.",
      'story.npc.harren.auftrag.1': "Every evening I put a light in the window. In case she's looking for the way.",
      'story.npc.harren.auftrag.2': "I am mayor of this city and can't ask anyone without the council listening.",
      'story.npc.harren.treuer_diener.0': "The diary... all three factions are in it. All three.",
      'story.npc.harren.treuer_diener.1': "Stay close to them, Archivesmith. You're the only one who comes and goes there.",
      'story.npc.harren.treuer_diener.2': "The council treats me like furniture. Good. Furniture hears a lot.",
      'story.npc.harren.erste_risse.0': "Keep cleaning for them, and secretly for us.",
      'story.npc.harren.erste_risse.1': "Every evening the light burns. She must see it.",
      'story.npc.harren.erste_risse.2': "One face, three masks. And I shook their hands for years.",
      'story.npc.harren.wahrheit.0': "She calls herself Elara now. To me she is still Lene.",
      'story.npc.harren.wahrheit.1': "She was here. One night. Then she left again.",
      'story.npc.harren.wahrheit.2': "Look after her down there. She won't let anyone help her.",
      'story.npc.harren.bruch.0': "Aldric lied to us all. About my daughter too.",
      'story.npc.harren.bruch.1': "When you go down, tell her the light is still burning.",
      'story.npc.harren.bruch.2': "I'm too old to fight. But I won't leave her alone down there.",
      'story.npc.elara.bruch.0': "The council is listening. Always. Here too.",
      'story.npc.elara.bruch.1': "You trusted me when nobody did. I won't forget that.",
      'story.npc.elara.bruch.2': "The source lies below. When you go down, I'll already be there.",
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
    // #158: Der Epilog haengt an den Entscheidungen (questFinale.epilog).
    // Der feste Text bleibt nur als Rueckfall, falls das Modul fehlt.
    try {
      if (window.QuestFinale && typeof window.QuestFinale.epilog === 'function'
          && window.questSystem && typeof window.questSystem.getFlags === 'function') {
        var lang = (window.i18n && typeof window.i18n.getLanguage === 'function') ? window.i18n.getLanguage() : 'de';
        return window.QuestFinale.epilog(window.questSystem.getFlags(), lang).join('\n\n');
      }
    } catch (e) { /* Rueckfall unten */ }
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
  // #89: Jeder Akt hat seine Stimmung, statt fuenfmal dasselbe Schwarz. Grund,
  // Titel- und Linienfarbe folgen der Geschichte: der Glanz des Rats, die kalte
  // Verstellung, die Jagd, die Quelle, und der helle Morgen danach.
  var AKT_STIMMUNG = {
    auftrag:       { grund: 0x0b0d12, titel: '#d8d2c0', linie: 0xa8a090 },
    treuer_diener: { grund: 0x14100a, titel: '#ffd700', linie: 0xffd700 },
    erste_risse:   { grund: 0x0a1016, titel: '#9fb4cc', linie: 0x7f94ac },
    wahrheit:      { grund: 0x1a0808, titel: '#e06a5a', linie: 0xb4483a },
    bruch:         { grund: 0x120a1c, titel: '#c4a8ff', linie: 0x8866cc },
    ending:        { grund: 0x2a2a30, titel: '#f4efe2', linie: 0xdfe4ea }
  };
  function aktStimmung(actId) { return AKT_STIMMUNG[actId] || AKT_STIMMUNG.treuer_diener; }

  function showStoryOverlay(scene, eventData, onDismiss) {
    if (!scene || !eventData) return;

    var cam = scene.cameras.main;
    var w = cam.width;
    var h = cam.height;
    var stimmung = aktStimmung(eventData.actId);

    var overlay = scene.add.rectangle(w / 2, h / 2, w + 40, h + 40, stimmung.grund, 0.9)
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
      color: stimmung.titel,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(titleText);

    // Divider line
    var divider = scene.add.graphics();
    divider.lineStyle(1, stimmung.linie, 0.6);
    divider.lineBetween(-200, 0, 200, 0);
    container.add(divider);

    // #161: Lange Texte (der Epilog aus den Entscheidungen hat sechs bis acht
    // Absaetze) liefen unten aus dem Bild — samt dem Weiter-Hinweis. Jetzt in
    // Seiten nach Absaetzen, so viele, wie in den Platz passen.
    var absaetze = String(eventData.narrative || '').split('\n\n');
    var maxH = Math.max(80, h / 2 - 40 - 70);

    // Narrative text in parchment color
    var narrativeText = scene.add.text(0, 40, '', {
      fontFamily: 'serif',
      fontSize: 20,
      color: '#f1e9d8',
      wordWrap: { width: 500 },
      lineSpacing: 6,
      align: 'center'
    }).setOrigin(0.5, 0);
    container.add(narrativeText);

    var seiten = [];
    var aktuell = [];
    absaetze.forEach(function (a) {
      narrativeText.setText(aktuell.concat([a]).join('\n\n'));
      if (aktuell.length && narrativeText.height > maxH) { seiten.push(aktuell.join('\n\n')); aktuell = [a]; }
      else aktuell.push(a);
    });
    if (aktuell.length) seiten.push(aktuell.join('\n\n'));
    var seite = 0;
    narrativeText.setText(seiten[0] || '');

    // Dismiss hint — fest am unteren Rand, nicht unter dem Text.
    var hintText = scene.add.text(0, h / 2 - 36, 'Weiter [LEERTASTE]', {
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
    var tasten = ['keydown-SPACE', 'keydown-ENTER', 'keydown-ESC'];
    var dismiss = function () {
      if (dismissed) return;
      // Erst die naechste Seite, dann schliessen.
      if (seite < seiten.length - 1) {
        seite++;
        narrativeText.setText(seiten[seite]);
        return;
      }
      dismissed = true;
      tasten.forEach(function (t) { try { scene.input.keyboard.off(t, dismiss); } catch (e) {} });
      overlay.destroy();
      container.destroy(true);
      if (typeof onDismiss === 'function') onDismiss();
    };

    tasten.forEach(function (t) { scene.input.keyboard.on(t, dismiss); });
    scene.time.delayedCall(500, function () {
      if (dismissed) return;
      overlay.setInteractive();
      overlay.on('pointerdown', dismiss);
    });
    // Fuer Tests und Aufrufer: wie viele Seiten, welche gerade.
    return { seiten: seiten, seite: function () { return seite; }, weiter: dismiss };
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
    aktStimmung: aktStimmung,
    showJournalOverlay: showJournalOverlay
  };

  window.storySystem = storySystem;
})();
