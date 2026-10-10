// tests/pixelPartikel.test.js — #183: Pixelpartikel je Zweck.
//
// Drei Dinge muessen halten:
//   1. Jeder Effekt zieht aus SEINER Zeile der Tafel — ein Funke ist kein
//      Blutstropfen. Spieler- und Gegnerblut liegen VOR der Figur, ein Prop
//      zerbricht in sein Material.
//   2. Fehlt die Tafel (Ladefehler), bleiben die alten zwei weichen Punkte,
//      und ein Prop zerbricht wie der alte Gegnertod.
//   3. Die Teilchenzahl bleibt dieselbe (Mobile): neue Bilder, keine neuen
//      Massen.
//
// Ein Spiel genuegt: erst mit der Tafel messen, dann die Tafel entfernen und
// den Rueckfall messen.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const sharp = require('sharp');
const { launchDungeon } = require('../tools/headless/index.js');

const TAFEL = path.join(__dirname, '..', 'assets', 'tiles', 'partikel_atlas.png');

// Jeden Effekt einmal ausloesen und festhalten, was der Emitter traegt.
const AUSLOESEN = `(function () {
  var pf = window.particleFactory;
  var sc = window.game.scene.getScene('GameScene');
  var faelle = {
    hitSpark: function () { return pf.hitSpark(200, 200); },
    bloodSplat: function () { return pf.bloodSplat(200, 200); },
    deathBurst: function () { return pf.deathBurst(200, 200); },
    playerHit: function () { return pf.playerHit(200, 200); },
    lootSparkle: function () { return pf.lootSparkle(200, 200); },
    feuerSpur: function () { return pf.abilityTrail(200, 200, 0xff7a1a); },
    frostSpur: function () { return pf.abilityTrail(200, 200, 0x9fe8ff); },
    lilaSpur: function () { return pf.abilityTrail(200, 200, 0x9b6bff); }
  };
  var out = { tafelGeladen: sc.textures.exists('partikel_atlas') };
  Object.keys(faelle).forEach(function (k) {
    var e = faelle[k]();
    out[k] = {
      bild: e.texture.key,
      bilder: (e.frames || []).map(function (f) { return (f && typeof f === 'object') ? f.name : f; }),
      teilchen: e.getAliveParticleCount(),
      getoent: !!(e.ops && e.ops.tint && e.ops.tint.propertyValue !== 0xffffff)
    };
  });
  return out;
})()`;

