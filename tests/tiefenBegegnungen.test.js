// tests/tiefenBegegnungen.test.js — Harrens Abstieg und Aldrics Ende (v6.1).
//
// Story-Kern v6.1: Harren folgt Dir ohne Amulett; mit jeder Tiefe nimmt ihm
// der Nebel mehr (Amt, Stadt, Deinen Namen), zuletzt bleibt nur "Lene". In
// "Die letzte Wache" fuehrt Mara Dich bei Welle 30 zu Aldric, der fragt, wer
// er ist; sagen oder schweigen setzt eine Flagge fuer den Epilog.
//
// Am laufenden Dungeon (roomManager._tiefenBegegnung): die Figur steht im
// Raum, [E] in ihrer Naehe oeffnet die echten Dialoge
// (EventSystem.showEventChoiceDialog), geklickt wird auf die echten Knoepfe.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
let L = null;
const SC = `window.game.scene.getScene('GameScene')`;

before(async () => {
  H = await launchDungeon({ depth: 29 });
  L = H.lab;
  H.run(`(function () {
    var sc = ${SC};
    window.__dialogLog = [];
    var echt = window.EventSystem.showEventChoiceDialog;
    window.EventSystem.showEventChoiceDialog = function (s, titel, wahlen) {
      window.__dialogLog.push({ text: String(titel || ''), wahlen: (wahlen || []).map(function (w) { return w.label; }) });
      return echt.apply(this, arguments);
    };
    window.__klick = function (n) {
      var k = sc.children.list.filter(function (o) {
        return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled && o.active;
      })[n || 0];
      if (!k) return false;
      k.emit('pointerdown');
      return true;
    };
    // Die Figur im Raum: Bild, Abstand, und [E] direkt neben ihr.
    window.__figur = function (bild) {
      return sc.children.list.filter(function (o) { return o.active && o.texture && o.texture.key === bild; })[0] || null;
    };
    window.__ansprechen = function (bild) {
      var f = window.__figur(bild);
      if (!f) return false;
      player.x = f.x + 20; player.y = f.y;
      if (player.body && player.body.reset) player.body.reset(f.x + 20, f.y);
      sc.input.keyboard.emit('keydown-E', {});
      return true;
    };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

function aufraeumen() {
  for (let i = 0; i < 20 && H.run('!!window.eventChoiceOpen'); i++) { H.run('window.__klick(0)'); H.step(2); }
  H.run(`window.EventSystem.cleanupEventObjects && window.EventSystem.cleanupEventObjects()`);
  H.run('window.__dialogLog.length = 0');
}
beforeEach(() => {
  L.clearEnemies();
  L.healPlayer();
  aufraeumen();
  // Jede Begegnung beginnt in einem frischen Lauf (Raumsperre zurueck).
  H.run('window.initDungeonRun && window.initDungeonRun()');
});

function stand(quests, flags) {
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests)};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
  })()`);
}
const QUELLE = { schattenrat_finale: { status: 'active', objectives: [{ type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }] } };
const flag = (n) => H.run(`window.questSystem.hasFlag('${n}')`);
const faellig = (t) => H.run(`(function () { var f = window.tiefenBegegnungFaellig(${t}); return f ? (f.art + (f.nr ? f.nr : '')) : null; })()`);

/** Begegnung im Raum `raum` ausloesen; gibt zurueck, ob die Figur steht. */
function begegnung(raum, bild) {
  H.run(`window._tiefenBegegnung(${SC}, ${raum})`);
  H.step(2);
  return H.run(`!!window.__figur('${bild}')`);
}
/** Die Figur ansprechen und alle Seiten mit Knopf `wahl` durchklicken; gibt die Texte zurueck. */
function gespraech(bild, wahl) {
  assert.ok(H.run(`window.__ansprechen('${bild}')`), bild + ' steht nicht im Raum');
  H.step(2);
  const texte = [];
  for (let i = 0; i < 12 && H.run('!!window.eventChoiceOpen'); i++) {
    const d = H.run('window.__dialogLog[window.__dialogLog.length - 1]');
    texte.push(d.text);
    H.run(`window.__klick(${d.wahlen.length > 1 ? (wahl || 0) : 0})`);
    H.step(2);
  }
  return texte;
}

test('Harren erscheint nur waehrend der Quelle und erst ab Tiefe 24', () => {
  stand({}, {});
  assert.strictEqual(faellig(29), null, 'Harren ohne laufende Quelle');
  stand(QUELLE, {});
  assert.strictEqual(faellig(23), null, 'Harren schon auf Tiefe 23');
  assert.strictEqual(faellig(24), 'harren1');
  stand(QUELLE, { harren_dead: true });
  assert.strictEqual(faellig(29), null, 'der tote Harren erscheint noch');
});

test('Harrens Abstieg: drei Begegnungen in fester Reihenfolge, jedes Mal weniger er selbst', () => {
  stand(QUELLE, {});
  L.setDepth(29, 29);
  // Raum 1 ist zu frueh, Raum 2 bringt ihn.
  assert.strictEqual(begegnung(1, 'harren_right0'), false, 'Harren schon im ersten Raum');
  assert.strictEqual(begegnung(2, 'harren_right0'), true, 'Harren erscheint nicht');
  const eins = gespraech('harren_right0').join('\n');
  assert.ok(/Archivschmied/.test(eins), 'er kennt Dich noch: ' + eins);
  assert.ok(/Amt/.test(eins) && /weiss nicht mehr, welches/.test(eins), 'das Amt ist nicht weg: ' + eins);
  assert.strictEqual(flag('harren_abstieg_1'), true);
  assert.strictEqual(faellig(29), 'harren2');

  // Gleich im naechsten Raum noch nicht, zwei Raeume spaeter schon.
  assert.strictEqual(begegnung(3, 'harren_right0'), false, 'zwei Begegnungen direkt hintereinander');
  assert.strictEqual(begegnung(4, 'harren_right0'), true, 'die zweite Begegnung kommt nicht');
  const zwei = gespraech('harren_right0').join('\n');
  assert.ok(/Archivschmied/.test(zwei), 'den Namen hat er schon verloren: ' + zwei);
  assert.ok(/Stadt/.test(zwei) && /weiss ich nicht mehr/.test(zwei), 'die Stadt ist nicht weg: ' + zwei);
  assert.strictEqual(flag('harren_abstieg_2'), true);

  assert.strictEqual(begegnung(6, 'harren_right0'), true, 'die dritte Begegnung kommt nicht');
  const drei = gespraech('harren_right0');
  const harrenSagt = drei.join('\n').match(/HARREN: [^\n(]*/g) || [];
  assert.deepStrictEqual(harrenSagt.map((s) => s.trim()), ['HARREN: Lene.'], 'zuletzt sagt er nur "Lene": ' + drei.join(' | '));
  assert.ok(!/Archivschmied/.test(drei.join('\n')), 'er kennt Dich noch');
  assert.strictEqual(flag('harren_abstieg_3'), true);
  assert.strictEqual(faellig(29), null, 'eine vierte Begegnung');
  assert.strictEqual(begegnung(8, 'harren_right0'), false);
});

test('Die Reihenfolge haengt an den Flaggen, nicht an der Tiefe', () => {
  // Wer tief steht, sieht trotzdem zuerst die erste Begegnung.
  stand(QUELLE, {});
  assert.strictEqual(faellig(29), 'harren1');
  stand(QUELLE, { harren_abstieg_1: true });
  assert.strictEqual(faellig(25), null, 'die zweite Begegnung schon auf Tiefe 25');
  assert.strictEqual(faellig(26), 'harren2');
  stand(QUELLE, { harren_abstieg_2: true });
  assert.strictEqual(faellig(29), 'harren1', 'ohne die erste kommt die zweite nicht zuerst');
});

const WACHE = (welle, gefunden) => ({
  schattenrat_finale: { status: 'completed', objectives: [] },
  mara_assault: { status: 'active', objectives: [
    { type: 'wave', target: 'reach_wave', current: welle, required: 30 },
    { type: 'observe', target: 'aldric_gefunden', current: gefunden ? 1 : 0, required: 1 }] }
});

test('Aldric erst bei Welle 30, und nur einmal', () => {
  stand(WACHE(29, false), {});
  assert.strictEqual(faellig(30), null, 'Aldric vor Welle 30');
  stand(WACHE(30, true), {});
  assert.strictEqual(faellig(30), null, 'Aldric ein zweites Mal');
  stand(WACHE(30, false), {});
  assert.strictEqual(faellig(30), 'aldric');
});

test('Aldrics Ende: Mara fuehrt Dich hin, Du sagst ihm, wer er war', () => {
  stand(WACHE(30, false), {});
  L.setDepth(30, 30);
  assert.strictEqual(begegnung(2, 'aldric_right0'), true, 'Aldric steht nicht im Raum');
  const t = gespraech('aldric_right0', 0).join('\n');
  assert.ok(/Mara wartet/.test(t), 'Mara fuehrt Dich nicht hin: ' + t);
  assert.ok(/Weisst Du, wer ich bin\?/.test(t), 'er fragt nicht, wer er ist');
  assert.strictEqual(flag('aldric_erzaehlt'), true);
  assert.strictEqual(flag('aldric_verschwiegen'), false);
  assert.strictEqual(H.run(`window.questSystem.isQuestReadyToComplete('mara_assault')`), true,
    'die letzte Wache ist nach der Begegnung nicht fertig');
  const ep = H.run(`window.QuestFinale.epilog(window.questSystem.getFlags(), 'de').join(' ')`);
  assert.ok(/Aldric lebt in einer Kammer/.test(ep), 'der Epilog kennt die Wahl nicht');
});

test('Aldrics Ende: Du schweigst', () => {
  stand(WACHE(30, false), {});
  L.setDepth(30, 30);
  assert.strictEqual(begegnung(2, 'aldric_right0'), true);
  gespraech('aldric_right0', 1);
  assert.strictEqual(flag('aldric_verschwiegen'), true);
  assert.strictEqual(flag('aldric_erzaehlt'), false);
  assert.strictEqual(H.run(`window.questSystem.isQuestReadyToComplete('mara_assault')`), true);
  const ep = H.run(`window.QuestFinale.epilog(window.questSystem.getFlags(), 'de').join(' ')`);
  assert.ok(/weiss nicht, dass es seiner ist/.test(ep), 'der Epilog kennt das Schweigen nicht');
});
