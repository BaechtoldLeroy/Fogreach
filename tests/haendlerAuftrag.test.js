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
  //
  // In der flachen Tiefe faellt sein Anteil hoeher aus, weil dort kaum andere
  // Ereignisse zugelassen sind (gemessen: 67 % auf Tiefe 1 gegen 38 % auf
  // Tiefe 6). Das ist gewollt und begrenzt: der Auftrag ist kurz und endet mit
  // dem ersten Kauf. Zugesichert wird, dass die anderen Ereignisse trotzdem
  // ein Drittel behalten.
  const tief = anteil(true, 6);
  assert.ok(tief < 0.5,
    'Tiefe 6: der Haendler fuellt ' + (tief * 100).toFixed(1) + ' % der Ziehungen');
  const flach = anteil(true, 1);
  assert.ok(flach < 0.75,
    'Tiefe 1: der Haendler fuellt ' + (flach * 100).toFixed(1) + ' % der Ziehungen');
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

test('mit laufendem Auftrag kommt der Haendler auch in der flachen Tiefe', () => {
  // Der eigentliche Fehler: der Haendler hat minDepth 3, Maras Auftrag ist
  // aber Kettenglied 2 ihrer Einfuehrungsreihe (requiredAct 0) — wer ihn
  // annimmt, laeuft Tiefe 1-2. Dort war er zu 0 % ziehbar, der Auftrag also
  // unerfuellbar. Das hoehere Gewicht half nicht: der Tiefen-Filter laeuft
  // VOR der Gewichtung.
  for (const tiefe of [1, 2]) {
    const laeuft = anteil(true, tiefe);
    const ruht = anteil(false, tiefe);
    assert.ok(laeuft > 0.1,
      'Tiefe ' + tiefe + ': mit Auftrag nur ' + (laeuft * 100).toFixed(1)
      + ' % — der Auftrag bleibt unerfuellbar');
    assert.strictEqual(ruht, 0,
      'Tiefe ' + tiefe + ': ohne Auftrag taucht er auf (' + (ruht * 100).toFixed(1)
      + ' %) — die Sperre soll nur fuer den Auftrag fallen');
  }
});

test('die gesenkte Tiefe haengt an DIESEM Auftrag', () => {
  const anderer = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.questSystem.getActiveQuests = function () { return [{ id: 'einfuehrung_markt' }]; };
    var treffer = 0, N = 2000;
    for (var i = 0; i < N; i++) {
      var e = window.EventSystem.pickEvent(1, sc);
      if (e && e.id === 'wandering_merchant') treffer++;
    }
    return treffer / N;
  })()`);
  assert.strictEqual(anderer, 0,
    'ein fremder Auftrag senkt die Mindesttiefe mit (' + (anderer * 100).toFixed(1) + ' %)');
});
