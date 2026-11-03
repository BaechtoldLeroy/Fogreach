// tests/figurenGehen.test.js — Harren und Mara gehen im Keller in ihre Richtung.
//
// Gemeldet: Mara und Harren glitten im Keller als Standbild bzw. in den
// Suedost-Bildern des Finales, auch wenn sie nach Norden gingen (gespiegelt
// nur nach links). Jetzt (PixelLab, dieselben Hub-Charaktere und Vorlagen,
// tools/finaleBilderBauen.js) gibt es das Gehen in allen acht Richtungen;
// Finale.gehen waehlt die Animation nach der Bewegungsrichtung, ungespiegelt.
// Stehen bleibt das bestehende Standbild, ohne laufende Animation.
// Geprueft hier: jede Richtung an beiden Figuren mit echtem Tween (Zeit nur
// per H.step), danach das Stehen. Den Weg im Finale selbst (Harren kommt,
// Mara kommt zum Urteil) prueft tests/finaleTableau.test.js Schritt fuer Schritt.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

const GSC = "window.game.scene.getScene('GameScene')";

describe('Harren und Mara gehen in Bewegungsrichtung', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 5 });
    // Dungeon-Zufall festhalten: der Raum soll nichts anders machen als sonst.
    H.run(`(function () { var s = 4242; Math.random = function () { s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; window._playerInvincible = true; })()`);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('die acht Richtungen nach dem Winkel des Schritts', () => {
    const r = H.run(`(function () { var g = window.Finale.gehRichtung; return [
      g(1, 0), g(1, 1), g(0, 1), g(-1, 1), g(-1, 0), g(-1, -1), g(0, -1), g(1, -1), g(5, -1), g(-1, 5)]; })()`);
    assert.deepStrictEqual(Array.from(r), ['o', 'so', 's', 'sw', 'w', 'nw', 'n', 'no', 'o', 's']);
  });

  for (const figur of ['harren', 'mara']) {
    test(figur + ': jede Richtung mit eigener Animation, Stehen ohne', () => {
      const richtungen = H.run('Array.from(window.Finale.GEH_RICHTUNGEN)');
      assert.strictEqual(richtungen.length, 8);
      for (const r of richtungen) {
        const w = { o: 0, so: 1, s: 2, sw: 3, w: 4, nw: 5, n: 6, no: 7 }[r] * Math.PI / 4;
        H.run(`(function () { var sc = ${GSC}, p = player;
          var s = window.Finale.figurSprite(sc, '${figur}', p.x, p.y, 64);
          s.setName('gehTest');
          var zx = s.x + Math.cos(${w}) * 300, zy = s.y + Math.sin(${w}) * 300;
          window.Finale.gehen(s, zx, zy);
          sc.tweens.add({ targets: s, x: zx, y: zy, duration: 3000 });
          window.__gehTest = { s: s, x: s.x, y: s.y, bilder: {} }; })()`);
        let l = null;
        for (let i = 0; i < 400; i++) {
          H.step(1);
          l = H.run(`(function () { var t = window.__gehTest, s = t.s; t.bilder[s.texture.key] = 1;
            var a = s.anims.isPlaying && s.anims.currentAnim;
            return { weg: Math.hypot(s.x - t.x, s.y - t.y), dx: s.x - t.x, dy: s.y - t.y, anim: a ? a.key : null,
              flip: s.flipX, bilder: Object.keys(t.bilder) }; })()`);
          if (l.weg > 40 && l.bilder.length >= 3) break;
        }
        assert.ok(l.weg > 40, figur + ' ' + r + ': bewegt sich nicht ' + JSON.stringify(l));
        assert.strictEqual(H.run(`window.Finale.gehRichtung(${l.dx}, ${l.dy})`), r, 'Tween laeuft nicht in ' + r);
        assert.strictEqual(l.anim, 'finale_' + figur + '_gehen_' + r, figur + ' ' + r + ': falsche Animation');
        assert.strictEqual(l.flip, false, figur + ' ' + r + ': gespiegelt statt eigener Richtung');
        const praefix = 'finale_fig_' + figur + '_' + (r === 'so' ? 'gehen' : 'gehen_' + r);
        const eigene = l.bilder.filter((k) => new RegExp('^' + praefix + '\\d$').test(k));
        assert.ok(eigene.length >= 3, figur + ' ' + r + ': Bilder wechseln nicht ' + l.bilder);

        // Stehen: Standbild, keine Animation, nichts wechselt mehr.
        H.run(`(function () { var s = window.__gehTest.s; s.scene.tweens.killTweensOf(s); window.Finale.stehen(s); })()`);
        const vorher = H.run('window.__gehTest.s.texture.key');
        H.step(30);
        const st = H.run(`(function () { var s = window.__gehTest.s;
          return { key: s.texture.key, spielt: s.anims.isPlaying }; })()`);
        assert.strictEqual(vorher, 'finale_fig_' + figur + '_stand');
        assert.deepStrictEqual({ ...st }, { key: 'finale_fig_' + figur + '_stand', spielt: false }, figur + ' ' + r + ': steht nicht still');
        H.run('window.__gehTest.s.destroy(); window.__gehTest = null');
      }
    });
  }

  test('alle Gehbilder sind geladen, je Figur und Richtung', () => {
    const fehlt = H.run(`(function () { var sc = ${GSC};
      return window.Finale.figurBilder().filter(function (e) { return !sc.textures.exists(e[0]); }).map(function (e) { return e[0]; }); })()`);
    assert.deepStrictEqual(Array.from(fehlt), []);
    const n = H.run(`window.Finale.figurBilder().filter(function (e) { return /_(harren|mara)_gehen/.test(e[0]); }).length`);
    assert.strictEqual(n, 8 * 8 + 8 * 6);
  });
});
