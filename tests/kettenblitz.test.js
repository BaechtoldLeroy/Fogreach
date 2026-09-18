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
  // Frueher wartete dieser Haken, bis mindestens zwei Gegner im Raum standen.
  // Seit wirbeln() eigene Sonden setzt, braucht niemand mehr die Raumgegner —
  // und mit laufender Uhr war der Raum im Gesamtlauf manchmal schon leer, was
  // alle acht Tests auf einmal fallen liess ("im Raum stehen nur 0 Gegner").
  H.step(60);
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

  // ZWEI FRISCHE, EINGEFRORENE SONDEN je Einsatz.
  //
  // Frueher nahm der Helfer die ersten beiden Gegner im Raum und stellte sie
  // hin. Das ging nur, weil die Uhr im Testkopf still stand (boot.js setzte sie
  // bei jedem step() auf 0 zurueck): nichts bewegte sich, nichts regenerierte.
  // Mit laufender Uhr liefen die Gegner in den Kanal (33 Schaden OHNE Knoten),
  // Regeneration frass vom Sprung (46 statt 50), und nach ein paar Einsaetzen
  // war der Raum leer ("nur 0 Gegner").
  //
  // Deshalb: eigene Sonden, keine Elites (deren Affixe aendern den Schaden),
  // body.moves aus, alle uebrigen Gegner weit weg und ebenfalls eingefroren.
  // Gezaehlt wird jeder LP-VERLUST von g2 pro Frame — Regeneration zaehlt
  // nicht gegen, und der Messwert ist, was der Blitz wirklich abzieht.
  const start = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var EE = window.EliteEnemies;
    (window.__sonden || []).forEach(function (s) { try { if (s.active) { s.hp = 0; s.destroy(); } } catch (e) {} });
    var px = player.x, py = player.y;
    enemies.children.iterate(function (e) {
      if (!e || !e.active) return;
      e.x = px + 4000; e.y = py + 4000;
      if (e.body) { e.body.reset(e.x, e.y); e.body.moves = false; }
    });

    // Kein Champion/Unique: shouldSpawnElite festhalten. Den alten Legacy-
    // Elite (8 %) NICHT ueber Math.random verhindern — spawnEnemy wuerfelt
    // damit auch die Position, und mit festem Zufall fand es je nach Raum
    // keinen Platz ("Sonden liessen sich nicht setzen", im Gesamtlauf 7 Tests
    // auf einmal). Stattdessen normal wuerfeln und Legacy-Elites verwerfen.
    var echtWurf = EE && EE.shouldSpawnElite;
    if (EE) EE.shouldSpawnElite = function () { return null; };
    var sonde = function () {
      for (var v = 0; v < 30; v++) {
        var s = spawnEnemy.call(sc, px + 4000, py + 4000, 1);
        if (s && !s.isElite && !s._isElite) return s;
        if (s) { try { s.destroy(); } catch (e) {} }
      }
      return null;
    };
    var g1, g2;
    try { g1 = sonde(); g2 = sonde(); }
    finally { if (EE) EE.shouldSpawnElite = echtWurf; }
    if (!g1 || !g2) return { fehler: 'Sonden liessen sich nicht setzen' };
    window.__sonden = [g1, g2];

    // Der Kanal reicht 0,6 der Spin-Reichweite — nicht die volle.
    var kanal = Math.round(window.getSpinRange() * 0.6);
    g1.x = px + Math.round(kanal * 0.5);  g1.y = py;
    g2.x = g1.x + ${JSON.stringify(weite)}; g2.y = py;
    [g1, g2].forEach(function (g) {
      if (g.body) { g.body.reset(g.x, g.y); g.body.moves = false; }
    });
    g1.hp = ${JSON.stringify(typeof hpImKanal === 'number' ? hpImKanal : 99999)}; g1.maxHp = 99999;
    g2.hp = 99999; g2.maxHp = 99999;

    weaponDamage = 100;
    playerCritChance = 0;   // Krit verdoppelt sonst einen der Treffer
    playerMaxHealth = 99999; playerHealth = 99999;

    window.__g1 = g1; window.__g2 = g2;
    var mess = { letzte: g2.hp, verlust: 0 };
    mess.fn = function () {
      if (!g2.active) return;
      if (g2.hp < mess.letzte) mess.verlust += mess.letzte - g2.hp;
      mess.letzte = g2.hp;
    };
    if (window.__messung) sc.events.off('postupdate', window.__messung.fn);
    window.__messung = mess;
    sc.events.on('postupdate', mess.fn);
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
    var sc = window.game.scene.getScene('GameScene');
    var m = window.__messung;
    m.fn();                                   // den letzten Stand noch mitnehmen
    sc.events.off('postupdate', m.fn);
    return {
      rang: window.skillRang('combat_chain_lightning'),
      schadenG2: Math.round(m.verlust),
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
