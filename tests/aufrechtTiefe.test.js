// tests/aufrechtTiefe.test.js — weitere Dinge im Keller sortieren sich nach
// Bildhoehe gegen den Spieler (#165, nach Haendler und Altar in b376).
//
// Ereignisobjekte (Schrein, Brunnen, Elara ...) und Deko-Saeulen lagen fest
// unter dem Spieler (45 bzw. 41): wer hinter dem Schrein oder hinter Elara
// stand, wurde trotzdem ueber sie gezeichnet. Jetzt hebt ein gemeinsamer
// Durchlauf je Szene (window.sortiereZumSpieler, roomTemplates.js) sie vor den
// Spieler, solange er dahinter steht; sonst bleibt ihre gewohnte Tiefe.
//
// Statuen, Saeulen und Altaere als Hindernisse werden bewusst NICHT sortiert:
// ihr Koerper ist ihr Bild, der Spieler kommt nie dahinter. Das prueft der
// vorletzte Test — wird ein Hindernis einmal auf einen Fusskoerper verkleinert,
// faellt er und erinnert an die Sortierung.
//
// Gemessen an der sortierten Anzeigeliste (Layer/Container hochgezaehlt). Die
// Raeume sind zufaellig: Objekte werden gezielt platziert, und waehrend der
// Messung ist der Spielerkoerper abgeschaltet (nichts schiebt ihn weg).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launchDungeon({ depth: 3 });
  // Der Startplatz des Spielers: begehbar, und der Raumbau haelt ihm eine
  // Kachel ringsum von Requisiten frei. Waehrend der Messung ist der
  // Spielerkoerper abgeschaltet (spielerAn), nichts schiebt ihn also weg.
  H.run(`(function () {
    enemies.clear(true, true);
    window.__frei = { x: player.x, y: player.y };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

function ereignisObjekt(key, opts) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var o = Object.assign({ spawnAt: window.__frei }, ${JSON.stringify(opts || {})});
    window.EventSystem.spawnEventObject(sc, '${key}', 0xffffff, 0x8866cc, 'Probe', function () {}, o);
    window.__obj = sc.children.list.filter(function (x) {
      return x && x.active && x.texture && x.texture.key === '${key}';
    }).pop();
    var e = (sc.__tiefenSortierung ? sc.__tiefenSortierung.liste : [])
      .filter(function (x) { return x.o === window.__obj; })[0];
    window.__schein = e && e.b ? e.b[0].o : null;
    return !!window.__obj;
  })()`);
}

// Spieler seitlich ueberlappend ans Objekt, Fuesse dy Pixel unter (+) bzw.
// ueber (-) dessen Unterkante. Ein Bild takten, dann die Liste lesen.
function spielerAn(dy, dx) {
  H.run(`(function () {
    var a = window.__obj;
    player.x = a.x + (${dx || 6}); player.y = a.y + a.displayHeight * (1 - a.originY) + (${dy});
    if (player.body) {
      player.body.reset(player.x, player.y); player.body.setVelocity(0, 0);
      player.body.enable = false;
    }
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
    var a = window.__obj, s = window.__schein;
    liste.depthSort();
    return { spieler: platz(player), obj: platz(a), schein: s ? platz(s) : -1,
             fussSpieler: player.y, fussObj: a.y + a.displayHeight * (1 - a.originY),
             spielerTiefe: player.depth, objTiefe: a.depth,
             gegner: sc.enemyLayer ? platz(sc.enemyLayer) : -1,
             gegnerTiefe: sc.enemyLayer ? sc.enemyLayer.depth : null,
             // Fuer die Fehlersuche: laeuft die Szene, steht das Objekt im Durchlauf?
             pause: sc.scene.isPaused(), aktiv: player.active,
             gelistet: !!(sc.__tiefenSortierung && sc.__tiefenSortierung.liste.some(function (e) { return e.o === a; })),
             spielerBild: [player.displayWidth, player.displayHeight, player.originX, player.originY] };
  })()`);
}

// Hin und zurueck: unterhalb -> Spieler davor; oberhalb -> Objekt davor;
// wieder unterhalb -> Spieler davor. Faellt mit fester Ruhetiefe (Schritt 2)
// und mit fest angehobener Tiefe (Schritt 1).
function hinUndZurueck(name, unten, oben, dx) {
  const a = spielerAn(unten, dx);
  assert.ok(a.spieler >= 0 && a.obj >= 0, name + ': nicht in der Anzeigeliste ' + JSON.stringify(a));
  assert.ok(a.fussSpieler > a.fussObj, name + ': Aufbau, Spieler nicht unterhalb ' + JSON.stringify(a));
  assert.ok(a.spieler > a.obj, name + ' verdeckt den Spieler, der davor steht: ' + JSON.stringify(a));
  assert.strictEqual(a.spielerTiefe, 100, 'der Spieler soll seine feste Tiefe behalten');

  const b = spielerAn(oben, dx);
  assert.ok(b.fussSpieler < b.fussObj, name + ': Aufbau, Spieler nicht oberhalb ' + JSON.stringify(b));
  assert.ok(b.obj > b.spieler, 'der Spieler liegt ueber ' + name + ', obwohl er dahinter steht: ' + JSON.stringify(b));
  assert.strictEqual(b.gegnerTiefe, 50, 'der Gegnerlayer hat seine Tiefe veraendert');
  assert.ok(b.gegner < b.spieler, 'Gegnerlayer ueber dem Spieler: ' + JSON.stringify(b));

  const c = spielerAn(unten, dx);
  assert.ok(c.spieler > c.obj, name + ' bleibt nach dem Zuruecklaufen vorn: ' + JSON.stringify(c));
  H.run('player.body && (player.body.enable = true)');
  return { a: a, b: b, c: c };
}

