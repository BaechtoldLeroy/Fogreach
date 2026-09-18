// tests/orteQuelle.test.js — die Quelle als eigene Finalarena, Gebietsnamen (#161).
//
// Story-Bibel v5, Abschnitt 11: Das Finale liegt unten an der Quelle, nicht in
// einem gewoehnlichen Bossraum. Und die Tiefen bekommen Namen: Rathauskeller,
// Katakomben ab Akt 2, Ritualebene ab Akt 3.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launchDungeon({ depth: 30 });
});
after(async () => { if (H) await H.shutdown(); });

function stand(quests, flags) {
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests)};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
  })()`);
}
const FINALE_AKTIV = { schattenrat_finale: { status: 'active', objectives: [{ type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }] } };

function neuerLauf(tiefe) {
  return H.run(`(function () {
    window.DUNGEON_DEPTH = ${tiefe};
    if (typeof currentWave !== 'undefined') currentWave = ${tiefe};
    initDungeonRun();
    return dungeonRun.templateOrder.slice();
  })()`);
}

test('Auf Tiefe 30 endet der Lauf an der Quelle, solange die letzte Quest laeuft', () => {
  stand(FINALE_AKTIV, { harren_dead: true });
  const reihe = neuerLauf(30);
  assert.strictEqual(reihe[reihe.length - 1], 'DieQuelle', 'Finalraum: ' + reihe[reihe.length - 1]);
});

test('Jede Boss-Tiefe endet in ihrer Arena, auch nach dem Trim', () => {
  // Frueher schnitt der Trim die angehaengte Arena ab, weil die prozeduralen
  // Raeume den Lauf immer verlaengern — der Boss stand in einem Zufallsraum.
  stand({}, {});
  const arenen = { 10: 'PrisonDepths', 20: 'RitualVault', 30: 'CouncilChamber' };
  for (const [t, arena] of Object.entries(arenen)) {
    for (let i = 0; i < 5; i++) {
      const reihe = neuerLauf(Number(t));
      assert.strictEqual(reihe[reihe.length - 1], arena, 'Tiefe ' + t + ': ' + reihe.join(', '));
    }
  }
});

test('Die Quelle erscheint nie als gewoehnlicher Raum', () => {
  stand({}, {});
  // 40 Laeufe: ein Zufallsraum zieht bei ~30 Vorlagen etwa jeden vierten
  // Lauf eine bestimmte Vorlage — vier Laeufe haetten nichts bewiesen.
  for (let i = 0; i < 40; i++) {
    const t = [12, 25, 30, 33][i % 4];
    const reihe = neuerLauf(t);
    assert.ok(!reihe.includes('DieQuelle'), 'Tiefe ' + t + ': ' + reihe.join(', '));
  }
});

test('In der Arena leuchtet die Quelle — und erlischt nach dem Kampf', () => {
  stand(FINALE_AKTIV, { harren_dead: true });
  const reihe = neuerLauf(30);
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enterRoom(sc, ${reihe.length - 1});
    var g = sc._quelleGlow;
    return { da: !!(g && g.active), text: sc._raumBeschriftung };
  })()`);
  assert.strictEqual(r.da, true, 'die Quelle ist nicht zu sehen');
  assert.ok(/Die Quelle/.test(r.text || ''), 'keine Beschriftung: ' + r.text);

  H.run(`window.Finale.nachKampf(window.game.scene.getScene('GameScene'))`);
  const nachher = H.run(`(function () { var g = window.game.scene.getScene('GameScene')._quelleGlow; return !!(g && g.active); })()`);
  assert.strictEqual(nachher, false, 'die Quelle leuchtet nach dem Kampf weiter');
  // Dialog schliessen
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    for (var i = 0; i < 10 && window.eventChoiceOpen; i++) {
      var k = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled && o.active; })[0];
      if (!k) break; k.emit('pointerdown');
    }
  })()`);
});

test('Die Tiefen tragen Namen: Rathauskeller, Katakomben, Ritualebene', () => {
  const n = (t, a, l) => H.run(`window.gebietsName(${t}, ${a}, '${l || 'de'}')`);
  assert.strictEqual(n(3, 0), 'Rathauskeller');
  assert.strictEqual(n(12, 1), 'Rathauskeller', 'Katakomben vor dem Doppelspiel');
  assert.strictEqual(n(12, 2), 'Katakomben');
  assert.strictEqual(n(24, 2), 'Katakomben', 'Ritualebene vor der Enttarnung');
  assert.strictEqual(n(24, 3), 'Ritualebene');
  assert.strictEqual(n(12, 2, 'en'), 'The Catacombs');
});

test('Der erste Raum eines Laufs sagt, wo man ist', () => {
  stand({}, {});
  H.run(`window.storySystem && window.storySystem.getCurrentActIndex`);
  neuerLauf(12);
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enterRoom(sc, 0);
    return { text: sc._raumBeschriftung, akt: window.storySystem.getCurrentActIndex() };
  })()`);
  const erwartet = r.akt >= 2 ? 'Katakomben' : 'Rathauskeller';
  assert.ok(new RegExp(erwartet + ' — Tiefe 12').test(r.text || ''), 'Akt ' + r.akt + ': ' + r.text);
});
