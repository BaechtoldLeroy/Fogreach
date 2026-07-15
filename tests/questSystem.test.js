// Unit tests for js/questSystem.js
//
// The system is browser-IIFE that attaches to window. We rely on storySystem
// for the act-gating logic — provide a stub so the tests work in isolation.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

function freshSystem() {
  resetStore();
  delete globalThis.window.questSystem;
  // Stub storySystem so getAvailableQuests's act check returns 0 (highest tier)
  globalThis.window.storySystem = { getCurrentActIndex: () => 99 };
  // Feature 058 (#41): default the run depth deep enough that minDepth-gated
  // quests aren't blocked by default — gate tests override this explicitly.
  globalThis.window.DUNGEON_DEPTH = 99;
  loadGameModule('js/questSystem.js');
  return globalThis.window.questSystem;
}

beforeEach(() => {
  resetStore();
});

test('initial state: every quest is available', () => {
  const qs = freshSystem();
  // aldric_cleanup is the first quest defined in the system
  const available = qs.getAvailableQuests('aldric');
  assert.ok(available.length > 0, 'expected at least one quest available for aldric');
  assert.ok(available.find(q => q.id === 'aldric_cleanup'), 'aldric_cleanup should be available');
});

test('acceptQuest changes status to active', () => {
  const qs = freshSystem();
  const ok = qs.acceptQuest('aldric_cleanup');
  assert.strictEqual(ok, true);
  const active = qs.getActiveQuests('aldric');
  assert.ok(active.find(q => q.id === 'aldric_cleanup'));
});

test('after accept, the quest is no longer in available list', () => {
  const qs = freshSystem();
  qs.acceptQuest('aldric_cleanup');
  const available = qs.getAvailableQuests('aldric');
  assert.ok(!available.find(q => q.id === 'aldric_cleanup'), 'accepted quest must leave the available pool');
});

test('isQuestReadyToComplete is false right after accept (objectives not met)', () => {
  const qs = freshSystem();
  qs.acceptQuest('aldric_cleanup');
  assert.strictEqual(qs.isQuestReadyToComplete('aldric_cleanup'), false);
});

test('completing a kill quest by reporting kills marks it ready', () => {
  const qs = freshSystem();
  qs.acceptQuest('aldric_cleanup');
  // aldric_cleanup needs 10 kills of "enemy"; emit 10 kill events
  // updateQuestProgress(type, target, amount) is the public API used by main.js
  if (typeof qs.updateQuestProgress === 'function') {
    qs.updateQuestProgress('kill', 'enemy', 10);
  }
  assert.strictEqual(qs.isQuestReadyToComplete('aldric_cleanup'), true);
});

test('completeQuest moves the quest to completed list', () => {
  const qs = freshSystem();
  qs.acceptQuest('aldric_cleanup');
  // updateQuestProgress(type, target, amount) is the public API used by main.js
  if (typeof qs.updateQuestProgress === 'function') {
    qs.updateQuestProgress('kill', 'enemy', 10);
  }
  const ok = qs.completeQuest('aldric_cleanup');
  assert.strictEqual(ok, true);
  const completed = qs.getCompletedQuests('aldric');
  assert.ok(completed.find(q => q.id === 'aldric_cleanup'), 'completed list should contain the quest');
  assert.ok(!qs.getActiveQuests('aldric').find(q => q.id === 'aldric_cleanup'), 'active list must no longer contain it');
});

test('onQuestUpdate listener fires when accepting a quest', () => {
  const qs = freshSystem();
  let calls = 0;
  const handler = () => { calls++; };
  qs.onQuestUpdate(handler);
  qs.acceptQuest('aldric_cleanup');
  assert.ok(calls >= 1, 'listener should have been called at least once');
});

test('offQuestUpdate stops a listener from being called', () => {
  const qs = freshSystem();
  let calls = 0;
  const handler = () => { calls++; };
  qs.onQuestUpdate(handler);
  qs.acceptQuest('aldric_cleanup');
  const beforeOff = calls;
  qs.offQuestUpdate(handler);
  // Force another notification: complete with full progress
  if (typeof qs.updateQuestProgress === 'function') {
    qs.updateQuestProgress('kill', 'enemy', 10);
  }
  qs.completeQuest('aldric_cleanup');
  assert.strictEqual(calls, beforeOff, 'listener must not fire after offQuestUpdate');
});

