// tests/schlagFolge.test.js — der Nahkampfschlag ist eine Bewegung der Figur (#171).
//
// Vorher zeigte attack() nur einen halbdurchsichtigen grauen Kegel; die
// Figur stand still. Jetzt spielt eine eigene Bildfolge
// (assets/PlayerSprites/schlagDD_f00..f07, PixelLab, tools/schlagBauen.js)
// auf einem Bild, das dem Spieler folgt — gebaut wie die Rolle (#179).
//
// Geprueft am echten Weg (attack), in allen acht Richtungen:
//   - das Schlagbild der Angriffsrichtung erscheint, an der Stelle der Figur,
//     der Spieler ist so lange unsichtbar, danach ist alles zurueck; der
//     Kegel wird gar nicht mehr gezeichnet. Stattdessen zieht im
//     Aufschlagbild (f04) eine kurze Wischspur in Schlagrichtung, die nach
//     hoechstens 200 ms spurlos verschwindet — auch beim Szenenneustart.
//   - Rueckfall: fehlen die Schlagbilder einer Richtung oder traegt der
//     Spieler ein fremdes Bild (Verkleidung), zeigt der alte Kegel den
//     Schlag, ohne Spur. Die TREFFER sind in jedem Fall dieselben.
//   - geladen wird die Folge erst mit dem Dungeon, nicht schon beim Start.

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
 * `fremdBild`: der Spieler traegt beim Schlag dieses Bild statt seines
 * Gehbildes (wie in einer Verkleidung).
 */
