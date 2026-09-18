// tests/finaleQuelle.test.js — das Finale an der Quelle und der Konvoi (#158).
//
// Story-Bibel v5, Abschnitt 8/9. Geprueft am laufenden Spiel, mit den echten
// Dialogen (EventSystem.showEventChoiceDialog) und echten Knoepfen:
//   * Vor dem Kampf: Elara, Harren folgt, Harren stirbt  -> harren_dead
//   * Nach dem Kampf: verschonen oder richten           -> elara_spared/killed,
//     die letzte Quest ist erfuellt (Harren kann sie nicht mehr annehmen)
//   * Am Konvoi: still bleiben oder die Klinge ziehen    -> convoy_blown (#84)

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
let L = null;

before(async () => {
  H = await launchDungeon({ depth: 30 });
  L = H.lab;
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.__dialogLog = [];
    var echt = window.EventSystem.showEventChoiceDialog;
    window.EventSystem.showEventChoiceDialog = function (s, titel, wahlen) {
      window.__dialogLog.push({ text: String(titel || ''), wahlen: (wahlen || []).map(function (w) { return w.label; }) });
      return echt.apply(this, arguments);
    };
    window.__knoepfe = function () {
      return sc.children.list.filter(function (o) {
        return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled && o.active;
      });
    };
    window.__klick = function (n) {
      var k = window.__knoepfe()[n || 0];
      if (!k) return false;
      k.emit('pointerdown');
      return true;
    };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  L.clearEnemies();
  L.healPlayer();
  L.setDepth(30, 30);
  // Offene Dialoge vom Fall davor schliessen.
  for (let i = 0; i < 20 && H.run('!!window.eventChoiceOpen'); i++) { H.run('window.__klick(0)'); H.step(2); }
  H.run('window.__dialogLog.length = 0');
});

function stand(quests, flags) {
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests)};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
  })()`);
}
const FINALE_AKTIV = { schattenrat_finale: { status: 'active', objectives: [{ type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }] } };

/** Klickt Knopf n im offenen Dialog; gibt den Text des naechsten zurueck. */
function klick(n) {
  H.step(2);
  const ok = H.run(`window.__klick(${n || 0})`);
  assert.ok(ok, 'kein Knopf zum Klicken');
  H.step(2);
  return H.run(`(function () { var l = window.__dialogLog; return l.length ? l[l.length - 1] : null; })()`);
}
const flag = (n) => H.run(`window.questSystem.hasFlag('${n}')`);

test('Vor dem Kampf: Elara an der Quelle, Harren folgt ihr und stirbt', () => {
  stand(FINALE_AKTIV, {});
  const b = L.spawnBoss();
  assert.strictEqual(b.type, 'elaraBesessen');
  H.step(2);
  const erste = H.run('window.__dialogLog[0]');
  assert.ok(erste && /genau so weit gekommen/.test(erste.text), 'die Szene an der Quelle startet nicht: ' + JSON.stringify(erste));
  assert.strictEqual(H.run('!!window.eventChoiceOpen'), true, 'das Spiel laeuft waehrend der Szene weiter');

  let d = klick(0);
  assert.ok(/geführt werden/.test(d.text));
  d = klick(0);
  assert.ok(/HARREN: Lene/.test(d.text), 'Harren kommt nicht');
  d = klick(0);
  assert.ok(/steht nicht mehr auf/.test(d.text));
  assert.strictEqual(flag('harren_dead'), false, 'Harren stirbt schon, bevor man es gelesen hat');
  klick(0);
  assert.strictEqual(flag('harren_dead'), true, 'harren_dead nicht gesetzt');
});

test('Wer Harren schon hat sterben sehen, kommt direkt zum Kampf', () => {
  stand(FINALE_AKTIV, { harren_dead: true });
  L.spawnBoss();
  H.step(2);
  const log = H.run('window.__dialogLog.map(function (d) { return d.text; })');
  assert.ok(!log.some((t) => /genau so weit gekommen/.test(t)), 'die Szene spielt ein zweites Mal');
});

function elaraBesiegen() {
  L.spawnBoss();
  // Keine Vorkampf-Szene (harren_dead) — Elara direkt besiegen.
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    b.hp = 0;
    handleEnemyHit(sc, b, {});
  })()`);
  H.step(2);
}

