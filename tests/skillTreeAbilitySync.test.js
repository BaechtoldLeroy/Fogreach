// Unit tests for Feature 060 WP03 — Erwerbs-Logik des Skill-Baums.
//
// Vertrag: Erwerb läuft AUSSCHLIESSLICH über den Skill-Baum.
//   - Neues Spiel = 0 gelernte Abilities (kein Auto-Unlock mehr).
//   - SkillTree.investPoint(Rang>=1) -> AbilitySystem.isLearned === true.
//   - SkillTree.respec() -> alle Baum-Abilities verlernt + Slots leer.
//   - SkillTree.getRespecCost() skaliert mit getSpentPoints().
//
// AbilitySystem MUSS vor SkillTree geladen werden (window.AbilitySystem muss
// zur Sync-Zeit existieren — genau die Browser-Ladereihenfolge).

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

function freshModules() {
  resetStore();
  delete globalThis.window.AbilitySystem;
  delete globalThis.window.SkillTree;
  loadGameModule('js/abilitySystem.js'); // zuerst — exponiert window.AbilitySystem
  loadGameModule('js/skillTree.js');     // danach — verdrahtet den Sync
  return { AS: globalThis.window.AbilitySystem, ST: globalThis.window.SkillTree };
}

beforeEach(() => { resetStore(); });

test('Auto-Unlock entfernt: on*-Hooks lernen keine Abilities mehr', () => {
  const { AS } = freshModules();
  assert.deepStrictEqual(AS.getLearnedAbilities(), []);
  for (let i = 0; i < 100; i++) AS.onEnemyKilled();
  AS.onWaveCompleted(20);
  AS.onBossKilled('chainMaster');
  AS.onQuestCompleted('branka_documents');
  assert.deepStrictEqual(AS.getLearnedAbilities(), [], 'kein Auto-Unlock durch Kills/Wellen/Bosse/Quests');
});

test('UNLOCK_RULES ist leer; nur die 12 Skill-Baum-Defs existieren', () => {
  const { AS } = freshModules();
  assert.deepStrictEqual(AS.UNLOCK_RULES, {});
  const ids = AS.getAllAbilityDefs().map((d) => d.id).sort();
  const expected = ['berserk', 'charge', 'cycloneStrike', 'deathBlow', 'frenzy', 'frostNova',
    'hammer', 'heilwunde', 'steelGrasp', 'teleportDash', 'twistingBlades', 'whirlwind'].sort();
  assert.deepStrictEqual(ids, expected, 'genau die 12 neuen Skills');
  // Alte IDs sind weg
  ['spinAttack', 'chargeSlash', 'dashSlash', 'daggerThrow', 'shieldBash',
   'frostnova', 'blutopfer', 'schattenschritt'].forEach((old) => {
    assert.strictEqual(AS.getAbilityDef(old), null, old + ' sollte entfernt sein');
  });
});

test('forgetAbility entfernt aus learned + räumt die Slots', () => {
  const { AS } = freshModules();
  AS.learnAbility('whirlwind', { silent: true });
  AS.setSlot('slot1', 'whirlwind');
  assert.strictEqual(AS.isEquipped('whirlwind'), true);
  assert.strictEqual(AS.forgetAbility('whirlwind'), true);
  assert.strictEqual(AS.isLearned('whirlwind'), false);
  assert.strictEqual(AS.getActiveLoadout().slot1, null, 'Slot geräumt');
  assert.strictEqual(AS.forgetAbility('whirlwind'), false, 'idempotent: zweiter Aufruf false');
  assert.strictEqual(AS.forgetAbility('doesNotExist'), false, 'unbekannte id -> false');
});

test('neues Spiel = 0 gelernt (Sync nach leerem Baum)', () => {
  const { AS } = freshModules();
  assert.deepStrictEqual(AS.getLearnedAbilities(), []);
});

test('investPoint (Rang>=1) -> AbilitySystem.isLearned === true', () => {
  const { AS, ST } = freshModules();
  ST._configureForTest({ skillPoints: 5 });
  assert.strictEqual(AS.isLearned('whirlwind'), false);
  assert.strictEqual(ST.investPoint('whirlwind', 1), true);
  assert.strictEqual(AS.isLearned('whirlwind'), true, 'Sync nach investPoint');
  assert.strictEqual(ST.getRank('whirlwind'), 1);
});

test('respec -> alle Baum-Abilities verlernt + Slots leer', () => {
  const { AS, ST } = freshModules();
  ST._configureForTest({ skillPoints: 10 });
  ST.investPoint('whirlwind', 1);
  ST.investPoint('charge', 1);
  assert.strictEqual(AS.isLearned('whirlwind'), true);
  assert.strictEqual(AS.isLearned('charge'), true);
  // ausrüsten, damit der Slot-Cleanup geprüft wird
  AS.setSlot('slot1', 'whirlwind');
  AS.setSlot('slot2', 'charge');
  ST.respec();
  assert.strictEqual(AS.isLearned('whirlwind'), false, 'nach respec verlernt');
  assert.strictEqual(AS.isLearned('charge'), false, 'nach respec verlernt');
  assert.deepStrictEqual(AS.getLearnedAbilities(), [], 'alle Baum-Abilities verlernt');
  const lo = AS.getActiveLoadout();
  assert.strictEqual(lo.slot1, null, 'Slot1 leer');
  assert.strictEqual(lo.slot2, null, 'Slot2 leer');
});

test('Mehrfach-Invest hält denselben Skill gelernt (idempotenter Sync)', () => {
  const { AS, ST } = freshModules();
  ST._configureForTest({ skillPoints: 5 });
  ST.investPoint('whirlwind', 1);
  ST.investPoint('whirlwind', 1);
  ST.investPoint('whirlwind', 1);
  assert.strictEqual(ST.getRank('whirlwind'), 3);
  assert.strictEqual(AS.isLearned('whirlwind'), true);
  assert.deepStrictEqual(AS.getLearnedAbilities(), ['whirlwind'], 'genau einmal gelernt');
});

test('getRespecCost skaliert mit getSpentPoints (100 + spent*50)', () => {
  const { ST } = freshModules();
  ST._configureForTest({});
  assert.strictEqual(ST.getSpentPoints(), 0);
  assert.strictEqual(ST.getRespecCost(), 100, '0 Punkte -> Grundkosten 100');
  ST._configureForTest({ skillPoints: 10 });
  ST.investPoint('whirlwind', 1); // spent 1
  assert.strictEqual(ST.getSpentPoints(), 1);
  assert.strictEqual(ST.getRespecCost(), 150, '1 Punkt -> 150');
  ST.investPoint('whirlwind', 1); // spent 2
  ST.investPoint('charge', 1);    // spent 3
  assert.strictEqual(ST.getSpentPoints(), 3);
  assert.strictEqual(ST.getRespecCost(), 250, '3 Punkte -> 250');
  // Ganzzahlig
  assert.strictEqual(Number.isInteger(ST.getRespecCost()), true);
});