test('getTrackerText returns text when active quests exist', () => {
  const qs = freshSystem();
  qs.acceptQuest('aldric_cleanup');
  const text = qs.getTrackerText();
  assert.ok(typeof text === 'string' && text.length > 0, 'tracker text should be non-empty after accept');
});

// =========================================================================
// Feature 050 — Act 1 Quest Chain catalog + reward dispatcher tests
// =========================================================================

test('feature 050: legacy Akt-1 quests removed from catalog', () => {
  const qs = freshSystem();
  // The 3 legacy Akt-1 quests should no longer be in any availability list
  ['aldric_intruders', 'harren_daughter', 'branka_armor'].forEach(function (id) {
    var foundAnywhere = ['aldric', 'harren', 'branka', 'elara', 'mara', 'thom']
      .some(function (npc) {
        var avail = qs.getAvailableQuests(npc) || [];
        return avail.some(function (q) { return q.id === id; });
      });
    assert.strictEqual(foundAnywhere, false, id + ' must not be offered');
  });
});

test('feature 050: Q1 gated behind Aldric warmup quests, not offered immediately', () => {
  const qs = freshSystem();
  // Q1 NOT yet offered — Aldric cleanup + patrol must complete first
  const harrenAvailEarly = qs.getAvailableQuests('harren') || [];
  assert.ok(!harrenAvailEarly.find(function (q) { return q.id === 'harren_daughter_investigation'; }),
    'Q1 must wait for Aldric warmup quests');
  // Q2-Q5 NOT yet offered (they prereq Q1)
  ['aldric', 'klerus_priester', 'stadtwache', 'elara'].forEach(function (npc) {
    var avail = qs.getAvailableQuests(npc) || [];
    var blockedIds = ['magistrat_verification', 'klerus_purification', 'garde_patrol_expansion', 'widerstand_proof'];
    blockedIds.forEach(function (id) {
      assert.ok(!avail.find(function (q) { return q.id === id; }),
        npc + ' must not offer ' + id + ' before Q1 done');
    });
  });
  // Complete the two Aldric warmups → Q1 becomes available
  qs.acceptQuest('aldric_cleanup');
  qs.updateQuestProgress('kill', 'enemy', 10);
  qs.completeQuest('aldric_cleanup');
  qs.acceptQuest('aldric_patrol');
  qs.updateQuestProgress('explore', 'room', 3);
  qs.completeQuest('aldric_patrol');
  const harrenAvailNow = qs.getAvailableQuests('harren') || [];
  assert.ok(harrenAvailNow.find(function (q) { return q.id === 'harren_daughter_investigation'; }),
    'Q1 must be offered after both Aldric warmups complete');
});

test('feature 050: Q1 completion unlocks Q2/Q3/Q4/Q5 simultaneously', () => {
  const qs = freshSystem();
  // Aldric warmups first (Q1 prerequisite)
  qs.acceptQuest('aldric_cleanup');
  qs.updateQuestProgress('kill', 'enemy', 10);
  qs.completeQuest('aldric_cleanup');
  qs.acceptQuest('aldric_patrol');
  qs.updateQuestProgress('explore', 'room', 3);
  qs.completeQuest('aldric_patrol');
  qs.acceptQuest('harren_daughter_investigation');
  qs.updateQuestProgress('fetch', 'journal_fragment', 1);
  assert.strictEqual(qs.isQuestReadyToComplete('harren_daughter_investigation'), true);
  qs.completeQuest('harren_daughter_investigation');
  // All four parallel quests should now be available from their respective NPCs.
  const map = {
    aldric: 'magistrat_verification',
    klerus_priester: 'klerus_purification',
    stadtwache: 'garde_patrol_expansion',
    elara: 'widerstand_proof'
  };
  Object.keys(map).forEach(function (npc) {
    var avail = qs.getAvailableQuests(npc) || [];
    assert.ok(avail.find(function (q) { return q.id === map[npc]; }),
      npc + ' must offer ' + map[npc] + ' after Q1 done');
  });
});

