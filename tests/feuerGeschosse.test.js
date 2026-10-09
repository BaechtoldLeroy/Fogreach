// tests/feuerGeschosse.test.js — #173: Feuer, das sich bewegt.
//
// Drei Dinge waren starr:
//   1. Der Feuerball des Flammenwebers — ein Einzelbild, und UNGEDREHT: er
//      ist mit dem Schweif nach links gezeichnet und flog nach links mit dem
//      Schweif voran.
//   2. Das Arkangeschoss des Magiers — ein Einzelbild.
//   3. Der Brandstatus — nur ein orangener Farbstich, keine Flamme.
//
// Dazu eine Falle, die mit der Animation erst entsteht: Geschosse kommen aus
// einem Pool. Ein Pfeil, der vorher ein Feuerball war, darf keine Flammen
// mehr zeigen.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launchDungeon } = require('../tools/headless/index.js');

const WURZEL = path.join(__dirname, '..');

/** Pixel, die sich zwischen zwei Bildern spuerbar unterscheiden. */
async function abstand(a, b) {
  const x = (await sharp(a).ensureAlpha().raw().toBuffer());
  const y = (await sharp(b).ensureAlpha().raw().toBuffer());
  let n = 0;
  for (let k = 0; k < x.length; k += 4) {
    if (Math.abs(x[k] - y[k]) + Math.abs(x[k + 1] - y[k + 1]) + Math.abs(x[k + 2] - y[k + 2])
      + Math.abs(x[k + 3] - y[k + 3]) > 24) n++;
  }
  return n;
}

test('Feuerball und Arkangeschoss sind Loops aus acht gleich grossen Bildern', async () => {
  for (const n of ['proj_fireball', 'proj_arcane']) {
    const dateien = [];
    for (let i = 0; i < 8; i++) dateien.push(path.join(WURZEL, 'assets', 'projectiles', n + i + '.png'));
    dateien.forEach((d) => assert.ok(fs.existsSync(d), path.basename(d) + ' fehlt'));
    // Alle gleich gross wie das Grundbild — sonst springt das Geschoss beim
    // ersten Bildwechsel auf die doppelte Groesse (setDisplaySize rechnet mit
    // dem Bild, das beim Setzen gerade gilt).
    const grund = await sharp(path.join(WURZEL, 'assets', 'projectiles', n + '.png')).metadata();
    for (const d of dateien) {
      const m = await sharp(d).metadata();
      assert.strictEqual(m.width + 'x' + m.height, grund.width + 'x' + grund.height,
        path.basename(d) + ' ist ' + m.width + 'x' + m.height + ', das Grundbild ' + grund.width + 'x' + grund.height);
    }
    const schritte = [];
    for (let i = 0; i < 7; i++) schritte.push(await abstand(dateien[i], dateien[i + 1]));
    const rueck = await abstand(dateien[7], dateien[0]);
    const typisch = schritte.slice().sort((a, b) => a - b)[3];
    assert.ok(rueck <= typisch * 1.6,
      n + ': vom letzten zum ersten Bild ' + rueck + ' Pixel, typisch ' + typisch + ' — kein Loop');
    assert.ok(Math.min(...schritte) > 0, n + ': zwei Bilder sind gleich — da bewegt sich nichts');
  }
});

test('die Brandflammen sind neun gleich grosse Bilder', async () => {
  let mass = null;
  for (let i = 0; i < 9; i++) {
    const d = path.join(WURZEL, 'assets', 'tiles', 'brand' + i + '.png');
    assert.ok(fs.existsSync(d), 'brand' + i + '.png fehlt');
    const m = await sharp(d).metadata();
    const s = m.width + 'x' + m.height;
    if (mass === null) mass = s;
    assert.strictEqual(s, mass, 'brand' + i + ' ist ' + s + ' statt ' + mass);
  }
});

let H = null;
before(async () => { H = await launchDungeon({ depth: 5 }); });
after(async () => { if (H) await H.shutdown(); });

