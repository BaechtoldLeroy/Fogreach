// tests/spezialStart.js — zwei Spiele fuer die Tests der Spezialangriffe (#174).
//
// Seit #174 fest eingebaut ist, gibt es keine Flagge mehr. Verglichen wird
// darum der Normalfall mit dem Rueckfall:
//   - mitBildern: alle Koerperfolgen und Wirkbilder sind geladen (wie bei
//     einem Spieler, der alle zwoelf Faehigkeiten gelernt hat);
//   - imRueckfall: keine Bilder, und das Nachladen ist abgeklemmt — so sieht
//     ein Angriff aus, dessen Bilder fehlen (die alten Linien).

const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

const ALLES_DA = `(function () {
  var t = window.game.textures;
  return Object.keys(SPEZIAL_FOLGEN).every(function (a) {
      return _folgeDateien(a).every(function (f) { return t.exists(f.key); }); })
    && Object.keys(SPEZIAL_VFX).every(function (n) { return t.exists(spezialVfxSchluessel(n)); });
})()`;

async function mitBildern() {
  const H = await launchDungeon({ depth: 1, zusatz: '&debug=1' });
  H.run(`spezialNachladen(window.game.scene.getScene('GameScene'), Object.keys(SPEZIAL_JE_FAEHIGKEIT))`);
  const ok = await H.settle(() => H.run(ALLES_DA), { maxRounds: 600, framesPerRound: 1 });
  assert.ok(ok, 'die Spezialbilder kamen nicht');
  H.run('window._playerInvincible = true');
  return H;
}

async function imRueckfall() {
  const H = await launchDungeon({ depth: 1 });
  H.run('window.__spezialNachladen = spezialNachladen; spezialNachladen = function () { return 0; }');
  const n = H.run("Object.keys(window.game.textures.list).filter(function (k) { return /^spezial(vfx)?_/.test(k); }).length");
  assert.strictEqual(n, 0, 'im Rueckfall-Spiel sind Spezialbilder geladen');
  H.run('window._playerInvincible = true');
  return H;
}

module.exports = { mitBildern, imRueckfall, ALLES_DA };
