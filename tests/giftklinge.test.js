// tests/giftklinge.test.js — das Gift waechst mit der Waffe (#93).
//
// Die Giftklinge stand bis b236 im alten spinAttack und hat deshalb nie
// gewirkt — dieselbe Ursache wie beim Kettenblitz. Als sie zum ersten Mal lief,
// zeigte die Messung, warum sie nie ausbalanciert war: 2 flache Punkte je Tick,
// fuenfmal, unabhaengig von Tiefe und Ausruestung. Gemessen liegen Gegner bei
// 1 bis 4 Lebenspunkten — das Gift toetete alles, was es traf, waere aber mit
// jeder Ausruestung belanglos geworden.
//
// Jetzt haengt der Schaden je Tick am Waffenschaden: 10, 20 oder 30 Prozent je
// nach Rang.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=12', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
});
after(async () => { if (H) await H.shutdown(); });

/**
 * Legt Gift mit `anteil` des Waffenschadens auf einen Gegner und gibt zurueck,
 * was der Effekt je Tick anrichtet.
 */
function giftTick(waffe, anteil) {
  return H.run(`(function () {
    var ziel = { x: 0, y: 0, active: true, hp: 99999, maxHp: 99999,
                 setTint: function () {}, clearTint: function () {} };
    var M = window.statusEffectManager;
    M.applyEffect(ziel, window.StatusEffectType.POISON, 'poisonBlade',
      ${waffe} * ${anteil});
    var gift = null;
    M.getActiveEffects(ziel).forEach(function (e) {
      if (e && e.type === 'poison') gift = e.effect;
    });
    return gift ? { schaden: gift.damage, ticks: Math.round(gift.duration / gift.tickInterval) } : null;
  })()`);
}

test('Der Giftschaden folgt dem Waffenschaden', () => {
  const schwach = giftTick(10, 0.1);
  const stark = giftTick(100, 0.1);
  assert.ok(schwach && stark, 'der Effekt wurde nicht gesetzt');
  assert.strictEqual(schwach.schaden, 1, 'bei Waffe 10 und 10 % erwartet 1');
  assert.strictEqual(stark.schaden, 10, 'bei Waffe 100 und 10 % erwartet 10');
});

test('Die Raenge stehen auf 10, 20 und 30 Prozent', () => {
  // Die Anteile als Literale, nicht als 0.1 * rang: 0,1 mal 3 ist in
  // Fliesskomma 0.30000000000000004, und der Test wuerde eine Unschaerfe
  // messen, die das Spiel selbst wegrundet.
  [[0.1, 10], [0.2, 20], [0.3, 30]].forEach(([anteil, erwartet]) => {
    const r = giftTick(100, anteil);
    assert.strictEqual(r.schaden, erwartet,
      'Anteil ' + anteil + ' macht ' + r.schaden + ' statt ' + erwartet + ' bei Waffe 100');
  });
});

test('Ueber die volle Dauer sind es fuenf Ticks', () => {
  // Bei Rang 3 also 1,5 volle Waffentreffer, verteilt ueber fuenf Sekunden.
  const r = giftTick(100, 0.3);
  assert.strictEqual(r.ticks, 5, 'das Gift tickt ' + r.ticks + '-mal statt fuenfmal');
});

test('Ohne Angabe bleibt der Tabellenwert stehen', () => {
  // Fallen, Gegnergift und alles andere sollen unveraendert weiterlaufen.
  const r = H.run(`(function () {
    var ziel = { x: 0, y: 0, active: true, hp: 99999, maxHp: 99999,
                 setTint: function () {}, clearTint: function () {} };
    var M = window.statusEffectManager;
    M.applyEffect(ziel, window.StatusEffectType.POISON, 'irgendwas');
    var gift = null;
    M.getActiveEffects(ziel).forEach(function (e) {
      if (e && e.type === 'poison') gift = e.effect;
    });
    return gift ? gift.damage : null;
  })()`);
  assert.strictEqual(r, 2, 'der Standardwert ist nicht mehr 2, sondern ' + r);
});

