if (window.i18n) {
  window.i18n.register('de', {
    'loot.legacy.weapon': 'Klingenschwert',
    'loot.legacy.head': 'Stahlhelm',
    'loot.legacy.body': 'Brustplatte',
    'loot.legacy.boots': 'Stiefel',
    'loot.legacy.material': 'Eisenbrocken',
    'loot.material.portal_scroll': 'Portalrolle',
    'loot.quest_item.QUEST_DOC': 'Protokoll-Abschrift',
    'loot.quest_item.QUEST_PLATE': 'Verbotene Druckplatte',
    'loot.quest_item.JOURNAL_FRAGMENT': 'Tagebuchfragment der Tochter',
    'loot.quest_item.COUNCIL_DOCUMENT': 'Versiegeltes Ratsdokument',
    'loot.quest_item.SEIZED_WRITINGS': 'Beschlagnahmte Schriften',
    'loot.quest_item.INTERROGATION_RECORD': 'Verhörprotokoll',
    // Feature 062: neue fetch-Ziele.
    'loot.quest_item.VERIFICATION_SEAL': 'Ratssiegel',
    'loot.quest_item.PROCLAMATION': 'Edikt-Plakat',
    'loot.quest_item.MEMORY_SHARD': 'Erinnerungssplitter'
  });
  window.i18n.register('en', {
    'loot.legacy.weapon': 'Sword',
    'loot.legacy.head': 'Steel Helm',
    'loot.legacy.body': 'Breastplate',
    'loot.legacy.boots': 'Boots',
    'loot.legacy.material': 'Iron Chunk',
    'loot.material.portal_scroll': 'Portal Scroll',
    'loot.quest_item.QUEST_DOC': 'Protocol Transcript',
    'loot.quest_item.QUEST_PLATE': 'Forbidden Print Plate',
    'loot.quest_item.JOURNAL_FRAGMENT': "Daughter's Journal Fragment",
    'loot.quest_item.COUNCIL_DOCUMENT': 'Sealed Council Document',
    'loot.quest_item.SEIZED_WRITINGS': 'Seized Writings',
    'loot.quest_item.INTERROGATION_RECORD': 'Interrogation Record',
    // Feature 062: neue fetch-Ziele.
    'loot.quest_item.VERIFICATION_SEAL': 'Council Seal',
    'loot.quest_item.PROCLAMATION': 'Edict Poster',
    'loot.quest_item.MEMORY_SHARD': 'Memory Shard'
  });
}
const _LOOT_T = (key) => (window.i18n ? window.i18n.t(key) : key);

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Tier color map — indexed by item.tier (0=Common .. 3=Legendary). Declared
// here and re-exported as window.TIER_COLORS so other production modules can
// share a single source of truth without re-declaring it.
const LOOT_TIER_COLORS = ['#cccccc', '#88aaff', '#ffdd44', '#ff8844'];

const ITEM_STAT_KEYS = ['hp', 'damage', 'speed', 'range', 'armor', 'crit'];
const ITEM_ALL_STAT_KEYS = [...ITEM_STAT_KEYS, 'move'];

const ITEM_SLOT_MODS = {
  weapon: { hp: 0.7, damage: 1.45, speed: 1.4, range: 1.35, armor: 0.7, crit: 1.6 },
  head:   { hp: 1.05, damage: 0.85, speed: 0.8, range: 0.75, armor: 1.2, crit: 1.0 },
  body:   { hp: 1.55, damage: 0.9, speed: 0.65, range: 0.8, armor: 1.45, crit: 0.85 },
  boots:  { hp: 0.95, damage: 0.95, speed: 1.5, range: 0.9, armor: 0.95, crit: 1.1 },
  generic:{ hp: 1, damage: 1, speed: 1, range: 1, armor: 1, crit: 1 }
};

// Issue #36 Phase 2: the legacy per-ability ATTACK_EFFECTS system was removed.
// Per-ability damage/cooldown now lives solely in AFFIX_DEFS (dmg_*/cd_*),
// consumed via player.js getLootAbilityDamageBonus / ...CooldownReduction.

function trackLootSprite(scene, sprite) {
  if (!scene || !sprite) return sprite;
  const list = scene._activeLootSprites = scene._activeLootSprites || [];
  list.push(sprite);
  const cleanup = () => {
    if (!Array.isArray(scene._activeLootSprites)) return;
    const idx = scene._activeLootSprites.indexOf(sprite);
    if (idx !== -1) {
      scene._activeLootSprites.splice(idx, 1);
    }
  };
  if (typeof sprite.once === 'function') {
    sprite.once('destroy', cleanup);
  }
  return sprite;
}

function getDifficultyMultiplierValue() {
  const fn = typeof window?.getDifficultyMultiplier === 'function'
    ? window.getDifficultyMultiplier
    : null;
  const raw = fn ? fn() : window?.DIFFICULTY_MULTIPLIER;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 1;
  return Phaser?.Math?.Clamp ? Phaser.Math.Clamp(raw, 0.1, 10) : Math.min(Math.max(raw, 0.1), 10);
}

// Legacy helper kept only so older save blobs (pre-migration) don't crash if
// any reader passes a string tier key. Always returns a numeric tier (0-3).
function getTierFromLegacyRarityKey(key) {
  const map = { common: 0, rare: 1, epic: 2, legendary: 3 };
  return (typeof key === 'string' && key in map) ? map[key] : null;
}

