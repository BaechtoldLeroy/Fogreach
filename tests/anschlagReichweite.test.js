// tests/anschlagReichweite.test.js — die Tafeln muessen erreichbar sein.
//
// Im gemalten Hub standen die Tafeln dicht beiderseits der Rathaustreppe, die
// Tuer direkt darueber. Die Reichweite stand als blanke `90` im Code und
// wurde gegen WELT-Abstaende geprueft; zwischen den Tafeln blieb eine tote
// Zone, und wer dort [E] drueckte, bekam nichts.
//
// Im gekachelten Platz (#181, seit b334) stehen sie an der Stuetzmauer,
// 352 px auseinander, dazwischen Klerus, Treppe und Garde; die Tuer liegt
// oben auf dem Vorplatz. Die Pruefung "keine tote Zone zwischen den Tafeln"
// beschrieb die alte Lage und ist ersetzt durch das, was sie eigentlich
// wollte: wer zur Tafel geht, spricht die Tafel an. Wie fair die Tafeln
// gegen benachbarte NPC antreten, prueft tests/hubNeu.test.js.

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

test('Vor jeder Tafel ist die Tafel ansprechbar', () => {
  // Ein Schritt vor ihrem Fuss — dort, wo man stehen bleibt, um zu lesen.
  const s = tafeln();
  const falsch = [];
  s.forEach((t, i) => {
    const typ = beiX(Math.round(t.x), Math.round(t.y) + 30);
    if (typ !== 'anschlag') falsch.push('Tafel ' + i + ': ' + typ);
  });
  assert.deepStrictEqual(falsch, [], 'vor der Tafel ist etwas anderes aktiv: ' + falsch.join('; '));
});

test('Die Tafeln stehen links und rechts der Freitreppe', () => {
  // "Vor dem Rathaus", wie die Edikt-Quest sagt: die Treppe liegt dazwischen.
  const s = tafeln();
  const K = H.run(`(function () { var K = window.HUB_NEU_KARTE;
    return { a: K.terrasse.treppeX * K.kachel, b: (K.terrasse.treppeX + K.terrasse.treppeB) * K.kachel }; })()`);
  assert.ok(s[0].x < K.a && s[1].x > K.b, 'die Treppe (' + K.a + '-' + K.b + ') liegt nicht zwischen den Tafeln');
});

test('Weit weg ist nichts ansprechbar', () => {
  // Gegenprobe: waere alles immer ansprechbar, sagte der Test oben nichts.
  const s = tafeln();
  assert.strictEqual(beiX(Math.round(s[0].x) - 600, Math.round(s[0].y)), null,
    'weit links von den Tafeln ist immer noch etwas ansprechbar');
});
