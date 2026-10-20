// tests/kammerSchutt.test.js — Meldung und Belohnung der verschuetteten Kammer (#113).
//
// BEFUND: "Es kommt zu oft die Meldung 'hinter dem Schutt liegt etwas' und dann
// liegt das Item irgendwo rum." Die Kammer oeffnete sich auf JEDES 'destroy'
// ihres Gerölls — auch auf das Abraeumen in enterRoom beim naechsten
// Raumwechsel. Das laeuft NACH dem Leeren der Beute, also landeten Meldung und
// Gegenstand im neuen Raum, an der Stelle der alten Kammer, mitten im Nichts.
// Gemessen ueber 300 Raeume (Tiefe 3): 30 Kammern, 14 nicht aufgeschlagen —
// alle 14 meldeten sich beim Verlassen und warfen ihren Gegenstand ab.
//
// REGEL: Meldung und Gegenstand gibt es nur, wenn eine echte Kammer verschuettet
// wurde UND ihr Geroell zerschlagen wird. Faellt die Kammer aus, faellt der Fund
// in diesem Raum einfach weg.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H;

before(async () => {
  H = await launchDungeon({ depth: 3 });
  // Mitschrift: jede Kammermeldung und jede Beute, getrennt nach Phase.
  H.run(`(function () {
    var HF = window.HiddenFinds;
    window.__ks = { phase: 'bau', toasts: [], beute: [], kammer: null };
    var oVer = HF.verschuetteKammer;
    HF.verschuetteKammer = function (s, k, ox, oy, T) {
      var ok = oVer.apply(this, arguments);
      window.__ks.kammer = ok ? { k: k.kammer, T: T } : null;
      return ok;
    };
    var oToast = window.EventSystem.showToast;
    window.EventSystem.showToast = function (s, t) {
      if (/Schutt gibt nach|rubble gives way/.test(String(t))) window.__ks.toasts.push(window.__ks.phase);
      return oToast.apply(this, arguments);
    };
    var oLoot = window.spawnLoot;
    window.spawnLoot = function (x, y) {
      window.__ks.beute.push({ phase: window.__ks.phase, x: x, y: y });
      return oLoot.apply(this, arguments);
    };
    window.__ksSeed = function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
    window.__ksInKammer = function (K, p) {
      return !!K && K.k.some(function (t) { return p.x >= t.x * K.T && p.x < (t.x + 1) * K.T && p.y >= t.y * K.T && p.y < (t.y + 1) * K.T; });
    };
    // Ein Raum auf dem echten Weg (enterRoom), mit festem Wurf.
    window.__ksRaum = function (seed) {
      var sc = window.game.scene.getScene('GameScene'), alt = Math.random;
      window.__ks.kammer = null;
      window.__ks.phase = 'wechsel';
      Math.random = window.__ksSeed(seed);
      try { window.enterRoom(sc); } finally { Math.random = alt; window.__ks.phase = 'bau'; }
      return window.__ks.kammer;
    };
    window.__ksSchutt = function () {
      return window.obstacles.getChildren().filter(function (o) { return o.active && o.getData('kammerSchutt'); });
    };
    // Fester Lauf: der Vorlagenpool von enterRoom enthaelt die beim Start
    // ungeseedet gewuerfelten prozeduralen Raeume — ohne das schwankt die
    // Kammerzahl desselben Raumseeds von Prozess zu Prozess (wie kammerNische).
    var TT = window.RoomTemplates.TEMPLATES, alt = Math.random;
    Object.keys(TT).forEach(function (n) { if (TT[n]._procedural) delete TT[n]; });
    Math.random = window.__ksSeed(3);
    try { window.initDungeonRun(); } finally { Math.random = alt; }
    return 1;
  })()`);
});

after(async () => { if (H) await H.shutdown(); });

/** Setzt den Fund-Wurf fest (Kammer immer gewuerfelt) und raeumt danach auf. */
function mitKammerWurf(body) {
  return JSON.parse(H.run(`(function () {
    var HF = window.HiddenFinds, oWill = HF.willDurchgang;
    HF.willDurchgang = function () { return true; };
    window.__ks.toasts.length = 0; window.__ks.beute.length = 0;
    try { return JSON.stringify((function () { ${body} })()); }
    finally { HF.willDurchgang = oWill; }
  })()`));
}

test('Kammer zerschlagen: eine Meldung, Belohnung liegt IN der Kammer', () => {
  const r = mitKammerWurf(`
    var K = null;
    for (var s = 1; s < 200 && !K; s++) K = window.__ksRaum(5000 + s);
    if (!K) return { kammer: false };
    var sc = window.game.scene.getScene('GameScene');
    var schutt = window.__ksSchutt();
    window.__ks.toasts.length = 0; window.__ks.beute.length = 0;
    window.__ks.phase = 'schlag';
    schutt.forEach(function (o) { window.breakDestructibleObstacle(sc, o); });
    window.__ks.phase = 'bau';
    var drin = window.__ks.beute.filter(function (b) { return b.phase === 'schlag' && window.__ksInKammer(K, b); });
    return { kammer: true, schutt: schutt.length, toasts: window.__ks.toasts.slice(), drin: drin.length };
  `);
  assert.ok(r.kammer, 'in 200 Raeumen keine verschuettete Kammer — der Fall misst nichts');
  assert.ok(r.schutt > 0, 'die Kammer hat kein Geroell');
  assert.deepStrictEqual(r.toasts, ['schlag'], 'genau eine Meldung beim Zerschlagen erwartet');
  assert.ok(r.drin >= 1, 'die Belohnung liegt nicht in der Kammer');
});