// Cap an item's non-zero stat count by its tier+1 so that a newly-rolled item
// doesn't silently outshine its intended tier budget. Keeps the strongest
// stats and zeros the rest.
// ENTFERNT: normalizeItemStatsForTier — die alte Deckelung auf "Seltenheitsstufe
// + 1 Werte".
//
// Sie war doppelt falsch. Erstens sortierte sie nach ROHEM Betrag und verglich
// dabei unvergleichbare Einheiten: Reichweite zaehlt in Pixeln (25), Tempo und
// Krit als Bruch (0.15 / 0.05) — die Reichweite gewann immer. Zweitens traf sie
// ueberhaupt die falsche Groesse: die Seltenheit steuert die ANZAHL DER AFFIXE
// (rollItem wuerfelt tier viele), und die liegen additiv obendrauf (siehe
// recalcDerived in inventory.js). Was die Basiswaffe kann, ist ihre Identitaet
// und darf nichts wegnehmen.
//
// Gemessen an einem magischen Schattendolch, bevor sie fiel:
//   {dmg 1.4, spd 0.15, rng -25, crit 0.05} -> {dmg 1.4, spd 0, rng -25, crit 0}
// und bei Gewoehnlich blieb von vier Werten nur die Reichweite uebrig.

// WP03: Spawn a goldPile sprite at (x, y) worth `amount` gold.
// Auto-collected by the player-overlap registered in main.js via window.goldGroup.
// Each pile despawns after 5 minutes to cap sprite count (see feature 020 assumption 7).
function _spawnGoldPile(scene, x, y, amount) {
  if (!scene || !scene.physics || !scene.add) return null;
  if (typeof scene.textures?.exists === 'function' && !scene.textures.exists('goldPile')) return null;
  const safeAmount = Math.max(1, Math.floor(Number(amount) || 1));
  // Perf (#70): nahe Gold-Piles ZUSAMMENFUEHREN statt fuer jeden Drop ein neues
  // Sprite zu spawnen. In grossen Raeumen mit vielen Kills waren das sonst
  // Dutzende Gold-Sprites — jedes ein eigener Draw-Call und ein Physik-Body.
  // Wert wird aufaddiert; das Auto-Sammeln (Overlap) nimmt die groessere Pile.
  if (window.goldGroup && typeof window.goldGroup.getChildren === 'function') {
    const _mergeR2 = 44 * 44;
    const _piles = window.goldGroup.getChildren();
    for (let i = 0; i < _piles.length; i++) {
      const gp = _piles[i];
      if (!gp || !gp.active) continue;
      const dx = gp.x - x, dy = gp.y - y;
      if (dx * dx + dy * dy <= _mergeR2) {
        gp.setData('goldAmount', (gp.getData('goldAmount') || 0) + safeAmount);
        return gp;
      }
    }
  }
  const sprite = scene.physics.add.sprite(x, y, 'goldPile');
  if (!sprite) return null;
  sprite.setData('goldAmount', safeAmount);
  sprite.setDepth(80);
  if (window.goldGroup && typeof window.goldGroup.add === 'function') {
    window.goldGroup.add(sprite);
  }
  trackLootSprite(scene, sprite);
  if (scene.time && typeof scene.time.delayedCall === 'function') {
    scene.time.delayedCall(300000, () => {
      if (sprite && sprite.active) sprite.destroy();
    });
  }
  return sprite;
}

// WP03: Roll how much gold an enemy drops. Boss: mLevel * 50 (flat, reliable).
// Regular: 30% chance to drop, 1..(mLevel*5) with ±20% jitter.
function _rollEnemyGoldDrop(mLevel, isBoss) {
  const level = Math.max(1, Math.floor(Number(mLevel) || 1));
  if (isBoss) {
    const base = level * 50;
    return Math.max(1, Math.floor(base * (0.8 + Math.random() * 0.4)));
  }
  if (Math.random() >= 0.30) return 0;
  const raw = 1 + Math.floor(Math.random() * (level * 5));
  return Math.max(1, Math.floor(raw * (0.8 + Math.random() * 0.4)));
}

function _dropEnemyGold(scene, enemy) {
  if (!scene || !enemy) return;
  const level = enemy.iLevel || enemy.mLevel || (typeof currentWave !== 'undefined' ? currentWave : 1) || 1;
  const isBoss = !!(enemy.isBoss || enemy.isMiniBoss);
  let amount = _rollEnemyGoldDrop(level, isBoss);
  if (amount <= 0) return;
  // Printing-House edict: gold drop multiplier (open_rebellion).
  const _ph = (typeof window !== 'undefined') ? window.printingBuffs : null;
  if (_ph && typeof _ph.goldMult === 'number' && _ph.goldMult > 0 && _ph.goldMult !== 1) {
    amount = Math.max(1, Math.round(amount * _ph.goldMult));
  }
  // Scatter gold around the enemy so it doesn't perfectly stack on the
  // XP/health pickup that lootGroup spawns at the same tile.
  const angle = Math.random() * Math.PI * 2;
  const dist = 18 + Math.random() * 22; // 18..40 px from enemy
  const gx = enemy.x + Math.cos(angle) * dist;
  const gy = enemy.y + Math.sin(angle) * dist;
  _spawnGoldPile(scene, gx, gy, amount);
}

// Aufsammel-Sperre fuer Ausruestung: Waffen und Ruestungsteile lassen sich
// erst nach einer kurzen Frist aufheben. Ohne sie verschwindet ein Fund, der
// dem Spieler direkt vor die Fuesse faellt, im selben Bild im Inventar —
// gesehen hat er ihn dann nie.
//
// Traenke, Material, Gold und Questgegenstaende sind bewusst AUSGENOMMEN:
// die sammelt man im Vorbeilaufen ein, dort waere eine Sperre nur laestig.
const AUFSAMMEL_SPERRE_MS = 900;
const AUFSAMMEL_GESPERRT = { weapon: 1, head: 1, body: 1, boots: 1 };

