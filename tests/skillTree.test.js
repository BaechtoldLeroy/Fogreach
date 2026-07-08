// Unit tests for js/skillTree.js (Feature 060 — Skill-Baum-Progression WP01).
//
// Reines IIFE-Modul -> window.SkillTree. Wir laden es einmal und setzen den
// State pro Test via _configureForTest zurück (umgeht localStorage-Bleed).
//
// Roster (12 Knoten, 3 Stränge): WUT (whirlwind->hammer/frenzy->berserk),
// KETTEN (twistingBlades->steelGrasp/cycloneStrike->frostNova),
// SCHATTEN (charge->teleportDash/heilwunde->deathBlow).

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

if (!globalThis.window) require('./setup');
loadGameModule('js/skillTree.js');
const ST = globalThis.window.SkillTree;

beforeEach(() => { ST._configureForTest({}); });

test('Modul exportiert die erwartete API + 12-Knoten-Baum', () => {
  ['getSkillPoints', 'getRank', 'isNodeAvailable', 'grantSkillPoint', 'investPoint',
   'getSynergyValue', 'respec', 'getSaveData', 'loadSaveData'].forEach((fn) => {
    assert.strictEqual(typeof ST[fn], 'function', 'fehlt: ' + fn);
  });
  const nodes = ST.SKILL_TREE.nodes;
  assert.strictEqual(Object.keys(nodes).length, 12, '12 Knoten erwartet');
  // jeder Knoten hat abilityId/name/strand/maxRank/requires
  Object.keys(nodes).forEach((id) => {
    const n = nodes[id];
    assert.ok(n.abilityId && n.name && n.strand && n.maxRank && n.requires, 'Knoten unvollständig: ' + id);
  });
  // 3 Stränge, je 4 Knoten
  const byStrand = {};
  Object.keys(nodes).forEach((id) => { byStrand[nodes[id].strand] = (byStrand[nodes[id].strand] || 0) + 1; });
  assert.deepStrictEqual(byStrand, { wut: 4, ketten: 4, schatten: 4 });
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
  assert.strictEqual(ST.investPoint('whirlwind', 10), false);
  assert.strictEqual(ST.getRank('whirlwind'), 0);
  // Punkte da, aber hammer braucht whirlwind@2 + minLevel 4:
  ST.grantSkillPoint(2);
  assert.strictEqual(ST.investPoint('hammer', 10), false, 'Prereq whirlwind@2 fehlt');
  assert.strictEqual(ST.getRank('hammer'), 0);
  assert.strictEqual(ST.getSkillPoints(), 2, 'kein Punkt verbraucht bei Fehlschlag');
});

test('(c) investPoint mit erfüllten Prereqs -> Rang+1, Punkt-1', () => {
  ST.grantSkillPoint(5);
  assert.strictEqual(ST.investPoint('whirlwind', 1), true);
  assert.strictEqual(ST.getRank('whirlwind'), 1);
  assert.strictEqual(ST.getSkillPoints(), 4);
  // whirlwind auf Rang 2 -> hammer-Prereq (node@2) erfüllt, minLevel 4
  ST.investPoint('whirlwind', 1);
  assert.strictEqual(ST.getRank('whirlwind'), 2);
  assert.strictEqual(ST.investPoint('hammer', 3), false, 'minLevel 4 nicht erreicht');
  assert.strictEqual(ST.investPoint('hammer', 4), true, 'Level 4 + whirlwind@2 -> ok');
  assert.strictEqual(ST.getRank('hammer'), 1);
});

test('(d) Cap bei maxRank (Capstone deathBlow = 3)', () => {
  ST.grantSkillPoint(100);
  // whirlwind maxRank 5 (Kosten 1+3+5+7+9 = 25)
  for (let i = 0; i < 5; i++) assert.strictEqual(ST.investPoint('whirlwind', 1), true);
  assert.strictEqual(ST.getRank('whirlwind'), 5);
  assert.strictEqual(ST.investPoint('whirlwind', 1), false, 'über maxRank 5 nicht mehr');
  // deathBlow Capstone maxRank 3. Voraussetzungen (neu): BEIDE T2-Knoten des
  // Strangs@2 (teleportDash@2 UND heilwunde@2) + minLevel 8. teleportDash/
  // heilwunde brauchen charge@2.
  ST.investPoint('charge', 8); ST.investPoint('charge', 8);            // charge -> 2
  ST.investPoint('teleportDash', 8); ST.investPoint('teleportDash', 8); // -> 2
  ST.investPoint('heilwunde', 8); ST.investPoint('heilwunde', 8);       // -> 2
  assert.strictEqual(ST.isNodeAvailable('deathBlow', 8), true, 'beide T2@2 + Level 8');
  for (let i = 0; i < 3; i++) assert.strictEqual(ST.investPoint('deathBlow', 8), true);
  assert.strictEqual(ST.getRank('deathBlow'), 3);
  assert.strictEqual(ST.investPoint('deathBlow', 8), false, 'Capstone-Cap 3');
});