test('ein freier Platz fuer die Proben', () => {
  assert.ok(H.run('!!window.__frei'), 'kein freier Platz im Raum gefunden');
});

test('Schrein: vor und hinter dem Spieler, der Schein knapp darunter', () => {
  assert.ok(ereignisObjekt('evt_shrine'), 'kein Schrein erschienen');
  assert.ok(H.run('!!window.__schein'), 'der Schein ist nicht mit angemeldet');
  const r = hinUndZurueck('der Schrein', +12, -10, 10);
  assert.ok(r.a.schein < r.a.spieler, 'Schein ueber dem Spieler, der davor steht: ' + JSON.stringify(r.a));
  assert.ok(r.b.schein > r.b.spieler && r.b.schein < r.b.obj,
    'Schein nicht zwischen Spieler und Schrein: ' + JSON.stringify(r.b));
  assert.strictEqual(r.a.objTiefe, 45, 'in Ruhe gehoert der Schrein auf seine gewohnte Tiefe');
  // Das [E] bleibt obenauf.
  assert.ok(H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    return sc.children.list.some(function (o) { return o.type === 'Text' && o.text === '[E] Probe' && o.depth === 500; });
  })()`), 'der [E]-Hinweis liegt nicht mehr obenauf');
  H.run('window.EventSystem.reset()');
});

test('Elara (gemalte Figur): ruht auf der NPC-Ebene und sortiert sich gegen den Spieler', () => {
  assert.ok(ereignisObjekt('elara_right0', { figurHoehe: 54 }), 'Elara ist nicht erschienen');
  const r = hinUndZurueck('Elara', +4, -3, 2);
  assert.strictEqual(r.a.objTiefe, 90, 'Elara liegt nicht mehr auf der NPC-Ebene (vorher unter dem Gegnerlayer)');
  assert.ok(r.a.obj > r.a.gegner, 'Elara liegt unter dem Gegnerlayer: ' + JSON.stringify(r.a));
  H.run('window.EventSystem.reset()');
});

test('Deko-Saeule (ohne Koerper): der Spieler laeuft dahinter durch', () => {
  // Keine heutige Raumvorlage legt sie; eine kleine Vorlage stellt eine an
  // den freien Platz, ueber den echten Weg applyRoomTemplate.
  const da = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var f = window.__frei, rows = [];
    for (var y = 0; y < 5; y++) rows.push('.....');
    var tpl = { size: { tile: 32, w: 5, h: 5 }, layout: { walls: rows, legend: {} }, objects: [],
                decorations: [{ type: 'prop_pillar', x: 2, y: 2 }] };
    window.RoomTemplates.applyRoomTemplate(sc, tpl, f.x - 80, f.y - 80);
    window.__obj = sc.children.list.filter(function (o) {
      return o && o.active && o.frame && (o.texture.key === 'prop_pillar' || o.frame.name === 'prop_pillar');
    }).pop();
    window.__schein = null;
    return !!window.__obj;
  })()`);
  assert.ok(da, 'keine Deko-Saeule erschienen');
  const r = hinUndZurueck('die Deko-Saeule', +6, -5, 3);
  assert.strictEqual(r.a.objTiefe, 41, 'in Ruhe gehoert die Deko-Saeule auf UEBER_PROP');
});