// Die echten Spielwege statt der Fabrik: ein Treffer am Spieler ueber
// applyPlayerDamage (dort landen die Schlaege der Gegner-KI und der Bosse),
// ein Geschoss ueber hitByProjectile, ein Treffer am Gegner ueber
// handleEnemyHit, und zerschlagene Props ueber breakDestructibleObstacle.
// Festgehalten wird jeder Emitter, den die ParticleFactory dabei erzeugt.
const SPIELWEGE = `(function () {
  var pf = window.particleFactory;
  var sc = window.game.scene.getScene('GameScene');
  var erzeugt = [];
  var echtBurst = pf.burst;
  pf.burst = function () {
    var e = echtBurst.apply(this, arguments);
    if (e) erzeugt.push(e);
    return e;
  };
  function fang(fn) {
    erzeugt = [];
    fn();
    return erzeugt.map(function (e) {
      return {
        bild: e.texture.key,
        bilder: (e.frames || []).map(function (f) { return (f && typeof f === 'object') ? f.name : f; }),
        teilchen: e.getAliveParticleCount(),
        tiefe: e.depth,
        // Toenung und Tempo zeigen, ob es wirklich der alte deathBurst ist.
        toenung: e.ops && e.ops.tint ? [].concat(e.ops.tint.propertyValue) : null,
        schwerkraft: e.gravityY
      };
    });
  }
  function prop(typ) {
    var o = sc.add.sprite(player.x + 120, player.y, 'particle');
    o.setData('type', typ);
    o.setData('destructible', true);
    o.setData('lootTier', 'minor');
    return o;
  }
  window.PLAYER_DODGE_CHANCE = 0;
  window.playerBlockChance = 0;
  window._playerInvincible = false;
  var out = { spielerTiefe: player.depth };
  out.treffer = fang(function () { applyPlayerDamage(1, sc); });
  window._playerInvincible = false;
  out.geschoss = fang(function () { hitByProjectile.call(sc, player, { getData: function () { return null; }, damage: 1, setActive: function () { return this; }, setVisible: function () { return this; } }); });
  window._playerInvincible = false;
  var sem = window.statusEffectManager, SET = window.StatusEffectType;
  out.blutung = fang(function () { sem._applyTickDamage(player, 1, SET.BLEED); });
  out.brand = fang(function () { sem._applyTickDamage(player, 1, SET.BURN); });
  // Ein echter Gegner in der Gegner-Ebene: getroffen, aber nicht tot.
  var g = spawnEnemy.call(sc, player.x + 150, player.y, 1);
  if (g) {
    g.hp = 1000; g.maxHp = 1000;
    out.gegnerTiefe = (g.displayList && g.displayList !== sc.sys.displayList) ? g.displayList.depth : g.depth;
    out.gegnerInEbene = !!(sc.enemyLayer && g.displayList === sc.enemyLayer);
    out.gegnerBlut = fang(function () { handleEnemyHit(sc, g, {}); })
      .filter(function (e) { return e.teilchen === 4; });
    g.destroy();
  }
  out.fass = fang(function () { breakDestructibleObstacle(sc, prop('barrel')); });
  out.kiste = fang(function () { breakDestructibleObstacle(sc, prop('crate')); });
  out.statue = fang(function () { breakDestructibleObstacle(sc, prop('statue')); });
  out.material = {};
  ['barrel', 'barrel2', 'crate', 'chest_small', 'chest_large', 'rubble', 'statue', 'pillar_small',
    'altar', 'brazier', 'brazer', 'unbekannt'].forEach(function (t) {
    out.material[t] = window.objektMaterial ? window.objektMaterial(t) : null;
  });
  pf.burst = echtBurst;
  if (typeof playerHealth !== 'undefined') playerHealth = Math.max(playerHealth, 50);
  return out;
})()`;

let mit = null, ohne = null, wegeMit = null, wegeOhne = null;
before(async () => {
  const H = await launchDungeon({ depth: 5 });
  try {
    mit = H.run(AUSLOESEN); wegeMit = H.run(SPIELWEGE);
    // Erst alle Emitter auf der Tafel auslaufen lassen, dann die Tafel weg.
    H.step(120);
    H.run(`window.game.textures.remove('partikel_atlas')`);
    ohne = H.run(AUSLOESEN); wegeOhne = H.run(SPIELWEGE);
  } finally { await H.shutdown(); }
});

const zeilenVon = (bilder) => [...new Set(Array.prototype.map.call(bilder, (b) => Math.floor(Number(b) / 8)))].sort((a, b) => a - b);

test('die Tafel wird im Dungeon geladen', () => {
  assert.strictEqual(mit.tafelGeladen, true, 'die Tafel wurde nicht geladen');
  assert.strictEqual(ohne.tafelGeladen, false, 'die Tafel liess sich fuer den Rueckfall nicht entfernen');
});

