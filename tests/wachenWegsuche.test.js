// tests/wachenWegsuche.test.js: Wachen der Spionage finden den Weg um Waende
// herum, statt an ihnen kleben zu bleiben, und stehen nicht in der Mauer.
//
// Nach dem Spaeher (melderRueckweg) die Wachen selbst: wer einem Geraeusch
// oder Ruf nachgeht, wer danach auf Posten oder Weg zurueckkehrt und wer Dich
// feindselig jagt, ging geradeaus und blieb an der naechsten Wand haengen.
// Am VERHALTEN geprueft (Lager und Maulwurf, feste Seeds): das Ziel liegt so,
// dass die gerade Linie durch Wand oder Kiste fuehrt, die Wache muss es
// erreichen. Dazu die Vorlagen: keine Wache, kein Wegpunkt, kein Platz einer
// Figur in einer Mauerkachel (im Maulwurf standen beide Wachen in den
// Pfeilerbloecken, konnten weder gehen noch durch die Mauer sehen).
// Zeit nur per H.step.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launchDungeon, flush } = require('../tools/headless/index.js');

const GS = "window.game.scene.getScene('GameScene')";
const RUNDEN = 240;      // je 6 Frames: 24 s Spielzeit

async function bis(H, js, runden, frames) {
  for (let i = 0; i < runden; i++) {
    if (H.run(js)) return true;
    H.step(frames || 2);
    await flush();
  }
  return false;
}

describe('Spionage-Vorlagen: niemand steht in der Mauer', () => {
  const dir = path.join(__dirname, '..', 'js', 'roomTemplates');
  const vorlagen = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'manifest.json')
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).filter((t) => t.espionage);

  test('Wachen, ihre Wege und die Plaetze/Wege der Figuren liegen auf freien Kacheln', () => {
    assert.ok(vorlagen.length >= 5, 'Spionage-Vorlagen nicht gefunden');
    const fehler = [];
    vorlagen.forEach((t) => {
      const W = t.layout.walls;
      const pruefe = (x, y, was) => {
        const row = W[Math.floor(y)];
        if (!row || row.charAt(Math.floor(x)) !== '.') fehler.push(t.name + ': ' + was + ' bei ' + x + ',' + y);
      };
      (t.espionage.guards || []).forEach((g, i) => {
        pruefe(g.x, g.y, 'Wache ' + i);
        (g.patrol || []).forEach((w, j) => pruefe(w.x, w.y, 'Wache ' + i + ' Wegpunkt ' + j));
      });
      (t.espionage.actors || []).forEach((a) => {
        (a.spots || []).forEach((s, j) => pruefe(s.x, s.y, a.type + ' Platz ' + j));
        (a.routes || []).forEach((r, k) => r.forEach((w, j) => pruefe(w.x, w.y, a.type + ' Weg ' + k + '/' + j)));
      });
    });
    assert.deepStrictEqual(fehler, []);
  });
});

// Kacheln aus der Vorlage, unabhaengig von der Wegsuche des Spiels; dazu je
// Wache ein Ziel 5-12 Kacheln weit, zu dem die gerade Linie verdeckt ist.
function helfer(name) {
  return `(function () {
    var s = window.EspionageSystem.getState(), tpl = window.RoomTemplates.TEMPLATES[${JSON.stringify(name)}];
    var T = tpl.size.tile, g0 = tpl.espionage.guards[0];
    var ox = s.guards[0]._homeX - g0.x * T, oy = s.guards[0]._homeY - g0.y * T;
    var rows = tpl.layout.walls.length, cols = tpl.layout.walls[0].length;
    var fest = {};
    (tpl.objects || []).forEach(function (o) {
      if (/^(crate|barrel|chest|statue|pillar|altar|brazier)/.test(o.type)) fest[Math.floor(o.x) + ',' + Math.floor(o.y)] = true;
    });
    function frei(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= cols || ty >= rows || fest[tx + ',' + ty]) return false;
      return !s.blockedAt(ox + (tx + 0.5) * T, oy + (ty + 0.5) * T);
    }
    function verdeckt(x0, y0, x1, y1) {
      var d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 6);
      for (var i = 1; i < n; i++) {
        var x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
        if (!frei(Math.floor((x - ox) / T), Math.floor((y - oy) / T))) return true;
      }
      return false;
    }
    function ziel(gx, gy) {
      for (var ty = 1; ty < rows - 1; ty++) for (var tx = 1; tx < cols - 1; tx++) {
        if (!frei(tx, ty) || !frei(tx + 1, ty) || !frei(tx - 1, ty) || !frei(tx, ty + 1) || !frei(tx, ty - 1)) continue;
        var x = ox + (tx + 0.5) * T, y = oy + (ty + 0.5) * T, d = Math.hypot(x - gx, y - gy);
        if (d >= 5 * T && d <= 12 * T && verdeckt(gx, gy, x, y)) return { x: x, y: y };
      }
      return null;
    }
    window.__wache = { frei: frei, verdeckt: verdeckt, ziel: ziel };
    return true;
  })()`;
}