test('feature 050: Q6 unlocks only after all 4 parallel quests complete', () => {
  const qs = freshSystem();
  // Aldric warmup → Q1 unlock → Q1 done
  qs.acceptQuest('aldric_cleanup');
  qs.updateQuestProgress('kill', 'enemy', 10);
  qs.completeQuest('aldric_cleanup');
  qs.acceptQuest('aldric_patrol');
  qs.updateQuestProgress('explore', 'room', 3);
  qs.completeQuest('aldric_patrol');
  qs.acceptQuest('harren_daughter_investigation');
  qs.updateQuestProgress('fetch', 'journal_fragment', 1);
  qs.completeQuest('harren_daughter_investigation');
  // Q6 not yet — no prerequisites met
  var harrenAvail1 = qs.getAvailableQuests('harren') || [];
  assert.ok(!harrenAvail1.find(function (q) { return q.id === 'council_collusion_reveal'; }),
    'Q6 must not be offered before Q2/Q3/Q4/Q5 done');
  // Knock off Q2-Q5 in any order
  qs.acceptQuest('magistrat_verification');
  qs.updateQuestProgress('kill', 'enemy', 8);
  qs.completeQuest('magistrat_verification');
  qs.acceptQuest('klerus_purification');
  qs.updateQuestProgress('kill', 'elite_enemy', 3);
  qs.completeQuest('klerus_purification');
  qs.acceptQuest('garde_patrol_expansion');
  qs.updateQuestProgress('kill', 'enemy', 10);
  qs.completeQuest('garde_patrol_expansion');
  qs.acceptQuest('widerstand_proof');
  qs.updateQuestProgress('fetch', 'council_document', 1);
  qs.completeQuest('widerstand_proof');
  // Now Q6 should be available
  var harrenAvail2 = qs.getAvailableQuests('harren') || [];
  assert.ok(harrenAvail2.find(function (q) { return q.id === 'council_collusion_reveal'; }),
    'Q6 must be offered after all 4 parallel quests complete');
});

test('feature 050: rewards.factionStanding applies via FactionSystem.adjustStanding', () => {
  const qs = freshSystem();
  const standingCalls = [];
  globalThis.window.FactionSystem = {
    adjustStanding: function (factionId, delta) { standingCalls.push([factionId, delta]); }
  };
  // Clear pre-Q1 warmup standings via fresh tracker AFTER warmup completion.
  qs.acceptQuest('aldric_cleanup');
  qs.updateQuestProgress('kill', 'enemy', 10);
  qs.completeQuest('aldric_cleanup');
  qs.acceptQuest('aldric_patrol');
  qs.updateQuestProgress('explore', 'room', 3);
  qs.completeQuest('aldric_patrol');
  standingCalls.length = 0; // ignore warmup-quest standing grants (if any)
  qs.acceptQuest('harren_daughter_investigation');
  qs.updateQuestProgress('fetch', 'journal_fragment', 1);
  qs.completeQuest('harren_daughter_investigation');
  // Q1 grants +1 independent
  assert.deepStrictEqual(standingCalls, [['independent', 1]]);
});

test('feature 050: rewards.fragments applies via KnowledgeTree.addFragments', () => {
  const qs = freshSystem();
  let fragmentsGranted = 0;
  globalThis.window.KnowledgeTree = {
    addFragments: function (n) { fragmentsGranted += n; }
  };
  qs.acceptQuest('aldric_cleanup');
  qs.updateQuestProgress('kill', 'enemy', 10);
  qs.completeQuest('aldric_cleanup');
  qs.acceptQuest('aldric_patrol');
  qs.updateQuestProgress('explore', 'room', 3);
  qs.completeQuest('aldric_patrol');
  fragmentsGranted = 0; // ignore any pre-Q1 grants
  qs.acceptQuest('harren_daughter_investigation');
  qs.updateQuestProgress('fetch', 'journal_fragment', 1);
  qs.completeQuest('harren_daughter_investigation');
  assert.strictEqual(fragmentsGranted, 1);
});

