// Unit tests for js/skillTree.js (Feature 060 — Skill-Baum-Progression WP01).
//
// Reines IIFE-Modul -> window.SkillTree. Wir laden es einmal und setzen den
// State pro Test via _configureForTest zurück (umgeht localStorage-Bleed).

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

if (!globalThis.window) require('./setup');
loadGameModule('js/skillTree.js');
const ST = globalThis.window.SkillTree;

beforeEach(() => { ST._configureForTest({}); });

test('Modul exportiert die erwartete API + SKILL_TREE', () => {
  ['getSkillPoints', 'getRank', 'isNodeAvailable', 'grantSkillPoint', 'investPoint',
   'getSynergyValue', 'respec', 'getSaveData', 'loadSaveData'].forEach((fn) => {
    assert.strictEqual(typeof ST[fn], 'function', 'fehlt: ' + fn);
  });
  assert.ok(ST.SKILL_TREE && ST.SKILL_TREE.nodes && Object.keys(ST.SKILL_TREE.nodes).length >= 9);
});

test('(a) grantSkillPoint erhöht die Punkte (default +1)', () => {
  assert.strictEqual(ST.getSkillPoints(), 0);
  ST.grantSkillPoint();
  assert.strictEqual(ST.getSkillPoints(), 1);
  ST.grantSkillPoint(3);
  assert.strictEqual(ST.getSkillPoints(), 4);
  ST.grantSkillPoint(0);   // no-op
  ST.grantSkillPoint(-5);  // abgelehnt
  assert.strictEqual(ST.getSkillPoints(), 4);
});

test('(b) investPoint ohne Punkte ODER ohne erfüllte Prereqs -> false, kein Rang', () => {
  // Keine Punkte:
  assert.strictEqual(ST.investPoint('spinAttack', 10), false);
  assert.strictEqual(ST.getRank('spinAttack'), 0);
  // Punkte da, aber chargeSlash braucht spinAttack@2 + minLevel 3:
  ST.grantSkillPoint(2);
  assert.strictEqual(ST.investPoint('chargeSlash', 10), false, 'Prereq spinAttack@2 fehlt');
  assert.strictEqual(ST.getRank('chargeSlash'), 0);
  assert.strictEqual(ST.getSkillPoints(), 2, 'kein Punkt verbraucht bei Fehlschlag');
});

test('(c) investPoint mit erfüllten Prereqs -> Rang+1, Punkt-1', () => {
  ST.grantSkillPoint(5);
  assert.strictEqual(ST.investPoint('spinAttack', 1), true);
  assert.strictEqual(ST.getRank('spinAttack'), 1);
  assert.strictEqual(ST.getSkillPoints(), 4);
  // spinAttack auf Rang 2 -> chargeSlash-Prereq (node@2) erfüllt, minLevel 3
  ST.investPoint('spinAttack', 1);
  assert.strictEqual(ST.getRank('spinAttack'), 2);
  assert.strictEqual(ST.investPoint('chargeSlash', 2), false, 'minLevel 3 nicht erreicht');
  assert.strictEqual(ST.investPoint('chargeSlash', 3), true, 'Level 3 + spinAttack@2 -> ok');
  assert.strictEqual(ST.getRank('chargeSlash'), 1);
});

test('(d) Cap bei maxRank', () => {
  ST.grantSkillPoint(20);
  const max = ST.getNode('spinAttack').maxRank;
  for (let i = 0; i < max; i++) assert.strictEqual(ST.investPoint('spinAttack', 1), true);
  assert.strictEqual(ST.getRank('spinAttack'), max);
  assert.strictEqual(ST.investPoint('spinAttack', 1), false, 'über maxRank nicht mehr investierbar');
  assert.strictEqual(ST.getRank('spinAttack'), max);
});

test('(e) respec setzt Ränge=0 und erstattet alle Punkte', () => {
  ST.grantSkillPoint(5);
  ST.investPoint('spinAttack', 1);
  ST.investPoint('spinAttack', 1);
  ST.investPoint('daggerThrow', 1);
  assert.strictEqual(ST.getSpentPoints(), 3);
  assert.strictEqual(ST.getSkillPoints(), 2);
  const refunded = ST.respec();
  assert.strictEqual(refunded, 3);
  assert.strictEqual(ST.getRank('spinAttack'), 0);
  assert.strictEqual(ST.getRank('daggerThrow'), 0);
  assert.strictEqual(ST.getSkillPoints(), 5, 'alle Punkte zurück');
});

test('(f) getSynergyValue = Rang(from) * perRank', () => {
  ST.grantSkillPoint(10);
  // chargeSlash hat Synergie { from:'spinAttack', perRank:0.08, stat:'damage' }
  ST.investPoint('spinAttack', 1);
  ST.investPoint('spinAttack', 1);
  ST.investPoint('spinAttack', 1); // spinAttack Rang 3
  const v = ST.getSynergyValue('chargeSlash', 'damage');
  assert.ok(Math.abs(v - 3 * 0.08) < 1e-9, 'erwartet 0.24, got ' + v);
  assert.strictEqual(ST.getSynergyValue('chargeSlash', 'speed'), 0, 'anderer stat -> 0');
  assert.strictEqual(ST.getSynergyValue('spinAttack', 'damage'), 0, 'ohne Synergie -> 0');
});

test('(g) isNodeAvailable respektiert minLevel + Vorgänger-Rang', () => {
  // frostnova: minLevel 6, node chargeSlash@1
  assert.strictEqual(ST.isNodeAvailable('frostnova', 6), false, 'Vorgänger chargeSlash fehlt');
  ST.grantSkillPoint(10);
  ST.investPoint('spinAttack', 1); ST.investPoint('spinAttack', 1);
  ST.investPoint('chargeSlash', 3); // chargeSlash Rang 1
  assert.strictEqual(ST.isNodeAvailable('frostnova', 5), false, 'minLevel 6 nicht erreicht');
  assert.strictEqual(ST.isNodeAvailable('frostnova', 6), true, 'Level 6 + chargeSlash@1 -> verfügbar');
  // Tier-0 ist ab Level 1 verfügbar
  assert.strictEqual(ST.isNodeAvailable('spinAttack', 1), true);
});

test('getSaveData/loadSaveData round-trip (Save-Einbettung WP05)', () => {
  ST.grantSkillPoint(4);
  ST.investPoint('spinAttack', 1);
  const data = ST.getSaveData();
  assert.deepStrictEqual(data, { skillPoints: 3, ranks: { spinAttack: 1 } });
  ST._configureForTest({});
  ST.loadSaveData(data);
  assert.strictEqual(ST.getSkillPoints(), 3);
  assert.strictEqual(ST.getRank('spinAttack'), 1);
  // Defensive: unbekannte Knoten / Überlauf werden geclampt/verworfen
  ST._configureForTest({});
  ST.loadSaveData({ skillPoints: 2, ranks: { spinAttack: 99, doesNotExist: 3 } });
  assert.strictEqual(ST.getRank('spinAttack'), ST.getNode('spinAttack').maxRank);
  assert.strictEqual(ST.getRank('doesNotExist'), 0);
});
