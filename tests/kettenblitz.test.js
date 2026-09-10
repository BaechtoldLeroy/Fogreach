// tests/kettenblitz.test.js — der Kettenblitz springt wirklich (#93).
//
// Gemeldet als "funktioniert glaubs noch nicht". Gemessen tut er es: mit Rang 1
// nimmt ein Gegner AUSSERHALB des Wirbels genau die Haelfte des Schadens, den
// der Wirbel im Inneren angerichtet hat. Ohne den Rang nimmt er nichts.
//
// Dass es so lange gedauert hat, das zu zeigen, lag an drei Fallen im Testkopf
// — sie stehen hier, damit die naechste Messung nicht wieder daran haengt:
//
//   1. Der Wirbel prueft `jetzt - lastSpinTime < Abklingzeit` (5000 ms), und
//      lastSpinTime ist beim Start 0. Kurz nach Szenenbeginn greift die Sperre,
//      OHNE dass je gewirbelt wurde.
//   2. `enemies`, `player`, `weaponDamage`, `isSpinning` und `lastSpinTime`
//      sind script-scoped. Ueber window sind sie nicht erreichbar, ueber den
//      blossen Namen schon.
//   3. Wie viele Gegner nach N Frames stehen, schwankt. Eine feste Zahl Frames
//      traf mal vier, mal null — deshalb wird gewartet, bis zwei da sind.

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

/**
 * Wirbelt einmal und gibt den Schaden an beiden Gegnern zurueck.
 *
 * g1 steht IM Wirbel, g2 knapp ausserhalb — aber innerhalb der Kettenreichweite
 * von g1. Genau diese Lage trennt "Wirbel trifft" von "Kette springt".
 *
 * Die Kettenreichweite wird NICHT nachgetragen, sondern aus dem Spiel gelesen
 * (window.KETTEN_REICHWEITE). Eine eigene Kopie waere still falsch, sobald die
 * Zahl sich aendert — genau das ist beim Sprung von 120 auf 300 passiert.
 */
