// tests/versteckRaum.test.js — Elaras Kammer eingerichtet, hinter
// fest seit b389 (#192, frueher ?versteckraum=neu).
//
// Statt der gezeichneten Flaechen und der Lagerkisten der Vorlage: Lager,
// Werkbank, Kartenwand, Notizen, Regal, Kerzen, Buecher, Teppich, Hocker und
// der Vorhang vor der versteckten Ecke (PixelLab-Bilder). Geprueft wird, dass
// alles steht, dass kein Stueck den Weg zu Elara oder zur Treppe abschneidet,
// dass das Kerzenlicht flackert und dass sich die Stuecke gegen den Spieler
// sortieren. Ohne Flagge bleibt die Kammer wie bisher (versteckKammer.test.js).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launchDungeon({ depth: 3, zusatz: '&debug=1&versteck=1' });
  H.run('window._playerInvincible = true');
});
after(async () => { if (H) await H.shutdown(); });

/** Betritt die Kammer neu; optional mit einem zusaetzlichen Stueck. */
function kammer(zusatz) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var extra = ${JSON.stringify(zusatz || null)};
    if (extra) VERSTECK_EINRICHTUNG.push(extra);
    try { enterRoom(sc, 0); } finally { if (extra) VERSTECK_EINRICHTUNG.pop(); }
    var bilder = sc.children.list.filter(function (o) {
      return o.active && o.texture && /^versteck_/.test(o.texture.key);
    }).map(function (o) { return o.texture.key.slice(9); });
    var lager = (obstacles.getChildren() || []).filter(function (o) {
      return o.active && o.texture && /crate|barrel|brazier|rubble|kiste|fass/i.test(o.texture.key);
    }).length;
    return { name: sc.currentRoom && sc.currentRoom.name, bilder: bilder, lager: lager };
  })()`);
}

test('Mit Flagge steht die Einrichtung, die Lagerkisten der Vorlage sind weg', () => {
  const r = kammer();
  assert.strictEqual(r.name, 'ElarasVersteck');
  ['bett', 'werkbank', 'kartenwand', 'notizen', 'regal', 'kerzen_teller', 'kerzen_boden',
    'buecher', 'vorhang', 'teppich', 'hocker', 'tisch', 'kartenkiste', 'vorraete',
    'waffenstaender', 'leuchter'].forEach(function (n) {
    assert.ok(r.bilder.includes(n), 'es fehlt: ' + n + ' (da: ' + r.bilder.join(', ') + ')');
  });
  assert.strictEqual(r.lager, 0, 'Kisten/Faesser der Vorlage stehen noch in der Kammer');
});

test('Elara steht vor ihrer Kartenwand, in Spielerhoehe', () => {
  kammer();
  const e = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var e = sc.children.list.filter(function (o) { return o.active && o.texture && o.texture.key === 'elara_right0'; }).pop();
    if (!e) return null;
    var f = figurGrenzen(sc, 'elara_right0');
    return { x: e.x, y: e.y, hoehe: f.boundsHeight * e.scaleY };
  })()`);
  assert.ok(e, 'Elara steht nicht in der Kammer');
  assert.deepStrictEqual([e.x, e.y], [420, 168]);
  assert.ok(Math.abs(e.hoehe - 54) < 3, 'Elara ist ' + e.hoehe + ' px hoch');
});

const wegeFrei = () => H.run(`(function () {
  var sc = window.game.scene.getScene('GameScene');
  var ziele = _versteckZiele(sc);
  return { treppen: ziele.filter(function (z) { return z.treppe; }).length,
    frei: ziele.map(function (z) { return !!sc.isPointAccessible(z.x, z.y); }),
    koerper: obstacles.getChildren().filter(function (o) {
      return o.getData && o.getData('versteckStueck');
    }).map(function (o) { return [o.getData('versteckStueck'), !!(o.body && o.body.enable)]; }) };
})()`);

test('Die Stuecke haben Koerper und lassen den Weg zu Elara und zur Treppe frei', () => {
  kammer();
  const w = wegeFrei();
  assert.ok(w.treppen >= 1, 'keine Treppe in der Kammer');
  assert.ok(w.frei.every(Boolean), 'ein Ziel ist nicht erreichbar: ' + JSON.stringify(w));
  // Im heutigen Grundriss blockiert nichts: alle Koerper bleiben.
  assert.ok(w.koerper.length >= 5, 'zu wenige Koerper: ' + JSON.stringify(w.koerper));
  assert.ok(w.koerper.every(function (k) { return k[1]; }), 'ein Koerper fiel weg: ' + JSON.stringify(w.koerper));
});

test('Ein Stueck, das den Weg zur Treppe verstellt, verliert seinen Koerper', () => {
  // Ein breiter Riegel quer vor die Treppe: ohne die Pruefung waere sie
  // nicht mehr erreichbar.
  const t = H.run(`(function () {
    var s = window.game.scene.getScene('GameScene').stairsGroup.getChildren()[0];
    return { x: Math.round(s.x), y: Math.round(s.y) };
  })()`);
  kammer({ bild: 'bett', x: t.x, y: t.y + 40, ebene: 'steht', fuss: { w: 260, h: 90 } });
  const w = wegeFrei();
  assert.ok(w.frei.every(Boolean), 'die Treppe ist verbaut: ' + JSON.stringify(w));
  assert.ok(w.koerper.some(function (k) { return !k[1]; }), 'kein Koerper wurde abgeschaltet');
  kammer();   // wieder der normale Raum fuer die folgenden Faelle
});

