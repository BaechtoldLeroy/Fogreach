// tests/trailerWirkbilder.test.js — Die Kampf-Montage des Trailers zeigt die
// neuen Wirkbilder (#174), nicht die alten Linien.
//
// Gemeldet: "trailermodus nutzt die alten skill animationen?" Ursache:
// GameScene.preload laedt Wirkbilder nur fuer GELERNTE Faehigkeiten; der
// Trailer lernte Wirbelwind/Ansturm/Hammer erst im fertigen Dungeon — bis zum
// Nachladen zeichneten die ersten Schlaege die alten Linien. Jetzt lernt der
// Trailer sie vor dem Abstieg; und wer im Dungeon etwas lernt, bekommt die
// Bilder sofort nachgeladen (AbilitySystem.learnAbility).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch, flush } = require('../tools/headless/index.js');

let H = null;
const zustand = () => H.run('window.TrailerModus.zustand()');

before(async () => {
  H = await launch({ search: '?trailer=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 300 }), 'kein Hub');
  await H.settle(() => zustand().hubGesehen, { maxRounds: 40 });
});
after(async () => { if (H) await H.shutdown(); });

test('Einstellung 4: beim ersten Schlag sind die Wirkbilder schon geladen', async () => {
  H.run(`(function () {
    window.__beimErsten = null;
    var A = window.AbilitySystem, echt = A.tryActivate;
    A.tryActivate = function (slot, gs) {
      if (window.__beimErsten === null) {
        var t = gs.textures;
        window.__beimErsten = ['wirbel_boden', 'wirbel_luft', 'staub', 'funken', 'hammer_boden', 'hammer_luft']
          .filter(function (n) { return !t.exists('spezialvfx_' + n); }).join(',') || 'alle';
      }
      return echt.apply(this, arguments);
    };
    window.TrailerModus.taste('4');
  })()`);
  for (let i = 0; i < 2000 && H.run('window.__beimErsten') === null; i++) { H.step(4); await flush(); }
  assert.strictEqual(H.run('window.__beimErsten'), 'alle', 'beim ersten Schlag fehlten: ' + H.run('window.__beimErsten'));
});

test('Im Dungeon gelernt: die Wirkbilder werden sofort nachgeladen', async () => {
  const vorher = H.run(`(function () {
    var gs = window.game.scene.getScene('GameScene');
    if (gs.textures.exists('spezialvfx_frost')) gs.textures.remove('spezialvfx_frost');
    try { window.AbilitySystem.forgetAbility('frostNova'); } catch (e) {}
    window.AbilitySystem.learnAbility('frostNova', { silent: true });
    return gs.load.isLoading() || gs.textures.exists('spezialvfx_frost');
  })()`);
  assert.strictEqual(vorher, true, 'nach dem Lernen wird nichts geladen');
  let da = false;
  for (let i = 0; i < 600 && !da; i++) {
    H.step(4); await flush();
    da = H.run(`window.game.scene.getScene('GameScene').textures.exists('spezialvfx_frost')`);
  }
  assert.ok(da, 'das Wirkbild der frisch gelernten Faehigkeit kam nicht');
});
