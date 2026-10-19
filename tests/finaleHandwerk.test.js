// tests/finaleHandwerk.test.js — die Esse als Handwerk (Story-Kern v6.1, Stufe 3).
//
// Der erhobene Hammer und der letzte Schlag sind eine Halte-Aktion an der
// Esse (js/finaleHandwerk.js). Hier, was sie tragen muss:
//   * ein kurzer Druck reicht nicht, ohne Halten faellt der Hammer zurueck
//   * auf dem Handy haelt man den Aktionsknopf (echte Beruehrung)
//   * das E an der Esse loest nicht nebenbei die Faehigkeit auf Slot 3 aus
//   * ein offener Dialog haelt die Aktion an
//   * die Richtung: 'erneuern' haelt bei der Erkenntnis an, 'loesen' geht durch
//   * ?finale=<schritt> springt an jede Stelle (docs/debug-modus.md)
// Gespielt in der echten Finalarena (DieQuelle, die Glut ist die Esse).

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
const GSC = "window.game.scene.getScene('GameScene')";

before(async () => {
  H = await launchDungeon({ depth: 30, zusatz: '&debug=1&room=DieQuelle' });
  H.run(`(function () {
    var sc = ${GSC};
    window._playerInvincible = true;
    if (!window.attackBtn && typeof window.initMobileControls === 'function') window.initMobileControls(sc);
    window.__beruehre = function (x, y, an) {
      var m = window.game.input;
      var t = { target: window.game.canvas, identifier: 11, pageX: x, pageY: y, clientX: x, clientY: y };
      if (an) m.onTouchStart({ target: window.game.canvas, changedTouches: [t], touches: [t], timeStamp: Date.now(), preventDefault: function () {} });
      else m.onTouchEnd({ target: window.game.canvas, changedTouches: [t], touches: [], timeStamp: Date.now(), preventDefault: function () {} });
    };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  taste(false);
  H.lab.clearEnemies();
  H.run(`(function () { var sc = ${GSC};
    if (sc.__testHalt) { sc.__testHalt.abbrechen(); sc.__testHalt = null; }
    window.__MOBILE_INTERACT_HELD__ = false; })()`);
});

function taste(an, justDown) {
  H.run(`(function () { var k = ${GSC}.input.keyboard.addKey('E', false); k.isDown = ${!!an}; k._justDown = ${!!justDown}; })()`);
}
function neueAktion(richtung) {
  H.run(`(function () { var sc = ${GSC};
    window.__erkannt = 0; window.__losgelassen = 0; window.__fertig = 0;
    sc.__testHalt = window.FinaleHandwerk.halten(sc, { richtung: '${richtung}',
      beiErkenntnis: function () { window.__erkannt++; },
      beiLoslassen: function () { window.__losgelassen++; },
      beiFertig: function () { window.__fertig++; } });
    var h = sc.__testHalt;
    player.setPosition(h.x, h.y + 20); player.body.reset(player.x, player.y);
  })()`);
  H.step(2);
}
const zustand = () => H.run(`(function () { var h = ${GSC}.__testHalt;
  return h ? { phase: h.phase, f: h.fortschritt, erkannt: window.__erkannt, los: window.__losgelassen, fertig: window.__fertig } : null; })()`);

test('Die Esse ist die Glut der Finalarena', () => {
  const r = H.run(`(function () { var sc = ${GSC}, g = sc._quelleGlow, o = window.FinaleHandwerk.ort(sc);
    return { glut: !!(g && g.active), gleich: !!g && o.x === g.x && o.y === g.y }; })()`);
  assert.strictEqual(r.glut, true, 'keine Glut in der Arena (room=DieQuelle)');
  assert.strictEqual(r.gleich, true, 'die Halte-Aktion steht nicht an der Glut');
});

test('Ein kurzer Druck hebt den Hammer nicht, ohne Halten faellt er zurueck', () => {
  neueAktion('erneuern');
  taste(true);
  H.step(12);                 // ~0,2 s
  taste(false);
  const kurz = zustand();
  assert.ok(kurz.f > 0 && kurz.f < 0.15, 'ein kurzer Druck: ' + JSON.stringify(kurz));
  H.step(60);
  const danach = zustand();
  assert.strictEqual(danach.f, 0, 'der Hammer bleibt ohne Halten oben: ' + JSON.stringify(danach));
  assert.strictEqual(danach.erkannt, 0);
  // Weit weg von der Esse zaehlt Halten nicht.
  H.run('player.setPosition(player.x + 400, player.y); player.body.reset(player.x, player.y)');
  taste(true);
  H.step(60);
  assert.strictEqual(zustand().f, 0, 'Halten wirkt auch fern der Esse');
  assert.strictEqual(zustand().phase, 'hingehen');
});

test('Erneuern: halten bis zur Erkenntnis, dort steht es, bis losgelassen wird', () => {
  neueAktion('erneuern');
  taste(true);
  let z = zustand();
  let bilder = 0;
  for (; bilder < 600 && z.phase !== 'erkannt'; bilder++) { H.step(1); z = zustand(); }
  assert.strictEqual(z.phase, 'erkannt');
  assert.strictEqual(z.erkannt, 1);
  // DAUER_MS * ERKENNEN_BEI bei 60 Bildern je Sekunde, mit etwas Luft.
  const soll = H.run('window.FinaleHandwerk.DAUER_MS * window.FinaleHandwerk.ERKENNEN_BEI / 16.666');
  assert.ok(Math.abs(bilder - soll) < 12, bilder + ' Bilder bis zur Erkenntnis, erwartet ~' + Math.round(soll));
  H.step(120);
  assert.strictEqual(zustand().los, 0, 'weiter halten fuehrt weiter');
  taste(false);
  H.step(3);
  z = zustand();
  assert.strictEqual(z.phase, 'losgelassen');
  assert.strictEqual(z.los, 1);
});

test('Loslassen zaehlt erst, wenn der Moment gestanden hat', () => {
  neueAktion('erneuern');
  taste(true);
  for (let i = 0; i < 600 && zustand().phase !== 'erkannt'; i++) H.step(1);
  taste(false);
  H.step(5);                  // ~80 ms, unter LOSLASSEN_AB_MS
  assert.strictEqual(zustand().phase, 'erkannt', 'wer im Moment schon loslaesst, ueberspringt ihn');
  H.step(40);
  assert.strictEqual(zustand().phase, 'losgelassen');
});

test('Loesen: dieselbe Bewegung geht bis zum Ende, die Pfeile zeigen hinaus', () => {
  neueAktion('loesen');
  taste(true);
  let z = zustand();
  for (let i = 0; i < 400 && z.phase !== 'fertig'; i++) { H.step(1); z = zustand(); }
  assert.strictEqual(z.phase, 'fertig');
  assert.strictEqual(z.fertig, 1);
  assert.strictEqual(z.erkannt, 0, 'beim Loesen kommt die Erkenntnis noch einmal');
});

test('Ein offener Dialog haelt die Aktion an', () => {
  neueAktion('erneuern');
  taste(true);
  H.step(30);
  const vor = zustand().f;
  H.run(`window.EventSystem.showEventChoiceDialog(${GSC}, 'Test', [{ label: 'Weiter', callback: function () {} }])`);
  H.step(60);
  assert.strictEqual(zustand().f, vor, 'der Hammer steigt hinter dem Dialog weiter');
  H.run(`(function () { var k = ${GSC}.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled; })[0]; k.emit('pointerdown'); })()`);
  H.step(30);
  assert.ok(zustand().f > vor, 'nach dem Dialog geht es nicht weiter');
});

test('Das E an der Esse loest nicht die Faehigkeit auf Slot 3 aus', () => {
  const id = H.run(`(function () {
    var AS = window.AbilitySystem;
    var d = AS.getAllAbilityDefs().filter(function (x) { return x.cooldownMs && typeof x.activate === 'function'; })[0];
    AS.learnAbility(d.id, { silent: true }); AS.setSlot('slot3', d.id); AS.resetCooldown(d.id);
    window.InputScheme.setScheme && window.InputScheme.setScheme('classic');
    return d.id; })()`);
  const rest = () => H.run(`window.AbilitySystem.getCooldownRemaining('${id}', window.gameNow(${GSC}))`);
  // Gegenprobe fern der Esse: derselbe Druck feuert die Faehigkeit.
  neueAktion('erneuern');
  H.run('player.setPosition(player.x + 400, player.y); player.body.reset(player.x, player.y)');
  H.step(2);
  taste(true, true);
  H.run(`${GSC}.input.keyboard.emit('keydown-E', { key: 'e' })`);
  H.step(2);
  taste(false);
  assert.ok(rest() > 0, 'Gegenprobe: E fern der Esse feuert die Faehigkeit nicht');
  H.run(`window.AbilitySystem.resetCooldown('${id}')`);
  H.step(30);
  // An der Esse: der Druck gehoert dem Hammer.
  H.run(`(function () { var h = ${GSC}.__testHalt; player.setPosition(h.x, h.y + 20); player.body.reset(player.x, player.y); })()`);
  H.step(2);
  taste(true, true);
  H.run(`${GSC}.input.keyboard.emit('keydown-E', { key: 'e' })`);
  H.step(2);
  assert.strictEqual(rest(), 0, 'das E an der Esse feuert die Faehigkeit auf Slot 3');
  assert.ok(zustand().f > 0, 'und hebt den Hammer nicht');
  taste(false);
  H.run(`window.AbilitySystem.setSlot('slot3', null)`);
});

test('Handy: den Aktionsknopf halten hebt den Hammer, loslassen laesst ihn fallen', () => {
  neueAktion('erneuern');
  H.lab.clearEnemies();
  H.step(2);
  const knopf = H.run('(function () { var b = window.attackBtn; return b ? { x: b.x, y: b.y } : null; })()');
  assert.ok(knopf, 'kein Aktionsknopf (initMobileControls)');
  assert.strictEqual(H.run(`window.hasPeacefulTarget(${GSC})`), true,
    'an der Esse ist der Knopf keine Aktion (Prompt oder unsichtbarer Boss zaehlt als Gegner)');
  H.run(`window.__beruehre(${knopf.x}, ${knopf.y}, true)`);
  for (let i = 0; i < 60; i++) H.step(1);
  const gehalten = zustand();
  assert.strictEqual(H.run('!!window.__MOBILE_INTERACT_HELD__'), true, 'der Knopf meldet kein Halten');
  assert.ok(gehalten.f > 0.25, 'Halten auf dem Handy hebt den Hammer nicht: ' + JSON.stringify(gehalten));
  for (let i = 0; i < 400 && zustand().phase !== 'erkannt'; i++) H.step(1);
  assert.strictEqual(zustand().phase, 'erkannt');
  H.run(`window.__beruehre(${knopf.x}, ${knopf.y}, false)`);
  H.step(40);
  assert.strictEqual(H.run('!!window.__MOBILE_INTERACT_HELD__'), false);
  assert.strictEqual(zustand().phase, 'losgelassen', 'Loslassen auf dem Handy fuehrt nicht weiter');
});

test('Ein unsichtbarer Gegner macht den Aktionsknopf nicht zum Angriff', () => {
  // Elara steht waehrend der Buehne schon (unsichtbar) im Raum.
  neueAktion('erneuern');
  H.lab.clearEnemies();
  H.run(`(function () { var e = spawnEnemy.call(${GSC}, player.x + 40, player.y, 1); e.setPosition(player.x + 40, player.y); e.setVisible(false); window.__unsichtbar = e; })()`);
  H.step(2);
  assert.strictEqual(H.run(`window.hasPeacefulTarget(${GSC})`), true);
  H.run('window.__unsichtbar.setVisible(true)');
  assert.strictEqual(H.run(`window.hasPeacefulTarget(${GSC})`), false, 'Gegenprobe: ein sichtbarer Gegner zaehlt');
  H.run('window.__unsichtbar.destroy()');
});

test('Debug: ?finale= kennt jeden Schritt', () => {
  const schritte = H.run('window.Finale.DEBUG_SCHRITTE');
  assert.deepStrictEqual(Array.from(schritte), ['hammer', 'erkenntnis', 'harren', 'kampf', 'raub', 'zonen', 'echos', 'schlag', 'loesen']);
  const doku = require('fs').readFileSync(require('path').join(__dirname, '..', 'docs', 'debug-modus.md'), 'utf8');
  for (const s of schritte) assert.ok(doku.indexOf('finale=' + s) >= 0, 'docs/debug-modus.md nennt finale=' + s + ' nicht');
});
