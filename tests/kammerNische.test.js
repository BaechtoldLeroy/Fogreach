// tests/kammerNische.test.js — keine dunklen Reste der verschuetteten Kammer (#113).
//
// BEFUND: "Es spawnen nun manchmal dunkle Bereiche, als ob das eine Kammer
// haette sein sollen, die es nicht an eine Mauer geschafft hat."
// Gemessen ueber 100 Raeume (Tiefe 5, Kammer erzwungen):
//  - 99 Raeume trugen die schwarze Verdeckung einer FRUEHEREN Kammer mitten
//    auf dem Boden. Sie hing an keiner Raumliste; bis b465 verschwand sie nur,
//    weil das Abraeumen beim Raumwechsel die Kammer "oeffnete".
//  - 2 von 49 gestanzten Kammern blieben als offene, leere Nische stehen
//    (verschuetteKammer brach nach dem Stanzen ab).
//
// REGEL: Eine Kammer wird nur gestanzt, wenn sie im Mauerband steckt und ihr
// Vorplatz erreichbar ist. Scheitert sie danach doch, wird sie exakt
// zurueckgemauert. Ihre Verdeckung lebt nie laenger als ihr Raum.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H;

before(async () => {
  H = await launchDungeon({ depth: 3 });
  H.run(`(function () {
    var HF = window.HiddenFinds;
    window.__kn = { stanz: null, vorStanz: null, ok: null, toasts: 0, beute: 0 };
    var oStanz = HF.stanzeKammer, oVer = HF.verschuetteKammer;
    HF.stanzeKammer = function (raster) {
      window.__kn.vorStanz = raster.map(function (z) { return z.slice(); });
      var k = oStanz.apply(this, arguments);
      window.__kn.stanz = k;
      return k;
    };
    HF.verschuetteKammer = function () {
      window.__kn.drin = true;
      try { var ok = oVer.apply(this, arguments); } finally { window.__kn.drin = false; }
      window.__kn.ok = ok;
      return ok;
    };
    var oToast = window.EventSystem.showToast;
    window.EventSystem.showToast = function (s, t) {
      if (/Schutt gibt nach|rubble gives way/.test(String(t))) window.__kn.toasts++;
      return oToast.apply(this, arguments);
    };
    window.__knSeed = function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
    window.__knRaum = function (seed, kammer) {
      var sc = window.game.scene.getScene('GameScene'), alt = Math.random, oWill = HF.willDurchgang;
      window.__kn.stanz = null; window.__kn.vorStanz = null; window.__kn.ok = null;
      HF.willDurchgang = function () { return kammer !== false; };
      Math.random = window.__knSeed(seed);
      try { window.enterRoom(sc); } finally { Math.random = alt; HF.willDurchgang = oWill; }
      return window.__kn.stanz;
    };
    window.__knVerdeckung = function () {
      var sc = window.game.scene.getScene('GameScene');
      return sc.children.list.filter(function (o) { return o && o.active && o.getData && o.getData('kammerVerdeckung'); });
    };
    window.__knSchutt = function () {
      return window.obstacles.getChildren().filter(function (o) { return o.active && o.getData('kammerSchutt'); });
    };
    // Liegt die Kammer ganz im Mauerband? Ring ausser der Zugangsseite = Wand.
    window.__knRingOffen = function (grid, k) {
      var xs = k.kammer.map(function (t) { return t.x; }), ys = k.kammer.map(function (t) { return t.y; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      var m = k.mund, offen = 0;
      for (var y = y0 - 1; y <= y1 + 1; y++) for (var x = x0 - 1; x <= x1 + 1; x++) {
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
        var zugang = (m.x < x0 && x < x0) || (m.x > x1 && x > x1) || (m.y < y0 && y < y0) || (m.y > y1 && y > y1);
        if (!zugang && grid[y][x] !== '#') offen++;
      }
      return offen;
    };
    return 1;
  })()`);
});

after(async () => { if (H) await H.shutdown(); });

