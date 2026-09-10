// tests/kettenblitz.test.js — der Kettenblitz haengt am ECHTEN Wirbel (#93).
//
// Vorgeschichte, damit das hier nicht noch einmal passiert:
//
// Gemeldet als "funktioniert glaubs noch nicht", dann zweimal "der Toast kommt
// nie". Beide Male habe ich am falschen Ort gemessen. Der Knoten sass in
// spinAttack — dem ALTEN Einzelwirbel. Seit 060 loest der Spieler den Wirbel
// ueber castWhirlwind aus, den beweglichen Kanal, und spinAttack wird von
// nichts mehr aufgerufen. Der Knoten lag in totem Code: investiert, bezahlt,
// wirkungslos. Alle frueheren Tests riefen spinAttack direkt und waren gruen.
//
// Diese Tests fahren deshalb ausschliesslich castWhirlwind.
//
// Fallen im Testkopf, die einzeln Stunden gekostet haben:
//
//   1. `enemies`, `player`, `weaponDamage` und `playerCritChance` sind
//      script-scoped. Ueber window nicht erreichbar, ueber den blossen Namen
//      schon.
//   2. Der Kanal schlaegt in Ticks alle 120 ms zu, nicht sofort. Nach dem
//      Aufruf muessen Frames gepumpt werden, sonst ist noch nichts passiert.
//   3. Der Knoten verlangt Berserker Rang 1. Ohne die Vorbedingung nimmt
//      investPoint ihn still nicht an und der Rang bleibt 0.
//   4. Krit verdoppelt einzelne Treffer. Fuer jeden Vergleich zweier
//      Schadenszahlen muss er aus sein.
//   5. Die Kanalreichweite ist 0,6 der Spin-Reichweite, nicht die volle.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=20', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  let gefunden = 0;
  for (let runde = 0; runde < 40 && gefunden < 2; runde++) {
    H.step(40);
    gefunden = H.run('(function(){ var n = 0;'
      + ' if (typeof enemies !== "undefined" && enemies && enemies.children)'
      + ' enemies.children.iterate(function (e) { if (e && e.active) n++; });'
      + ' return n; })()');
  }
  assert.ok(gefunden >= 2, 'im Raum stehen nur ' + gefunden + ' Gegner');

});
after(async () => { if (H) await H.shutdown(); });

/** Investiert den Knoten samt seiner Vorbedingung (Berserker Rang 1). */
function knotenSetzen() {
  return H.run(`(function () {
    var ST = window.SkillTree;
    for (var i = 0; i < 60; i++) ST.grantSkillPoint();
    [['whirlwind',2],['hammer',2],['frenzy',2],['berserk',1]].forEach(function (p) {
      for (var k = 0; k < p[1]; k++) ST.investPoint(p[0], 30);
    });
    ST.investPoint('combat_chain_lightning', 30);
    return window.skillRang('combat_chain_lightning');
  })()`);
}

/**
 * Wirbelt einmal ueber castWhirlwind und gibt zurueck, was dabei herauskam.
 *
 * g1 steht IM Kanal, g2 ausserhalb — in `weite` px Abstand von g1. Genau diese
 * Lage trennt "der Wirbel trifft" von "der Blitz springt".
 *
 * @param {number} weite       Abstand g1 -> g2 in px
 * @param {number} [hpImKanal] Lebenspunkte von g1 (klein = er stirbt am Wirbel)
 */
