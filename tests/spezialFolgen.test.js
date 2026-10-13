// tests/spezialFolgen.test.js — Spezialangriffe als Bewegung der Figur (#174).
//
// Vorher waren die Spezialangriffe gezeichnete Linien um eine stillstehende
// Figur. Jetzt spielt je Angriff eine eigene Bildfolge
// (assets/PlayerSprites/spezial_*, PixelLab, tools/spezialBauen.js) auf
// einem Bild, das dem Spieler folgt — gebaut wie Rolle (#179) und
// Schlag (#171).
//
// Geprueft am echten Weg (cast*/shadow*/beginChargedSlash), mit zwei Spielen
// nebeneinander (tests/spezialStart.js): eines MIT allen Bildern, eines im
// RUECKFALL (Bilder fehlen, Nachladen abgeklemmt).
//   - mit Bildern: die richtige Folge erscheint (bei gerichteten Angriffen in
//     allen acht Richtungen die der Zielrichtung), an der Stelle der Figur;
//     der Spieler ist so lange unsichtbar, danach ist er unveraendert da,
//     und weder Bild noch Hoerer bleiben liegen.
//   - Treffer und Schaden sind mit Bildern und im Rueckfall Stueck fuer Stueck gleich.
//   - im Rueckfall: kein Zusatzbild, der Spieler bleibt sichtbar — wie vor #174.
//   - Laden: GameScene.preload nur fuer gelernte Faehigkeiten, der Rest wird
//     beim ersten Einsatz nachgeladen.
//   - Wirbel als Schleife, solange der Kanal laeuft; Hammer zweigeteilt
//     (Ausholen beim Aufladen, Schlag beim Loslassen).
//   - Vorrang: ein Schlag mitten im Wirbel verdeckt die Drehung nicht, eine
//     Rolle schon; nach ihr dreht er weiter.
//   - Szenenneustart mitten im Wirbel (Tod, Abstieg) laesst nichts zurueck.
//
// Zufallsfallen: Gegner und Faesser des Zufallsraums treten nicht auf —
// forEachEnemyInRange zaehlt nur zwei feste Puppen, und das Zerbrechen von
// Requisiten ist abgeklemmt. Zeit nur per H.step.

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

// dir-Nummer -> Zielrichtung (PLAYER_DIRECTION_SEQUENCE in js/player.js).
const RICHTUNGEN = {
  '00': [-1, 0], '01': [-1, -1], '02': [0, -1], '03': [1, -1],
  '04': [1, 0], '05': [1, 1], '06': [0, 1], '07': [-1, 1]
};

/**
 * Stellt den Spieler in Richtung dd hin, klemmt Ziel, Gegner und Requisiten
 * ab und merkt Treffer. Zwei Puppen stehen 40 px vor und hinter ihm.
 * Die Abklemmungen bleiben, bis `loesen` laeuft — der Wirbel tickt spaeter.
 */
