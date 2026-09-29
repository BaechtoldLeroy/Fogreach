// tests/haendlerAuftrag.test.js — der wandernde Haendler waehrend Maras Auftrag.
//
// 'Der Alte mit dem Karren' verlangt EINEN Kauf bei ihm. Gemessen kam er aber
// nur alle ~20 Raeume: Gewicht 15 von 117, und ein Raum wuerfelt ueberhaupt
// nur zu ~40 % ein Ereignis. Solange der Auftrag laeuft, zieht er jetzt
// schwerer — ueber den `gewicht(scene)`-Haken an der Ereignis-Definition.

const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launchDungeon({ depth: 5 });
  H.run(`window.__questOrig = window.questSystem.getActiveQuests`);
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => { H.run(`window.questSystem.getActiveQuests = window.__questOrig`); });
afterEach(() => { H.run(`window.questSystem.getActiveQuests = window.__questOrig`); });

// Anteil des Haendlers an der reinen Ziehung (ohne Ausloese-Chance des Raums).
function anteil(auftragLaeuft, tiefe) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.questSystem.getActiveQuests = function () {
      return ${auftragLaeuft} ? [{ id: 'einfuehrung_amulett' }] : [];
    };
    var treffer = 0, N = 6000;
    for (var i = 0; i < N; i++) {
      var e = window.EventSystem.pickEvent(${tiefe}, sc);
      if (e && e.id === 'wandering_merchant') treffer++;
    }
    return treffer / N;
  })()`);
}

test('mit laufendem Auftrag zieht der Haendler mindestens dreimal so oft', () => {
  const ruht = anteil(false, 5);
  const laeuft = anteil(true, 5);
  assert.ok(ruht > 0.05 && ruht < 0.2,
    'der Grundzustand stimmt nicht mehr: ' + (ruht * 100).toFixed(1) + ' %');
  assert.ok(laeuft >= ruht * 3,
    'der Schub bleibt aus: ' + (ruht * 100).toFixed(1) + ' % -> '
    + (laeuft * 100).toFixed(1) + ' % (nur ' + (laeuft / ruht).toFixed(1) + 'x)');
});

test('ohne den Auftrag bleibt der Haendler so selten wie zuvor', () => {
  // Die Gegenprobe zum Schub: der Grundwert darf sich nicht mitverschieben,
  // sonst waere aus der Auftragshilfe eine allgemeine Balance-Aenderung geworden.
  const ruht = anteil(false, 5);
  const roh = H.run(`(function () {
    var ES = window.EventSystem;
    var m = ES.EVENT_TYPES.filter(function (e) { return e.id === 'wandering_merchant'; })[0];
    var gesamt = ES.EVENT_TYPES.filter(function (e) { return e.minDepth <= 5; })
      .reduce(function (s, e) { return s + e.weight; }, 0);
    return m.weight / gesamt;
  })()`);
  assert.ok(Math.abs(ruht - roh) < 0.03,
    'der Grundzustand weicht vom Grundgewicht ab: ' + (ruht * 100).toFixed(1)
    + ' % gegen ' + (roh * 100).toFixed(1) + ' %');
});

test('der Haendler verdraengt die anderen Ereignisse nicht', () => {
  // Er soll haeufiger kommen, nicht jeden Raum fuellen — sonst faellt waehrend
  // des Auftrags der ganze uebrige Ereignis-Pool aus.
  const laeuft = anteil(true, 5);
  assert.ok(laeuft < 0.5,
    'der Haendler fuellt ' + (laeuft * 100).toFixed(1) + ' % der Ziehungen');
});

test('der Schub haengt an DIESEM Auftrag, nicht an irgendeinem', () => {
  const anderer = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.questSystem.getActiveQuests = function () { return [{ id: 'einfuehrung_markt' }]; };
    var treffer = 0, N = 6000;
    for (var i = 0; i < N; i++) {
      var e = window.EventSystem.pickEvent(5, sc);
      if (e && e.id === 'wandering_merchant') treffer++;
    }
    return treffer / N;
  })()`);
  assert.ok(anderer < 0.2,
    'ein fremder Auftrag hebt den Haendler mit an: ' + (anderer * 100).toFixed(1) + ' %');
});
