// tests/spezialVfx.test.js — Wirkbilder der Spezialangriffe (#174, Nachbesserung).
//
// Mit ?spezial=neu bewegt sich die Figur seit b380 mit eigener Bildfolge
// (tests/spezialFolgen.test.js). Die Effekte drumherum waren aber noch die
// gezeichneten Linien und Kreise. Jetzt spielen dafuer Pixel-Effekte aus dem
// PixelLab vfx_workbench (assets/vfx/spezial_*.png, tools/spezialVfxBauen.js).
//
// Geprueft am echten Weg, mit zwei Spielen nebeneinander (mit/ohne Flagge):
//   - je Angriff erscheinen die richtigen Wirkbilder (Textur, Anzahl), an der
//     Stelle der Wirkung, und so gross, dass der Wirkradius im Bild die
//     Reichweite des Angriffs trifft (+-20 %); Boden unter, Luft ueber den
//     Figuren;
//   - die alten Linien (scene.add.graphics/circle aus der Effektfunktion)
//     werden mit Flagge NICHT mehr gezeichnet, ohne Flagge schon;
//   - danach steht nichts mehr herum (Bild, postupdate-/shutdown-Hoerer);
//   - fehlt ein Bild, gibt es die alten Linien;
//   - ohne Flagge wird nichts geladen.
//
// Zufall und Zufallsraum: Treffer gehen nur an zwei feste Puppen, Requisiten
// und Gegnerlogik sind abgeklemmt. Zeit nur per H.step.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let MIT = null, OHNE = null;
before(async () => {
  MIT = await launchDungeon({ depth: 1, zusatz: '&debug=1&spezial=neu' });
  OHNE = await launchDungeon({ depth: 1 });
  for (const H of [MIT, OHNE]) H.run('window._playerInvincible = true');
});
after(async () => {
  if (MIT) await MIT.shutdown();
  if (OHNE) await OHNE.shutdown();
});

/**
 * Stellt den Spieler nach Osten hin, klemmt Ziel, Treffer und Requisiten ab
 * und belauscht die alten Zeichenwege: jedes scene.add.graphics/circle wird
 * mit dem Namen der Effektfunktion gemerkt, aus der es kam.
 */
