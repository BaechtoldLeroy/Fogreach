// tests/melderRueckweg.test.js: nach der Meldung findet der Melder (Spitzel,
// Ratsbote) auf seinen Weg zurueck, statt an der Wand haengenzubleiben.
//
// Spieler meldeten ("?spy=lager: der Spaeher bleibt in der Wand haengen"):
// der Spitzel rannte per Wegsuche zur Wache im Nachbarraum, ging danach aber
// geradeaus zu seinem Wegpunkt zurueck und klebte an der Trennwand.
//
// Am VERHALTEN geprueft, in allen Spionage-Raeumen mit Meldern: der Melder
// steht dort, wo eine Wache steht (wie nach einer Meldung), und die gerade
// Linie zu seinem naechsten Wegpunkt fuehrt durch Wand oder Kiste. Er muss
// den Wegpunkt erreichen. Dazu der gemeldete Fall im Lager von vorn: Spitzel
// an der Ecke seines Weges, Meldung bei der Wache hinter der Wand, zurueck.
// Zeit nur per H.step.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

const GS = "window.game.scene.getScene('GameScene')";
const RAEUME = [
  { kurz: 'lager', name: 'CouncilWarehouse', typen: ['spitzel', 'ratsbote'] },
  { kurz: 'maulwurf', name: 'InformantDen', typen: ['spitzel', 'ratsbote'] },
  { kurz: 'umschlag', name: 'Umschlagstelle', typen: ['ratsbote'] },
  { kurz: 'ratskammer', name: 'CouncilChamber', typen: ['ratsbote'] }
];
const RUNDEN = 240;      // je 6 Frames: 24 s Spielzeit fuer den Rueckweg

async function bis(H, js, runden, frames) {
  for (let i = 0; i < runden; i++) {
    if (H.run(js)) return true;
    H.step(frames || 2);
    await flush();
  }
  return false;
}

