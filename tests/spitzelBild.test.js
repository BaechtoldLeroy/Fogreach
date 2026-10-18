// tests/spitzelBild.test.js — der Alarmgegner (Typ 16, intern 'alarm') ist
// seit b452 der Spitzel des Kettenrats: graue Kapuze, Messingglocke. Der
// frueher gruene Wicht mit Horn darf weder im Bild noch im Namen
// zurueckkommen.
//
// Geprueft wird am ausgelieferten Bestand (Dateien, Ladeliste, Namen) und
// am echten Spawn: der Gegner muss die neuen Bilder tragen.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadGameModule } = require('./loadGameModule');
const { launch } = require('../tools/headless/index.js');

const ORDNER = path.join(__dirname, '..', 'assets', 'enemy', 'alarm');

function pngGroesse(datei) {
  const b = fs.readFileSync(datei);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test('Spitzel-Bilder: drei Posen und vier Laufbilder je Richtung, alle 62x62', () => {
  const soll = [];
  ['right', 'left'].forEach((d) => {
    for (let i = 0; i < 3; i++) soll.push(d + i + '.png');
    for (let i = 0; i < 4; i++) soll.push('walk_' + d + i + '.png');
  });
  const da = fs.readdirSync(ORDNER).filter((f) => f.endsWith('.png')).sort();
  assert.deepStrictEqual(da, soll.slice().sort(), 'unerwartete Dateien im Ordner');
  soll.forEach((f) => {
    const g = pngGroesse(path.join(ORDNER, f));
    assert.deepStrictEqual([g.w, g.h], [62, 62], f);
  });
});

test('Ladeliste kennt genau vier Laufbilder fuer den Spitzel', () => {
  const quelle = fs.readFileSync(path.join(__dirname, '..', 'js', 'enemyAssets.js'), 'utf8');
  assert.match(quelle, /\balarm: 4\b/);
});

test('Spitzel heisst Spitzel / Informer, nirgends mehr Alarmwicht', () => {
  if (globalThis.window) delete globalThis.window.EnemySpawnGating;
  loadGameModule('js/enemySpawnGating.js');
  const G = globalThis.window.EnemySpawnGating;
  assert.strictEqual(G.enemyName(16, 'de'), 'Spitzel');
  assert.strictEqual(G.enemyName(16, 'en'), 'Informer');
  const quelle = fs.readFileSync(path.join(__dirname, '..', 'js', 'enemySpawnGating.js'), 'utf8');
  assert.doesNotMatch(quelle, /'Alarmwicht'|'Alarm Imp'/);
});

let H = null;
// Mit ?gegnerlauf=1, sonst laedt das Spiel die Laufbilder gar nicht.
before(async () => {
  H = await launch({ search: '?dungeon=5&gegnerlauf=1', renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await H.waitForScene('GameScene', { maxRounds: 250 });
  if (!ok) throw new Error('GameScene wurde nicht erreicht');
  await H.settle(() => false, { maxRounds: 10 });
});
after(async () => { if (H) await H.shutdown(); });

test('der gespawnte Spitzel traegt die neuen Bilder', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var e = spawnEnemy.call(sc, player.x + 150, player.y, 16);
    if (!e) return null;
    var out = { key: e.texture.key, alarm: !!e.isAlarm, pre: e._spritePrefix, bilder: {} };
    ['right0','right1','right2','left0','walk_right0','walk_right3','walk_left3'].forEach(function (n) {
      var k = 'alarm_' + n;
      var t = sc.textures.exists(k) ? sc.textures.get(k).getSourceImage() : null;
      out.bilder[n] = t ? t.width + 'x' + t.height : null;
    });
    out.walk4 = sc.textures.exists('alarm_walk_right4');
    return out;
  })()`);
  assert.ok(r, 'kein Gegner gespawnt');
  assert.strictEqual(r.key, 'alarm_right0');
  assert.ok(r.alarm);
  assert.strictEqual(r.pre, 'alarm');
  ['right0', 'right1', 'right2', 'left0', 'walk_right0', 'walk_right3', 'walk_left3'].forEach((n) => {
    assert.strictEqual(r.bilder[n], '62x62', n);
  });
  assert.strictEqual(r.walk4, false, 'ein fuenftes Laufbild duerfte es nicht geben');
});
