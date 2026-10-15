// tests/druckereiVerdacht.test.js — Die Druckerei sagt, was der Verdacht bewirkt.
//
// Der Council-Verdacht ist keine Waehrung, sondern ein Gegengewicht: ab 10
// kommen mehr Elite-Gegner, ab 20 verweigert Aldric neue Auftraege
// (printingHouse.getRetaliationTier). Das Menue zeigte nur eine Zahl. Jetzt
// steht der Zustand an der Plakette, und ein Hinweis (Ueberfahren/Tipp)
// nennt die Regeln. Die alte Textfassung der Druckerei
// (HubSceneV2._showPrintingHouseDialog) ist entfernt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch, flush } = require('../tools/headless/index.js');

const HUB = "window.game.scene.getScene('HubSceneV2')";
const PH = "window.game.scene.getScene('PrintingHouseScene')";
let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&debug=1', renderer: 'canvas' });
  await H.waitForScene('HubSceneV2', { maxRounds: 600 });
  H.run(`(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')`);
  for (let i = 0; i < 20; i++) { H.step(2); await flush(); }
});
after(async () => { if (H) await H.shutdown(); });

async function oeffnen(verdacht) {
  H.run(`(function () {
    var ph = window.PrintingHouse;
    ph.addSuspicion(-ph.getSuspicion()); ph.addSuspicion(${verdacht});
    var p = ${PH}; if (p && p.sys.isActive()) p.scene.stop();
    window.openPrintingHouseScene(${HUB});
  })()`);
  // Warten, bis die NEUE Ansicht steht (die angezeigte Zahl stimmt), nicht die gerade geschlossene.
  for (let i = 0; i < 300 && !H.run(`!!(${PH} && ${PH}.sys.isActive() && ${PH}.children.list.some(function (o) { return o.name === 'druckWertVerdacht' && o.text === '${verdacht}'; }))`); i++) {
    H.step(2); await flush();
  }
}
const label = () => H.run(`${PH}.children.list.filter(function (o) { return o.name === 'druckLabelVerdacht'; })[0].text`);

test('Zustand an der Plakette: ruhig ohne Zusatz, ab 10 wachsam, ab 20 Jagd', async () => {
  await oeffnen(3);
  assert.ok(!/:/.test(label()), 'Zusatz bei niedrigem Verdacht: ' + label());
  await oeffnen(12);
  assert.ok(/WACHSAM/.test(label()), 'ab 10: ' + label());
  await oeffnen(22);
  assert.ok(/JAGD/.test(label()), 'ab 20: ' + label());
});

test('Hinweis beim Ueberfahren und per Tipp nennt Elite-Gegner und Aldric', async () => {
  await oeffnen(12);
  const r = H.run(`(function () {
    var p = ${PH};
    var zone = p.children.list.filter(function (o) { return o.name === 'druckVerdachtZone'; })[0];
    var hint = p.children.list.filter(function (o) { return o.name === 'druckVerdachtHinweis'; })[0];
    var vorher = hint.visible;
    zone.emit('pointerover');
    var ueber = hint.visible;
    zone.emit('pointerout');
    var raus = hint.visible;
    zone.emit('pointerdown');
    var tipp = hint.visible;
    return { vorher: vorher, ueber: ueber, raus: raus, tipp: tipp, text: hint.text };
  })()`);
  assert.deepStrictEqual([r.vorher, r.ueber, r.raus, r.tipp], [false, true, false, true]);
  assert.ok(/Elite/.test(r.text) && /Aldric/.test(r.text), 'Hinweis: ' + r.text);
});

test('Die alte Textfassung der Druckerei ist weg', () => {
  const hub = fs.readFileSync(path.join(__dirname, '..', 'js', 'scenes', 'HubSceneV2.js'), 'utf8');
  assert.ok(!/_showPrintingHouseDialog/.test(hub), 'HubSceneV2._showPrintingHouseDialog steht noch drin');
});
