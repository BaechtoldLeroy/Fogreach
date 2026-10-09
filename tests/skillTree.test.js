// Unit tests for js/skillTree.js (Feature 060 — Skill-Baum-Progression WP01).
//
// Reines IIFE-Modul -> window.SkillTree. Wir laden es einmal und setzen den
// State pro Test via _configureForTest zurück (umgeht localStorage-Bleed).
//
// Roster (12 Knoten, 3 Stränge) seit #175: WUT (hammer->frenzy/berserk->whirlwind),
// KETTEN (steelGrasp->twistingBlades/cycloneStrike->frostNova),
// SCHATTEN (charge->teleportDash/heilwunde->deathBlow).
// Stufen: Einstieg Lv 1, Mitte Lv 9, Kroenung Lv 20; Passive Lv 5/14/26.
// Straenge oeffnen gestaffelt: erster frei ab Lv 1, zweiter ab 6, dritter ab 12.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

if (!globalThis.window) require('./setup');
loadGameModule('js/skillTree.js');
const ST = globalThis.window.SkillTree;

beforeEach(() => { ST._configureForTest({}); });

test('Modul exportiert die erwartete API + 21-Knoten-Baum (12 aktiv, 9 passiv)', () => {
  ['getSkillPoints', 'getRank', 'isNodeAvailable', 'grantSkillPoint', 'investPoint',
   'getSynergyValue', 'respec', 'getSaveData', 'loadSaveData'].forEach((fn) => {
    assert.strictEqual(typeof ST[fn], 'function', 'fehlt: ' + fn);
  });
  const nodes = ST.SKILL_TREE.nodes;
  // #93: 12 aktive Knoten + 9 passive.
  assert.strictEqual(Object.keys(nodes).length, 21, '21 Knoten erwartet');
  const aktive = Object.keys(nodes).filter((id) => !nodes[id].passiv);
  const passive = Object.keys(nodes).filter((id) => nodes[id].passiv);
  assert.strictEqual(aktive.length, 12, '12 aktive Knoten');
  assert.strictEqual(passive.length, 9, '9 passive Knoten');
  // Aktive haben eine abilityId, passive ausdruecklich nicht.
  Object.keys(nodes).forEach((id) => {
    const n = nodes[id];
    assert.ok(n.name && n.strand && n.maxRank && n.requires, 'Knoten unvollständig: ' + id);
    if (n.passiv) {
      assert.strictEqual(n.abilityId, undefined, 'Passiv darf keine abilityId haben: ' + id);
    } else {
      assert.ok(n.abilityId, 'Aktiver Knoten ohne abilityId: ' + id);
    }
  });
  // 3 Stränge, je 7 Knoten (4 aktiv + 3 passiv) — #93 verteilt die Passiven
  // gleichmässig, damit kein Strang bevorzugt wird.
  const byStrand = {};
  Object.keys(nodes).forEach((id) => { byStrand[nodes[id].strand] = (byStrand[nodes[id].strand] || 0) + 1; });
  assert.deepStrictEqual(byStrand, { wut: 7, ketten: 7, schatten: 7 });
  const passivProStrang = {};
  Object.keys(nodes).forEach((id) => {
    if (nodes[id].passiv) passivProStrang[nodes[id].strand] = (passivProStrang[nodes[id].strand] | 0) + 1;
  });
  assert.deepStrictEqual(passivProStrang, { wut: 3, ketten: 3, schatten: 3 });
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
  assert.strictEqual(ST.investPoint('hammer', 10), false);
  assert.strictEqual(ST.getRank('hammer'), 0);
  // Punkte da, aber frenzy braucht hammer@2 + minLevel 9:
  ST.grantSkillPoint(2);
  assert.strictEqual(ST.investPoint('frenzy', 10), false, 'Prereq hammer@2 fehlt');
  assert.strictEqual(ST.getRank('frenzy'), 0);
  assert.strictEqual(ST.getSkillPoints(), 2, 'kein Punkt verbraucht bei Fehlschlag');
});

