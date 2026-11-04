// tests/zuFlachToast.test.js — "Zu flach für: …" einmal je Lauf im Keller.
//
// Ein laufender Auftrag mit Mindesttiefe zaehlt in flacheren Laeufen nicht:
// Kills und Funde laufen ins Leere. Der erste Raum eines Laufs sagt das jetzt
// (roomManager._zuFlachMelden), danach nicht wieder. Am echten Keller.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
const GS = `window.game.scene.getScene('GameScene')`;
function run(js) {
  const s = JSON.stringify(H.run(js));
  return s === undefined ? undefined : JSON.parse(s);
}

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=10', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(20);
  run(`(function () {
    window.__toasts = [];
    var echt = window.EventSystem.showToast;
    window.EventSystem.showToast = function (s, msg) { window.__toasts.push(msg); return echt.apply(this, arguments); };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

/** Laufende Auftraege setzen und einen neuen Lauf beginnen (wie beim Abstieg). */
function neuerLauf(quests) {
  run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData(), q = ${JSON.stringify(quests)};
    st.quests = {};
    q.forEach(function (id) { var d = qs.QUEST_DEFINITIONS[id];
      st.quests[id] = { status: 'active', objectives: d.objectives.map(function (o) {
        return { type: o.type, target: o.target, current: 0, required: o.required }; }) }; });
    qs.loadQuestSaveData(st);
    window.DUNGEON_DEPTH = 10;
    initDungeonRun();
    window.__toasts = [];
    enterRoom(${GS}, 0);
  })()`);
}
function warten() {
  for (let i = 0; i < 120 && !run(`window.__toasts.some(function (t) { return /^Zu flach/.test(t); })`); i++) H.step(5);
  return run(`window.__toasts.filter(function (t) { return /^Zu flach/.test(t); })`);
}

test('erster Raum: einmal "Zu flach für", dann nicht wieder im selben Lauf', () => {
  neuerLauf(['who_you_were']);
  const titel = run(`window.questSystem.QUEST_DEFINITIONS.who_you_were.title`);
  assert.deepStrictEqual(warten(), ['Zu flach für: „' + titel + '“ (ab Tiefe 17)']);
  run(`window.__toasts = []; enterRoom(${GS}, 1)`);
  H.step(150);
  assert.deepStrictEqual(run(`window.__toasts.filter(function (t) { return /^Zu flach/.test(t); })`), [], 'zweiter Raum meldet erneut');
});

test('nichts eingefroren: kein Hinweis', () => {
  neuerLauf(['aldric_cleanup']);
  H.step(150);
  assert.deepStrictEqual(run(`window.__toasts.filter(function (t) { return /^Zu flach/.test(t); })`), []);
});

// Zuletzt: die Rueckkehr verlaesst den Keller.
test('Rueckkehr: die Laufuebersicht bekommt, was der Lauf mit der Grenze gemacht hat', () => {
  const r = run(`(function () {
    window.lastRunSummary = null;
    var grenze = window.Persistence.getMaxDepth();
    leaveDungeonForHub(${GS}, { reason: 'death', skipSave: true });
    return { g: window.lastRunSummary && window.lastRunSummary.grenze, grenze: grenze };
  })()`);
  assert.deepStrictEqual(r.g, { grund: 'nicht_fertig', vorher: r.grenze, nachher: r.grenze, tor: null });
});
