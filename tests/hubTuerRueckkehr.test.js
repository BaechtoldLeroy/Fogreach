// tests/hubTuerRueckkehr.test.js — Nach der Schmiede vor ihrer Tuer (#186).
//
// Mit ?tuer=1 kommt man aus einem Gebaeude vor dessen Tuer heraus, nicht am
// Startpunkt in der Platzmitte. Geprueft am echten Weg: die Tuer per
// _enterLocation betreten (wie [E] es tut), in der Schmiede _returnToHub
// (wie ESC/Zurueck es tut), dann messen, wo die Figur steht.
//
// Nur die Schmiede wechselt die Szene. Druckerei und Truhe sind
// Ueberlagerungen ueber dem laufenden Hub, das Rathaus fuehrt in den Dungeon
// — dessen Rueckkehr bleibt am Startpunkt (hier nachgestellt durch einen
// Hub-Start ohne gemerkte Tuer, genau das tut main.js nach dem Dungeon).
//
// Ohne Flagge muss alles bleiben wie vorher: Startpunkt.

const { test } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

async function hubMit(search) {
  const H = await launch({ search: search, renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await H.waitForScene('HubSceneV2', { maxRounds: 250 });
  if (!ok) { await H.shutdown(); throw new Error('HubSceneV2 wurde nicht erreicht'); }
  H.step(20);
  return H;
}

/** Schmiede betreten und wieder verlassen, ueber die Wege des Spiels. */
async function durchDieSchmiede(H) {
  H.run(`(function () {
    var hub = window.game.scene.getScene('HubSceneV2');
    var e = hub.entranceLabels.filter(function (x) { return x.data.id === 'schmiede_entrance'; })[0];
    hub._enterLocation(e.data);
  })()`);
  assert.ok(await H.waitForScene('CraftingScene', { maxRounds: 250 }), 'CraftingScene wurde nicht erreicht');
  H.step(10);
  H.run("window.game.scene.getScene('CraftingScene')._returnToHub()");
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'zurueck im Hub nicht erreicht');
  H.step(30);
}

/** Wo steht die Figur, und was liegt um sie herum? */
function lage(H) {
  return H.run(`(function () {
    var hub = window.game.scene.getScene('HubSceneV2');
    var p = hub.player;
    var r = function (b) { return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    var ueber = function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; };
    var koerper = r(p.body);
    var umriss = r(p.getBounds());
    var feste = hub.colliderGroup.getChildren().map(function (o) { return r(o.body); });
    var tuer = hub.entranceLabels.filter(function (x) { return x.data.id === 'schmiede_entrance'; })[0].zone.getBounds();
    var inZone = hub.entranceLabels.filter(function (x) { return ueber(umriss, r(x.zone.getBounds())); })
      .map(function (x) { return x.data.id; });
    var st = p.getData('animState');
    var start = window.HubNeuWelt.welt().start;
    return {
      x: p.x, y: p.y, start: start,
      abstand: Math.hypot(p.x - tuer.centerX, p.y - tuer.bottom),
      unterTuer: p.y > tuer.bottom,
      inFest: feste.filter(function (f) { return ueber(koerper, f); }).length,
      inZone: inZone,
      richtung: st && st.direction,
      unten: getDirectionFromVelocity(0, 1, '00'),
      ziel: hub._activeInteractable ? (hub._activeInteractable.type + ':' + (hub._activeInteractable.data && hub._activeInteractable.data.id)) : null
    };
  })()`);
}

test('ohne Flagge: zurueck aus der Schmiede am Startpunkt', async () => {
  const H = await hubMit('?autostart=1');
  try {
    await durchDieSchmiede(H);
    const l = lage(H);
    assert.ok(Math.abs(l.x - l.start.x) < 1 && Math.abs(l.y - l.start.y) < 1,
      'ohne ?tuer=1 sollte die Figur am Startpunkt stehen, steht bei ' + l.x + ',' + l.y);
  } finally { await H.shutdown(); }
});

test('?tuer=1: vor der Schmiedetuer, frei und ausserhalb der Tuerzone; Dungeon-Rueckkehr am Start', async () => {
  const H = await hubMit('?autostart=1&tuer=1');
  try {
    await durchDieSchmiede(H);
    const l = lage(H);
    assert.ok(!(Math.abs(l.x - l.start.x) < 1 && Math.abs(l.y - l.start.y) < 1),
      'die Figur steht am Startpunkt, nicht vor der Tuer');
    assert.ok(l.abstand < 120, 'zu weit von der Tuer: ' + Math.round(l.abstand) + ' px');
    assert.ok(l.unterTuer, 'die Figur steht nicht vor (suedlich) der Tuer');
    assert.strictEqual(l.inFest, 0, 'die Figur steckt in einer festen Flaeche');
    assert.deepStrictEqual(Array.from(l.inZone), [], 'die Figur steht in einer Tuerzone: ' + l.inZone);
    assert.ok(!/^entrance:/.test(String(l.ziel)), '[E] zeigt schon wieder auf eine Tuer: ' + l.ziel);
    assert.strictEqual(l.richtung, l.unten, 'Blick nicht vom Haus weg: ' + l.richtung);

    // Ein Hub-Start ohne gemerkte Tuer (so kommt man aus dem Dungeon) endet
    // wieder am Startpunkt — die Tuer gilt nur fuer EINE Rueckkehr.
    H.run("window.game.scene.getScene('HubSceneV2').scene.start('GameScene')");
    assert.ok(await H.waitForScene('GameScene', { maxRounds: 250 }), 'GameScene wurde nicht erreicht');
    H.run("window.game.scene.getScene('GameScene').scene.start('HubSceneV2')");
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nach dem Dungeon nicht erreicht');
    H.step(10);
    const d = lage(H);
    assert.ok(Math.abs(d.x - d.start.x) < 1 && Math.abs(d.y - d.start.y) < 1,
      'nach dem Dungeon sollte die Figur am Startpunkt stehen, steht bei ' + d.x + ',' + d.y);
  } finally { await H.shutdown(); }
});

// Nur die Schmiede fuehrt heute in eine eigene Szene. Damit eine kuenftige
// Gebaeudeszene nicht in einer Wand landet, gilt dieselbe Pruefung fuer
// JEDE Tuer des Platzes (die gemerkte Tuer von Hand gesetzt).
test('?tuer=1: vor jeder Tuer des Platzes ein freier Platz ausserhalb aller Tuerzonen', async () => {
  const H = await hubMit('?autostart=1&tuer=1');
  try {
    const ids = H.run(`window.game.scene.getScene('HubSceneV2').entranceLabels.map(function (e) { return e.data.id; })`);
    assert.ok(ids.length >= 4, 'zu wenige Tueren: ' + ids.length);
    for (const id of Array.from(ids)) {
      H.run(`window.__hubVonEingang = '${id}'; window.game.scene.getScene('HubSceneV2').scene.restart()`);
      H.step(5);
      assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nach Neustart nicht erreicht');
      H.step(30);
      const l = H.run(`(function () {
        var hub = window.game.scene.getScene('HubSceneV2');
        var p = hub.player;
        var r = function (b) { return { x: b.x, y: b.y, w: b.width, h: b.height }; };
        var ueber = function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; };
        var k = r(p.body), u = r(p.getBounds());
        var tuer = hub.entranceLabels.filter(function (x) { return x.data.id === '${id}'; })[0].zone.getBounds();
        var start = window.HubNeuWelt.welt().start;
        return {
          amStart: Math.abs(p.x - start.x) < 1 && Math.abs(p.y - start.y) < 1,
          abstand: Math.hypot(p.x - tuer.centerX, p.y - tuer.bottom),
          inFest: hub.colliderGroup.getChildren().filter(function (o) { return ueber(k, r(o.body)); }).length,
          inZone: hub.entranceLabels.filter(function (x) { return ueber(u, r(x.zone.getBounds())); }).length
        };
      })()`);
      assert.ok(!l.amStart, id + ': die Figur steht am Startpunkt');
      assert.ok(l.abstand < 120, id + ': zu weit von der Tuer: ' + Math.round(l.abstand) + ' px');
      assert.strictEqual(l.inFest, 0, id + ': die Figur steckt in einer festen Flaeche');
      assert.strictEqual(l.inZone, 0, id + ': die Figur steht in einer Tuerzone');
    }
  } finally { await H.shutdown(); }
});