function schlagen(H, dd, fremdBild) {
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
    var hoererVorher = sc.events.listeners('postupdate');
    var fremd = ${JSON.stringify(fremdBild || null)};
    if (fremd) player.setTexture(fremd);
    try { attack.call(sc); } finally {
      if (fremd) player.setTexture('dir${dd}_f00');
      sc.add.graphics = g0; dealDamageToEnemy = d0; forEachEnemyInRange = fe0; handleEnemyHit = h0;
      if (window.__zielAlt) { window.InputScheme.getAimDirection = window.__zielAlt; window.__zielAlt = null; }
    }
    // Die neuen postupdate-Hoerer dieses Schlags merken: sie muessen wieder weg.
    window.__schlagHoerer = sc.events.listeners('postupdate').filter(function (f) {
      return hoererVorher.indexOf(f) < 0; });
    // Die Wischspur: nur unser eigenes Objekt (Name), nicht Fass-Splitter.
    // Ihre Strichpunkte je Bild mitschreiben (clear beginnt ein neues Bild).
    var spuren = sc.children.list.filter(function (o) { return o.name === 'schlagSpur'; });
    spuren.forEach(function (g) {
      g.__p = [];
      var c0 = g.clear, m0 = g.moveTo, l0 = g.lineTo;
      g.clear = function () { g.__p = []; return c0.apply(this, arguments); };
      g.moveTo = function (px, py) { g.__p.push([px, py]); return m0.apply(this, arguments); };
      g.lineTo = function (px, py) { g.__p.push([px, py]); return l0.apply(this, arguments); };
    });
    var bild = sc.children.list.filter(function (o) {
      return o.active && o.texture && /^schlag/.test(o.texture.key);
    })[0];
    return { treffer: treffer, alphas: alphas, sichtbar: player.visible, vorher: vorher, geh: geh,
             spuren: spuren.length, spurSichtbar: spuren.some(function (g) { return g.visible; }),
             hoerer: window.__schlagHoerer.length,
             key: bild ? bild.texture.key : null, schlag: bild ? welt(bild, bild.texture.key) : null };
  })())`));
}

/**
 * Taktet den Schlag zu Ende und sammelt die gezeigten Schlagbilder — und wann
 * und wo die Wischspur zu sehen war: das Schlagbild beim ersten Auftauchen,
 * der Mittelpunkt ihrer Strichpunkte relativ zum Angriffsursprung, die Zeit.
 */
function zuEnde(H) {
  const gesehen = new Set();
  let spur = null;
  for (let i = 0; i < 60; i++) {
    const z = JSON.parse(H.run(`JSON.stringify((function () {
      var sc = window.game.scene.getScene('GameScene');
      var o = sc.children.list.filter(function (o) {
        return o.active && o.texture && /^schlag/.test(o.texture.key); })[0];
      var g = sc.children.list.filter(function (o) { return o.name === 'schlagSpur'; })[0];
      var u = angriffsUrsprung();
      var p = (g && g.visible && g.__p) ? g.__p : [];
      var mx = 0, my = 0;
      p.forEach(function (q) { mx += q[0]; my += q[1]; });
      return { key: o ? o.texture.key : null, bild: o ? o.frame.texture.key : null, jetzt: sc.time.now,
               da: !!g, spur: p.length ? { dx: mx / p.length - u.x, dy: my / p.length - u.y } : null };
    })())`));
    if (z.spur) {
      if (!spur) spur = { bild: z.bild, ab: z.jetzt, dx: z.spur.dx, dy: z.spur.dy };
      spur.sichtbarBis = z.jetzt;
    }
    // Wie lange das Objekt selbst lebt — gezeichnet oder nicht.
    if (z.da && spur) spur.bis = z.jetzt;
    if (!z.key) break;
    gesehen.add(z.key);
    H.step(1);
  }
  return { gesehen, spur };
}

const nachher = `({ sichtbar: player.visible, w: player.displayWidth, h: player.displayHeight,
  ox: player.originX, oy: player.originY, richtung: (player.getData('animState') || {}).direction,
  rest: window.game.scene.getScene('GameScene').children.list.filter(function (o) {
    return o.active && o.texture && /^schlag/.test(o.texture.key); }).length,
  spurRest: window.game.scene.getScene('GameScene').children.list.filter(function (o) {
    return o.name === 'schlagSpur'; }).length,
  hoererRest: (function () { var l = window.game.scene.getScene('GameScene').events.listeners('postupdate');
    return (window.__schlagHoerer || []).filter(function (f) { return l.indexOf(f) >= 0; }).length; })() })`;

let MIT = null;
before(async () => {
  MIT = await startenMit('?debug=1&dungeon=1');
});
after(async () => { if (MIT) await MIT.shutdown(); });

test('in jeder Richtung schlaegt die Figur selbst', () => {
  const abweichung = [];
  for (const dd of Object.keys(RICHTUNGEN)) {
    const r = schlagen(MIT, dd);
    assert.strictEqual(r.key, 'schlag' + dd + '_f00', dd + ': kein oder falsches Schlagbild: ' + r.key);
    assert.strictEqual(r.sichtbar, false, dd + ': der Spieler steht sichtbar neben seinem Schlag');
    assert.deepStrictEqual(r.treffer, ['vorn'], dd + ': Treffer');
    assert.deepStrictEqual(r.alphas, [], dd + ': der Kegel wird noch gezeichnet');
    assert.strictEqual(r.spuren, 1, dd + ': keine (oder mehr als eine) Wischspur angelegt');
    assert.strictEqual(r.spurSichtbar, false, dd + ': die Wischspur steht schon beim Ausholen');
    const dm = Math.abs(r.schlag.mitte - r.geh.mitte), df = Math.abs(r.schlag.fuss - r.geh.fuss);
    if (dm > 4 || df > 4) abweichung.push(dd + ' Mitte ' + dm.toFixed(1) + ' Fuss ' + df.toFixed(1));

    const { gesehen, spur } = zuEnde(MIT);
    assert.ok(gesehen.size >= 6, dd + ': nur ' + gesehen.size + ' Schlagbilder gezeigt: ' + [...gesehen]);
    assert.ok(spur, dd + ': die Wischspur war nie zu sehen');
    assert.strictEqual(spur.bild, 'schlag' + dd + '_f04', dd + ': die Spur erscheint nicht im Aufschlagbild');
    // Mittelpunkt des Bogens in Schlagrichtung (8 Richtungen liegen 45 Grad
    // auseinander; 10 Grad Spiel trennt sie sicher).
    const [x, y] = RICHTUNGEN[dd];
    const ln = Math.hypot(x, y), weit = Math.hypot(spur.dx, spur.dy);
    const cos = (spur.dx * x + spur.dy * y) / (ln * weit);
    assert.ok(cos > Math.cos(Math.PI / 18), dd + ': Spur liegt nicht in Schlagrichtung: ' + JSON.stringify(spur));
    assert.ok(weit > 30 && weit < 100, dd + ': Spur nicht in Waffenreichweite: ' + weit.toFixed(1));
    // Etwa 100 ms zu sehen, dann sofort weg — nicht erst mit dem Schlagbild.
    assert.ok(spur.sichtbarBis - spur.ab >= 50, dd + ': Spur nur ' + (spur.sichtbarBis - spur.ab) + ' ms zu sehen');
    assert.ok(spur.bis - spur.ab <= 130, dd + ': Spur lebt ' + (spur.bis - spur.ab) + ' ms');
    const n = MIT.run(nachher);
    assert.strictEqual(n.rest, 0, dd + ': das Schlagbild bleibt stehen');
    assert.strictEqual(n.spurRest, 0, dd + ': die Wischspur bleibt liegen');
    assert.strictEqual(n.hoererRest, 0, dd + ': ein postupdate-Hoerer des Schlags bleibt haengen');
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

test('Szenenneustart mitten im Schlag (Tod, Abstieg): Spur und Hoerer sind weg', async () => {
  const r = schlagen(MIT, '04');
  assert.strictEqual(r.spuren, 1);
  for (let i = 0; i < 40; i++) {
    MIT.step(1);
    if (MIT.run(`window.game.scene.getScene('GameScene').children.list.some(function (o) {
      return o.name === 'schlagSpur' && o.visible; })`)) break;
  }
  MIT.run('player.__vorNeustart = true');
  MIT.run(`window.game.scene.getScene('GameScene').scene.restart()`);
  MIT.step(1);
  const ok = await MIT.waitForScene('GameScene', { maxRounds: 250 });
  assert.ok(ok, 'GameScene kam nach dem Neustart nicht wieder');
  assert.strictEqual(MIT.run('!!player.__vorNeustart'), false, 'die Szene wurde gar nicht neu gestartet');
  MIT.step(5);
  const n = MIT.run(nachher);
  assert.strictEqual(n.spurRest, 0, 'die Wischspur ueberlebt den Neustart');
  assert.strictEqual(n.hoererRest, 0, 'ein postupdate-Hoerer des Schlags ueberlebt den Neustart');
});

/** Rueckfall: der alte Kegel, kein Schlagbild, keine Spur — auch spaeter nicht. */
function kegelStattSchlag(r, dd, was) {
  assert.strictEqual(r.key, null, dd + ': Schlagbild trotz ' + was);
  assert.strictEqual(r.sichtbar, true, dd + ': Spieler versteckt trotz ' + was);
  assert.deepStrictEqual(r.treffer, ['vorn'], dd + ': Treffer');
  assert.deepStrictEqual(r.alphas, [0.2], dd + ': kein Kegel bei ' + was);
  assert.strictEqual(r.spuren, 0, dd + ': Wischspur trotz ' + was);
  for (let i = 0; i < 20; i++) {
    MIT.step(1);
    const s = MIT.run(`window.game.scene.getScene('GameScene').children.list.filter(function (o) {
      return o.name === 'schlagSpur'; }).length`);
    assert.strictEqual(s, 0, dd + ': Wischspur trotz ' + was + ' (spaeter)');
  }
  MIT.step(60);
}

test('Rueckfall: ein fremdes Bild am Spieler (Verkleidung) schlaegt mit dem Kegel', () => {
  kegelStattSchlag(schlagen(MIT, '06', 'particle'), '06', 'fremdem Bild');
});

test('Rueckfall: fehlen die Schlagbilder einer Richtung, zeigt der Kegel den Schlag', () => {
  MIT.run(`(function () {
    var t = window.game.textures;
    for (var f = 0; f < 8; f++) t.remove('schlag04_f0' + f);
  })()`);
  kegelStattSchlag(schlagen(MIT, '04'), '04', 'fehlenden Bildern');
  // Die anderen Richtungen schlagen weiter selbst.
  const r = schlagen(MIT, '06');
  assert.strictEqual(r.key, 'schlag06_f00', '06: der Rueckfall einer Richtung trifft alle');
  assert.deepStrictEqual(r.alphas, [], '06: Kegel');
  zuEnde(MIT);
  MIT.step(60);
});

test('Laden: die Schlagbilder kommen mit dem Dungeon, nicht beim Start, und nie doppelt', () => {
  const r = JSON.parse(MIT.run(`JSON.stringify((function () {
    function fang(fn, gibts) {
      var keys = [];
      fn({ image: function (k) { keys.push(k); },
           textureManager: { exists: function (k) { return gibts(k); } } });
      return keys.filter(function (k) { return /^schlag/.test(k); });
    }
    var t = window.game.textures;
    return {
      // Im Dungeon: alle 64 (bis auf die oben entfernten) liegen vor.
      da: Object.keys(t.list).filter(function (k) { return /^schlag/.test(k); }).length,
      // Der Start (StartScene) laedt keine Schlagbilder mit.
      start: fang(preloadPlayerDirectionalFrames, function () { return false; }).length,
      // GameScene.preload: ohne Textur alle 64, mit allen vorhandenen keine.
      leer: fang(schlagBilderVorladen, function () { return false; }).length,
      voll: fang(schlagBilderVorladen, function () { return true; }).length
    };
  })())`));
  assert.strictEqual(r.da, 56, 'im Dungeon fehlen Schlagbilder: ' + r.da);
  assert.strictEqual(r.start, 0, 'der Start laedt ' + r.start + ' Schlagbilder');
  assert.strictEqual(r.leer, 64);
  assert.strictEqual(r.voll, 0, 'vorhandene Schlagbilder werden noch einmal geladen');
});
