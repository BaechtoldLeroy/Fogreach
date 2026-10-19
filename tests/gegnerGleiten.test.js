// tests/gegnerGleiten.test.js — Gegner kommen um Hindernisse herum.
//
// Gefunden ueber den seltenen Ausfall in tests/gegnerLauf.test.js ("laufende
// Gegner spielen mehrere Laufbilder"): Mit festem Zufall je Start (vm-Kontext
// geseedet, Seeds 1..60) fiel er in 5 von 60 Starts, immer gleich: die Ratte
// (oder der Wicht) drueckte mit voller Geschwindigkeit gegen eine Kiste,
// body.blocked gesetzt, Position unveraendert, also kein Laufbild. Die
// Hindernisvermeidung lenkt nur vom Mittelpunkt des naechsten Hindernisses
// weg; steht der Gegner genau dahinter, hebt sie sich mit dem Suchen auf.
// Ein echter Fehler im Spiel, nicht im Test: der Gegner kam nie heran.
//
// Seit dem Fix gleitet er an der Wand entlang (enemy.js, _anWandGleiten).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
const GSC = "window.game.scene.getScene('GameScene')";

before(async () => {
  H = await launchDungeon({ depth: 8, zusatz: '&debug=1&room=DieQuelle' });
  H.run('window._playerInvincible = true');
});
after(async () => { if (H) await H.shutdown(); });

/**
 * Eine Wand quer zwischen Gegner und Spieler, der Gegner genau dahinter, in
 * einer Richtung mit freiem Boden. Gibt zurueck, nach wie vielen Bildern er
 * an der Wand vorbei ist (oder -1).
 */
function umDieWand(typ, ohneGleiten) {
  const ok = H.run(`(function () {
    var sc = ${GSC};
    enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
    sc._enemyAttackGraceUntil = 0;
    var frei = function (x, y) { return !sc.isPointAccessible || sc.isPointAccessible(x, y); };
    var passt = function (px, py, d) {
      for (var r = 0; r <= 250; r += 15) {
        for (var q = -110; q <= 110; q += 22) {
          if (!frei(px + d[0] * r + d[1] * q, py + d[1] * r + d[0] * q)) return false;
        }
      }
      return true;
    };
    // Einen Fleck mit freiem Boden suchen und den Spieler dorthin stellen.
    var b = sc.physics.world.bounds, px = null, py = null, richtung = null;
    for (var gy = 0.2; gy <= 0.8 && !richtung; gy += 0.1) {
      for (var gx = 0.2; gx <= 0.8 && !richtung; gx += 0.1) {
        var x = b.x + b.width * gx, y = b.y + b.height * gy;
        var d = [[0, 1], [0, -1], [1, 0], [-1, 0]].filter(function (dd) { return passt(x, y, dd); })[0];
        if (d) { px = x; py = y; richtung = d; }
      }
    }
    if (!richtung) return false;
    player.setPosition(px, py); player.body.reset(px, py);
    var quer = richtung[0] === 0;
    var wand = obstacles.create(px + richtung[0] * 110, py + richtung[1] * 110, '__WHITE');
    wand.setVisible(false).setDisplaySize(quer ? 170 : 30, quer ? 30 : 170);
    wand.refreshBody();
    window.__wand = wand; window.__richtung = richtung;
    var ex = px + richtung[0] * 210, ey = py + richtung[1] * 210;
    var e = spawnEnemy.call(sc, ex, ey, ${typ});
    e.setPosition(ex, ey);
    if (e.body && e.body.reset) e.body.reset(ex, ey);
    window.__g = e;
    if (${!!ohneGleiten}) {
      // Der Stand vor dem Fix: kein Gleiten, kein Umweg, die alte Vermeidung (weg vom Mittelpunkt).
      window.__echt = window.__echt || { g: _anWandGleiten, u: _umwegWennFest, v: Steering.obstacleAvoidance };
      _anWandGleiten = function () {}; _umwegWennFest = function () {};
      Steering.obstacleAvoidance = function (me, obs, ahead) {
        var dir = new Phaser.Math.Vector2(me.body.velocity.x, me.body.velocity.y);
        if (!obs || dir.lengthSq() < 1) return new Phaser.Math.Vector2();
        var a = new Phaser.Math.Vector2(me.x, me.y).add(dir.clone().normalize().scale(ahead || 80));
        var best = null, bd = Infinity;
        obs.__steerRects.forEach(function (b) { var px = Phaser.Math.Clamp(a.x, b.left, b.right), py = Phaser.Math.Clamp(a.y, b.top, b.bottom);
          var d2 = (a.x - px) * (a.x - px) + (a.y - py) * (a.y - py); if (d2 < bd) { bd = d2; best = b; } });
        if (!best) return new Phaser.Math.Vector2();
        var w = new Phaser.Math.Vector2(me.x - (best.left + best.right) / 2, me.y - (best.top + best.bottom) / 2);
        return w.lengthSq() ? w.normalize().scale(120) : new Phaser.Math.Vector2();
      };
    }
    return true;
  })()`);
  assert.ok(ok, 'kein freier Boden fuer den Versuch in diesem Raum');
  let bilder = -1;
  for (let i = 0; i < 600 && bilder < 0; i++) {
    H.step(1);
    // Vorbei = auf der Seite der Wand, auf der der Spieler steht.
    const vorbei = H.run(`(function () { var e = window.__g, w = window.__wand, d = window.__richtung;
      if (!e || !e.active) return false;
      return (e.x - w.x) * d[0] + (e.y - w.y) * d[1] < -20; })()`);
    if (vorbei) bilder = i;
  }
  H.run('(function () { if (window.__echt) { _anWandGleiten = window.__echt.g; _umwegWennFest = window.__echt.u; Steering.obstacleAvoidance = window.__echt.v; window.__echt = null; } if (window.__wand) { obstacles.remove(window.__wand, true, true); window.__wand = null; } if (window.__g) window.__g.destroy(); })()');
  return bilder;
}

// Mutationsprobe von Hand: umDieWand(8, true) stellt den Stand vor dem Fix her
// (kein Gleiten, kein Umweg, alte Vermeidung). Damit steckt die Ratte in den
// meisten Versuchen fest; als fester Test taugt das nicht, weil sie je nach
// Raum und Zufall auch so manchmal herumkommt. Belegt ist der Fehler durch
// den geseedeten Lauf ueber ganze Starts (5 von 60 ohne, 0 von 60 mit Fix).
test('Eine Ratte genau hinter einer Kiste kommt herum, statt dagegen zu druecken', () => {
  for (let versuch = 0; versuch < 3; versuch++) {
    const bilder = umDieWand(8);
    // Meist in 3 bis 4 s; nimmt sie die lange Seite der Kiste, auch einmal 8 s.
    assert.ok(bilder >= 0, 'Versuch ' + versuch + ': die Ratte steckt nach 10 s noch hinter der Wand');
  }
});