test('der Feuerball flackert und fliegt mit dem Schweif nach hinten', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var out = {};
    [['links', Math.PI], ['rechts', 0], ['oben', -Math.PI / 2]].forEach(function (z) {
      var p = acquireEnemyProjectile(sc, 300, 300, 'proj_fireball');
      _configureProjectileShape(p, 'proj_fireball', z[1]);
      out[z[0]] = { dreh: p.rotation, spielt: !!(p.anims && p.anims.isPlaying),
        anim: p.anims && p.anims.currentAnim ? p.anims.currentAnim.key : null,
        b: Math.round(p.displayWidth), h: Math.round(p.displayHeight) };
      releaseEnemyProjectile(p);
    });
    return out;
  })()`);
  ['links', 'rechts', 'oben'].forEach((k) => {
    assert.ok(r[k].spielt, 'der Feuerball (' + k + ') spielt keine Animation');
    assert.strictEqual(r[k].anim, 'geschoss_feuerball');
    assert.strictEqual(r[k].b + 'x' + r[k].h, '20x20', 'der Feuerball ist ' + r[k].b + 'x' + r[k].h);
  });
  // Gedreht wie der Flug: nach links ist eine halbe Drehung.
  assert.ok(Math.abs(Math.abs(r.links.dreh) - Math.PI) < 0.01, 'nach links gedreht um ' + r.links.dreh);
  assert.ok(Math.abs(r.rechts.dreh) < 0.01, 'nach rechts gedreht um ' + r.rechts.dreh);
  assert.ok(Math.abs(r.oben.dreh + Math.PI / 2) < 0.01, 'nach oben gedreht um ' + r.oben.dreh);
});

test('das Arkangeschoss pulsiert', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var p = acquireEnemyProjectile(sc, 300, 300, 'proj_arcane');
    _configureProjectileShape(p, 'proj_arcane', 1.0);
    var a = { spielt: !!(p.anims && p.anims.isPlaying), anim: p.anims.currentAnim && p.anims.currentAnim.key };
    releaseEnemyProjectile(p);
    return a;
  })()`);
  assert.ok(r.spielt, 'das Arkangeschoss spielt keine Animation');
  assert.strictEqual(r.anim, 'geschoss_arkan');
});

test('ein Pfeil aus dem Pool zeigt keine Flammen mehr', () => {
  // Pool leeren, einen Feuerball zurueckgeben, dann einen Pfeil holen: es ist
  // dasselbe Sprite.
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    sc._enemyProjectilePool = [];
    var f = acquireEnemyProjectile(sc, 300, 300, 'proj_fireball');
    _configureProjectileShape(f, 'proj_fireball', 0);
    releaseEnemyProjectile(f);
    var p = acquireEnemyProjectile(sc, 300, 300, 'proj_arrow');
    _configureProjectileShape(p, 'proj_arrow', 0);
    var gleich = (p === f);
    return { gleich: gleich, spielt: !!(p.anims && p.anims.isPlaying), key: p.texture.key };
  })()`);
  assert.ok(r.gleich, 'der Pool hat ein neues Sprite geliefert — der Fall misst nichts');
  H.step(10);
  const nachher = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var p = (sc.children.list || []).filter(function (c) { return c.texture && c.active && /^proj_/.test(c.texture.key); })
      .map(function (c) { return c.texture.key; });
    return p;
  })()`);
  assert.strictEqual(r.spielt, false, 'der Pfeil spielt noch die Feuerball-Animation');
  assert.strictEqual(r.key, 'proj_arrow');
  assert.ok(!Array.prototype.slice.call(nachher).some((k) => /^proj_fireball/.test(k)),
    'nach ein paar Bildern zeigt ein aktives Geschoss Feuerball-Bilder: ' + nachher.join(','));
});

