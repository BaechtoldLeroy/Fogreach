// printingHouse.js — Druckerei (Printing House) feature (#24).
//
// Players collect Druckblätter (paper currency), spend them at the Druckerei
// to publish edicts that buff the player for one dungeon run. Higher tiers
// require Resistance standing (#25) and cost more paper. Publishing builds
// Council suspicion which decays naturally and triggers retaliation when
// it crosses thresholds.
//
// Run-scoped effects ride window.printingBuffs (sibling of window.brunnenBuffs
// from #16). Cleared in main.js leaveDungeonForHub. Currency, suspicion,
// active publication, and history persist under demonfall_printinghouse_v1.
//
// See:
//   kitty-specs/046-printing-house-stub/spec.md

(function () {
  var STORAGE_KEY = 'demonfall_printinghouse_v1';
  var SCHEMA_VERSION = 1;
  var DRUCKBLAETTER_CAP = 50;
  var MAX_HISTORY = 10;
  var BRIBE_GOLD_COST = 100;
  var BRIBE_SUSPICION_REDUCTION = 5;
  var GOLD_TO_PAPER_COST = 50; // 50 gold = 1 Druckblatt (fallback path)
  var DRUCKEREI_UNLOCK_QUEST = 'aldric_cleanup';

  // --- i18n string tables -------------------------------------------------
  var I18N_DE = {
    'printingHouse.npc.name': 'Setzer Thom',
    'printingHouse.dialog.title': 'Druckerei',
    'printingHouse.dialog.locked': 'Setzer Thom: »Die Druckerei ist verschlossen — komm wieder, wenn du dich bewährt hast.«',
    'printingHouse.dialog.intro': 'Welche Botschaft soll ich heute in die Stadt drucken?',
    'printingHouse.summary': 'Druckblätter: {paper}/{cap}  ·  Council-Verdacht: {suspicion}',
    'printingHouse.choice.publish': 'Edikt veröffentlichen',
    'printingHouse.choice.bribe': 'Aldric bestechen (-100 Gold, -5 Verdacht)',
    'printingHouse.choice.tradegold': 'Gold gegen Druckblatt tauschen (-50 Gold)',
    'printingHouse.choice.history': 'Verlauf ansehen',
    'printingHouse.choice.close': 'Schließen',
    'printingHouse.toast.published': 'Edikt veröffentlicht: {name}',
    'printingHouse.toast.bribed': 'Aldric beschwichtigt — Verdacht -5',
    'printingHouse.toast.tradegold': '+1 Druckblatt',
    'printingHouse.toast.locked': 'Tier benötigt Resistance-Standing {req}',
    'printingHouse.toast.no_paper': 'Nicht genug Druckblätter',
    'printingHouse.toast.already_active': 'Ein Edikt ist bereits aktiv für den nächsten Run',
    'printingHouse.tier.mild': 'Mild',
    'printingHouse.tier.strong': 'Stark',
    'printingHouse.tier.risky': 'Riskant',
    // Edict labels
    'printingHouse.edict.tip_to_guards.label': 'Trinkgeld an die Wache',
    'printingHouse.edict.tip_to_guards.desc': 'Mara senkt die Preise um 10%.',
    'printingHouse.edict.iron_discipline.label': 'Eiserne Disziplin',
    'printingHouse.edict.iron_discipline.desc': '+5% Schaden im nächsten Run.',
    'printingHouse.edict.amulets_distributed.label': 'Schutzamulette verteilt',
    'printingHouse.edict.amulets_distributed.desc': '+10 Max-LP im nächsten Run.',
    'printingHouse.edict.market_reform.label': 'Marktreform',
    'printingHouse.edict.market_reform.desc': 'Mara senkt die Preise um 25%.',
    'printingHouse.edict.war_cry.label': 'Kriegsruf',
    'printingHouse.edict.war_cry.desc': '+15% Schaden im nächsten Run.',
    'printingHouse.edict.hero_paths.label': 'Heldenpfade',
    'printingHouse.edict.hero_paths.desc': '+25 Max-LP im nächsten Run.',
    'printingHouse.edict.smuggling_network.label': 'Schmuggelnetz',
    'printingHouse.edict.smuggling_network.desc': '+20% Loot-Seltenheit im nächsten Run.',
    'printingHouse.edict.open_rebellion.label': 'Offene Rebellion',
    'printingHouse.edict.open_rebellion.desc': '+50% Gold-Drops, aber Gegner haben +50% LP.',
    'printingHouse.edict.black_market.label': 'Schwarzmarkt',
    'printingHouse.edict.black_market.desc': 'Mara führt seltene Ware, dafür sind Gegner stärker.',
    'printingHouse.edict.last_battle.label': 'Letzte Schlacht',
    'printingHouse.edict.last_battle.desc': '+30% Schaden und +30% Max-LP, aber Heiltränke wirken nicht.'
  };
  var I18N_EN = {
    'printingHouse.npc.name': 'Setzer Thom',
    'printingHouse.dialog.title': 'Printing House',
    'printingHouse.dialog.locked': "Setzer Thom: 'The press is closed — come back once you've proven yourself.'",
    'printingHouse.dialog.intro': 'Which message shall I print for the city today?',
    'printingHouse.summary': 'Paper: {paper}/{cap}  ·  Council suspicion: {suspicion}',
    'printingHouse.choice.publish': 'Publish edict',
    'printingHouse.choice.bribe': 'Bribe Aldric (-100 gold, -5 suspicion)',
    'printingHouse.choice.tradegold': 'Trade gold for paper (-50 gold)',
    'printingHouse.choice.history': 'View history',
    'printingHouse.choice.close': 'Close',
    'printingHouse.toast.published': 'Edict published: {name}',
    'printingHouse.toast.bribed': 'Aldric appeased — suspicion -5',
    'printingHouse.toast.tradegold': '+1 paper',
    'printingHouse.toast.locked': 'Tier requires Resistance standing {req}',
    'printingHouse.toast.no_paper': 'Not enough paper',
    'printingHouse.toast.already_active': 'An edict is already active for the next run',
    'printingHouse.tier.mild': 'Mild',
    'printingHouse.tier.strong': 'Strong',
    'printingHouse.tier.risky': 'Risky',
    'printingHouse.edict.tip_to_guards.label': 'Tip to the Guard',
    'printingHouse.edict.tip_to_guards.desc': 'Mara lowers prices by 10%.',
    'printingHouse.edict.iron_discipline.label': 'Iron Discipline',
    'printingHouse.edict.iron_discipline.desc': '+5% damage next run.',
    'printingHouse.edict.amulets_distributed.label': 'Amulets Distributed',
    'printingHouse.edict.amulets_distributed.desc': '+10 max HP next run.',
    'printingHouse.edict.market_reform.label': 'Market Reform',
    'printingHouse.edict.market_reform.desc': 'Mara lowers prices by 25%.',
    'printingHouse.edict.war_cry.label': 'War Cry',
    'printingHouse.edict.war_cry.desc': '+15% damage next run.',
    'printingHouse.edict.hero_paths.label': 'Hero Paths',
    'printingHouse.edict.hero_paths.desc': '+25 max HP next run.',
    'printingHouse.edict.smuggling_network.label': 'Smuggling Network',
    'printingHouse.edict.smuggling_network.desc': '+20% loot rarity next run.',
    'printingHouse.edict.open_rebellion.label': 'Open Rebellion',
    'printingHouse.edict.open_rebellion.desc': '+50% gold drops, but enemies have +50% HP.',
    'printingHouse.edict.black_market.label': 'Black Market',
    'printingHouse.edict.black_market.desc': 'Mara stocks rare goods; enemies are stronger.',
    'printingHouse.edict.last_battle.label': 'Last Battle',
    'printingHouse.edict.last_battle.desc': '+30% damage and +30% max HP, but potions are disabled.'
  };

  // --- Edict catalog (data-driven) ---------------------------------------
  // tier: 'mild'   — cost 1, suspicionCost 1, requireStanding 0
  // tier: 'strong' — cost 3, suspicionCost 3, requireStanding 25
  // tier: 'risky'  — cost 5, suspicionCost 5, requireStanding 50
  //
  // effect.kind:
  //   damage_mult        — multiply weapon damage in recalcDerived
  //   maxhp_add          — flat add to max HP
  //   maxhp_add_pct      — percent add to max HP (additive on base+gear+skills)
  //   shop_price_mult    — multiplier for LootSystem.getShopPriceMultiplier
  //   loot_rarity_bias   — multiplier for affix-tier-bias
  //   gold_mult          — multiplier for gold drop quantity
  //   enemy_hp_mult      — multiplier for enemy HP at spawn
  //   enemy_tier_bonus   — additive tier bonus at enemy spawn
  //   rare_item_at_mara  — boolean flag (consumed by shop refresh)
  //   potion_disabled    — boolean flag (LootSystem.consumePotion checks)
  var EDICT_CATALOG = [
    // Mild (3)
    { id: 'tip_to_guards',         tier: 'mild', cost: 1, suspicionCost: 1, requireStanding: 0,
      effect: { kind: 'shop_price_mult',  value: 0.90 } },
    { id: 'iron_discipline',       tier: 'mild', cost: 1, suspicionCost: 1, requireStanding: 0,
      effect: { kind: 'damage_mult',      value: 1.05 } },
    { id: 'amulets_distributed',   tier: 'mild', cost: 1, suspicionCost: 1, requireStanding: 0,
      effect: { kind: 'maxhp_add',        value: 10 } },
    // Strong (4)
    { id: 'market_reform',         tier: 'strong', cost: 3, suspicionCost: 3, requireStanding: 25,
      effect: { kind: 'shop_price_mult',  value: 0.75 } },
    { id: 'war_cry',               tier: 'strong', cost: 3, suspicionCost: 3, requireStanding: 25,
      effect: { kind: 'damage_mult',      value: 1.15 } },
    { id: 'hero_paths',            tier: 'strong', cost: 3, suspicionCost: 3, requireStanding: 25,
      effect: { kind: 'maxhp_add',        value: 25 } },
    { id: 'smuggling_network',     tier: 'strong', cost: 3, suspicionCost: 3, requireStanding: 25,
      effect: { kind: 'loot_rarity_bias', value: 1.20 } },
    // Risky (3)
    { id: 'open_rebellion',        tier: 'risky', cost: 5, suspicionCost: 5, requireStanding: 50,
      effect: { kind: 'open_rebellion' /* compound: gold_mult + enemy_hp_mult */ } },
    { id: 'black_market',          tier: 'risky', cost: 5, suspicionCost: 5, requireStanding: 50,
      effect: { kind: 'black_market'  /* compound: rare_item_at_mara + enemy_tier_bonus */ } },
    { id: 'last_battle',           tier: 'risky', cost: 5, suspicionCost: 5, requireStanding: 50,
      effect: { kind: 'last_battle'   /* compound: damage + maxhp + potion_disabled */ } }
  ];

  function _edictById(id) {
    for (var i = 0; i < EDICT_CATALOG.length; i++) {
      if (EDICT_CATALOG[i].id === id) return EDICT_CATALOG[i];
    }
    return null;
  }

  function _tierUnlockStanding(tier) {
    if (tier === 'strong') return 25;
    if (tier === 'risky')  return 50;
    return 0;
  }

  // --- Internal state -----------------------------------------------------
  var state = _freshState();
  var primitives = _defaultPrimitives();
  var _storageWarned = false;

  function _freshState() {
    return {
      initialized: false,
      i18nRegistered: false,
      druckblaetter: 0,
      suspicion: 0,
      active: null,        // edictId or null
      history: []          // [{ edictId, publishedAt, suspicionAtPublish }]
    };
  }

  function _defaultPrimitives() {
    var hasWindow = typeof window !== 'undefined';
    return {
      storage: (hasWindow && window.localStorage) || {
        getItem: function () { return null; }, setItem: function () {}, removeItem: function () {}
      },
      i18n: (hasWindow && window.i18n) || {
        register: function () {}, t: function (k) { return k; }, onChange: function () { return function () {}; }
      },
      factionSystem: (hasWindow && window.FactionSystem) || { getStanding: function () { return 0; } },
      questSystem: (hasWindow && window.questSystem) || { getCompletedQuests: function () { return []; } },
      lootSystem: (hasWindow && window.LootSystem) || {
        getGold: function () { return 0; },
        spendGold: function () { return false; }
      },
      now: function () { return Date.now(); }
    };
  }

  // --- Persistence --------------------------------------------------------

  function _persist() {
    var blob = JSON.stringify({
      version: SCHEMA_VERSION,
      druckblaetter: state.druckblaetter | 0,
      suspicion: state.suspicion | 0,
      active: state.active || null,
      history: state.history.slice(-MAX_HISTORY)
    });
    try { primitives.storage.setItem(STORAGE_KEY, blob); }
    catch (err) {
      if (!_storageWarned) {
        _storageWarned = true;
        try { console.warn('[PrintingHouse] persist failed; running in-memory only', err); } catch (_) {}
      }
    }
  }

  function _loadPersisted() {
    var raw;
    try { raw = primitives.storage.getItem(STORAGE_KEY); } catch (_) { raw = null; }
    if (!raw) return null;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (_) {
      try { console.warn('[PrintingHouse] discarded malformed blob'); } catch (_) {}
      _clearPersisted();
      return null;
    }
    if (!parsed || typeof parsed !== 'object' || parsed.version !== SCHEMA_VERSION) {
      try { console.warn('[PrintingHouse] discarded incompatible-version blob'); } catch (_) {}
      _clearPersisted();
      return null;
    }
    return parsed;
  }

  function _clearPersisted() {
    try { primitives.storage.removeItem(STORAGE_KEY); } catch (_) {}
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
    if (persisted) {
      state.druckblaetter = Math.max(0, Math.min(DRUCKBLAETTER_CAP, persisted.druckblaetter | 0));
      state.suspicion     = Math.max(0, persisted.suspicion | 0);
      state.active        = persisted.active && _edictById(persisted.active) ? persisted.active : null;
      state.history       = Array.isArray(persisted.history) ? persisted.history.slice(-MAX_HISTORY) : [];
    }
  }

  function getDruckblaetter() { return state.druckblaetter | 0; }

  function addDruckblaetter(n) {
    if (typeof n !== 'number' || !isFinite(n)) return state.druckblaetter | 0;
    var oldVal = state.druckblaetter;
    var newVal = Math.max(0, Math.min(DRUCKBLAETTER_CAP, oldVal + Math.trunc(n)));
    if (newVal !== oldVal) {
      state.druckblaetter = newVal;
      _persist();
    }
    return newVal;
  }

  function getSuspicion() { return state.suspicion | 0; }

  function addSuspicion(n) {
    if (typeof n !== 'number' || !isFinite(n)) return state.suspicion | 0;
    var oldVal = state.suspicion;
    var newVal = Math.max(0, oldVal + Math.trunc(n));
    if (newVal !== oldVal) {
      state.suspicion = newVal;
      _persist();
    }
    return newVal;
  }

  // Spend gold to drop suspicion. Returns false (no-op) when already at 0
  // suspicion or when the player can't afford the cost.
  function bribe() {
    if (state.suspicion <= 0) return false;
    var gold = 0;
    try { gold = primitives.lootSystem.getGold(); } catch (_) {}
    if (gold < BRIBE_GOLD_COST) return false;
    var ok = false;
    try { ok = !!primitives.lootSystem.spendGold(BRIBE_GOLD_COST); } catch (_) {}
    if (!ok) return false;
    state.suspicion = Math.max(0, state.suspicion - BRIBE_SUSPICION_REDUCTION);
    _persist();
    return true;
  }

  // Convert gold to paper at a fixed rate. Useful when stuck without paper
  // drops. Caps at DRUCKBLAETTER_CAP. Returns true on success.
  function tradeGoldForPaper() {
    if (state.druckblaetter >= DRUCKBLAETTER_CAP) return false;
    var gold = 0;
    try { gold = primitives.lootSystem.getGold(); } catch (_) {}
    if (gold < GOLD_TO_PAPER_COST) return false;
    var ok = false;
    try { ok = !!primitives.lootSystem.spendGold(GOLD_TO_PAPER_COST); } catch (_) {}
    if (!ok) return false;
    state.druckblaetter = Math.min(DRUCKBLAETTER_CAP, state.druckblaetter + 1);
    _persist();
    return true;
  }

  function isUnlocked() {
    var completed = [];
    try { completed = primitives.questSystem.getCompletedQuests() || []; } catch (_) {}
    return completed.indexOf(DRUCKEREI_UNLOCK_QUEST) >= 0;
  }

  // Returns a frozen-by-convention list of edict descriptors enriched with
  // isUnlocked (combines tier-standing + active-edict-conflict — the dialog
  // UI greys them out).
  function getEdictCatalog() {
    var standing = 0;
    try { standing = primitives.factionSystem.getStanding('resistance') | 0; } catch (_) {}
    return EDICT_CATALOG.map(function (e) {
      return {
        id: e.id,
        tier: e.tier,
        cost: e.cost,
        suspicionCost: e.suspicionCost,
        requireStanding: e.requireStanding,
        effect: { kind: e.effect.kind, value: e.effect.value },
        isUnlocked: standing >= e.requireStanding
      };
    });
  }

  function getActivePublication() {
    if (!state.active) return null;
    var def = _edictById(state.active);
    if (!def) return null;
    return {
      id: def.id, tier: def.tier, cost: def.cost,
      suspicionCost: def.suspicionCost, effect: def.effect
    };
  }

  function publishEdict(edictId) {
    var def = _edictById(edictId);
    if (!def) return { success: false, reason: 'unknown edict id' };
    if (state.active) return { success: false, reason: 'already active publication' };
    var standing = 0;
    try { standing = primitives.factionSystem.getStanding('resistance') | 0; } catch (_) {}
    if (standing < def.requireStanding) {
      return { success: false, reason: 'tier locked: requires resistance standing >= ' + def.requireStanding };
    }
    if (state.druckblaetter < def.cost) {
      return { success: false, reason: 'insufficient druckblaetter (cost ' + def.cost + ')' };
    }
    state.druckblaetter -= def.cost;
    state.suspicion += def.suspicionCost;
    state.active = def.id;
    state.history.push({
      edictId: def.id,
      publishedAt: primitives.now(),
      suspicionAtPublish: state.suspicion
    });
    if (state.history.length > MAX_HISTORY) {
      state.history = state.history.slice(-MAX_HISTORY);
    }
    _persist();
    return { success: true };
  }

  function clearActivePublication() {
    if (state.active === null) return;
    state.active = null;
    _persist();
  }

  // Reduce suspicion by 1 (called once per dungeon run completed without
  // publication). No-op when an edict was published this run (caller checks)
  // or when suspicion is already 0.
  function decaySuspicion() {
    if (state.active) return; // active edict means there was a publication this cycle
    if (state.suspicion <= 0) return;
    state.suspicion -= 1;
    _persist();
  }

  function getHistory() { return state.history.slice(); }

  // Suspicion threshold helpers — consumed by enemy-spawn / hub-patrol code.
  function getRetaliationTier() {
    if (state.suspicion >= 20) return 'active_hunt';
    if (state.suspicion >= 10) return 'high_alert';
    return 'none';
  }

  // --- Apply / clear active edict effect ---------------------------------
  // Builds window.printingBuffs from the active edict's effect. Called by
  // GameScene on entry (run start). leaveDungeonForHub clears the buffs.
  function applyActivePublicationEffect() {
    if (!state.active) {
      if (typeof window !== 'undefined') window.printingBuffs = null;
      return;
    }
    var def = _edictById(state.active);
    if (!def) return;
    var bb = {
      damageMult: 1, maxHpAdd: 0, maxHpAddPct: 0,
      shopPriceMult: 1, lootRarityBias: 1, goldMult: 1,
      enemyHpMult: 1, enemyTierBonus: 0,
      rareItemAtMara: false, potionDisabled: false
    };
    switch (def.effect.kind) {
      case 'damage_mult':      bb.damageMult       = def.effect.value; break;
      case 'maxhp_add':        bb.maxHpAdd         = def.effect.value; break;
      case 'maxhp_add_pct':    bb.maxHpAddPct      = def.effect.value; break;
      case 'shop_price_mult':  bb.shopPriceMult    = def.effect.value; break;
      case 'loot_rarity_bias': bb.lootRarityBias   = def.effect.value; break;
      case 'gold_mult':        bb.goldMult         = def.effect.value; break;
      case 'enemy_hp_mult':    bb.enemyHpMult      = def.effect.value; break;
      case 'enemy_tier_bonus': bb.enemyTierBonus   = def.effect.value; break;
      case 'open_rebellion':   bb.goldMult = 1.5; bb.enemyHpMult = 1.5; break;
      case 'black_market':     bb.rareItemAtMara = true; bb.enemyTierBonus = 1; break;
      case 'last_battle':
        bb.damageMult = 1.30; bb.maxHpAddPct = 0.30; bb.potionDisabled = true; break;
      default: break;
    }
    if (typeof window !== 'undefined') window.printingBuffs = bb;
  }

  function _configureForTest(p) {
    primitives = _defaultPrimitives();
    if (p && typeof p === 'object') {
      if (p.storage)        primitives.storage        = p.storage;
      if (p.i18n)           primitives.i18n           = p.i18n;
      if (p.factionSystem)  primitives.factionSystem  = p.factionSystem;
      if (p.questSystem)    primitives.questSystem    = p.questSystem;
      if (p.lootSystem)     primitives.lootSystem     = p.lootSystem;
      if (typeof p.now === 'function') primitives.now = p.now;
    }
    state = _freshState();
    _storageWarned = false;
  }

  // Auto-init on script load.
  init();

  window.PrintingHouse = {
    init: init,
    getDruckblaetter: getDruckblaetter,
    addDruckblaetter: addDruckblaetter,
    getSuspicion: getSuspicion,
    addSuspicion: addSuspicion,
    bribe: bribe,
    tradeGoldForPaper: tradeGoldForPaper,
    isUnlocked: isUnlocked,
    getEdictCatalog: getEdictCatalog,
    publishEdict: publishEdict,
    getActivePublication: getActivePublication,
    clearActivePublication: clearActivePublication,
    decaySuspicion: decaySuspicion,
    getHistory: getHistory,
    getRetaliationTier: getRetaliationTier,
    applyActivePublicationEffect: applyActivePublicationEffect,
    _configureForTest: _configureForTest,
    _STORAGE_KEY: STORAGE_KEY,
    _SCHEMA_VERSION: SCHEMA_VERSION,
    _CAP: DRUCKBLAETTER_CAP,
    _BRIBE_GOLD_COST: BRIBE_GOLD_COST,
    _BRIBE_SUSPICION_REDUCTION: BRIBE_SUSPICION_REDUCTION,
    _GOLD_TO_PAPER_COST: GOLD_TO_PAPER_COST,
    _DRUCKEREI_UNLOCK_QUEST: DRUCKEREI_UNLOCK_QUEST
  };
})();