test('(c) investPoint mit erfüllten Prereqs -> Rang+1, Punkt-1', () => {
  ST.grantSkillPoint(5);
  assert.strictEqual(ST.investPoint('hammer', 1), true);
  assert.strictEqual(ST.getRank('hammer'), 1);
  assert.strictEqual(ST.getSkillPoints(), 4);
  // hammer auf Rang 2 -> frenzy-Prereq (node@2) erfüllt, minLevel 9
  ST.investPoint('hammer', 1);
  assert.strictEqual(ST.getRank('hammer'), 2);
  assert.strictEqual(ST.investPoint('frenzy', 8), false, 'minLevel 9 nicht erreicht');
  assert.strictEqual(ST.investPoint('frenzy', 9), true, 'Level 9 + hammer@2 -> ok');
  assert.strictEqual(ST.getRank('frenzy'), 1);
});

test('(d) Cap bei maxRank (Kroenung deathBlow = 3)', () => {
  ST.grantSkillPoint(100);
  // hammer maxRank 5 (Kosten 1+3+5+7+9 = 25)
  for (let i = 0; i < 5; i++) assert.strictEqual(ST.investPoint('hammer', 1), true);
  assert.strictEqual(ST.getRank('hammer'), 5);
  assert.strictEqual(ST.investPoint('hammer', 1), false, 'über maxRank 5 nicht mehr');
  // deathBlow: BEIDE Mitten@2 (teleportDash@2 UND heilwunde@2) + minLevel 20.
  ST.investPoint('charge', 20); ST.investPoint('charge', 20);            // charge -> 2
  ST.investPoint('teleportDash', 20); ST.investPoint('teleportDash', 20); // -> 2
  ST.investPoint('heilwunde', 20); ST.investPoint('heilwunde', 20);       // -> 2
  assert.strictEqual(ST.isNodeAvailable('deathBlow', 19), false, 'Level 19 reicht nicht');
  assert.strictEqual(ST.isNodeAvailable('deathBlow', 20), true, 'beide Mitten@2 + Level 20');
  for (let i = 0; i < 3; i++) assert.strictEqual(ST.investPoint('deathBlow', 20), true);
  assert.strictEqual(ST.getRank('deathBlow'), 3);
  assert.strictEqual(ST.investPoint('deathBlow', 20), false, 'Kroenung-Cap 3');
});

test('(e) respec setzt Ränge=0 und erstattet alle Punkte', () => {
  ST.grantSkillPoint(5);
  ST.investPoint('hammer', 6);      // Rang 1, Kosten 1
  ST.investPoint('hammer', 6);      // Rang 2, Kosten 3
  ST.investPoint('steelGrasp', 6);  // zweiter Strang ab Lv 6: Rang 1, Kosten 1 -> 5 Punkte weg
  assert.strictEqual(ST.getSpentPoints(), 5);
  assert.strictEqual(ST.getSkillPoints(), 0);
  const refunded = ST.respec();
  assert.strictEqual(refunded, 5);
  assert.strictEqual(ST.getRank('hammer'), 0);
  assert.strictEqual(ST.getRank('steelGrasp'), 0);
  assert.strictEqual(ST.getSkillPoints(), 5, 'alle Punkte zurück');
});

test('(e2) Rang-Kosten steigen (1/3/5/7/9); getRankCost/getNextRankCost', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 5].map((r) => ST.getRankCost(r)), [1, 3, 5, 7, 9]);
  assert.strictEqual(ST.getRankCost(0), 0);
  assert.strictEqual(ST.getNextRankCost('hammer'), 1);
  ST.grantSkillPoint(100);
  ST.investPoint('hammer', 1); // -> Rang 1
  assert.strictEqual(ST.getNextRankCost('hammer'), 3, 'Rang 2 kostet 3');
  ST.investPoint('hammer', 1); // -> Rang 2
  assert.strictEqual(ST.getNextRankCost('hammer'), 5, 'Rang 3 kostet 5');
  ST._configureForTest({ skillPoints: 2 });
  assert.strictEqual(ST.investPoint('hammer', 1), true, 'Rang 1 (Kosten 1) ok');
  assert.strictEqual(ST.investPoint('hammer', 1), false, 'Rang 2 (Kosten 3) > 1 Restpunkt');
  assert.strictEqual(ST.getRank('hammer'), 1);
  ST._configureForTest({ skillPoints: 100 });
  for (let i = 0; i < 5; i++) ST.investPoint('hammer', 1);
  assert.strictEqual(ST.getNextRankCost('hammer'), 0, 'gemaxt -> 0');
});

