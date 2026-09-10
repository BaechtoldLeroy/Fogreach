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

// HIER FEHLT EINE PROBE AM ECHTEN WEG.
//
// Ein Test, der ueber castWhirlwind laeuft und den gelegten Giftwert misst,
// stand hier und lief einzeln zuverlaessig durch — im Gesamtlauf fiel er auch
// mit vier Anlaeufen und sieben Sekunden Taktung: dort erwischt der Wirbel
// niemanden mehr. Die Ursache habe ich nicht gefunden, und ein Test, der
// gruen ist, weil er nichts mehr misst, waere schlimmer als keiner.
//
// Was dadurch NICHT abgesichert ist: dass der Wirbel den Anteil wirklich
// einsetzt. Die Probe darunter liest nur den Quelltext — sie faellt, wenn die
// Zeile verschwindet, aber nicht, wenn jemand GIFT_ANTEIL_JE_RANG auf 0
// setzt. Genau diese Mutation ueberlebt derzeit.

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