test('feature 050: Q6 completion advances storySystem to act index 2', () => {
  const qs = freshSystem();
  let advancedTo = null;
  globalThis.window.storySystem = {
    getCurrentActIndex: function () { return 99; },
    advanceToAct: function (idx) { advancedTo = idx; return true; }
  };
  // Run the chain quickly — Aldric warmups first, then Q1-Q6
  qs.acceptQuest('aldric_cleanup');
  qs.updateQuestProgress('kill', 'enemy', 10);
  qs.completeQuest('aldric_cleanup');
  qs.acceptQuest('aldric_patrol');
  qs.updateQuestProgress('explore', 'room', 3);
  qs.completeQuest('aldric_patrol');
  qs.acceptQuest('harren_daughter_investigation');
  qs.updateQuestProgress('fetch', 'journal_fragment', 1);
  qs.completeQuest('harren_daughter_investigation');
  qs.acceptQuest('magistrat_verification');
  qs.updateQuestProgress('kill', 'enemy', 8);
  qs.completeQuest('magistrat_verification');
  qs.acceptQuest('klerus_purification');
  qs.updateQuestProgress('kill', 'elite_enemy', 3);
  qs.completeQuest('klerus_purification');
  qs.acceptQuest('garde_patrol_expansion');
  qs.updateQuestProgress('kill', 'enemy', 10);
  qs.completeQuest('garde_patrol_expansion');
  qs.acceptQuest('widerstand_proof');
  qs.updateQuestProgress('fetch', 'council_document', 1);
  qs.completeQuest('widerstand_proof');
  qs.acceptQuest('council_collusion_reveal');
  qs.updateQuestProgress('dialogue', 'collusion_reveal_seen', 1);
  qs.completeQuest('council_collusion_reveal');
  assert.strictEqual(advancedTo, 2, 'Q6 must call advanceToAct(2)');
});

test('feature 050: legacy prerequisites patched — branka_doubt + harren_rescue', () => {
  const qs = freshSystem();
  // freshSystem uses the QUEST_DEFINITIONS object internally; we inspect via
  // getAvailableQuests for branka_doubt (requiredAct: 2, prerequisites: [])
  // and harren_rescue (requiredAct: 5, prerequisites: ['harren_daughter_investigation']).
  // The freshSystem stub returns getCurrentActIndex=99 so act-gating passes.
  // branka_doubt should be available immediately (empty prereqs now).
  var brankaAvail = qs.getAvailableQuests('branka') || [];
  assert.ok(brankaAvail.find(function (q) { return q.id === 'branka_doubt'; }),
    'branka_doubt must be offered after prerequisite patch (no longer needs branka_armor)');
});

test('feature 050: loadQuestSaveData silently drops unknown legacy quest IDs', () => {
  const qs = freshSystem();
  // Inject a save snapshot mentioning a legacy quest ID. The system should
  // ignore unknown IDs without throwing.
  assert.doesNotThrow(function () {
    qs.loadQuestSaveData({
      aldric_intruders: { status: 'active', objectives: [{ current: 5 }] }
    });
  });
});

// ---------------------------------------------------------------------------
// Feature 055 — Akt-2-Quest-Kette (Struktur + Korrektheit)
// ---------------------------------------------------------------------------
test('055: Akt-2-Quests existieren mit requiredAct 2 und ohne gate', () => {
  const qs = freshSystem();
  const defs = qs.QUEST_DEFINITIONS;
  ['council_seizure', 'council_surveillance', 'branka_transcripts',
   'ritual_chamber', 'bruch_confrontation'].forEach((id) => {
    assert.ok(defs[id], `${id} definiert`);
    assert.strictEqual(defs[id].requiredAct, 2, `${id} requiredAct 2`);
    assert.strictEqual(typeof defs[id].gate, 'undefined', `${id} ohne gate (keine Gates)`);
  });
});

test('055: advanceAct treibt Milestones (wahrheit=3, bruch=4)', () => {
  const qs = freshSystem();
  const defs = qs.QUEST_DEFINITIONS;
  assert.strictEqual(defs.ritual_chamber.advanceAct, 3);
  assert.strictEqual(defs.bruch_confrontation.advanceAct, 4);
});

test('055: alle prerequisites verweisen auf existierende Quests (kein Dangling)', () => {
  const qs = freshSystem();
  const defs = qs.QUEST_DEFINITIONS;
  Object.keys(defs).forEach((id) => {
    (defs[id].prerequisites || []).forEach((pre) => {
      assert.ok(defs[pre], `prerequisite ${pre} von ${id} existiert`);
    });
  });
});

test('055: fetch-Quests nutzen nur Targets mit Loot-Item (C-05)', () => {
  const qs = freshSystem();
  const defs = qs.QUEST_DEFINITIONS;
  // Targets, fuer die ein Loot-Item existiert (loot.js questItemDefs + deterministische)
  const LOOTED = new Set(['document', 'print_plate', 'journal_fragment',
    'council_document', 'seized_writings', 'interrogation_record']);
  Object.keys(defs).forEach((id) => {
    (defs[id].objectives || []).forEach((o) => {
      if (o.type === 'fetch') {
        assert.ok(LOOTED.has(o.target),
          `${id}: fetch-Target '${o.target}' braucht ein Loot-Item (sonst uncompletable)`);
      }
    });
  });
});