test('(f) getSynergyValue = Rang(from) * perRank', () => {
  ST.grantSkillPoint(20);
  // berserk hat Synergie { from:'hammer', perRank:0.05, stat:'buff' }
  ST.investPoint('hammer', 1); ST.investPoint('hammer', 1); ST.investPoint('hammer', 1); // Rang 3
  const v = ST.getSynergyValue('berserk', 'buff');
  assert.ok(Math.abs(v - 3 * 0.05) < 1e-9, 'erwartet 0.15, got ' + v);
  assert.strictEqual(ST.getSynergyValue('berserk', 'damage'), 0, 'anderer stat -> 0');
  assert.strictEqual(ST.getSynergyValue('whirlwind', 'damage'), 0, 'frenzy@0 -> 0');
  // deathBlow hat ZWEI Synergien (charge + frenzy) auf stat 'threshold'
  ST.investPoint('charge', 6); // zweiter Strang ab Lv 6: charge Rang 1
  assert.ok(Math.abs(ST.getSynergyValue('deathBlow', 'threshold') - 1 * 0.03) < 1e-9, 'charge@1 -> 0.03');
});

test('(g) isNodeAvailable respektiert minLevel + Vorgänger-Rang', () => {
  // frostNova: minLevel 20, BEIDE Mitten@2 (twistingBlades@2 UND cycloneStrike@2).
  assert.strictEqual(ST.isNodeAvailable('frostNova', 20), false, 'Vorgänger fehlen');
  ST.grantSkillPoint(100);
  ST.investPoint('steelGrasp', 20); ST.investPoint('steelGrasp', 20);
  ST.investPoint('twistingBlades', 20); ST.investPoint('twistingBlades', 20); // -> 2
  assert.strictEqual(ST.isNodeAvailable('frostNova', 20), false, 'cycloneStrike@2 fehlt noch');
  ST.investPoint('cycloneStrike', 20); ST.investPoint('cycloneStrike', 20);   // -> 2
  assert.strictEqual(ST.isNodeAvailable('frostNova', 19), false, 'minLevel 20 nicht erreicht');
  assert.strictEqual(ST.isNodeAvailable('frostNova', 20), true, 'Level 20 + beide Mitten@2 -> verfügbar');
  // Der Einstieg des ersten Strangs ab Level 1 (frischer Baum)
  ST._configureForTest({});
  assert.strictEqual(ST.isNodeAvailable('hammer', 1), true);
  assert.strictEqual(ST.isNodeAvailable('charge', 1), true);
  assert.strictEqual(ST.isNodeAvailable('steelGrasp', 1), true);
});

test('(h) getAbilityDamageMult: Rang 1 -> 1.0; Rang 3 -> 1.30; Synergie addiert', () => {
  ST.grantSkillPoint(40);
  assert.strictEqual(ST.getAbilityDamageMult('steelGrasp'), 1);
  ST.investPoint('steelGrasp', 9);
  assert.ok(Math.abs(ST.getAbilityDamageMult('steelGrasp') - 1.0) < 1e-9, 'Rang 1 -> 1.0');
  ST.investPoint('steelGrasp', 9); ST.investPoint('steelGrasp', 9);
  assert.ok(Math.abs(ST.getAbilityDamageMult('steelGrasp') - 1.30) < 1e-9, 'Rang 3 -> 1.30, got ' + ST.getAbilityDamageMult('steelGrasp'));
  // steelGrasp hat Synergie { from:'cycloneStrike', perRank:0.08, stat:'damage' }; cycloneStrike@1 -> +0.08
  ST.investPoint('cycloneStrike', 9);
  assert.ok(Math.abs(ST.getAbilityDamageMult('steelGrasp') - 1.38) < 1e-9, 'Synergie addiert: 1.38, got ' + ST.getAbilityDamageMult('steelGrasp'));
});

