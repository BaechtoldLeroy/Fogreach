// tests/spezialVfx.test.js — Wirkbilder der Spezialangriffe (#174).
//
// Die Figur bewegt sich mit eigener Bildfolge (tests/spezialFolgen.test.js);
// die Effekte drumherum waren gezeichnete Linien und Kreise. Jetzt spielen
// dafuer Pixel-Effekte aus dem PixelLab vfx_workbench
// (assets/vfx/spezial_*.png, tools/spezialVfxBauen.js); die Linien bleiben
// nur als Rueckfall, solange ein Bild fehlt.
//
// Geprueft am echten Weg, mit zwei Spielen nebeneinander (tests/spezialStart.js:
// mit allen Bildern / im Rueckfall ohne Bilder):
//   - je Angriff erscheinen die richtigen Wirkbilder (Textur, Anzahl), an der
//     Stelle der Wirkung, und so gross, dass der Wirkradius im Bild die
//     Reichweite des Angriffs trifft (+-20 %); Boden unter, Luft ueber den
//     Figuren;
//   - die alten Linien (scene.add.graphics/circle aus der Effektfunktion)
//     werden mit Bildern NICHT mehr gezeichnet, im Rueckfall schon;
//   - danach steht nichts mehr herum (Bild, postupdate-/shutdown-Hoerer);
//   - fehlt ein Bild, gibt es die alten Linien, und es wird nachgeladen;
//   - geladen wird nur, was gelernt ist (tests/spezialFolgen.test.js), und
//     jede Faehigkeit fragt genau ihre Wirkbilder an.
//
// Zufall und Zufallsraum: Treffer gehen nur an zwei feste Puppen, Requisiten
// und Gegnerlogik sind abgeklemmt. Zeit nur per H.step.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { mitBildern, imRueckfall } = require('./spezialStart.js');

