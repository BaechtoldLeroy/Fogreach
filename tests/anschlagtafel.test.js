// tests/anschlagtafel.test.js — das Auftragsbrett am Rathaus (#68).
//
// Die Tafeln waren Kulisse. Jetzt haengen Aushaenge daran, und sie kippen mit
// der Hub-Phase: der Rat zahlt Kopfgeld, nach dem Bruch haengt die Druckerei
// ihren Aufruf darueber, im Epilog nur noch die gedruckte Wahrheit.
//
// Dazu zwei Dinge, die das Questsystem vorher nicht konnte: wiederholbare
// Auftraege und Gold als Lohn (das Feld gab es, ausgezahlt wurde es nie).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');
const { launch } = require('../tools/headless/index.js');

const DE = {}, EN = {};
globalThis.window.i18n = {
  register(lang, dict) { Object.assign(lang === 'en' ? EN : DE, dict); },
  t: (k) => (k in DE ? DE[k] : k), getLanguage: () => 'de', setLanguage() {}, onChange: () => () => {},
  has: (k) => k in DE
};
globalThis.window.storySystem = { getCurrentActIndex: () => 99 };
loadGameModule('js/anschlagtafel.js');
loadGameModule('js/questSystem.js');
const AT = globalThis.window.Anschlagtafel;
const QS = globalThis.window.questSystem;
const D = QS.QUEST_DEFINITIONS;

// ------------------------------------------------------------ Was haengt

test('Im Rats-Hub haengt genau ein Kopfgeld, und es wechselt mit der Tiefe', () => {
  ['council', 'doubleAgent'].forEach((phase) => {
    [1, 2, 3, 4].forEach((tiefe) => {
      const haengend = AT.RATS_AUSHAENGE.filter((id) => AT.haengt(id, phase, tiefe));
      assert.strictEqual(haengend.length, 1, phase + ' bei Tiefe ' + tiefe + ': ' + haengend.join(','));
    });
    const a = AT.RATS_AUSHAENGE.find((id) => AT.haengt(id, phase, 2));
    const b = AT.RATS_AUSHAENGE.find((id) => AT.haengt(id, phase, 3));
    assert.notStrictEqual(a, b, 'der Aushang wechselt nicht mit dem Lauf: ' + a);
  });
});

test('Nach dem Bruch haengt der Aufruf der Druckerei, sonst nichts vom Rat', () => {
  assert.strictEqual(AT.haengt(AT.WIDERSTAND_AUFRUF, 'broken', 5), true);
  AT.RATS_AUSHAENGE.forEach((id) => {
    assert.strictEqual(AT.haengt(id, 'broken', 5), false, id + ' haengt nach dem Bruch');
  });
  assert.strictEqual(AT.haengt(AT.WIDERSTAND_AUFRUF, 'council', 5), false, 'Aufruf haengt schon im Rats-Hub');
});

test('Im Epilog haengt kein Auftrag mehr', () => {
  [...AT.RATS_AUSHAENGE, AT.WIDERSTAND_AUFRUF].forEach((id) => {
    assert.strictEqual(AT.haengt(id, 'epilogue', 7), false, id);
  });
});

test('Am Brett steht je Phase etwas anderes, auf Deutsch und Englisch', () => {
  ['council', 'doubleAgent', 'broken', 'epilogue'].forEach((p) => {
    assert.strictEqual(AT.zeilen(p).length, 2, p + ': keine zwei Zeilen');
    assert.ok(EN['brett.zeile.' + p + '.0'] && EN['brett.zeile.' + p + '.1'], p + ': englische Fassung fehlt');
  });
  assert.notStrictEqual(AT.zeilen('council')[0], AT.zeilen('broken')[0]);
});

// ------------------------------------------------------- Die Auftraege

test('Die drei Aushaenge haengen am Brett, sind wiederholbar und gegattert', () => {
  ['brett_stoerer', 'brett_anfuehrer', 'brett_aufruf'].forEach((id) => {
    const q = D[id];
    assert.ok(q, id + ' fehlt');
    assert.strictEqual(q.npcId, 'anschlagtafel', id + ' haengt nicht am Brett');
    assert.strictEqual(q.repeatable, true, id + ' ist nicht wiederholbar');
    assert.strictEqual(typeof q.gate, 'function', id + ' hat kein Tor');
    assert.ok(!q.completionFlags && q.advanceAct === undefined, id + ' greift in die Story ein');
  });
});

