// tests/finaleHarren.test.js — Harren faellt nie auf die Treppe (nach b461).
//
// Gemeldet: Je nach Raum lag Harren nach Elaras Stoss auf der Treppe. Sein
// Weg und der Fleck, an dem er liegt, kommen jetzt aus Finale.harrenWeg:
// begehbarer Boden (Mitte und Ecken des Koerpers), mit Abstand zu jedem
// Treppenbild; sonst ein freier Fleck nahe der Esse.
//
// Geprueft in der echten Finalarena (DieQuelle) und in zufaelligen Raeumen,
// fuer viele Standorte von Elara und Spieler, dazu einmal der ganze Weg
// durch die Szene bis zum Liegen.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

const GSC = "window.game.scene.getScene('GameScene')";

/** Prueft harrenWeg fuer ein Raster von Elara-Standorten; gibt die Verstoesse zurueck. */
function rasterPruefen(H) {
  return H.run(`(function () {
    var sc = ${GSC}, F = window.Finale, b = sc.physics.world.bounds;
    var treppen = sc.stairsGroup.getChildren().filter(function (t) { return t.active; }).map(function (t) { return t.getBounds(); });
    var schlecht = [], geprueft = 0;
    // Dazu jede Treppe selbst: Elara direkt daneben ist der schlimmste Fall.
    var orte = [];
    for (var gy = 0.15; gy <= 0.85; gy += 0.1) for (var gx = 0.15; gx <= 0.85; gx += 0.1) orte.push([b.x + b.width * gx, b.y + b.height * gy]);
    treppen.forEach(function (t) { orte.push([t.centerX - 60, t.centerY], [t.centerX + 60, t.centerY], [t.centerX, t.centerY + 60], [t.centerX, t.centerY - 60]); });
    var px0 = player.x, py0 = player.y;
    orte.forEach(function (o) {
      if (!sc.isPointAccessible(o[0], o[1])) return;
      [[-120, 30], [120, 30]].forEach(function (pv) {
        player.x = o[0] + pv[0]; player.y = o[1] + pv[1];
        var w = F.harrenWeg(sc, o[0], o[1], { x: o[0] - 74, y: o[1] - 18 });
        geprueft++;
        ['start', 'ziel', 'liegt'].forEach(function (k) {
          var p = w[k];
          var inTreppe = treppen.some(function (t) { return p.x > t.left - 22 && p.x < t.right + 22 && p.y > t.top - 22 && p.y < t.bottom + 22; });
          if (inTreppe || !F.treppenFrei(sc, p.x, p.y, 22) || !sc.isPointAccessible(p.x, p.y)) {
            schlecht.push(k + '@' + Math.round(p.x) + ',' + Math.round(p.y) + ' (Elara ' + Math.round(o[0]) + ',' + Math.round(o[1]) + ')');
          }
        });
      });
    });
    player.x = px0; player.y = py0;
    return { treppen: treppen.length, geprueft: geprueft, schlecht: schlecht.slice(0, 6), anzahl: schlecht.length };
  })()`);
}

describe('In der Finalarena (DieQuelle)', () => {
  let H = null;
  before(async () => { H = await launchDungeon({ depth: 30, zusatz: '&debug=1&room=DieQuelle' }); H.run('window._playerInvincible = true'); });
  after(async () => { if (H) await H.shutdown(); });

  test('Weg und Liegeplatz liegen nie auf oder an der Treppe', () => {
    const r = rasterPruefen(H);
    assert.ok(r.treppen > 0, 'keine Treppe im Raum: der Test misst nichts');
    assert.ok(r.geprueft >= 40, 'zu wenige Standorte: ' + r.geprueft);
    assert.strictEqual(r.anzahl, 0, 'Harren auf/an der Treppe oder in der Wand: ' + r.schlecht.join('; '));
  });

});

describe('Der ganze Weg durch die Szene (?finale=harren)', () => {
  let H = null;
  before(async () => { H = await launchDungeon({ depth: 30, zusatz: '&debug=1&room=DieQuelle&boss=elara&finale=harren' }); H.run('window._playerInvincible = true'); });
  after(async () => { if (H) await H.shutdown(); });

  test('Er kommt herein, wird gestossen und liegt frei, nicht an der Treppe', () => {
    const klick = () => H.run(`(function () { var k = ${GSC}.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled && o.active; })[0]; if (!k) return false; k.emit('pointerdown'); return true; })()`);
    const text = () => H.run(`(function () { var t = ${GSC}.children.list.filter(function (o) { return o.type === 'Text' && o.depth === 2501; })[0]; return t ? t.text : ''; })()`);
    // Seiten durchklicken, bis Elara den Hammer nimmt (dann liegt Harren schon).
    let n = 0;
    for (let i = 0; i < 3000 && n < 12; i++) {
      H.step(2);
      if (!H.run('!!window.eventChoiceOpen')) continue;
      if (/reisst Dir den Hammer/.test(text())) break;
      klick(); n++;
    }
    const r = H.run(`(function () { var sc = ${GSC}, h = sc.children.getByName('finaleHarren');
      return h ? { x: h.x, y: h.y, winkel: Math.round(h.angle), frei: window.Finale.treppenFrei(sc, h.x, h.y, 22), boden: sc.isPointAccessible(h.x, h.y),
        treppen: sc.stairsGroup.getChildren().filter(function (t) { return t.active; }).length } : null; })()`);
    assert.ok(r, 'Harren steht nicht in der Szene');
    assert.ok(r.treppen > 0, 'keine Treppe im Raum');
    assert.ok(Math.abs(r.winkel) >= 80, 'er liegt noch nicht: ' + JSON.stringify(r));
    assert.strictEqual(r.frei, true, 'Harren liegt an der Treppe: ' + JSON.stringify(r));
    assert.strictEqual(r.boden, true, 'Harren liegt in der Wand: ' + JSON.stringify(r));
  });
});

describe('In zufaelligen Raeumen', () => {
  for (const tiefe of [30, 12]) {
    test('Tiefe ' + tiefe + ': nie auf der Treppe', async () => {
      const H = await launchDungeon({ depth: tiefe, zusatz: '&debug=1' });
      try {
        const r = rasterPruefen(H);
        assert.ok(r.treppen > 0, 'keine Treppe im Raum');
        assert.strictEqual(r.anzahl, 0, 'Harren auf/an der Treppe oder in der Wand: ' + r.schlecht.join('; '));
      } finally { await H.shutdown(); }
    });
  }
});