test('ein Treffer am Spieler spritzt rotes Blut vor der Figur, genau einmal', () => {
  for (const [w, mitTafel] of [[wegeMit, true], [wegeOhne, false]]) {
    const was = mitTafel ? 'mit Tafel' : 'ohne Tafel';
    assert.strictEqual(w.treffer.length, 1, was + ': applyPlayerDamage erzeugt ' + w.treffer.length + ' Emitter');
    const t = w.treffer[0];
    assert.ok(t.tiefe > w.spielerTiefe, was + ': das Blut liegt hinter der Figur (Tiefe ' + t.tiefe + ')');
    assert.strictEqual(t.teilchen, 8, was + ': andere Teilchenzahl als bisher');
    // Das Geschoss spritzt genau einmal — nicht zusaetzlich zum Schadensweg.
    assert.strictEqual(w.geschoss.length, 1, was + ': das Geschoss erzeugt ' + w.geschoss.length + ' Emitter');
    // Eine Blutung tropft, ein Brand nicht.
    assert.strictEqual(w.blutung.length, 1, was + ': die Blutung tropft nicht');
    assert.strictEqual(w.brand.length, 0, was + ': ein Brand blutet');
  }
  assert.strictEqual(wegeMit.treffer[0].bild, 'partikel_atlas');
  assert.deepStrictEqual(zeilenVon(wegeMit.treffer[0].bilder), [1], 'Spielerblut zieht aus den Zeilen ' + zeilenVon(wegeMit.treffer[0].bilder).join(','));
  assert.deepStrictEqual(zeilenVon(wegeMit.geschoss[0].bilder), [1]);
  assert.deepStrictEqual(zeilenVon(wegeMit.blutung[0].bilder), [1]);
  // Rueckfall: der alte rote Punkt.
  assert.strictEqual(wegeOhne.treffer[0].bild, 'particle');
});

test('ein Treffer am Gegner spritzt Blut VOR den Gegner', () => {
  for (const [w, was] of [[wegeMit, 'mit Tafel'], [wegeOhne, 'ohne Tafel']]) {
    assert.ok(w.gegnerBlut, was + ': kein Gegner erzeugt');
    assert.strictEqual(w.gegnerInEbene, true, was + ': der Gegner steckt nicht in der Gegner-Ebene — der Fall misst nichts');
    assert.strictEqual(w.gegnerBlut.length, 1, was + ': handleEnemyHit erzeugt ' + w.gegnerBlut.length + ' Blut-Emitter');
    assert.ok(w.gegnerBlut[0].tiefe > w.gegnerTiefe,
      was + ': das Blut liegt hinter dem Gegner (Tiefe ' + w.gegnerBlut[0].tiefe + ' <= ' + w.gegnerTiefe + ')');
  }
  assert.deepStrictEqual(zeilenVon(wegeMit.gegnerBlut[0].bilder), [1]);
});

test('ein Fass zerbricht in Holz, die Statue in Stein — kein Blut', () => {
  ['fass', 'kiste'].forEach((k) => {
    assert.strictEqual(wegeMit[k].length, 1, k);
    const z = zeilenVon(wegeMit[k][0].bilder);
    assert.deepStrictEqual(z, [9], k + ' zieht aus den Zeilen ' + z.join(','));
    assert.strictEqual(wegeMit[k][0].teilchen, ohne.deathBurst.teilchen, k + ': andere Teilchenzahl als bisher');
  });
  const s = zeilenVon(wegeMit.statue[0].bilder);
  assert.deepStrictEqual(s, [3, 5], 'die Statue zieht aus den Zeilen ' + s.join(','));
  // Der Gegnertod bleibt Daemonenblut + Splitter.
  assert.deepStrictEqual(zeilenVon(mit.deathBurst.bilder), [2, 3]);
});

test('Rueckfall ohne Tafel: ein Prop zerbricht wie der alte Gegnertod', () => {
  ['fass', 'kiste', 'statue'].forEach((k) => {
    assert.strictEqual(wegeOhne[k].length, 1, k);
    assert.strictEqual(wegeOhne[k][0].bild, 'particle', k + ' traegt ' + wegeOhne[k][0].bild);
    assert.strictEqual(wegeOhne[k][0].teilchen, ohne.deathBurst.teilchen, k + ': nicht mehr der alte Gegnertod');
    // deathBurst: rot/orange getoent, ohne Schwerkraft.
    assert.ok(wegeOhne[k][0].toenung && wegeOhne[k][0].toenung.indexOf(0xff2222) >= 0,
      k + ': die alte Toenung fehlt (' + JSON.stringify(wegeOhne[k][0].toenung) + ')');
    assert.strictEqual(wegeOhne[k][0].schwerkraft, 0, k + ': faellt im Rueckfall');
  });
});

