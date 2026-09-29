// tests/zaehHeilung.test.js — die Miniboss-Verzauberung 'Zaeh'.
//
// Sie heilte 4 % der maxHP je Sekunde, ab Tiefe 8 sogar 6 %. Gemessen gegen
// einen tiefen-typisch ausgeruesteten Spieler waren das zwischen 40 % und
// 200 % seines gesamten Schadens — auf Tiefe 12 war der Miniboss gar nicht
// mehr toetbar. Dazu klemmte `Math.max(1, ...)` jeden Tick auf mindestens
// 1 HP, womit der Bruchteil bei kleinen Lebenspunkten gar nicht mehr zaehlte.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => { H = await launchDungeon({ depth: 12 }); });
after(async () => { if (H) await H.shutdown(); });

// Heilung je Sekunde fuer einen Miniboss mit gesetzten maxHP messen.
function heilungProSekunde(maxHp, healFrac, sekunden) {
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
    var e = spawnMiniBoss.call(sc, player.x + 600, player.y, undefined);
    e.maxHp = ${maxHp};
    e.hp = 1;                       // weit unter maxHp, damit der Tick greift
    e._enchant = { id: 'regenerator', healFrac: ${healFrac} };
    e._lastHealMs = 0; e._healRest = 0;
    window._playerInvincible = true;
    window.__zaeh = e;
  })()`);
  // Bis die Zeit wirklich durch ist takten, nicht Bilder zaehlen.
  const jetzt = () => H.run(`window.game.scene.getScene('GameScene').time.now`);
  const t0 = jetzt();
  let t = t0;
  for (let i = 0; i < 4000 && t - t0 < sekunden * 1000; i++) { H.step(4); t = jetzt(); }
  const hp = H.run(`window.__zaeh.hp`);
  return { geheilt: hp - 1, dauerMs: t - t0 };
}

test('Zaeh heilt hoechstens 2 % der maxHP je Sekunde', () => {
  const reg = H.run(`(function () {
    var basis = MINIBOSS_ENCHANTS.filter(function (e) { return e.id === 'regenerator'; })[0];
    return { basis: basis.healFrac, tief: _scaleEnchant(basis, 20).healFrac };
  })()`);
  assert.ok(reg.basis <= 0.015 + 1e-9,
    'Grundwert zu hoch: ' + reg.basis + ' (gemessen traegt ein Spieler 3.7-15.6 %/s ab)');
  assert.ok(reg.tief <= 0.02 + 1e-9,
    'Tiefen-Wert zu hoch: ' + reg.tief);
});

test('Zaeh frisst hoechstens ein Fuenftel des Spielerschadens', () => {
  // Gemessen ueber 25 Ausruestungs-Wuerfe je Tiefe (6/8/12/16/20): ein
  // tiefen-typisch ausgeruesteter Spieler traegt im Median 10.6-20.8 % der
  // maxHP eines Minibosses je Sekunde ab. Die Heilung darf davon ein Fuenftel
  // kosten — dann dauert der Kampf spuerbar laenger, ohne ihn zu kippen.
  // Die alten 6 % waren 46 % des Medians (Kampf fast doppelt so lang), und
  // gegen einen schwachen Wurf war der Miniboss gar nicht mehr toetbar.
  const MEDIAN_DPS = 0.13;
  const tief = H.run(`(function () {
    var basis = MINIBOSS_ENCHANTS.filter(function (e) { return e.id === 'regenerator'; })[0];
    return _scaleEnchant(basis, 20).healFrac;
  })()`);
  const anteil = tief / MEDIAN_DPS;
  assert.ok(anteil <= 0.2,
    'die Heilung frisst ' + (anteil * 100).toFixed(0) + ' % des Spielerschadens');
});

test('der Bruchteil wird nicht auf 1 HP je Tick aufgerundet', () => {
  // 40 HP bei 1.5 % = 0.6 HP je Sekunde. Mit der alten Klemme waeren es 1 HP
  // je Sekunde gewesen — also fast das Doppelte.
  const r = heilungProSekunde(40, 0.015, 10);
  const sek = r.dauerMs / 1000;
  const proSek = r.geheilt / sek;
  assert.ok(sek >= 9.5, 'zu wenig Zeit getaktet: ' + sek.toFixed(1) + 's');
  assert.ok(proSek < 0.8,
    'der Tick rundet noch auf: ' + proSek.toFixed(2) + ' HP/s bei erwarteten 0.6');
  assert.ok(proSek > 0.4,
    'es wird gar nicht mehr geheilt: ' + proSek.toFixed(2) + ' HP/s');
});
