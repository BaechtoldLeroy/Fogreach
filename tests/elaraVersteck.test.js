// tests/elaraVersteck.test.js — Elaras Versteck als echter Raum (#161).
//
// Story-Bibel v5, Abschnitt 11: ein fester Raum, dreimal besucht — nach dem
// Ratsdokument, fuer die Werkstatt-Szene und in der Nacht nach dem Bruch.
// Ist ein Besuch faellig, liegt das Versteck im Lauf; drinnen gibt es keine
// Gegner, Elara wartet, und das Gespraech mit ihr spielt die Szene.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launchDungeon({ depth: 5 });
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.__dialogLog = [];
    var echt = window.EventSystem.showEventChoiceDialog;
    window.EventSystem.showEventChoiceDialog = function (s, titel) {
      window.__dialogLog.push(String(titel || ''));
      return echt.apply(this, arguments);
    };
    window.__durchklicken = function () {
      for (var n = 0; n < 20 && window.eventChoiceOpen; n++) {
        var k = sc.children.list.filter(function (o) {
          return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled && o.active;
        })[0];
        if (!k) break;
        k.emit('pointerdown');
      }
    };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

const FERTIG = { status: 'completed', objectives: [] };

function stand(quests, flags, akt) {
  H.run(`(function () {
    var qs = window.questSystem;
    window.storySystem.advanceToAct(${akt || 1});
    var st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests)};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
    window.__durchklicken();
    window.__dialogLog.length = 0;
  })()`);
}

function lauf() {
  return H.run(`(function () { window.DUNGEON_DEPTH = 5; initDungeonRun(); return dungeonRun.templateOrder.slice(); })()`);
}

