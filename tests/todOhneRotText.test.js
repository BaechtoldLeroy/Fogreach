// tests/todOhneRotText.test.js — beim Tod kein roter "DU BIST GESTORBEN"-Text.
//
// Gemeldet: "Du bist gestorben, zurueck zur Stadt kannst weglassen, dafuer
// gibt's ja jetzt die Dungeon-End-Grafik" (Laufuebersicht). Am Verhalten:
// im Keller wirklich sterben, dann steht nirgends der rote Text.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { launchDungeon } = require('../tools/headless/index.js');

const GS = "window.game.scene.getScene('GameScene')";
let H = null;

before(async () => {
  H = await launchDungeon({ depth: 3 });
  H.run('window.prompt = function () { return null; }');
});
after(async () => { if (H) await H.shutdown(); });

const roterText = () => H.run(`(function () {
  var funde = [];
  window.game.scene.getScenes(true).forEach(function (sc) {
    sc.children.list.forEach(function (o) {
      if (o.type === 'Text' && o.visible && o.alpha > 0.05 && /GESTORBEN|YOU ARE DEAD/.test(o.text || '')) funde.push(sc.scene.key);
    });
  });
  return funde.join(',');
})()`);

test('wer im Keller stirbt, sieht keinen roten "DU BIST GESTORBEN"-Text', () => {
  H.run(`(function () {
    window._playerInvincible = false;
    if (window.playerSkills) { try { window.playerSkills.zweiteChance = 0; } catch (e) {} }
    window.__tot = false;
    var echt = window.handlePlayerDeath;
    window.handlePlayerDeath = function (sc) { window.__tot = true; return echt.apply(this, arguments); };
    window.applyPlayerDamage(99999, ${GS});
  })()`);
  for (let i = 0; i < 20 && !roterText(); i++) H.step(2);
  assert.strictEqual(H.run('window.__tot'), true, 'der Spieler ist nicht gestorben (Testannahme)');
  assert.strictEqual(roterText(), '', 'roter Todestext sichtbar');
});