test('Hindernisse (Statue, Saeulen, Altar): Koerper = Bild, der Spieler kommt nie dahinter', () => {
  // Darum werden sie nicht sortiert: ihr Koerper deckt ihr ganzes Bild, und
  // der Spielerkoerper umschliesst sein eigenes Bild. Zwei Bilder, deren
  // Koerper sich nicht durchdringen, koennen sich also nicht decken.
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene'), f = window.__frei, aus = [];
    ['statue_knight', 'pillar_large', 'pillar_small', 'altar'].forEach(function (typ) {
      var s = window.RoomTemplates.spawnObstacle.call(sc, f.x, f.y, typ), b = s.body;
      var l = s.x - s.displayWidth * s.originX, o = s.y - s.displayHeight * s.originY;
      aus.push({ typ: typ, links: b.x - l, oben: b.y - o,
                 rechts: (l + s.displayWidth) - (b.x + b.width), unten: (o + s.displayHeight) - (b.y + b.height),
                 tiefe: s.depth,
                 gelistet: !!(sc.__tiefenSortierung && sc.__tiefenSortierung.liste.some(function (e) { return e.o === s; })) });
      s.destroy();
    });
    var p = player, pb = p.body;
    var pl = p.x - p.displayWidth * p.originX, po = p.y - p.displayHeight * p.originY;
    var spieler = { links: pl - pb.x, oben: po - pb.y,
                    rechts: (pb.x + pb.width) - (pl + p.displayWidth),
                    unten: (pb.y + pb.height) - (po + p.displayHeight) };
    return JSON.stringify({ hindernisse: aus, spieler: spieler });
  })()`);
  const { hindernisse, spieler } = JSON.parse(r);
  hindernisse.forEach((h) => {
    ['links', 'oben', 'rechts', 'unten'].forEach((k) => {
      assert.ok(Math.abs(h[k]) <= 0.5, h.typ + ': Koerper deckt das Bild nicht mehr ganz (' + k + ' '
        + h[k] + ' px) — dann gehoert es in den gemeinsamen Durchlauf (window.sortiereZumSpieler): '
        + JSON.stringify(h));
    });
    assert.strictEqual(h.tiefe, 42, h.typ + ' liegt nicht mehr auf PROP_HOCH');
    assert.strictEqual(h.gelistet, false, h.typ + ' steht ohne Not im Durchlauf');
  });
  ['links', 'oben', 'rechts', 'unten'].forEach((k) => {
    assert.ok(spieler[k] >= -0.5, 'das Spielerbild ragt ' + k + ' aus seinem Koerper: ' + JSON.stringify(spieler));
  });
});

test('Raumwechsel und Szenenende raeumen die Liste und den Durchlauf', () => {
  // Zwei Ereignisobjekte stehen, dann der Wechsel.
  // Brunnen und die Deko-Saeule aus dem Test davor stehen, dann der Wechsel.
  H.run(`window.__deko = window.__obj`);
  assert.ok(ereignisObjekt('evt_fountain'), 'kein Brunnen erschienen');
  const alt = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.__alt = [window.__obj, window.__deko];
    var liste = sc.__tiefenSortierung ? sc.__tiefenSortierung.liste : [];
    return liste.filter(function (e) { return window.__alt.indexOf(e.o) >= 0; }).length;
  })()`);
  assert.strictEqual(alt, 2, 'Brunnen und Deko-Saeule stehen vor dem Wechsel nicht in der Liste');
  H.run(`window.enterRoom(window.game.scene.getScene('GameScene'))`);
  // Headless klemmt EventSystem.onRoomEnter ab (keine Zufallsereignisse,
  // tools/headless/boot.js); im Spiel raeumt es beim Betreten mit
  // cleanupEventObjects auf — dasselbe tut reset() hier.
  H.run('window.EventSystem.reset()');
  H.step(16); H.step(16);
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var st = sc.__tiefenSortierung;
    var liste = st ? st.liste : [];
    return { eintraege: liste.length,
             tote: liste.filter(function (e) { return !e.o || !e.o.scene; }).length,
             alte: liste.filter(function (e) { return window.__alt.indexOf(e.o) >= 0; }).length,
             aktiv: !!st,
             haengt: st ? sc.events.listeners('postupdate').indexOf(st.lauf) >= 0 : false };
  })()`);
  assert.strictEqual(r.alte, 0, 'Objekte des alten Raums stehen noch in der Liste: ' + JSON.stringify(r));
  assert.strictEqual(r.tote, 0, 'zerstoerte Objekte stehen noch in der Liste: ' + JSON.stringify(r));
  if (!r.aktiv) assert.strictEqual(r.eintraege, 0);
  else assert.ok(r.haengt && r.eintraege > 0, 'Liste leer, aber Durchlauf haengt noch: ' + JSON.stringify(r));

  // Szenenende: auf jeden Fall etwas anmelden, dann das 'shutdown' der Szene.
  const s = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.EventSystem.spawnEventObject(sc, 'evt_shrine', 0xffffff, 0x8866cc, 'Probe', function () {}, { spawnAt: window.__frei });
    var st = sc.__tiefenSortierung;
    var vorher = sc.events.listeners('postupdate').indexOf(st.lauf) >= 0;
    var amEnde = sc.events.listeners('shutdown').indexOf(st.ende) >= 0;
    st.ende();
    return { vorher: vorher, amEnde: amEnde, danach: sc.events.listeners('postupdate').indexOf(st.lauf) >= 0,
             st: !!sc.__tiefenSortierung, shutdown: sc.events.listeners('shutdown').indexOf(st.ende) >= 0 };
  })()`);
  assert.ok(s.vorher && s.amEnde, 'Durchlauf nicht an postupdate/shutdown angemeldet: ' + JSON.stringify(s));
  assert.ok(!s.danach && !s.st && !s.shutdown, 'Szenenende laesst Reste stehen: ' + JSON.stringify(s));
  H.run('window.EventSystem.reset()');
});
