// tests/ersterLaufStufe.test.js — wie weit man nach dem ersten Lauf ist.
//
// Gemeldet: nach dem ersten Lauf und dem Questlohn stand man schon auf Stufe
// 7. Zwei Stellschrauben zusammen: die Einfuehrungen geben fest 10 XP statt
// 40 (und wachsen nicht mit dem Stufenbedarf), und der Sockel der Level-Kurve
// steigt von 15 auf 60 (js/main.js XP_CURVE_BASE).
//
// Die Lauf-Zahlen sind GEMESSEN, nicht geschaetzt: headless, Tiefe 1, neun
// volle Laeufe (jeder Raum geraeumt, Ereignisse an, Fragmente aufgehoben) —
// 99 / 130 / 167 XP als min / Mittel / max. Gerechnet wird mit der echten
// Kurve aus main.js und dem echten lohnBerechnen.

const { test } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');
const kurve = require('./xpKurve');

const W = globalThis.window;

const EINFUEHRUNGEN = ['einfuehrung_schmiede', 'einfuehrung_presse', 'einfuehrung_markt',
  'einfuehrung_talente', 'einfuehrung_akte', 'einfuehrung_truhe', 'einfuehrung_wissen',
  'einfuehrung_amulett'];

function frisch() {
  resetStore();
  ['questSystem', 'LootSystem', 'Persistence', 'getNeededXP', 'addXP', 'playerLevel',
    'inventory', 'KnowledgeTree', 'makePotionDrop'].forEach((k) => { delete W[k]; });
  W.storySystem = { getCurrentActIndex: () => 99, advanceToAct: () => {} };
  loadGameModule('js/questSystem.js');
  return W.questSystem;
}

test('Kurve: Schwellen mit Sockel 60', () => {
  assert.strictEqual(kurve.BASE, 60);
  assert.deepStrictEqual([1, 2, 3, 4, 5, 10, 20].map(kurve.getNeededXP),
    [63, 69, 78, 90, 105, 218, 609]);
  assert.strictEqual(kurve.xpBisStufe(20), 4793);
});

test('Einfuehrungen: fest 10 XP, auch wenn die Stufe viel verlangt', () => {
  const qs = frisch();
  EINFUEHRUNGEN.forEach((id) => {
    const d = qs.QUEST_DEFINITIONS[id];
    assert.strictEqual(d.rewardTier, 'einfuehrung', id);
    assert.strictEqual(d.rewards.xp, 10, id);
    assert.strictEqual(qs.lohnBerechnen(d, { xpFuerStufe: 5000, maxTiefe: 1 }).xp, 10, id + ' waechst mit');
  });
  assert.strictEqual(qs.LOHN_ANTEIL.einfuehrung, 0);
});

test('Einfuehrungen: die Abgabe zahlt genau 10 XP und das Geschenk', () => {
  const qs = frisch();
  W.getNeededXP = () => 1000;
  W.Persistence = { getMaxDepth: () => 1 };
  W.LootSystem = { grantGold: () => {} };
  const geschenk = {
    einfuehrung_schmiede: { mat: 8 }, einfuehrung_presse: { druckblaetter: 2 },
    einfuehrung_markt: { gold: 30 }, einfuehrung_talente: { potions: 1 },
    einfuehrung_akte: { potions: 1 }, einfuehrung_truhe: { gold: 30 },
    einfuehrung_wissen: { fragments: 1 }, einfuehrung_amulett: { gold: 45 }
  };
  EINFUEHRUNGEN.forEach((id) => {
    let xp = 0;
    W.addXP = (n) => { xp += n; };
    const st = qs.getQuestSaveData();
    const d = qs.QUEST_DEFINITIONS[id];
    st.quests[id] = { status: 'active', objectives: d.objectives.map((o) => ({
      type: o.type, target: o.target, current: o.required, required: o.required })) };
    qs.loadQuestSaveData(st);
    assert.strictEqual(qs.completeQuest(id), true, id);
    assert.strictEqual(xp, 10, id + ': ' + xp + ' XP');
    const v = qs.getErhaltenerLohn(id);
    Object.entries(geschenk[id]).forEach(([k, n]) => assert.strictEqual(v[k], n, id + ' ' + k));
  });
});

// Ab Stufe 3 greift fuer sie wie bisher der Neben-Anteil (0.4 x 78 = 31).
test('Aldrics Auftraege bleiben frueh bei 30 und 40', () => {
  const qs = frisch();
  const D = qs.QUEST_DEFINITIONS;
  [1, 2].forEach((l) => {
    const lage = { xpFuerStufe: kurve.getNeededXP(l), maxTiefe: 1 };
    assert.strictEqual(qs.lohnBerechnen(D.aldric_cleanup, lage).xp, 30, 'L' + l);
    assert.strictEqual(qs.lohnBerechnen(D.aldric_patrol, lage).xp, 40, 'L' + l);
  });
});

/**
 * Erster Lauf, dann alles, was danach abzuholen ist: Aldrics zwei Auftraege
 * und die fuenf Einfuehrungen, die nach dem ersten Lauf offen sind (Markt,
 * Amulett und Wissen haengen an Tiefe 4 bzw. Harrens Auftrag).
 */
function nachErstemLauf(qs, laufXp) {
  let stufe = 1; let xp = 0;
  const add = (n) => {
    xp += n;
    while (xp >= kurve.getNeededXP(stufe)) { xp -= kurve.getNeededXP(stufe); stufe++; }
  };
  add(laufXp);
  ['aldric_cleanup', 'aldric_patrol', 'einfuehrung_schmiede', 'einfuehrung_presse',
    'einfuehrung_talente', 'einfuehrung_akte', 'einfuehrung_truhe'].forEach((id) => {
    if (id === 'einfuehrung_akte') assert.ok(stufe >= 2, 'Akte erst ab Stufe 2 (' + stufe + ')');
    add(qs.lohnBerechnen(qs.QUEST_DEFINITIONS[id], { xpFuerStufe: kurve.getNeededXP(stufe), maxTiefe: 2 }).xp);
  });
  return stufe;
}

test('Erster Lauf + Questlohn: Stufe 3 bis 4, das Mittel auf 4', () => {
  const qs = frisch();
  const gemessen = { min: 99, mittel: 130, max: 167 };
  Object.entries(gemessen).forEach(([k, laufXp]) => {
    const s = nachErstemLauf(qs, laufXp);
    assert.ok(s >= 3 && s <= 4, k + ' (' + laufXp + ' XP): Stufe ' + s);
  });
  assert.strictEqual(nachErstemLauf(qs, gemessen.mittel), 4);
});