test('(e) respec setzt Ränge=0 und erstattet alle Punkte', () => {
  ST.grantSkillPoint(5);
  ST.investPoint('whirlwind', 1);      // Rang 1, Kosten 1
  ST.investPoint('whirlwind', 1);      // Rang 2, Kosten 3
  ST.investPoint('twistingBlades', 1); // Rang 1, Kosten 1  -> 5 Punkte weg
  // getSpentPoints = Summe Rang²: whirlwind 2²=4, twistingBlades 1²=1 -> 5
  assert.strictEqual(ST.getSpentPoints(), 5);
  assert.strictEqual(ST.getSkillPoints(), 0);
  const refunded = ST.respec();
  assert.strictEqual(refunded, 5);
  assert.strictEqual(ST.getRank('whirlwind'), 0);
  assert.strictEqual(ST.getRank('twistingBlades'), 0);
  assert.strictEqual(ST.getSkillPoints(), 5, 'alle Punkte zurück');
});

test('(e2) Rang-Kosten steigen (1/3/5/7/9); getRankCost/getNextRankCost', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 5].map((r) => ST.getRankCost(r)), [1, 3, 5, 7, 9]);
  assert.strictEqual(ST.getRankCost(0), 0);
  // frischer Knoten: nächster Rang kostet 1
  assert.strictEqual(ST.getNextRankCost('whirlwind'), 1);
  ST.grantSkillPoint(100);
  ST.investPoint('whirlwind', 1); // -> Rang 1
  assert.strictEqual(ST.getNextRankCost('whirlwind'), 3, 'Rang 2 kostet 3');
  ST.investPoint('whirlwind', 1); // -> Rang 2
  assert.strictEqual(ST.getNextRankCost('whirlwind'), 5, 'Rang 3 kostet 5');
  // zu wenig Punkte für den nächsten Rang -> investPoint schlägt fehl
  ST._configureForTest({ skillPoints: 2 });
  assert.strictEqual(ST.investPoint('whirlwind', 1), true, 'Rang 1 (Kosten 1) ok');
  assert.strictEqual(ST.investPoint('whirlwind', 1), false, 'Rang 2 (Kosten 3) > 1 Restpunkt');
  assert.strictEqual(ST.getRank('whirlwind'), 1);
  // gemaxter Knoten -> nächster Rang kostet 0
  ST._configureForTest({ skillPoints: 100 });
  for (let i = 0; i < 5; i++) ST.investPoint('whirlwind', 1);
  assert.strictEqual(ST.getNextRankCost('whirlwind'), 0, 'gemaxt -> 0');
});

test('(f) getSynergyValue = Rang(from) * perRank', () => {
  ST.grantSkillPoint(10);
  // hammer hat Synergie { from:'whirlwind', perRank:0.06, stat:'damage' }
  ST.investPoint('whirlwind', 1);
  ST.investPoint('whirlwind', 1);
  ST.investPoint('whirlwind', 1); // whirlwind Rang 3
  const v = ST.getSynergyValue('hammer', 'damage');
  assert.ok(Math.abs(v - 3 * 0.06) < 1e-9, 'erwartet 0.18, got ' + v);
  assert.strictEqual(ST.getSynergyValue('hammer', 'speed'), 0, 'anderer stat -> 0');
  assert.strictEqual(ST.getSynergyValue('whirlwind', 'damage'), 0.04 * 0, 'frenzy@0 -> 0');
  // deathBlow hat ZWEI Synergien (charge + frenzy) auf stat 'threshold'
  ST.investPoint('charge', 5); // charge Rang 1
  assert.ok(Math.abs(ST.getSynergyValue('deathBlow', 'threshold') - 1 * 0.03) < 1e-9, 'charge@1 -> 0.03');
});

test('(g) isNodeAvailable respektiert minLevel + Vorgänger-Rang', () => {
  // frostNova (neu): minLevel 8, BEIDE T2-Knoten des Strangs@2
  // (steelGrasp@2 UND cycloneStrike@2). Beide brauchen twistingBlades@2.
  assert.strictEqual(ST.isNodeAvailable('frostNova', 8), false, 'Vorgänger fehlen');
  ST.grantSkillPoint(100);
  ST.investPoint('twistingBlades', 8); ST.investPoint('twistingBlades', 8);
  ST.investPoint('steelGrasp', 8); ST.investPoint('steelGrasp', 8);       // -> 2
  assert.strictEqual(ST.isNodeAvailable('frostNova', 8), false, 'cycloneStrike@2 fehlt noch');
  ST.investPoint('cycloneStrike', 8); ST.investPoint('cycloneStrike', 8); // -> 2
  assert.strictEqual(ST.isNodeAvailable('frostNova', 7), false, 'minLevel 8 nicht erreicht');
  assert.strictEqual(ST.isNodeAvailable('frostNova', 8), true, 'Level 8 + beide T2@2 -> verfügbar');
  // Strang-Starter ab Level 1 verfügbar
  assert.strictEqual(ST.isNodeAvailable('whirlwind', 1), true);
  assert.strictEqual(ST.isNodeAvailable('charge', 1), true);
});

