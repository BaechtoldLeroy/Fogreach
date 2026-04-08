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