function vorbereiten(H) {
  // Was ein fehlgeschlagener Fall davor stehen liess, soll den naechsten nicht faelschen.
  for (let i = 0; i < 300 && H.run(`window.game.scene.getScene('GameScene').children.list.some(function (o) {
    return o.active && (o.name === 'spezialVfx' || o.name === 'spezialFolge'); })`); i++) H.step(1);
  // Zufallsraum: eine Richtung (und notfalls einen Platz) suchen, in der
  // 200 px voraus (Ansturm, Sprung) und 40 px dahinter frei sind — sonst
  // bleibt der Sprung an der Wand haengen.
  const r = JSON.parse(H.run(`JSON.stringify((function () {
    var sc = window.game.scene.getScene('GameScene');
    var frei = function (x, y) {
      if (sc.isPointAccessible && !sc.isPointAccessible(x, y)) return false;
      if (typeof isBlockedByObstacle === 'function' && isBlockedByObstacle(x, y)) return false;
      return true;
    };
    var RICHT = [[1, 0, '04'], [-1, 0, '00'], [0, 1, '06'], [0, -1, '02']];
    // Die Richtung mit der laengsten freien Strecke (bis 200 px), wenn auch
    // 40 px dahinter frei sind.
    var suchen = function (mindest) {
      var best = null, weit = 0;
      for (var i = 0; i < RICHT.length; i++) {
        var hinten = frei(player.x - RICHT[i][0] * 40, player.y - RICHT[i][1] * 40);
        var s = 20;
        while (hinten && s <= 200 && frei(player.x + RICHT[i][0] * s, player.y + RICHT[i][1] * s)) s += 20;
        if (hinten && s - 20 > weit) { weit = s - 20; best = RICHT[i]; }
      }
      return weit >= mindest ? best : null;
    };
    var d = suchen(200);
    for (var v = 0; !d && v < 40 && typeof sc.pickAccessibleSpawnPoint === 'function'; v++) {
      var p = sc.pickAccessibleSpawnPoint({ minDistance: 0, maxAttempts: 10 });
      if (p) { if (player.body && player.body.reset) player.body.reset(p.x, p.y); else player.setPosition(p.x, p.y); }
      d = suchen(200);
    }
    return d || suchen(60);
  })())`));
  assert.ok(r, 'kein freier Platz fuer den Angriff');
  const [dx, dy, dd] = r;
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    isAttacking = false; attackCooldown = false; isRolling = false; isDashing = false;
    isChargingSlash = false; chargeSlashCooldown = false;
    if (player.body) player.setVelocity(0, 0);
    player.setTexture('dir${dd}_f00');
    applyPlayerDisplaySettings(player);
    var st = player.getData('animState') || {};
    st.direction = '${dd}'; st.playing = null;
    player.setData('animState', st);
    player.setAlpha(1);
    lastMoveDirection.set(${dx}, ${dy});
    var w = window.__vfx = { treffer: [], alt: {}, linien: [], spur: 0, dir: [${dx}, ${dy}] };
    // Eine feste, ungewoehnliche Reichweite: mit der Startwaffe lag der Wirbel
    // zufaellig nahe an der Vorgabeskala (1,5), und ein vergessener Radius fiel
    // nicht auf.
    w.alt.ar = attackRange; attackRange = 140;
    w.alt.ziel = window.InputScheme && window.InputScheme.getAimDirection;
    if (window.InputScheme) window.InputScheme.getAimDirection = function () { return { x: ${dx}, y: ${dy} }; };
    w.alt.fe = forEachEnemyInRange; w.alt.dd = dealDamageToEnemy; w.alt.he = handleEnemyHit;
    w.alt.br = breakDestructiblesInRange; w.alt.pull = _pullEnemyToPlayer; w.alt.kb = kettenblitzAusloesen;
    w.alt.se = window.statusEffectManager;
    var puppen = [
      { __puppe: 'vorn', active: true, ab: 40, hp: 1000, maxHp: 1000 },
      { __puppe: 'hinten', active: true, ab: -40, hp: 1000, maxHp: 1000 }
    ];
    w.puppen = puppen;
    forEachEnemyInRange = function (r, cb) {
      var o = angriffsUrsprung();
      puppen.forEach(function (p) {
        p.x = o.x + ${dx} * p.ab; p.y = o.y + ${dy} * p.ab;
        var dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
        if (d <= r) cb(p, { distance: d, dx: dx, dy: dy });
      });
    };
    dealDamageToEnemy = function (s, e, mult, key) { w.treffer.push(e.__puppe + ' ' + key); return { isCrit: false }; };
    handleEnemyHit = function () {};
    breakDestructiblesInRange = function () {};
    _pullEnemyToPlayer = function () {};
    kettenblitzAusloesen = function () {};
    if (w.alt.se) { w.alt.apply = w.alt.se.applyEffect; w.alt.se.applyEffect = function () {}; }
    // Die alten Zeichenwege belauschen.
    var ALT = /(castWhirlwind|castFrostNova|castCycloneStrike|_hammerSlamFx|_blinkPoof)/;
    w.alt.gfx = sc.add.graphics; w.alt.circle = sc.add.circle;
    function lauschen(name) {
      var orig = sc.add[name];
      sc.add[name] = function () {
        var m = (new Error().stack || '').match(ALT);
        if (m) w.linien.push(m[1] + ':' + name);
        return orig.apply(this, arguments);
      };
    }
    lauschen('graphics'); lauschen('circle');
    // Ansturm hatte keine Linien, sondern eine getoente Partikelspur.
    if (window.particleFactory) {
      w.alt.trail = window.particleFactory.abilityTrail;
      window.particleFactory.abilityTrail = function () {
        if (/shadowCharge/.test(new Error().stack || '')) w.spur++;
        return w.alt.trail.apply(this, arguments);
      };
    }
    w.hoerer = { post: sc.events.listeners('postupdate'), shut: sc.events.listeners('shutdown') };
  })()`);
}

function loesen(H) {
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var w = window.__vfx;
    attackRange = w.alt.ar;
    if (window.InputScheme && w.alt.ziel) window.InputScheme.getAimDirection = w.alt.ziel;
    forEachEnemyInRange = w.alt.fe; dealDamageToEnemy = w.alt.dd; handleEnemyHit = w.alt.he;
    breakDestructiblesInRange = w.alt.br; _pullEnemyToPlayer = w.alt.pull; kettenblitzAusloesen = w.alt.kb;
    if (w.alt.se) w.alt.se.applyEffect = w.alt.apply;
    sc.add.graphics = w.alt.gfx; sc.add.circle = w.alt.circle;
    if (w.alt.trail) window.particleFactory.abilityTrail = w.alt.trail;
  })()`);
}

