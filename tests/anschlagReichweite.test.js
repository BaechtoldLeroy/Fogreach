// tests/anschlagReichweite.test.js — die Tafeln muessen erreichbar sein.
//
// Die Reichweite stand als blanke `90` im Code und wurde gegen WELT-Abstaende
// geprueft — die Lage der Tafeln ist aber in Layout-Einheiten angegeben und
// mit SCALE_FACTOR (1.6) skaliert. Die Tafeln reichten damit 90 statt 144 px
// weit, und genau zwischen ihnen blieb eine tote Zone von rund 40 px: dort,
// wo man zur Rathaustreppe hochlaeuft, tat [E] nichts.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'HubSceneV2 nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

/** Was ist ansprechbar, wenn der Spieler dort steht? */
function beiX(x, y) {
  return H.run(`(function () {
    var hub = window.game.scene.getScene('HubSceneV2');
    if (hub.player.body && hub.player.body.reset) hub.player.body.reset(${x}, ${y});
    hub.player.x = ${x}; hub.player.y = ${y};
    hub._updateInteractionPrompt ? hub._updateInteractionPrompt() : (hub._refreshInteractionPrompt && hub._refreshInteractionPrompt());
    var a = hub._activeInteractable;
    return a ? a.type : null;
  })()`);
}

const tafeln = () => H.run(`(function () {
  var hub = window.game.scene.getScene('HubSceneV2');
  var s = hub._hubPhaseRefs && hub._hubPhaseRefs.posterSpots;
  return s ? s.map(function (p) { return { x: p.x, y: p.y }; }) : null;
})()`);

test('Beide Tafeln sind da und stehen links und rechts der Treppe', () => {
  const s = tafeln();
  assert.ok(s, 'keine posterSpots');
  assert.strictEqual(s.length, 2, 'es sind ' + s.length + ' Tafeln');
  assert.ok(s[1].x > s[0].x, 'die beiden liegen nicht nebeneinander');
});

test('Zwischen den Tafeln gibt es keine tote Zone', () => {
  // Der eigentliche Fehler: genau in der Mitte war weder die eine Tafel noch
  // die andere in Reichweite, und der Rathaus-Eingang liegt ein paar Pixel
  // tiefer. Wer dort [E] drueckte, bekam nichts.
  const s = tafeln();
  const y = s[0].y - 10;
  const mitte = Math.round((s[0].x + s[1].x) / 2);
  const tot = [];
  for (let x = Math.round(s[0].x); x <= Math.round(s[1].x); x += 12) {
    if (beiX(x, y) === null) tot.push(x);
  }
  assert.deepStrictEqual(tot, [],
    'tote Stellen zwischen den Tafeln (Mitte ' + mitte + '): ' + tot.join(', '));
});

test('Die Reichweite waechst mit dem Layout-Massstab', () => {
  // Der Kern des Fehlers in einer Zahl: der Abstand der beiden Tafeln ist
  // skaliert, die Reichweite war es nicht. Ist sie kleiner als der halbe
  // Abstand, klafft in der Mitte wieder eine Luecke.
  const s = tafeln();
  const halberAbstand = (s[1].x - s[0].x) / 2;
  // SCALE_FACTOR ist ein Modul-const in HubSceneV2, kein Fensterfeld — ueber
  // window gelesen kaeme 1 heraus, und der Test waere gruen, ohne zu messen.
  const reichweite = H.run(`SCALE_FACTOR * 90`);
  assert.strictEqual(typeof reichweite, 'number', 'SCALE_FACTOR nicht lesbar');
  assert.ok(reichweite >= halberAbstand,
    'Reichweite ' + reichweite + ' deckt den halben Tafelabstand ' + halberAbstand + ' nicht');
});

test('Weit weg ist nichts ansprechbar', () => {
  // Gegenprobe: waere alles immer ansprechbar, sagte der Test oben nichts.
  const s = tafeln();
  assert.strictEqual(beiX(Math.round(s[0].x) - 600, Math.round(s[0].y)), null,
    'weit links von den Tafeln ist immer noch etwas ansprechbar');
});
