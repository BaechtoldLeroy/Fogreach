// tests/maraMarktAngebot.test.js — "Was unter dem Tisch liegt" kommt erst, wenn ihr Stand offen ist.
//
// Maras Einfuehrung in den Schwarzmarkt wurde frueher sofort angeboten; die
// Tiefe stand nur als Hinweis im Text ("ab Tiefe 4", "nicht hier oben" —
// dabei ist ihr Stand genau hier oben, im Hub). Und ein minDepth: 4 fror
// den Kauf ein, solange der LAUFENDE Lauf flacher war, obwohl man oben bei
// ihr kauft.
//
// Jetzt: angeboten erst ab erreichter Tiefe 4 (LootSystem.isBlackMarketUnlocked),
// und der Kauf zaehlt unabhaengig von der Tiefe des laufenden Laufs.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas' });
  await H.waitForScene('HubSceneV2', { maxRounds: 600 });
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = { aldric_cleanup: { status: 'completed', objectives: [] } };
    qs.loadQuestSaveData(st);
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

const angebotBei = (tiefe) => H.run(`(function () {
  window.Persistence.getMaxDepth = function () { return ${tiefe}; };
  return window.questSystem.getAvailableQuests('mara').some(function (d) { return d.id === 'einfuehrung_markt'; });
})()`);

test('vor Tiefe 4 bietet Mara den Auftrag nicht an, ab Tiefe 4 schon', () => {
  assert.strictEqual(angebotBei(3), false, 'angeboten, obwohl ihr Stand noch zu ist');
  assert.strictEqual(angebotBei(4), true, 'ab Tiefe 4 nicht angeboten');
});

test('der Kauf zaehlt auch, wenn der laufende Lauf flach ist', () => {
  const r = H.run(`(function () {
    var qs = window.questSystem;
    window.Persistence.getMaxDepth = function () { return 4; };
    qs.acceptQuest('einfuehrung_markt');
    window.DUNGEON_DEPTH = 1;          // gekauft wird oben, nach einem flachen Lauf
    qs.onSystemUsed('markt');
    var q = qs.getActiveQuests('mara').concat(qs.getCompletedQuests ? qs.getCompletedQuests() : [])
      .filter(function (x) { return x && x.id === 'einfuehrung_markt'; })[0];
    var st = qs.getQuestSaveData().quests.einfuehrung_markt;
    return { status: st && st.status, stand: st && st.objectives && st.objectives[0] && st.objectives[0].current };
  })()`);
  assert.ok(r.status === 'completed' || r.stand === 1, 'der Kauf zaehlte nicht: ' + JSON.stringify(r));
});

test('die Texte nennen keine Tiefe mehr und schicken nicht "nach unten"', () => {
  const t = H.run(`(function () {
    var d = window.questSystem.QUEST_DEFINITIONS.einfuehrung_markt;
    return [d.description, d.dialogueOffer, d.dialogueProgress].join(' | ');
  })()`);
  assert.ok(!/Tiefe/.test(t), 'noch ein Tiefenhinweis: ' + t);
  assert.ok(!/nicht hier oben/.test(t), 'noch "nicht hier oben": ' + t);
});
