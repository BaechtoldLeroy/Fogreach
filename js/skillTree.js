// skillTree.js — Skill-Baum-Progression (Feature 060, #58).
//
// PURE, unit-testbares Kernmodul (Vorbild knowledgeTree.js). EIN Skill-Baum:
// Knoten = aktive Fähigkeiten (ABILITY_DEFS) mit Rängen, Voraussetzungen
// (Min-Level + Vorgänger-Knoten@Rang) und Synergien (Rang von A pusht eine
// Kennzahl von B). Skill-Punkte kommen aus Level-Ups (1/Level, grantSkillPoint).
//
// WP01 (dieses File): Datenmodell + Punkte/Ränge/Invest/Prereqs/Synergie-Werte/
// Respec-Logik + Persistenz. KEINE Combat-Effekte (WP02), KEINE UI (WP04),
// KEIN Gold (WP05 — Respec hier ohne Kosten).
//
// State lebt in eigenem localStorage-Blob (wie knowledgeTree); getSaveData/
// loadSaveData erlauben die spätere Einbettung in den Haupt-Save (WP05).
(function () {
  'use strict';

  var STORAGE_KEY = 'demonfall.skillTree.v1';
  var SCHEMA_VERSION = 1;

  // --- Baum-Datenmodell (Platzhalter-Topologie; finale Balance in WP02) -------
  // Knoten: { abilityId, name, maxRank, requires:{ minLevel?, node?, rank? },
  //           synergies:[{ from, perRank, stat }] }
  // minLevel  = ab welchem Player-Level investierbar
  // node/rank = Vorgänger-Knoten muss mind. diesen Rang haben
  // synergies = jeder Rang von `from` gibt diesem Knoten +perRank auf `stat`
  // 12-Knoten-Roster (genehmigt #58): 3 Stränge x 4, Diablo-inspiriert.
  // `strand` gruppiert für die UI (WP04). node-id == abilityId (1:1).
  // Tier-Gating: T1 minLevel 1, T2 minLevel 4 (+ Vorgänger@2), Capstone minLevel 8
  //   (+ BEIDE T2-Knoten des Strangs@2 — `requires.nodes`).
  // Caps: T1/T2 maxRank 5, Capstone maxRank 3.
  // Rang-Kosten steigen: Rang r kostet (2·r−1) Punkte (1/3/5/7/9). Die Gesamt-
  // Punkte in einem Knoten auf Rang R sind damit R² (Summe ungerader Zahlen).
  // HINWEIS: 6 Abilities sind NEU (whirlwind/hammer ← spin/charge umbenannt;
  // frenzy/steelGrasp/cycloneStrike/twistingBlades/deathBlow/charge neu) — die
  // `activate`-Funktionen folgen in WP02. WP01 definiert nur die Baum-Daten.
  var SKILL_TREE = Object.freeze({
    nodes: Object.freeze({
      // === Strang I — WUT & WUCHT (Melee/Burst, Barb-Kern) ===
      whirlwind:     { abilityId: 'whirlwind', name: 'Wirbelwind',        strand: 'wut',    maxRank: 5, requires: { minLevel: 1 },
                       synergies: [{ from: 'frenzy', perRank: 0.04, stat: 'damage' }] },
      hammer:        { abilityId: 'hammer',    name: 'Hammer der Ahnen',  strand: 'wut',    maxRank: 5, requires: { minLevel: 4, node: 'whirlwind', rank: 2 },
                       synergies: [{ from: 'whirlwind', perRank: 0.06, stat: 'damage' }] },
      frenzy:        { abilityId: 'frenzy',    name: 'Raserei',           strand: 'wut',    maxRank: 5, requires: { minLevel: 4, node: 'whirlwind', rank: 2 } },
      berserk:       { abilityId: 'berserk',   name: 'Berserker',         strand: 'wut',    maxRank: 3, requires: { minLevel: 8, nodes: [{ node: 'hammer', rank: 2 }, { node: 'frenzy', rank: 2 }] },
                       synergies: [{ from: 'hammer', perRank: 0.05, stat: 'buff' }] },

      // === Strang II — KETTEN & KONTROLLE (Pull/Ranged/CC — Lore) ===
      twistingBlades:{ abilityId: 'twistingBlades', name: 'Wirbelklingen', strand: 'ketten', maxRank: 5, requires: { minLevel: 1 } },
      steelGrasp:    { abilityId: 'steelGrasp',     name: 'Stahlgriff',    strand: 'ketten', maxRank: 5, requires: { minLevel: 4, node: 'twistingBlades', rank: 2 },
                       synergies: [{ from: 'cycloneStrike', perRank: 0.08, stat: 'damage' }] },
      cycloneStrike: { abilityId: 'cycloneStrike',  name: 'Wirbelsog',     strand: 'ketten', maxRank: 5, requires: { minLevel: 4, node: 'twistingBlades', rank: 2 } },
      frostNova:     { abilityId: 'frostNova',      name: 'Frostnova',     strand: 'ketten', maxRank: 3, requires: { minLevel: 8, nodes: [{ node: 'steelGrasp', rank: 2 }, { node: 'cycloneStrike', rank: 2 }] },
                       synergies: [{ from: 'cycloneStrike', perRank: 0.05, stat: 'damage' }] },

      // === Strang III — SCHATTEN & JAGD (Mobility/Execute/Sustain) ===
      charge:        { abilityId: 'charge',       name: 'Ansturm',         strand: 'schatten', maxRank: 5, requires: { minLevel: 1 } },
      teleportDash:  { abilityId: 'teleportDash', name: 'Schattenschritt', strand: 'schatten', maxRank: 5, requires: { minLevel: 4, node: 'charge', rank: 2 } },
      heilwunde:     { abilityId: 'heilwunde',    name: 'Heilwunde',       strand: 'schatten', maxRank: 5, requires: { minLevel: 4, node: 'charge', rank: 2 } },
      deathBlow:     { abilityId: 'deathBlow',    name: 'Todesstoss',      strand: 'schatten', maxRank: 3, requires: { minLevel: 8, nodes: [{ node: 'teleportDash', rank: 2 }, { node: 'heilwunde', rank: 2 }] },
                       synergies: [{ from: 'charge', perRank: 0.03, stat: 'threshold' },
                                   { from: 'frenzy', perRank: 0.02, stat: 'threshold' }] }
    })
  });

  function _defaultState() {
    return { version: SCHEMA_VERSION, skillPoints: 0, ranks: {} };
  }

  var state = _defaultState();
  var _listeners = [];

  function _copyRanks(ranks) {
    var out = {};
    if (ranks) Object.keys(ranks).forEach(function (k) { out[k] = ranks[k] | 0; });
    return out;
  }

  // --- Persistenz (eigener Blob; Haupt-Save-Einbettung folgt in WP05) --------
  function _persist() {
    try {
      if (typeof localStorage === 'undefined') return;
      (window.SlotStorage || localStorage).setItem(STORAGE_KEY, JSON.stringify({
        version: SCHEMA_VERSION,
        skillPoints: state.skillPoints | 0,
        ranks: _copyRanks(state.ranks)
      }));
    } catch (e) { /* never break gameplay */ }
  }

  function _load() {
    try {
      if (typeof localStorage === 'undefined') return;
      var raw = (window.SlotStorage || localStorage).getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      if (parsed.version && parsed.version > SCHEMA_VERSION) return; // future blob: ignore
      _applyData(parsed);
    } catch (e) { /* corrupt blob -> defaults */ }
  }

  // Nur valide Knoten/Ränge übernehmen (gegen Hand-Edits / alte Daten robust).
  function _applyData(data) {
    var sp = (data && typeof data.skillPoints === 'number') ? Math.max(0, Math.trunc(data.skillPoints)) : 0;
    var ranks = {};
    if (data && data.ranks && typeof data.ranks === 'object') {
      Object.keys(data.ranks).forEach(function (id) {
        var node = SKILL_TREE.nodes[id];
        if (!node) return;
        var r = Math.max(0, Math.min(node.maxRank, data.ranks[id] | 0));
        if (r > 0) ranks[id] = r;
      });
    }
    state.skillPoints = sp;
    state.ranks = ranks;
  }

  function _notify() {
    for (var i = 0; i < _listeners.length; i++) {
      try { _listeners[i](getState()); } catch (e) { /* swallow */ }
    }
  }

  function init() {
    state = _defaultState();
    _load();
  }

  // --- Lese-API --------------------------------------------------------------
  function getSkillPoints() { return state.skillPoints | 0; }

  // Tatsaechlich ausgegebene Skill-Punkte: pro Knoten die Summe der Rang-Kosten
  // = Rang² (Summe der ersten R ungeraden Zahlen). Von respec (Erstattung) und
  // der Respec-Kosten-Formel genutzt.
  function getSpentPoints() {
    var n = 0;
    Object.keys(state.ranks).forEach(function (id) { var r = state.ranks[id] | 0; n += r * r; });
    return n;
  }

  // Anzahl investierter Raenge (Knoten-Fuellstand, unabhaengig von den Kosten).
  function getAllocatedRanks() {
    var n = 0;
    Object.keys(state.ranks).forEach(function (id) { n += state.ranks[id] | 0; });
    return n;
  }

  // Punkt-Kosten, um Rang `rank` zu ERREICHEN (nicht kumuliert): 2·rank−1.
  // Rang<=0 -> 0. So kostet Rang 1=1, 2=3, 3=5, 4=7, 5=9.
  function getRankCost(rank) {
    rank = rank | 0;
    if (rank < 1) return 0;
    return 2 * rank - 1;
  }

  // Kosten des NAECHSTEN Rangs eines Knotens (0, wenn gemaxt/unbekannt).
  function getNextRankCost(nodeId) {
    var node = SKILL_TREE.nodes[nodeId];
    if (!node) return 0;
    var cur = getRank(nodeId);
    if (cur >= node.maxRank) return 0;
    return getRankCost(cur + 1);
  }

  function getRank(nodeId) { return state.ranks[nodeId] | 0; }

  function getNode(nodeId) {
    var n = SKILL_TREE.nodes[nodeId];
    if (!n) return null;
    return Object.assign({ id: nodeId }, n);
  }

  function getAllNodes() {
    return Object.keys(SKILL_TREE.nodes).map(function (id) { return getNode(id); });
  }

  function getState() {
    return { skillPoints: state.skillPoints | 0, ranks: _copyRanks(state.ranks), spent: getSpentPoints() };
  }

  // Voraussetzungen erfüllt? (Min-Level + Vorgänger-Knoten@Rang). `requires.node`
  // ist EINE Vorbedingung; `requires.nodes` (Array) verlangt ALLE gelisteten
  // Knoten (z. B. Capstones = beide T2-Knoten des Strangs).
  function isNodeAvailable(nodeId, playerLevel) {
    var node = SKILL_TREE.nodes[nodeId];
    if (!node) return false;
    var req = node.requires || {};
    var lvl = (typeof playerLevel === 'number') ? playerLevel : 0;
    if (req.minLevel && lvl < req.minLevel) return false;
    if (req.node && getRank(req.node) < (req.rank || 1)) return false;
    if (Array.isArray(req.nodes)) {
      for (var i = 0; i < req.nodes.length; i++) {
        var nr = req.nodes[i];
        if (nr && nr.node && getRank(nr.node) < (nr.rank || 1)) return false;
      }
    }
    return true;
  }

  // --- Punkte / Investieren --------------------------------------------------
  function grantSkillPoint(n) {
    var delta = (typeof n === 'number' && isFinite(n)) ? Math.trunc(n) : 1;
    if (delta <= 0) return state.skillPoints | 0;
    state.skillPoints = (state.skillPoints | 0) + delta;
    _persist();
    _notify();
    return state.skillPoints;
  }

  // Rang +1, wenn genug Punkte für den NAECHSTEN Rang da sind, Voraussetzungen
  // erfüllt und unter maxRank. Höhere Ränge kosten mehr (getRankCost).
  function investPoint(nodeId, playerLevel) {
    var node = SKILL_TREE.nodes[nodeId];
    if (!node) return false;
    if (!isNodeAvailable(nodeId, playerLevel)) return false;
    var cur = getRank(nodeId);
    if (cur >= node.maxRank) return false;
    var cost = getRankCost(cur + 1);
    if ((state.skillPoints | 0) < cost) return false;
    state.ranks[nodeId] = cur + 1;
    state.skillPoints = (state.skillPoints | 0) - cost;
    _persist();
    _notify();
    return true;
  }

  // Synergie-Beitrag eines Knotens für eine Kennzahl (von WP02 genutzt):
  // Summe über alle Synergien des Knotens mit passendem `stat`:
  //   (Rang von synergy.from) * synergy.perRank
  function getSynergyValue(nodeId, stat) {
    var node = SKILL_TREE.nodes[nodeId];
    if (!node || !Array.isArray(node.synergies)) return 0;
    var total = 0;
    for (var i = 0; i < node.synergies.length; i++) {
      var s = node.synergies[i];
      if (stat && s.stat !== stat) continue;
      total += getRank(s.from) * (s.perRank || 0);
    }
    return total;
  }

  // --- Combat-Skalierung (WP02-Contract) -------------------------------------
  // Gemeinsamer Vertrag fuer alle Ability-Straenge: Rang erhoeht Schaden linear
  // und senkt Cooldown (gedeckelt). Synergien koennen den Schaden zusaetzlich
  // pushen. PURE Funktionen — von den activate()-Pfaden in player.js/abilitySystem
  // defensiv gelesen.
  var RANK_DMG_PER = 0.15; // +15% Schaden pro Rang ueber Rang 1
  // Talentpunkte sollen den Cooldown spuerbar druecken: 8% -> 12% pro Rang,
  // Cap 40% -> 50%. Rang 5 = -48% CD (vorher -32%), Capstone Rang 3 = -24%.
  var RANK_CD_PER  = 0.12; // -12% Cooldown pro Rang ueber Rang 1
  var RANK_CD_CAP  = 0.50; // max. 50% Cooldown-Reduktion durch Raenge

  // Schadens-Multiplikator: 1 bei Rang<=1; +RANK_DMG_PER je weiterem Rang;
  // + Synergie-Beitrag (stat 'damage'). Unbekannte/ungelernte Knoten -> 1.
  function getAbilityDamageMult(id) {
    var rank = getRank(id);
    var rankPart = Math.max(0, rank - 1) * RANK_DMG_PER;
    return 1 + rankPart + getSynergyValue(id, 'damage');
  }

  // Cooldown-Multiplikator: 1 bei Rang<=1; sinkt mit Rang, gedeckelt bei
  // RANK_CD_CAP. Unbekannte/ungelernte Knoten -> 1.
  function getAbilityCooldownMult(id) {
    var rank = getRank(id);
    var reduction = Math.min(RANK_CD_CAP, Math.max(0, rank - 1) * RANK_CD_PER);
    return 1 - reduction;
  }

  // --- Respec-Kosten (WP03-Contract für die UI) ------------------------------
  // Skalierende Gold-Kosten für einen Respec. Reine Formel — den Gold-Abzug und
  // den Bestätigungs-Flow übernimmt die UI (P2). Zentral tunebar über die zwei
  // Konstanten. Ganzzahlig.
  var RESPEC_COST_BASE    = 100; // Grundkosten
  var RESPEC_COST_PER_PT  = 50;  // Aufschlag je investiertem Skill-Punkt

  // Gold-Kosten eines Respecs: BASE + investierte Punkte * PER_PT. 0 investierte
  // Punkte -> nur Grundkosten. Immer ganzzahlig.
  function getRespecCost() {
    return RESPEC_COST_BASE + getSpentPoints() * RESPEC_COST_PER_PT;
  }

  // Alle Ränge zurücksetzen, investierte Punkte erstatten. OHNE Gold (WP05).
  function respec() {
    var refunded = getSpentPoints();
    state.ranks = {};
    state.skillPoints = (state.skillPoints | 0) + refunded;
    _persist();
    _notify();
    return refunded;
  }

  // --- Save-Einbettung (WP05) ------------------------------------------------
  function getSaveData() {
    return { skillPoints: state.skillPoints | 0, ranks: _copyRanks(state.ranks) };
  }

  function loadSaveData(data) {
    if (!data || typeof data !== 'object') return;
    _applyData(data);
    _persist();
    _notify();
  }

  function resetForNewGame() {
    state = _defaultState();
    try { if (typeof localStorage !== 'undefined') (window.SlotStorage || localStorage).removeItem(STORAGE_KEY); } catch (e) {}
    _notify();
  }

  function onChange(fn) {
    if (typeof fn === 'function') _listeners.push(fn);
    return function () { _listeners = _listeners.filter(function (f) { return f !== fn; }); };
  }

  // --- AbilitySystem-Sync (WP03-Contract für die UI) -------------------------
  // Erwerb läuft ausschließlich über den Skill-Baum: nach jedem investPoint /
  // respec / loadSaveData wird window.AbilitySystem so abgeglichen, dass jeder
  // Knoten mit Rang>=1 als "gelernt" gilt und Knoten mit Rang 0 verlernt sind
  // (forgetAbility räumt zugleich die aktiven Slots). Defensiv: beide Module
  // optional, nie crashen. skillTree.js lädt NACH abilitySystem.js, daher ist
  // window.AbilitySystem zur Sync-Zeit i.d.R. verfügbar.
  function _syncAbilitySystem() {
    try {
      var AS = (typeof window !== 'undefined') ? window.AbilitySystem : null;
      if (!AS) return;
      var nodes = SKILL_TREE.nodes;
      Object.keys(nodes).forEach(function (nodeId) {
        var abilityId = nodes[nodeId].abilityId || nodeId;
        var rank = getRank(nodeId);
        if (rank >= 1) {
          if (typeof AS.isLearned === 'function' && AS.isLearned(abilityId)) return;
          if (typeof AS.learnAbility === 'function') {
            try { AS.learnAbility(abilityId, { silent: true }); } catch (e) { /* skip */ }
          }
        } else {
          if (typeof AS.isLearned === 'function' && !AS.isLearned(abilityId)) return;
          if (typeof AS.forgetAbility === 'function') {
            try { AS.forgetAbility(abilityId); } catch (e) { /* skip */ }
          }
        }
      });
    } catch (e) { /* never break gameplay */ }
  }

  // Test-Hook: State direkt setzen (umgeht Persistenz-Roundtrip).
  function _configureForTest(data) {
    state = _defaultState();
    if (data) _applyData(data);
  }

  init();

  // Sync bei jeder Baum-Änderung + einmalig nach dem Laden (damit ein
  // persistierter Baum-Stand die gelernten Abilities sofort rekonstruiert).
  onChange(_syncAbilitySystem);
  _syncAbilitySystem();

  var SkillTree = {
    SKILL_TREE: SKILL_TREE,
    init: init,
    getSkillPoints: getSkillPoints,
    getSpentPoints: getSpentPoints,
    getAllocatedRanks: getAllocatedRanks,
    getRankCost: getRankCost,
    getNextRankCost: getNextRankCost,
    getRank: getRank,
    getNode: getNode,
    getAllNodes: getAllNodes,
    getState: getState,
    isNodeAvailable: isNodeAvailable,
    grantSkillPoint: grantSkillPoint,
    investPoint: investPoint,
    getSynergyValue: getSynergyValue,
    getAbilityDamageMult: getAbilityDamageMult,
    getAbilityCooldownMult: getAbilityCooldownMult,
    getRespecCost: getRespecCost,
    respec: respec,
    getSaveData: getSaveData,
    loadSaveData: loadSaveData,
    resetForNewGame: resetForNewGame,
    onChange: onChange,
    _configureForTest: _configureForTest,
    _STORAGE_KEY: STORAGE_KEY,
    _SCHEMA_VERSION: SCHEMA_VERSION
  };

  if (typeof window !== 'undefined') window.SkillTree = SkillTree;
  if (typeof module !== 'undefined' && module.exports) module.exports = SkillTree;
})();