function wirbeln(weite, hpImKanal) {
  // Erst den vorigen Kanal auslaufen lassen. Er dauert bis 1,3 s, also rund 78
  // Frames, und seine Ticks laufen weiter, waehrend der naechste Test schon
  // aufbaut. Genau daran ist die Probe mit dem sterbenden Gegner gefallen: ein
  // ALTER Tick hat ihn getoetet, bevor der neue Wirbel ihn erfassen konnte —
  // der neue fand dann niemanden und sprang nicht.
  H.step(90);

  const start = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var alle = [];
    enemies.children.iterate(function (e) { if (e && e.active) alle.push(e); });
    if (alle.length < 2) return { fehler: 'nur ' + alle.length + ' Gegner' };

    var px = player.x, py = player.y;
    // Der Kanal reicht 0,6 der Spin-Reichweite — nicht die volle.
    var kanal = Math.round(window.getSpinRange() * 0.6);
    var g1 = alle[0], g2 = alle[1];
    g1.x = px + Math.round(kanal * 0.5);  g1.y = py;
    g2.x = g1.x + ${JSON.stringify(weite)}; g2.y = py;
    for (var j = 2; j < alle.length; j++) { alle[j].x = px + 4000; alle[j].y = py + 4000; }
    alle.forEach(function (g) { if (g.body && g.body.reset) g.body.reset(g.x, g.y); });
    g1.hp = ${JSON.stringify(typeof hpImKanal === 'number' ? hpImKanal : 99999)}; g1.maxHp = 99999;
    g2.hp = 99999; g2.maxHp = 99999;

    weaponDamage = 100;
    playerCritChance = 0;   // Krit verdoppelt sonst einen der Treffer

    window.__g1 = g1; window.__g2 = g2;
    window.__vorG2 = g2.hp;
    window.castWhirlwind.call(sc);
    return {
      kanal: kanal,
      abstand: Math.round(Math.hypot(g2.x - g1.x, g2.y - g1.y)),
      g2VomSpieler: Math.round(Math.hypot(g2.x - px, g2.y - py))
    };
  })()`);
  if (start.fehler) return start;

  H.step(30);   // der Kanal schlaegt in Ticks zu, nicht sofort

  return Object.assign(start, H.run(`(function () {
    return {
      rang: window.skillRang('combat_chain_lightning'),
      schadenG2: window.__vorG2 - window.__g2.hp,
      g1Lebt: !!window.__g1.active,
      reichweite: Math.round(window.kettenReichweite())
    };
  })()`));
}

test('Ohne den Knoten bleibt der zweite Gegner unberuehrt', () => {
  // Die Gegenprobe zuerst, solange der Knoten noch nicht investiert ist. Sie
  // beweist, dass die Lage stimmt: traefe der Kanal g2 auch so, sagte alles
  // Weitere nichts aus.
  const r = wirbeln(60);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.rang, 0, 'der Knoten ist schon investiert');
  assert.ok(r.g2VomSpieler > r.kanal,
    'g2 steht mit ' + r.g2VomSpieler + ' px INNERHALB des Kanals (' + r.kanal + ' px)');
  assert.strictEqual(r.schadenG2, 0,
    'g2 nimmt ' + r.schadenG2 + ' Schaden, obwohl kein Kettenblitz investiert ist');
});

test('Der ECHTE Wirbel loest den Kettenblitz aus', () => {
  // Der Kern der ganzen Sache. Bis b235 stand der Knoten nur in spinAttack,
  // das seit 060 niemand mehr aufruft — im Spiel passierte nie etwas.
  assert.strictEqual(knotenSetzen(), 1, 'der Knoten liess sich nicht investieren');
  const r = wirbeln(60);
  assert.ok(!r.fehler, r.fehler);
  assert.ok(r.schadenG2 > 0,
    'g2 nimmt nichts — der Blitz springt am echten Wirbel nicht');
});

test('Der Sprung macht die HALBE Wirkung eines vollen Treffers', () => {
  // 50 % steht so im Code. Ein Sprung, der genauso hart trifft wie der Wirbel
  // selbst, waere eine stille Verdopplung des Knotens.
  const r = wirbeln(60);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.schadenG2, 50,
    'der Sprung macht ' + r.schadenG2 + ' statt 50 bei Waffenschaden 100');
});

test('Der Blitz springt nur EINMAL je Einsatz, nicht je Tick', () => {
  // Der Kanal tickt sieben- bis elfmal. Feuerte jeder Tick, waere der Knoten
  // das Zehnfache wert — und der Toast klebte am Bildschirm.
  const r = wirbeln(60);
  assert.ok(!r.fehler, r.fehler);
  // Der Schaden IST die Zaehlung: ein Sprung macht 50 bei Waffenschaden 100.
  // Feuerte jeder Tick, staende hier ein Vielfaches davon.
  assert.strictEqual(r.schadenG2, 50,
    'g2 nimmt ' + r.schadenG2 + ' statt 50 — der Sprung wiederholt sich');
});

test('Der Blitz springt auch vom GEFALLENEN Gegner weiter', () => {
  // Der Wirbel toetet meistens, was er trifft. Sammelte man nur Ueberlebende
  // als Absprungpunkt, fiele der Sprung im echten Kampf fast immer aus.
  const r = wirbeln(60, 5);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.g1Lebt, false, 'der Gegner im Kanal hat ueberlebt');
  assert.ok(r.schadenG2 > 0,
    'g2 nimmt nichts — der Blitz springt nicht vom Gefallenen');
});

test('Die Reichweite betraegt 225 px', () => {
  // Gemessen am laufenden Spiel, nicht an der Konstante: so faellt der Test
  // auch dann, wenn die Zahl zwar dasteht, aber ein zweiter Rechenweg
  // dazwischenfunkt.
  const r = wirbeln(60);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.reichweite, 225,
    'die Kette reicht ' + r.reichweite + ' px statt 225');
});

test('Innerhalb der Reichweite springt er, ausserhalb nicht', () => {
  // Beide Seiten. Nur "er springt" waere auch bei unbegrenzter Reichweite gruen,
  // und genau darauf stand sie zum Suchen eine Weile.
  const nah = wirbeln(60);
  assert.ok(!nah.fehler, nah.fehler);
  assert.ok(nah.schadenG2 > 0,
    'auf 60 px springt der Blitz nicht (Reichweite ' + nah.reichweite + ')');

  const weit = wirbeln(Math.round(nah.reichweite * 2));
  assert.ok(!weit.fehler, weit.fehler);
  assert.strictEqual(weit.schadenG2, 0,
    'auf ' + weit.abstand + ' px springt er noch, die Reichweite ist aber nur '
    + weit.reichweite + ' px');
});

test('Der Kettenblitz haengt am Wirbel, den der Spieler wirklich benutzt', () => {
  // Diese Zusicherung ist die Lehre aus zwei Fehlmessungen: die Faehigkeit
  // 'whirlwind' ruft castWhirlwind auf, und DORT muss der Knoten stehen.
  const fs = require('fs');
  const path = require('path');
  const abilities = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'abilitySystem.js'), 'utf8');
  const i = abilities.indexOf('whirlwind: {');
  const block = abilities.slice(i, i + 1200);
  assert.ok(block.indexOf('castWhirlwind') > 0,
    'die Faehigkeit Wirbelwind ruft nicht mehr castWhirlwind auf — '
    + 'dann steht der Knoten wieder am falschen Ort');

  const spieler = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'player.js'), 'utf8');
  const k = spieler.indexOf('function castWhirlwind()');
  const ende = spieler.indexOf('window.castWhirlwind = castWhirlwind', k);
  assert.ok(k > 0 && ende > k, 'castWhirlwind nicht gefunden');
  assert.ok(spieler.slice(k, ende).indexOf('kettenblitzAusloesen') > 0,
    'castWhirlwind loest den Kettenblitz nicht aus');
});