test('Nach dem Kampf: verschonen — und die letzte Quest ist erfuellt', () => {
  stand(FINALE_AKTIV, { harren_dead: true, elara_trust: true });
  elaraBesiegen();
  let d = H.run('window.__dialogLog[window.__dialogLog.length - 1]');
  assert.ok(d && /Die Quelle zerbricht/.test(d.text), 'keine Szene nach dem Kampf: ' + JSON.stringify(d));
  d = klick(0);
  assert.ok(/Bis zuletzt/.test(d.text), 'ihre letzten Worte kennen das Vertrauen nicht: ' + d.text);
  d = klick(0);
  assert.strictEqual(JSON.stringify(d.wahlen), JSON.stringify(['Verschonen', 'Richten']));
  klick(0);
  assert.strictEqual(flag('elara_spared'), true);
  assert.strictEqual(flag('elara_killed'), false);
  klick(0);
  const status = H.run(`(window.questSystem.getQuestSaveData().quests.schattenrat_finale || {}).status`);
  assert.strictEqual(status, 'completed', 'die letzte Quest bleibt offen — Harren kann sie nicht mehr annehmen');
});

test('Nach dem Kampf: richten', () => {
  stand(FINALE_AKTIV, { harren_dead: true, zeichen_bemerkt: true });
  elaraBesiegen();
  let d = klick(0);
  assert.ok(/nie ganz getraut/.test(d.text));
  assert.ok(/Das Zeichen/.test(d.text), 'wer das Zeichen erkannt hat, dem sagt sie es');
  klick(0);
  klick(1);
  assert.strictEqual(flag('elara_killed'), true);
  assert.strictEqual(flag('elara_spared'), false);
});

test('Der Konvoi: wer die Klinge zieht, verbrennt Maras Netz (#84)', () => {
  stand({}, {});
  H.run('window.Finale.konvoi(window.game.scene.getScene("GameScene"))');
  H.step(2);
  const d = H.run('window.__dialogLog[window.__dialogLog.length - 1]');
  assert.strictEqual(JSON.stringify(d.wahlen), JSON.stringify(['Still bleiben', 'Die Klinge ziehen']));
  klick(1);
  assert.strictEqual(flag('convoy_blade_drawn'), true);
  assert.strictEqual(flag('convoy_blown'), true, 'convoy_blown wird nicht gesetzt');
  assert.strictEqual(H.run(`window.QuestFinale.computeFinaleState(window.questSystem.getFlags()).allies.mara`), false,
    'Mara hilft trotz verbranntem Netz');
  klick(0);
});

test('Der Konvoi: wer still bleibt, behaelt Mara', () => {
  stand({}, { petitions_kept: true });
  H.run('window.Finale.konvoi(window.game.scene.getScene("GameScene"))');
  H.step(2);
  klick(0);
  assert.strictEqual(flag('convoy_silent'), true);
  assert.strictEqual(flag('convoy_blown'), false);
  assert.strictEqual(H.run(`window.QuestFinale.computeFinaleState(window.questSystem.getFlags()).allies.mara`), true);
  klick(0);
  // Nur einmal: ein zweiter Durchgang fragt nicht noch einmal.
  assert.strictEqual(H.run('window.Finale.konvoi(window.game.scene.getScene("GameScene"))'), false);
});

test('Der Konvoi fragt, sobald das Abhoeren gelingt', () => {
  // Die echte Spionage-Mechanik: eine Abhoerzone mit dem Ziel convoy_intel
  // direkt am Spieler, ohne Wachen. Ist sie abgehoert, faellt die Entscheidung.
  stand({ espionage_convoy: { status: 'active', objectives: [{ type: 'observe', target: 'convoy_intel', current: 0, required: 1 }] } }, {});
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var E = window.EspionageSystem;
    E.startMission(sc, { missionId: 'test_konvoi', guards: [], cover: [],
      observeZones: [{ id: 'k', x: player.x, y: player.y, r: 200, seconds: 0.2, questTarget: 'convoy_intel' }] });
    for (var i = 0; i < 20; i++) E.update(sc, 0, 100);
    E.endMission();
    var l = window.__dialogLog;
    return l.length ? l[l.length - 1].wahlen : [];
  })()`);
  assert.strictEqual(JSON.stringify(r), JSON.stringify(['Still bleiben', 'Die Klinge ziehen']),
    'nach dem Abhoeren des Konvois kommt keine Entscheidung');
  klick(0);
  klick(0);
});

test('Andere Abhoerziele fragen nicht', () => {
  stand({}, {});
  const n = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var E = window.EspionageSystem;
    E.startMission(sc, { missionId: 'test_archiv', guards: [], cover: [],
      observeZones: [{ id: 'a', x: player.x, y: player.y, r: 200, seconds: 0.2, questTarget: 'archive_record' }] });
    for (var i = 0; i < 20; i++) E.update(sc, 0, 100);
    E.endMission();
    return window.__dialogLog.length;
  })()`);
  assert.strictEqual(n, 0, 'das Archiv stellt die Konvoi-Frage');
});
