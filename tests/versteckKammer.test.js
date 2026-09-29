// tests/versteckKammer.test.js — Elaras Kammer: Einrichtung und Abraeumen.
//
// Die Kammer wird mit zwei losen `scene.add.graphics()` gezeichnet. Die
// haengen an keiner Gruppe, die enterRoom leert — und niemand hat sie je
// zerstoert. Folge: Elaras Schlaflager, ihr Tisch und die Zettelwand standen
// im NAECHSTEN Raum mitten im Gang. Dasselbe galt fuer das Leuchten der
// Quelle in der Finalarena.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => { H = await launchDungeon({ depth: 6 }); });
after(async () => { if (H) await H.shutdown(); });

/** Zeichnet die Kammer in den laufenden Raum und zaehlt, was dazukam. */
function kammerZeichnen() {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var vorher = sc.children.list.length;
    _versteckZeichnen(sc, 900, 700);
    return { neu: sc.children.list.length - vorher,
      deko: Array.isArray(sc._versteckDeko) ? sc._versteckDeko.length : (sc._versteckDeko ? 1 : 0) };
  })()`);
}

const dekoLebt = () => H.run(`(function () {
  var sc = window.game.scene.getScene('GameScene');
  var d = sc._versteckDeko;
  if (!d) return 0;
  return (Array.isArray(d) ? d : [d]).filter(function (o) { return o && o.active !== false && o.scene; }).length;
})()`);

test('Die Kammer wird in zwei Ebenen gezeichnet — Boden und Aufbauten getrennt', () => {
  // Flach uebereinander sieht sie aus wie ein Aufkleber. Der Teppich muss
  // unter das Schlaflager, der Lichtschacht unter die Kerzen.
  const r = kammerZeichnen();
  assert.strictEqual(r.deko, 2, 'die Kammer haengt nicht an zwei Ebenen');
  const t = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    return sc._versteckDeko.map(function (o) { return o.depth; });
  })()`);
  const tiefen = Array.from(t);
  assert.ok(tiefen[0] < tiefen[1],
    'Boden und Aufbauten liegen auf derselben Ebene: ' + JSON.stringify(tiefen));
  const grenze = H.run('window.WELT_TIEFEN.BODENDEKO_MAX');
  assert.ok(tiefen[0] < grenze, 'die Bodenebene liegt ueber der Bodendeko-Grenze');
  assert.ok(tiefen[1] >= grenze, 'die Aufbauten liegen unter der Bodendeko-Grenze');
});

test('Der Raumwechsel raeumt die Kammer ab', () => {
  kammerZeichnen();
  assert.ok(dekoLebt() > 0, 'die Kammer steht gar nicht');
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enterRoom(sc, (sc.currentRoom && typeof sc.currentRoom.id === 'number') ? sc.currentRoom.id + 1 : 1);
  })()`);
  assert.strictEqual(dekoLebt(), 0,
    'Elaras Einrichtung steht noch im naechsten Raum');
  assert.strictEqual(H.run('!!window.game.scene.getScene("GameScene")._versteckDeko'), false,
    'das Feld zeigt noch auf zerstoerte Objekte');
});

test('Das Leuchten der Quelle wird genauso abgeraeumt', () => {
  // Derselbe Fehler, dieselbe Stelle: auch _quelleGlow war eine lose Grafik.
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    _quelleZeichnen(sc, 400, 400);
  })()`);
  assert.strictEqual(H.run('!!window.game.scene.getScene("GameScene")._quelleGlow'), true,
    'die Quelle wurde nicht gezeichnet');
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enterRoom(sc, (sc.currentRoom && typeof sc.currentRoom.id === 'number') ? sc.currentRoom.id + 1 : 1);
  })()`);
  assert.strictEqual(H.run('!!window.game.scene.getScene("GameScene")._quelleGlow'), false,
    'das Leuchten der Quelle steht noch im naechsten Raum');
});

test('Zweimal zeichnen haeuft nichts an', () => {
  // Wer die Kammer zweimal betritt, soll nicht zwei Teppiche uebereinander
  // bekommen. Das Abraeumen laeuft ueber enterRoom, also muss es dazwischen
  // greifen — sonst waechst die Szene mit jedem Besuch.
  const erste = kammerZeichnen().neu;
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enterRoom(sc, (sc.currentRoom && typeof sc.currentRoom.id === 'number') ? sc.currentRoom.id + 1 : 1);
  })()`);
  const zweite = kammerZeichnen().neu;
  assert.strictEqual(zweite, erste, 'der zweite Besuch legt mehr an als der erste');
  assert.strictEqual(dekoLebt(), 2, 'nach dem zweiten Besuch haengen nicht genau zwei Ebenen');
});