/** Die Wirkbilder in der Szene: Effekt, Lage, Wirkradius, Tiefe. */
function wirkbilder(H) {
  return JSON.parse(H.run(`JSON.stringify(window.game.scene.getScene('GameScene').children.list
    .filter(function (o) { return o.active && o.name === 'spezialVfx'; })
    .map(function (o) {
      var vfx = o.getData('vfx'), d = SPEZIAL_VFX[vfx];
      return { vfx: vfx, key: o.texture.key, x: o.x, y: o.y, tiefe: o.depth, frame: o.frame.name,
               radius: d && d.radius ? d.radius * o.scaleX : null };
    }))`));
}

/** Taktet, bis alle Wirkbilder weg sind; prueft, dass nichts haengen bleibt. */
function abwarten(H, was) {
  let i = 0;
  for (; i < 300 && wirkbilder(H).length; i++) H.step(1);
  const n = JSON.parse(H.run(`JSON.stringify((function () {
    var sc = window.game.scene.getScene('GameScene');
    var w = window.__vfx;
    function neu(name, alt) {
      return sc.events.listeners(name).filter(function (f) { return alt.indexOf(f) < 0; }).length;
    }
    return { rest: sc.children.list.filter(function (o) { return o.name === 'spezialVfx' || o.name === 'spezialFolge'; }).length,
             post: neu('postupdate', w.hoerer.post), shut: neu('shutdown', w.hoerer.shut), sichtbar: player.visible };
  })())`));
  assert.strictEqual(n.rest, 0, was + ': Wirkbild bleibt stehen');
  assert.strictEqual(n.post, 0, was + ': postupdate-Hoerer bleibt haengen');
  assert.strictEqual(n.shut, 0, was + ': shutdown-Hoerer bleibt haengen');
  assert.strictEqual(n.sichtbar, true, was + ': Spieler bleibt unsichtbar');
  return i;
}

function nah(ist, soll, anteil, was) {
  assert.ok(Math.abs(ist - soll) <= Math.abs(soll) * anteil,
    was + ': ' + Math.round(ist) + ' statt ' + Math.round(soll));
}

const BODEN = 50, SPIELER = 100;   // WELT_TIEFEN.GEGNER / .SPIELER

function linien(H) { return JSON.parse(H.run('JSON.stringify(window.__vfx.linien)')); }
function lauf(H, js) { H.run(`(function () { var sc = window.game.scene.getScene('GameScene'); (${js}).call(sc); })()`); }
function wert(H, js) { return JSON.parse(H.run(`JSON.stringify((function () { ${js} })())`)); }

