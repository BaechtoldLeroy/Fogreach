// tests/rettungsSzene.test.js — Elaras Rettung als Zwischensequenz und ihr
// Rueckblick in der Ratskammer (Story-Kern v6.1, js/rettungsSzene.js).
//
// Die Rettung ist inszeniert. Beim ersten Sehen eine echte Rettung, im
// Rueckblick erkennbar gespielt. Drei Spuren:
//   1. Die Kettenwache weicht zurueck, BEVOR Elara zuschlaegt.
//   2. Ein Waechter mit rotem Helmbusch nickt ihr zu.
//   3. Sie nennt Dich "Archivschmied", obwohl Du es ihr nie gesagt hast.
// In der Maulwurf-Szene steht derselbe Waechter neben Aldric und Elara, und
// der Rueckblick hebt die drei Spuren hervor. Alte Spielstaende ohne die
// inszenierte Rettung bekommen eine allgemeine Fassung, ein Stand ganz ohne
// Rettung keinen Rueckblick.
//
// Gefahren wird der echte Weg: der Hinterhalt endet, weil die LP unter die
// Haelfte fallen; die Maulwurf-Szene laeuft ueber storyScenes, wie bei Maras
// Abgabe im Hub.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launch, launchDungeon } = require('../tools/headless/index.js');

const SC = `window.game.scene.getScene('GameScene')`;