// Jeden Takt: niemand sonst in Aufruhr, die Figuren melden nichts.
const RUHE = `
  var s = window.EspionageSystem.getState();
  s.exposed = false; s.detection = 0;
  s.actors.forEach(function (a) { a._state = 'rest'; a._cool = 99; a._notice = 0; a._halt = null; });
`;

[
  { kurz: 'lager', name: 'CouncilWarehouse' },
  { kurz: 'maulwurf', name: 'InformantDen' }
].forEach((raum) => {
  describe('Wachen-Wegsuche: ' + raum.name, () => {
    let H = null;
    before(async () => {
      H = await launchDungeon({ depth: 3, zusatz: '&debug=1&spy=' + raum.kurz + '&spyseed=3' });
      H.run('window._playerInvincible = true; window.SpionageSzenen._TEMPO = 0.2');
      await bis(H, `!!${GS}.__spionSzene`, 400);
      H.run(`${GS}.input.keyboard.emit('keydown', { key: 'Escape', keyCode: 27 })`);
      await bis(H, `!${GS}.__spionSzene`, 200);
      assert.strictEqual(H.run('window.EspionageSystem.getState().missionId'), raum.name);
      H.run(helfer(raum.name));
    });
    after(async () => { if (H) await H.shutdown(); });

    function stand(i) {
      return H.run(`JSON.stringify((function (g) { return [Math.round(g.x), Math.round(g.y)]; })(window.EspionageSystem.getState().guards[${i}]))`);
    }

    test('jede Wache geht einem Geraeusch hinter der Wand nach und kehrt zurueck', async () => {
      const n = H.run('window.EspionageSystem.getState().guards.length');
      const fehler = [];
      for (let i = 0; i < n; i++) {
        const z = JSON.parse(H.run(`(function () {
          var g = window.EspionageSystem.getState().guards[${i}];
          return JSON.stringify(window.__wache.ziel(g.x, g.y));
        })()`));
        if (!z) { fehler.push('Wache ' + i + ': kein verdecktes Ziel'); continue; }
        H.run(`(function () {
          var g = window.EspionageSystem.getState().guards[${i}];
          g.hostile = false; g._halt = null; g._weg = null;
          g._invest = { x: ${z.x}, y: ${z.y}, t: 999 };
        })()`);
        const hin = await bis(H, `(function () { ${RUHE}
          player.setPosition(-5000, -5000);
          var g = s.guards[${i}];
          return Math.hypot(g.x - ${z.x}, g.y - ${z.y}) <= 46;
        })()`, RUNDEN, 6);
        if (!hin) { fehler.push('Wache ' + i + ' hin zu ' + z.x + ',' + z.y + ': steht bei ' + stand(i)); }
        // Nichts gefunden: zurueck auf Posten bzw. Weg.
        H.run(`window.EspionageSystem.getState().guards[${i}]._invest.t = 0`);
        const zurueck = await bis(H, `(function () { ${RUHE}
          player.setPosition(-5000, -5000);
          var g = s.guards[${i}];
          var p = g.patrol ? g.patrol : [{ x: g._homeX, y: g._homeY }];
          return p.some(function (w) { return Math.hypot(g.x - w.x, g.y - w.y) < 6; });
        })()`, RUNDEN, 6);
        if (!zurueck) { fehler.push('Wache ' + i + ' zurueck: steht bei ' + stand(i)); }
      }
      assert.deepStrictEqual(fehler, [], 'Wache klebt an der Wand');
    });

    test('jede feindselige Wache jagt Dich um die Wand herum', async () => {
      const n = H.run('window.EspionageSystem.getState().guards.length');
      const fehler = [];
      for (let i = 0; i < n; i++) {
        // Von ihrem Posten aus, die anderen ausser Gefecht.
        const z = JSON.parse(H.run(`(function () {
          var s = window.EspionageSystem.getState(), g = s.guards[${i}];
          s.guards.forEach(function (o, k) { o.hostile = k === ${i}; o.knocked = k !== ${i}; o._invest = null; o._weg = null; o._halt = null; });
          g.x = g._homeX; g.y = g._homeY;
          return JSON.stringify(window.__wache.ziel(g.x, g.y));
        })()`));
        if (!z) { fehler.push('Wache ' + i + ': kein verdecktes Ziel'); continue; }
        const dran = await bis(H, `(function () { ${RUHE}
          player.setPosition(${z.x}, ${z.y});
          var g = s.guards[${i}];
          // Nahkampfabstand zum Spieler (der wird von der Wache auch weggeschoben).
          return Math.hypot(g.x - player.x, g.y - player.y) <= 42 && Math.hypot(g.x - ${z.x}, g.y - ${z.y}) <= 64;
        })()`, RUNDEN, 6);
        if (!dran) fehler.push('Wache ' + i + ' jagt nach ' + z.x + ',' + z.y + ': steht bei ' + stand(i));
      }
      H.run('window.EspionageSystem.getState().guards.forEach(function (g) { g.hostile = false; g.knocked = false; })');
      assert.deepStrictEqual(fehler, [], 'Wache kommt nicht um die Wand');
    });
  });
});
