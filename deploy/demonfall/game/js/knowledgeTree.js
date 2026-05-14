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
    'knowledge.node.speed.desc':         '+3 % Bewegungsgeschwindigkeit pro Rang',
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
    'knowledge.node.cdr.label':          'Geübte Hände',
    'knowledge.node.cdr.desc':           '-3 % Cooldown (alle Fähigkeiten) pro Rang'
  };
  var I18N_EN = {
    'knowledge.title':             'Knowledge Tree',
    'knowledge.fragments':         'Fragments: {count}',
    'knowledge.btn.respec':        '[ Respec ]',
    'knowledge.btn.close':         '[ Close ]',
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
    'knowledge.node.cdr.label':          'Practiced Hands',
    'knowledge.node.cdr.desc':           '-3% cooldown (all abilities) per rank'
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
    { id: 'node_xp',         labelKey: 'knowledge.node.xp.label',         descKey: 'knowledge.node.xp.desc',         maxRank: 3, perRank: { field: 'xpMult',        kind: 'mult', value: 0.05 } },
    { id: 'node_gold',       labelKey: 'knowledge.node.gold.label',       descKey: 'knowledge.node.gold.desc',       maxRank: 3, perRank: { field: 'goldMult',      kind: 'mult', value: 0.05 } },
    { id: 'node_pickup',     labelKey: 'knowledge.node.pickup.label',     descKey: 'knowledge.node.pickup.desc',     maxRank: 3, perRank: { field: 'pickupAddRange', kind: 'add', value: 20   } },
    { id: 'node_magic_find', labelKey: 'knowledge.node.magic_find.label', descKey: 'knowledge.node.magic_find.desc', maxRank: 3, perRank: { field: 'magicFindMult', kind: 'mult', value: 0.05 } },
    { id: 'node_cdr',        labelKey: 'knowledge.node.cdr.label',        descKey: 'knowledge.node.cdr.desc',        maxRank: 5, perRank: { field: 'cdrAll',        kind: 'add',  value: 0.03 } }
  ];
  // Sum of maxRanks = 5+5+5+5+5+3+3+3+3+5 = 42 fragments to max all nodes.

  var CATALOG_BY_ID = {};
  for (var ci = 0; ci < CATALOG.length; ci++) CATALOG_BY_ID[CATALOG[ci].id] = CATALOG[ci];

  // --- Default primitives (window-bound, swappable via _configureForTest) -
  function _defaultPrimitives() {
    var hasWindow = typeof window !== 'undefined';
    return {
      storage: (hasWindow && window.localStorage) || {
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
    b.cdrAll = 0;
    // Apply each rank
    for (var i = 0; i < CATALOG.length; i++) {
      var node = CATALOG[i];
      var rank = state.ranks[node.id] | 0;
      if (rank <= 0) continue;
      var pr = node.perRank;
      var delta = rank * pr.value;
      if (pr.kind === 'mult') {
        b[pr.field] = 1 + delta;
      } else {
        b[pr.field] = delta;
      }
    }
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

  function invest(nodeId) {
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

  function respec() {
    var refund = 0;
    for (var nodeId in state.ranks) {
      if (Object.prototype.hasOwnProperty.call(state.ranks, nodeId)) {
        refund += (state.ranks[nodeId] | 0);
      }
    }
    state.fragments = (state.fragments | 0) + refund;
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
    respec: respec,
    onChange: onChange,
    resetForNewGame: resetForNewGame,
    _configureForTest: _configureForTest,
    _STORAGE_KEY: STORAGE_KEY,
    _SCHEMA_VERSION: SCHEMA_VERSION
  };
})();