describe('Die Rettung im Keller', () => {
  let H = null;
  before(async () => { H = await launchDungeon({ depth: 3 }); });
  after(async () => { if (H) await H.shutdown(); });

  const lage = () => H.run(`(function () {
    var z = ${SC}.__rettungsSzene;
    return z ? { phase: z.phase, protokoll: JSON.parse(JSON.stringify(z.protokoll)) } : null;
  })()`);

  /** Stand vor der ersten Begegnung, Hinterhalt im aktuellen Raum, bis die Wachen stehen. */
  function hinterhalt() {
    H.run(`(function () {
      var sc = ${SC};
      var qs = window.questSystem, st = qs.getQuestSaveData();
      st.quests = { harren_daughter_investigation: { status: 'completed', objectives: [] } };
      st.flags = {};
      qs.loadQuestSaveData(st);
      _resetElaraEncounterRunState();
      sc.__rettungsSzene = null;
      window.eventChoiceOpen = false;
      if (typeof window.resumeGameClock === 'function') window.resumeGameClock(sc);
      window._playerInvincible = true;
      playerHealth = playerMaxHealth;
      enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
      sc.children.list.filter(function (o) { return o.texture && /^elara_/.test(o.texture.key); })
        .forEach(function (o) { try { o.destroy(); } catch (x) {} });
      if (!window.__dlgOrig) {
        window.__dlgOrig = window.EventSystem.showEventChoiceDialog;
        window.EventSystem.showEventChoiceDialog = function (s, text, knoepfe) {
          (window.__dlg = window.__dlg || []).push({ text: text, knoepfe: knoepfe || [] });
          return window.__dlgOrig.apply(this, arguments);
        };
      }
      window.__dlg = [];
      _hinterhaltStarten(sc, sc.currentRoom.id);
      return 1;
    })()`);
    for (let i = 0; i < 60 && !H.run('!!(_hinterhalt && _hinterhalt.gesetzt)'); i++) H.step(6);
    assert.ok(H.run('!!(_hinterhalt && _hinterhalt.gesetzt)'), 'der Hinterhalt setzte keine Wachen');
  }

  /** Die LP fallen unter die Haelfte: der Hinterhalt endet wie im Spiel. */
  function inNot() {
    H.run('playerHealth = Math.floor(playerMaxHealth * 0.4); 1');
    for (let i = 0; i < 60 && !lage(); i++) H.step(2);
    const l = lage();
    assert.ok(l, 'die Zwischensequenz begann nicht');
    return l;
  }

  function bisPhase(ph, max) {
    for (let i = 0; i < (max || 600); i++) {
      const l = lage();
      if (l && l.phase === ph) return l;
      H.step(2);
    }
    return lage();
  }

  function abschliessen() {
    for (let i = 0; i < 600; i++) {
      const l = lage();
      if (!l || l.phase === 'fertig') return;
      if (l.phase === 'rede') H.run(`${SC}.__rettungsSzene.weiter(); 1`);
      H.step(2);
    }
  }

  test('Ein Waechter des Hinterhalts traegt den roten Helmbusch, und er folgt ihm', () => {
    hinterhalt();
    const r = H.run(`(function () {
      var g = _hinterhalt.gegner.filter(function (w) { return w && w._rettungsZeichen; });
      if (!g.length) return { anzahl: 0 };
      var w = g[0], b = w._helmbusch;
      var vorher = { x: b.x, y: b.y };
      w.x += 40; w.y += 25;
      return { anzahl: g.length, busch: !!(b && b.scene), vorher: vorher, w: { x: w.x, y: w.y } };
    })()`);
    assert.strictEqual(r.anzahl, 1, 'genau ein Waechter soll gezeichnet sein');
    assert.ok(r.busch, 'der Helmbusch fehlt');
    H.step(2);
    const nach = H.run(`(function () {
      var w = _hinterhalt.gegner.filter(function (x) { return x && x._rettungsZeichen; })[0];
      return { x: w._helmbusch.x, y: w._helmbusch.y };
    })()`);
    assert.ok(Math.abs(nach.x - r.vorher.x - 40) < 2 && Math.abs(nach.y - r.vorher.y - 25) < 2,
      'der Busch blieb stehen, als der Waechter ging: ' + JSON.stringify([r.vorher, nach]));
    H.run('_hinterhaltAbbrechen(); 1');
  });

  test('Die Rettung: die Wachen weichen vor dem Schlag, der Gezeichnete nickt, sie nennt Dich Archivschmied', () => {
    hinterhalt();
    const start = inNot();
    assert.strictEqual(start.phase, 'auftritt');
    assert.ok(H.run('window.__GAME_PAUSE.since != null'), 'die Spieluhr laeuft waehrend der Zwischensequenz');

    // Bewegung der Wachen Bild fuer Bild mitschreiben, bis sie spricht.
    const spur = [];
    for (let i = 0; i < 400; i++) {
      const z = H.run(`(function () {
        var z = ${SC}.__rettungsSzene;
        var g = z.gezeichnet, andere = z.wachen.filter(function (w) { return w !== g && w.scene; });
        return { phase: z.phase, n: z.protokoll.length, gy: g && g.scene ? g.y : null,
          ay: andere.length ? andere[0].y : null, alpha: g && g.scene ? g.alpha : 0,
          elara: !!(z.elara && z.elara.alpha > 0.5) };
      })()`);
      spur.push(z);
      if (z.phase === 'rede') break;
      H.step(1);
    }
    const l = lage();
    assert.strictEqual(l.phase, 'rede', 'sie kam nie zu Wort');
    const p = (w) => l.protokoll.filter((e) => e.was === w)[0];
    ['beginn', 'rueckzug_beginnt', 'rueckzug', 'auftritt', 'nicken', 'schlag', 'rede'].forEach((w) => assert.ok(p(w), 'kein Takt ' + w));

    // 1. Zurueck, bevor sie zuschlaegt — und bevor sie ueberhaupt da ist.
    assert.ok(p('rueckzug_beginnt').t < p('auftritt').t, 'die Wachen weichen erst, als sie schon da ist');
    assert.ok(p('rueckzug').t < p('schlag').t, 'der Rueckzug ist nicht vor dem Schlag fertig');
    assert.ok(p('rueckzug').abstand > p('beginn').abstand + 30,
      'die Wachen sind nicht zurueckgewichen: ' + p('beginn').abstand + ' -> ' + p('rueckzug').abstand);
    assert.ok(p('schlag').abstand >= p('rueckzug').abstand - 2,
      'beim Schlag standen sie nicht mehr zurueck');

    // 2. Das Nicken: nur der Gezeichnete bewegt sich, zwischen Auftritt und Schlag.
    const mitte = spur.filter((s) => s.elara && s.gy !== null && s.alpha > 0.9);
    assert.ok(mitte.length > 5, 'Elara und der Gezeichnete standen nie zusammen im Bild');
    const gy = mitte.map((s) => s.gy), ay = mitte.map((s) => s.ay).filter((x) => x !== null);
    assert.ok(Math.max(...gy) - Math.min(...gy) >= 2, 'der Gezeichnete nickt nicht');
    if (ay.length) assert.ok(Math.max(...ay) - Math.min(...ay) < 0.5, 'die anderen Wachen nicken mit');
    assert.strictEqual(p('nicken').wache, H.run(`${SC}.__rettungsSzene.wachen.indexOf(${SC}.__rettungsSzene.gezeichnet)`));
    assert.ok(H.run(`${SC}.__rettungsSzene.gezeichnet._rettungsZeichen === true`), 'es nickt nicht der mit dem Helmbusch');

    // 3. Ihre Zeile.
    assert.match(p('rede').text, /Archivschmied/);
    H.run(`${SC}.__rettungsSzene.weiter(); 1`);
    H.step(20);
    assert.ok(H.run(`${SC}.children.list.some(function (o) { return o.type === 'Text' && o.visible && /Steh auf, Archivschmied/.test(o.text); })`),
      'die Zeile steht nicht auf dem Bildschirm');

    abschliessen();
    assert.strictEqual(lage().phase, 'fertig');
    assert.ok(H.run('window.__GAME_PAUSE.since == null || window.eventChoiceOpen'), 'die Spieluhr bleibt stehen');
    assert.ok(H.run(`questSystem.hasFlag('rettung_inszeniert') && questSystem.hasFlag('elara_rettung_gesehen')`), 'Flaggen fehlen');
    assert.ok(H.run(`${SC}.children.list.some(function (o) { return o.active && o.texture && o.texture.key === 'elara_right0'; })`),
      'Elara steht danach nicht mit [E] im Raum');
    const dlg = H.run('(window.__dlg || []).map(function (d) { return d.text; })');
    assert.ok(dlg.length && /Du lebst/.test(dlg[0]), 'ihr Dialog folgt nicht: ' + dlg[0]);
    assert.ok(H.run(`enemies.getChildren().filter(function (e) { return e && e.active && e._hinterhalt && !e._vomNebelVertrieben; }).length`) === 0,
      'Wachen stehen noch');
  });

  test('Ueberspringen nur bewusst: Taste und Klick blaettern nichts weg, ESC springt zu ihrer Zeile', () => {
    hinterhalt();
    inNot();
    H.step(3);
    H.run(`(function () {
      var sc = ${SC};
      sc.input.keyboard.emit('keydown', { key: ' ', code: 'Space', keyCode: 32 });
      sc.input.emit('pointerdown', {});
      return 1;
    })()`);
    H.step(2);
    let l = lage();
    assert.strictEqual(l.phase, 'auftritt', 'eine gewoehnliche Eingabe hat die Szene beendet oder verkuerzt');
    assert.ok(!l.protokoll.some((e) => e.was === 'rede' || e.was === 'uebersprungen'), 'die Szene sprang weiter');
    H.run(`${SC}.input.keyboard.emit('keydown', { key: 'Escape', code: 'Escape', keyCode: 27 }); 1`);
    l = lage();
    assert.strictEqual(l.phase, 'rede', 'ESC fuehrt nicht zu ihrer Zeile (' + l.phase + ')');
    assert.ok(l.protokoll.some((e) => e.was === 'uebersprungen'));
    assert.ok(l.protokoll.some((e) => e.was === 'schlag'), 'beim Ueberspringen fiel der Schlag aus');
    assert.ok(H.run(`!!(${SC}.__rettungsSzene.elara && ${SC}.__rettungsSzene.elara.alpha === 1)`), 'Elara fehlt nach dem Ueberspringen');
    abschliessen();
    assert.strictEqual(lage().phase, 'fertig');
  });

  test('Die Rettung spielt nur einmal: danach wartet Elara ohne neuen Hinterhalt', () => {
    const r = H.run(`(function () {
      var sc = ${SC};
      var vorher = sc.__rettungsSzene;
      _resetElaraEncounterRunState();
      _maybeFireElaraCellarEncounter(sc, 5);
      return { gleich: sc.__rettungsSzene === vorher, hinterhalt: !!_hinterhalt,
        gesehen: questSystem.hasFlag('rettung_inszeniert') };
    })()`);
    assert.ok(r.gesehen, 'Aufbau: die Rettung war nicht');
    assert.strictEqual(r.hinterhalt, false, 'ein zweiter Hinterhalt');
    assert.strictEqual(r.gleich, true, 'eine zweite Zwischensequenz');
  });
});