test('Wirbel: Staubring am Boden, Schwunglinien darueber, als Schleife in der Reichweite', () => {
  vorbereiten(OHNE);
  lauf(OHNE, 'function () { castWhirlwind.call(this); }');
  assert.ok(linien(OHNE).length > 0, 'ohne Flagge zeichnet der Wirbel keine Scheiben (Lauscher kaputt?)');
  assert.deepStrictEqual(wirkbilder(OHNE), [], 'ohne Flagge ein Wirkbild');
  OHNE.step(90); loesen(OHNE);

  vorbereiten(MIT);
  const range = wert(MIT, 'return getSpinRange() * 0.6;');
  lauf(MIT, 'function () { castWhirlwind.call(this); }');
  assert.deepStrictEqual(linien(MIT), [], 'mit Flagge noch die alten Saegeblaetter');
  MIT.step(15);   // nach dem Aufgehen (200 ms)
  let v = wirkbilder(MIT);
  assert.deepStrictEqual(v.map((o) => o.key).sort(), ['spezialvfx_wirbel_boden', 'spezialvfx_wirbel_luft']);
  const p = wert(MIT, 'var u = angriffsUrsprung(); return { x: player.x, y: player.y, ux: u.x, uy: u.y };');
  const boden = v.find((o) => o.vfx === 'wirbel_boden'), luft = v.find((o) => o.vfx === 'wirbel_luft');
  assert.ok(boden.tiefe < BODEN, 'der Staubring liegt nicht unter den Figuren: ' + boden.tiefe);
  assert.ok(luft.tiefe > SPIELER, 'die Schwunglinien liegen nicht ueber der Figur: ' + luft.tiefe);
  assert.deepStrictEqual([Math.round(boden.x), Math.round(boden.y)], [Math.round(p.x), Math.round(p.y)], 'Staubring nicht an den Fuessen');
  assert.deepStrictEqual([Math.round(luft.x), Math.round(luft.y)], [Math.round(p.ux), Math.round(p.uy)], 'Schwunglinien nicht am Koerper');
  nah(boden.radius, range, 0.2, 'Staubring trifft die Reichweite nicht');
  nah(luft.radius, range, 0.2, 'Schwunglinien treffen die Reichweite nicht');
  // Er geht mit, wenn der Spieler laeuft.
  MIT.run('player.x += 30 * window.__vfx.dir[0]; player.y += 30 * window.__vfx.dir[1];');
  MIT.step(1);
  v = wirkbilder(MIT);
  const jetzt = wert(MIT, 'return { x: player.x, y: player.y };');
  assert.ok(Math.hypot(jetzt.x - p.x, jetzt.y - p.y) > 20, 'der Spieler liess sich nicht schieben');
  const nachher = v.find((o) => o.vfx === 'wirbel_boden');
  assert.deepStrictEqual([Math.round(nachher.x), Math.round(nachher.y)], [Math.round(jetzt.x), Math.round(jetzt.y)], 'der Staubring bleibt stehen');
  // Schleife: die acht Bilder kommen mehrmals, solange der Kanal laeuft.
  const bilder = [];
  for (let i = 0; i < 30; i++) { MIT.step(1); const b = wirkbilder(MIT).find((o) => o.vfx === 'wirbel_luft'); if (b) bilder.push(b.frame); }
  const runden = bilder.filter((f, i) => i > 0 && f < bilder[i - 1]).length;
  assert.ok(runden >= 1, 'keine Schleife: ' + bilder.join(','));
  abwarten(MIT, 'Wirbel');
  loesen(MIT);
});