function vorbereiten(H, dd) {
  const [x, y] = RICHTUNGEN[dd];
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    isAttacking = false; attackCooldown = false; isRolling = false; isDashing = false;
    isChargingSlash = false; chargeSlashCooldown = false;
    // Gift und Brand umgehen die Unverwundbarkeit (DoT), und der Berserker
    // kostet Lebenspunkte: auffuellen, sonst stirbt er im Zufallsraum und die
    // Szene ist weg.
    if (typeof playerHealth === 'number' && playerHealth < 60) playerHealth = 100;
    if (player.body) player.setVelocity(0, 0);
    player.setTexture('dir${dd}_f00');
    applyPlayerDisplaySettings(player);
    // Auch die Blickrichtung: sonst stellt das naechste Bild ihn auf die
    // alte zurueck, und die Masse vorher/nachher gehoeren zu zwei Richtungen.
    var st = player.getData('animState') || {};
    st.direction = '${dd}'; st.playing = null;
    player.setData('animState', st);
    player.setAlpha(1);
    lastMoveDirection.set(${x}, ${y});
    var w = window.__spz = { treffer: [], alt: {} };
    w.alt.ziel = window.InputScheme && window.InputScheme.getAimDirection;
    if (window.InputScheme) window.InputScheme.getAimDirection = function () { return { x: ${x}, y: ${y} }; };
    w.alt.fe = forEachEnemyInRange; w.alt.dd = dealDamageToEnemy; w.alt.he = handleEnemyHit;
    w.alt.br = breakDestructiblesInRange; w.alt.pull = _pullEnemyToPlayer; w.alt.kb = kettenblitzAusloesen;
    w.alt.se = window.statusEffectManager;
    var len = Math.hypot(${x}, ${y});
    var puppen = [
      { __puppe: 'vorn', active: true, ab: 40, hp: 1000, maxHp: 1000 },
      { __puppe: 'hinten', active: true, ab: -40, hp: 1000, maxHp: 1000 }
    ];
    // Die Puppen halten ihren Abstand zum Angriffsursprung: wird der Spieler
    // im Zufallsraum geschoben (Gegner, Wand), soll das die Treffer mit und
    // im Rueckfall nicht unterscheiden.
    forEachEnemyInRange = function (r, cb) {
      var o = angriffsUrsprung();
      puppen.forEach(function (p) {
        p.x = o.x + ${x} / len * p.ab; p.y = o.y + ${y} / len * p.ab;
        var dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
        if (d <= r) cb(p, { distance: d, dx: dx, dy: dy });
      });
    };
    dealDamageToEnemy = function (s, e, mult, key) {
      w.treffer.push(e.__puppe + ' ' + key + ' ' + (Math.round(mult * 1000) / 1000));
      return { isCrit: false };
    };
    handleEnemyHit = function () {};
    breakDestructiblesInRange = function () {};
    _pullEnemyToPlayer = function () {};
    kettenblitzAusloesen = function () {};
    // Nur applyEffect abklemmen: das Spiel ruft den Verwalter in jedem Bild
    // auf, ein Ersatzobjekt liesse den Takt mittendrin abbrechen.
    if (w.alt.se) { w.alt.apply = w.alt.se.applyEffect; w.alt.se.applyEffect = function () {}; }
    w.hoerer = { post: sc.events.listeners('postupdate'), shut: sc.events.listeners('shutdown') };
  })()`);
}

function loesen(H) {
  H.run(`(function () {
    var w = window.__spz;
    if (window.InputScheme && w.alt.ziel) window.InputScheme.getAimDirection = w.alt.ziel;
    forEachEnemyInRange = w.alt.fe; dealDamageToEnemy = w.alt.dd; handleEnemyHit = w.alt.he;
    breakDestructiblesInRange = w.alt.br; _pullEnemyToPlayer = w.alt.pull; kettenblitzAusloesen = w.alt.kb;
    if (w.alt.se) w.alt.se.applyEffect = w.alt.apply;
  })()`);
}

/** Was gerade zu sehen ist: das Zusatzbild (Schluessel, Lage) und der Spieler. */
function blick(H) {
  return JSON.parse(H.run(`JSON.stringify((function () {
    var sc = window.game.scene.getScene('GameScene');
    function welt(sprite, key) {
      var m = figurGrenzen(sc, key);
      var fr = sc.textures.getFrame(key);
      var sx = sprite.displayWidth / fr.width, sy = sprite.displayHeight / fr.height;
      var links = sprite.x - sprite.originX * sprite.displayWidth;
      var oben = sprite.y - sprite.originY * sprite.displayHeight;
      return { mitte: links + (m.minX + m.maxX + 1) / 2 * sx, fuss: oben + (m.maxY + 1) * sy };
    }
    var bilder = sc.children.list.filter(function (o) { return o.active && o.name === 'spezialFolge'; });
    var b = bilder.filter(function (o) { return o.visible; })[0] || null;
    var geh = player.texture.key;
    return {
      anzahl: bilder.length,
      key: b ? b.frame.texture.key : null,
      sichtbar: player.visible,
      jetzt: sc.time.now,
      bild: b ? welt(b, b.frame.texture.key) : null,
      geh: /^dir/.test(geh) ? welt(player, geh) : null,
      andere: sc.children.list.filter(function (o) {
        return o.active && o.visible && o.texture && /^(schlag|rolle)/.test(o.texture.key); })
        .map(function (o) { return o.texture.key; })
    };
  })())`));
}

/** Wie viele Wirkbilder (Effekte, Nachbilder) gerade in der Szene stehen. */
function wirkbilder(H) {
  return H.run(`window.game.scene.getScene('GameScene').children.list.filter(function (o) {
    return o.active && o.name === 'spezialVfx'; }).length`);
}

/**
 * Taktet, bis kein Zusatzbild mehr da ist; sammelt die gezeigten Bilder.
 * Danach weiter, bis auch die Wirkbilder weg sind (Reif und Risse bleiben
 * etwas laenger liegen als die Figur sich bewegt) — `schritte` zaehlt nur
 * die Folge.
 */
function zuEnde(H, max) {
  const gesehen = [];
  let ende = null, schritte = 0;
  for (; schritte < (max || 200); schritte++) {
    const b = blick(H);
    if (!b.anzahl) { ende = b; break; }
    if (b.key && gesehen[gesehen.length - 1] !== b.key) gesehen.push(b.key);
    H.step(1);
  }
  for (let i = 0; i < 200 && wirkbilder(H) > 0; i++) H.step(1);
  return { gesehen, ende, schritte };
}

/** Nach dem Angriff: Spieler sichtbar und gleich gross, nichts liegt herum. */
function aufgeraeumt(H, was, vorher) {
  const n = JSON.parse(H.run(`JSON.stringify((function () {
    var sc = window.game.scene.getScene('GameScene');
    var w = window.__spz;
    function neu(name, alt) {
      return sc.events.listeners(name).filter(function (f) { return alt.indexOf(f) < 0; }).length;
    }
    return { sichtbar: player.visible, w: player.displayWidth, h: player.displayHeight,
             ox: player.originX, oy: player.originY,
             rest: sc.children.list.filter(function (o) { return o.name === 'spezialFolge'; }).length,
             vfx: sc.children.list.filter(function (o) { return o.name === 'spezialVfx'; }).length,
             post: neu('postupdate', w.hoerer.post), shut: neu('shutdown', w.hoerer.shut) };
  })())`));
  assert.strictEqual(n.rest, 0, was + ': das Zusatzbild bleibt stehen');
  assert.strictEqual(n.vfx, 0, was + ': ein Wirkbild bleibt stehen');
  assert.strictEqual(n.sichtbar, true, was + ': der Spieler bleibt unsichtbar');
  assert.strictEqual(n.post, 0, was + ': ein postupdate-Hoerer bleibt haengen');
  assert.strictEqual(n.shut, 0, was + ': ein shutdown-Hoerer bleibt haengen');
  if (vorher) {
    assert.deepStrictEqual([n.w, n.h, n.ox, n.oy], vorher, was + ': der Spieler hat Groesse oder Ursprung geaendert');
  }
}

function masse(H) {
  return JSON.parse(H.run('JSON.stringify([player.displayWidth, player.displayHeight, player.originX, player.originY])'));
}

/** Ausrichtung: das erste Bild der Folge steht auf den Fuessen der Figur. */
function ausgerichtet(b, was, abweichung, mitteErlaubt) {
  const dm = Math.abs(b.bild.mitte - b.geh.mitte), df = Math.abs(b.bild.fuss - b.geh.fuss);
  if (dm > (mitteErlaubt || 6) || df > 4) abweichung.push(was + ' Mitte ' + dm.toFixed(1) + ' Fuss ' + df.toFixed(1));
}

/**
 * Ein Angriff, mit Bildern und im Rueckfall. `ausloesen` laeuft im Spiel (this = Szene).
 * Gibt das erste Bild, die gezeigten Bilder und die Treffer beider Spiele.
 */
function angriff(dd, ausloesen, takte) {
  const erg = {};
  let takt = 0;
  for (const [name, H] of [['mit', MIT], ['ohne', OHNE]]) {
    vorbereiten(H, dd);
    const vorher = masse(H);
    H.run(`(function () { var sc = window.game.scene.getScene('GameScene'); (${ausloesen}).call(sc); })()`);
    const erst = blick(H);
    const { gesehen, schritte } = zuEnde(H, takte);
    // Im Rueckfall gibt es kein Bild, an dessen Ende man sich halten kann:
    // genauso lange takten wie mit, dann noch etwas fuer den letzten Tick.
    if (name === 'mit') takt = schritte; else H.step(takt);
    H.step(10);
    const treffer = JSON.parse(H.run('JSON.stringify(window.__spz.treffer)'));
    aufgeraeumt(H, name + ' ' + dd, vorher);
    loesen(H);
    erg[name] = { erst, gesehen, treffer };
  }
  assert.deepStrictEqual(erg.mit.treffer, erg.ohne.treffer, dd + ': Treffer mit Bildern und im Rueckfall verschieden');
  assert.ok(erg.mit.treffer.length > 0, dd + ': gar keine Treffer — die Puppen stehen falsch');
  // Im Rueckfall: kein Zusatzbild, der Spieler steht sichtbar da.
  assert.strictEqual(erg.ohne.erst.anzahl, 0, dd + ': Zusatzbild im Rueckfall');
  assert.strictEqual(erg.ohne.erst.sichtbar, true, dd + ': Spieler im Rueckfall versteckt');
  assert.strictEqual(erg.mit.erst.sichtbar, false, dd + ': der Spieler steht sichtbar neben seiner Folge');
  return erg.mit;
}

const WIRBEL = 'function () { castWhirlwind.call(this); }';
const FROST = 'function () { castFrostNova.call(this); }';
const ZYKLON = 'function () { castCycloneStrike.call(this); }';
const STURM = 'function () { shadowCharge.call(this); }';

test('Wirbel: die Drehung laeuft als Schleife, solange der Kanal dauert', () => {
  const r = angriff('04', WIRBEL);
  assert.strictEqual(r.erst.key, 'spezial_wirbel_f00');
  const abw = []; ausgerichtet(r.erst, 'wirbel', abw);
  assert.deepStrictEqual(abw, [], 'die Drehung steht neben der Figur');
  // 850 ms Kanal, 320 ms je Runde: mehr als zwei Runden, also kommt Bild 0
  // nach Bild 7 wieder.
  const runden = r.gesehen.filter((k) => k === 'spezial_wirbel_f00').length;
  assert.ok(runden >= 2, 'keine Schleife: ' + r.gesehen.join(','));
  assert.ok(new Set(r.gesehen).size === 8, 'nicht alle acht Drehbilder: ' + [...new Set(r.gesehen)]);
});

test('Frostnova und Wirbelsog: je eine richtungslose Folge', () => {
  for (const [ausloesen, name] of [[FROST, 'frost'], [ZYKLON, 'zyklon']]) {
    // Auch nach Norden schauend die eine (nach Sueden gezeichnete) Folge.
    const r = angriff('02', ausloesen);
    assert.strictEqual(r.erst.key, 'spezial_' + name + '_f00', name);
    assert.ok(r.gesehen.length >= 6, name + ': nur ' + r.gesehen.join(','));
    assert.strictEqual(r.gesehen[r.gesehen.length - 1], 'spezial_' + name + '_f07', name + ': endet nicht auf dem letzten Bild');
  }
});

test('Ansturm: in jeder Richtung die Folge der Zielrichtung, an der Figur', () => {
  const abw = [];
  for (const dd of Object.keys(RICHTUNGEN)) {
    const r = angriff(dd, STURM);
    assert.strictEqual(r.erst.key, 'spezial_sturm_' + dd + '_f00', dd);
    ausgerichtet(r.erst, 'sturm ' + dd, abw);
    assert.ok(r.gesehen.length >= 6, dd + ': nur ' + r.gesehen.join(','));
  }
  assert.deepStrictEqual(abw, [], 'der Ansturm steht neben der Figur: ' + abw.join('; '));
});

test('Schattenschritt: Absprung im Blink, Landung danach, durchsichtig wie der Spieler', () => {
  const abw = [];
  for (const dd of Object.keys(RICHTUNGEN)) {
    vorbereiten(MIT, dd);
    const vorher = masse(MIT);
    MIT.run(`(function () { shadowTeleportDash.call(window.game.scene.getScene('GameScene')); })()`);
    const erst = blick(MIT);
    assert.strictEqual(erst.key, 'spezial_sprung_' + dd + '_f00', dd);
    assert.strictEqual(erst.sichtbar, false, dd + ': Spieler sichtbar');
    ausgerichtet(erst, 'sprung ' + dd, abw);
    // Waehrend des Blinks ist das Bild so blass wie der Spieler (0.12).
    const alpha = MIT.run(`window.game.scene.getScene('GameScene').children.list.filter(function (o) {
      return o.name === 'spezialFolge'; })[0].alpha`);
    assert.ok(alpha < 0.2, dd + ': im Blink deckend: ' + alpha);
    // Die Landung (zweite Haelfte) ist erst nach dem Blink zu sehen, deckend.
    let landung = null;
    for (let i = 0; i < 40 && !landung; i++) {
      MIT.step(1);
      const z = JSON.parse(MIT.run(`JSON.stringify((function () {
        var o = window.game.scene.getScene('GameScene').children.list.filter(function (o) {
          return o.name === 'spezialFolge'; })[0];
        return o ? { k: o.frame.texture.key, a: o.alpha, blink: isDashing } : null; })())`));
      if (z && /_f0[5-7]$/.test(z.k)) landung = z;
    }
    assert.ok(landung, dd + ': keine Landung gezeigt');
    assert.strictEqual(landung.blink, false, dd + ': die Landung faellt noch in den Blink');
    assert.strictEqual(landung.a, 1, dd + ': die Landung ist nicht deckend');
    zuEnde(MIT);
    aufgeraeumt(MIT, 'sprung ' + dd, vorher);
    loesen(MIT);
    MIT.step(10);
  }
  assert.deepStrictEqual(abw, [], 'der Sprung steht neben der Figur: ' + abw.join('; '));
});

test('Hammer: Ausholen beim Aufladen, Schlag beim Loslassen, in jeder Richtung', () => {
  const abw = [];
  for (const dd of Object.keys(RICHTUNGEN)) {
    const erg = {};
    for (const [name, H] of [['mit', MIT], ['ohne', OHNE]]) {
      vorbereiten(H, dd);
      const vorher = masse(H);
      H.run(`beginChargedSlash.call(window.game.scene.getScene('GameScene'))`);
      const erst = blick(H);
      // Aufladen: die Ausholbilder laufen durch und bleiben oben stehen.
      for (let i = 0; i < 30; i++) H.step(1);
      const oben = blick(H);
      H.run(`releaseChargedSlash.call(window.game.scene.getScene('GameScene'))`);
      const schlag = blick(H);
      const { gesehen } = zuEnde(H);
      const treffer = JSON.parse(H.run('JSON.stringify(window.__spz.treffer)'));
      aufgeraeumt(H, 'hammer ' + name + ' ' + dd, vorher);
      loesen(H);
      H.step(5);
      H.run('chargeSlashCooldown = false');
      erg[name] = { erst, oben, schlag, gesehen, treffer };
    }
    const m = erg.mit;
    assert.strictEqual(m.erst.key, 'spezial_hammer_' + dd + '_f00', dd + ': Ausholen');
    assert.strictEqual(m.erst.sichtbar, false, dd + ': Spieler beim Aufladen sichtbar');
    ausgerichtet(m.erst, 'hammer ' + dd, abw);
    assert.strictEqual(m.oben.key, 'spezial_hammer_' + dd + '_f02', dd + ': haelt den Flegel nicht oben');
    assert.strictEqual(m.oben.anzahl, 1, dd + ': mehr als ein Zusatzbild beim Aufladen');
    assert.strictEqual(m.schlag.key, 'spezial_hammer_' + dd + '_f03', dd + ': Schlag beginnt nicht mit dem Niederschwung');
    assert.strictEqual(m.schlag.anzahl, 1, dd + ': das Ausholbild bleibt neben dem Schlag stehen');
    assert.strictEqual(m.gesehen[m.gesehen.length - 1], 'spezial_hammer_' + dd + '_f07', dd);
    assert.deepStrictEqual(m.treffer, erg.ohne.treffer, dd + ': Treffer mit Bildern und im Rueckfall verschieden');
    assert.ok(m.treffer.length > 0, dd + ': keine Treffer');
    assert.strictEqual(erg.ohne.erst.anzahl + erg.ohne.schlag.anzahl, 0, dd + ': Zusatzbild im Rueckfall');
  }
  assert.deepStrictEqual(abw, [], 'der Hammer steht neben der Figur: ' + abw.join('; '));
});

// ---- Zweite Runde: die uebrigen sechs Faehigkeiten -----------------------

const TODESSTOSS = 'function () { shadowDeathBlow.call(this); }';
const GREIF = 'function () { castSteelGrasp.call(this); }';

test('Todesstoss und Stahlgriff: in jeder Richtung die Folge der Zielrichtung, an der Figur', () => {
  const abw = [];
  for (const [ausloesen, name] of [[TODESSTOSS, 'todesstoss'], [GREIF, 'greif']]) {
    for (const dd of Object.keys(RICHTUNGEN)) {
      const r = angriff(dd, ausloesen);
      assert.strictEqual(r.erst.key, 'spezial_' + name + '_' + dd + '_f00', name + ' ' + dd);
      ausgerichtet(r.erst, name + ' ' + dd, abw);
      assert.ok(r.gesehen.length >= 6, name + ' ' + dd + ': nur ' + r.gesehen.join(','));
      assert.strictEqual(r.gesehen[r.gesehen.length - 1], 'spezial_' + name + '_' + dd + '_f07', name + ' ' + dd);
    }
  }
  assert.deepStrictEqual(abw, [], 'Todesstoss/Stahlgriff stehen neben der Figur: ' + abw.join('; '));
});

test('Wirbelklingen: Wurf in jeder Richtung, im Rueckfall kein Zusatzbild', () => {
  const abw = [];
  // Die Zielhilfe dreht den Wurf auf echte Gegner des Zufallsraums — hier
  // soll er genau in die gestellte Richtung gehen.
  MIT.run('window.__zielhilfe = _aimAssistVector; _aimAssistVector = function (d) { return d; }');
  for (const dd of Object.keys(RICHTUNGEN)) {
    vorbereiten(MIT, dd);
    const vorher = masse(MIT);
    MIT.run(`castTwistingBlades.call(window.game.scene.getScene('GameScene'))`);
    const erst = blick(MIT);
    assert.strictEqual(erst.key, 'spezial_klingen_' + dd + '_f00', dd);
    assert.strictEqual(erst.sichtbar, false, dd + ': Spieler sichtbar');
    // Im ersten Bild holt der Arm mit der Klinge schon seitlich aus: der
    // Umriss wird breiter, seine Mitte wandert. Die Ruhepose selbst richtet
    // tools/spezialBauen.js auf +-6 px aus; hier 8 px fuer den Arm.
    ausgerichtet(erst, 'klingen ' + dd, abw, 8);
    const { gesehen } = zuEnde(MIT);
    assert.strictEqual(gesehen[gesehen.length - 1], 'spezial_klingen_' + dd + '_f07', dd);
    aufgeraeumt(MIT, 'klingen ' + dd, vorher);
    loesen(MIT);
  }
  MIT.run('_aimAssistVector = window.__zielhilfe');
  assert.deepStrictEqual(abw, [], 'der Wurf steht neben der Figur: ' + abw.join('; '));
  vorbereiten(OHNE, '04');
  OHNE.run(`castTwistingBlades.call(window.game.scene.getScene('GameScene'))`);
  const o = blick(OHNE);
  assert.strictEqual(o.anzahl, 0, 'Zusatzbild im Rueckfall');
  assert.strictEqual(o.sichtbar, true);
  OHNE.step(80);
  loesen(OHNE);
});

/**
 * Buffs und Heilung ueber den echten Weg (ABILITY_DEFS.activate bzw.
 * shadowHeilwunde). Die Folge ist nur das Aktivieren: sie endet lange vor
 * dem Buff, danach laeuft die Figur wieder mit ihren eigenen Bildern.
 */
const SELBST = {
  raserei: { js: "window.AbilitySystem.getAbilityDef('frenzy').activate(sc)", buff: 'window.frenzyState' },
  berserk: { js: "window.AbilitySystem.getAbilityDef('berserk').activate(sc)", buff: 'window.berserkState' },
  heil: { js: 'shadowHeilwunde.call(sc)', buff: null }
};

test('Raserei, Berserker, Heilwunde: kurze Folge beim Aktivieren, kein Dauer-Override', () => {
  for (const [name, s] of Object.entries(SELBST)) {
    for (const H of [MIT, OHNE]) {
      vorbereiten(H, '02');
      const lp = H.run('playerHealth');
      H.run(`(function () { var sc = window.game.scene.getScene('GameScene'); ${s.js}; })()`);
      const erst = blick(H);
      if (H === OHNE) {
        assert.strictEqual(erst.anzahl, 0, name + ': Zusatzbild im Rueckfall');
        assert.strictEqual(erst.sichtbar, true, name + ': Spieler im Rueckfall versteckt');
      } else {
        // Auch nach Norden schauend die eine (nach Sueden gezeichnete) Folge.
        assert.strictEqual(erst.key, 'spezial_' + name + '_f00', name);
        assert.strictEqual(erst.sichtbar, false, name + ': Spieler sichtbar');
        const abw = []; ausgerichtet(erst, name, abw);
        assert.deepStrictEqual(abw, [], name + ' steht neben der Figur');
        let schritte = 0, gesehen = [];
        for (; schritte < 120 && blick(H).anzahl; schritte++) {
          const b = blick(H); if (b.key && gesehen[gesehen.length - 1] !== b.key) gesehen.push(b.key);
          H.step(1);
        }
        assert.ok(gesehen.length >= 6, name + ': nur ' + gesehen.join(','));
        assert.ok(schritte < 50, name + ': die Folge dauert zu lang (' + schritte + ' Bilder)');
        assert.strictEqual(blick(H).sichtbar, true, name + ': danach bleibt der Spieler unsichtbar');
        if (s.buff) {
          assert.strictEqual(H.run(`!!(${s.buff} && ${s.buff}.active)`), true, name + ': der Buff ist schon vorbei');
        }
      }
      // Buff beenden, damit die Aura vergeht und der naechste Fall frei ist.
      if (s.buff) H.run(`if (${s.buff}) { ${s.buff}.active = false; }`);
      H.run('playerHealth = ' + lp);
      for (let i = 0; i < 200 && wirkbilder(H) > 0; i++) H.step(1);
      H.step(5);
      if (H === MIT) aufgeraeumt(H, name);
      loesen(H);
    }
  }
});

test('Vorrang: ein Schlag im Wirbel verdeckt die Drehung nicht, eine Rolle schon', () => {
  vorbereiten(MIT, '04');
  MIT.run(`castWhirlwind.call(window.game.scene.getScene('GameScene'))`);
  MIT.step(3);
  // Schlag mitten im Wirbel: die Drehung bleibt vorn, das Schlagbild unsichtbar.
  MIT.run(`(function () { isAttacking = false; attackCooldown = false;
    attack.call(window.game.scene.getScene('GameScene')); })()`);
  let b = blick(MIT);
  assert.ok(/^spezial_wirbel_/.test(b.key), 'der Schlag verdeckt den Wirbel: ' + b.key);
  assert.deepStrictEqual(b.andere, [], 'das Schlagbild steht sichtbar neben dem Wirbel');
  assert.strictEqual(b.sichtbar, false);
  // Nach dem Schlag (<= 300 ms) dreht er weiter, der Spieler bleibt versteckt.
  MIT.step(20);
  b = blick(MIT);
  assert.ok(/^spezial_wirbel_/.test(b.key), 'nach dem Schlag ist der Wirbel weg');
  assert.strictEqual(b.sichtbar, false, 'das Schlagende zeigt den Spieler mitten im Wirbel');
  // Eine Rolle geht vor: sie ist zu sehen, der Wirbel nicht.
  MIT.run(`(function () { isAttacking = false; isRolling = false; rollCooldown = false;
    performRoll.call(window.game.scene.getScene('GameScene')); })()`);
  b = blick(MIT);
  assert.strictEqual(b.key, null, 'der Wirbel ist waehrend der Rolle zu sehen');
  assert.strictEqual(b.andere.length, 1, 'die Rolle ist nicht zu sehen: ' + b.andere);
  assert.ok(/^rolle/.test(b.andere[0]));
  // Nach der Rolle (200 ms) kommt die Drehung zurueck.
  MIT.step(16);
  b = blick(MIT);
  assert.ok(/^spezial_wirbel_/.test(b.key), 'nach der Rolle dreht er nicht weiter: ' + b.key);
  assert.strictEqual(b.sichtbar, false);
  zuEnde(MIT);
  aufgeraeumt(MIT, 'Vorrang');
  loesen(MIT);
  MIT.step(60);
});

// Hoerer der Spezialfolgen (in player.js mit spezialFolge gezeichnet).
// Die Wirkbilder (#174 Nachbesserung) zeichnen ihre Hoerer mit 'vfx_<effekt>'.
const ZAEHL = "function zaehl(sc, n, nurFolge) { return sc.events.listeners(n).filter(function (f) { return f.spezialFolge && !(nurFolge && /^vfx_/.test(f.spezialFolge)); }).length; }";

test('Szenenneustart mitten im Wirbel: kein Bild, kein Hoerer bleibt', async () => {
  vorbereiten(MIT, '06');
  const vorher = JSON.parse(MIT.run(`JSON.stringify((function () {
    var sc = window.game.scene.getScene('GameScene');
    ${ZAEHL}
    return { post: zaehl(sc, 'postupdate'), shut: zaehl(sc, 'shutdown') };
  })())`));
  MIT.run(`castWhirlwind.call(window.game.scene.getScene('GameScene'))`);
  MIT.step(3);
  assert.strictEqual(blick(MIT).anzahl, 1);
  const waehrend = JSON.parse(MIT.run(`JSON.stringify((function () {
    var sc = window.game.scene.getScene('GameScene');
    ${ZAEHL}
    return { post: zaehl(sc, 'postupdate', true), shut: zaehl(sc, 'shutdown', true),
             alle: zaehl(sc, 'postupdate') };
  })())`));
  assert.deepStrictEqual([vorher.post, vorher.shut, waehrend.post, waehrend.shut], [0, 0, 1, 1], 'Hoerer des Wirbels');
  // Dazu Staubring und Schwunglinien, je ein Hoerer.
  assert.strictEqual(waehrend.alle, 3, 'Hoerer der Wirkbilder des Wirbels');
  loesen(MIT);
  MIT.run('player.__vorNeustart = true');
  MIT.run(`window.game.scene.getScene('GameScene').scene.restart()`);
  MIT.step(1);
  const ok = await MIT.waitForScene('GameScene', { maxRounds: 250 });
  assert.ok(ok, 'GameScene kam nach dem Neustart nicht wieder');
  assert.strictEqual(MIT.run('!!player.__vorNeustart'), false, 'die Szene wurde gar nicht neu gestartet');
  MIT.step(5);
  const n = JSON.parse(MIT.run(`JSON.stringify((function () {
    var sc = window.game.scene.getScene('GameScene');
    ${ZAEHL}
    return { rest: sc.children.list.filter(function (o) { return o.name === 'spezialFolge' || o.name === 'spezialVfx'; }).length,
             sichtbar: player.visible,
             // Hoerer, die noch auf ein Bild der alten Szene zeigen.
             post: zaehl(sc, 'postupdate'),
             shut: zaehl(sc, 'shutdown') };
  })())`));
  assert.strictEqual(n.rest, 0, 'ein Wirbelbild ueberlebt den Neustart');
  assert.strictEqual(n.post, 0, 'ein postupdate-Hoerer des Wirbels ueberlebt den Neustart');
  assert.strictEqual(n.shut, 0, 'ein shutdown-Hoerer des Wirbels ueberlebt den Neustart');
  assert.strictEqual(n.sichtbar, true, 'der Spieler ist nach dem Neustart unsichtbar');
  // Danach wirbelt er normal weiter (der Stapel der Folgen ist nicht verklemmt).
  vorbereiten(MIT, '06');
  MIT.run(`castWhirlwind.call(window.game.scene.getScene('GameScene'))`);
  const b = blick(MIT);
  assert.strictEqual(b.key, 'spezial_wirbel_f00', 'nach dem Neustart kein Wirbelbild');
  assert.strictEqual(b.sichtbar, false);
  zuEnde(MIT);
  aufgeraeumt(MIT, 'nach Neustart');
  loesen(MIT);
});

test('Tod mitten im Wirbel: die Figur gehoert sofort wieder dem Spieler', () => {
  vorbereiten(MIT, '06');
  MIT.run(`castWhirlwind.call(window.game.scene.getScene('GameScene'))`);
  MIT.step(2);
  assert.strictEqual(blick(MIT).anzahl, 1);
  // Nur die Zahl, ohne den Sterbeweg (Rangliste, Rueckkehr) anzustossen.
  // playerDeathHandled: der Sterbeweg selbst (Rangliste, Rueckkehr) laeuft
  // dann nicht an, das Spiel haelt nur an — wie in den Bildern nach dem Tod.
  const lp = MIT.run('playerHealth');
  MIT.run('playerDeathHandled = true; playerHealth = 0');
  MIT.step(1);
  const b = blick(MIT);
  MIT.run('playerHealth = ' + lp + '; playerDeathHandled = false');
  assert.strictEqual(b.anzahl, 0, 'das Wirbelbild bleibt ueber dem Toten');
  assert.strictEqual(b.sichtbar, true, 'der tote Spieler bleibt unsichtbar');
  MIT.step(60);
  aufgeraeumt(MIT, 'Tod');
  loesen(MIT);
});

test('Rueckfall: in Verkleidung oder ohne Bilder steht die Figur; fehlende Bilder kommen nach', async () => {
  vorbereiten(MIT, '04');
  MIT.run(`(function () { player.setTexture('particle'); castFrostNova.call(window.game.scene.getScene('GameScene'));
    player.setTexture('dir04_f00'); })()`);
  let b = blick(MIT);
  assert.strictEqual(b.anzahl, 0, 'Zusatzbild trotz Verkleidung');
  assert.strictEqual(b.sichtbar, true);
  MIT.step(40);
  loesen(MIT);
  // Ein Bild fehlt: diesmal keine Folge, aber es wird nachgeladen ...
  MIT.run(`window.game.textures.remove('spezial_sturm_04_f05')`);
  vorbereiten(MIT, '04');
  MIT.run(`shadowCharge.call(window.game.scene.getScene('GameScene'))`);
  b = blick(MIT);
  assert.strictEqual(b.anzahl, 0, 'Zusatzbild trotz fehlender Bilder');
  assert.strictEqual(b.sichtbar, true);
  const da = await MIT.settle(() => MIT.run(`window.game.textures.exists('spezial_sturm_04_f05')`), { maxRounds: 200, framesPerRound: 1 });
  assert.ok(da, 'das fehlende Bild wird nicht nachgeladen');
  zuEnde(MIT);
  loesen(MIT);
  // ... und beim naechsten Einsatz bewegt sich die Figur wieder.
  vorbereiten(MIT, '04');
  MIT.run(`shadowCharge.call(window.game.scene.getScene('GameScene'))`);
  assert.strictEqual(blick(MIT).key, 'spezial_sturm_04_f00', 'nach dem Nachladen keine Folge');
  zuEnde(MIT);
  loesen(MIT);
});

test('Laden: mit dem Dungeon nur die gelernten Faehigkeiten, nie doppelt', () => {
  // Gefangen am Lader, im Rueckfall-Spiel (dort ist nichts geladen).
  const fang = (gelernt, gibts) => JSON.parse(OHNE.run(`JSON.stringify((function () {
    var AS = window.AbilitySystem, alt = AS.getLearnedAbilities;
    AS.getLearnedAbilities = function () { return ${JSON.stringify(gelernt)}; };
    var bilder = [], boegen = [];
    try {
      spezialBilderVorladen({ image: function (k) { bilder.push(k); }, spritesheet: function (k) { boegen.push(k); },
        textureManager: { exists: function (k) { return ${gibts}; } } });
    } finally { AS.getLearnedAbilities = alt; }
    return { bilder: bilder, boegen: boegen };
  })())`));
  // Nichts gelernt: nichts geladen.
  assert.deepStrictEqual(fang([], false), { bilder: [], boegen: [] });
  // Raserei (richtungslos): 8 Koerperbilder, Druckring und Aura.
  const r = fang(['frenzy'], false);
  assert.strictEqual(r.bilder.length, 8);
  assert.ok(r.bilder.every((k) => /^spezial_raserei_f0\d$/.test(k)), r.bilder.join(','));
  assert.deepStrictEqual(r.boegen.sort(), ['spezialvfx_raserei_aura', 'spezialvfx_raserei_stoss']);
  // Ansturm (gerichtet): 8 x 8 Bilder.
  assert.strictEqual(fang(['charge'], false).bilder.length, 64);
  // Alle zwoelf: 6 richtungslose + 6 gerichtete x 8 Richtungen, je 8 Bilder,
  // und 18 Bildzeilen Wirkbilder (Funken und Blut nur einmal).
  const alle = fang(['whirlwind', 'hammer', 'charge', 'teleportDash', 'frostNova', 'cycloneStrike',
    'deathBlow', 'steelGrasp', 'twistingBlades', 'frenzy', 'berserk', 'heilwunde'], false);
  assert.strictEqual(alle.bilder.length, 6 * 8 + 6 * 8 * 8);
  assert.strictEqual(alle.boegen.length, 18);
  // Was schon da ist, wird nicht noch einmal geladen.
  assert.deepStrictEqual(fang(['frenzy', 'charge'], true), { bilder: [], boegen: [] });
  // Der Start (Hub) laedt keine Spezialbilder.
  const start = JSON.parse(OHNE.run(`JSON.stringify((function () { var keys = [];
    preloadPlayerDirectionalFrames({ image: function (k) { keys.push(k); },
      textureManager: { exists: function () { return false; } } });
    return keys.filter(function (k) { return /^spezial/.test(k); }).length; })())`));
  assert.strictEqual(start, 0, 'der Start laedt Spezialbilder');
  // Die Konsolenhilfe gibt es genau im Debug-Modus.
  for (const H of [MIT, OHNE]) {
    assert.strictEqual(H.run('typeof window.__spezialProbe'), H.run('window.DebugGate.aktiv()') ? 'function' : 'undefined');
  }
  assert.strictEqual(MIT.run('typeof window.__spezialProbe'), 'function', 'mit ?debug=1 fehlt die Konsolenhilfe');
});