test('Das Kerzenlicht flackert', () => {
  kammer();
  const werte = [];
  for (let i = 0; i < 8; i++) {
    H.step(6);
    werte.push(H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      return sc.children.list.filter(function (o) { return o.active && o.getData && o.getData('versteckLicht'); })
        .map(function (o) { return Math.round(o.alpha * 1000) / 1000; });
    })()`));
  }
  assert.ok(werte[0].length >= 2, 'keine Kerzenlichter: ' + JSON.stringify(werte[0]));
  const erstes = werte.map(function (w) { return w[0]; });
  const spanne = Math.max.apply(null, erstes) - Math.min.apply(null, erstes);
  assert.ok(spanne > 0.03, 'das Licht steht still: ' + JSON.stringify(erstes));
});

test('Hinter der Werkbank steht der Spieler hinter ihr, davor vor ihr', () => {
  kammer();
  function messen(dy) {
    H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var b = sc.children.list.filter(function (o) { return o.active && o.texture && o.texture.key === 'versteck_werkbank'; })[0];
      player.body.enable = false;
      player.x = b.x; player.y = b.y + (${dy});
      player.body.reset(player.x, player.y);
    })()`);
    H.step(3);
    return H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var b = sc.children.list.filter(function (o) { return o.active && o.texture && o.texture.key === 'versteck_werkbank'; })[0];
      var k = sc.children.list.filter(function (o) { return o.active && o.texture && o.texture.key === 'versteck_kerzen_teller'; })[0];
      return { bank: b.depth, kerzen: k.depth, spieler: player.depth };
    })()`);
  }
  const hinten = messen(-24);
  assert.ok(hinten.bank > hinten.spieler, 'die Werkbank liegt unter dem Spieler, der dahinter steht: ' + JSON.stringify(hinten));
  const vorn = messen(+20);
  assert.ok(vorn.bank < vorn.spieler, 'die Werkbank verdeckt den Spieler davor: ' + JSON.stringify(vorn));
  H.run('player.body.enable = true');
});

test('Der Raumwechsel raeumt die Einrichtung samt Koerpern ab', () => {
  kammer();
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.DebugGate.flagge = (function (echt) { return function (n) { return n === 'versteck' ? null : echt.apply(this, arguments); }; })(window.DebugGate.flagge);
    enterRoom(sc, 1);
    return {
      bilder: sc.children.list.filter(function (o) { return o.active && o.texture && /^versteck_/.test(o.texture.key); }).length,
      koerper: obstacles.getChildren().filter(function (o) { return o.active && o.getData && o.getData('versteckStueck'); }).length,
      name: sc.currentRoom && sc.currentRoom.name };
  })()`);
  assert.notStrictEqual(r.name, 'ElarasVersteck', 'der naechste Raum ist wieder die Kammer');
  assert.strictEqual(r.bilder, 0, 'Requisiten stehen im naechsten Raum');
  assert.strictEqual(r.koerper, 0, 'Koerper der Requisiten blockieren den naechsten Raum');
});

test('Licht nur, wo eine Kerze steht; die Bodenkerzen stehen nicht am Tisch', () => {
  // Rueckmeldung: der Tisch leuchtete ohne Kerze, und die Bodenkerzen standen
  // direkt neben ihm statt am Kopfende des Lagers.
  const tab = H.run(`(window.versteckEinrichtung || []).map(function (d) { return { bild: d.bild, x: d.x, y: d.y, licht: !!d.licht }; })`);
  assert.ok(tab.length >= 10, 'Einrichtungstabelle nicht erreichbar');
  const mitLicht = tab.filter((d) => d.licht).map((d) => d.bild).sort();
  assert.strictEqual(mitLicht.join(','), 'kerzen_boden,kerzen_teller,leuchter', 'Licht an: ' + mitLicht.join(', '));
  const k = tab.find((d) => d.bild === 'kerzen_boden'), ti = tab.find((d) => d.bild === 'tisch'), b = tab.find((d) => d.bild === 'bett');
  assert.ok(Math.hypot(k.x - ti.x, k.y - ti.y) >= 120, 'Bodenkerzen nur ' + Math.round(Math.hypot(k.x - ti.x, k.y - ti.y)) + ' px vom Tisch');
  assert.ok(Math.hypot(k.x - b.x, k.y - b.y) <= 70, 'Bodenkerzen nicht beim Lager');
  // Die Kerzen an der Werkstatt stehen frei neben der Werkbank, mit Luft.
  const kt = tab.find((d) => d.bild === 'kerzen_teller'), wb = tab.find((d) => d.bild === 'werkbank');
  const luft = (wb.x - 40) - (kt.x + 16);   // Bildkanten: Werkbank 80 breit, Kerzen 32
  assert.ok(luft >= 8, 'Kerzen nur ' + luft + ' px neben der Werkbank');
});