test('Hammer: Glimmen am Flegel beim Aufladen, Aufschlag mit Rissen und Splittern in der Einschlagzone', () => {
  vorbereiten(OHNE);
  lauf(OHNE, 'function () { beginChargedSlash.call(this); releaseChargedSlash.call(this); }');
  assert.ok(linien(OHNE).length > 0, 'ohne Flagge kein alter Einschlag');
  assert.deepStrictEqual(wirkbilder(OHNE), []);
  OHNE.step(60); loesen(OHNE); OHNE.run('chargeSlashCooldown = false');

  vorbereiten(MIT);
  lauf(MIT, 'function () { beginChargedSlash.call(this); }');
  MIT.step(2);
  let v = wirkbilder(MIT);
  assert.deepStrictEqual(v.map((o) => o.key), ['spezialvfx_hammer_glimmen'], 'beim Aufladen');
  const kopf = wert(MIT, 'var u = angriffsUrsprung(); return { x: u.x, y: u.y, h: player.displayHeight };');
  assert.ok(v[0].y < kopf.y - kopf.h * 0.3, 'das Glimmen sitzt nicht ueber dem Kopf: ' + v[0].y + ' / ' + kopf.y);
  assert.ok(v[0].tiefe > SPIELER, 'das Glimmen liegt hinter der Figur');
  MIT.step(20);
  assert.strictEqual(wirkbilder(MIT).length, 1, 'das Glimmen haelt nicht, solange geladen wird');

  // Die Einschlagzone, wie releaseChargedSlash sie rechnet (sofort losgelassen
  // waere Ladung 0 — gerechnet wird mit der echten Haltezeit).
  const soll = wert(MIT, `var sc = window.game.scene.getScene('GameScene');
    var el = Phaser.Math.Clamp(sc.time.now - chargeSlashStartTime, CHARGED_SLASH_MIN_CHARGE, CHARGED_SLASH_MAX_CHARGE);
    var r = (el - CHARGED_SLASH_MIN_CHARGE) / Math.max(1, CHARGED_SLASH_MAX_CHARGE - CHARGED_SLASH_MIN_CHARGE);
    var range = attackRange * (1.1 + r * 0.9);
    var d = window.__vfx.dir;
    return { x: player.x + d[0] * range * 0.35, y: player.y + d[1] * range * 0.35, radius: range * 0.78 };`);
  lauf(MIT, 'function () { releaseChargedSlash.call(this); }');
  assert.deepStrictEqual(linien(MIT), [], 'mit Flagge noch Kreis, Ring und Risslinien');
  v = wirkbilder(MIT);
  assert.deepStrictEqual(v.map((o) => o.key).sort(), ['spezialvfx_hammer_boden', 'spezialvfx_hammer_luft'], 'Glimmen bleibt oder Aufschlag fehlt');
  for (const o of v) {
    assert.ok(Math.abs(o.x - soll.x) < 2 && Math.abs(o.y - soll.y) < 2, o.vfx + ' nicht am Einschlag: ' + o.x + ',' + o.y);
    nah(o.radius, soll.radius, 0.2, o.vfx + ' trifft die Einschlagzone nicht');
  }
  assert.ok(v.find((o) => o.vfx === 'hammer_boden').tiefe < BODEN, 'Risse nicht am Boden');
  assert.ok(v.find((o) => o.vfx === 'hammer_luft').tiefe > SPIELER, 'Splitter nicht ueber den Figuren');
  abwarten(MIT, 'Hammer');
  loesen(MIT);
  MIT.run('chargeSlashCooldown = false');
});