describe('Der Rueckblick in der Ratskammer', () => {
  let H = null;
  const HUB = `window.game.scene.getScene('HubSceneV2')`;
  before(async () => {
    H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'HubSceneV2 nicht erreicht');
    H.step(10);
    // Die Prolog-Karte eines frischen Spiels liegt sonst darueber.
    for (let i = 0; i < 4; i++) { H.run(`${HUB}.input.keyboard.emit('keydown-ESC', {}); 1`); H.step(20); }
    // Die Auswahl am Ende der Szene gleich beantworten.
    H.run(`(function () {
      window.__praesentiert = [];
      var echt = window.DialogChoice.present;
      window.DialogChoice.present = function (sc, cfg) {
        window.__praesentiert.push(cfg && cfg.prompt);
        if (cfg && typeof cfg.onResolved === 'function') cfg.onResolved(null);
        return { destroy: function () {} };
      };
      window.DialogChoice.__echt = echt;
      return 1;
    })()`);
  });
  after(async () => { if (H) await H.shutdown(); });

  /** Stand setzen und die Maulwurf-Szene starten; liefert den Text der ersten Seite. */
  function szene(art) {
    H.run(`(function () {
      var qs = window.questSystem, sc = ${HUB};
      qs.setFlag('rettung_inszeniert', ${art === 'voll'});
      qs.setFlag('elara_rettung_gesehen', ${art !== 'keiner'});
      qs.setFlag('elaraMet', ${art !== 'keiner'});
      sc.__rueckblick = null; sc.__szeneWartet = null;
      window.__fertig = false; window.__praesentiert = [];
      window.storyScenes.playMaulwurfEnthuellung(sc, function () { window.__fertig = true; });
      return 1;
    })()`);
    for (let i = 0; i < 300 && !H.run(`!!${HUB}.__szeneWartet`); i++) H.step(3);
    return seite();
  }
  const seite = () => H.run(`${HUB}.children.list.filter(function (o) {
    return o.type === 'Text' && o.depth === 1550 && o.active; }).map(function (o) { return o.text; }).join(' | ')`);
  const rb = () => H.run(`(function () { var r = ${HUB}.__rueckblick; return r ? { phase: r.phase,
    protokoll: JSON.parse(JSON.stringify(r.protokoll)) } : null; })()`);
  function bisWarten() {
    for (let i = 0; i < 600; i++) {
      const w = H.run(`(function () { var r = ${HUB}.__rueckblick; return r ? (r.phase === 'fertig' ? 'fertig' : (r.wartet() ? 'wartet' : 'laeuft')) : 'keiner'; })()`);
      if (w !== 'laeuft') return w;
      H.step(2);
    }
    return 'haengt';
  }
  function weiter() { H.run(`${HUB}.__rueckblick.weiter(); 1`); }

  test('Voll: derselbe Waechter steht neben ihnen, die Rettung kommt entsaettigt mit den drei Spuren zurueck', () => {
    const erste = szene('voll');
    assert.match(erste, /Helmbusch/, 'der Waechter steht nicht in der Ratskammer: ' + erste);
    assert.match(erste, /Aldric steht am Tisch/);
    H.run(`${HUB}.__szeneWartet.ausloesen(); 1`);
    assert.strictEqual(bisWarten(), 'wartet', 'der Rueckblick beginnt nicht');
    // Die Gegenwart: der Waechter mit dem roten Busch.
    assert.strictEqual(rb().phase, 'jetzt');
    assert.ok(H.run(`!!(${HUB}.__rueckblick.buschJetzt && ${HUB}.__rueckblick.buschJetzt.scene)`), 'kein Helmbusch in der Ratskammer');

    weiter();
    assert.strictEqual(bisWarten(), 'wartet');
    let r = rb();
    assert.strictEqual(r.phase, 'rueckzug');
    assert.ok(r.protokoll.some((e) => e.was === 'hervorgehoben' && e.phase === 'rueckzug' && e.ringe === 4), 'der Rueckzug ist nicht hervorgehoben');
    // Elara ist noch nicht da: sie weichen, bevor sie kommt.
    const box = H.run(`(function () {
      var r = ${HUB}.__rueckblick, g = r.gezeichnet;
      var box = g.parentContainer;
      return { elara: box.list.some(function (o) { return o.texture && /^elara_/.test(o.texture.key); }),
        aussen: r.wachen.every(function (w) { return Math.hypot(w.x, w.y) > 0; }) };
    })()`);
    assert.strictEqual(box.elara, false, 'Elara steht schon da, waehrend die Wachen weichen');

    weiter();
    assert.strictEqual(bisWarten(), 'wartet');
    r = rb();
    assert.strictEqual(r.phase, 'nicken', 'kein Nicken im vollen Rueckblick');
    assert.ok(r.protokoll.some((e) => e.was === 'hervorgehoben' && e.phase === 'nicken' && e.rot), 'das Nicken ist nicht hervorgehoben');
    assert.ok(H.run(`${HUB}.__rueckblick.gezeichnet.parentContainer.scale > 1.5`), 'kein Heranholen an den Waechter');
    assert.ok(H.run(`!!(${HUB}.__rueckblick.busch && ${HUB}.__rueckblick.busch.scene)`), 'der Gezeichnete traegt im Rueckblick keinen Busch');

    weiter();
    assert.strictEqual(bisWarten(), 'wartet');
    r = rb();
    assert.strictEqual(r.phase, 'name');
    assert.ok(r.protokoll.some((e) => e.was === 'hervorgehoben' && e.phase === 'name' && /Archivschmied/.test(e.text)));
    assert.ok(H.run(`${HUB}.children.list.some(function (o) { return o.type === 'Text' && o.text === 'Archivschmied' && o.active; })`),
      'das Wort ist nicht hervorgehoben');
    assert.match(r.protokoll[r.protokoll.length - 1].text, /nie gesagt, wer Du bist/);

    weiter();
    assert.strictEqual(bisWarten(), 'fertig');
    for (let i = 0; i < 300 && !H.run(`!!${HUB}.__szeneWartet`); i++) H.step(3);
    const rest = seite();
    assert.match(rest, /Ring: drei Ketten/, 'nach dem Rueckblick geht die Szene nicht weiter: ' + rest);
    H.run(`${HUB}.__szeneWartet.ausloesen(); 1`);
    H.step(3);
    assert.strictEqual(H.run('window.__fertig'), true, 'die Szene kam nicht zum Ende');
    assert.ok(H.run(`questSystem.hasFlag('rueckblick_rettung_gesehen')`));
  });

  test('Alter Spielstand ohne inszenierte Rettung: allgemeiner Rueckblick ohne Helmbusch und Nicken', () => {
    const erste = szene('allgemein');
    assert.match(erste, /Kettenwächter/);
    assert.ok(!/Helmbusch/.test(erste), 'ein alter Stand kennt den Helmbusch nicht');
    H.run(`${HUB}.__szeneWartet.ausloesen(); 1`);
    const phasen = [];
    for (let k = 0; k < 6; k++) {
      const w = bisWarten();
      if (w !== 'wartet') break;
      phasen.push(rb().phase);
      weiter();
    }
    assert.deepStrictEqual(phasen.join(','), 'jetzt,rueckzug,name', 'Phasen: ' + phasen.join(','));
    assert.strictEqual(H.run(`!!${HUB}.__rueckblick.buschJetzt`), false);
    assert.ok(rb().protokoll.some((e) => e.phase === 'name' && e.text === 'Du. Der Archivschmied.'),
      'die Zeile eines alten Standes ist die aus dem Gespraech');
    for (let i = 0; i < 300 && !H.run(`!!${HUB}.__szeneWartet`); i++) H.step(3);
    H.run(`${HUB}.__szeneWartet.ausloesen(); 1`);
    H.step(3);
    assert.strictEqual(H.run('window.__fertig'), true);
  });

  test('Ganz ohne Rettung im Stand: kein Waechter, kein Rueckblick, die Szene laeuft wie bisher', () => {
    const erste = szene('keiner');
    assert.ok(!/Kettenwächter/.test(erste), 'ein Waechter ohne Rettung: ' + erste);
    assert.match(erste, /Ring: drei Ketten/, 'die Szene steht nicht auf einer Seite');
    H.run(`${HUB}.__szeneWartet.ausloesen(); 1`);
    H.step(5);
    assert.strictEqual(H.run(`${HUB}.__rueckblick`), null, 'ein Rueckblick ohne Rettung');
    assert.strictEqual(H.run('window.__fertig'), true);
  });
});