function spawnLoot(x, y, maybeItem, sourceEnemy) {
  const scene = (this && this.physics && this.physics.world) ? this : (obstacles?.scene || window.currentScene);
  // WP03: enemies always roll a gold drop in addition to their item drop.
  // Chest-type maybeItem calls go through the early-return path below and
  // should NOT trigger enemy gold (no sourceEnemy).
  if (sourceEnemy && scene) {
    _dropEnemyGold(scene, sourceEnemy);
  }
  if (maybeItem && typeof maybeItem.type === 'string') {
    const typeLower = maybeItem.type.toLowerCase();
    if (typeLower.startsWith('chest')) {
      const spawnFn = scene?.spawnObstacle ? scene.spawnObstacle.bind(scene) : spawnObstacle;
      const chest = spawnFn ? spawnFn(x, y, maybeItem.type) : spawnObstacle(x, y, maybeItem.type);
      chest?.setData('locked', !!maybeItem.locked);
      if (typeof maybeItem.tier !== 'undefined') chest?.setData('tier', maybeItem.tier);
      return chest;
    }
  }

  // Feature 059 (#42) WP04: run-amulet pickup. Bypass the droproll path
  // entirely — amulets carry no stats, only an `effect` key that the stat
  // shaping would strip. Spawn the sprite directly and give it the legendary
  // beacon so it reads as special.
  if (maybeItem && maybeItem.isAmulet) {
    const aScene = scene || (typeof lootGroup !== 'undefined' && lootGroup && lootGroup.scene) || window.currentScene;
    const aloot = lootGroup.create(x, y, maybeItem.iconKey || 'itAmulet');
    aloot.setDisplaySize(28, 28);
    aloot.setData('item', maybeItem);
    aloot.setDepth(80);
    trackLootSprite(aScene || aloot.scene, aloot);
    try { _attachRarityFx(aScene || aloot.scene, aloot, { tier: 3 }); } catch (e) { /* fx optional */ }
    return aloot;
  }

  // Quest item drops (10% chance each)
  if (!maybeItem && window.questSystem) {
    var activeQuests = window.questSystem.getActiveQuests();

    // Check for active fetch quests and spawn matching quest items.
    // Feature 050: journal_fragment (Q1 harren_daughter_investigation)
    // drops via the standard 10% per-kill chance while its quest is active.
    // council_document (Q5 widerstand_proof, der Ritualkammer-Beweis) droppt
    // JETZT ZUSAETZLICH aus Kills (erhoehte 20%-Chance) — vorher nur eine
    // einzelne deterministische Platzierung (roomManager._maybeFireElara-
    // CellarEncounter), die Spieler oft lange suchen liess. Die Platzierung
    // bleibt als Garantie bestehen; sobald das Item da ist, faellt die Quest
    // auf den Turn-in und weitere Drops stoppen (needsItem = false).
    var questItemDefs = [
      { target: 'document',         name: _LOOT_T('loot.quest_item.QUEST_DOC'),       nameKey: 'loot.quest_item.QUEST_DOC',       key: 'QUEST_DOC',       tint: 0xffdd44 },
      { target: 'print_plate',      name: _LOOT_T('loot.quest_item.QUEST_PLATE'),     nameKey: 'loot.quest_item.QUEST_PLATE',     key: 'QUEST_PLATE',     tint: 0x88aaff },
      { target: 'journal_fragment', name: _LOOT_T('loot.quest_item.JOURNAL_FRAGMENT'),nameKey: 'loot.quest_item.JOURNAL_FRAGMENT',key: 'JOURNAL_FRAGMENT',tint: 0xddccaa },
      // Feature 055 Akt 2: fetch-Targets für Q1 (Beschlagnahme) + Q4 (Abschriften)
      { target: 'seized_writings',  name: _LOOT_T('loot.quest_item.SEIZED_WRITINGS'),       nameKey: 'loot.quest_item.SEIZED_WRITINGS',       key: 'SEIZED_WRITINGS',       tint: 0xe8d8a0 },
      { target: 'interrogation_record', name: _LOOT_T('loot.quest_item.INTERROGATION_RECORD'), nameKey: 'loot.quest_item.INTERROGATION_RECORD', key: 'INTERROGATION_RECORD', tint: 0xc09060 },
      // Feature 062: neue fetch-Ziele. verification_seal (magistrat_verification),
      // proclamation (faction_campaign x3), memory_shard (who_you_were x3, minDepth 5).
      // Der needsItem-Check unten gated bereits auf aktive, unerfüllte Quest —
      // kein Drop ohne passende Quest (regressionssicher).
      { target: 'verification_seal', name: _LOOT_T('loot.quest_item.VERIFICATION_SEAL'), nameKey: 'loot.quest_item.VERIFICATION_SEAL', key: 'VERIFICATION_SEAL', tint: 0xb0b0c0 },
      { target: 'proclamation',      name: _LOOT_T('loot.quest_item.PROCLAMATION'),      nameKey: 'loot.quest_item.PROCLAMATION',      key: 'PROCLAMATION',      tint: 0xd8c070 },
      { target: 'memory_shard',      name: _LOOT_T('loot.quest_item.MEMORY_SHARD'),      nameKey: 'loot.quest_item.MEMORY_SHARD',      key: 'MEMORY_SHARD',      tint: 0x88ccff },
      // Ritualkammer-Beweis (Q5 widerstand_proof). Erhoehte Chance, damit der
      // Spieler ihn nicht ewig sucht; deterministische Platzierung bleibt zusaetzlich.
      { target: 'council_document',  name: _LOOT_T('loot.quest_item.COUNCIL_DOCUMENT'),  nameKey: 'loot.quest_item.COUNCIL_DOCUMENT',  key: 'COUNCIL_DOCUMENT',  tint: 0xcc88dd, chance: 0.20 }
    ];

    for (var qi = 0; qi < questItemDefs.length; qi++) {
      var qiDef = questItemDefs[qi];
      var needsItem = activeQuests.some(function (q) {
        return q.objectives.some(function (o) {
          return o.type === 'fetch' && o.target === qiDef.target && o.current < o.required;
        });
      });
      if (needsItem && Math.random() < (qiDef.chance || 0.10)) {
        var questItem = {
          type: 'quest_item',
          key: qiDef.key,
          name: qiDef.name,
          nameKey: qiDef.nameKey,
          iconKey: 'itMat',
          isQuestItem: true,
          questTarget: qiDef.target
        };
        // Refs #22: ensure quest items spawn on walkable tiles. If the
        // enemy died inside/atop a non-walkable tile, nudge the spawn to
        // an accessible point so the fetch quest stays completable.
        if (scene && typeof scene.isPointAccessible === 'function' && !scene.isPointAccessible(x, y)) {
          if (typeof scene.pickAccessibleSpawnPoint === 'function') {
            var safeSpot = scene.pickAccessibleSpawnPoint({ maxAttempts: 5 });
            if (safeSpot) { x = safeSpot.x; y = safeSpot.y; }
          }
        }
        var questLoot = lootGroup.create(x, y, questItem.iconKey || 'itMat');
        questLoot.setDisplaySize(28, 22);
        questLoot.setData('item', questItem);
        questLoot.setData('questItem', true);
        questLoot.setDepth(80);
        questLoot.setTint(qiDef.tint);
        trackLootSprite(scene || questLoot.scene, questLoot);
        return;
      }
    }
  }

  // Elite enemies have higher loot chance and better tier
  // D2-like drop frequencies: trash rarely drops, elites modestly, minibosses
  // often, echte Bosse am häufigsten. Item-Drop-Chancen (Prozent): Trash 0.5%,
  // Elite 2%, Miniboss 6%, Boss 10%. Die vier Zahlen sind die Tunables.
  const isEliteDrop = sourceEnemy && sourceEnemy.isElite;
  const isMiniBossDrop = sourceEnemy && sourceEnemy.isMiniBoss;
  const isBossDrop = sourceEnemy && sourceEnemy.isBoss;
  const dropThresholdBase = isBossDrop ? 10 : (isMiniBossDrop ? 6 : (isEliteDrop ? 2 : 0.5));

  // Diminishing Returns: sind in diesem Run schon >3 ECHTE Items gedroppt
  // (Tränke/Rollen NICHT mitgezählt), wird die zufällige Item-Chance HALBIERT.
  //
  // Bosse sind davon AUSGENOMMEN. Die Daempfung soll den Trash-Regen bremsen,
  // nicht die Belohnung fuer den schwersten Kampf des Durchgangs — und ein Boss
  // am Ende eines langen Laufs stand damit bei 5 % statt 10 %.
  let dropThreshold = dropThresholdBase;
  if (!isBossDrop && (window.__runItemsDropped || 0) > 3) dropThreshold = dropThreshold / 2;

  // GARANTIERTER ABWURF FUER BOSSE (#130).
  //
  // Gemessen ueber 200 Kills auf Tiefe 10: ein Boss liess in 10,5 % der Faelle
  // Ausruestung fallen — neun von zehn Bosskaempfen endeten ohne ein einziges
  // Stueck. Fuer den Spieler sah das aus wie ein Fehler, und es war der
  // Hoehepunkt einer Tiefe. Ein Boss erscheint ohnehin nur alle zehn Tiefen
  // (roomManager.js: depth % 10 === 0), das hier ist also kein Beutestrom,
  // sondern eine Handvoll garantierter Stuecke ueber einen ganzen Durchgang.
  //
  // Die Qualitaet bleibt gewuerfelt (MINIBOSS_QUALITY_BIAS unten): garantiert
  // ist DASS etwas faellt, nicht WAS.
  //
  // Der Pluenderer aus dem Hinterhalt ebenso: er TRAEGT die Beute des
  // Ereignisses — das ist seine ganze Rolle. Ihn zu erlegen und nichts zu
  // bekommen macht die Jagd sinnlos.
  const garantiert = !!isBossDrop || !!(sourceEnemy && sourceEnemy._istPluenderer);

  // Float-Roll (0..100), damit halbierte Bruch-Schwellen (z.B. 0.5) exakt greifen.
  const roll = Math.random() * 100;

  if (maybeItem || garantiert || roll < dropThreshold) {
    // KEIN Tier-Bump mehr. Elites droppen normale Qualität (nur höhere Drop-Rate).
    // Minibosse UND echte Bosse rollen mit einem Qualitäts-BIAS -> erhöhte
    // CHANCE auf Magic/Rare/Legendär (kein garantierter +Tier-Sprung). Vorher
    // war hier nur isMiniBoss geprüft — ein Boss-Kill droppte Equipment in
    // Trash-Qualität, obwohl seine Drop-CHANCE schon bevorzugt war.
    const MINIBOSS_QUALITY_BIAS = 3;
    const baseItem = maybeItem
      ? { ...maybeItem }
      : randomLoot((isMiniBossDrop || isBossDrop) ? MINIBOSS_QUALITY_BIAS : 1);
    let tier = (typeof baseItem?.tier === 'number') ? baseItem.tier : 0;
    let item;
    if (maybeItem) {
      // ITEM_BASES-Items (alles aus LootSystem.rollItem) tragen ein ABSICHTLICHES
      // Mehrwert-Budget: der Schattendolch IST sein Angriffstempo, die Glutaxt
      // ihr Minus darauf. Die alte Tier-Deckelung behielt nur die betragsmaessig
      // groessten Werte — und weil Reichweite in PIXELN zaehlt (25) und Tempo/Krit
      // als Bruch (0.15 / 0.05), gewann die Reichweite immer. Gemessen an einem
      // magischen Schattendolch: Tempo +15 % und Krit +5 % wurden auf 0 gesetzt,
      // bei Gewoehnlich sogar der SCHADEN. Genau diese Wege (Truhen, Belohnungen,
      // Elite-Garantien, Ereignisse) sollten die BESSEREN sein.
      //
      // Darum derselbe Weg wie beim normalen Gegner-Drop: Schwierigkeit ohne
      // Deckelung. Die Deckelung ist inzwischen ganz weg (siehe unten): die
      // Seltenheit steuert die ANZAHL DER AFFIXE, nicht die Anzahl der
      // Basiswerte. Was die Waffe kann, gehoert der Waffe.
      const _hatBasiswerte = !!(baseItem && baseItem.baseStats
        && Object.keys(baseItem.baseStats).length);
      if (_hatBasiswerte) {
        // baseStats mitkopieren: _applyDifficultyToRolledItem schreibt hinein,
        // und { ...maybeItem } teilt das Unterobjekt sonst mit dem Aufrufer.
        baseItem.baseStats = { ...baseItem.baseStats };
        item = _applyDifficultyToRolledItem(baseItem, Math.max(1, currentWave));
      } else {
        // Von Hand gebaute Alt-Items (Elaras Klinge, Ritualamulett): kein
        // baseStats, auch kein tier — sie liefen deshalb als Tier 0 durch die
        // Deckelung und haetten von vier Werten EINEN behalten. Auch sie sind
        // reine Basiswerte, also nur noch Schwierigkeitsskalierung.
        item = scaleItemForDifficulty(baseItem, Math.max(1, currentWave));
      }
    } else {
      // Unified rollItem drop (#36 Phase 2b): rollItem rollt Affixe passend zum
      // Tier, daher greift die Re-Roll-Absicherung normalerweise nicht mehr (kein
      // Tier-Bump). Die Seltenheit steuert hier ausschliesslich die ANZAHL DER
      // AFFIXE — die Basiswerte des Stuecks bleiben unangetastet.
      item = baseItem;
      const affixCount = Array.isArray(item.affixes) ? item.affixes.length : 0;
      if (item.tier > affixCount && item.type
          && window.LootSystem && typeof window.LootSystem.rollAffixes === 'function') {
        try {
          item.affixes = window.LootSystem.rollAffixes(
            item.iLevel || Math.max(1, currentWave), item.tier, Math.random, item.type) || item.affixes;
          if (typeof window.LootSystem.composeName === 'function') {
            item.displayName = window.LootSystem.composeName(item);
          }
        } catch (e) { /* keep original affixes on failure */ }
      }
    }
    const loot = lootGroup.create(x, y, item.iconKey || 'itMat');
    loot.setDisplaySize(32, 24);
    loot.setData('item', item);
    // Zeitbasis gameNow, nicht scene.time.now: eine Pause soll die Frist
    // nicht verbrauchen (dieselbe Basis wie die Faehigkeiten-Abklingzeiten).
    if (item && AUFSAMMEL_GESPERRT[item.type]) {
      const jetzt = (typeof window.gameNow === "function")
        ? window.gameNow(scene || loot.scene) : Date.now();
      loot.setData('aufsammelbarAb', jetzt + AUFSAMMEL_SPERRE_MS);
    }
    loot.setDepth(80);
    trackLootSprite(scene || loot.scene, loot);
    _attachRarityFx(scene || loot.scene, loot, item);
    // Run-Zähler: nur ECHTE Ausrüstung zählen (Tränke/Rollen/Truhen ausgenommen)
    // -> steuert die Halbierung oben ab dem 11. Item.
    const _gearTypes = { weapon: 1, head: 1, body: 1, boots: 1, amulet: 1 };
    if (item && _gearTypes[item.type]) {
      window.__runItemsDropped = (window.__runItemsDropped || 0) + 1;
    }
  } else if (roll < 50) {
    spawnPickup.call(this, x, y, 'health');
  } else if (roll < 80) {
    spawnPickup.call(this, x, y, 'xp');
  }
}

