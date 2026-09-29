// tests/treppeTuerFrei.test.js — keine Treppe auf einer Tuer.
//
// Die Freiraum-Regel bei der Treppenplatzierung prueft gegen `builtMeta.doors`
// — und das sind die Ein- und Ausgaenge des Raums (tpl.entrances/tpl.exits).
// Die TUERSPRITES kommen aber aus tpl.doorways: den Durchgaengen zwischen den
// BSP-Kammern (proceduralRooms.js), gesetzt in roomTemplates.js ueber
// DoorSystem.spawnDoor. Zwei getrennte Listen — die Regel kannte nur die erste.
//
// Gemessen ueber 500 Raeume: 4 von 31 Treppen lagen im Tuer-Freiraum (12.9 %),
// drei davon direkt auf der Tuer, die engste 16 px von ihrer Mitte entfernt —
// bei einer 80 px breiten Treppe.
//
// Geprueft wird die REINE Regel (window.treppeHaeltTuerFrei). Ueber echte
// Raeume geht es nicht sinnvoll: nur ~7 % tragen eine Tuer, die Verletzungs-
// rate lag bei 6.7 %, und genug Proben dafuer brauchten 162 Sekunden.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

const FREIRAUM = 88;   // DOOR_CLEARANCE in roomManager.js