test('Ein Kopfgeld kehrt nach der Abgabe zurueck, eine Story-Quest nicht', () => {
  globalThis.window.DUNGEON_DEPTH = 20;
  assert.strictEqual(QS.acceptQuest('brett_stoerer'), true);
  QS.updateQuestProgress('kill', 'enemy', 12);
  assert.strictEqual(QS.isQuestReadyToComplete('brett_stoerer'), true, 'nicht abgabebereit');
  assert.strictEqual(QS.completeQuest('brett_stoerer'), true);
  assert.ok(!QS.getCompletedQuests().some((q) => q.id === 'brett_stoerer'), 'gilt als abgeschlossen');
  assert.strictEqual(QS.isQuestReadyToComplete('brett_stoerer'), false, 'Fortschritt nicht zurueckgesetzt');
  assert.strictEqual(QS.acceptQuest('brett_stoerer'), true, 'nicht erneut annehmbar');

  assert.strictEqual(QS.acceptQuest('aldric_cleanup'), true);
  QS.updateQuestProgress('kill', 'enemy', 10);
  assert.strictEqual(QS.completeQuest('aldric_cleanup'), true);
  assert.ok(QS.getCompletedQuests().some((q) => q.id === 'aldric_cleanup'), 'Story-Quest kehrt zurueck');
});

test('Gold aus der Belohnung kommt beim Spieler an', () => {
  let gezahlt = 0;
  globalThis.window.LootSystem = { grantGold: (n) => { gezahlt += n; } };
  globalThis.window.DUNGEON_DEPTH = 20;
  QS.acceptQuest('brett_anfuehrer');
  QS.updateQuestProgress('kill', 'elite_enemy', 3);
  QS.completeQuest('brett_anfuehrer');
  assert.strictEqual(gezahlt, D.brett_anfuehrer.rewards.gold);
});

// --------------------------------------------------------------- Im Hub

let H = null;
before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
  H.step(10);
});
after(async () => { if (H) await H.shutdown(); });

/** Spieler an die Tafel stellen und die Interaktionspruefung laufen lassen. */
function anDieTafel() {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var p = sc._hubPhaseRefs && sc._hubPhaseRefs.posterSpots && sc._hubPhaseRefs.posterSpots[0];
    if (!p) return { fehler: 'keine posterSpots' };
    sc.player.setPosition(p.x, p.y - 40);
    sc._refreshInteractionPrompt();
    return { typ: sc._activeInteractable && sc._activeInteractable.type,
      edikt: !!(sc._activeInteractable && sc._activeInteractable.edikt),
      label: sc.prompt.text };
  })()`);
}

test('Die Tafel ist ansprechbar und heisst Anschlagtafel', () => {
  const r = anDieTafel();
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.typ, 'anschlag');
  assert.strictEqual(r.edikt, false, 'haelt sich faelschlich fuer das Edikt-Aushaengen');
  assert.match(r.label, /Anschlagtafel/);
});

test('Am Brett wird der Aushang angeboten, den die Phase vorsieht', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var qs = window.questSystem;
    var offen = qs.getAvailableQuests('anschlagtafel').map(function (q) { return q.id; });
    var vorher = sc.children.list.length;
    sc._brettOeffnen();
    var texte = [];
    var sammeln = function (o) { if (!o) return; if (o.type === 'Text') texte.push(o.text); if (o.list) o.list.forEach(sammeln); };
    sc.children.list.slice(vorher).forEach(sammeln);
    return { offen: offen, dialog: !!sc._dialogOpen, text: texte.join(' | '),
      phase: window.HubPhase.current(), tiefe: window.Persistence.getMaxDepth() };
  })()`);
  assert.strictEqual(r.offen.length, 1,
    'es haengt nicht genau ein Aushang: ' + r.offen.join(',') + ' (Phase ' + r.phase + ', Tiefe ' + r.tiefe + ')');
  assert.ok(/^brett_/.test(r.offen[0]), r.offen[0]);
  assert.strictEqual(r.dialog, true, 'kein Dialog am Brett');
  assert.ok(r.text.length > 0, 'der Dialog blieb leer');
});