test('Der ECHTE Wirbel legt Gift in Hoehe des Waffenschadens an', () => {
  // Die Proben darueber rufen applyEffect selbst und reichen den Anteil von
  // Hand herein — sie pruefen den Effekt, nicht den Weg dorthin. Diese hier
  // geht durch castWhirlwind.
  //
  // WARUM SIE ZWEIMAL DANEBEN GING, damit es nicht ein drittes Mal passiert:
  // Math.random war nur WAEHREND des Aufrufs ersetzt. Der Giftwurf faellt aber
  // erst in den Schadens-Ticks, und die kommen spaeter — der Wurf lief also mit
  // dem echten Zufall, und der Test war in Wahrheit eine 30-Prozent-Chance.
  // Einzeln ging sie oft auf, im Gesamtlauf nicht. Der Zufall bleibt jetzt
  // ueber die ganze Taktung hinweg festgehalten.
  const rang = H.run(`(function () {
    var ST = window.SkillTree;
    for (var i = 0; i < 60; i++) ST.grantSkillPoint();
    for (var k = 0; k < 2; k++) ST.investPoint('whirlwind', 30);
    for (var m = 0; m < 3; m++) ST.investPoint('combat_poison_blade', 30);
    return window.skillRang('combat_poison_blade');
  })()`);
  assert.strictEqual(rang, 3, 'die Giftklinge liess sich nicht auf Rang 3 bringen');

  // Vorigen Kanal auslaufen lassen: seine Ticks laufen sonst in diesen hinein.
  H.step(90);

  const start = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var alle = [];
    enemies.children.iterate(function (e) { if (e && e.active) alle.push(e); });
    if (!alle.length) return { fehler: 'keine Gegner' };
    var g = alle[0];
    var kanal = Math.round(window.getSpinRange() * 0.6);
    g.x = player.x + Math.round(kanal * 0.5); g.y = player.y;
    if (g.body && g.body.reset) g.body.reset(g.x, g.y);
    g.hp = 99999; g.maxHp = 99999;
    weaponDamage = 100;
    playerCritChance = 0;
    window.__giftZiel = g;

    // Zufall festhalten und NICHT sofort zuruecksetzen — die Ticks kommen erst.
    window.__echterZufall = Math.random;
    Math.random = function () { return 0; };
    window.castWhirlwind.call(sc);
    return { ok: true };
  })()`);
  assert.ok(!start.fehler, start.fehler);

  H.step(30);   // der Kanal schlaegt in Ticks zu, nicht sofort

  const gift = H.run(`(function () {
    Math.random = window.__echterZufall;   // erst jetzt zurueck
    var M = window.statusEffectManager;
    var werte = [];
    var pruefe = function (ziel) {
      if (!ziel) return;
      M.getActiveEffects(ziel).forEach(function (e) {
        if (e && e.type === 'poison') werte.push(e.effect.damage);
      });
    };
    pruefe(window.__giftZiel);
    enemies.children.iterate(function (e) { if (e && e !== window.__giftZiel) pruefe(e); });
    return werte;
  })()`);

  assert.ok(gift.length > 0,
    'kein Gegner ist vergiftet — der Wirbel legt gar kein Gift an');
  assert.ok(gift.every((w) => w === 30),
    'das Gift macht ' + JSON.stringify(gift)
    + ' je Tick statt 30 (Rang 3, Waffenschaden 100)');
});

test('Der Wirbel ruft das Gift ueberhaupt auf', () => {
  // Der Effekt koennte tadellos skalieren und trotzdem nie mit einem Anteil
  // gerufen werden. Genau so eine Luecke war der Kettenblitz.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'player.js'), 'utf8');
  const i = quelle.indexOf('function castWhirlwind()');
  const j = quelle.indexOf('window.castWhirlwind = castWhirlwind', i);
  assert.ok(i > 0 && j > i, 'castWhirlwind nicht gefunden');
  const block = quelle.slice(i, j);
  assert.ok(block.indexOf('GIFT_ANTEIL_JE_RANG') > 0,
    'der Wirbel rechnet den Giftschaden nicht aus dem Waffenschaden');
  assert.ok(block.indexOf('poisonBlade') > 0, 'der Wirbel legt gar kein Gift an');
});