/** Betritt den Versteck-Raum des Laufs; gibt den Zustand drinnen zurueck. */
function versteckBetreten() {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var i = dungeonRun.templateOrder.indexOf('ElarasVersteck');
    if (i < 0) return { fehler: 'kein Versteck im Lauf' };
    enterRoom(sc, i);
    var gegner = enemies.getChildren().filter(function (e) { return e && e.active; }).length;
    return { index: i, besuch: sc._versteckBesuch, gegner: gegner, deko: !!(sc._versteckDeko && sc._versteckDeko.active),
             text: sc._raumBeschriftung };
  })()`);
}

test('Ohne faelligen Besuch gibt es kein Versteck im Lauf', () => {
  stand({}, {});
  for (let i = 0; i < 20; i++) assert.ok(!lauf().includes('ElarasVersteck'));
});

test('Erster Besuch: nach dem Ratsdokument liegt das Versteck gleich hinter dem ersten Raum', () => {
  stand({ harren_daughter_investigation: FERTIG, widerstand_proof: FERTIG }, { elaraMet: true });
  const reihe = lauf();
  assert.strictEqual(reihe[1], 'ElarasVersteck', reihe.join(', '));
  const r = versteckBetreten();
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.besuch, 'versteck');
  assert.strictEqual(r.gegner, 0, 'im Versteck stehen Gegner');
  assert.strictEqual(r.deko, true, 'das Versteck ist nicht eingerichtet');
  assert.ok(/Elaras Versteck/.test(r.text || ''), 'keine Beschriftung: ' + r.text);
});

test('Nach ein paar Sekunden kommt trotzdem keine Welle', () => {
  stand({ harren_daughter_investigation: FERTIG, widerstand_proof: FERTIG }, { elaraMet: true });
  lauf();
  versteckBetreten();
  H.step(180);
  const n = H.run(`enemies.getChildren().filter(function (e) { return e && e.active; }).length`);
  assert.strictEqual(n, 0, n + ' Gegner im Versteck');
});

test('Zweiter Besuch: nach elara_meeting die Werkstatt-Szene im Versteck', () => {
  stand({ harren_daughter_investigation: FERTIG, widerstand_proof: FERTIG, elara_meeting: FERTIG },
        { elaraMet: true, elara_versteck_gesehen: true }, 2);
  lauf();
  const r = versteckBetreten();
  assert.strictEqual(r.besuch, 'werkstatt');
  H.run(`window._versteckSzeneSpielen(window.game.scene.getScene('GameScene'), 'werkstatt')`);
  const text = H.run(`window.__dialogLog[0] || ''`);
  assert.ok(/Werkzeug|alten Werkstatt/.test(text), 'nicht die Werkstatt-Szene: ' + text);
  H.run('window.__durchklicken()');
  assert.strictEqual(H.run(`window.questSystem.hasFlag('elara_camp_seen')`), true);
});

test('Dritter Besuch: die Nacht nach dem Bruch', () => {
  stand({ harren_daughter_investigation: FERTIG, widerstand_proof: FERTIG, elara_meeting: FERTIG },
        { elaraMet: true, elara_versteck_gesehen: true, elara_camp_seen: true }, 4);
  lauf();
  const r = versteckBetreten();
  assert.strictEqual(r.besuch, 'bruch_nacht');
  H.run(`window._versteckSzeneSpielen(window.game.scene.getScene('GameScene'), 'bruch_nacht')`);
  assert.strictEqual(H.run(`window.questSystem.hasFlag('bruch_nacht_gesehen')`), true);
  assert.strictEqual(H.run(`window.versteckBesuchFaellig()`), null, 'danach ist noch ein Besuch faellig');
});

test('Nach dem Verrat keine Nacht mehr', () => {
  stand({ widerstand_proof: FERTIG, elara_meeting: FERTIG },
        { elara_versteck_gesehen: true, elara_camp_seen: true, elara_verrat_gesehen: true }, 4);
  assert.strictEqual(H.run(`window.versteckBesuchFaellig()`), null);
});

test('Mitten im Lauf: der naechste Raum wird zum Versteck, nie der Finalraum', () => {
  stand({ harren_daughter_investigation: FERTIG, widerstand_proof: FERTIG }, { elaraMet: true, elara_versteck_gesehen: true });
  const r = H.run(`(function () {
    initDungeonRun();
    var sc = window.game.scene.getScene('GameScene');
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests.elara_meeting = { status: 'completed', objectives: [] };
    qs.loadQuestSaveData(st);
    dungeonRun.currentIndex = 2;
    var mitte = _versteckAlsNaechsterRaum() && dungeonRun.templateOrder[3];
    var letzter = dungeonRun.totalRooms - 1;
    initDungeonRun();
    dungeonRun.templateOrder = dungeonRun.templateOrder.map(function (n) { return n === 'ElarasVersteck' ? 'Arena' : n; });
    dungeonRun.currentIndex = letzter - 1;
    var ende = _versteckAlsNaechsterRaum();
    return { mitte: mitte, ende: ende, finale: dungeonRun.templateOrder[letzter] };
  })()`);
  assert.strictEqual(r.mitte, 'ElarasVersteck');
  assert.strictEqual(r.ende, false, 'das Versteck ersetzt den Finalraum');
  assert.notStrictEqual(r.finale, 'ElarasVersteck');
});

// --- #161: Die Flucht nach dem Bruch -----------------------------------------

test('Nach dem Bruch: erst die Flucht vor der Kettenwache, dann das Versteck', () => {
  stand({ harren_daughter_investigation: FERTIG, widerstand_proof: FERTIG, elara_meeting: FERTIG },
        { elaraMet: true, elara_versteck_gesehen: true, elara_camp_seen: true }, 4);
  const r = H.run(`(function () {
    window.DUNGEON_DEPTH = 5; initDungeonRun();
    return { reihe: dungeonRun.templateOrder.slice(), flucht: dungeonRun.fluchtRaum };
  })()`);
  assert.strictEqual(r.reihe[2], 'ElarasVersteck', r.reihe.join(', '));
  assert.strictEqual(r.flucht, 1, 'kein Fluchtraum vor dem Versteck');

  const f = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enemies.clear(true, true);
    enterRoom(sc, 1);
    return { modus: window.RoomMode.activeModeId() };
  })()`);
  assert.strictEqual(f.modus, 'escape', 'der Fluchtraum ist keine Flucht: ' + f.modus);
  H.run('window._playerInvincible = true');
  H.step(240);
  H.run('window._playerInvincible = false');
  const kette = H.run(`enemies.getChildren().filter(function (e) { return e && e.active && e.isChainGuard; }).length`);
  assert.ok(kette > 0, 'die Kettenwache jagt nicht');
});

test('Die anderen Besuche kommen ohne Flucht', () => {
  stand({ harren_daughter_investigation: FERTIG, widerstand_proof: FERTIG }, { elaraMet: true });
  const r = H.run(`(function () { initDungeonRun(); return { reihe: dungeonRun.templateOrder.slice(), flucht: dungeonRun.fluchtRaum }; })()`);
  assert.strictEqual(r.reihe[1], 'ElarasVersteck');
  assert.strictEqual(r.flucht, null);
});