// Besondere Funde leuchten am Boden in ihrer Seltenheitsfarbe (D2-Stil).
// Tier 1 = magisch (blau), Tier 2 = selten (gold), Tier 3 = legendaer (orange).
//
// #123: Blau fehlte — Gold und Orange leuchteten, ein magischer Fund lag
// unscheinbar da wie ein gewoehnlicher. Es bekommt aber bewusst das LEISESTE
// Leuchten und KEINEN Jingle: magische Funde sind haeufig, und ein voller
// Leuchtturm samt Ton bei jedem waere Laerm statt Signal. Die Abstufung
// blau < gold < orange traegt die Information, nicht das blosse Vorhandensein.
function _attachRarityFx(scene, loot, item) {
  const tier = item && typeof item.tier === 'number' ? item.tier : 0;
  if (tier < 1 || !scene || !loot) return;

  const tierHex = [0xcccccc, 0x88aaff, 0xffdd44, 0xff8844][tier] || 0xffffff;
  const sfxKey = tier >= 3 ? 'loot_legendary' : (tier >= 2 ? 'loot_rare' : null);
  if (sfxKey && window.soundManager && typeof window.soundManager.playSFX === 'function') {
    try { window.soundManager.playSFX(sfxKey); } catch (e) { /* ignore */ }
  }

  // Glow beacon under the loot sprite — je seltener, desto groesser und heller
  const radius = tier >= 3 ? 34 : (tier >= 2 ? 26 : 20);
  const glow = scene.add.circle(loot.x, loot.y, radius, tierHex, tier >= 2 ? 0.35 : 0.22);
  glow.setDepth(79); // under the item sprite (80)
  glow.setBlendMode(Phaser.BlendModes.ADD);

  // Pulse tween
  const pulseTween = scene.tweens.add({
    targets: glow,
    scale: { from: 0.8, to: tier >= 2 ? 1.25 : 1.12 },
    alpha: tier >= 2 ? { from: 0.25, to: 0.55 } : { from: 0.16, to: 0.34 },
    duration: tier >= 3 ? 650 : (tier >= 2 ? 900 : 1200),
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  // Legendary: thin outer ring that rotates slowly
  let ring = null;
  let ringTween = null;
  if (tier >= 3) {
    ring = scene.add.circle(loot.x, loot.y, radius + 10, 0xffffff, 0);
    ring.setStrokeStyle(2, tierHex, 0.7);
    ring.setDepth(79);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ringTween = scene.tweens.add({
      targets: ring,
      angle: 360,
      duration: 3000,
      repeat: -1
    });
  }

  // Keep beacon glued to the loot sprite each frame (bodies may drift on spawn).
  const updateBeacon = () => {
    if (!loot.active) return;
    if (glow.scene) glow.setPosition(loot.x, loot.y);
    if (ring && ring.scene) ring.setPosition(loot.x, loot.y);
  };
  scene.events.on('update', updateBeacon);

  // Idempotent cleanup captured in a closure so we don't depend on the loot's
  // DataManager state (which can become unreliable mid-destroy). This fixes
  // a class of bug where the glow Circle outlived its loot sprite — visible
  // after pickup or after room change.
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try { scene.events.off('update', updateBeacon); } catch (_) {}
    try { scene.events.off('shutdown', cleanup); } catch (_) {}
    try { if (pulseTween && pulseTween.remove) pulseTween.remove(); } catch (_) {}
    try { if (ringTween  && ringTween.remove)  ringTween.remove();  } catch (_) {}
    try { if (glow && glow.scene) glow.destroy(); } catch (_) {}
    try { if (ring && ring.scene) ring.destroy(); } catch (_) {}
  };

  // Three independent triggers — whichever fires first wins; the rest no-op
  // thanks to the `cleaned` flag:
  //   1) collectLoot calls _cleanupRarityFx(loot) at the top of pickup
  //   2) loot's 'destroy' event (after collectLoot, or from lootGroup.clear)
  //   3) scene 'shutdown' (full scene teardown, e.g. exiting the dungeon)
  loot.setData('rarityCleanup', cleanup);
  loot.once('destroy', cleanup);
  scene.events.once('shutdown', cleanup);
}

function spawnPickup(x, y, type) {
  const key = type === 'health' ? 'healthDrop' : 'xpDrop';
  const scene = (this && this.physics && this.physics.world) ? this : (obstacles?.scene || window.currentScene);
  const targetScene = scene || this;
  if (!targetScene?.physics) return null;
  const loot = targetScene.physics.add.sprite(x, y, key);
  loot.lootType = type;
  loot.setDepth(80);
  targetScene.physics.add.overlap(player, loot, collectLoot, null, targetScene);
  trackLootSprite(targetScene || loot.scene, loot);
}

function _cleanupRarityFx(loot) {
  if (!loot || typeof loot.getData !== 'function') return;
  const cleanup = loot.getData('rarityCleanup');
  if (typeof cleanup === 'function') cleanup();
}

function collectLoot(playerSprite, loot) {
  // Die Ueberlappung feuert JEDES Bild, solange der Spieler darauf steht —
  // ein frueher Ausstieg genuegt also, es braucht keinen eigenen Zeitgeber.
  if (loot && typeof loot.getData === "function") {
    const frei = loot.getData('aufsammelbarAb');
    if (typeof frei === "number") {
      const jetzt = (typeof window.gameNow === "function")
        ? window.gameNow(loot.scene || this) : Date.now();
      if (jetzt < frei) return;
    }
  }
  _cleanupRarityFx(loot);
  if (window.soundManager) window.soundManager.playSFX('loot_pickup');
  // Particle effects: loot sparkle
  if (window.particleFactory && loot) {
    window.particleFactory.lootSparkle(loot.x, loot.y);
  }

  // Quest item handling
  if (loot.getData && loot.getData('questItem')) {
    var item = loot.getData('item');
    if (item && item.questTarget && window.questSystem) {
      window.questSystem.updateQuestProgress('fetch', item.questTarget, 1);
      console.log('[Loot] Collected quest item:', item.name);
    }
    loot.destroy();
    return;
  }

  if (loot.lootType === 'health') {
    // Heilwert wird beim EINSAMMELN aus der Tiefe berechnet (nicht beim Spawn) —
    // die Tiefe ist innerhalb eines Runs konstant, beides wäre also gleich.
    const heal = (window.LootSystem && typeof window.LootSystem.getHeartHeal === 'function')
      ? window.LootSystem.getHeartHeal(currentWave)
      : 2;
    if (typeof addPlayerHealth === 'function') {
      addPlayerHealth(heal);
    } else {
      playerHealth = Math.min(playerHealth + heal, playerMaxHealth);
      if (typeof updateHUD === 'function') updateHUD();
    }
  } else if (loot.lootType === 'xp') {
    addXP.call(this);
  } else {
    const item = loot.getData('item');
    const isMaterial = item?.type === 'material'
      && typeof addMaterialToStorage === 'function'
      && addMaterialToStorage(item, item?.amount || 1);
    // Stack potions of the same tier into an existing inventory slot
    // before falling through to the fresh-slot/full-inventory path.
    const isStackedPotion = item?.type === 'potion' && (() => {
      const existing = inventory.findIndex((slot) =>
        slot && slot.type === 'potion' && slot.potionTier === item.potionTier
      );
      if (existing >= 0) {
        inventory[existing].stack = (inventory[existing].stack || 1) + (item.stack || 1);
        return true;
      }
      return false;
    })();
    if (!isMaterial && !isStackedPotion) {
      // #123 B: Platz wird im RASTER gesucht, nicht im naechsten freien
      // Feld — ein Richtschwert (2x4) braucht eine ganze Saeule, ein Trank
      // (1x1) passt in jede Luecke. Findet sich keiner, greift derselbe
      // Einschmelz-Zweig wie frueher bei vollem Inventar.
      const idx = (window.InventoryGrid && typeof window.InventoryGrid.einfuegen === "function")
        ? window.InventoryGrid.einfuegen(inventory, item)
        : inventory.findIndex((slot) => !slot);
      if (idx >= 0) {
        // einfuegen() hat den Gegenstand schon abgelegt; der Rueckfall oben
        // liefert nur den Index und braucht die Zuweisung noch.
        if (inventory[idx] !== item) inventory[idx] = item;
      } else {
        // Inventory full → salvage to Eisenbrocken based on tier
        const tier = (typeof item?.tier === 'number') ? item.tier : 0;
        const matAmount = (tier + 1) * 2; // T0=2, T1=4, T2=6, T3=8
        if (typeof changeMaterialCount === 'function') {
          changeMaterialCount('MAT', matAmount);
        } else if (typeof materialCounts !== 'undefined') {
          materialCounts.MAT = (materialCounts.MAT || 0) + matAmount;
        }
        // Visual feedback
        if (this.add && item) {
          const txt = this.add.text(loot.x, loot.y - 20,
            '+' + matAmount + ' Eisenbrocken', {
              fontSize: '14px',
              fontFamily: 'monospace',
              color: '#ccaa33',
              stroke: '#000',
              strokeThickness: 3
            }).setOrigin(0.5).setDepth(1500);
          this.tweens.add({
            targets: txt,
            y: txt.y - 30,
            alpha: 0,
            duration: 1500,
            onComplete: () => txt.destroy()
          });
        }
      }
    }
    if (typeof refreshInventoryUI === 'function') refreshInventoryUI();
  }
  loot.destroy();
}

function clampStat(key, value) {
  switch (key) {
    case 'hp':
      return clamp(Math.round(value), 1, 999);
    case 'damage':
      return clamp(Math.round(value), 1, 999);
    case 'speed':
      return clamp(Number(value.toFixed?.(2) ?? Number(value).toFixed(2)), 0.05, 3.5);
    case 'range':
      return clamp(Math.round(value), 5, 260);
    case 'armor':
      return clamp(Number(value.toFixed?.(3) ?? Number(value).toFixed(3)), 0, 0.8);
    case 'crit':
      return clamp(Number(value.toFixed?.(3) ?? Number(value).toFixed(3)), 0.01, 0.85);
    default:
      return value;
  }
}

function rollItemStatPotentials(slot, depth) {
  const waveLevel = Math.max(1, depth || 1);
  const mods = ITEM_SLOT_MODS[slot] || ITEM_SLOT_MODS.generic;
  const jitter = (base) => base * Phaser.Math.FloatBetween(0.9, 1.1);

  const baseHp = 4 + (waveLevel - 1) * 1.25;
  const baseDamage = 1 + Math.floor((waveLevel - 1) * 0.55);
  const baseSpeedBonus = 0.18 + Math.min(0.85, (waveLevel - 1) * 0.045);
  const baseRangeBonus = 18 + (waveLevel - 1) * 3.2;
  const baseArmor = 0.03 + Math.min(0.4, (waveLevel - 1) * 0.012);
  const baseCrit = 0.05 + Math.min(0.4, (waveLevel - 1) * 0.007);

  return {
    hp: clamp(Math.round(jitter(baseHp * mods.hp)), 1, 999),
    damage: clamp(Math.round(jitter(baseDamage * mods.damage)), 1, 999),
    speed: clamp(Number(jitter(baseSpeedBonus * mods.speed).toFixed(2)), 0.05, 3.5),
    range: clamp(Math.round(jitter(baseRangeBonus * mods.range)), 5, 260),
    armor: clamp(Number(jitter(baseArmor * mods.armor).toFixed(3)), 0, 0.8),
    crit: clamp(Number(jitter(baseCrit * mods.crit).toFixed(3)), 0.01, 0.85)
  };
}

function computeItemLevelFromStats(stats, depth) {
  const lvlBase = Math.max(1, depth || 1);
  let lvl = lvlBase;
  const add = (value, weight) => {
    lvl += (Number(value) || 0) * weight;
  };
  add(stats.damage, 1);
  add(stats.hp, 0.2);
  add(stats.speed, 6);
  add(stats.range, 0.04);
  add(stats.armor, 50);
  add(stats.crit, 20);
  return Math.max(1, Math.round(lvl));
}

function scaleItemForDifficulty(item, depth) {
  if (!item) return item;
  const multiplier = getDifficultyMultiplierValue();
  if (multiplier === 1) return item;

  ITEM_STAT_KEYS.forEach((key) => {
    if (typeof item[key] === 'number') {
      const scaled = item[key] * multiplier;
      item[key] = clampStat(key, scaled);
    }
  });

  if (typeof item.move === 'number') {
    const scaledMove = item.move * multiplier;
    item.move = Number((Math.round(scaledMove * 100) / 100).toFixed(2));
  }

  item.itemLevel = computeItemLevelFromStats(
    item,
    Math.max(1, Math.round((depth || currentWave || 1) * multiplier))
  );

  return item;
}

function addBoostsToItem(item, boosts, depth) {
  const totalBoosts = Math.max(0, boosts);
  if (!totalBoosts) return;
  const potentials = rollItemStatPotentials(item?.type || 'weapon', depth);
  const available = ITEM_STAT_KEYS.filter(key => (potentials[key] ?? 0) > 0);
  const keysPool = available.length ? available : ITEM_STAT_KEYS;
  for (let i = 0; i < totalBoosts; i++) {
    const statKey = Phaser.Utils.Array.GetRandom(keysPool);
    const addition = potentials[statKey] ?? 0;
    const current = Number(item[statKey] || 0);
    item[statKey] = clampStat(statKey, current + addition);
  }
  item.itemLevel = computeItemLevelFromStats(item, depth);
}

function randomLoot(qualityBias) {
  const depth = Math.max(1, currentWave);
  const roll = Phaser.Math.Between(1, 100);

  // Equipment (77%) — Issue #36 Phase 2b: single unified pipeline via
  // LootSystem.rollItem (ITEM_BASES base + affixes). ITEM_BASES dropWeight
  // already encodes the type+depth distribution, so the old hand-rolled
  // weapon/head/body/boots split (and the separate bow special-case) is gone.
  // Base-stat + per-ability affixes ride along automatically.
  if (roll <= 77) {
    if (window.LootSystem && typeof window.LootSystem.rollItem === 'function') {
      try {
        // qualityBias (>1) hebt die Magic/Rare/Legendär-Chancen an — genutzt für
        // Miniboss-Drops (erhöhte Qualitäts-CHANCE statt festem Tier-Bump).
        const it = window.LootSystem.rollItem(null, depth, undefined, qualityBias);
        if (it) return _applyDifficultyToRolledItem(it, depth);
      } catch (e) { /* fall through to fallback */ }
    }
    return _legacyEquipmentFallback(depth);
  }
  if (roll <= 89) return _makePotionDrop(depth);   // Potions, depth-scaled tier
  if (roll <= 92) return _makePortalScrollDrop();  // Portal scroll material

  // Crafting material (Eisenbrocken).
  return makeItem({
    type: 'material',
    key: 'MAT',
    materialKey: 'MAT',
    name: _LOOT_T('loot.legacy.material'),
    nameKey: 'loot.legacy.material',
    iconKey: 'itMat',
    tier: 0,
    affixes: [],
    iLevel: depth,
    itemLevel: depth,
    baseStats: {},
    hp: 0, damage: 0, speed: 0, range: 0, armor: 0, crit: 0
  });
}

// Apply the difficulty multiplier to a freshly-rolled ITEM_BASES item. The
// multiplier is positive (0.6/1.0/1.5) so it preserves the sign of penalty
// stats (e.g. a heavy weapon's negative attack-speed). At Normal (1.0) this is
// a no-op.
function _applyDifficultyToRolledItem(item, depth) {
  if (!item) return item;
  const mult = getDifficultyMultiplierValue();
  if (mult === 1) return item;
  const keys = ['hp', 'damage', 'speed', 'range', 'armor', 'crit', 'move'];
  keys.forEach((k) => {
    if (typeof item[k] === 'number' && item[k] !== 0) item[k] = item[k] * mult;
    if (item.baseStats && typeof item.baseStats[k] === 'number' && item.baseStats[k] !== 0) {
      item.baseStats[k] = item.baseStats[k] * mult;
    }
  });
  if (typeof computeItemLevelFromStats === 'function') {
    item.itemLevel = computeItemLevelFromStats(item, Math.max(1, Math.round(depth * mult)));
  }
  return item;
}

// Defensive fallback used only if LootSystem.rollItem is somehow unavailable
// (load-order failure). lootSystem.js loads before loot.js in practice, so this
// should never run; it just guarantees the drop pipeline never yields null.
function _legacyEquipmentFallback(depth) {
  return makeItem({
    type: 'weapon', key: 'WPN', name: _LOOT_T('loot.legacy.weapon'),
    nameKey: 'loot.legacy.weapon', iconKey: 'itWeapon',
    tier: 0, affixes: [], iLevel: depth, itemLevel: depth,
    baseStats: { damage: 6 }, damage: 6
  });
}

// Build a portal scroll material item — incremented onto materialCounts.PORTAL_SCROLL on pickup.
function _makePortalScrollDrop() {
  return {
    type: 'material',
    key: 'PORTAL_SCROLL',
    materialKey: 'PORTAL_SCROLL',
    name: _LOOT_T('loot.material.portal_scroll'),
    nameKey: 'loot.material.portal_scroll',
    iconKey: 'itPortalScroll',
    amount: 1,
    tier: 0,
    affixes: [],
    iLevel: 1,
    itemLevel: 1,
    baseStats: {},
    hp: 0, damage: 0, speed: 0, range: 0, armor: 0, crit: 0
  };
}

// Build a healing potion item with tier scaled to dungeon depth.
function _makePotionDrop(depth) {
  let tier;
  if (depth < 4) tier = 1;
  else if (depth < 8) tier = Math.random() < 0.6 ? 1 : 2;
  else if (depth < 13) tier = Math.random() < 0.6 ? 2 : 3;
  else tier = Math.random() < 0.5 ? 3 : (Math.random() < 0.6 ? 2 : 4);

  const def = (window.LootSystem && Array.isArray(window.LootSystem.POTION_DEFS))
    ? window.LootSystem.POTION_DEFS.find((p) => p.potionTier === tier)
    : null;
  return {
    type: 'potion',
    potionTier: tier,
    name: def ? def.name : 'Heiltrank',
    nameKey: 'loot.potion.t' + tier,
    iconKey: def ? def.iconKey : 'itPotionMinor',
    stack: 1
  };
}

if (typeof window !== 'undefined') {
  window.spawnLoot = spawnLoot;
  window.randomLoot = randomLoot;
  window.collectLoot = collectLoot;
  window.makePotionDrop = _makePotionDrop;
  window.makePortalScrollDrop = _makePortalScrollDrop;
  window.computeItemLevelFromStats = computeItemLevelFromStats;
  window.rollItemStatPotentials = rollItemStatPotentials;
  window.addBoostsToItem = addBoostsToItem;
  window.TIER_COLORS = LOOT_TIER_COLORS;
  // Das Bodenleuchten ist eine eigene Entscheidung (welche Seltenheit
  // bekommt welches Signal) und wird deshalb einzeln ansprechbar — sonst
  // waere sie nur ueber den ganzen spawnLoot-Pfad zu erreichen.
  window.attachRarityFx = _attachRarityFx;
  // Legacy aliases for any loose references that haven't been migrated yet
  // (e.g. js/scenes/HubScene.js is parsed but never instantiated).
  window.getRarityValueFromKey = getTierFromLegacyRarityKey;
  window.ITEM_RARITIES = [];
  // WP03: expose gold-drop helpers so chest-open code and future systems can
  // spawn gold piles without duplicating the formula.
  window.spawnGoldPile = _spawnGoldPile;
  window.rollEnemyGoldDrop = _rollEnemyGoldDrop;
}