test('Kammer nicht aufgeschlagen: beim Raumwechsel weder Meldung noch Gegenstand', () => {
  const r = mitKammerWurf(`
    var K = null;
    for (var s = 1; s < 200 && !K; s++) K = window.__ksRaum(7000 + s);
    if (!K) return { kammer: false };
    window.__ks.toasts.length = 0; window.__ks.beute.length = 0;
    window.__ksRaum(99999);      // weiter, ohne den Schutt anzuruehren
    var amAltenOrt = window.__ks.beute.filter(function (b) { return window.__ksInKammer(K, b); });
    return { kammer: true, toasts: window.__ks.toasts.slice(), amAltenOrt: amAltenOrt.length };
  `);
  assert.ok(r.kammer, 'in 200 Raeumen keine verschuettete Kammer — der Fall misst nichts');
  assert.deepStrictEqual(r.toasts, [], 'das Abraeumen beim Raumwechsel meldet die Kammer');
  assert.strictEqual(r.amAltenOrt, 0, 'beim Raumwechsel faellt ein Gegenstand an der Stelle der alten Kammer');
});

test('Kammer faellt aus (nicht gestanzt / nicht verschuettet): kein Schutt, keine Meldung, kein Gegenstand', () => {
  // Beide Ausfallwege ueber den echten Raumaufbau: stanzeKammer findet keine
  // Wandflaeche, und verschuetteKammer bricht ab (hier ueber die Treppenregel).
  const r = mitKammerWurf(`
    var HF = window.HiddenFinds, sc = window.game.scene.getScene('GameScene');
    var oStanz = HF.stanzeKammer, oTreppe = window.imTreppenFreiraum;
    var erg = {};
    try {
      HF.stanzeKammer = function () { return null; };
      for (var s = 1; s <= 3; s++) window.__ksRaum(8000 + s);
      erg.ohneStanzeSchutt = window.__ksSchutt().length;
      HF.stanzeKammer = oStanz;

      var gestanzt = 0, verschuettet = 0;
      window.imTreppenFreiraum = function () { return true; };
      HF.stanzeKammer = function () { var k = oStanz.apply(this, arguments); if (k) gestanzt++; return k; };
      for (s = 1; s <= 12; s++) { if (window.__ksRaum(9000 + s)) verschuettet++; }
      erg.gestanzt = gestanzt; erg.verschuettet = verschuettet;
      erg.schuttDanach = window.__ksSchutt().length;
    } finally { HF.stanzeKammer = oStanz; window.imTreppenFreiraum = oTreppe; }
    window.__ksRaum(99998);   // und raus — auch das Verlassen darf nichts melden
    erg.toasts = window.__ks.toasts.slice();
    return erg;
  `);
  assert.strictEqual(r.ohneStanzeSchutt, 0, 'ohne gestanzte Kammer liegt Kammerschutt');
  assert.ok(r.gestanzt > 0, 'keine Kammer gestanzt — der Abbruchweg in verschuetteKammer wird nicht geprueft');
  assert.strictEqual(r.verschuettet, 0, 'die Kammer an der Treppe wurde trotzdem verschuettet');
  assert.strictEqual(r.schuttDanach, 0, 'Kammerschutt blieb nach dem Abbruch liegen');
  assert.deepStrictEqual(r.toasts, [], 'eine ausgefallene Kammer meldet sich trotzdem');
});

test('Sweep ueber 40 Raeume: kein Gegenstand und keine Meldung ohne Zerschlagen', () => {
  // Jeder Raum wuerfelt die Kammer; jede zweite verschuettete wird
  // aufgeschlagen, die anderen bleiben liegen und werden beim Wechsel
  // abgeraeumt. Nur das Aufschlagen darf melden.
  const r = mitKammerWurf(`
    var sc = window.game.scene.getScene('GameScene');
    var kammern = 0, geschlagen = 0, ohne = 0, vorige = null;
    for (var s = 1; s <= 40; s++) {
      var K = window.__ksRaum(11000 + s);
      if (vorige) ohne += window.__ks.beute.filter(function (b) { return b.phase === 'wechsel' && window.__ksInKammer(vorige, b); }).length;
      window.__ks.beute.length = 0;
      vorige = null;
      if (!K) continue;
      kammern++;
      if (kammern % 2) {
        geschlagen++;
        window.__ks.phase = 'schlag';
        window.__ksSchutt().forEach(function (o) { window.breakDestructibleObstacle(sc, o); });
        window.__ks.phase = 'bau';
      } else {
        vorige = K;
      }
    }
    window.__ksRaum(99997);
    if (vorige) ohne += window.__ks.beute.filter(function (b) { return window.__ksInKammer(vorige, b); }).length;
    var t = window.__ks.toasts;
    return { kammern: kammern, geschlagen: geschlagen, ohne: ohne,
      beimWechsel: t.filter(function (p) { return p !== 'schlag'; }).length,
      beimSchlag: t.filter(function (p) { return p === 'schlag'; }).length };
  `);
  assert.ok(r.kammern >= 6, 'nur ' + r.kammern + ' Kammern in 40 Raeumen — der Sweep misst zu wenig');
  assert.strictEqual(r.beimWechsel, 0, 'Meldungen ohne Zerschlagen: ' + r.beimWechsel);
  assert.strictEqual(r.ohne, 0, 'Gegenstaende ohne Zerschlagen: ' + r.ohne);
  assert.strictEqual(r.beimSchlag, r.geschlagen, 'nicht jede aufgeschlagene Kammer meldet sich genau einmal');
});