function wirbeln(mitKette, weite) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var ST = window.SkillTree;
    for (var i = 0; i < 60; i++) ST.grantSkillPoint();
    [['whirlwind',2],['hammer',2],['frenzy',2],['berserk',1]].forEach(function (p) {
      for (var k = 0; k < p[1]; k++) ST.investPoint(p[0], 30);
    });
    ${mitKette ? "ST.investPoint('combat_chain_lightning', 30);" : ''}

    var alle = [];
    enemies.children.iterate(function (e) { if (e && e.active) alle.push(e); });
    if (alle.length < 2) return { fehler: 'nur ' + alle.length + ' Gegner' };

    var px = player.x, py = player.y;
    var r = Math.round(window.getSpinRange());
    var g1 = alle[0], g2 = alle[1];
    g1.x = px + 30;      g1.y = py;   // im Wirbel
    // Standard: knapp ausserhalb des Wirbels. Mit dem Argument weite steht g2 stattdessen
    // genau so viele Pixel von g1 entfernt — damit laesst sich pruefen, wie
    // weit die Kette wirklich reicht.
    var _weite = ${typeof weite === 'number' ? weite : 'null'};
    g2.x = (_weite === null) ? (px + r + 8) : (px + 30 + _weite);
    g2.y = py;
    for (var j = 2; j < alle.length; j++) { alle[j].x = px + 3000; alle[j].y = py + 3000; }
    alle.forEach(function (g) {
      if (g.body && g.body.reset) g.body.reset(g.x, g.y);
      g.hp = 99999; g.maxHp = 99999;
    });
    // Spuerbarer Schaden, damit die HALBE Kette sichtbar wird, und die Sperre
    // zuruecksetzen, damit jeder Durchgang wirklich wirbelt.
    weaponDamage = 100;
    // Krit AUS. Er verdoppelt einzelne Treffer, und ob der Wirbel oder der
    // Sprung ihn erwischt, ist Zufall — der Anteil waere dann mal 0,5, mal
    // 0,25, mal 1,0. Genau daran ist der Test im Gesamtlauf gefallen,
    // waehrend er einzeln zwanzigmal durchlief.
    playerCritChance = 0;
    isSpinning = false; lastSpinTime = -999999;

    var imWirbel = 0;
    window.forEachEnemyInRange(r, function () { imWirbel++; }, { requireLineOfSight: true });
    var vor = [g1.hp, g2.hp];
    // Meldungen mitschneiden: der Toast ist das, was man im Spiel sieht.
    var meldungen = [];
    var ES = window.EventSystem;
    var echt = ES.showToast;
    ES.showToast = function (s, text, id) { meldungen.push(String(text)); };
    try { window.spinAttack.call(sc); } finally { ES.showToast = echt; }
    return {
      meldungen: meldungen,
      kettenReichweite: window.KETTEN_REICHWEITE,
      rang: window.skillRang('combat_chain_lightning'),
      reichweite: r, imWirbel: imWirbel,
      abstand: Math.round(Math.hypot(g2.x - g1.x, g2.y - g1.y)),
      vomSpieler: Math.round(Math.hypot(g2.x - px, g2.y - py)),
      schaden: [vor[0] - g1.hp, vor[1] - g2.hp]
    };
  })()`);
}

test('Ohne den Knoten bleibt der zweite Gegner unberuehrt', () => {
  // Die Gegenprobe zuerst: sie beweist, dass die Lage stimmt. Traefe der Wirbel
  // g2 auch ohne den Knoten, sagte der Test danach nichts aus.
  const r = wirbeln(false);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.rang, 0, 'der Knoten ist schon investiert');
  assert.ok(r.vomSpieler > r.reichweite,
    'g2 steht mit ' + r.vomSpieler + ' px INNERHALB des Wirbels (' + r.reichweite + ' px)');
  assert.ok(typeof r.kettenReichweite === 'number' && r.kettenReichweite > 0,
    'window.KETTEN_REICHWEITE fehlt — der Test wuesste nicht, wie weit die Kette springt');
  assert.ok(r.abstand < r.kettenReichweite,
    'g2 steht ' + r.abstand + ' px von g1 entfernt, ausserhalb der Kettenreichweite ('
    + r.kettenReichweite + ')');
  assert.ok(r.schaden[0] > 0, 'schon der Wirbel selbst richtet nichts an');
  assert.strictEqual(r.schaden[1], 0,
    'g2 nimmt ' + r.schaden[1] + ' Schaden, obwohl kein Kettenblitz investiert ist');
  assert.ok(!r.meldungen.some((t) => t.indexOf('Kettenblitz') >= 0),
    'ohne investierten Knoten meldet sich trotzdem ein Sprung: ' + JSON.stringify(r.meldungen));
});

test('Mit dem Knoten springt der Blitz auf den zweiten Gegner', () => {
  const r = wirbeln(true);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.rang, 1, 'der Knoten liess sich nicht investieren');
  assert.ok(r.schaden[1] > 0,
    'g2 nimmt keinen Schaden — die Kette springt nicht');
});

test('Der Sprung macht die HALBE Wirbelwirkung', () => {
  // 50 % steht so im Code. Ein Sprung, der genauso hart trifft wie der Wirbel,
  // waere eine stille Verdopplung des Knotens.
  const r = wirbeln(true);
  assert.ok(!r.fehler, r.fehler);
  const anteil = r.schaden[1] / r.schaden[0];
  assert.ok(Math.abs(anteil - 0.5) < 0.1,
    'der Sprung macht ' + (anteil * 100).toFixed(0) + ' % statt 50 %'
    + '  (' + r.schaden[0] + ' gegen ' + r.schaden[1] + ')');
});

test('Ein Sprung meldet sich — sonst sieht man ihn im Spiel nicht', () => {
  // Die blaue Linie liegt 200 ms lang zwischen zwei Gegnern, mitten im Wirbel.
  // Genau deshalb kam die Meldung "Kettenblitz funktioniert glaubs noch nicht":
  // er sprang, aber nichts sagte es. Der Toast sagt es.
  //
  // Die Gegenprobe steht im ersten Test: dort ist der Knoten noch nicht
  // investiert, und dort darf sich nichts melden. Hier waere sie wertlos —
  // der Wissensbaum behaelt seinen Stand ueber die Tests hinweg.
  const mit = wirbeln(true);
  assert.ok(!mit.fehler, mit.fehler);
  assert.ok(mit.meldungen.some((t) => t.indexOf('Kettenblitz') >= 0),
    'kein Toast beim Sprung — gemeldet wurde: ' + JSON.stringify(mit.meldungen));
});

test('Der Blitz springt weiter als die alten 120 px', () => {
  // Bei 120 px mussten zwei Gegner fast aneinander stehen; im Spiel sah man den
  // Sprung praktisch nie. Diese Probe steht auf 200 px — sie faellt, sobald die
  // Reichweite wieder unter diesen Abstand rutscht.
  const r = wirbeln(true, 200);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.abstand, 200, 'g2 steht ' + r.abstand + ' px von g1, nicht 200');
  assert.ok(r.vomSpieler > r.reichweite,
    'g2 steht mit ' + r.vomSpieler + ' px INNERHALB des Wirbels (' + r.reichweite + ' px)');
  assert.ok(r.schaden[1] > 0,
    'ueber ' + r.abstand + ' px springt der Blitz nicht (Reichweite '
    + r.kettenReichweite + ')');
});

test('Der Kettenblitz haengt am WIRBEL, nicht am Grundangriff', () => {
  // Der wahrscheinlichste Grund, ihn fuer kaputt zu halten: er feuert nur beim
  // Wirbel. Wer ihn nicht benutzt, sieht nie einen Blitz.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'player.js'), 'utf8');
  const i = quelle.indexOf('function spinAttack()');
  const j = quelle.indexOf('function ', i + 10);
  assert.ok(i > 0 && j > i, 'spinAttack nicht gefunden');
  assert.ok(quelle.slice(i, j).indexOf('combat_chain_lightning') > 0,
    'der Kettenblitz steht nicht mehr im Wirbel');
});