test('Ansturm: Nachbilder und Fussstaub statt Partikelspur, Funken am Getroffenen', () => {
  vorbereiten(OHNE);
  lauf(OHNE, 'function () { shadowCharge.call(this); }');
  OHNE.step(20);
  assert.ok(OHNE.run('window.__vfx.spur') > 0, 'ohne Flagge keine Partikelspur (Lauscher kaputt?)');
  assert.deepStrictEqual(wirkbilder(OHNE), []);
  loesen(OHNE);

  vorbereiten(MIT);
  lauf(MIT, 'function () { shadowCharge.call(this); }');
  // Funken: am Puppenplatz vorn, ueber den Figuren.
  const vorn = wert(MIT, 'var p = window.__vfx.puppen[0]; return { x: p.x, y: p.y };');
  let v = wirkbilder(MIT);
  const funken = v.filter((o) => o.vfx === 'funken');
  assert.strictEqual(funken.length, 1, 'keine Aufprall-Funken: ' + v.map((o) => o.vfx));
  assert.deepStrictEqual([funken[0].x, funken[0].y], [vorn.x, vorn.y], 'Funken nicht am Getroffenen');
  assert.ok(funken[0].tiefe > SPIELER);
  let nachbilder = 0, staub = 0, staubTief = true;
  for (let i = 0; i < 14; i++) {
    MIT.step(1);
    const w = wirkbilder(MIT);
    nachbilder = Math.max(nachbilder, w.filter((o) => o.vfx === 'nachbild').length);
    const s = w.filter((o) => o.vfx === 'staub');
    staub = Math.max(staub, s.length);
    if (s.some((o) => o.tiefe >= BODEN)) staubTief = false;
  }
  assert.ok(nachbilder >= 3, 'keine Schattenspur: ' + nachbilder + ' Nachbilder');
  assert.ok(staub >= 2, 'kein Fussstaub: ' + staub);
  assert.ok(staubTief, 'der Staub liegt nicht am Boden');
  assert.strictEqual(MIT.run('window.__vfx.spur'), 0, 'mit Flagge noch die alte Partikelspur');
  abwarten(MIT, 'Ansturm');
  loesen(MIT);
});

test('Schattenschritt: Schattenwolke bei Absprung und Landung, Nachbilder dazwischen', () => {
  vorbereiten(OHNE);
  lauf(OHNE, 'function () { shadowTeleportDash.call(this); }');
  OHNE.step(12);
  assert.ok(linien(OHNE).length >= 2, 'ohne Flagge kein alter Blink-Ring');
  loesen(OHNE); OHNE.step(30);

  vorbereiten(MIT);
  const start = wert(MIT, 'var u = angriffsUrsprung(); return { x: u.x, y: u.y };');
  lauf(MIT, 'function () { shadowTeleportDash.call(this); }');
  let v = wirkbilder(MIT).filter((o) => o.vfx === 'schatten');
  assert.strictEqual(v.length, 1, 'keine Wolke am Absprung');
  assert.ok(Math.abs(v[0].x - start.x) < 2 && Math.abs(v[0].y - start.y) < 3, 'Wolke nicht am Absprung');
  assert.ok(v[0].tiefe > SPIELER);
  let nachbilder = 0, landung = null, ziel = null, blink = null;
  for (let i = 0; i < 16; i++) {
    MIT.step(1);
    const w = wirkbilder(MIT);
    nachbilder = Math.max(nachbilder, w.filter((o) => o.vfx === 'nachbild').length);
    const s = w.filter((o) => o.vfx === 'schatten');
    if (s.length === 2 && !landung) {
      // Die neue Wolke steht noch auf Bild 0; der Spieler ist eben gelandet.
      landung = s.reduce((a, b) => (a.frame <= b.frame ? a : b));
      ziel = wert(MIT, 'var u = angriffsUrsprung(); return { x: u.x, y: u.y, blink: isDashing };');
    }
  }
  assert.ok(landung, 'keine Wolke an der Landung');
  assert.strictEqual(ziel.blink, false, 'die Landewolke kommt mitten im Blink');
  assert.ok(Math.abs(landung.x - ziel.x) < 4 && Math.abs(landung.y - ziel.y) < 4,
    'Landewolke nicht am Ziel: ' + JSON.stringify({ start, ziel, landung }));
  assert.ok(nachbilder >= 2, 'keine Schattenspur: ' + nachbilder);
  assert.deepStrictEqual(linien(MIT), [], 'mit Flagge noch Ring und Strahlen');
  abwarten(MIT, 'Schattenschritt');
  loesen(MIT);
});

