// tests/bossSchwer.test.js — Bosse sind schwer (Spielerbericht: "Bosse duerfen
// nicht so einfach weggedrueckt werden").
//
// Vorher gemessen (Boss steht, Tempo 0, Kantenabstand wenige Pixel):
//   Laufen 1 s in den Boss  60-76 px   (Boss war Phaser-schiebbar)
//   Ansturm                 ~49 px
//   Stahlgriff              ~24 px     (Sofort-Impuls der Kette)
//   Hammer 6.7, Wirbelsog 6-10, Schildstoss 3.3, Dolch 2.3, Wirbelklingen 2 px
// Jetzt: 0 px. Gewoehnliche Gegner (Kontrolle: Brute) fliegen wie bisher.
//
// Der Boss wird hier ueber makeBoss gebaut (der Kern jedes Boss-Spawns); der
// echte Weg ueber spawnBoss laeuft fuer den Kettenmeister mit.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

const SC = `window.game.scene.getScene('GameScene')`;
const BOSSE = ['chainMaster', 'ceremonyMaster', 'nachhall', 'nachhallEsse', 'elaraBesessen'];
const BOSS_MAX = 1;      // px, die ein Boss je Stoss hoechstens wandert
const NORMAL_MIN = 2;    // px, die der Brute mindestens wandert

