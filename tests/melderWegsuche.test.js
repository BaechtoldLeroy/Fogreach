// tests/melderWegsuche.test.js: Melder (Ratsbote, Spitzel) finden den Weg
// zur Wache um Waende und Kisten herum, statt an ihnen haengenzubleiben.
//
// Am VERHALTEN geprueft, in allen fuenf Spionage-Raeumen: der Melder startet
// auf festen, aus Seeds gezogenen Kacheln, von denen die gerade Linie zur
// naechsten Wache durch eine Wand oder Kiste fuehrt. Er muss die Wache
// erreichen (nahe genug fuer die Meldung) und deutlich vor der 7-s-
// Notfallmeldung melden. Im Archiv gibt es keinen Melder, dort laeuft ein
// Schreiber als Ratsbote. Zeit nur per H.step.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

const GS = "window.game.scene.getScene('GameScene')";
const RAEUME = [
  { kurz: 'lager', name: 'CouncilWarehouse', spitzel: true },
  { kurz: 'archiv', name: 'SealedArchive' },
  { kurz: 'maulwurf', name: 'InformantDen', spitzel: true },
  { kurz: 'umschlag', name: 'Umschlagstelle' },
  { kurz: 'ratskammer', name: 'CouncilChamber' }
];
const SEEDS = [11, 23, 37, 41];
const FRUEH = 6.5;      // s: deutlich vor der Notfallmeldung (7 s), Weg mit Umweg eingerechnet

async function bis(H, js, runden) {
  for (let i = 0; i < (runden || 600); i++) {
    if (H.run(js)) return true;
    H.step(2);
    await flush();
  }
  return false;
}