test('Sweep: jede gestanzte Kammer ist verschuettet, erreichbar, im Mauerband — und keine fremde Verdeckung', () => {
  const r = JSON.parse(H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene'), T = 32;
    var erg = { raeume: 0, gestanzt: 0, ohneSchutt: 0, unerreichbar: 0, ringOffen: 0, fremd: 0, luecke: 0 };
    for (var s = 1; s <= 20; s++) {
      var k = window.__knRaum(21000 + s);
      erg.raeume++;
      T = sc._minimapTileSize || 32;
      var verd = window.__knVerdeckung(), schutt = window.__knSchutt();
      verd.forEach(function (g) {
        var f = g.__flaeche;
        var mein = !!(k && window.__kn.ok && k.kammer.some(function (t) {
          return t.x * T >= f.x - 1 && t.x * T < f.x + f.w && t.y * T >= f.y - 1 && t.y * T < f.y + f.h; }));
        if (!mein) erg.fremd++;
      });
      if (!k) { if (schutt.length) erg.luecke++; continue; }
      erg.gestanzt++;
      if (!window.__kn.ok) {
        // Gescheitert: dann muss das Raster wieder genau wie vorher sein.
        var gleich = window.__kn.vorStanz.every(function (z, y) { return String(sc._minimapWallsGrid[y]) === String(z); });
        if (!gleich) erg.ohneSchutt++;
        continue;
      }
      if (!schutt.length) erg.ohneSchutt++;
      if (!k.kammer.some(function (t) { return sc.isPointAccessible((t.x + 0.5) * T, (t.y + 0.5) * T); })) erg.unerreichbar++;
      if (window.__knRingOffen(sc._minimapWallsGrid, k)) erg.ringOffen++;
    }
    return JSON.stringify(erg);
  })()`));
  assert.ok(r.gestanzt >= 6, 'nur ' + r.gestanzt + ' Kammern in ' + r.raeume + ' Raeumen — der Sweep misst zu wenig');
  assert.strictEqual(r.fremd, 0, 'Verdeckung einer frueheren Kammer liegt im neuen Raum: ' + r.fremd);
  assert.strictEqual(r.ohneSchutt, 0, 'gestanzt, aber offen und ohne Geroell: ' + r.ohneSchutt);
  assert.strictEqual(r.unerreichbar, 0, 'verschuettete Kammer nicht erreichbar: ' + r.unerreichbar);
  assert.strictEqual(r.ringOffen, 0, 'Kammer steht nicht ganz im Mauerband: ' + r.ringOffen);
  assert.strictEqual(r.luecke, 0, 'Kammerschutt ohne Kammer: ' + r.luecke);
});

test('Kammer nicht aufgeschlagen: die Verdeckung wandert nicht in den naechsten Raum', () => {
  const r = JSON.parse(H.run(`(function () {
    var k = null;
    for (var s = 1; s < 80 && !(k && window.__kn.ok); s++) k = window.__knRaum(23000 + s);
    if (!(k && window.__kn.ok)) return JSON.stringify({ kammer: false });
    var vorher = window.__knVerdeckung().length;
    // Der Raumaufbau selbst muss abraeumen, nicht nur der Zufall, dass das
    // Geroell beim Wechsel ein 'destroy' meldet: die Hoerer abhaengen.
    window.__knSchutt().forEach(function (o) { o.removeAllListeners('destroy'); });
    window.__knRaum(23999, false);       // weiter ohne Kammer, Schutt unberuehrt
    return JSON.stringify({ kammer: true, vorher: vorher, nachher: window.__knVerdeckung().length });
  })()`));
  assert.ok(r.kammer, 'keine verschuettete Kammer gefunden — der Fall misst nichts');
  assert.strictEqual(r.vorher, 1, 'die Kammer hatte keine Verdeckung');
  assert.strictEqual(r.nachher, 0, 'die Verdeckung der alten Kammer liegt im neuen Raum');
});

test('Scheitert die Kammer nach dem Stanzen, wird sie exakt zurueckgemauert', () => {
  // Zwei Ausfallwege: die Treppenregel und eine Ausnahme beim Geroell.
  const r = JSON.parse(H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene'), HF = window.HiddenFinds;
    var oTreppe = window.imTreppenFreiraum, oSpawn = sc.spawnObstacle;
    var faelle = [];
    var pruefe = function (art) {
      var k = window.__kn.stanz, T = sc._minimapTileSize || 32;
      if (!k) return;
      var grid = sc._minimapWallsGrid;
      var gleich = window.__kn.vorStanz.every(function (z, y) { return String(grid[y]) === String(z); });
      var mitte = k.kammer[4] || k.kammer[0];
      var px = (mitte.x + 0.5) * T, py = (mitte.y + 0.5) * T;
      var wand = window.obstacles.getChildren().some(function (o) {
        var b = o.body;
        return o.active && b && b.enable && o.getData('kammerZugemauert')
          && px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height;
      });
      var sicht = window.isBlockedByObstacle ? window.isBlockedByObstacle(px, py) : null;
      faelle.push({ art: art, ok: window.__kn.ok, gleich: gleich, wand: wand, sicht: sicht,
        betretbar: k.kammer.some(function (t) { return sc.isPointAccessible((t.x + 0.5) * T, (t.y + 0.5) * T); }),
        schutt: window.__knSchutt().length, verdeckung: window.__knVerdeckung().length,
        markierung: !!sc._kammerMarkierung });
    };
    window.__kn.toasts = 0;
    try {
      window.imTreppenFreiraum = function () { return true; };
      for (var s = 1; s <= 30 && faelle.length < 2; s++) { window.__knRaum(25000 + s); pruefe('treppe'); }
      window.imTreppenFreiraum = oTreppe;
      var n = faelle.length;
      sc.spawnObstacle = function (x, y, key) { if (key === 'rubble' && window.__kn.drin) throw new Error('Testausfall'); return oSpawn.apply(this, arguments); };
      for (s = 1; s <= 30 && faelle.length < n + 2; s++) { window.__knRaum(26000 + s); pruefe('ausnahme'); }
    } finally { window.imTreppenFreiraum = oTreppe; sc.spawnObstacle = oSpawn; }
    return JSON.stringify({ faelle: faelle, toasts: window.__kn.toasts });
  })()`));
  assert.ok(r.faelle.filter((f) => f.art === 'treppe').length >= 1, 'kein Treppen-Ausfall erzeugt');
  assert.ok(r.faelle.filter((f) => f.art === 'ausnahme').length >= 1, 'kein Ausnahme-Ausfall erzeugt');
  r.faelle.forEach((f) => {
    const wo = JSON.stringify(f);
    assert.strictEqual(f.ok, false, 'die Kammer haette scheitern muessen ' + wo);
    assert.strictEqual(f.gleich, true, 'Raster nicht wie vor dem Stanzen ' + wo);
    assert.strictEqual(f.wand, true, 'kein Wandkoerper in der Kammer ' + wo);
    if (f.sicht !== null) assert.strictEqual(f.sicht, true, 'man sieht durch die zugemauerte Kammer ' + wo);
    assert.strictEqual(f.betretbar, false, 'die zugemauerte Kammer ist noch begehbar ' + wo);
    assert.strictEqual(f.schutt, 0, 'Geroell blieb liegen ' + wo);
    assert.strictEqual(f.verdeckung, 0, 'Verdeckung blieb stehen ' + wo);
    assert.strictEqual(f.markierung, false, 'Minikarten-Marker zeigt auf die verworfene Kammer ' + wo);
  });
  assert.strictEqual(r.toasts, 0, 'eine verworfene Kammer meldet sich');
});

test('Verschwindet der Schutt ohne Zerschlagen im selben Raum, faellt die Verdeckung ohne Belohnung', () => {
  const r = JSON.parse(H.run(`(function () {
    var k = null;
    for (var s = 1; s < 80 && !(k && window.__kn.ok); s++) k = window.__knRaum(27000 + s);
    if (!(k && window.__kn.ok)) return JSON.stringify({ kammer: false });
    window.__kn.toasts = 0;
    var vorher = window.__knVerdeckung().length;
    window.__knSchutt().forEach(function (o) { o.destroy(); });
    return JSON.stringify({ kammer: true, vorher: vorher, nachher: window.__knVerdeckung().length, toasts: window.__kn.toasts });
  })()`));
  assert.ok(r.kammer, 'keine verschuettete Kammer gefunden — der Fall misst nichts');
  assert.strictEqual(r.vorher, 1);
  assert.strictEqual(r.nachher, 0, 'schwarzer Kasten vor einer offenen Kammer');
  assert.strictEqual(r.toasts, 0, 'Abraeumen ist kein Aufschlagen — keine Meldung');
});