// Kacheln aus der Vorlage, unabhaengig von der Wegsuche des Spiels.
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
    // Freie Kachelmitte naechst (x,y): da steht ein Melder nach der Meldung
    // (manche Wache steht in der Vorlage auf der Ecke eines Mauerblocks).
    function nahFrei(x, y) {
      var best = null, bd = 1e9;
      for (var ty = 0; ty < rows; ty++) for (var tx = 0; tx < cols; tx++) {
        if (!frei(tx, ty)) continue;
        var cx = ox + (tx + 0.5) * T, cy = oy + (ty + 0.5) * T, d = Math.hypot(cx - x, cy - y);
        if (d < bd) { bd = d; best = { x: cx, y: cy }; }
      }
      return best;
    }
    window.__rueck = { ox: ox, oy: oy, T: T, rows: rows, cols: cols, frei: frei, verdeckt: verdeckt, nahFrei: nahFrei };
    return true;
  })()`;
}

// Jeden Takt: Spieler weit weg, niemand in Aufruhr; der Melder bleibt nach
// seiner Meldung in Ruhe ('rest'), geht also nur seinen Weg.
const RUHE = `(function () {
  var s = window.EspionageSystem.getState(), a = window.__melder;
  player.setPosition(-5000, -5000);
  s.exposed = false; s.detection = 0;
  s.guards.forEach(function (g) { g.alert = false; g.hostile = false; g._invest = null; });
  if (a._state !== 'report') { a._state = 'rest'; a._cool = 99; a._notice = 0; a._halt = null; }
})()`;

function amWegpunkt() {
  return `(function () {
    ${RUHE};
    var a = window.__melder, wp = a.patrol[a._wpIndex % a.patrol.length];
    return a._wpIndex !== window.__wpStart || Math.hypot(wp.x - a.x, wp.y - a.y) < 4;
  })()`;
}

RAEUME.forEach((raum) => {
  describe('Melder-Rueckweg: ' + raum.name, () => {
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

    raum.typen.forEach((typ) => {
      test(typ + ' kommt von jeder Wache hinter der Wand zurueck auf seinen Weg', async () => {
        // Faelle: jede Wache, von deren Platz die Linie zu einem Wegpunkt verdeckt ist.
        const faelle = JSON.parse(H.run(`(function () {
          var s = window.EspionageSystem.getState(), M = window.__rueck;
          var a = s.actors.filter(function (o) { return o.type === ${JSON.stringify(typ)}; })[0];
          if (!a || !a.patrol) return '[]';
          var out = [];
          s.guards.forEach(function (g, gi) {
            var st = M.nahFrei(g._homeX, g._homeY);
            for (var w = 0; w < a.patrol.length; w++) {
              if (M.verdeckt(st.x, st.y, a.patrol[w].x, a.patrol[w].y)) { out.push({ g: gi, w: w, x: st.x, y: st.y }); break; }
            }
          });
          return JSON.stringify(out);
        })()`));
        assert.ok(faelle.length > 0, 'kein Fall mit verdeckter Linie fuer ' + typ);
        const fehler = [];
        for (const f of faelle) {
          H.run(`(function () {
            var s = window.EspionageSystem.getState();
            var a = s.actors.filter(function (o) { return o.type === ${JSON.stringify(typ)}; })[0];
            a.knocked = false; a.x = ${f.x}; a.y = ${f.y};
            a._wpIndex = ${f.w}; a._pauseT = 0; a._stopT = 0; a._weg = null; a._target = null;
            window.__melder = a; window.__wpStart = ${f.w};
          })()`);
          const ok = await bis(H, amWegpunkt(), RUNDEN, 6);
          if (!ok) {
            fehler.push('Wache ' + f.g + ' -> Wegpunkt ' + f.w + ': steht bei ' + H.run(
              'JSON.stringify([Math.round(window.__melder.x), Math.round(window.__melder.y)])'));
          }
        }
        assert.deepStrictEqual(fehler, [], typ + ' bleibt auf dem Rueckweg an der Wand haengen');
      });
    });

    if (raum.kurz === 'lager') {
      test('gemeldeter Fall: Spitzel meldet im Nachbarraum und findet zurueck', async () => {
        // Weg oben links, Spitzel an der Ecke (12.5, 10.5): die naechste Wache
        // steht im Mittelraum hinter der Trennwand (Spalte 15). Die Wachen
        // links davon sind ausser Gefecht, sonst haengt es an ihrem Gang.
        H.run(`(function () {
          var s = window.EspionageSystem.getState(), M = window.__rueck;
          var a = s.actors.filter(function (o) { return o.type === 'spitzel'; })[0];
          var P = function (x, y) { return { x: M.ox + x * M.T, y: M.oy + y * M.T }; };
          a.patrol = [P(3.5, 3.5), P(12.5, 3.5), P(12.5, 10.5), P(3.5, 10.5)];
          var ecke = P(12.5, 10.5);
          // Alle Wachen links der Trennwand aus: sonst ist je nach ihrem Gang
          // die von links unten naeher als die im Mittelraum.
          s.guards.forEach(function (g) { g.knocked = g._homeX < M.ox + 15 * M.T; });
          a.knocked = false; a.quiet = false; a.x = ecke.x; a.y = ecke.y;
          a._wpIndex = 3; a._pauseT = 0; a._stopT = 0; a._weg = null;
          a._state = 'report'; a._runT = 0; a._target = null; a._cool = 0; a._notice = 0;
          window.__melder = a; window.__wpStart = 3; window.__ziel = null;
        })()`);
        const gemeldet = await bis(H, `(function () {
          ${RUHE};
          var a = window.__melder; if (a._target) window.__ziel = a._target;
          return a._state !== 'report';
        })()`, 400);
        const ziel = JSON.parse(H.run(`(function () {
          var z = window.__ziel, M = window.__rueck;
          return JSON.stringify(z ? { tx: Math.floor((z.x - M.ox) / M.T), ty: Math.floor((z.y - M.oy) / M.T) } : null);
        })()`));
        assert.ok(gemeldet && ziel, 'Spitzel hat nicht gemeldet');
        assert.ok(ziel.tx > 15, 'Wache nicht im Mittelraum: ' + JSON.stringify(ziel));
        const zurueck = await bis(H, amWegpunkt(), RUNDEN, 6);
        H.run('window.EspionageSystem.getState().guards.forEach(function (g) { g.knocked = false; })');
        assert.ok(zurueck, 'Spitzel haengt an der Wand: ' + H.run(
          'JSON.stringify([Math.round(window.__melder.x), Math.round(window.__melder.y)])'));
      });
    }
  });
});
