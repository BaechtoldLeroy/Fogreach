// tests/tuerenNeu.test.js — Die neuen Kellertore (Vorschau ?debug=1&tueren=neu).
//
// Eichentor mit Messing und Kette aus Pixelbildern (assets/sprites/tueren/,
// tools/tuerenBauen.js), je Laenge (4-6 Kacheln) und Richtung aus Stuecken
// zusammengesetzt, vier Bilder von zu bis offen. Das Bild ist 64 px tief, der
// Koerper bleibt der alte 24 px-Riegel: Weg, Sicht und [E] wie vorher.
// Ohne Flagge bleiben die gezeichneten Tueren.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

const GS = "window.game.scene.getScene('GameScene')";

async function bis(H, js, runden) {
  for (let i = 0; i < (runden || 300); i++) {
    if (H.run(js)) return true;
    H.step(2);
    await flush();
  }
  return !!H.run(js);
}

/** Einen Raum mit Toren beider Richtungen betreten; Gegner weg, Spieler unverwundbar. */
function raumMitToren(H) {
  return H.run(`(function () {
    window._playerInvincible = true;
    var sc = ${GS};
    for (var r = 1; r <= 200; r++) {
      enterRoom(sc, r);
      var t = (sc._doors || []).filter(function (d) { return d && d.active; });
      var o = {};
      t.forEach(function (d) { o[d.getData('orientation')] = 1; });
      if (o.horizontal && o.vertical) return r;
    }
    return -1;
  })()`);
}

function gegnerWeg(H) {
  H.run(`(function () {
    (window.enemies && window.enemies.getChildren ? window.enemies.getChildren().slice() : [])
      .forEach(function (e) { try { e.destroy(); } catch (x) {} });
  })()`);
}

/** Erste Tuer einer Richtung, die nahe der Raummitte steht (am Rand fehlt Platz zum Anlaufen). */
function tuerWahl(o) {
  return `(function () {
    var t = ${GS}._doors.filter(function (d) { return d.active && d.getData('orientation') === '${o}'; });
    var mx = 0, my = 0; t.forEach(function (d) { mx += d.x; my += d.y; }); mx /= t.length; my /= t.length;
    t.sort(function (a, b) { return Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my); });
    return t[0];
  })()`;
}

