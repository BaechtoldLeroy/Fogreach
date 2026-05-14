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
