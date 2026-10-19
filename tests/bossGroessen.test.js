// tests/bossGroessen.test.js — der Boss auf Tiefe 30 ist der groesste der Leiter (#176).
// Seit Stufe 2 steht dort (ausser waehrend der Quelle) der Nachhall der Esse.
//
// Vorher war der finale Boss (Tiefe 30) mit 87 px kleiner als seine beiden
// Vorgaenger (127 px) und kaum groesser als ein Brute: seine Skala war auf
// einen leeren 1024-px-Rahmen geeicht und wurde in b314 nur umgerechnet.
// Gemessen wird die FIGUR des gespawnten Bosses (_hitHalfH aus
// gegnerAufHoeheSkalieren), nicht seine Skala.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
before(async () => { H = await launchDungeon({ depth: 10 }); });
after(async () => { if (H) await H.shutdown(); });

function figurHoehe(tiefe) {
  H.lab.clearEnemies();
  H.lab.setDepth(tiefe, tiefe);
  const b = H.lab.spawnBoss();
  assert.ok(!b.error, b.error);
  return H.run(`(function () {
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    return { name: b.bossName || b.bossType, h: Math.round(b._hitHalfH * 2) };
  })()`);
}

test('der Nachhall der Esse ueberragt seine Vorgaenger, bleibt aber unter Elara', () => {
  const kette = figurHoehe(10), zeremonie = figurHoehe(20), rat = figurHoehe(30);
  const elara = H.run('Math.round(96 * BOSS_DEFINITIONS.elaraBesessen.scale)');
  assert.ok(rat.h > kette.h && rat.h > zeremonie.h,
    'Tiefe 30: ' + rat.h + ' px, Vorgaenger ' + kette.h + ' / ' + zeremonie.h + ' px');
  assert.ok(rat.h >= 160 && rat.h < elara,
    'Tiefe 30: ' + rat.h + ' px — gewollt rund 173, unter Elara (' + elara + ')');
});