let H = null;
before(async () => {
  // ?room=bsp nagelt den Generator fest. Ohne ihn wuerfelt jede prozedurale
  // Vorlage ihren Stil, und nur die BSP-Kammern tragen Tueren — es gab
  // Durchgaenge ganz ohne, dann fand der Fall in 400 Raeumen keine einzige.
  H = await launch({ search: '?dungeon=6&room=bsp', renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await H.waitForScene('GameScene', { maxRounds: 250 });
  if (!ok) throw new Error('GameScene wurde nicht erreicht');
  await H.settle(() => false, { maxRounds: 10 });
});
after(async () => { if (H) await H.shutdown(); });

test('die Regel weist einen Platz auf der Tuer zurueck', () => {
  const r = H.run(`(function () {
    var tuer = [{ x: 500, y: 300 }];
    return {
      drauf:  treppeHaeltTuerFrei(500, 300, tuer, ${FREIRAUM}),
      knapp:  treppeHaeltTuerFrei(500 + ${FREIRAUM} - 1, 300, tuer, ${FREIRAUM}),
      genau:  treppeHaeltTuerFrei(500 + ${FREIRAUM}, 300, tuer, ${FREIRAUM}),
      weit:   treppeHaeltTuerFrei(500 + 200, 300, tuer, ${FREIRAUM}),
      schraeg: treppeHaeltTuerFrei(500 + 60, 300 + 60, tuer, ${FREIRAUM})   // 85 px
    };
  })()`);
  assert.strictEqual(r.drauf, false, 'genau auf der Tuer wurde erlaubt');
  assert.strictEqual(r.knapp, false, 'einen Pixel im Freiraum wurde erlaubt');
  assert.strictEqual(r.genau, true, 'genau am Freiraum wurde verboten');
  assert.strictEqual(r.weit, true, 'weit weg wurde verboten');
  assert.strictEqual(r.schraeg, false, 'schraeg im Freiraum (85 px) wurde erlaubt');
});

test('die Regel prueft gegen JEDE Tuer, nicht nur die erste', () => {
  // Der eigentliche Fehler hatte diese Form: eine zweite Tuerliste wurde gar
  // nicht betrachtet. Ein Durchlauf, der nach der ersten Tuer aufhoert, faellt
  // hier ebenso.
  const r = H.run(`(function () {
    var tueren = [{ x: 100, y: 100 }, { x: 500, y: 300 }, { x: 900, y: 700 }];
    return {
      erste: treppeHaeltTuerFrei(100, 100, tueren, ${FREIRAUM}),
      mitte: treppeHaeltTuerFrei(500, 300, tueren, ${FREIRAUM}),
      letzte: treppeHaeltTuerFrei(900, 700, tueren, ${FREIRAUM}),
      dazwischen: treppeHaeltTuerFrei(300, 200, tueren, ${FREIRAUM})
    };
  })()`);
  assert.strictEqual(r.erste, false, 'die erste Tuer wurde nicht geprueft');
  assert.strictEqual(r.mitte, false, 'eine Tuer in der Mitte der Liste wurde uebergangen');
  assert.strictEqual(r.letzte, false, 'die letzte Tuer wurde uebergangen');
  assert.strictEqual(r.dazwischen, true, 'ein freier Platz wurde verboten');
});

test('ohne Tueren ist jeder Platz frei', () => {
  const r = H.run(`(function () {
    return { leer: treppeHaeltTuerFrei(10, 10, [], ${FREIRAUM}),
             nichts: treppeHaeltTuerFrei(10, 10, null, ${FREIRAUM}),
             luecke: treppeHaeltTuerFrei(10, 10, [null, { x: 900, y: 900 }], ${FREIRAUM}) };
  })()`);
  assert.strictEqual(r.leer, true);
  assert.strictEqual(r.nichts, true);
  assert.strictEqual(r.luecke, true, 'ein Loch in der Liste liess die Regel stolpern');
});

test('die Treppenplatzierung kennt die Tueren, die wirklich stehen', () => {
  // Die Gegenprobe zur Ursache: in BSP-Raeumen stehen Tuersprites, die NICHT
  // in builtMeta.doors auftauchen. Genau die waren ungeschuetzt. Dieser Fall
  // sichert nicht die Platzierung selbst (dafuer die Regel oben), sondern
  // dass es solche Tueren ueberhaupt gibt — sonst waere der Fix gegen nichts.
  const fund = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    for (var r = 1; r <= 120; r++) {
      enterRoom(sc, r);
      var tueren = (sc._doors || []).filter(function (d) { return d && d.active; });
      if (tueren.length) {
        var st = sc.stairsGroup.getChildren().filter(function (s) { return s && s.active; });
        var engste = Infinity;
        st.forEach(function (s) {
          tueren.forEach(function (d) {
            var dd = Math.hypot(d.x - s.x, d.y - s.y);
            if (dd < engste) engste = dd;
          });
        });
        return { raum: r, tueren: tueren.length, treppen: st.length,
                 engste: engste === Infinity ? -1 : Math.round(engste) };
      }
    }
    return null;
  })()`);
  assert.ok(fund, 'in 120 Raeumen stand keine einzige Tuer — dann sichert der Fix nichts ab');
  assert.ok(fund.treppen > 0, 'Raum ' + fund.raum + ' hat eine Tuer, aber keine Treppe');
  assert.ok(fund.engste >= FREIRAUM,
    'in Raum ' + fund.raum + ' steht eine Treppe ' + fund.engste + ' px von einer Tuer');
});

test('die geprueften Tueren enthalten die, die wirklich stehen', () => {
  // Der eigentliche Fix. Ohne diesen Fall war er nicht messbar: ihn
  // herauszunehmen liess alle anderen Faelle gruen, weil sie nur die REGEL
  // pruefen und nicht, womit sie gefuettert wird. Ueber echte Treppenplaetze
  // ist das nicht zu messen — nur ~7 % der Raeume tragen eine Tuer und die
  // Verletzungsrate lag bei 6.7 %.
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    for (var i = 1; i <= 120; i++) {
      enterRoom(sc, i);
      var tueren = (sc._doors || []).filter(function (d) { return d && d.active; });
      if (!tueren.length) continue;
      var liste = sc.__treppenTuerListe || [];
      var fehlend = tueren.filter(function (t) {
        return !liste.some(function (l) { return l && l.x === t.x && l.y === t.y; });
      });
      return { raum: i, tueren: tueren.length, geprueft: liste.length, fehlend: fehlend.length };
    }
    return null;
  })()`);
  assert.ok(r, 'in 120 Raeumen stand keine einzige Tuer — dann sichert der Fix nichts ab');
  assert.strictEqual(r.fehlend, 0,
    r.fehlend + ' von ' + r.tueren + ' stehenden Tueren in Raum ' + r.raum
    + ' wurden bei der Treppenplatzierung nicht geprueft (Liste: ' + r.geprueft + ')');
});