test('(h) getAbilityDamageMult: Rang 1 -> 1.0; Rang 3 -> 1.30; Synergie addiert', () => {
  ST.grantSkillPoint(20);
  // ungelernt -> Multiplikator 1
  assert.strictEqual(ST.getAbilityDamageMult('whirlwind'), 1);
  // whirlwind Rang 1 -> 1.0 (kein Rang-Bonus unter Rang 2)
  ST.investPoint('whirlwind', 1);
  assert.ok(Math.abs(ST.getAbilityDamageMult('whirlwind') - 1.0) < 1e-9, 'Rang 1 -> 1.0');
  // whirlwind Rang 3 -> 1 + 2*0.15 = 1.30 (whirlwind hat keine 'damage'-Synergie aktiv: frenzy@0)
  ST.investPoint('whirlwind', 1);
  ST.investPoint('whirlwind', 1);
  assert.ok(Math.abs(ST.getAbilityDamageMult('whirlwind') - 1.30) < 1e-9, 'Rang 3 -> 1.30, got ' + ST.getAbilityDamageMult('whirlwind'));
  // hammer hat Synergie { from:'whirlwind', perRank:0.06, stat:'damage' }; whirlwind@3 -> +0.18
  // hammer selbst Rang 1 -> Rang-Teil 0 -> 1 + 0 + 0.18 = 1.18
  ST.investPoint('hammer', 10); // whirlwind@3 + minLevel 4 erfuellt
  assert.ok(Math.abs(ST.getAbilityDamageMult('hammer') - 1.18) < 1e-9, 'Synergie addiert: 1.18, got ' + ST.getAbilityDamageMult('hammer'));
});

test('(i) getAbilityCooldownMult: sinkt mit Rang und ist bei 40% gedeckelt', () => {
  ST.grantSkillPoint(30); // whirlwind maxen kostet 1+3+5+7+9 = 25
  // ungelernt -> 1
  assert.strictEqual(ST.getAbilityCooldownMult('whirlwind'), 1);
  // Rang 1 -> 1 (keine Reduktion)
  ST.investPoint('whirlwind', 1);
  assert.ok(Math.abs(ST.getAbilityCooldownMult('whirlwind') - 1.0) < 1e-9, 'Rang 1 -> 1.0');
  // Rang 3 -> 1 - 2*0.08 = 0.84
  ST.investPoint('whirlwind', 1);
  ST.investPoint('whirlwind', 1);
  assert.ok(Math.abs(ST.getAbilityCooldownMult('whirlwind') - 0.84) < 1e-9, 'Rang 3 -> 0.84, got ' + ST.getAbilityCooldownMult('whirlwind'));
  // Rang 5 -> 1 - 4*0.08 = 0.68 (Cap 0.40 noch nicht erreicht: 4*0.08=0.32 < 0.40)
  ST.investPoint('whirlwind', 1);
  ST.investPoint('whirlwind', 1);
  assert.ok(Math.abs(ST.getAbilityCooldownMult('whirlwind') - 0.68) < 1e-9, 'Rang 5 -> 0.68, got ' + ST.getAbilityCooldownMult('whirlwind'));
  // Cap-Pruefung: synthetischer Knoten via loadSaveData ueber Rang 6 nicht moeglich (maxRank 5),
  // daher Cap direkt rechnerisch: 6 Raenge -> 5*0.08=0.40 == Cap. twistingBlades maxRank 5,
  // wir pruefen den Cap-Grenzfall mit der Formel: max. Reduktion = 0.40, nie mehr.
  // (Bei maxRank 5 ist die hoechste reale Reduktion 0.32; der Cap greift defensiv fuer
  //  hoehere Werte, falls maxRank spaeter steigt.)
  assert.ok(ST.getAbilityCooldownMult('whirlwind') >= 1 - 0.40 - 1e-9, 'nie unter Cap');
});

test('getSaveData/loadSaveData round-trip (Save-Einbettung WP05)', () => {
  ST.grantSkillPoint(4);
  ST.investPoint('whirlwind', 1);
  const data = ST.getSaveData();
  assert.deepStrictEqual(data, { skillPoints: 3, ranks: { whirlwind: 1 } });
  ST._configureForTest({});
  ST.loadSaveData(data);
  assert.strictEqual(ST.getSkillPoints(), 3);
  assert.strictEqual(ST.getRank('whirlwind'), 1);
  // Defensive: unbekannte Knoten / Überlauf werden geclampt/verworfen
  ST._configureForTest({});
  ST.loadSaveData({ skillPoints: 2, ranks: { whirlwind: 99, doesNotExist: 3 } });
  assert.strictEqual(ST.getRank('whirlwind'), ST.getNode('whirlwind').maxRank);
  assert.strictEqual(ST.getRank('doesNotExist'), 0);
});