test('(i) getAbilityCooldownMult: sinkt mit Rang und ist bei 50% gedeckelt', () => {
  ST.grantSkillPoint(30); // hammer maxen kostet 1+3+5+7+9 = 25
  assert.strictEqual(ST.getAbilityCooldownMult('hammer'), 1);
  ST.investPoint('hammer', 1);
  assert.ok(Math.abs(ST.getAbilityCooldownMult('hammer') - 1.0) < 1e-9, 'Rang 1 -> 1.0');
  ST.investPoint('hammer', 1); ST.investPoint('hammer', 1);
  assert.ok(Math.abs(ST.getAbilityCooldownMult('hammer') - 0.76) < 1e-9, 'Rang 3 -> 0.76, got ' + ST.getAbilityCooldownMult('hammer'));
  ST.investPoint('hammer', 1); ST.investPoint('hammer', 1);
  assert.ok(Math.abs(ST.getAbilityCooldownMult('hammer') - 0.52) < 1e-9, 'Rang 5 -> 0.52, got ' + ST.getAbilityCooldownMult('hammer'));
  assert.ok(ST.getAbilityCooldownMult('hammer') >= 1 - 0.50 - 1e-9, 'nie unter Cap');
});

test('getSaveData/loadSaveData round-trip (Save-Einbettung WP05)', () => {
  ST.grantSkillPoint(4);
  ST.investPoint('hammer', 1);
  const data = ST.getSaveData();
  assert.deepStrictEqual(data, { skillPoints: 3, ranks: { hammer: 1 } });
  ST._configureForTest({});
  ST.loadSaveData(data);
  assert.strictEqual(ST.getSkillPoints(), 3);
  assert.strictEqual(ST.getRank('hammer'), 1);
  ST._configureForTest({});
  ST.loadSaveData({ skillPoints: 2, ranks: { hammer: 99, doesNotExist: 3 } });
  assert.strictEqual(ST.getRank('hammer'), ST.getNode('hammer').maxRank);
  assert.strictEqual(ST.getRank('doesNotExist'), 0);
});

// ---------------------------------------------------------------------------
// #175 — Stufen und Straenge
// ---------------------------------------------------------------------------

test('#175: die starken Angriffe stehen hinten — Wirbelwind ist die Wut-Kroenung', () => {
  const N = ST.SKILL_TREE.nodes;
  assert.strictEqual(N.whirlwind.requires.minLevel, 20);
  assert.strictEqual(N.whirlwind.maxRank, 3);
  assert.strictEqual(N.hammer.requires.minLevel, 1);
  assert.strictEqual(N.steelGrasp.requires.minLevel, 1);
  assert.strictEqual(N.charge.requires.minLevel, 1);
  assert.deepStrictEqual(['hammer', 'steelGrasp', 'charge'].map((id) => ST.istEinstieg(id)), [true, true, true]);
  assert.strictEqual(ST.istEinstieg('whirlwind'), false);
});

test('#175: die Stufen liegen bei 1 / 5 / 9 / 14 / 20 / 26', () => {
  const stufen = new Set(Object.values(ST.SKILL_TREE.nodes).map((n) => n.requires.minLevel));
  assert.deepStrictEqual([...stufen].sort((a, b) => a - b), [1, 5, 9, 14, 20, 26]);
});

test('#175: der erste Strang ist frei, der zweite ab Lv 6, der dritte ab Lv 12', () => {
  ST.grantSkillPoint(10);
  // Jeder Einstieg ist zu Beginn waehlbar — keiner wird bevorzugt.
  assert.ok(['hammer', 'steelGrasp', 'charge'].every((id) => ST.isNodeAvailable(id, 1)));
  assert.strictEqual(ST.investPoint('charge', 1), true, 'erster Strang frei gewaehlt');
  assert.strictEqual(ST.strangStufe('schatten'), 0, 'geoeffnet');
  assert.strictEqual(ST.strangStufe('wut'), 6);
  assert.strictEqual(ST.investPoint('hammer', 5), false, 'zweiter Strang vor Lv 6');
  assert.strictEqual(ST.investPoint('hammer', 6), true, 'zweiter Strang ab Lv 6');
  assert.strictEqual(ST.strangStufe('ketten'), 12);
  assert.strictEqual(ST.investPoint('steelGrasp', 11), false, 'dritter Strang vor Lv 12');
  assert.strictEqual(ST.investPoint('steelGrasp', 12), true, 'dritter Strang ab Lv 12');
  // In einen offenen Strang darf man weiter investieren, auch unter der Stufe.
  assert.strictEqual(ST.investPoint('charge', 1), true);
});

test('#175: nach dem Zuruecksetzen zaehlt die Staffel neu', () => {
  ST.grantSkillPoint(10);
  ST.investPoint('hammer', 6); ST.investPoint('steelGrasp', 6);
  assert.strictEqual(ST.strangStufe('schatten'), 12);
  ST.respec();
  assert.strictEqual(ST.strangStufe('schatten'), 1);
});