test('055: Espionage-Quests existieren mit observe-Objective, requiredAct 2, ohne gate', () => {
  const qs = freshSystem();
  const defs = qs.QUEST_DEFINITIONS;
  const EXPECTED = {
    espionage_convoy: { target: 'convoy_intel', npcId: 'mara', prereq: 'mara_contact' },
    espionage_archive: { target: 'archive_record', npcId: 'harren', prereq: 'espionage_convoy' },
    espionage_informant: { target: 'informant_id', npcId: 'widerstand', prereq: 'espionage_archive' }
  };
  Object.keys(EXPECTED).forEach((id) => {
    const q = defs[id];
    const spec = EXPECTED[id];
    assert.ok(q, `${id} definiert`);
    assert.strictEqual(q.requiredAct, 2, `${id} requiredAct 2`);
    assert.strictEqual(typeof q.gate, 'undefined', `${id} ohne gate (keine Gates)`);
    assert.strictEqual(typeof q.advanceAct, 'undefined', `${id} ohne advanceAct`);
    assert.strictEqual(q.npcId, spec.npcId, `${id} npcId ${spec.npcId}`);
    const obs = (q.objectives || []).find((o) => o.type === 'observe');
    assert.ok(obs, `${id} hat observe-Objective`);
    assert.strictEqual(obs.target, spec.target, `${id} observe-Target ${spec.target}`);
    assert.strictEqual(obs.required, 1, `${id} observe required 1`);
    assert.ok((q.prerequisites || []).includes(spec.prereq),
      `${id} prerequisite ${spec.prereq}`);
    assert.ok(defs[spec.prereq], `${id} prerequisite ${spec.prereq} existiert (kein Dangling)`);
  });
});

test('055: Akt-2-Council-Quests bei Aldric verfuegbar (Act>=2)', () => {
  const qs = freshSystem(); // storySystem-Stub: currentAct = 99
  const available = qs.getAvailableQuests('aldric').map((q) => q.id);
  assert.ok(available.includes('council_seizure'), 'council_seizure bei Aldric verfuegbar');
});

// --- Feature 058 (#41) WP04: run-based depth quest alignment ---

test('#41 WP04: dungeon_run advances +1 per COMPLETED run (onDungeonCompleted), not per wave', () => {
  const qs = freshSystem();
  assert.strictEqual(qs.acceptQuest('thom_pamphlets'), true, 'accept thom_pamphlets (dungeon_run x3)');
  const cur = () => qs.getActiveQuests('thom').find((q) => q.id === 'thom_pamphlets').objectives[0].current;
  // Per-wave completions must NOT advance dungeon_run anymore (the old bug).
  qs.onWaveCompleted(5);
  qs.onWaveCompleted(6);
  assert.strictEqual(cur(), 0, 'waves do not count as runs under run-constant depth');
  // Each completed run = exactly +1.
  qs.onDungeonCompleted();
  assert.strictEqual(cur(), 1, 'one completed run -> +1');
  qs.onDungeonCompleted();
  qs.onDungeonCompleted();
  assert.strictEqual(cur(), 3, 'three completed runs reach the required count');
});

test('#41 WP04: reach_wave completes when the run-constant depth >= target', () => {
  const qs = freshSystem();
  assert.strictEqual(qs.acceptQuest('mara_assault'), true, 'accept mara_assault (reach_wave 30)');
  const cur = () => qs.getActiveQuests('mara').find((q) => q.id === 'mara_assault').objectives[0].current;
  qs.onWaveCompleted(12); // running at depth 12 (< 30)
  assert.strictEqual(cur(), 12, 'tracks the deepest run depth seen');
  qs.onWaveCompleted(30); // running at depth 30 (>= 30) -> satisfied
  assert.strictEqual(cur(), 30, 'reaching the target depth completes the objective');
});

// --- Boss-Leiter <-> Quest-Leiter (Tiefe 10/20/30) ---------------------------
// Regression-Guard: der Zeremonienmeister zeigte per Copy-Paste-Bug auf
// 'kettenmeister' und hatte keine eigene Quest-Identitaet.