test('eine brennende Figur traegt eine Flamme, und sie erlischt mit dem Brand', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var g = spawnEnemy.call(sc, player.x + 200, player.y);
    if (!g) return { fehler: 'kein Gegner im Raum' };
    var M = window.statusEffectManager;
    M.applyEffect(g, window.StatusEffectType.BURNED, 'test');
    var f = M._flammen.get(g);
    var b = g.getBounds();
    return { da: !!f, spielt: !!(f && f.anims && f.anims.isPlaying), ueber: f ? f.depth > g.depth : false,
      fh: f && f.displayHeight, fb: f && f.displayWidth, gh: b.height, gb: b.width,
      x: f && f.x, fx: b.centerX, unten: f && f.y, bu: b.bottom, bo: b.top };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.ok(r.da, 'keine Flamme auf der brennenden Figur');
  assert.ok(r.spielt, 'die Flamme flackert nicht');
  assert.ok(r.ueber, 'die Flamme liegt hinter der Figur');
  assert.ok(Math.abs(r.x - r.fx) < 2, 'die Flamme steht nicht mittig (' + r.x + ' gegen ' + r.fx + ')');
  assert.ok(r.unten <= r.bu && r.unten > r.bo, 'die Flamme steht nicht auf der Figur');
  // Sichtbar heisst: ein gutes Stueck der Figur hoch. Der erste Wurf richtete
  // sich nach der Figurbreite und kam auf 19x11 px bei einer 50 px hohen
  // Figur — ein Flackern an den Fuessen.
  assert.ok(r.fh >= r.gh * 0.35, 'die Flamme ist ' + Math.round(r.fh) + ' px hoch, die Figur ' + Math.round(r.gh));
  assert.ok(r.fb <= r.gb * 1.65, 'die Flamme ist ' + Math.round(r.fb) + ' px breit, die Figur nur ' + Math.round(r.gb));

  // Sie folgt: Figur versetzen, ein Bild takten.
  const folgt = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var M = window.statusEffectManager, g = null;
    M._flammen.forEach(function (f, t) { g = t; });
    g.x += 60; M.updateEffects(16);
    var f = M._flammen.get(g);
    return { dx: Math.abs(f.x - g.getBounds().centerX) };
  })()`);
  assert.ok(folgt.dx < 2, 'die Flamme bleibt stehen, wenn die Figur sich bewegt (' + folgt.dx + ' px daneben)');

  // Erlischt mit dem Brand.
  const aus = H.run(`(function () {
    var M = window.statusEffectManager, g = null, f = null;
    M._flammen.forEach(function (fl, t) { g = t; f = fl; });
    M.removeEffect(g, window.StatusEffectType.BURNED);
    return { weg: !M._flammen.has(g), zerstoert: !f.active };
  })()`);
  assert.ok(aus.weg && aus.zerstoert, 'die Flamme brennt nach dem Brand weiter');
});

test('stirbt die Figur, verschwindet ihre Flamme', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var g = spawnEnemy.call(sc, player.x + 200, player.y);
    if (!g) return { fehler: 'kein Gegner' };
    var M = window.statusEffectManager;
    M.applyEffect(g, window.StatusEffectType.BURNED, 'test');
    var f = M._flammen.get(g);
    g.setActive(false);              // so meldet sich ein toter Gegner
    M.updateEffects(16);
    var weg = !M._flammen.has(g) && !f.active;
    g.setActive(true);
    return { weg: weg };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.ok(r.weg, 'die Flamme brennt auf einem toten Gegner weiter');
});

test('auch auf einer schmalen Figur ist die Flamme zu sehen', () => {
  // Der Spieler ist 24 px breit und 50 hoch. Nach der Figurbreite bemessen,
  // kam die Flamme auf 19 x 11 px — ein Flackern an den Fuessen.
  const r = H.run(`(function () {
    var M = window.statusEffectManager;
    M.applyEffect(player, window.StatusEffectType.BURNED, 'test');
    var f = M._flammen.get(player), b = player.getBounds();
    var out = { da: !!f, fh: f && f.displayHeight, fb: f && f.displayWidth, gh: b.height, gb: b.width };
    M.removeEffect(player, window.StatusEffectType.BURNED);
    return out;
  })()`);
  assert.ok(r.da, 'keine Flamme auf dem Spieler');
  assert.ok(r.fh >= r.gh * 0.35, 'die Flamme ist ' + Math.round(r.fh) + ' px hoch, die Figur ' + Math.round(r.gh));
  assert.ok(r.fb <= r.gb * 1.65, 'die Flamme ist ' + Math.round(r.fb) + ' px breit, die Figur nur ' + Math.round(r.gb));
});