test('Frostnova und Wirbelsog: Frostring und Nebelsog am Boden, so weit wie die Wirkung', () => {
  for (const [js, name, radiusJs] of [
    ['function () { castFrostNova.call(this); }', 'frost', 'return 180;'],
    ['function () { castCycloneStrike.call(this); }', 'zyklon', "return 290 + (Math.max(1, _kettenRank('cycloneStrike')) - 1) * 25;"]
  ]) {
    vorbereiten(OHNE);
    lauf(OHNE, js);
    assert.ok(linien(OHNE).length > 0, name + ': ohne Flagge keine alten Linien');
    assert.deepStrictEqual(wirkbilder(OHNE), []);
    OHNE.step(40); loesen(OHNE);

    vorbereiten(MIT);
    const p = wert(MIT, 'return { x: player.x, y: player.y };');
    const soll = wert(MIT, radiusJs);
    lauf(MIT, js);
    assert.deepStrictEqual(linien(MIT), [], name + ': mit Flagge noch Ringe/Arme');
    const v = wirkbilder(MIT);
    assert.deepStrictEqual(v.map((o) => o.key), ['spezialvfx_' + name], name);
    assert.deepStrictEqual([Math.round(v[0].x), Math.round(v[0].y)], [Math.round(p.x), Math.round(p.y)], name + ' nicht an den Fuessen');
    nah(v[0].radius, soll, 0.2, name + ' trifft die Reichweite nicht');
    assert.ok(v[0].tiefe < BODEN, name + ' liegt nicht am Boden');
    // Durchgespielt (alle Bilder), dann weg.
    const bilder = new Set();
    for (let i = 0; i < 40; i++) { const b = wirkbilder(MIT)[0]; if (b) bilder.add(b.frame); MIT.step(1); }
    assert.ok(bilder.size >= 8, name + ': nur ' + bilder.size + ' Bilder gezeigt');
    abwarten(MIT, name);
    loesen(MIT);
  }
});

test('Szenenneustart mitten im Effekt: kein Wirkbild, kein Hoerer bleibt', async () => {
  vorbereiten(MIT);
  lauf(MIT, 'function () { castWhirlwind.call(this); castFrostNova.call(this); beginChargedSlash.call(this); }');
  MIT.step(3);
  assert.strictEqual(wirkbilder(MIT).length, 4);
  // Beim shutdown selbst (nicht erst im naechsten Bild) muessen die Hoerer weg
  // sein: dieser Lauscher meldet sich nach den Effekten an, laeuft also danach.
  MIT.run(`(function () { var sc = window.game.scene.getScene('GameScene');
    sc.events.once('shutdown', function () {
      window.__vfxBeimShutdown = sc.events.listeners('postupdate').filter(function (f) { return /^vfx_/.test(f.spezialFolge || ''); }).length;
    }); })()`);
  loesen(MIT);
  MIT.run(`window.game.scene.getScene('GameScene').scene.restart()`);
  MIT.step(1);
  assert.ok(await MIT.waitForScene('GameScene', { maxRounds: 250 }), 'GameScene kam nicht wieder');
  MIT.step(5);
  const n = wert(MIT, `var sc = window.game.scene.getScene('GameScene');
    function z(name) { return sc.events.listeners(name).filter(function (f) { return /^vfx_/.test(f.spezialFolge || ''); }).length; }
    return { rest: sc.children.list.filter(function (o) { return o.name === 'spezialVfx'; }).length, post: z('postupdate'), shut: z('shutdown') };`);
  assert.deepStrictEqual(n, { rest: 0, post: 0, shut: 0 });
  assert.strictEqual(MIT.run('window.__vfxBeimShutdown'), 0, 'beim shutdown haengen noch Hoerer der Wirkbilder');
  MIT.run('isChargingSlash = false; chargeSlashCooldown = false');
});

