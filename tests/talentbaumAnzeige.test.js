// tests/talentbaumAnzeige.test.js — der Talentbaum erklaert seine Stufen (#175).
//
// Seit #175 geht der Baum ueber das ganze Spiel auf (Lv 1/5/9/14/20/26), und
// die Straenge oeffnen gestaffelt (erster frei, zweiter ab Lv 6, dritter ab
// Lv 12). Das muss der Bildschirm sagen, sonst steht man vor grauen Karten:
//   - die Erklaerzeile unten nennt die naechste Freischaltung,
//   - der Kopf jedes Strangs nennt seinen Zustand,
//   - gesperrte Karten nennen das Level,
//   - ein Klick auf einen gesperrten Knoten nennt den GRUND.
// Geprueft am echten Bildschirm (SkillTreeScene ueber dem Hub).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas' });
  await H.waitForScene('HubSceneV2', { maxRounds: 600 });
  H.step(30);
});
after(async () => { if (H) await H.shutdown(); });

/** Oeffnet den Talentbaum mit Level und Raengen und liefert alle Texte. */
function oeffnen(level, ranks, punkte) {
  H.run(`(function () {
    window.playerLevel = ${level};
    window.SkillTree.loadSaveData({ skillPoints: ${punkte || 0}, ranks: ${JSON.stringify(ranks || {})} });
    var gm = window.game.scene;
    if (gm.isActive('SkillTreeScene')) gm.getScene('SkillTreeScene').scene.stop();
  })()`);
  H.step(3);
  H.run(`window.openSkillTreeScene(window.game.scene.getScene('HubSceneV2'))`);
  H.step(5);
  return texte();
}

function texte() {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('SkillTreeScene');
    return sc.children.list.filter(function (o) { return o.type === 'Text' && o.visible; })
      .map(function (o) { return o.text; });
  })()`);
}

test('frisch auf Level 1: jeder Strang ist frei waehlbar, die Regel steht unten', () => {
  const t = oeffnen(1, {}, 1);
  assert.strictEqual(t.filter((x) => x === 'frei wählbar').length, 3, 'nicht alle drei Straenge frei: ' + t.join(' | '));
  assert.ok(t.some((x) => /Der zweite öffnet ab Lv 6, der dritte ab Lv 12/.test(x)), 'die Strang-Regel steht nirgends');
  assert.ok(t.some((x) => x === 'ab Lv 9'), 'gesperrte Karten nennen ihr Level nicht');
});

test('ein offener Strang auf Level 3: die anderen nennen Lv 6, unten die naechste Stufe', () => {
  const t = oeffnen(3, { charge: 1 }, 1);
  assert.ok(t.includes('geöffnet'), 'der offene Strang sagt es nicht');
  assert.strictEqual(t.filter((x) => x === '2. Strang ab Lv 6').length, 2, 'Lv 6 fuer den zweiten Strang fehlt: ' + t.join(' | '));
  assert.ok(t.some((x) => /Nächste Freischaltung: Lv 5/.test(x)), 'die naechste Freischaltung fehlt');
});

test('ein Klick auf einen gesperrten Einstieg nennt den Grund', () => {
  oeffnen(3, { charge: 1 }, 1);
  H.run(`(function () {
    var sc = window.game.scene.getScene('SkillTreeScene');
    sc._tryInvest(window.SkillTree.getNode('hammer'));
  })()`);
  H.step(1);
  assert.ok(texte().some((x) => x === '2. Strang erst ab Level 6'), 'der Grund fehlt: ' + texte().join(' | '));
});

test('ab Level 6 ist der zweite Strang waehlbar, nicht "offen"', () => {
  const t = oeffnen(7, { charge: 2 }, 1);
  assert.strictEqual(t.filter((x) => x === '2. Strang wählbar').length, 2, t.join(' | '));
});
