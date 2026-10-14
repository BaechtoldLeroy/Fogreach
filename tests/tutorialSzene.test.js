// tests/tutorialSzene.test.js — Tutorial-Schritte erscheinen nur in ihrer
// Szene; ein neues Spiel zeigt die Einfuehrung (= Akt-1-Karte) wieder.
//
// Gemeldet: "es kommt die aufgabe anzugreifen bereits im hub". Der Schritt
// combat.basics gehoert in die GameScene (STEPS[].scene), das Overlay des
// Hubs zeigte aber jeden aktuellen Schritt — nach dem Gespraech mit Aldric
// stand "Greif an" im Hub.
//
// Gemeldet: "Wann erscheint der akt wechsel in den ersten akt?" — mit
// ?autostart=1 nie: clearSave loeschte den Spielstand, aber nicht das
// Merkzeichen demonfall_seen_intro_splash, und am Einfuehrungstext haengt
// seit b424 die Karte von Akt 1.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
const hub = `window.game.scene.getScene('HubSceneV2')`;

before(async () => {
  H = await launch();
  await H.waitForScene('HubSceneV2', { timeoutMs: 60000 });
  for (let i = 0; i < 5; i++) await H.step(1);
});
after(async () => { if (H) await H.shutdown(); });

test('Tutorial: ein Schritt der GameScene erscheint nicht im Hub', () => {
  const r = H.run(`(function () {
    var sc = ${hub};
    var ov = window.TutorialOverlay.create(sc);
    var ergebnis = [];
    ov._renderBanner({ id: 'combat.basics', scene: 'GameScene', hintKey: 'tutorial.step.combat_basics', targetRef: null });
    ergebnis.push(ov.banner ? 'banner' : 'leer');
    ov._renderBanner({ id: 'quest.dialog', scene: 'HubSceneV2', hintKey: 'tutorial.step.quest_dialog', targetRef: null });
    ergebnis.push(ov.banner ? 'banner' : 'leer');
    ov._renderBanner({ id: 'journal.hint', scene: null, hintKey: 'tutorial.step.quest_dialog', targetRef: null });
    ergebnis.push(ov.banner ? 'banner' : 'leer');
    ov._destroyBanner();
    return ergebnis.join(',');
  })()`);
  assert.strictEqual(r, 'leer,banner,banner', 'Hub: GameScene-Schritt / Hub-Schritt / ueberall: ' + r);
});

test('Tutorial: das Ziel eines fremden Schritts wird im Hub nicht markiert', () => {
  const r = H.run(`(function () {
    var sc = ${hub};
    var ov = window.TutorialOverlay.create(sc);
    ov._renderHighlight({ id: 'x', scene: 'GameScene', targetRef: { type: 'npc', name: 'Aldric' } });
    var fremd = !!ov.highlight;
    ov._renderHighlight({ id: 'quest.dialog', scene: 'HubSceneV2', targetRef: { type: 'npc', name: 'Aldric' } });
    var eigen = ov.currentTargetRef;
    ov._destroyHighlight();
    return fremd + '|' + eigen;
  })()`);
  assert.strictEqual(r, 'false|npc::Aldric');
});

test('Neues Spiel: clearSave setzt die Einfuehrung (Akt-1-Karte) zurueck', () => {
  const r = H.run(`(function () {
    var st = window.SlotStorage || localStorage;
    st.setItem('demonfall_seen_intro_splash', '1');
    window.clearSave();
    return st.getItem('demonfall_seen_intro_splash');
  })()`);
  assert.strictEqual(r, null, 'das Merkzeichen der Einfuehrung ueberlebt das Loeschen des Spielstands');
});
