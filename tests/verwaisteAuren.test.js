// tests/verwaisteAuren.test.js — kein Elite hinterlaesst seine Aura.
//
// Gemeldet: "ich seh manchmal noch tote Auren und Labels von Eliten oder
// Uniques, die wurden beim Raumwechsel nicht abgeraeumt."
//
// Der normale Weg raeumt sauber ab. Gemessen ueber fuenf Raumwechsel mit bis
// zu 21 Eliten blieb kein einziges verwaistes Objekt zurueck — der leckende
// Pfad ist ein anderer und liess sich nicht einfangen.
//
// Statt weiter zu raten setzt der Kehraus an EINER Engstelle an, dem Raumabbau,
// und greift unabhaengig davon, wie ein Gegner verschwunden ist. Dieser Test
// legt deshalb absichtlich Muell hin, wie ihn ein leckender Pfad
// zuruecklassen wuerde, und prueft, dass der Wechsel ihn mitnimmt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=12', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
});
after(async () => { if (H) await H.shutdown(); });

/** Legt Muell in die Gegner-Ebene: eine Aura, einen Namenszug, ein Label. */
function muellHinlegen() {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var g = sc.add.graphics();
    g.fillStyle(0xff00ff, 0.35); g.fillCircle(0, 0, 36);
    g.setPosition(200, 200).setDepth(38);
    var t = sc.add.text(200, 170, 'VERWAIST Zug', { fontSize: '11px' }).setDepth(51);
    var l = sc.add.text(200, 150, 'VERWAIST Label', { fontSize: '11px' }).setDepth(1003);
    [g, t, l].forEach(function (o) { sc.enemyLayer.add(o); });
    return 3;
  })()`);
}

/** Zaehlt Anzeigeobjekte in der Gegner-Ebene, getrennt nach Besitz. */
function zaehle() {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var besessen = new Set();
    if (typeof enemies !== 'undefined' && enemies && enemies.children) {
      enemies.children.iterate(function (e) {
        if (!e) return;
        if (e._eliteAura) besessen.add(e._eliteAura);
        if (e._eliteNameTag) besessen.add(e._eliteNameTag);
        if (e.miniBossLabel) besessen.add(e.miniBossLabel);
      });
    }
    var z = { gesamt: 0, verwaist: 0 };
    (sc.enemyLayer && sc.enemyLayer.list ? sc.enemyLayer.list : []).forEach(function (o) {
      if (!o) return;
      var passt = (o.type === 'Graphics' && o.depth === 38)
        || (o.type === 'Text' && (o.depth === 51 || o.depth === 1003));
      if (!passt) return;
      z.gesamt++;
      if (!besessen.has(o)) z.verwaist++;
    });
    return z;
  })()`);
}

function raumWechseln() {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var ziel = (sc.currentRoom && typeof sc.currentRoom.id === 'number') ? sc.currentRoom.id + 1 : 1;
    enterRoom(sc, ziel);
    return ziel;
  })()`);
}

test('Der Raumwechsel nimmt verwaiste Auren und Labels mit', () => {
  const gelegt = muellHinlegen();
  const vor = zaehle();
  // Gegenprobe: liegt der Muell wirklich da? Sonst prueft der Test nichts.
  assert.ok(vor.verwaist >= gelegt,
    'der Muell wurde gar nicht erst abgelegt (' + vor.verwaist + ' verwaist)');

  raumWechseln();
  // Grosszuegig takten: der Aufbau des neuen Raums dauert gemessen 27 bis
  // 1643 ms, und unter Last ist er das obere Ende. Mit 30 Bildern war der Test
  // im Gesamtlauf rot, einzeln gruen.
  H.step(120);

  const nach = zaehle();
  assert.strictEqual(nach.verwaist, 0,
    'nach dem Wechsel liegen noch ' + nach.verwaist + ' verwaiste Objekte da');
});

test('Der Kehraus nimmt NICHTS mit, das noch einen Besitzer hat', () => {
  // Die gefaehrlichere Richtung: ein zu eifriger Kehraus loescht die Aura
  // eines lebenden Elite und der Gegner steht ohne Kennzeichnung da.
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var gesetzt = 0;
    enemies.children.iterate(function (e) {
      if (e && e.active && !e.isElite) {
        try { window.EliteEnemies.applyEliteToEnemy(e, 'champion'); gesetzt++; } catch (err) {}
      }
    });
    var mitAura = 0;
    enemies.children.iterate(function (e) { if (e && e._eliteAura) mitAura++; });
    var entfernt = window.EliteEnemies.verwaisteAnzeigenAbraeumen(sc, enemies);
    var danach = 0;
    enemies.children.iterate(function (e) {
      if (e && e._eliteAura && e._eliteAura.scene) danach++;
    });
    return { gesetzt: gesetzt, mitAura: mitAura, entfernt: entfernt, danach: danach };
  })()`);

  assert.ok(r.mitAura > 0, 'kein Elite mit Aura im Raum — der Test misst nichts');
  assert.strictEqual(r.entfernt, 0,
    'der Kehraus hat ' + r.entfernt + ' Objekte entfernt, obwohl nichts verwaist war');
  assert.strictEqual(r.danach, r.mitAura,
    'von ' + r.mitAura + ' Auren leben nur noch ' + r.danach);
});

test('Der Kehraus laeuft beim Raumabbau', () => {
  // Er koennte tadellos sein und nie gerufen werden.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'roomManager.js'), 'utf8');
  assert.ok(quelle.indexOf('verwaisteAnzeigenAbraeumen') > 0,
    'roomManager ruft den Kehraus nicht');
});
