// tests/rollenQuellen.test.js — Treppenrollen fallen aus denselben Quellen wie Portalrollen.
//
// Gemeldet: "Treppenrollen werden nie fallen gelassen" (#151).
//
// Rollen gibt es im Lauf aus drei Quellen: dem Gegner-Abwurf, Kisten und
// Destructibles, und der Belohnung eines abgeschlossenen Proc-Raums. Bis b246
// hatte nur der Gegner-Abwurf die Verzweigung "ein Drittel Treppe". Kisten und
// die Raum-Belohnung riefen makePortalScrollDrop direkt und konnten gar keine
// Treppenrolle liefern — egal wie oft.
//
// Jetzt laufen alle drei ueber EINE Funktion, makeScrollDrop.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=10', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
});
after(async () => { if (H) await H.shutdown(); });

test('makeScrollDrop liefert ein Drittel Treppenrollen', () => {
  const r = H.run(`(function () {
    var z = { treppe: 0, portal: 0, sonst: 0 };
    for (var i = 0; i < 6000; i++) {
      var it = window.makeScrollDrop();
      if (it && it.key === 'STAIR_SCROLL') z.treppe++;
      else if (it && it.key === 'PORTAL_SCROLL') z.portal++;
      else z.sonst++;
    }
    return z;
  })()`);
  assert.strictEqual(r.sonst, 0, 'makeScrollDrop lieferte ' + r.sonst + '-mal etwas anderes als eine Rolle');
  const anteil = r.treppe / (r.treppe + r.portal);
  assert.ok(Math.abs(anteil - 1 / 3) < 0.04,
    (anteil * 100).toFixed(1) + ' % Treppenrollen, erwartet rund 33');
});

test('Eine Kiste kann eine Treppenrolle enthalten', () => {
  // Am ECHTEN Weg: breakDestructibleObstacle an einer grossen Kiste.
  //
  // Math.random ist fuer die Dauer des Aufrufs auf 0 festgehalten. Dann gelingt
  // jeder Wurf — auch der Rollen-Wurf und dessen Verzweigung (0 < 1/3), die
  // damit sicher die Treppenrolle waehlt. Mit dem alten Aufruf von
  // makePortalScrollDrop kaeme an genau dieser Stelle eine Portalrolle heraus.
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var daten = { lootTier: 'large', type: 'chest_large' };
    var kiste = {
      active: true, x: 300, y: 300,
      getData: function (k) { return daten[k]; },
      destroy: function () { this.active = false; }
    };
    var gefallen = [];
    var echtLoot = window.spawnLoot;
    var echtZufall = Math.random;
    window.spawnLoot = function (x, y, item) { if (item) gefallen.push(item.key || item.type); };
    Math.random = function () { return 0; };
    try { breakDestructibleObstacle(sc, kiste); }
    finally { Math.random = echtZufall; window.spawnLoot = echtLoot; }
    return gefallen;
  })()`);
  assert.ok(r.length > 0, 'die Kiste hat gar nichts fallen lassen');
  assert.ok(r.indexOf('STAIR_SCROLL') >= 0,
    'aus der Kiste fiel keine Treppenrolle, nur: ' + JSON.stringify(r));
});

test('Die Belohnung eines Proc-Raums geht ueber makeScrollDrop', () => {
  // Diese Stelle haengt an einem vollstaendig abgeschlossenen Proc-Raum und
  // laesst sich im Testkopf nicht billig herbeifuehren. Deshalb hier nur der
  // Quelltext — die Klassen-Probe darunter faengt denselben Fehler zusaetzlich.
  const quelle = fs.readFileSync(path.join(__dirname, '..', 'js', 'roomManager.js'), 'utf8');
  const i = quelle.indexOf('Weighted proc-room reward');
  assert.ok(i > 0, 'die Proc-Raum-Belohnung wurde nicht gefunden');
  const block = quelle.slice(i, i + 1600);
  // Den AUFRUF suchen, nicht den Namen — der Kommentar davor nennt ihn auch.
  assert.ok(/window\.makeScrollDrop\(\)/.test(block),
    'die Proc-Raum-Belohnung vergibt ihre Rolle nicht ueber makeScrollDrop');
});

test('Keine Beutequelle ruft die Portalrolle an makeScrollDrop vorbei', () => {
  // Die Klasse, nicht die drei Stellen: jede neue Quelle, die
  // makePortalScrollDrop direkt ruft, verliert die Treppenrolle wieder still.
  // Erlaubt ist der Aufruf nur in loot.js selbst, wo makeScrollDrop ihn nutzt.
  const wurzel = path.join(__dirname, '..', 'js');
  const dateien = [];
  (function lauf(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) lauf(p);
      else if (e.name.endsWith('.js')) dateien.push(p);
    });
  })(wurzel);
  const verstoss = [];
  dateien.forEach((f) => {
    if (path.basename(f) === 'loot.js') return;
    const s = fs.readFileSync(f, 'utf8');
    if (/makePortalScrollDrop\s*\(/.test(s)) verstoss.push(path.relative(wurzel, f));
  });
  assert.deepStrictEqual(verstoss, [],
    'diese Dateien rufen makePortalScrollDrop direkt: ' + verstoss.join(', '));
});