test('Boss-Leiter: Die Ritualkammer wird vom Zeremonienmeister erfuellt (Tiefe 20)', () => {
  const qs = freshSystem();
  assert.strictEqual(qs.acceptQuest('elara_ritual'), true, 'accept elara_ritual (boss_kill zeremonienmeister)');
  const cur = () => qs.getActiveQuests('elara').find((q) => q.id === 'elara_ritual').objectives[0].current;
  qs.onBossKilled('kettenmeister');
  assert.strictEqual(cur(), 0, 'der Kettenmeister erfuellt die Ritualkammer NICHT');
  qs.onBossKilled('zeremonienmeister');
  assert.strictEqual(cur(), 1, 'der Zeremonienmeister erfuellt sie');
});

test('Boss-Leiter: Maras Warnung braucht den Kettenmeister und liegt in Akt 2', () => {
  const qs = freshSystem();
  assert.strictEqual(qs.QUEST_DEFINITIONS.mara_warning.requiredAct, 2,
    'Maras Warnung kommt in Akt 2 (Kettenmeister sitzt auf Tiefe 10)');
  assert.strictEqual(qs.acceptQuest('mara_warning'), true);
  const cur = () => qs.getActiveQuests('mara').find((q) => q.id === 'mara_warning').objectives[0].current;
  qs.onBossKilled('zeremonienmeister');
  assert.strictEqual(cur(), 0, 'der Zeremonienmeister erfuellt Maras Warnung NICHT mehr');
  qs.onBossKilled('kettenmeister');
  assert.strictEqual(cur(), 1, 'der Kettenmeister erfuellt sie');
});

// --- Feature 058 (#41) follow-up: per-act minimum-depth quest gates ---

test('#41 minDepth: depth-gated kill quest frozen below minDepth, advances at/above', () => {
  const qs = freshSystem();
  assert.strictEqual(qs.acceptQuest('klerus_purification'), true, 'accept klerus_purification (minDepth 3)');
  const cur = () => qs.getActiveQuests('klerus_priester').find((q) => q.id === 'klerus_purification').objectives[0].current;
  globalThis.window.DUNGEON_DEPTH = 2;
  qs.updateQuestProgress('kill', 'elite_enemy', 1);
  assert.strictEqual(cur(), 0, 'no progress below depth 3');
  globalThis.window.DUNGEON_DEPTH = 3;
  qs.updateQuestProgress('kill', 'elite_enemy', 1);
  assert.strictEqual(cur(), 1, 'progresses once at/above depth 3');
});

test('#41 minDepth: thom_pamphlets only counts completed runs at/above depth 22', () => {
  const qs = freshSystem();
  assert.strictEqual(qs.acceptQuest('thom_pamphlets'), true, 'accept thom_pamphlets (minDepth 22)');
  const cur = () => qs.getActiveQuests('thom').find((q) => q.id === 'thom_pamphlets').objectives[0].current;
  globalThis.window.DUNGEON_DEPTH = 21;
  qs.onDungeonCompleted();
  assert.strictEqual(cur(), 0, 'a shallow run does not count');
  globalThis.window.DUNGEON_DEPTH = 22;
  qs.onDungeonCompleted();
  assert.strictEqual(cur(), 1, 'a depth-22 run counts');
});

test('#41 minDepth: ungated quest still advances at any depth', () => {
  const qs = freshSystem();
  qs.acceptQuest('aldric_cleanup'); // no minDepth
  const cur = () => qs.getActiveQuests('aldric').find((q) => q.id === 'aldric_cleanup').objectives[0].current;
  globalThis.window.DUNGEON_DEPTH = 1;
  qs.updateQuestProgress('kill', 'enemy', 1);
  assert.strictEqual(cur(), 1, 'ungated quest progresses at depth 1');
});