describe('mit ?tueren=neu', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 3, zusatz: '&debug=1&tueren=neu&room=bsp' });
    assert.ok(raumMitToren(H) > 0, 'kein Raum mit Toren beider Richtungen');
    gegnerWeg(H);
    for (let i = 0; i < 10; i++) { H.step(2); await flush(); }
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Texturen: 3 Laengen x 2 Richtungen, je 4 Bilder, nichts gestreckt', () => {
    const r = H.run(`(function () {
      var sc = ${GS}, aus = {};
      function px(key, x, y) {
        var c = sc.textures.get(key).getSourceImage().getContext('2d');
        return Array.prototype.slice.call(c.getImageData(x, y, 1, 1).data);
      }
      function streifen(key, x, y, w, h) {
        var c = sc.textures.get(key).getSourceImage().getContext('2d');
        return Array.prototype.join.call(c.getImageData(x, y, w, h).data, ',');
      }
      ['horizontal', 'vertical'].forEach(function (o) {
        [128, 160, 192].forEach(function (L) {
          var k = window.DoorSystem.torTextur(sc, o, L);
          var t = sc.textures.get(k), waag = o === 'horizontal';
          var bilder = [0, 1, 2, 3].map(function (i) { var f = t.get(i); return f && f.name == i ? [f.cutX, f.cutY, f.width, f.height] : null; });
          var zuMitte = waag ? px(k, L / 2 + 6, 20) : px(k, 30, L / 2 + 12);
          var aufMitte = waag ? px(k, L / 2, 3 * 64 + 32) : px(k, 3 * 64 + 30, L / 2);
          var aufPfosten = waag ? px(k, 12, 3 * 64 + 32) : px(k, 3 * 64 + 32, 12);
          aus[o + L] = { k: k, bilder: bilder, zu: zuMitte[3], auf: aufMitte[3], pfosten: aufPfosten[3],
            // Pfosten und Mittelstueck muessen in jeder Laenge pixelgleich sein — gestreckt waeren sie es nicht.
            anfang: waag ? streifen(k, 0, 0, 24, 64) : streifen(k, 0, 0, 64, 24),
            mitte: waag ? streifen(k, 24 + (L - 128) / 2, 0, 79, 64) : streifen(k, 0, 24 + (L - 128) / 2, 64, 79) };
        });
      });
      return aus;
    })()`);
    for (const o of ['horizontal', 'vertical']) {
      for (const L of [128, 160, 192]) {
        const e = r[o + L];
        assert.ok(/^tor_neu_/.test(e.k), o + L + ': Schluessel ' + e.k);
        e.bilder.forEach((b, i) => {
          assert.ok(b, o + L + ': Bild ' + i + ' fehlt');
          const soll = o === 'horizontal' ? [0, i * 64, L, 64] : [i * 64, 0, 64, L];
          assert.deepStrictEqual(Array.from(b), soll, o + L + ': Bild ' + i);
        });
        assert.ok(e.zu > 0, o + L + ': geschlossen ist die Mitte durchsichtig');
        assert.strictEqual(e.auf, 0, o + L + ': offen liegt etwas im Durchgang (Boden nicht sichtbar)');
        assert.ok(e.pfosten > 0, o + L + ': offen fehlt der Pfosten');
        assert.strictEqual(e.anfang, r[o + 128].anfang, o + L + ': Pfosten anders als bei 4 Kacheln');
        assert.strictEqual(e.mitte, r[o + 128].mitte, o + L + ': Mittelstueck anders als bei 4 Kacheln');
      }
    }
  });

  test('gesetzte Tore: Bild fuellt die Wandtiefe, Koerper ist der alte Riegel', () => {
    const liste = Array.from(H.run(`${GS}._doors.filter(function (d) { return d.active; }).map(function (d) {
      return { o: d.getData('orientation'), k: d.texture.key, f: d.frame.name, w: d.displayWidth, h: d.displayHeight,
        x: d.x, y: d.y, bx: d.body.x, by: d.body.y, bw: d.body.width, bh: d.body.height };
    })`));
    assert.ok(liste.length >= 2);
    for (const d of liste) {
      const waag = d.o === 'horizontal';
      const L = waag ? d.w : d.h;
      assert.ok([128, 160, 192].includes(L), 'Laenge ' + L);
      assert.strictEqual(waag ? d.h : d.w, 64, 'Bild nicht 64 tief: ' + d.k);
      assert.strictEqual(String(d.f), '0', 'nicht geschlossen gesetzt: ' + d.k);
      assert.deepStrictEqual([d.bw, d.bh], waag ? [L, 24] : [24, L], 'Koerpermasse ' + d.k);
      assert.deepStrictEqual([d.bx + d.bw / 2, d.by + d.bh / 2], [d.x, d.y], 'Koerper nicht mittig ' + d.k);
    }
  });

  for (const o of ['horizontal', 'vertical']) {
    test(o + ': zu sperrt Weg und Sicht, offen nicht; Oeffnen endet im offenen Bild', async () => {
      const d = H.run(`(function () { var t = ${tuerWahl(o)}; return { x: t.x, y: t.y }; })()`);
      const waag = o === 'horizontal';
      // Anlauf von der Raumseite unterhalb/rechts, Richtung Tor.
      const start = waag ? { x: d.x, y: d.y + 70 } : { x: d.x + 70, y: d.y };
      const taste = waag ? { up: true } : { left: true };
      const setzen = () => H.run(`(function () {
        var p = window.player; p.setPosition(${start.x}, ${start.y}); if (p.body) p.body.reset(p.x, p.y);
        if (window.InputScheme && window.InputScheme.init) window.InputScheme.init(${GS});
      })()`);
      const tor = `${tuerWahl(o)}`;
      const laufen = async () => {
        setzen(); gegnerWeg(H);
        H.input.hold(taste);
        for (let i = 0; i < 40; i++) { H.step(3); await flush(); }
        H.input.releaseAll();
        return H.run(`(function () { var p = window.player; return { x: p.x, y: p.y }; })()`);
      };
      const sicht = () => H.run(`(function () {
        window.invalidateWallCache();
        return { mitte: isBlockedByObstacle(${d.x}, ${d.y}),
          // im Bild, aber ausserhalb des 24er-Riegels: sperrte vorher nicht, darf es jetzt auch nicht
          rand: isBlockedByObstacle(${waag ? d.x : d.x + 20}, ${waag ? d.y + 20 : d.y}) };
      })()`);

      assert.strictEqual(H.run(`${tor}.getData('doorState')`), 'closed');
      const zu = await laufen();
      const ueberZu = waag ? zu.y < d.y : zu.x < d.x;
      assert.strictEqual(ueberZu, false, 'durch das geschlossene Tor gelaufen: ' + JSON.stringify(zu));
      const sz = sicht();
      assert.strictEqual(sz.mitte, true, 'das geschlossene Tor sperrt die Sicht nicht');
      assert.strictEqual(sz.rand, false, 'das Tor sperrt Sicht ausserhalb des alten Riegels');

      setzen();
      assert.strictEqual(H.run(`window.DoorSystem.tryInteractDoor(${GS}, window.player)`), true, '[E] erreicht das Tor nicht');
      assert.strictEqual(H.run(`${tor}.getData('doorState')`), 'open', 'Zustand nicht sofort offen');
      assert.ok(await bis(H, `String(${tor}.frame.name) === '3' && !${tor}.anims.isPlaying`), 'Oeffnen endet nicht im offenen Bild');
      assert.strictEqual(sicht().mitte, false, 'das offene Tor sperrt die Sicht');
      const auf = await laufen();
      const ueberAuf = waag ? auf.y < d.y - 20 : auf.x < d.x - 20;
      assert.ok(ueberAuf, 'durch das offene Tor kommt man nicht: ' + JSON.stringify(auf));

      // Und wieder zu: Bild 0, sperrt wieder.
      setzen();
      H.run(`window.DoorSystem.tryInteractDoor(${GS}, window.player)`);
      assert.strictEqual(H.run(`${tor}.getData('doorState')`), 'closed');
      assert.ok(await bis(H, `String(${tor}.frame.name) === '0' && !${tor}.anims.isPlaying`), 'Schliessen endet nicht im geschlossenen Bild');
      assert.strictEqual(sicht().mitte, true);
    });
  }

  test('Flagge weg (DebugGate gestubbt): neue Tuer wird die alte Zeichnung', () => {
    const k = H.run(`(function () {
      var G = window.DebugGate, alt = G.flagge;
      G.flagge = function () { return null; };
      try {
        var t = window.DoorSystem.spawnDoor(${GS}, -500, -500, 'horizontal', 5);
        var k = t.texture.key; t.destroy(); return k;
      } finally { G.flagge = alt; }
    })()`);
    assert.strictEqual(k, 'proc_door_closed_160x24');
  });
});

describe('ohne Flagge', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 3, zusatz: '&room=bsp' });
    assert.ok(raumMitToren(H) > 0, 'kein Raum mit Tueren beider Richtungen');
  });
  after(async () => { if (H) await H.shutdown(); });

  test('die alten Tueren: gezeichnet, Bild = Koerper, keine Torstuecke geladen', () => {
    const r = H.run(`(function () {
      var sc = ${GS};
      return {
        tueren: sc._doors.filter(function (d) { return d.active; }).map(function (d) {
          return { k: d.texture.key, w: d.displayWidth, h: d.displayHeight, bw: d.body.width, bh: d.body.height };
        }),
        tor: Object.keys(window.game.textures.list).filter(function (k) { return /^tor_/.test(k); })
      };
    })()`);
    assert.ok(r.tueren.length >= 2);
    for (const d of r.tueren) {
      assert.ok(/^proc_door_closed_/.test(d.k), 'nicht die alte Tuer: ' + d.k);
      assert.deepStrictEqual([d.w, d.h], [d.bw, d.bh]);
    }
    assert.deepStrictEqual(Array.from(r.tor), [], 'Torstuecke ohne Flagge geladen');
  });
});