test('#175: ein alter Spielstand mit drei offenen Straengen behaelt sie', () => {
  ST.loadSaveData({ skillPoints: 0, ranks: { whirlwind: 2, twistingBlades: 1, charge: 1 } });
  assert.strictEqual(ST.getRank('whirlwind'), 2, 'gelernter Rang bleibt');
  assert.strictEqual(ST.getRank('twistingBlades'), 1);
  assert.deepStrictEqual(ST.geoeffneteStraenge().sort(), ['ketten', 'schatten', 'wut']);
});

// ---------------------------------------------------------------------------
// #93 — passive Knoten
// ---------------------------------------------------------------------------
// Die neun IDs sind NICHT frei waehlbar: elf Hooks in enemy.js / player.js /
// main.js fragen genau diese Namen ab (Shim aus #94, skillTree.js). Heisst ein
// Knoten anders, bleibt sein Effekt tot — dieser Test ist die Sperre dagegen.
const HOOK_IDS = [
  'mobility_lightning_reflex', 'mobility_shadow_step', 'mobility_wind_gust',
  'survival_thorn_armor', 'survival_second_chance', 'survival_life_steal',
  'combat_poison_blade', 'combat_chain_lightning', 'combat_lethal_thrust'
];

test('#93: die neun Passiven tragen exakt die IDs, die die Hooks abfragen', () => {
  const da = Object.keys(ST.SKILL_TREE.nodes);
  HOOK_IDS.forEach((id) => {
    assert.ok(da.indexOf(id) >= 0, 'Hook-ID fehlt im Baum: ' + id);
    assert.ok(ST.SKILL_TREE.nodes[id].passiv, id + ' muss passiv sein');
  });
});

test('#93: hasSkill/skillRang folgen dem Rang', () => {
  ST._configureForTest({});
  assert.strictEqual(globalThis.window.skillRang('survival_thorn_armor'), 0);
  assert.strictEqual(globalThis.window.hasSkill('survival_thorn_armor'), false);
  ST.grantSkillPoint(20);
  ST.investPoint('steelGrasp', 30);
  ST.investPoint('steelGrasp', 30);
  ST.investPoint('survival_thorn_armor', 30);
  assert.strictEqual(globalThis.window.skillRang('survival_thorn_armor'), 1);
  assert.strictEqual(globalThis.window.hasSkill('survival_thorn_armor'), true);
  ST.investPoint('survival_thorn_armor', 30);
  assert.strictEqual(globalThis.window.skillRang('survival_thorn_armor'), 2);
});

test('#93: ein Strang-Finale kostet inklusive Weg 22 Punkte', () => {
  // Die Lage IST der Preis — deshalb braucht "Zweite Chance" keinen Sonderpreis.
  ST._configureForTest({});
  ST.grantSkillPoint(100);
  const vorher = ST.getSkillPoints();
  [['hammer', 2], ['frenzy', 2], ['berserk', 2], ['whirlwind', 1], ['combat_chain_lightning', 3]]
    .forEach(([id, r]) => {
      while (ST.getRank(id) < r) {
        assert.ok(ST.investPoint(id, 30), 'investPoint fehlgeschlagen: ' + id);
      }
    });
  assert.strictEqual(ST.getRank('combat_chain_lightning'), 3);
  assert.strictEqual(vorher - ST.getSkillPoints(), 22);
});

test('#93: Finalen sind ohne ihren Capstone gesperrt', () => {
  ST._configureForTest({});
  ST.grantSkillPoint(100);
  assert.strictEqual(ST.isNodeAvailable('combat_chain_lightning', 30), false);
  assert.strictEqual(ST.isNodeAvailable('survival_second_chance', 30), false);
  assert.strictEqual(ST.isNodeAvailable('survival_life_steal', 30), false);
});

test('#93: Level-Tore der Passiven greifen', () => {
  ST._configureForTest({});
  ST.grantSkillPoint(100);
  ST.investPoint('hammer', 30);
  assert.strictEqual(ST.isNodeAvailable('combat_poison_blade', 4), false, 'L5-Tor haelt');
  assert.strictEqual(ST.isNodeAvailable('combat_poison_blade', 5), true);
});
