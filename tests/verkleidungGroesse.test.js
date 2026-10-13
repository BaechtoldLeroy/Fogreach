// tests/verkleidungGroesse.test.js — Die Kettenwachen-Montur der Spionage
// pumpt beim Laufen nicht, und die Wachen sind genauso gross wie sie.
//
// Bis b406 wurde die Montur in JEDEM Bild neu so skaliert, dass die Figur
// darin 56 px hoch war. Die drei Laufbilder tragen aber verschieden hohe
// Figuren — der Massstab sprang also mit jedem Schritt, und die Wachen
// uebernahmen die gerade gezeigte Hoehe (window.__ESP_GUARD_H) gleich mit.
// Jetzt gilt ein fester Massstab, gemessen am Standbild (window.montureSkala).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launchDungeon({ depth: 3 });
  H.run(`(function () {
    enemies.clear(true, true);
    window.EspionageSystem.isDisguised = function () { return true; };
  })()`);
});
after(async () => {
  if (H) { H.input.releaseAll(); await H.shutdown(); }
});

test('Verkleidet laufen: alle Laufbilder im selben Massstab', async () => {
  const proben = [];
  const richtungen = [{ right: true }, { left: true }];
  for (let r = 0; r < 4; r++) {
    H.input.hold(richtungen[r % 2]);
    for (let i = 0; i < 25; i++) {
      await H.step(1);
      proben.push(H.run(`({ key: player.texture.key,
        sy: Math.abs(player.scaleY), sx: Math.abs(player.scaleX) })`));
    }
  }
  H.input.releaseAll();
  const montur = proben.filter((p) => /^chainguard_/.test(p.key));
  const bilder = new Set(montur.map((p) => p.key));
  assert.ok(bilder.size >= 3, 'zu wenige Laufbilder gesehen: ' + [...bilder].join(','));
  const sy = montur.map((p) => p.sy);
  const min = Math.min(...sy), max = Math.max(...sy);
  // Rundung auf ganze Pixel erlaubt ~2 %, das alte Pumpen lag weit darueber.
  assert.ok(max / min < 1.03,
    'der Massstab springt beim Laufen: ' + min.toFixed(3) + ' .. ' + max.toFixed(3));
  const skala = H.run('window.montureSkala(window.game.scene.getScene("GameScene"))');
  assert.ok(skala > 0, 'montureSkala misst nichts');
  assert.ok(Math.abs(sy[0] / skala - 1) < 0.03,
    'die Montur folgt nicht dem gemeinsamen Massstab: ' + sy[0] + ' gegen ' + skala);
});

test('Die Wachen der Spionage nutzen denselben Massstab wie die Montur', () => {
  const fs = require('fs');
  const path = require('path');
  const quelle = fs.readFileSync(path.join(__dirname, '..', 'js', 'espionageVisuals.js'), 'utf8');
  assert.ok(quelle.includes('window.montureSkala(scene)'),
    'die Wachen fragen den Massstab der Montur nicht ab');
  assert.ok(!quelle.includes('__ESP_GUARD_H'),
    'die Wachen lesen wieder die wechselnde Hoehe des gerade gezeigten Laufbilds');
});