// Legt im Spiel einen Helfer an: Kacheln, Startplaetze (Linie zur Wache
// verdeckt) und ein ferner Platz fuer den Spieler. Waende aus blockedAt,
// Kisten/Faesser/Statuen aus der Vorlage — unabhaengig von der Wegsuche.
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
    window.__melderTest = { ox: ox, oy: oy, T: T, rows: rows, cols: cols, frei: frei, verdeckt: verdeckt };
    return true;
  })()`;
}

// Startplatz aus einem Seed: freie Kachel mit freien Nachbarn, mind. 6 Kacheln
// von der naechsten Wache, gerade Linie dorthin verdeckt.
function startAusSeed(seed) {
  return `(function () {
    var M = window.__melderTest, s = window.EspionageSystem.getState(), r = ${seed} >>> 0;
    function rnd() { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; }
    for (var k = 0; k < 5000; k++) {
      var tx = Math.floor(rnd() * M.cols), ty = Math.floor(rnd() * M.rows);
      if (!M.frei(tx, ty) || !M.frei(tx + 1, ty) || !M.frei(tx - 1, ty) || !M.frei(tx, ty + 1) || !M.frei(tx, ty - 1)) continue;
      var x = M.ox + (tx + 0.5) * M.T, y = M.oy + (ty + 0.5) * M.T, best = null, bd = 1e9;
      s.guards.forEach(function (g) { if (g.knocked) return; var d = Math.hypot(g.x - x, g.y - y); if (d < bd) { bd = d; best = g; } });
      if (!best || bd < 6 * M.T || !M.verdeckt(x, y, best.x, best.y)) continue;
      return JSON.stringify({ x: x, y: y });
    }
    return 'null';
  })()`;
}

// Schickt den Melder von (x,y) los und taktet, bis er gemeldet hat.
async function laufen(H, typ, start) {
  H.run(`(function () {
    var s = window.EspionageSystem.getState();
    var a = s.actors.filter(function (o) { return o.type === ${JSON.stringify(typ)}; })[0]
      || s.actors.filter(function (o) { return o.type === 'schreiber'; })[0];
    a.type = ${JSON.stringify(typ)};
    s.guards.forEach(function (g) { g.alert = false; g.hostile = false; });
    s.detection = 0; s.exposed = ${typ === 'spitzel' ? 'true' : 'false'};
    a.knocked = false; a.x = ${start.x}; a.y = ${start.y};
    a._state = 'report'; a._runT = 0; a._target = null; a._cool = 0; a._notice = 0;
    a._weg = null;
    window.__melder = a; window.__spur = [];
  })()`);
  const tick = `(function () {
    var a = window.__melder, s = window.EspionageSystem.getState(), M = window.__melderTest;
    if (a._target) a.__ziel = a._target;
    window.__spur.push([Math.round(a.x), Math.round(a.y)]);
    // Spieler weit weg vom Melder, damit er ihn nicht abfaengt.
    var p = window.player, best = null, bd = -1;
    for (var ty = 1; ty < M.rows - 1; ty += 2) for (var tx = 1; tx < M.cols - 1; tx += 2) {
      if (!M.frei(tx, ty)) continue;
      var x = M.ox + (tx + 0.5) * M.T, y = M.oy + (ty + 0.5) * M.T, d = Math.hypot(x - a.x, y - a.y);
      if (d > bd) { bd = d; best = { x: x, y: y }; }
    }
    if (best && Math.hypot(p.x - a.x, p.y - a.y) < 200) p.setPosition(best.x, best.y);
    if (${typ === 'spitzel' ? 'true' : 'false'}) s.exposed = true;
    return a._state !== 'report';
  })()`;
  const fertig = await bis(H, tick, 700);
  return JSON.parse(H.run(`(function () {
    var a = window.__melder, z = a.__ziel, s = window.EspionageSystem.getState();
    var r = { runT: a._runT, abstand: z ? Math.hypot(z.x - a.x, z.y - a.y) : -1, spur: window.__spur.length };
    s.guards.forEach(function (g) { g.alert = false; g.hostile = false; });
    s.exposed = false; s.detection = 0; a._state = 'idle'; a._cool = 0; a.__ziel = null;
    return JSON.stringify(Object.assign(r, { fertig: ${fertig} }));
  })()`));
}

RAEUME.forEach((raum) => {
  describe('Melder-Wegsuche: ' + raum.name, () => {
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

    const typen = raum.spitzel ? ['ratsbote', 'spitzel'] : ['ratsbote'];
    typen.forEach((typ) => {
      test(typ + ' erreicht die Wache um Hindernisse herum (Seeds ' + SEEDS.join(',') + ')', async () => {
        const fehler = [];
        for (const seed of SEEDS) {
          const start = JSON.parse(H.run(startAusSeed(seed)));
          assert.ok(start, 'kein verdeckter Startplatz fuer Seed ' + seed);
          const r = await laufen(H, typ, start);
          if (!r.fertig || r.runT >= FRUEH || r.abstand < 0 || r.abstand > 48) {
            fehler.push('Seed ' + seed + ' ab ' + Math.round(start.x) + ',' + Math.round(start.y) + ': ' + JSON.stringify(r));
          }
        }
        assert.deepStrictEqual(fehler, [], 'Melder bleibt haengen / meldet nur per Notfall');
      });
    });

    if (raum.kurz === 'lager') {
      test('wer sich an die Ecke seines Umwegs stellt, faengt ihn ab', async () => {
        const start = JSON.parse(H.run(startAusSeed(SEEDS[0])));
        H.run(`(function () {
          var s = window.EspionageSystem.getState(), a = s.actors.filter(function (o) { return o.type === 'ratsbote'; })[0];
          s.guards.forEach(function (g) { g.alert = false; g.hostile = false; }); s.detection = 0; s.exposed = false;
          a.knocked = false; a.quiet = false; a.x = ${start.x}; a.y = ${start.y};
          a._state = 'report'; a._runT = 0; a._target = null; a._cool = 0; a._weg = null;
          window.__melder = a; player.setPosition(40, 40);
        })()`);
        // Ein Takt, dann steht der Umweg fest: der Spieler wartet an dessen erster Ecke.
        assert.ok(await bis(H, '!!(window.__melder._weg && window.__melder._weg.punkte.length)', 30), 'kein Umweg berechnet');
        H.run('(function () { var w = window.__melder._weg.punkte[0]; player.setPosition(w.x, w.y); })()');
        const ok = await bis(H, `(function () { var a = window.__melder; return a.knocked || a._state !== 'report'; })()`, 400);
        const r = JSON.parse(H.run(`JSON.stringify({ knocked: window.__melder.knocked, quiet: window.__melder.quiet })`));
        assert.ok(ok && r.knocked && r.quiet, 'nicht abgefangen: ' + JSON.stringify(r));
      });
    }
  });
});