// Regression: Q6 (council_collusion_reveal, Harren "Komm mit") is a dialogue
// quest whose climax reveal (HubSceneV2._showCollusionReveal) bypasses the
// normal "Annehmen" step. It must accept-then-complete: completeQuest() guards
// on status==='active', so calling it while the quest is merely 'available'
// silently fails — the reveal plays, the player picks a choice, and nothing
// happens (no XP, no act2_open, no Act-2 transition). This mirrors the exact
// call sequence in finalize().
// Regression: branka_weapons ("Waffen fuer den Widerstand") is a craft quest.
// Each forge action must advance it via onItemCrafted -> updateQuestProgress
// ('craft','craft_item'). The bug ("bleibt auf 1") was the CraftingScene
// _craftRecipe path never calling onItemCrafted; this guards the questSystem
// side actually counts repeatedly to the required 3 (not capped at 1).
test('craft quest branka_weapons advances per onItemCrafted to 3 (not stuck at 1)', () => {
  const qs = freshSystem();
  assert.strictEqual(qs.acceptQuest('branka_weapons'), true);
  const cur = () => qs.getActiveQuests('branka').find((q) => q.id === 'branka_weapons').objectives[0].current;
  qs.onItemCrafted();
  assert.strictEqual(cur(), 1, '1 after first craft');
  qs.onItemCrafted();
  qs.onItemCrafted();
  assert.strictEqual(cur(), 3, '3 after three crafts');
  assert.strictEqual(qs.isQuestReadyToComplete('branka_weapons'), true);
  // Clamped at the requirement — further crafts don't overshoot.
  qs.onItemCrafted();
  assert.strictEqual(cur(), 3, 'clamped at required');
});

// Regression: mara_contact (Akt 2, "Die Spaeherin") was a hollow type:'dialogue'
// stub — accept auto-completed it, so the player re-talked to Mara with nothing
// in between and no real info. It now carries a real recon task (scout 3 rooms),
// driven by the existing roomManager trigger updateQuestProgress('explore','room').
// This guards both the task wiring (memory: quest-trigger audit) and that it is
// NOT auto-completed on accept.
test('Akt2 mara_contact: explore-Quest, completes after 3 cleared rooms (trigger audit)', () => {
  const qs = freshSystem();
  const def = qs.QUEST_DEFINITIONS.mara_contact;
  assert.strictEqual(def.type, 'explore', 'mara_contact must be an explore quest');
  assert.deepStrictEqual(def.objectives[0],
    { type: 'explore', target: 'room', current: 0, required: 3 });

  assert.strictEqual(qs.acceptQuest('mara_contact'), true);
  assert.strictEqual(qs.isQuestReadyToComplete('mara_contact'), false,
    'must NOT auto-complete on accept (it has a real task now)');

  // Exact tuple roomManager.markRoomCleared emits on each cleared room.
  qs.updateQuestProgress('explore', 'room', 1);
  qs.updateQuestProgress('explore', 'room', 1);
  assert.strictEqual(qs.isQuestReadyToComplete('mara_contact'), false, '2/3 not ready');
  qs.updateQuestProgress('explore', 'room', 1);
  assert.strictEqual(qs.isQuestReadyToComplete('mara_contact'), true, '3/3 ready');

  assert.strictEqual(qs.completeQuest('mara_contact'), true);
  assert.ok(qs.getCompletedQuests().some((q) => q.id === 'mara_contact'));
});

test('Q6 reveal: completeQuest alone fails while quest is only available', () => {
  const qs = freshSystem();
  assert.strictEqual(qs.completeQuest('council_collusion_reveal'), false,
    'completeQuest must no-op when the quest was never accepted');
  assert.ok(!qs.getCompletedQuests().some((q) => q.id === 'council_collusion_reveal'));
});

test('Q6 reveal: acceptQuest + completeQuest completes it and advances to Act 2', () => {
  resetStore();
  delete globalThis.window.questSystem;
  const advanced = [];
  globalThis.window.storySystem = {
    getCurrentActIndex: () => 99,
    advanceToAct: (n) => advanced.push(n)
  };
  globalThis.window.DUNGEON_DEPTH = 99;
  loadGameModule('js/questSystem.js');
  const qs = globalThis.window.questSystem;

  // finalize() sequence: accept (activates + auto-completes the dialogue
  // objective for a type:'dialogue' quest), then complete.
  assert.strictEqual(qs.acceptQuest('council_collusion_reveal'), true);
  assert.strictEqual(qs.completeQuest('council_collusion_reveal'), true);
  assert.ok(qs.getCompletedQuests().some((q) => q.id === 'council_collusion_reveal'),
    'Q6 should be completed');
  assert.ok(advanced.includes(2), 'storySystem.advanceToAct(2) must fire on Q6 completion');
  assert.strictEqual(globalThis.window._questUnlocks
    && globalThis.window._questUnlocks.act2_open, true, 'act2_open must be unlocked');
});
