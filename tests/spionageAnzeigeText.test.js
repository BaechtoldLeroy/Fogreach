// tests/spionageAnzeigeText.test.js — die Spionage-Anzeige zeichnet ihre
// Texte nur neu, wenn sich etwas aendert.
//
// EspionageVisuals.sync laeuft jedes Bild und rief setColor auf Banner,
// Status-Chip und Marken. Phaser zeichnet einen Text bei JEDEM setColor neu
// und laedt ihn als Textur hoch, auch bei gleicher Farbe (setText prueft
// selbst). Im Profil auf gebremster CPU: texImage2D und measureText (b528).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

const GS = "window.game.scene.getScene('GameScene')";
let H = null;

before(async () => {
  H = await launchDungeon({ depth: 3, zusatz: '&debug=1&spy=lager' });
  H.run('window._playerInvincible = true; window.SpionageSzenen._TEMPO = 0.2');
  for (let i = 0; i < 400; i++) {
    if (H.run(`!!(${GS}.__spionSzene && ${GS}.__spionSzene.art === 'start')`)) break;
    H.step(2); await flush();
  }
  H.run(`${GS}.__spionSzene && ${GS}.__spionSzene.ueberspringen()`);
  for (let i = 0; i < 200 && H.run(`!!${GS}.__spionSzene`); i++) { H.step(2); await flush(); }
});
after(async () => { if (H) await H.shutdown(); });

test('ruhiger Raum: die Texte der Anzeige werden nicht jedes Bild neu gezeichnet', async () => {
  // Spieler ruhig in eine Ecke: nichts aendert sich an Banner und Chip.
  H.run(`(function () { var sc = ${GS}; window.__neu = 0;
    sc.children.list.forEach(function (o) {
      if (o.type !== 'Text' || o.__zaehlt) return; o.__zaehlt = true;
      var alt = o.updateText; o.updateText = function () { window.__neu++; return alt.apply(this, arguments); };
    });
  })()`);
  for (let i = 0; i < 60; i++) { H.step(1); await flush(); }
  const neu = H.run('window.__neu');
  assert.ok(H.run('window.EspionageSystem.isActive()'), 'Testannahme: Mission laeuft');
  // Vorher: Banner + Chip + jede Marke je Bild = weit ueber 100 in 60 Bildern.
  assert.ok(neu < 30, 'Texte werden staendig neu gezeichnet: ' + neu + ' Mal in 60 Bildern');
});
