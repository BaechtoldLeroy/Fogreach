// tests/schlagFolge.test.js — der Nahkampfschlag ist eine Bewegung der Figur (#171).
//
// Vorher zeigte attack() nur einen halbdurchsichtigen grauen Kegel; die
// Figur stand still. Hinter ?schlag=neu spielt jetzt eine eigene Bildfolge
// (assets/PlayerSprites/schlagDD_f00..f07, PixelLab, tools/schlagBauen.js)
// auf einem Bild, das dem Spieler folgt — gebaut wie die Rolle (#179).
//
// Geprueft am echten Weg (attack), in allen acht Richtungen:
//   - mit Flagge: das Schlagbild der Angriffsrichtung erscheint, an der Stelle
//     der Figur, der Spieler ist so lange unsichtbar, danach ist alles zurueck;
//     der Kegel ist nur noch ein Hauch.
//   - die TREFFER sind mit und ohne Flagge dieselben.
//   - ohne Flagge: kein Schlagbild, keine Schlagtextur geladen, Kegel wie bisher.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

async function startenMit(search) {
  const h = await launch({ search: search, renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await h.waitForScene('GameScene', { maxRounds: 250 });
  if (!ok) { await h.shutdown(); throw new Error('GameScene wurde nicht erreicht'); }
  h.run('window._playerInvincible = true');
  await h.settle(() => false, { maxRounds: 10 });
  return h;
}

// dir-Nummer -> Zielrichtung (PLAYER_DIRECTION_SEQUENCE in js/player.js).
const RICHTUNGEN = {
  '00': [-1, 0], '01': [-1, -1], '02': [0, -1], '03': [1, -1],
  '04': [1, 0], '05': [1, 1], '06': [0, 1], '07': [-1, 1]
};

/**
 * Schlaegt in Richtung dd. Misst Figur und Schlagbild im ersten Bild, den
 * Kegel und die getroffenen Puppen. Die Puppen stehen fest um den Spieler:
 * eine vor ihm, eine hinter ihm — die vordere muss getroffen werden.
 */
function schlagen(H, dd) {
  const [x, y] = RICHTUNGEN[dd];
  return JSON.parse(H.run(`JSON.stringify((function () {
    var sc = window.game.scene.getScene('GameScene');
    isAttacking = false; attackCooldown = false; isRolling = false;
    player.setTexture('dir${dd}_f00');
    applyPlayerDisplaySettings(player);
    lastMoveDirection.set(${x}, ${y});
    if (window.InputScheme && window.InputScheme.getAimDirection) {
      window.__zielAlt = window.InputScheme.getAimDirection;
      window.InputScheme.getAimDirection = function () { return { x: ${x}, y: ${y} }; };
    }
    function welt(sprite, key) {
      var m = figurGrenzen(sc, key);
      var fr = sc.textures.getFrame(key);
      var sx = sprite.displayWidth / fr.width, sy = sprite.displayHeight / fr.height;
      var links = sprite.x - sprite.originX * sprite.displayWidth;
      var oben = sprite.y - sprite.originY * sprite.displayHeight;
      return { mitte: links + (m.minX + m.maxX + 1) / 2 * sx, fuss: oben + (m.maxY + 1) * sy };
    }
    var geh = welt(player, 'dir${dd}_f00');
    var vorher = { w: player.displayWidth, h: player.displayHeight, ox: player.originX, oy: player.originY };
    // Kegel mitschneiden: showAttackEffect zeichnet einen Kreisausschnitt
    // (slice) ueber scene.add.graphics. Nur die Ausschnitte zaehlen — ein
    // zufaellig vor dem Spieler stehendes Fass zerbricht mit eigenen
    // Grafiken (Deckkraft 0.3/0.16), das machte den Fall wackelig.
    var alphas = [];
    var g0 = sc.add.graphics;
    sc.add.graphics = function () {
      var g = g0.apply(this, arguments);
      var f0 = g.fillStyle, s0 = g.slice, a0 = null;
      g.fillStyle = function (c, a) { a0 = a; return f0.apply(this, arguments); };
      g.slice = function () { alphas.push(a0); return s0.apply(this, arguments); };
      return g;
    };
    // Zwei Puppen: vorn und hinten, 40 px weg. Schaden mitzaehlen.
    var treffer = [];
    var d0 = dealDamageToEnemy;
    dealDamageToEnemy = function (s, e) { treffer.push(e.__puppe); };
    var fe0 = forEachEnemyInRange;
    var len = Math.hypot(${x}, ${y});
    var puppen = [
      { __puppe: 'vorn', active: true, x: player.x + ${x} / len * 40, y: player.y + ${y} / len * 40, hp: 100 },
      { __puppe: 'hinten', active: true, x: player.x - ${x} / len * 40, y: player.y - ${y} / len * 40, hp: 100 }
    ];
    var u = angriffsUrsprung();
    forEachEnemyInRange = function (r, cb) {
      puppen.forEach(function (p) { cb(p, { dx: p.x - u.x, dy: p.y - u.y }); });
    };
    var h0 = handleEnemyHit; handleEnemyHit = function () {};
    try { attack.call(sc); } finally {
      sc.add.graphics = g0; dealDamageToEnemy = d0; forEachEnemyInRange = fe0; handleEnemyHit = h0;
      if (window.__zielAlt) { window.InputScheme.getAimDirection = window.__zielAlt; window.__zielAlt = null; }
    }
    var bild = sc.children.list.filter(function (o) {
      return o.active && o.texture && /^schlag/.test(o.texture.key);
    })[0];
    return { treffer: treffer, alphas: alphas, sichtbar: player.visible, vorher: vorher, geh: geh,
             key: bild ? bild.texture.key : null, schlag: bild ? welt(bild, bild.texture.key) : null };
  })())`));
}

/** Taktet den Schlag zu Ende und sammelt die gezeigten Schlagbilder. */
function zuEnde(H) {
  const gesehen = new Set();
  for (let i = 0; i < 60; i++) {
    const k = H.run(`(function () {
      var o = window.game.scene.getScene('GameScene').children.list.filter(function (o) {
        return o.active && o.texture && /^schlag/.test(o.texture.key); })[0];
      return o ? o.texture.key : null; })()`);
    if (!k) break;
    gesehen.add(k);
    H.step(1);
  }
  return gesehen;
}

const nachher = `({ sichtbar: player.visible, w: player.displayWidth, h: player.displayHeight,
  ox: player.originX, oy: player.originY, richtung: (player.getData('animState') || {}).direction,
  rest: window.game.scene.getScene('GameScene').children.list.filter(function (o) {
    return o.active && o.texture && /^schlag/.test(o.texture.key); }).length })`;

let MIT = null, OHNE = null;
before(async () => {
  MIT = await startenMit('?debug=1&dungeon=1&schlag=neu');
});
after(async () => { if (MIT) await MIT.shutdown(); if (OHNE) await OHNE.shutdown(); });

test('mit ?schlag=neu: in jeder Richtung schlaegt die Figur selbst', () => {
  const abweichung = [];
  for (const dd of Object.keys(RICHTUNGEN)) {
    const r = schlagen(MIT, dd);
    assert.strictEqual(r.key, 'schlag' + dd + '_f00', dd + ': kein oder falsches Schlagbild: ' + r.key);
    assert.strictEqual(r.sichtbar, false, dd + ': der Spieler steht sichtbar neben seinem Schlag');
    assert.deepStrictEqual(r.treffer, ['vorn'], dd + ': Treffer');
    assert.deepStrictEqual(r.alphas, [0.07], dd + ': der Kegel ist nicht zurueckgenommen');
    const dm = Math.abs(r.schlag.mitte - r.geh.mitte), df = Math.abs(r.schlag.fuss - r.geh.fuss);
    if (dm > 4 || df > 4) abweichung.push(dd + ' Mitte ' + dm.toFixed(1) + ' Fuss ' + df.toFixed(1));

    const gesehen = zuEnde(MIT);
    assert.ok(gesehen.size >= 6, dd + ': nur ' + gesehen.size + ' Schlagbilder gezeigt: ' + [...gesehen]);
    const n = MIT.run(nachher);
    assert.strictEqual(n.rest, 0, dd + ': das Schlagbild bleibt stehen');
    assert.strictEqual(n.sichtbar, true, dd + ': der Spieler bleibt unsichtbar');
    assert.strictEqual(n.richtung, dd, dd + ': danach schaut er nicht in die Schlagrichtung');
    assert.deepStrictEqual([n.w, n.h, n.ox, n.oy], [r.vorher.w, r.vorher.h, r.vorher.ox, r.vorher.oy],
      dd + ': der Spieler hat Groesse oder Ursprung geaendert');
    MIT.step(60);                                  // Abklingzeit
  }
  assert.deepStrictEqual(abweichung, [], 'das Schlagbild steht neben der Figur: ' + abweichung.join('; '));
});

test('die Schlagfolge dauert hoechstens das Schlagfenster und folgt dem Tempo', () => {
  const d = JSON.parse(MIT.run('JSON.stringify([schlagDauer(650), schlagDauer(320), schlagDauer(2000)])'));
  assert.deepStrictEqual(d.map(Math.round), [293, 200, 300]);
});

test('ohne Flagge: Kegel wie bisher, kein Schlagbild, nichts geladen, gleiche Treffer', async () => {
  await MIT.shutdown(); MIT = null;
  OHNE = await startenMit('?debug=1&dungeon=1');
  for (const dd of ['04', '06']) {
    const r = schlagen(OHNE, dd);
    assert.strictEqual(r.key, null, dd + ': Schlagbild ohne Flagge');
    assert.strictEqual(r.sichtbar, true, dd + ': Spieler ohne Flagge versteckt');
    assert.deepStrictEqual(r.treffer, ['vorn'], dd + ': Treffer');
    assert.deepStrictEqual(r.alphas, [0.2], dd + ': Kegel');
    OHNE.step(60);
  }
  const geladen = OHNE.run(`Object.keys(window.game.textures.list).filter(function (k) { return /^schlag/.test(k); }).length`);
  assert.strictEqual(geladen, 0, 'ohne Flagge wurden Schlagbilder geladen');
});
