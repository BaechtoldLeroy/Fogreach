// Regression: Fehlerflut beim Verlassen des Tiefenwahl-Dialogs.
//
// Gemeldet aus dem Spiel (Tiefe 11 betreten, danach Maus bewegt), 32-mal:
//   TypeError: Cannot read properties of null (reading 'setSize')
//     at applyScroll (HubSceneV2.js:2729)
//     at _wavePointerMove (HubSceneV2.js:2759)
//     at processMoveEvents / onMouseMove
//
// Zwei Ursachen, die zusammenwirken:
//
// 1) applyScroll prueft nur `if (thumb)`. Ein zerstoertes Phaser-Objekt ist
//    weiterhin truthy — setSize greift danach auf eine null-Geometrie zu.
//    Dieselbe Falle wie beim Mobile-Absturz (glTexture, mobileAbilityButtons).
//
// 2) cleanup begann mit `if (!container.active) return;` — VOR dem Abmelden
//    der Zeiger-Handler. War der Container schon zerstoert, blieben
//    pointermove & Co. registriert und feuerten weiter. Verschaerft dadurch,
//    dass die Handler auf `this` liegen: beim zweiten Oeffnen wird die
//    Referenz ueberschrieben, der alte Listener ist dann nicht mehr
//    abmeldbar.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const QUELLE = fs.readFileSync(path.join(__dirname, '..', 'js', 'scenes', 'HubSceneV2.js'), 'utf8')
  .split(String.fromCharCode(13)).join('');

test('applyScroll prueft den Rollbalken auf Lebendigkeit, nicht nur auf Existenz', () => {
  const i = QUELLE.indexOf('const applyScroll = ');
  assert.ok(i >= 0, 'applyScroll nicht gefunden');
  const block = QUELLE.slice(i, i + 900);
  assert.match(block, /if\s*\(\s*thumb\s*&&\s*thumb\.scene\s*\)/,
    'nur "if (thumb)" — ein zerstoertes Objekt ist truthy und laesst setSize auf null laufen');
});

test('cleanup meldet die Zeiger-Handler VOR dem vorzeitigen Ausstieg ab', () => {
  let i = -1, von = 0;
  for (;;) {
    const k = QUELLE.indexOf('const cleanup = () => {', von);
    if (k < 0) break;
    if (QUELLE.slice(k, k + 1400).includes('_wavePointerMove')) { i = k; break; }
    von = k + 1;
  }
  assert.ok(i >= 0, 'cleanup des Tiefenwahl-Dialogs nicht gefunden');
  const block = QUELLE.slice(i, i + 1400)
    .split(String.fromCharCode(10))
    .filter((z) => !z.trim().startsWith('//'))
    .join(String.fromCharCode(10));
  const iAus = block.indexOf('if (!container.active) return;');
  const iMove = block.indexOf("this.input.off('pointermove'");
  assert.ok(iAus >= 0, 'der vorzeitige Ausstieg fehlt ganz');
  assert.ok(iMove >= 0, 'pointermove wird nirgends abgemeldet');
  assert.ok(iMove < iAus,
    'der Ausstieg steht vor dem Abmelden — bei zerstoertem Container bleiben die '
    + 'Handler registriert und feuern auf zerstoerte Objekte');
});
