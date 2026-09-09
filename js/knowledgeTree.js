// knowledgeTree.js — Knowledge Tree (#26) MVP.
//
// Lore-fragment events drop a fragment counter that the player can invest into
// passive stat ranks via Mara's dialog. Unlike Brunnen/Druckerei (run-scoped
// buffs), Knowledge Tree investments are permanent across runs and lives in
// its own localStorage blob.
//
// The 10-node catalog is hand-authored below. Per-rank effects are applied
// via window.knowledgeTreeBuffs — a sibling of window.eventBuffs / brunnenBuffs
// / printingBuffs that is read at recalcDerived time (and at the few stat-read
// sites that don't go through recalcDerived: addXP, gold drops, magic find,
// pickup radius, CDR).
//
// See:
//   kitty-specs/047-knowledge-tree-mvp/spec.md
//   kitty-specs/047-knowledge-tree-mvp/contracts/knowledgeTree.contract.md

(function () {
  var STORAGE_KEY = 'demonfall.knowledgeTree.v1';
  var SCHEMA_VERSION = 1;

  // --- i18n string tables -------------------------------------------------
  var I18N_DE = {
    'knowledge.title':             'Wissensbaum',
    'knowledge.fragments':         'Fragmente: {count}',
    'knowledge.btn.respec':        '[ Zurücksetzen ]',
    'knowledge.btn.close':         '[ Schließen ]',
    'knowledge.btn.to_keystones':  '[ Grundsätze ]',
    'knowledge.btn.to_nodes':      '[ Wissen ]',
    // Der Preis steht NUR noch im Hover — auf dem Knopf verbrauchte er
    // Kachelbreite fuer eine Zahl, die daneben ohnehin gross im Kopf steht.
    'knowledge.key.btn_set':       'Wählen',
    'knowledge.key.btn_release':   'Ablegen',
    'knowledge.btn.test_give':     '[ +1 Fragment ]',
    'knowledge.respec.confirm':    'Wissen wirklich zurücksetzen?',
    'knowledge.respec.yes':        'Ja',
    'knowledge.respec.no':         'Nein',
    'knowledge.rank':              'Rang {rank}/{max}',
    'knowledge.maxRank':           'Maximaler Rang erreicht',
    'knowledge.noFragments':       'Keine Fragmente',
    // Node labels + descriptions (10 × 2)
    'knowledge.node.damage.label':       'Kraft des Wissens',
    'knowledge.node.damage.desc':        '+5 % Schaden pro Rang',
    'knowledge.node.armor.label':        'Gehärtete Haut',
    'knowledge.node.armor.desc':         '+5 % Rüstung pro Rang',
    'knowledge.node.speed.label':        'Schnelle Schritte',
    'knowledge.node.speed.desc':         '+3 % Lauftempo pro Rang',
    'knowledge.node.max_hp.label':       'Robuster Körper',
    'knowledge.node.max_hp.desc':        '+10 Max-LP pro Rang',
    'knowledge.node.crit.label':         'Geübtes Auge',
    'knowledge.node.crit.desc':          '+2 % Crit-Chance pro Rang',
    'knowledge.node.xp.label':           'Gelehrter Geist',
    'knowledge.node.xp.desc':            '+5 % XP-Gewinn pro Rang',
    'knowledge.node.gold.label':         'Glückspilz',
    'knowledge.node.gold.desc':          '+5 % Gold-Drop pro Rang',
    'knowledge.node.pickup.label':       'Magnetische Anziehung',
    'knowledge.node.pickup.desc':        '+20 px Aufnahme-Radius pro Rang',
    'knowledge.node.magic_find.label':   'Magisches Gespür',
    'knowledge.node.magic_find.desc':    '+5 % seltene Drops pro Rang',
    // #116: Keystones. Der Name nennt die Haltung, die Beschreibung den
    // Tausch — Preis zuerst, damit niemand ihn uebersieht.
    'knowledge.respec.cost':            'Kostet {n} Gold.',
    'knowledge.respec.broke':           'Du brauchst {n} Gold.',
    'knowledge.zweig.kraft':            'Kraft',
    'knowledge.zweig.zaehigkeit':       'Zähigkeit',
    'knowledge.zweig.gier':             'Gier',
    'knowledge.zweig.open':             '— Zweig offen —',
    'knowledge.not.kaltbluetig.label':  'Kaltblütig',
    'knowledge.not.kaltbluetig.desc':   '+10 % Schaden und +5 % Kritchance.',
    'knowledge.not.schlagfolge.label':  'Schlagfolge',
    'knowledge.not.schlagfolge.desc':   '+8 % Angriffstempo und +8 % Schaden.',
    'knowledge.not.eisenhaut.label':    'Eisenhaut',
    'knowledge.not.eisenhaut.desc':     '+0,15 Rüstung und +30 Leben.',
    'knowledge.not.zaeher_lauf.label':  'Zäher Lauf',
    'knowledge.not.zaeher_lauf.desc':   '+0,10 Rüstung und +8 % Lauftempo.',
    'knowledge.not.aasgeier.label':     'Aasgeier',
    'knowledge.not.aasgeier.desc':      '+20 % Gold und +40 Aufsammelweite.',
    'knowledge.not.gelehrter.label':    'Gelehrter',
    'knowledge.not.gelehrter.desc':     '+15 % Erfahrung und +10 % Fundqualität.',
    'knowledge.not.locked':             'Braucht {n} Ränge im Zweig',
    'knowledge.key.ruhige_hand.label': 'Ruhige Hand',
    'knowledge.key.ruhige_hand.desc':  'Keine kritischen Treffer mehr, −35 % Lauftempo — dafür +45 % Schaden.',
    'knowledge.key.blutrausch.label':  'Blutrausch',
    'knowledge.key.blutrausch.desc':   'Keine Rüstung mehr — dafür +40 % Schaden und +15 % Kritchance.',
    'knowledge.key.turmwache.label':   'Turmwache',
    'knowledge.key.turmwache.desc':    '−40 % Schaden — dafür +0,20 Rüstung und +40 Leben.',
    'knowledge.key.leichter_schritt.label': 'Leichter Schritt',
    'knowledge.key.leichter_schritt.desc':  'Keine Rüstung mehr — dafür +20 % Schaden, +35 % Lauftempo und +60 Aufsammelweite.',
    'knowledge.key.zaeher_fund.label': 'Zäher Fund',
    'knowledge.key.zaeher_fund.desc':  'Halbierte Fundqualität, −40 % Erfahrung — dafür +80 % Gold.',
    'knowledge.key.sammler.label':     'Sammler',
    'knowledge.key.sammler.desc':      '−50 % Gold — dafür +50 % Fundqualität und +30 % Erfahrung.',
    'knowledge.key.only_one':          'Nur ein Grundsatz zur Zeit.',
    'knowledge.key.needs_notable':     'Braucht ein Bündel',
    'knowledge.key.cost':              '{n} Fragmente',
    // Seit der Preis im Hover steht, faellt der Einzelfall auf: bei den
    // Kleinknoten kostet ein Rang genau eines, und "1 Fragmente" ist falsch.
    'knowledge.key.cost_one':          '1 Fragment',
    'knowledge.node.critdmg.label':      'Wuchtiger Hieb',
    'knowledge.node.critdmg.desc':       '+6 % Kritschaden pro Rang',
    'knowledge.node.dodge.label':        'Leichtfüssig',
    'knowledge.node.dodge.desc':         '+2 % Ausweichchance pro Rang',
    'knowledge.node.atkspeed.label':     'Geübte Hände',
    'knowledge.node.atkspeed.desc':      '+3 % Angriffstempo pro Rang'
  };
  var I18N_EN = {
    'knowledge.title':             'Knowledge Tree',
    'knowledge.fragments':         'Fragments: {count}',
    'knowledge.btn.respec':        '[ Respec ]',
    'knowledge.btn.close':         '[ Close ]',
    'knowledge.btn.to_keystones':  '[ Tenets ]',
    'knowledge.btn.to_nodes':      '[ Knowledge ]',
    'knowledge.key.btn_set':       'Choose',
    'knowledge.key.btn_release':   'Release',
    'knowledge.btn.test_give':     '[ +1 Fragment ]',
    'knowledge.respec.confirm':    'Really reset the knowledge tree?',
    'knowledge.respec.yes':        'Yes',
    'knowledge.respec.no':         'No',
    'knowledge.rank':              'Rank {rank}/{max}',
    'knowledge.maxRank':           'Maximum rank reached',
    'knowledge.noFragments':       'No fragments',
    'knowledge.node.damage.label':       'Strength of Knowledge',
    'knowledge.node.damage.desc':        '+5% damage per rank',
    'knowledge.node.armor.label':        'Hardened Skin',
    'knowledge.node.armor.desc':         '+5% armor per rank',
    'knowledge.node.speed.label':        'Fleet Footed',
    'knowledge.node.speed.desc':         '+3% movement speed per rank',
    'knowledge.node.max_hp.label':       'Robust Body',
    'knowledge.node.max_hp.desc':        '+10 max HP per rank',
    'knowledge.node.crit.label':         'Trained Eye',
    'knowledge.node.crit.desc':          '+2% crit chance per rank',
    'knowledge.node.xp.label':           "Scholar's Mind",
    'knowledge.node.xp.desc':            '+5% XP gain per rank',
    'knowledge.node.gold.label':         'Lucky',
    'knowledge.node.gold.desc':          '+5% gold drops per rank',
    'knowledge.node.pickup.label':       'Magnetic Pull',
    'knowledge.node.pickup.desc':        '+20 px pickup radius per rank',
    'knowledge.node.magic_find.label':   'Magic Sense',
    'knowledge.node.magic_find.desc':    '+5% magic find per rank',
    'knowledge.respec.cost':            'Costs {n} gold.',
    'knowledge.respec.broke':           'You need {n} gold.',
    'knowledge.zweig.kraft':            'Force',
    'knowledge.zweig.zaehigkeit':       'Fortitude',
    'knowledge.zweig.gier':             'Greed',
    'knowledge.zweig.open':             '— branch open —',
    'knowledge.not.kaltbluetig.label':  'Cold Blood',
    'knowledge.not.kaltbluetig.desc':   '+10% damage and +5% crit chance.',
    'knowledge.not.schlagfolge.label':  'Cadence',
    'knowledge.not.schlagfolge.desc':   '+8% attack speed and +8% damage.',
    'knowledge.not.eisenhaut.label':    'Ironskin',
    'knowledge.not.eisenhaut.desc':     '+0.15 armour and +30 life.',
    'knowledge.not.zaeher_lauf.label':  'Steady Gait',
    'knowledge.not.zaeher_lauf.desc':   '+0.10 armour and +8% move speed.',
    'knowledge.not.aasgeier.label':     'Carrion Eye',
    'knowledge.not.aasgeier.desc':      '+20% gold and +40 pickup range.',
    'knowledge.not.gelehrter.label':    'Scholar',
    'knowledge.not.gelehrter.desc':     '+15% experience and +10% find quality.',
    'knowledge.not.locked':             'Needs {n} ranks in the branch',
    'knowledge.key.ruhige_hand.label': 'Steady Hand',
    'knowledge.key.ruhige_hand.desc':  'No more critical hits, −35% move speed — but +45% damage.',
    'knowledge.key.blutrausch.label':  'Blood Rage',
    'knowledge.key.blutrausch.desc':   'No more armour — but +40% damage and +15% crit chance.',
    'knowledge.key.turmwache.label':   'Tower Guard',
    'knowledge.key.turmwache.desc':    '−40% damage — but +0.20 armour and +40 life.',
    'knowledge.key.leichter_schritt.label': 'Light Step',
    'knowledge.key.leichter_schritt.desc':  'No more armour — but +20% damage, +35% move speed and +60 pickup range.',
    'knowledge.key.zaeher_fund.label': 'Hard Bargain',
    'knowledge.key.zaeher_fund.desc':  'Halved find quality, −40% experience — but +80% gold.',
    'knowledge.key.sammler.label':     'Collector',
    'knowledge.key.sammler.desc':      '−50% gold — but +50% find quality and +30% experience.',
    'knowledge.key.only_one':          'Only one tenet at a time.',
    'knowledge.key.needs_notable':     'Needs a bundle',
    'knowledge.key.cost':              '{n} fragments',
    'knowledge.key.cost_one':          '1 fragment',
    'knowledge.node.critdmg.label':      'Heavy Blow',
    'knowledge.node.critdmg.desc':       '+6% critical damage per rank',
    'knowledge.node.dodge.label':        'Light-footed',
    'knowledge.node.dodge.desc':         '+2% dodge chance per rank',
    'knowledge.node.atkspeed.label':     'Practiced Hands',
    'knowledge.node.atkspeed.desc':      '+3% attack speed per rank'
  };

  // --- Static catalog -----------------------------------------------------
  // perRank.kind:
  //   'mult' — buff field = 1 + (rank * value)
  //   'add'  — buff field = rank * value
  // Stable IDs — never rename (persisted contract).
  var CATALOG = [
    { id: 'node_damage',     labelKey: 'knowledge.node.damage.label',     descKey: 'knowledge.node.damage.desc',     maxRank: 5, perRank: { field: 'damageMult',     kind: 'mult', value: 0.05 } },
    { id: 'node_armor',      labelKey: 'knowledge.node.armor.label',      descKey: 'knowledge.node.armor.desc',      maxRank: 5, perRank: { field: 'armorAdd',      kind: 'add',  value: 0.05 } },
    { id: 'node_speed',      labelKey: 'knowledge.node.speed.label',      descKey: 'knowledge.node.speed.desc',      maxRank: 5, perRank: { field: 'speedMult',     kind: 'mult', value: 0.03 } },
    { id: 'node_max_hp',     labelKey: 'knowledge.node.max_hp.label',     descKey: 'knowledge.node.max_hp.desc',     maxRank: 5, perRank: { field: 'maxHpAdd',      kind: 'add',  value: 10   } },
    { id: 'node_crit',       labelKey: 'knowledge.node.crit.label',       descKey: 'knowledge.node.crit.desc',       maxRank: 5, perRank: { field: 'critAdd',       kind: 'add',  value: 0.02 } },
    // #116: ALLE Knoten auf maxRank 5.
    //
    // Die Gier-Knoten standen auf 3, wodurch der Zweig 12 statt 15 Raenge
    // hatte — mit den zwei neuen Knoten unten waere die Schieflage auf 20/20/12
    // gewachsen. Jetzt haben alle drei Zweige 20 Raenge, und das Tor (8) ist
    // ueberall derselbe Anteil.
    //
    // Der DECKEL bleibt, indem der Wert je Rang faellt: 5 % x 3 = 3 % x 5.
    // Nur die Koernung wird feiner, die Obergrenze ist unveraendert.
    { id: 'node_xp',         labelKey: 'knowledge.node.xp.label',         descKey: 'knowledge.node.xp.desc',         maxRank: 5, perRank: { field: 'xpMult',        kind: 'mult', value: 0.03 } },
    { id: 'node_gold',       labelKey: 'knowledge.node.gold.label',       descKey: 'knowledge.node.gold.desc',       maxRank: 5, perRank: { field: 'goldMult',      kind: 'mult', value: 0.03 } },
    { id: 'node_pickup',     labelKey: 'knowledge.node.pickup.label',     descKey: 'knowledge.node.pickup.desc',     maxRank: 5, perRank: { field: 'pickupAddRange', kind: 'add', value: 12   } },
    { id: 'node_magic_find', labelKey: 'knowledge.node.magic_find.label', descKey: 'knowledge.node.magic_find.desc', maxRank: 5, perRank: { field: 'magicFindMult', kind: 'mult', value: 0.03 } },
    // Neu in Kraft: der Kritmultiplikator ist 1,5 + playerCritDamageBonus
    // (player.js:832) und wurde bisher NUR von Staerke gespeist. Zusammen mit
    // node_crit ergibt das einen echten Krit-Aufbau — der eine macht Krits
    // haeufiger, der andere haerter. Nebenwirkung: der Grundsatz "Ruhige Hand"
    // (kein Krit) wird dadurch teurer, und genau der Preis fehlte ihm.
    { id: 'node_kritschaden', labelKey: 'knowledge.node.critdmg.label', descKey: 'knowledge.node.critdmg.desc', maxRank: 5, perRank: { field: 'critDamageAdd', kind: 'add', value: 0.06 } },
    // Neu in Zaehigkeit: PLAYER_DODGE_CHANCE ist ohne Ausruestung 0
    // (inventory.js:1527). Das belebt nebenbei mobility_lightning_reflex aus
    // #93 — das Passiv feuert nur nach einem bestandenen Ausweichen und war
    // fuer die meisten Spieler deshalb wirkungslos.
    { id: 'node_ausweichen',  labelKey: 'knowledge.node.dodge.label',  descKey: 'knowledge.node.dodge.desc',  maxRank: 5, perRank: { field: 'dodgeAdd',      kind: 'add', value: 0.02 } },
    // #116: node_cdr ist WEG. Die Abklingzeit gab es in BEIDEN Baeumen —
    // getLootAbilityCooldownReduction (player.js:1230) addiert cdrAll zu drei
    // weiteren Quellen, und der Talentbaum senkt sie zusaetzlich ueber den
    // Rang (bis -50 %). Zwei unbegrenzte Systeme auf einer Zahl enden am
    // 100-ms-Boden.
    //
    // Sie bleibt beim Talentbaum, weil sie dort an eine ENTSCHEIDUNG haengt
    // ("welche Faehigkeit baue ich aus"); hier haing sie an nichts.
    // Angriffstempo ist der saubere Ersatz: es betrifft den Grundangriff, hat
    // im Talentbaum keinen Gegenpart, und die Rangsumme bleibt bei 42.
    //
    // Altstaende mit node_cdr laufen in den "unbekannter Knoten"-Zweig von
    // _absorbPersisted und bekommen ihre Fragmente zurueck.
    { id: 'node_angriffstempo', labelKey: 'knowledge.node.atkspeed.label', descKey: 'knowledge.node.atkspeed.desc', maxRank: 5, perRank: { field: 'attackSpeedMult', kind: 'mult', value: 0.03 } }
  ];
  // Sum of maxRanks = 5+5+5+5+5+3+3+3+3+5 = 42 fragments to max all nodes.

  var CATALOG_BY_ID = {};
  for (var ci = 0; ci < CATALOG.length; ci++) CATALOG_BY_ID[CATALOG[ci].id] = CATALOG[ci];

  // === KEYSTONES (#116) ====================================================
  //
  // Die zehn Knoten oben sind allesamt das, was PoE "Small Passives" nennt:
  // ein Wert, unbedingt, linear. Der Baum bestand damit nur aus Verbindungs-
  // stuecken und hatte kein Ziel — und weil Fragmente sich ueber die Laeufe
  // unbegrenzt ansammeln (resetForNewGame nur bei NEUEM Spiel), lief jede
  // Knappheit ohnehin ab. Dauerhaft ist nur, was sich gegenseitig ausschliesst.
  //
  // Darum: sechs Keystones, von denen HOECHSTENS EINER gesetzt sein darf. Das
  // bleibt eine Wahl, egal wie viele Fragmente jemand hat.
  //
  // ZU DEN PREISEN. Ein frueherer Entwurf liess sie auf Werte zeigen, die bei
  // null anfangen ("kein Krit", "keine Ruestung"). Gerechnet mit critMult 1,5
  // haette "kein Krit" selbst einen Krit-Aufbau nur 15 % Schaden gekostet und
  // +30 % gebracht — ein Bonus im Kostuem eines Tauschs. Jeder Preis hier
  // trifft deshalb einen Wert, der laeuft:
  //
  //   Kampfwert (Angriff x effektive LP) gegen einen Bezugscharakter auf
  //   Tiefe 20 (Schaden 6, Krit 0,20, Ruestung 0,35, 120 LP):
  //     Ruhige Hand      +32 %   (zahlt mit 35 % Bewegungstempo)
  //     Blutrausch        -3 %
  //     Turmwache        +16 %
  //     Leichter Schritt -22 %   (bekommt 35 % Bewegungstempo)
  //     Zaeher Fund        0 %   (reiner Wirtschaftstausch)
  //     Sammler            0 %
  //
  // Die beiden Ausreisser sind genau die, die Bewegungstempo tauschen — das
  // die Kampfmetrik nicht erfasst. Wer Tempo hergibt, bekommt Kampfkraft;
  // wer Tempo will, zahlt dafuer.
  //
  // ENTZUG UEBER NEGATIVE ADDITIVE: critAdd/armorAdd werden bei 0 geklemmt
  // (inventory.js:1636/1645), ein Wert von -1 erzwingt also die Null,
  // unabhaengig von Ausruestung und Baum. Im Spiel nachgemessen:
  // Krit 0,25 -> 0, Ruestung 0,30 -> 0.
  var KEYSTONE_KOSTEN = 5;
  var KEYSTONES = [
    { id: 'key_ruhige_hand', zweig: 'kraft',
      labelKey: 'knowledge.key.ruhige_hand.label', descKey: 'knowledge.key.ruhige_hand.desc',
      effekte: [
        { field: 'critAdd',    kind: 'add',  value: -1 },
        { field: 'speedMult',  kind: 'mult', value: 0.65 },
        { field: 'damageMult', kind: 'mult', value: 1.45 }
      ] },
    { id: 'key_blutrausch', zweig: 'kraft',
      labelKey: 'knowledge.key.blutrausch.label', descKey: 'knowledge.key.blutrausch.desc',
      effekte: [
        { field: 'armorAdd',   kind: 'add',  value: -1 },
        { field: 'damageMult', kind: 'mult', value: 1.40 },
        { field: 'critAdd',    kind: 'add',  value: 0.15 }
      ] },
    { id: 'key_turmwache', zweig: 'zaehigkeit',
      labelKey: 'knowledge.key.turmwache.label', descKey: 'knowledge.key.turmwache.desc',
      effekte: [
        { field: 'damageMult', kind: 'mult', value: 0.60 },
        { field: 'armorAdd',   kind: 'add',  value: 0.20 },
        { field: 'maxHpAdd',   kind: 'add',  value: 40 }
      ] },
    { id: 'key_leichter_schritt', zweig: 'zaehigkeit',
      labelKey: 'knowledge.key.leichter_schritt.label', descKey: 'knowledge.key.leichter_schritt.desc',
      effekte: [
        { field: 'armorAdd',       kind: 'add',  value: -1 },
        { field: 'damageMult',     kind: 'mult', value: 1.20 },
        { field: 'speedMult',      kind: 'mult', value: 1.35 },
        { field: 'pickupAddRange', kind: 'add',  value: 60 }
      ] },
    { id: 'key_zaeher_fund', zweig: 'gier',
      labelKey: 'knowledge.key.zaeher_fund.label', descKey: 'knowledge.key.zaeher_fund.desc',
      effekte: [
        { field: 'magicFindMult', kind: 'mult', value: 0.5 },
        { field: 'xpMult',        kind: 'mult', value: 0.60 },
        { field: 'goldMult',      kind: 'mult', value: 1.80 }
      ] },
    { id: 'key_sammler', zweig: 'gier',
      labelKey: 'knowledge.key.sammler.label', descKey: 'knowledge.key.sammler.desc',
      effekte: [
        { field: 'goldMult',      kind: 'mult', value: 0.5 },
        { field: 'magicFindMult', kind: 'mult', value: 1.50 },
        { field: 'xpMult',        kind: 'mult', value: 1.30 }
      ] }
  ];
  var KEYSTONE_BY_ID = {};
  for (var ki = 0; ki < KEYSTONES.length; ki++) KEYSTONE_BY_ID[KEYSTONES[ki].id] = KEYSTONES[ki];

  // === ZWEIGE (#116) =======================================================
  // Die zehn Knoten teilen sich in drei Zweige — die Rangsummen gehen genau
  // auf: Kraft 15, Zaehigkeit 15, Gier 12 = 42.
  var ZWEIG = {
    node_damage: 'kraft', node_crit: 'kraft', node_angriffstempo: 'kraft',
    node_kritschaden: 'kraft',
    node_armor: 'zaehigkeit', node_max_hp: 'zaehigkeit', node_speed: 'zaehigkeit',
    node_ausweichen: 'zaehigkeit',
    node_xp: 'gier', node_gold: 'gier', node_pickup: 'gier', node_magic_find: 'gier'
  };

  /** Wie viele Raenge stecken in einem Zweig? */
  function zweigRaenge(zweig) {
    var s = 0;
    for (var id in ZWEIG) {
      if (ZWEIG[id] === zweig) s += (state.ranks[id] | 0);
    }
    return s;
  }

  // === NOTABLES (#116) =====================================================
  //
  // Die zehn Knoten sind Verbindungsstuecke: ein Wert, unbedingt, linear. In
  // PoE waere das der Teil des Baums, den man durchquert, ohne hinzusehen.
  // Was fehlte, waren ZIELE — Knoten, auf die man zusteuert.
  //
  // Ein Notable buendelt zwei zusammengehoerige Wirkungen und verlangt sechs
  // Raenge im eigenen Zweig. Damit ist er kein Krumel mehr, sondern eine
  // Anschaffung, auf die man hinspart.
  //
  // Nicht ausschliessend (anders als die Keystones): man darf alle sechs
  // haben. Die dauerhafte Entscheidung traegt der Keystone.
  var NOTABLE_KOSTEN = 4;
  // 8 statt 6: bei 20 Raengen je Zweig waeren 6 nur noch 30 % statt der
  // vorherigen 40 %. Mindestpreis eines Grundsatzes damit 8 + 4 + 5 = 17.
  var NOTABLE_BRAUCHT = 8;
  var NOTABLES = [
    { id: 'not_kaltbluetig', zweig: 'kraft',
      labelKey: 'knowledge.not.kaltbluetig.label', descKey: 'knowledge.not.kaltbluetig.desc',
      effekte: [{ field: 'damageMult', kind: 'mult', value: 1.10 },
                { field: 'critAdd',    kind: 'add',  value: 0.05 }] },
    { id: 'not_schlagfolge', zweig: 'kraft',
      labelKey: 'knowledge.not.schlagfolge.label', descKey: 'knowledge.not.schlagfolge.desc',
      effekte: [{ field: 'attackSpeedMult', kind: 'mult', value: 1.08 },
                { field: 'damageMult',      kind: 'mult', value: 1.08 }] },
    { id: 'not_eisenhaut', zweig: 'zaehigkeit',
      labelKey: 'knowledge.not.eisenhaut.label', descKey: 'knowledge.not.eisenhaut.desc',
      effekte: [{ field: 'armorAdd', kind: 'add', value: 0.15 },
                { field: 'maxHpAdd', kind: 'add', value: 30 }] },
    { id: 'not_zaeher_lauf', zweig: 'zaehigkeit',
      labelKey: 'knowledge.not.zaeher_lauf.label', descKey: 'knowledge.not.zaeher_lauf.desc',
      effekte: [{ field: 'armorAdd',  kind: 'add',  value: 0.10 },
                { field: 'speedMult', kind: 'mult', value: 1.08 }] },
    { id: 'not_aasgeier', zweig: 'gier',
      labelKey: 'knowledge.not.aasgeier.label', descKey: 'knowledge.not.aasgeier.desc',
      effekte: [{ field: 'goldMult',       kind: 'mult', value: 1.20 },
                { field: 'pickupAddRange', kind: 'add',  value: 40 }] },
    { id: 'not_gelehrter', zweig: 'gier',
      labelKey: 'knowledge.not.gelehrter.label', descKey: 'knowledge.not.gelehrter.desc',
      effekte: [{ field: 'xpMult',        kind: 'mult', value: 1.15 },
                { field: 'magicFindMult', kind: 'mult', value: 1.10 }] }
  ];
  var NOTABLE_BY_ID = {};
  for (var ni = 0; ni < NOTABLES.length; ni++) NOTABLE_BY_ID[NOTABLES[ni].id] = NOTABLES[ni];

  /** Ist der Zweig weit genug ausgebaut? */
  function notableOffen(id) {
    var n = NOTABLE_BY_ID[id];
    if (!n) return false;
    return zweigRaenge(n.zweig) >= NOTABLE_BRAUCHT;
  }

  // --- Default primitives (window-bound, swappable via _configureForTest) -
  function _defaultPrimitives() {
    var hasWindow = typeof window !== 'undefined';
    return {
      // #63: SlotStorage präfixiert den Key mit dem aktiven Speicherslot.
      // Fallback auf localStorage, wenn saveSlots.js nicht geladen ist.
      storage: (hasWindow && (window.SlotStorage || window.localStorage)) || {
        getItem: function () { return null; },
        setItem: function () {},
        removeItem: function () {}
      },
      i18n: (hasWindow && window.i18n) || {
        register: function () {}, t: function (k) { return k; }
      },
      recalcDerived: null   // resolved lazily at invoke time so test seam can override
    };
  }

  // --- Internal state -----------------------------------------------------
  var primitives = _defaultPrimitives();
  var state = _freshState();
  var subscribers = [];
  var _storageWarned = false;

  function _freshState() {
    var ranks = {};
    for (var i = 0; i < CATALOG.length; i++) ranks[CATALOG[i].id] = 0;
    return {
      initialized: false,
      i18nRegistered: false,
      fragments: 0,
      ranks: ranks
    };
  }

  // --- Persistence --------------------------------------------------------

  function _persist() {
    var blob = JSON.stringify({
      version: SCHEMA_VERSION,
      fragments: state.fragments | 0,
      ranks: _copyRanks(state.ranks)
    });
    try { primitives.storage.setItem(STORAGE_KEY, blob); }
    catch (err) {
      if (!_storageWarned) {
        _storageWarned = true;
        try { console.warn('[KnowledgeTree] persist failed; running in-memory only', err); } catch (_) {}
      }
    }
  }

  function _loadPersisted() {
    var raw;
    try { raw = primitives.storage.getItem(STORAGE_KEY); } catch (_) { raw = null; }
    if (!raw) return null;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (_) {
      try { console.warn('[KnowledgeTree] discarded malformed blob'); } catch (_) {}
      _clearPersisted();
      return null;
    }
    if (!parsed || typeof parsed !== 'object' || parsed.version !== SCHEMA_VERSION) {
      try { console.warn('[KnowledgeTree] discarded incompatible-version blob'); } catch (_) {}
      _clearPersisted();
      return null;
    }
    return parsed;
  }

  function _clearPersisted() {
    try { primitives.storage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  // Apply a persisted blob to the live state. Out-of-range ranks are clamped
  // and the difference refunded into fragments; unknown nodes are dropped with
  // their points refunded. FR-11: missing nodes default to rank 0 (already
  // the case from _freshState).
  function _absorbPersisted(parsed) {
    var fragments = Math.max(0, Math.floor(Number(parsed.fragments) || 0));
    var incoming = (parsed.ranks && typeof parsed.ranks === 'object') ? parsed.ranks : {};
    for (var nodeId in incoming) {
      if (!Object.prototype.hasOwnProperty.call(incoming, nodeId)) continue;
      var desired = Math.max(0, Math.floor(Number(incoming[nodeId]) || 0));
      // #116: Keystones stehen im selben Rang-Beutel, sind aber 0/1 und
      // duerfen nur EINMAL vorkommen. Ohne diesen Zweig fielen sie unten in
      // den "unbekannter Knoten"-Fall und wuerden mit 1 statt 5 Fragmenten
      // erstattet — der Spieler haette vier Fragmente verloren.
      if (NOTABLE_BY_ID[nodeId]) {
        // Wie die Keystones: 0/1, und ohne diesen Zweig faenden sie sich im
        // "unbekannter Knoten"-Fall mit 1 statt NOTABLE_KOSTEN wieder.
        if (desired > 0) state.ranks[nodeId] = 1;
        continue;
      }
      if (KEYSTONE_BY_ID[nodeId]) {
        if (desired <= 0) continue;
        if (getActiveKeystone()) {
          // Zwei Keystones im Stand (Handarbeit oder alter Fehler): der
          // zweite wird erstattet, gesetzt bleibt der erste.
          fragments += KEYSTONE_KOSTEN;
          continue;
        }
        state.ranks[nodeId] = 1;
        continue;
      }
      var node = CATALOG_BY_ID[nodeId];
      if (!node) {
        fragments += desired;
        try { console.warn('[KnowledgeTree] unknown node in storage refunded', nodeId, desired); } catch (_) {}
        continue;
      }
      var clamped = Math.min(desired, node.maxRank);
      if (clamped < desired) {
        fragments += (desired - clamped);
        try { console.warn('[KnowledgeTree] rank clamped, refund issued', nodeId, desired, clamped); } catch (_) {}
      }
      state.ranks[nodeId] = clamped;
    }
    state.fragments = fragments;
  }

  // --- Buff recomputation -------------------------------------------------

  // Object identity stable across module lifetime — callers may cache the ref.
  function _ensureBuffsBag() {
    if (typeof window === 'undefined') return null;
    if (!window.knowledgeTreeBuffs) {
      window.knowledgeTreeBuffs = {
        damageMult: 1.0,
        armorAdd: 0,
        speedMult: 1.0,
        maxHpAdd: 0,
        critAdd: 0,
        xpMult: 1.0,
        goldMult: 1.0,
        pickupAddRange: 0,
        magicFindMult: 1.0,
        cdrAll: 0
      };
    }
    return window.knowledgeTreeBuffs;
  }

  function _applyRanksToBuffs() {
    var b = _ensureBuffsBag();
    if (!b) return;
    // Reset to identity
    b.damageMult = 1.0;
    b.armorAdd = 0;
    b.speedMult = 1.0;
    b.maxHpAdd = 0;
    b.critAdd = 0;
    b.xpMult = 1.0;
    b.goldMult = 1.0;
    b.pickupAddRange = 0;
    b.magicFindMult = 1.0;
    b.attackSpeedMult = 1.0;
    b.critDamageAdd = 0;
    b.dodgeAdd = 0;
    // cdrAll bleibt auf 0: player.js:1230 liest das Feld weiterhin, es wird
    // nur von keinem Knoten mehr gespeist.
    b.cdrAll = 0;
    // Apply each rank
    // AKKUMULIEREN statt zuweisen. Bisher gehoerte jedes Feld genau einem
    // Knoten, da war die Zuweisung gleichwertig. Keystones greifen aber auf
    // dieselben Felder — ohne Akkumulation wuerde der zuletzt angewandte
    // Effekt die anderen ueberschreiben.
    for (var i = 0; i < CATALOG.length; i++) {
      var node = CATALOG[i];
      var rank = state.ranks[node.id] | 0;
      if (rank <= 0) continue;
      var pr = node.perRank;
      var delta = rank * pr.value;
      if (pr.kind === 'mult') {
        b[pr.field] = (typeof b[pr.field] === 'number' ? b[pr.field] : 1) * (1 + delta);
      } else {
        b[pr.field] = (typeof b[pr.field] === 'number' ? b[pr.field] : 0) + delta;
      }
    }
    // Notables nach den kleinen Knoten, aber VOR dem Keystone — sie sind
    // gewoehnliche Boni, der Keystone ist der Tausch, der zuletzt gilt.
    for (var nj = 0; nj < NOTABLES.length; nj++) {
      var nt = NOTABLES[nj];
      if ((state.ranks[nt.id] | 0) <= 0) continue;
      for (var nk = 0; nk < nt.effekte.length; nk++) {
        var nf = nt.effekte[nk];
        if (nf.kind === 'mult') {
          b[nf.field] = (typeof b[nf.field] === 'number' ? b[nf.field] : 1) * nf.value;
        } else {
          b[nf.field] = (typeof b[nf.field] === 'number' ? b[nf.field] : 0) + nf.value;
        }
      }
    }
    // Keystone zuletzt: sein Entzug soll ueber allem stehen, was die kleinen
    // Knoten beigesteuert haben (critAdd -1 schlaegt node_crit +0,10).
    var aktiv = getActiveKeystone();
    if (aktiv) {
      var ks = KEYSTONE_BY_ID[aktiv];
      for (var ei = 0; ei < ks.effekte.length; ei++) {
        var ef = ks.effekte[ei];
        if (ef.kind === 'mult') {
          b[ef.field] = (typeof b[ef.field] === 'number' ? b[ef.field] : 1) * ef.value;
        } else {
          b[ef.field] = (typeof b[ef.field] === 'number' ? b[ef.field] : 0) + ef.value;
        }
      }
    }
  }

  /** Welcher Keystone ist gesetzt? null = keiner. */
  function getActiveKeystone() {
    for (var i = 0; i < KEYSTONES.length; i++) {
      if ((state.ranks[KEYSTONES[i].id] | 0) > 0) return KEYSTONES[i].id;
    }
    return null;
  }

  // --- Subscribers --------------------------------------------------------

  function onChange(cb) {
    if (typeof cb !== 'function') return function () {};
    subscribers.push(cb);
    return function unsubscribe() {
      var i = subscribers.indexOf(cb);
      if (i >= 0) subscribers.splice(i, 1);
    };
  }

  function _notify() {
    var snapshot = getState();
    // Snapshot the list so subscribers added during iteration only fire on
    // the next notify. NFR-04: a throwing subscriber must not block others.
    var list = subscribers.slice();
    for (var i = 0; i < list.length; i++) {
      try { list[i](snapshot); }
      catch (e) {
        try { console.warn('[KnowledgeTree] subscriber threw, others continue', e); } catch (_) {}
      }
    }
  }

  function _copyRanks(src) {
    var out = {};
    for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
    return out;
  }

  // --- Public API ---------------------------------------------------------

  function init() {
    if (state.initialized) return;
    state.initialized = true;
    if (!state.i18nRegistered) {
      try {
        primitives.i18n.register('de', I18N_DE);
        primitives.i18n.register('en', I18N_EN);
        state.i18nRegistered = true;
      } catch (_) { /* swallow */ }
    }
    var persisted = _loadPersisted();
    if (persisted) _absorbPersisted(persisted);
    _applyRanksToBuffs();
  }

  function getFragments() { return state.fragments | 0; }

  function getRank(nodeId) {
    return state.ranks[nodeId] | 0;
  }

  function getMaxRank(nodeId) {
    var node = CATALOG_BY_ID[nodeId];
    return node ? node.maxRank : null;
  }

  // Defensive copy — caller may not mutate internal catalog.
  function getCatalog() {
    var out = new Array(CATALOG.length);
    for (var i = 0; i < CATALOG.length; i++) {
      var n = CATALOG[i];
      out[i] = {
        id: n.id,
        labelKey: n.labelKey,
        descKey: n.descKey,
        maxRank: n.maxRank,
        perRank: { field: n.perRank.field, kind: n.perRank.kind, value: n.perRank.value }
      };
    }
    return out;
  }

  function getState() {
    return { fragments: state.fragments | 0, ranks: _copyRanks(state.ranks) };
  }

  function addFragments(n) {
    if (typeof n !== 'number' || !isFinite(n)) return;
    var delta = Math.trunc(n);
    if (delta === 0) return;
    if (delta < 0) {
      try { console.warn('[KnowledgeTree] addFragments rejected negative', delta); } catch (_) {}
      return;
    }
    state.fragments = (state.fragments | 0) + delta;
    _persist();
    _notify();
  }

  /**
   * Keystone setzen. Kostet KEYSTONE_KOSTEN Fragmente, und es darf immer nur
   * EINER gesetzt sein — das ist der Teil, der den Vollausbau ueberlebt.
   *
   * Wechseln geht ueber loeseKeystone(): der Einsatz kommt vollstaendig
   * zurueck. Der Preis ist nicht die Huerde, der Ausschluss ist es.
   */
  /**
   * Steht der Weg zu diesem Grundsatz offen?
   *
   * Er verlangt MINDESTENS EIN BUENDEL seines Zweigs. Ohne das war er fuer
   * fuenf Fragmente zu haben, ganz ohne Investition — und das drehte die
   * Anreize um: sein Preis trifft einen Wert, den erst der Zweig liefert.
   * Gemessen fuer "Ruhige Hand" (kein Krit, +45 % Schaden):
   *     0 Kraft-Raenge -> Krit 0, Verlust 0 %,   netto +45 %
   *    10 Kraft-Raenge -> Krit 10 %, Verlust 4,8 %, netto +38 %
   * Der Grundsatz war also am staerksten, wenn man nichts investiert hatte.
   *
   * Verkettet statt beziffert: 6 Raenge -> Buendel -> Grundsatz. Der
   * Mindestpreis ist damit 6 + 4 + 5 = 15 Fragmente, und die Bedingung
   * skaliert von selbst mit, statt an einer erfundenen Schwelle zu haengen.
   */
  function keystoneOffen(id) {
    var k = KEYSTONE_BY_ID[id];
    if (!k) return false;
    for (var i = 0; i < NOTABLES.length; i++) {
      if (NOTABLES[i].zweig !== k.zweig) continue;
      if ((state.ranks[NOTABLES[i].id] | 0) > 0) return true;
    }
    return false;
  }

  function investKeystone(id) {
    var k = KEYSTONE_BY_ID[id];
    if (!k) return false;
    if ((state.ranks[id] | 0) > 0) return false;      // schon gesetzt
    if (getActiveKeystone()) return false;            // ein anderer laeuft
    if (!keystoneOffen(id)) return false;             // Zweig nicht gegangen
    if (state.fragments < KEYSTONE_KOSTEN) return false;
    state.fragments -= KEYSTONE_KOSTEN;
    state.ranks[id] = 1;
    _applyRanksToBuffs();
    _persist();
    _callRecalc();
    _notify();
    return true;
  }

  /** Gesetzten Keystone loesen; der Einsatz wird erstattet. */
  function loeseKeystone() {
    var aktiv = getActiveKeystone();
    if (!aktiv) return false;
    delete state.ranks[aktiv];
    state.fragments += KEYSTONE_KOSTEN;
    _applyRanksToBuffs();
    _persist();
    _callRecalc();
    _notify();
    return true;
  }

  /**
   * Notable setzen. Festpreis, und der Zweig muss weit genug ausgebaut sein —
   * das ist der Unterschied zu einem blossen Bonus: man kommt nur hin, wenn
   * man den Weg gegangen ist.
   */
  function investNotable(id) {
    var n = NOTABLE_BY_ID[id];
    if (!n) return false;
    if ((state.ranks[id] | 0) > 0) return false;
    if (!notableOffen(id)) return false;
    if (state.fragments < NOTABLE_KOSTEN) return false;
    state.fragments -= NOTABLE_KOSTEN;
    state.ranks[id] = 1;
    _applyRanksToBuffs();
    _persist();
    _callRecalc();
    _notify();
    return true;
  }

  function invest(nodeId) {
    // Keystones laufen ueber ihren eigenen Pfad (Festpreis + Ausschluss).
    if (KEYSTONE_BY_ID[nodeId]) return investKeystone(nodeId);
    if (NOTABLE_BY_ID[nodeId]) return investNotable(nodeId);
    var node = CATALOG_BY_ID[nodeId];
    if (!node) return false;
    var currentRank = state.ranks[nodeId] | 0;
    if (state.fragments < 1) return false;
    if (currentRank >= node.maxRank) return false;
    state.fragments -= 1;
    state.ranks[nodeId] = currentRank + 1;
    _applyRanksToBuffs();
    _persist();
    _callRecalc();
    _notify();
    return true;
  }

  /**
   * Gold-Kosten eines Respecs — dieselbe Formel wie im Talentbaum
   * (skillTree.js getRespecCost): acht Tiefeneinkommen. Zwei Baeume, die
   * dasselbe tun, sollen nicht verschieden viel kosten.
   *
   * Ohne LootSystem (Tests, frueher Start) kostet er nichts — ein Respec darf
   * nie daran scheitern, dass ein Modul fehlt.
   */
  function getRespecCost() {
    var LS = (typeof window !== 'undefined') ? window.LootSystem : null;
    if (LS && typeof LS.preisNachTiefeneinkommen === 'function' && LS.PREIS_TIEFEN) {
      return LS.preisNachTiefeneinkommen(LS.PREIS_TIEFEN.respec);
    }
    return 0;
  }

  function respec() {
    // ERSTATTUNG NACH PREIS, nicht nach Rang.
    //
    // Vorher zaehlte die Schleife nur die Raenge — ein Keystone (5 Fragmente)
    // und ein Buendel (4) haben aber Rang 1 und kamen mit je EINEM Fragment
    // zurueck. Gemessen: 50 investiert, 43 erstattet, sieben weg. Und die
    // Loeschschleife lief nur ueber CATALOG, sodass beide GESETZT blieben,
    // obwohl sie erstattet waren.
    var refund = 0;
    for (var nodeId in state.ranks) {
      if (!Object.prototype.hasOwnProperty.call(state.ranks, nodeId)) continue;
      var r = state.ranks[nodeId] | 0;
      if (r <= 0) continue;
      if (KEYSTONE_BY_ID[nodeId]) refund += KEYSTONE_KOSTEN;
      else if (NOTABLE_BY_ID[nodeId]) refund += NOTABLE_KOSTEN;
      else refund += r;
    }
    state.fragments = (state.fragments | 0) + refund;
    state.ranks = {};                       // alles loesen, nicht nur den Katalog
    for (var i = 0; i < CATALOG.length; i++) state.ranks[CATALOG[i].id] = 0;
    _applyRanksToBuffs();
    _persist();
    _callRecalc();
    _notify();
  }

  function _callRecalc() {
    // primitives.recalcDerived overrides for tests; otherwise read window at
    // invoke time (the function may be defined after this module loads).
    var fn = primitives.recalcDerived;
    if (typeof fn !== 'function' && typeof window !== 'undefined' && typeof window.recalcDerived === 'function') {
      fn = window.recalcDerived;
    }
    if (typeof fn === 'function') {
      try { fn(0, 0); }
      catch (e) {
        try { console.warn('[KnowledgeTree] recalcDerived threw', e); } catch (_) {}
      }
    }
  }

  // Called by startScene when the player clicks "Neues Spiel". Wipes the
  // persisted blob, resets in-memory state, neutralises buffs, and notifies
  // subscribers so any open UI re-renders empty.
  function resetForNewGame() {
    _clearPersisted();
    state = _freshState();
    state.initialized = true;
    state.i18nRegistered = true;
    _applyRanksToBuffs();
    _notify();
  }

  function _configureForTest(p) {
    primitives = _defaultPrimitives();
    if (p && typeof p === 'object') {
      if (p.storage) primitives.storage = p.storage;
      if (p.i18n)    primitives.i18n    = p.i18n;
      if (typeof p.recalcDerived === 'function') primitives.recalcDerived = p.recalcDerived;
    }
    state = _freshState();
    subscribers = [];
    _storageWarned = false;
    var persisted = _loadPersisted();
    if (persisted) _absorbPersisted(persisted);
    _applyRanksToBuffs();
  }

  // Auto-init on script load.
  init();

  window.KnowledgeTree = {
    init: init,
    getFragments: getFragments,
    getRank: getRank,
    getMaxRank: getMaxRank,
    getCatalog: getCatalog,
    getState: getState,
    addFragments: addFragments,
    invest: invest,
    // #116: Respec kostet Gold — gleich viel wie im Talentbaum.
    getRespecCost: getRespecCost,
    // #116: Notables — Buendel, hinter sechs Raengen im eigenen Zweig.
    getNotables: function () { return NOTABLES.slice(); },
    investNotable: investNotable,
    notableOffen: notableOffen,
    zweigRaenge: zweigRaenge,
    NOTABLE_KOSTEN: NOTABLE_KOSTEN,
    NOTABLE_BRAUCHT: NOTABLE_BRAUCHT,
    ZWEIG: ZWEIG,
    // #116: Keystones — hoechstens einer, Festpreis, gegenseitiger Ausschluss.
    getKeystones: function () { return KEYSTONES.slice(); },
    getActiveKeystone: getActiveKeystone,
    keystoneOffen: keystoneOffen,
    investKeystone: investKeystone,
    loeseKeystone: loeseKeystone,
    KEYSTONE_KOSTEN: KEYSTONE_KOSTEN,
    respec: respec,
    onChange: onChange,
    resetForNewGame: resetForNewGame,
    _configureForTest: _configureForTest,
    _STORAGE_KEY: STORAGE_KEY,
    _SCHEMA_VERSION: SCHEMA_VERSION
  };
})();