test('Material je Prop-Typ (alle zerschlagbaren Typen aus roomTemplates.js)', () => {
  const erwartet = {
    barrel: 'holz', barrel2: 'holz', crate: 'holz', chest_small: 'holz', chest_large: 'holz',
    rubble: 'stein', statue: 'stein', pillar_small: 'stein', altar: 'stein',
    brazier: 'metall', brazer: 'metall', unbekannt: 'staub'
  };
  assert.deepStrictEqual(Object.assign({}, wegeMit.material), erwartet);
});

test('die Tafel: elf Zeilen zu sechs Bildern, keines leer', async () => {
  const m = await sharp(TAFEL).metadata();
  assert.strictEqual(m.width + 'x' + m.height, '128x176');
  const { data } = await sharp(TAFEL).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let z = 0; z < 11; z++) {
    for (let s = 0; s < 6; s++) {
      let n = 0;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (data[(((z * 16 + y) * 128) + s * 16 + x) * 4 + 3] > 24) n++;
      }
      assert.ok(n >= 4, 'Zeile ' + z + ', Bild ' + s + ' ist leer (' + n + ' Pixel)');
    }
  }
});

test('Rueckfall ohne Tafel: die alten zwei Punkte', () => {
  const erwartet = {
    hitSpark: 'particle', bloodSplat: 'particle', deathBurst: 'particle', playerHit: 'particle',
    lootSparkle: 'particle_soft', feuerSpur: 'particle_soft', frostSpur: 'particle_soft', lilaSpur: 'particle_soft'
  };
  Object.keys(erwartet).forEach((k) => {
    assert.strictEqual(ohne[k].bild, erwartet[k], k + ' traegt ' + ohne[k].bild);
  });
});

test('jeder Effekt zieht aus seiner eigenen Zeile', () => {
  const erwartet = {
    hitSpark: [0], bloodSplat: [1], playerHit: [1], deathBurst: [2, 3],
    feuerSpur: [4], lilaSpur: [6], frostSpur: [7], lootSparkle: [8]
  };
  Object.keys(erwartet).forEach((k) => {
    assert.strictEqual(mit[k].bild, 'partikel_atlas', k + ' traegt ' + mit[k].bild);
    assert.deepStrictEqual(zeilenVon(mit[k].bilder), erwartet[k],
      k + ' zieht aus den Zeilen ' + zeilenVon(mit[k].bilder).join(','));
  });
});

test('mit Tafel gleich viele Teilchen wie die alten Punkte', () => {
  Object.keys(ohne).forEach((k) => {
    if (k === 'tafelGeladen') return;
    assert.strictEqual(mit[k].teilchen, ohne[k].teilchen,
      k + ': ' + mit[k].teilchen + ' Teilchen statt ' + ohne[k].teilchen);
    assert.ok(ohne[k].teilchen > 0, k + ': der Fall misst nichts');
  });
});

test('Bilder mit eigener Farbe werden nicht getoent, die Magiespur schon', () => {
  assert.strictEqual(ohne.bloodSplat.getoent, true, 'im Rueckfall war Blut ein roter Punkt — der Fall misst nichts');
  assert.strictEqual(mit.bloodSplat.getoent, false, 'der Blutstropfen wird umgefaerbt');
  assert.strictEqual(mit.hitSpark.getoent, false, 'der Funke wird umgefaerbt');
  assert.strictEqual(mit.lilaSpur.getoent, true, 'die Magiespur verliert die Farbe der Faehigkeit');
});