let MIT = null, OHNE = null;   // mit allen Bildern / im Rueckfall
before(async () => {
  MIT = await mitBildern();
  OHNE = await imRueckfall();
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
    // Unter Last (parallele Testdateien) meldet die Begehbarkeit manchmal gar
    // keinen freien Punkt; dann eben nach Osten — die Faelle, die Platz
    // brauchen (Sprung, Schieben), messen am tatsaechlichen Spielerort.
    return d || suchen(60) || RICHT[0];
  })())`));
  assert.ok(r, 'kein freier Platz fuer den Angriff');
  const [dx, dy, dd] = r;
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    isAttacking = false; attackCooldown = false; isRolling = false; isDashing = false;
    // Gift und Brand umgehen die Unverwundbarkeit (DoT): im Zufallsraum kann
    // der Spieler zwischen zwei Faellen sterben, dann enden die Effekte, die
    // an ihm haengen, sofort. Lebenspunkte auffuellen.
    if (typeof playerHealth === 'number' && playerHealth < 60) playerHealth = 100;
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
    var ALT = /(castWhirlwind|castFrostNova|castCycloneStrike|_hammerSlamFx|_blinkPoof|_deathBlowFx|_deathBlowExecuteBurst|castSteelGrasp|_frenzyFx|updateAmuletPerFrame|_healFx)/;
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
  // Bis Wirkbilder UND Koerperfolge weg sind (die Folge kann laenger dauern).
  for (; i < 300 && H.run(`window.game.scene.getScene('GameScene').children.list.some(function (o) {
    return o.active && (o.name === 'spezialVfx' || o.name === 'spezialFolge'); })`); i++) H.step(1);
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
  assert.ok(linien(OHNE).length > 0, 'im Rueckfall zeichnet der Wirbel keine Scheiben (Lauscher kaputt?)');
  assert.deepStrictEqual(wirkbilder(OHNE), [], 'im Rueckfall ein Wirkbild');
  OHNE.step(90); loesen(OHNE);

  vorbereiten(MIT);
  const range = wert(MIT, 'return getSpinRange() * 0.6;');
  lauf(MIT, 'function () { castWhirlwind.call(this); }');
  assert.deepStrictEqual(linien(MIT), [], 'mit Bildern noch die alten Saegeblaetter');
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
  // (Steht eine Wand im Weg, bleibt er stehen — dann muss der Ring es auch.)
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
  assert.ok(linien(OHNE).length > 0, 'im Rueckfall kein alter Einschlag');
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
  assert.deepStrictEqual(linien(MIT), [], 'mit Bildern noch Kreis, Ring und Risslinien');
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
  assert.ok(OHNE.run('window.__vfx.spur') > 0, 'im Rueckfall keine Partikelspur (Lauscher kaputt?)');
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
  assert.strictEqual(MIT.run('window.__vfx.spur'), 0, 'mit Bildern noch die alte Partikelspur');
  abwarten(MIT, 'Ansturm');
  loesen(MIT);
});

test('Schattenschritt: Schattenwolke bei Absprung und Landung, Nachbilder dazwischen', () => {
  vorbereiten(OHNE);
  lauf(OHNE, 'function () { shadowTeleportDash.call(this); }');
  OHNE.step(12);
  assert.ok(linien(OHNE).length >= 2, 'im Rueckfall kein alter Blink-Ring');
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
  assert.deepStrictEqual(linien(MIT), [], 'mit Bildern noch Ring und Strahlen');
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
    assert.ok(linien(OHNE).length > 0, name + ': im Rueckfall keine alten Linien');
    assert.deepStrictEqual(wirkbilder(OHNE), []);
    OHNE.step(40); loesen(OHNE);

    vorbereiten(MIT);
    const p = wert(MIT, 'return { x: player.x, y: player.y };');
    const soll = wert(MIT, radiusJs);
    lauf(MIT, js);
    assert.deepStrictEqual(linien(MIT), [], name + ': mit Bildern noch Ringe/Arme');
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

// ---- Zweite Runde: die uebrigen sechs Faehigkeiten -----------------------

test('Todesstoss: schwerer Hieb in Schlagrichtung so weit wie der Kegel, Blut am Getroffenen', () => {
  vorbereiten(OHNE);
  lauf(OHNE, 'function () { window.__vfx.puppen[0].hp = 10; shadowDeathBlow.call(this); }');
  const alt = linien(OHNE);
  assert.ok(alt.some((l) => /^_deathBlowFx/.test(l)), 'im Rueckfall kein alter Kegel: ' + alt);
  assert.ok(alt.some((l) => /^_deathBlowExecuteBurst/.test(l)), 'im Rueckfall kein alter Hinrichtungs-Burst: ' + alt);
  assert.deepStrictEqual(wirkbilder(OHNE), []);
  OHNE.step(30); loesen(OHNE);

  for (const hinrichten of [false, true]) {
    vorbereiten(MIT);
    const u = wert(MIT, 'var u = angriffsUrsprung(); return { x: u.x, y: u.y, d: window.__vfx.dir };');
    lauf(MIT, `function () { ${hinrichten ? 'window.__vfx.puppen[0].hp = 10;' : ''} shadowDeathBlow.call(this); }`);
    assert.deepStrictEqual(linien(MIT), [], 'mit Bildern noch Kegel oder Burst');
    const v = wirkbilder(MIT);
    const hieb = v.filter((o) => o.vfx === 'todesstoss');
    assert.strictEqual(hieb.length, 1, 'kein Hieb: ' + v.map((o) => o.vfx));
    assert.ok(Math.abs(hieb[0].x - u.x) < 1 && Math.abs(hieb[0].y - u.y) < 1, 'Hieb nicht am Koerper');
    nah(hieb[0].radius, 165, 0.2, 'Hieb trifft die Reichweite nicht');
    const soll = Math.atan2(u.d[1], u.d[0]);
    const ist = wert(MIT, "return window.game.scene.getScene('GameScene').children.list.filter(function (o) { return o.name === 'spezialVfx' && o.getData('vfx') === 'todesstoss'; })[0].rotation;");
    assert.ok(Math.abs(Math.atan2(Math.sin(ist - soll), Math.cos(ist - soll))) < 0.01, 'Hieb zeigt nicht in Schlagrichtung: ' + ist + ' statt ' + soll);
    assert.ok(hieb[0].tiefe > SPIELER);
    const vorn = wert(MIT, 'var p = window.__vfx.puppen[0]; return { x: p.x, y: p.y };');
    const blut = v.filter((o) => o.vfx === 'blut');
    assert.strictEqual(blut.length, 1, 'kein Blut am Getroffenen');
    assert.deepStrictEqual([blut[0].x, blut[0].y], [vorn.x, vorn.y], 'Blut nicht am Getroffenen');
    // Die Hinrichtung spritzt groesser als der gewoehnliche Treffer.
    const skala = wert(MIT, "return window.game.scene.getScene('GameScene').children.list.filter(function (o) { return o.name === 'spezialVfx' && o.getData('vfx') === 'blut'; })[0].scaleX;");
    assert.ok(hinrichten ? skala > 2 : skala < 2, (hinrichten ? 'Hinrichtung' : 'Treffer') + ': Blut-Skala ' + skala);
    abwarten(MIT, 'Todesstoss');
    loesen(MIT);
  }
});

test('Stahlgriff: Kette bis zum Gefassten (sonst volle Reichweite), dann eingeholt', () => {
  vorbereiten(OHNE);
  lauf(OHNE, 'function () { castSteelGrasp.call(this); }');
  assert.ok(linien(OHNE).some((l) => /^castSteelGrasp/.test(l)), 'im Rueckfall keine alte Kettenlinie');
  assert.deepStrictEqual(wirkbilder(OHNE), []);
  OHNE.step(20); loesen(OHNE);

  for (const fasst of [true, false]) {
    vorbereiten(MIT);
    if (!fasst) MIT.run('window.__vfx.puppen.length = 0');
    const u = wert(MIT, 'var u = angriffsUrsprung(); return { x: u.x, y: u.y, d: window.__vfx.dir };');
    lauf(MIT, 'function () { castSteelGrasp.call(this); }');
    assert.deepStrictEqual(linien(MIT), [], 'mit Bildern noch die gezeichnete Linie');
    const kette = () => JSON.parse(MIT.run(`JSON.stringify((function () {
      var k = window.game.scene.getScene('GameScene').children.list.filter(function (o) { return o.name === 'spezialVfx' && o.getData('vfx') === 'kette'; })[0];
      return k ? { x: k.x, y: k.y, rot: k.rotation, lang: k.width * k.scaleX, soll: k.getData('laenge'), tiefe: k.depth } : null; })())`));
    const k0 = kette();
    assert.ok(k0, 'keine Kette');
    assert.ok(Math.abs(k0.x - u.x) < 1 && Math.abs(k0.y - u.y) < 1, 'Kette nicht am Koerper');
    const dw = k0.rot - Math.atan2(u.d[1], u.d[0]);
    assert.ok(Math.abs(Math.atan2(Math.sin(dw), Math.cos(dw))) < 0.01, 'Kette zeigt nicht in Wurfrichtung: ' + k0.rot + ' / ' + u.d);
    assert.strictEqual(k0.soll, fasst ? 40 : 360, 'Kettenlaenge');
    assert.ok(k0.tiefe > SPIELER);
    // Sie haengt am Koerper: geht er (hier: geschoben), geht ihr Anfang mit.
    MIT.run('player.x += 12');
    MIT.step(1);
    const k1 = kette(), u1 = wert(MIT, 'var u = angriffsUrsprung(); return { x: u.x, y: u.y };');
    assert.ok(k1 && Math.abs(k1.x - u1.x) < 1 && Math.abs(k1.y - u1.y) < 1, 'die Kette bleibt am alten Ort');
    // Sie schiesst hinaus bis zur Laenge und wird wieder kuerzer.
    let lang = 0, spaeter = null;
    for (let i = 0; i < 20; i++) {
      MIT.step(1);
      const k = kette();
      if (!k) break;
      lang = Math.max(lang, k.lang);
      if (lang >= k.soll * 0.95 && k.lang < lang) spaeter = k.lang;
    }
    nah(lang, fasst ? 40 : 360, 0.05, 'die Kette reicht nicht bis zum Ziel');
    assert.ok(spaeter !== null, 'die Kette wird nicht eingeholt');
    const funken = wirkbilder(MIT).filter((o) => o.vfx === 'funken').length;
    abwarten(MIT, 'Stahlgriff');
    loesen(MIT);
    if (!fasst) assert.strictEqual(funken, 0, 'Funken ohne Gefassten');
  }
});

test('Wirbelklingen: kreisende Klinge folgt dem Geschoss und vergeht mit ihm', () => {
  vorbereiten(OHNE);
  lauf(OHNE, 'function () { castTwistingBlades.call(this); window.__vfx.geschoss = playerProjectiles.getChildren().slice(-1)[0]; }');
  assert.strictEqual(OHNE.run('window.__vfx.geschoss.visible'), true, 'im Rueckfall ist der Dolch unsichtbar');
  assert.deepStrictEqual(wirkbilder(OHNE), []);
  OHNE.run('window.__vfx.geschoss.destroy()'); OHNE.step(5); loesen(OHNE);

  vorbereiten(MIT);
  lauf(MIT, 'function () { castTwistingBlades.call(this); window.__vfx.geschoss = playerProjectiles.getChildren().slice(-1)[0]; }');
  assert.strictEqual(MIT.run('window.__vfx.geschoss.visible'), false, 'der flache Dolch fliegt sichtbar mit');
  // Im Zufallsraum prallt das Geschoss sonst an Wand oder Gegner ab und ist
  // nach wenigen Bildern zurueck: hier haelt es still und wird von Hand
  // versetzt — die Klinge muss trotzdem mitgehen.
  MIT.run(`(function () { var p = window.__vfx.geschoss; p.body.moves = false; p.body.setVelocity(0, 0);
    p.setPosition(p.x + 37, p.y + 11); })()`);
  MIT.step(1);
  const g = wert(MIT, 'var p = window.__vfx.geschoss; return { x: p.x, y: p.y, aktiv: p.active };');
  const k = wirkbilder(MIT).filter((o) => o.vfx === 'klinge');
  assert.strictEqual(k.length, 1, 'keine kreisende Klinge');
  assert.ok(g.aktiv);
  assert.deepStrictEqual([Math.round(k[0].x), Math.round(k[0].y)], [Math.round(g.x), Math.round(g.y)], 'die Klinge folgt dem Geschoss nicht');
  assert.ok(k[0].tiefe > SPIELER);
  // Das Bild dreht sich (Schleife).
  const bilder = new Set();
  for (let i = 0; i < 12; i++) { MIT.step(1); const b = wirkbilder(MIT).find((o) => o.vfx === 'klinge'); if (b) bilder.add(b.frame); }
  assert.ok(bilder.size >= 4, 'die Klinge dreht sich nicht: ' + [...bilder]);
  MIT.run('window.__vfx.geschoss.destroy()');
  MIT.step(1);
  assert.strictEqual(wirkbilder(MIT).filter((o) => o.vfx === 'klinge').length, 0, 'die Klinge ueberlebt ihr Geschoss');
  abwarten(MIT, 'Wirbelklingen');
  loesen(MIT);
});

/** Effekte und Lage der Selbst-Faehigkeiten; Buff ueber ABILITY_DEFS. */
function selbst(H, js) {
  lauf(H, `function () { var sc = this; ${js}; }`);
}

test('Raserei: Druckring beim Aktivieren, Glut-Aura fuer die Buffdauer', () => {
  const RASEREI = "window.AbilitySystem.getAbilityDef('frenzy').activate(sc)";
  vorbereiten(OHNE);
  selbst(OHNE, RASEREI);
  OHNE.step(2);
  assert.ok(linien(OHNE).some((l) => /^_frenzyFx/.test(l)), 'im Rueckfall kein alter Ring');
  assert.ok(linien(OHNE).some((l) => /^updateAmuletPerFrame/.test(l)), 'im Rueckfall keine alte Aura');
  assert.deepStrictEqual(wirkbilder(OHNE), []);
  OHNE.run('window.frenzyState.active = false'); OHNE.step(5); loesen(OHNE);

  vorbereiten(MIT);
  const p = wert(MIT, 'return { x: player.x, y: player.y };');
  selbst(MIT, RASEREI);
  MIT.step(2);
  assert.deepStrictEqual(linien(MIT), [], 'mit Bildern noch Ring, Strahlen oder Aura-Kreise');
  assert.strictEqual(MIT.run('!!window._frenzyAura'), false, 'die gezeichnete Aura laeuft mit');
  const v = wirkbilder(MIT);
  const stoss = v.find((o) => o.vfx === 'raserei_stoss'), aura = v.find((o) => o.vfx === 'raserei_aura');
  assert.ok(stoss && aura, 'Druckring/Aura fehlen: ' + v.map((o) => o.vfx));
  assert.deepStrictEqual([Math.round(stoss.x), Math.round(stoss.y)], [Math.round(p.x), Math.round(p.y)], 'Druckring nicht an den Fuessen');
  assert.ok(stoss.tiefe < BODEN, 'Druckring nicht am Boden');
  assert.ok(aura.tiefe < SPIELER && aura.tiefe > BODEN, 'Aura nicht knapp hinter der Figur: ' + aura.tiefe);
  // Die Aura laeuft weiter, solange der Buff wirkt — laenger als jede Folge.
  for (let i = 0; i < 60; i++) MIT.step(1);
  assert.strictEqual(wirkbilder(MIT).filter((o) => o.vfx === 'raserei_aura').length, 1, 'die Aura endet vor dem Buff');
  // Buff vorbei (Ablauf): die Aura vergeht von selbst.
  MIT.run("window.frenzyState.expiry = window.game.scene.getScene('GameScene').time.now - 1");
  MIT.step(2);
  assert.strictEqual(wirkbilder(MIT).filter((o) => o.vfx === 'raserei_aura').length, 0, 'die Aura ueberlebt den Buff');
  abwarten(MIT, 'Raserei');
  loesen(MIT);
});

test('Berserker: Blut beim Aktivieren, rote Glut zu Fuessen fuer die Buffdauer', () => {
  const BERSERK = "window.AbilitySystem.getAbilityDef('berserk').activate(sc)";
  vorbereiten(OHNE);
  const lpO = OHNE.run('playerHealth');
  selbst(OHNE, BERSERK);
  OHNE.step(2);
  assert.deepStrictEqual(wirkbilder(OHNE), [], 'im Rueckfall ein Wirkbild');
  OHNE.run('window.berserkState.active = false; playerHealth = ' + lpO); loesen(OHNE);

  vorbereiten(MIT);
  const lp = MIT.run('playerHealth');
  selbst(MIT, BERSERK);
  const u = wert(MIT, 'var u = angriffsUrsprung(); return { x: u.x, y: u.y };');
  MIT.step(2);
  const v = wirkbilder(MIT);
  const blut = v.find((o) => o.vfx === 'blut'), aura = v.find((o) => o.vfx === 'berserk_aura');
  assert.ok(blut && aura, 'Blut/Aura fehlen: ' + v.map((o) => o.vfx));
  assert.ok(Math.abs(blut.x - u.x) < 2 && Math.abs(blut.y - u.y) < 2, 'Blut nicht am Koerper');
  assert.ok(aura.tiefe < SPIELER && aura.tiefe > BODEN);
  // Die Aura steht ueber den Fuessen (Ring auf dem Boden unter der Figur).
  const fuss = wert(MIT, 'return player.y;');
  assert.ok(aura.y < fuss && aura.y > fuss - 40, 'Aura nicht an der Figur: ' + aura.y + ' / ' + fuss);
  for (let i = 0; i < 60; i++) MIT.step(1);
  assert.strictEqual(wirkbilder(MIT).filter((o) => o.vfx === 'berserk_aura').length, 1, 'die Aura endet vor dem Buff');
  MIT.run("window.berserkState.expiry = window.game.scene.getScene('GameScene').time.now - 1");
  MIT.step(2);
  assert.strictEqual(wirkbilder(MIT).filter((o) => o.vfx === 'berserk_aura').length, 0, 'die Aura ueberlebt den Buff');
  MIT.run('window.berserkState.active = false; playerHealth = ' + lp);
  abwarten(MIT, 'Berserker');
  loesen(MIT);
});

test('Heilwunde: gruener Schimmer hinter der Figur statt Ring und Kreuzen, die Heilzahl bleibt', () => {
  vorbereiten(OHNE);
  selbst(OHNE, 'shadowHeilwunde.call(sc)');
  assert.ok(linien(OHNE).some((l) => /^_healFx/.test(l)), 'im Rueckfall keine alten Kreuze');
  assert.deepStrictEqual(wirkbilder(OHNE), []);
  OHNE.step(60); loesen(OHNE);

  vorbereiten(MIT);
  const texte = () => MIT.run(`window.game.scene.getScene('GameScene').children.list.filter(function (o) { return o.type === 'Text' && /^\\+\\d/.test(o.text || ''); }).length`);
  const vorher = texte();
  selbst(MIT, 'shadowHeilwunde.call(sc)');
  assert.deepStrictEqual(linien(MIT), [], 'mit Bildern noch Ring/Kreuze');
  assert.strictEqual(texte(), vorher + 1, 'die Heilzahl fehlt');
  const v = wirkbilder(MIT).filter((o) => o.vfx === 'heil');
  assert.strictEqual(v.length, 1, 'kein Schimmer');
  const fuss = wert(MIT, 'return { x: player.x, y: player.y };');
  assert.strictEqual(Math.round(v[0].x), Math.round(fuss.x));
  assert.ok(v[0].y < fuss.y && v[0].y > fuss.y - 40, 'Schimmer nicht an der Figur');
  assert.ok(v[0].tiefe < SPIELER && v[0].tiefe > BODEN, 'Schimmer nicht hinter der Figur');
  abwarten(MIT, 'Heilwunde');
  loesen(MIT);
});

test('Tod mit laufendem Buff: die Aura verschwindet mit dem Spieler', () => {
  vorbereiten(MIT);
  selbst(MIT, "window.AbilitySystem.getAbilityDef('frenzy').activate(sc)");
  MIT.step(3);
  assert.strictEqual(wirkbilder(MIT).filter((o) => o.vfx === 'raserei_aura').length, 1);
  const lp = MIT.run('playerHealth');
  // Wie oft die Aura angelegt wird, waehrend er tot ist: nie (nicht in jedem
  // Bild neu angelegt und gleich wieder verworfen).
  MIT.run(`window.__auraNeu = 0; window.__vfxSpielen = _vfxSpielen;
    _vfxSpielen = function (sc, name) { if (name === 'raserei_aura') window.__auraNeu++; return window.__vfxSpielen.apply(this, arguments); };`);
  MIT.run('playerDeathHandled = true; playerHealth = 0');
  MIT.step(4);
  const n = wirkbilder(MIT).filter((o) => o.vfx === 'raserei_aura').length;
  const neu = MIT.run('window.__auraNeu');
  MIT.run('_vfxSpielen = window.__vfxSpielen; playerHealth = ' + lp + '; playerDeathHandled = false; window.frenzyState.active = false');
  assert.strictEqual(n, 0, 'die Aura bleibt ueber dem Toten');
  // main.js laesst updateAmuletPerFrame im Tod aus — die Aura entsteht nicht neu.
  assert.strictEqual(neu, 0, 'die Aura wird ueber dem Toten immer wieder angelegt');
  abwarten(MIT, 'Tod mit Buff');
  loesen(MIT);
});

test('Szenenneustart mitten im Effekt: kein Wirkbild, kein Hoerer bleibt', async () => {
  vorbereiten(MIT);
  lauf(MIT, "function () { castWhirlwind.call(this); castFrostNova.call(this); beginChargedSlash.call(this); window.AbilitySystem.getAbilityDef('berserk').activate(this); }");
  // Bis alle vier Arten stehen (nicht nach fester Bildzahl): unter Last hat
  // ein fester Takt hier einmal zu frueh gezaehlt.
  const SOLL = ['berserk_aura', 'frost', 'hammer_glimmen', 'wirbel_boden', 'wirbel_luft'];
  let da = [];
  for (let i = 0; i < 20; i++) {
    MIT.step(1);
    da = [...new Set(wirkbilder(MIT).map((o) => o.vfx))].filter((v) => SOLL.includes(v)).sort();
    if (da.length === SOLL.length) break;
  }
  assert.deepStrictEqual(da, SOLL, 'nicht alle Effekte stehen vor dem Neustart: ' + JSON.stringify(wirkbilder(MIT).map((o) => o.vfx)));
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
  MIT.run('isChargingSlash = false; chargeSlashCooldown = false; if (window.berserkState) window.berserkState.active = false;');
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

test('Rueckfall: fehlt ein Wirkbild, alte Linien und Nachladen; danach wieder das Bild', async () => {
  MIT.run(`window.game.textures.remove('spezialvfx_frost')`);
  vorbereiten(MIT);
  lauf(MIT, 'function () { castFrostNova.call(this); }');
  assert.ok(linien(MIT).length > 0, 'ohne Frostbild keine alten Ringe');
  assert.deepStrictEqual(wirkbilder(MIT).filter((o) => o.vfx === 'frost'), []);
  const da = await MIT.settle(() => MIT.run(`window.game.textures.exists('spezialvfx_frost')`), { maxRounds: 200, framesPerRound: 1 });
  assert.ok(da, 'das Frostbild wird nicht nachgeladen');
  abwarten(MIT, 'Rueckfall');
  loesen(MIT);
  vorbereiten(MIT);
  lauf(MIT, 'function () { castFrostNova.call(this); }');
  assert.deepStrictEqual(linien(MIT), [], 'nach dem Nachladen noch die alten Ringe');
  assert.strictEqual(wirkbilder(MIT).filter((o) => o.vfx === 'frost').length, 1, 'nach dem Nachladen kein Frostbild');
  abwarten(MIT, 'nach dem Nachladen');
  loesen(MIT);
});

test('Nachladen beim Einsatz: jede Faehigkeit fragt genau ihre Bilder an', () => {
  // Im Rueckfall-Spiel (keine Bilder) mitschreiben, was nachgeladen wuerde.
  const SOLL = {
    'castWhirlwind.call(sc)': ['wirbel', 'vfx:wirbel_boden', 'vfx:wirbel_luft'],
    'beginChargedSlash.call(sc); releaseChargedSlash.call(sc)': ['hammer', 'vfx:hammer_boden', 'vfx:hammer_glimmen', 'vfx:hammer_luft'],
    'shadowCharge.call(sc)': ['sturm', 'vfx:funken', 'vfx:staub'],
    'shadowTeleportDash.call(sc)': ['sprung', 'vfx:schatten'],
    'castFrostNova.call(sc)': ['frost', 'vfx:frost'],
    'castCycloneStrike.call(sc)': ['vfx:zyklon', 'zyklon'],
    'shadowDeathBlow.call(sc)': ['todesstoss', 'vfx:blut', 'vfx:todesstoss'],
    'castSteelGrasp.call(sc)': ['greif', 'vfx:kette'],
    'castTwistingBlades.call(sc)': ['klingen', 'vfx:klinge'],
    "window.AbilitySystem.getAbilityDef('frenzy').activate(sc)": ['raserei', 'vfx:raserei_aura', 'vfx:raserei_stoss'],
    "window.AbilitySystem.getAbilityDef('berserk').activate(sc)": ['berserk', 'vfx:berserk_aura', 'vfx:blut'],
    'shadowHeilwunde.call(sc)': ['heil', 'vfx:heil']
  };
  for (const [js, soll] of Object.entries(SOLL)) {
    vorbereiten(OHNE);
    const lp = OHNE.run('playerHealth');
    OHNE.run(`window.__angefragt = []; spezialNachladen = function (sc, ids, folgen, vfx) {
      (folgen || []).forEach(function (f) { window.__angefragt.push(f); });
      (vfx || []).forEach(function (v) { window.__angefragt.push('vfx:' + v); }); return 0; };`);
    selbst(OHNE, js);
    OHNE.step(20);   // Aura (Raserei) und Landewolke (Schattenschritt) kommen im Takt
    const ist = JSON.parse(OHNE.run('JSON.stringify(window.__angefragt)'));
    OHNE.run(`spezialNachladen = function () { return 0; }; playerHealth = ${lp};
      if (window.frenzyState) window.frenzyState.active = false; if (window.berserkState) window.berserkState.active = false;
      isChargingSlash = false; chargeSlashCooldown = false;`);
    OHNE.step(40);
    loesen(OHNE);
    assert.deepStrictEqual([...new Set(ist)].sort(), soll.slice().sort(), js);
  }
});

test('Laden: die Wirkbilder der gelernten Faehigkeiten, mit Bildmassen', () => {
  const boegen = wert(OHNE, `var AS = window.AbilitySystem, alt = AS.getLearnedAbilities, keys = [];
    AS.getLearnedAbilities = function () { return Object.keys(SPEZIAL_JE_FAEHIGKEIT); };
    try {
      spezialBilderVorladen({ image: function () {}, spritesheet: function (k, url, cfg) { keys.push([k, url, cfg.frameWidth, cfg.frameHeight, cfg.endFrame]); },
        textureManager: { exists: function () { return false; } } });
    } finally { AS.getLearnedAbilities = alt; }
    return keys;`);
  const n = wert(MIT, 'return Object.keys(SPEZIAL_VFX).length;');
  assert.strictEqual(n, 18);
  assert.strictEqual(boegen.length, n);
  for (const [k, url, w, h, ende] of boegen) {
    const name = k.replace(/^spezialvfx_/, '');
    assert.strictEqual(url, 'assets/vfx/spezial_' + name + '.png');
    const d = wert(MIT, `return SPEZIAL_VFX['${name}'];`);
    assert.deepStrictEqual([w, h, ende], [d.w, d.h, d.n - 1], k);
  }
  // Im Dungeon mit allen Bildern sind alle Bildzeilen da (Nachladen oben inklusive).
  assert.strictEqual(MIT.run("Object.keys(window.game.textures.list).filter(function (k) { return /^spezialvfx_/.test(k); }).length"), n);
});
