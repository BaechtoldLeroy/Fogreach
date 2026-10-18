// tests/altarTiefe.test.js — der Altar im Verteidigungsmodus sortiert sich nach
// Bildhoehe gegen den Spieler (wie der Haendler, #165).
//
// Bis b375 lag der Altar fest auf Tiefe 400 und damit IMMER ueber dem Spieler
// (100): wer vor dem Podest stand, verschwand trotzdem hinter dem Kristall.
// Jetzt gilt: Fuesse des Spielers unterhalb der Unterkante des Altars -> der
// Spieler ist davor; oberhalb -> der Altar verdeckt ihn.
//
// Aufgebaut wird der ECHTE Modus ueber die Registry (RoomMode.create) und
// arm(scene) — genau der Weg, auf dem der Raum den Altar hinstellt (wie
// altarFest.test.js). Gemessen an der sortierten Anzeigeliste der Szene.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launchDungeon({ depth: 3 });
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enemies.clear(true, true);
    window.__altarModus = window.RoomMode.create('defend', {});
    window.__altarModus.arm(sc);
    window.__altarSprite = sc.children.list.filter(function (o) {
      // Der Pixel-Altar (raummodus_altar); die alte Zeichnung nur ohne Bild.
      return o && o.texture && o.texture.key === 'raummodus_altar';
    }).pop();
  })()`);
});
after(async () => {
  if (H) {
    try { H.run('window.__altarModus && window.__altarModus.stop()'); } catch (e) {}
    await H.shutdown();
  }
});

// Spieler seitlich neben das Podest (sein Koerper beruehrt den Altar-Koerper
// nicht, die Bilder decken sich aber), Fuesse dy Pixel unter (+) bzw. ueber
// (-) der Unterkante des Altars. Ein Bild takten, dann die Liste lesen.
//
// Die Seite wird gesucht, nicht fest rechts genommen: der Raum ist zufaellig,
// und in jedem neunten Lauf (gemessen mit festen Startwerten) stand dort eine
// Saeule, Wand oder Feuerschale. Der Spieler wurde aus ihr geschoben, meist
// genau auf die Fusslinie des Altars — "Aufbau: Spieler steht nicht
// unterhalb", ein Gesamtlauf-Flattern ohne Bezug zur Sortierung. Gilt der
// Aufbau nach dem Takten nicht, kommt die naechste Seite dran. Der Altar
// sortiert nur nach der Fusslinie, der Abstand zur Seite aendert daran nichts.
const SEITEN = [45, -45, 60, -60];
function spielerAmAltar(dy) {
  let r = null;
  for (const seite of SEITEN) {
    r = spielerNeben(seite, dy);
    if (dy > 0 ? r.fussSpieler > r.fussAltar : r.fussSpieler < r.fussAltar) return r;
  }
  return r;
}
function spielerNeben(seite, dy) {
  H.run(`(function () {
    var a = window.__altarSprite;
    player.x = a.x + (${seite}); player.y = a.y + a.displayHeight * (1 - a.originY) + (${dy});
    if (player.body) { player.body.reset(player.x, player.y); }
  })()`);
  H.step(16);
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var liste = sc.sys.displayList;
    function platz(o) {
      var oben = o;
      while (oben && oben.displayList && oben.displayList !== liste) oben = oben.displayList;
      while (oben && oben.parentContainer) oben = oben.parentContainer;
      return liste.getIndex(oben);
    }
    var a = window.__altarSprite;
    liste.depthSort();
    return { spieler: platz(player), altar: platz(a),
             fussSpieler: player.y, fussAltar: a.y + a.displayHeight * (1 - a.originY),
             spielerTiefe: player.depth, altarTiefe: a.depth,
             gegner: sc.enemyLayer ? platz(sc.enemyLayer) : -1, seite: ${seite} };
  })()`);
}

test('der Altar steht bereit', () => {
  assert.ok(H.run('!!(window.__altarSprite && window.__altarSprite.active)'), 'kein Altar nach arm()');
});

test('Spieler unterhalb des Altars: er wird vor dem Altar gezeichnet', () => {
  const r = spielerAmAltar(+15);
  assert.ok(r.spieler >= 0 && r.altar >= 0, 'nicht in der Anzeigeliste: ' + JSON.stringify(r));
  assert.ok(r.fussSpieler > r.fussAltar, 'Aufbau: Spieler steht nicht unterhalb: ' + JSON.stringify(r));
  assert.ok(r.spieler > r.altar, 'der Altar verdeckt den Spieler, der davor steht: ' + JSON.stringify(r));
  assert.strictEqual(r.spielerTiefe, 100, 'der Spieler soll seine feste Tiefe behalten');
});

test('Spieler oberhalb (hinter) dem Altar: der Altar wird vor ihm gezeichnet', () => {
  const r = spielerAmAltar(-15);
  assert.ok(r.spieler >= 0 && r.altar >= 0, 'nicht in der Anzeigeliste: ' + JSON.stringify(r));
  assert.ok(r.fussSpieler < r.fussAltar, 'Aufbau: Spieler steht nicht oberhalb: ' + JSON.stringify(r));
  assert.ok(r.altar > r.spieler, 'der Spieler liegt ueber dem Altar, obwohl er dahinter steht: ' + JSON.stringify(r));
  // Die Gegner bleiben im Layer; der Altar rutscht nicht unter sie.
  assert.ok(r.altar > r.gegner, 'Altar unter dem Gegnerlayer: ' + JSON.stringify(r));
  // Und wieder nach vorn: je Bild nachgefuehrt.
  const zurueck = spielerAmAltar(+15);
  assert.ok(zurueck.spieler > zurueck.altar, 'nach dem Zuruecklaufen bleibt der Altar vorn: ' + JSON.stringify(zurueck));
});

test('stop() meldet die Nachfuehrung wieder ab', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var vorher = sc.events.listenerCount('postupdate');
    window.__altarModus.stop();
    return { vorher: vorher, nachher: sc.events.listenerCount('postupdate') };
  })()`);
  assert.strictEqual(r.nachher, r.vorher - 1, JSON.stringify(r));
});
