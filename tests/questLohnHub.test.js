// tests/questLohnHub.test.js — der Questlohn am echten Spiel: was das
// Angebot verspricht, was die Abgabe zeigt, ob der +10-%-Bonus wirkt und ob
// das Ritualamulett wirklich am Kopf sitzt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
const hub = `window.game.scene.getScene('HubSceneV2')`;

/** Quest-Stand setzen: { id: 'completed' | 'ready' }. */
const STAND = (eintraege) => `(function () {
  var qs = window.questSystem, st = qs.getQuestSaveData();
  st.quests = {}; st.flags = {};
  var e = ${JSON.stringify(eintraege)};
  Object.keys(e).forEach(function (id) {
    var d = qs.QUEST_DEFINITIONS[id];
    st.quests[id] = { status: e[id] === 'ready' ? 'active' : e[id], objectives: d.objectives.map(function (o) {
      return { type: o.type, target: o.target, current: o.required, required: o.required }; }) };
  });
  qs.loadQuestSaveData(st);
  return true;
})()`;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  H.run("(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')");
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 400 }), 'Hub nicht erreicht');
  H.step(20);
  H.run(`(function () { var sc = ${hub}; if (sc._closeDialog) { try { sc._closeDialog([]); } catch (e) {} } sc._dialogOpen = false; })()`);
});
after(async () => { if (H) await H.shutdown(); });

/** Was eine Figur beim Ansprechen sagt: Modus, Auftrag, Seiten. */
function gespraech(npc) {
  return H.run(`(function () {
    var sc = ${hub};
    var n = sc.npcs.filter(function (x) { return x.data && x.data.id === '${npc}'; })[0];
    if (!n) return { fehler: '${npc} fehlt' };
    var orig = sc._showDialoguePages, fang = null;
    sc._showDialoguePages = function (d, t, pages, mode, q) {
      if (!fang) fang = { mode: mode, quest: q ? q.id : null, texte: pages.map(function (p) { return p.text; }) };
    };
    try { sc._dialogOpen = false; sc._showNpcDialogue(n.data); } finally { sc._showDialoguePages = orig; }
    sc._dialogOpen = false;
    return fang || { mode: 'keiner' };
  })()`);
}

test('Angebot nennt das Gold — mit dem Wert, den die Abgabe zahlt', () => {
  H.run(STAND({ aldric_cleanup: 'completed', aldric_patrol: 'completed' }));
  H.run(`window.__schwarz = window.LootSystem.isBlackMarketUnlocked;
    window.LootSystem.isBlackMarketUnlocked = function () { return true; };
    window.__tiefe = window.Persistence.getMaxDepth;
    window.Persistence.getMaxDepth = function () { return 12; }; true`);
  try {
    const g = gespraech('mara');
    assert.strictEqual(g.mode, 'offer');
    assert.strictEqual(g.quest, 'einfuehrung_markt');
    // 30 Gold auf Tiefe 1 sind auf Tiefe 12 das Zwoelffache.
    assert.ok(g.texte.some((t) => /\+360 Gold/.test(t)), 'kein skaliertes Gold im Angebot:\n' + g.texte.join('\n---\n'));
  } finally {
    H.run(`window.LootSystem.isBlackMarketUnlocked = window.__schwarz;
      window.Persistence.getMaxDepth = window.__tiefe; true`);
  }
});

test('Abgabe zeigt jede Lohnart', () => {
  H.run(STAND({ aldric_cleanup: 'completed', aldric_patrol: 'completed', einfuehrung_schmiede: 'ready' }));
  const g = gespraech('branka');
  assert.strictEqual(g.mode, 'turnin');
  const seite = g.texte[g.texte.length - 1];
  assert.match(seite, /\+\d+ XP/);
  assert.match(seite, /\+8 Eisenbrocken/);
});

test('+10 % XP nach den Pamphleten', () => {
  const zuwachs = (stand) => {
    H.run(STAND(stand));
    return H.run(`(function () {
      playerLevel = 40; neededXP = getNeededXP(40); playerXP = 0;
      addXP(100); addXP(1); addXP(1); addXP(1); addXP(1); addXP(1);
      addXP(1); addXP(1); addXP(1); addXP(1); addXP(1);
      return playerXP;
    })()`);
  };
  const ohne = zuwachs({});
  const mit = zuwachs({ thom_pamphlets: 'completed' });
  assert.strictEqual(mit - ohne, 11, 'Bonus wirkt nicht (ohne ' + ohne + ', mit ' + mit + ')');
});

test('Ritualamulett: anlegbar am Kopf und bleibt nach dem Lauf', () => {
  H.run(STAND({ elara_ritual: 'ready' }));
  const r = H.run(`(function () {
    ['weapon','offhand','head','body','boots','amulet'].forEach(function (k) { window.equipment[k] = null; });
    for (var i = 0; i < window.inventory.length; i++) window.inventory[i] = null;
    playerLevel = 18; window.playerLevel = 18;
    if (!window.questSystem.completeQuest('elara_ritual')) return { fehler: 'nicht abgegeben' };
    var it = window.inventory.filter(function (x) { return x && x.key === 'RITUAL_AMULETT'; })[0];
    if (!it) return { fehler: 'nicht im Inventar' };
    window.selectInventorySlot(window.inventory.indexOf(it));
    window.equipSelectedItem();
    var am = window.equipment.head === it;
    window.LootSystem.clearRunAmulet(window.equipment, window.inventory);
    return { typ: it.type, tier: it.tier, am: am, bleibt: window.equipment.head === it, name: it.displayName };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.typ, 'head');
  assert.strictEqual(r.am, true, 'nicht angelegt');
  assert.strictEqual(r.bleibt, true, 'nach dem Lauf abgelegt');
  assert.strictEqual(r.name, 'Nebelamulett des Rats');

  // Das Journal nennt, was die Abgabe brachte — uebersetzt, jede Art.
  const j = H.run(`(function () {
    var e = window.storySystem.getJournalData().completedQuests.filter(function (q) {
      return q.title === window.questSystem.getQuestTitle(window.questSystem.QUEST_DEFINITIONS.elara_ritual); })[0];
    var de = e && e.rewards;
    window.i18n.setLanguage('en');
    var e2 = window.storySystem.getJournalData().completedQuests.filter(function (q) {
      return q.title === window.questSystem.getQuestTitle(window.questSystem.QUEST_DEFINITIONS.elara_ritual); })[0];
    window.i18n.setLanguage('de');
    return { de: de, en: e2 && e2.rewards };
  })()`);
  assert.match(j.de || '', /^\+\d+ XP, Nebelamulett des Rats \(Selten\)$/);
  assert.match(j.en || '', /^\+\d+ XP, Council Fog Amulet \(Rare\)$/);
});