test('Tod mitten im Wirbel: die Wirkbilder am Spieler verschwinden mit ihm', () => {
  vorbereiten(MIT);
  lauf(MIT, 'function () { castWhirlwind.call(this); }');
  MIT.step(2);
  assert.strictEqual(wirkbilder(MIT).length, 2);
  const lp = MIT.run('playerHealth');
  MIT.run('playerDeathHandled = true; playerHealth = 0');
  MIT.step(1);
  const v = wirkbilder(MIT);
  MIT.run('playerHealth = ' + lp + '; playerDeathHandled = false');
  assert.deepStrictEqual(v, [], 'der Wirbel dreht ueber dem Toten weiter');
  MIT.step(80);
  abwarten(MIT, 'Tod');
  loesen(MIT);
});

test('Rueckfall: fehlt ein Wirkbild, zeichnet der Angriff seine alten Linien', () => {
  MIT.run(`window.game.textures.remove('spezialvfx_frost')`);
  vorbereiten(MIT);
  lauf(MIT, 'function () { castFrostNova.call(this); }');
  assert.ok(linien(MIT).length > 0, 'ohne Frostbild keine alten Ringe');
  assert.deepStrictEqual(wirkbilder(MIT), []);
  MIT.step(60);
  loesen(MIT);
});

test('Ohne Flagge: selbst vorhandene Wirkbilder bleiben ungenutzt', () => {
  // Die Flagge entscheidet, nicht ob ein Bild zufaellig im Speicher liegt.
  OHNE.run(`Object.keys(SPEZIAL_VFX).forEach(function (n) { window.game.textures.createCanvas('spezialvfx_' + n, 8, 8); })`);
  try {
    vorbereiten(OHNE);
    lauf(OHNE, 'function () { castFrostNova.call(this); castCycloneStrike.call(this); }');
    assert.deepStrictEqual(wirkbilder(OHNE), [], 'ohne Flagge ein Wirkbild');
    assert.ok(linien(OHNE).length > 0, 'ohne Flagge keine alten Linien');
    OHNE.step(60);
    loesen(OHNE);
  } finally {
    OHNE.run(`Object.keys(SPEZIAL_VFX).forEach(function (n) { window.game.textures.remove('spezialvfx_' + n); })`);
  }
});

test('Laden: Wirkbilder nur mit Flagge, nie doppelt', () => {
  const zaehl = (H) => wert(H, `
    function fang(gibts) {
      var keys = [];
      spezialVfxVorladen({ image: function () {}, spritesheet: function (k, url, cfg) { keys.push([k, url, cfg.frameWidth, cfg.frameHeight]); },
        textureManager: { exists: function (k) { return gibts(k); } } });
      return keys;
    }
    return {
      da: Object.keys(window.game.textures.list).filter(function (k) { return /^spezialvfx_/.test(k); }).length,
      leer: fang(function () { return false; }),
      voll: fang(function () { return true; }).length
    };`);
  const m = zaehl(MIT), o = zaehl(OHNE);
  const n = wert(MIT, 'return Object.keys(SPEZIAL_VFX).length;');
  assert.strictEqual(n, 10);
  assert.strictEqual(m.leer.length, n);
  for (const [k, url, w, h] of m.leer) {
    assert.ok(/^assets\/vfx\/spezial_\w+\.png$/.test(url), url);
    assert.ok(w > 0 && h > 0, k);
  }
  assert.strictEqual(m.voll, 0, 'vorhandene Wirkbilder werden noch einmal geladen');
  // Eines hat der Rueckfall oben entfernt.
  assert.strictEqual(m.da, n - 1, 'im Dungeon fehlen Wirkbilder: ' + m.da);
  assert.strictEqual(o.da, 0, 'ohne Flagge sind Wirkbilder geladen');
  assert.strictEqual(o.leer.length, 0, 'ohne Flagge wuerden Wirkbilder geladen');
});