let H = null;
before(async () => {
  H = await launchDungeon({ depth: 10 });
  H.run('window._playerInvincible = true');
  H.lab.disableCrit();
  // Freie Flaeche: der Zufallsraum soll weder Stoesse bremsen noch Sicht nehmen.
  H.run(`(function () {
    if (typeof obstacles !== 'undefined' && obstacles) obstacles.clear(true, true);
    if (window.BossZwischenszene) window.BossZwischenszene.soll = function () { return false; };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

/** Ziel aufstellen: wer = 'brute' | Boss-ID | 'spawnBoss'; gap = Kantenabstand rechts. */
function aufstellen(wer, gap) {
  H.input.releaseAll();
  H.lab.clearEnemies();
  H.run(`(function () {
    var sc = ${SC};
    isRolling = false; rollCooldown = false; isDashing = false; isAttacking = false;
    isChargingSlash = false; shieldBashCooldown = false;
    window._pullUntil = 0; window.__fessel = null;
    sc.time.paused = false; sc.physics.world.resume();
    player.setVelocity(0, 0);
    lastMoveDirection.set(1, 0);
    var b = sc.physics.world.bounds;
    player.body.reset(b.centerX, b.centerY);
  })()`);
  if (wer === 'brute') {
    const ref = H.lab.spawnEnemy(3, 200, 0);
    H.run(`window.__ziel = window.__lab.refs[${ref}];`);
  } else {
    H.run(`(function () {
      var sc = ${SC}, b;
      if (${JSON.stringify(wer)} === 'spawnBoss') {
        spawnBoss.call(sc);
        b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
      } else {
        var def = BOSS_DEFINITIONS[${JSON.stringify(wer)}];
        var tex = sc.textures.exists(def.texture) ? def.texture : def.fallbackTexture;
        b = enemies.create(player.x + 300, player.y, tex);
        b._bossPrefix = tex.replace('_right0', ''); b._bossDirection = 'right'; b._bossAttacking = false;
        makeBoss.call(sc, b, def, 0);
      }
      b._introHaltBis = 0; b.nextPatternAt = 1e15;
      window.__ziel = b;
    })()`);
  }
  H.run(`(function () { var z = window.__ziel; z.speed = 0; z.hp = z.maxHp = 1e9; })()`);
  H.step(2);
  H.run(`(function () {
    var z = window.__ziel; z.speed = 0;
    var sx = (player.body.right + ${gap}) - z.body.x, sy = player.body.center.y - z.body.center.y;
    z.body.reset(z.x + sx, z.y + sy); z.body.setVelocity(0, 0);
    window.__hp0 = z.hp; window.__start = { x: z.x, y: z.y }; window.__weit = 0;
  })()`);
}

/** n Bilder takten; liefert die weiteste Auslenkung des Ziels und ob es getroffen wurde. */
function takte(n) {
  for (let i = 0; i < n; i++) {
    H.step(1);
    H.run(`(function () { var z = window.__ziel; if (!z || !z.active) return;
      var d = Math.hypot(z.x - window.__start.x, z.y - window.__start.y);
      if (d > window.__weit) window.__weit = d; })()`);
  }
  return H.run(`({ weit: Math.round(window.__weit * 10) / 10, getroffen: window.__ziel.hp < window.__hp0 })`);
}

const PROJ = (daten) => `{ active: true, x: player.x, y: player.y, _d: ${daten},
  getData: function (k) { return this._d[k]; }, setData: function (k, v) { this._d[k] = v; },
  destroy: function () { this.active = false; } }`;

// Jede Spieler-Mechanik, die einen Gegner bewegt: [Kantenabstand, Ausloeser].
const STOESSE = {
  ansturm: [40, () => { H.input.hold({ right: true }); H.run(`shadowCharge.call(${SC})`); }],
  hammer: [4, () => H.run(`isChargingSlash = true; chargeSlashStartTime = 0; releaseChargedSlash.call(${SC}, true)`)],
  schildstoss: [4, () => H.run(`shieldBash.call(${SC})`)],
  stahlgriff: [150, () => H.run(`castSteelGrasp.call(${SC})`)],
  wirbelsog: [20, () => H.run(`castCycloneStrike.call(${SC})`)],
  dolch: [10, () => H.run(`handlePlayerProjectileEnemyOverlap.call(${SC}, ${PROJ('{}')}, window.__ziel)`)],
  wirbelklingen: [10, () => H.run(`handlePlayerProjectileEnemyOverlap.call(${SC}, ${PROJ('{ twistingBlades: true, knockback: 120 }')}, window.__ziel)`)],
};

function stoss(wer, art) {
  const [gap, los] = STOESSE[art];
  aufstellen(wer, gap);
  los();
  const r = takte(40);
  H.input.releaseAll();
  return r;
}

test('jeder Boss ist nicht schiebbar (auch ueber den echten spawnBoss)', () => {
  BOSSE.concat(['spawnBoss']).forEach((wer) => {
    aufstellen(wer, 50);
    assert.strictEqual(H.run('window.__ziel.body.pushable'), false, wer + ' ist schiebbar');
  });
});

test('Laufen in den Boss schiebt ihn nicht, und der Spieler klebt nicht', () => {
  BOSSE.concat(['spawnBoss']).forEach((wer) => {
    aufstellen(wer, 6);
    H.input.hold({ right: true });
    takte(30);
    // Am Boss stehend: der Spieler zittert nicht hin und her.
    const xs = [];
    for (let i = 0; i < 20; i++) { H.step(1); xs.push(H.run('player.x')); }
    const r = takte(10);
    assert.ok(r.weit <= BOSS_MAX, wer + ' um ' + r.weit + ' px weggeschoben');
    const zittern = Math.max.apply(null, xs) - Math.min.apply(null, xs);
    assert.ok(zittern <= 1, wer + ': Spieler zittert um ' + zittern + ' px');
    // Umdrehen: sofort frei.
    const vor = H.run('player.x');
    H.input.hold({ left: true });
    H.step(10);
    const weg = vor - H.run('player.x');
    H.input.releaseAll();
    assert.ok(weg >= 15, wer + ': Spieler kommt nicht los (' + weg + ' px in 10 Bildern)');
  });
});

for (const art of Object.keys(STOESSE)) {
  test('Stoss "' + art + '": Boss bleibt stehen, der Brute fliegt wie bisher', () => {
    const normal = stoss('brute', art);
    assert.ok(normal.getroffen, art + ': Brute nicht getroffen');
    assert.ok(normal.weit >= NORMAL_MIN, art + ': Brute nur ' + normal.weit + ' px bewegt');
    for (const wer of ['spawnBoss'].concat(BOSSE)) {
      const r = stoss(wer, art);
      assert.ok(r.getroffen, art + ': ' + wer + ' nicht getroffen — Messung ohne Aussage');
      assert.ok(r.weit <= BOSS_MAX, art + ': ' + wer + ' um ' + r.weit + ' px bewegt');
    }
  });
}
