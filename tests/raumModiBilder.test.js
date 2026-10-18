// tests/raumModiBilder.test.js — Pixelbilder und Messing-Toasts der
// Sonderraum-Modi (js/roomModeBilder.js, fest eingebaut — keine Flagge mehr).
//
// Immer: Rudelfuehrer-Siegel folgt dem Anfuehrer, Pixel-Altar in
// derselben Groesse mit demselben Koerper (beschaedigt als eigenes Bild),
// Bannkreis-Siegel mit Sanduhr, Fluchtsiegel an der Treppe, Toasts mit
// Modus-Symbol (Start, Fortschritt, Erfolg, Misserfolg), HUD-Zeile auf
// Messingplatte mit Kontrast >= 4,5. Nur wenn ein Bild (oder das Banner)
// fehlt, bleibt die alte Zeichnung bzw. der alte Text. Die Mechanik
// (Altar-Leben, Koerper) ist mit und ohne Bilder dieselbe.
//
// Die Modi werden wie in altarTiefe.test.js ueber RoomMode.create(...) und
// arm/start gezielt aufgebaut. Fuer Anzeige und Toasts legt der Test eine
// Vorgabe ueber window.RoomMode (welcher Modus laeuft, welcher Zustand) —
// RoomModeVisuals.sync liest genau diese Schnittstelle je Bild.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');
const { kontraste, alleLesbar } = require('./kontrastMessung.js');

const SC = "window.game.scene.getScene('GameScene')";
// Der Koerper des Altars: 48x22 ab (8,34), nur das Steinpodest des 64x60-
// Bildes. Bis b448 zog updateFromGameObject() den statischen Koerper wieder
// auf die volle Bildgroesse (damals hier als '64x60@0,0' festgehalten);
// s. altarFest.test.js. Gemessen wird, dass Bilder daran nichts aendern.
const KOERPER = '48x22@8,34';
// Ergebnisse kommen aus dem vm-Realm: als JSON vergleichen, nicht deepStrictEqual.
const gleich = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);

/** Vorgabe ueber RoomMode legen: mv = { id, state | () => state, done } in window.__mv. */
function vorgabeLegen(H) {
  H.run(`(function () {
    var R = window.RoomMode; window.__echtRM = R; window.__mv = null;
    window.RoomMode = Object.assign({}, R, {
      isSpecialRoom: function () { return !!window.__mv || R.isSpecialRoom(); },
      activeModeId: function () { return window.__mv ? window.__mv.id : R.activeModeId(); },
      activeState: function () {
        var m = window.__mv; if (!m) return R.activeState();
        return typeof m.state === 'function' ? m.state() : m.state;
      },
      isObjectiveComplete: function () { return window.__mv ? !!window.__mv.done : R.isObjectiveComplete(); }
    });
    window._playerInvincible = true;
  })()`);
}

function texturen(H) {
  return H.run(`${SC}.children.list.filter(function (o) { return o.active && o.texture; })
    .map(function (o) { return o.texture.key; })`);
}

/** Altar aufbauen und 'sekunden' lang mit n Gegnern im Kreis drainen (ohne Nachschub). */
function altarLauf(H, n, schritte) {
  return H.run(`(function () {
    var sc = ${SC};
    var m = window.RoomMode.create('defend', {});
    m.arm(sc); m.start(sc);
    var sp = sc.children.list.filter(function (o) {
      return o.texture && /altar/.test(o.texture.key) && o.body; }).pop();
    var echtG = window.enemies, echtS = window.spawnEnemy;
    var st = m.getState(), feinde = [];
    for (var i = 0; i < ${n}; i++) feinde.push({ active: true, x: st.x + 10, y: st.y + 10 });
    window.enemies = { getChildren: function () { return feinde; }, countActive: function () { return feinde.length; } };
    window.spawnEnemy = function () {};
    var verlauf = [];
    try {
      for (var k = 0; k < ${schritte}; k++) { m.update(250); verlauf.push(m.getState().hp); }
    } finally { window.enemies = echtG; window.spawnEnemy = echtS; }
    var r = { key: sp.texture.key, w: sp.width, h: sp.height, bw: sp.body.width, bh: sp.body.height,
      bx: sp.body.x - (sp.x - sp.displayWidth * sp.originX), by: sp.body.y - (sp.y - sp.displayHeight * sp.originY),
      verlauf: verlauf, tint: sp.isTinted ? sp.tintTopLeft : null };
    m.stop();
    return r;
  })()`);
}

describe('immer neu: Bilder ohne jede Flagge', () => {
  let H = null;
  before(async () => {
    // Bewusst ohne ?debug=1 und ohne raummodi — die Bilder gelten immer.
    H = await launchDungeon({ depth: 3 });
    vorgabeLegen(H);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('alle Modus-Bilder sind vorgeladen', () => {
    const fehlt = H.run(`(function () { var B = window.RoomModeBilder, sc = ${SC}, k = [];
      Object.keys(B.BILDER).forEach(function (n) { k.push(B.BILDER[n]); });
      Object.keys(B.SIEGEL).forEach(function (n) { k.push(B.SIEGEL[n].key); });
      Object.keys(B.SYMBOL).forEach(function (n) { k.push(B.SYMBOL[n]); });
      return k.filter(function (x) { return !sc.textures.exists(x); }); })()`);
    gleich(fehlt, []);
  });

  test('Verteidigung: Pixel-Altar in alter Groesse, gleicher Koerper, beschaedigt als eigenes Bild', () => {
    // 30 Viertelsekunden mit 4 Gegnern: Leben unter 35 %, aber noch nicht 0.
    const r = altarLauf(H, 4, 30);
    assert.strictEqual(r.w + 'x' + r.h, '64x60', 'Altar nicht 64x60: ' + JSON.stringify(r));
    assert.strictEqual(r.bw + 'x' + r.bh + '@' + Math.round(r.bx) + ',' + Math.round(r.by), KOERPER, JSON.stringify(r));
    assert.ok(r.verlauf[r.verlauf.length - 1] > 0 && r.verlauf[r.verlauf.length - 1] / 100 < 0.35, 'Aufbau: Altar nicht unter 35 %: ' + r.verlauf.slice(-1));
    assert.strictEqual(r.key, 'raummodus_altar_rissig', 'beschaedigter Altar zeigt nicht das Rissbild');
    assert.strictEqual(r.tint, null, 'das Rissbild soll nicht zusaetzlich rot getoent sein');
    H.run('window.__altarVerlauf = ' + JSON.stringify(r.verlauf));
  });

  test('Verteidigung: frischer Altar zeigt das heile Bild', () => {
    const r = altarLauf(H, 0, 2);
    assert.strictEqual(r.key, 'raummodus_altar');
  });

  test('Jagd: Siegel unter dem Anfuehrer folgt ihm, Kopfmarke mit Jagd-Symbol', () => {
    const r = H.run(`(function () {
      var sc = ${SC};
      var t = enemies.getChildren().filter(function (e) { return e.active; })[0];
      if (!t) { window.spawnEnemy.call(sc, player.x + 160, player.y, 'enemy'); }
      return !!t;
    })()`);
    if (!r) H.step(30);
    // Der echte Jagdmodus waehlt den Anfuehrer (ankerPunkt -> start) und
    // liefert Fusslinie und Kopf in getState().
    H.run(`(function () {
      var sc = ${SC};
      var m = window.RoomMode.create('hunt', {});
      m.arm(sc); m.ankerPunkt();
      var echtS = window.spawnEnemy; window.spawnEnemy = function () {};
      try { m.start(sc); } finally { window.spawnEnemy = echtS; }
      window.__ziel = enemies.getChildren().filter(function (e) { return e.__huntTarget; })[0];
      window.__mv = { id: 'hunt', state: function () { return m.getState(); } };
    })()`);
    H.step(2);
    const lage = () => H.run(`(function () {
      var sc = ${SC}, t = window.__ziel;
      var s = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'raummodus_siegel_jagd'; });
      var k = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'raummodus_symbol_jagd' && o.depth === 460; });
      return { n: s.length, sx: s[0] && s[0].x, sy: s[0] && s[0].y, tiefe: s[0] && s[0].depth, sicht: s[0] && s[0].visible,
        maske: !!(s[0] && s[0].mask), kopf: k.length, kopfY: k[0] && k[0].y,
        tx: t.x, fuss: t.y + t.displayHeight * (1 - t.originY), oben: t.y - t.displayHeight * t.originY };
    })()`);
    // Exakt: das Siegel wird nach der Physik (postupdate) nachgezogen, nicht
    // nur in update() — sonst hinkt es dem laufenden Anfuehrer ein Bild nach.
    // Gemessen wird in einem Bild, in dem er WIRKLICH laeuft (Schub, dann
    // takten, bis er sich bewegt hat) — sonst sieht man das Nachhinken nicht.
    H.run('if (window.__ziel.body) window.__ziel.body.setVelocity(120, 60);');
    let a = lage();
    for (let i = 0; i < 120; i++) {
      const vorher = a;
      H.step(1);
      a = lage();
      if (Math.abs(a.tx - vorher.tx) > 0.5 || Math.abs(a.fuss - vorher.fuss) > 0.5) break;
    }
    assert.strictEqual(a.n, 1, 'kein Rudelfuehrer-Siegel: ' + JSON.stringify(a));
    assert.ok(a.sicht, 'Siegel unsichtbar');
    assert.ok(Math.abs(a.sx - a.tx) < 0.01 && Math.abs(a.sy - a.fuss) < 0.01, 'Siegel nicht unter den Fuessen: ' + JSON.stringify(a));
    assert.ok(a.tiefe < 50, 'Siegel liegt nicht unter den Figuren (Gegnerlayer 50): ' + a.tiefe);
    assert.strictEqual(a.kopf, 1, 'keine Kopfmarke');
    assert.ok(a.kopfY < a.oben, 'Kopfmarke nicht ueber dem Kopf: ' + JSON.stringify(a));
    H.run('window.__ziel.x += 70; window.__ziel.y += 40; if (window.__ziel.body) window.__ziel.body.reset(window.__ziel.x, window.__ziel.y);');
    H.step(1);
    a = lage();
    assert.ok(Math.abs(a.sx - a.tx) < 0.01 && Math.abs(a.sy - a.fuss) < 0.01, 'Siegel folgt nicht: ' + JSON.stringify(a));
    // Anfuehrer tot -> Marke weg.
    H.run('window.__ziel.setActive(false)');
    H.step(1);
    a = lage();
    assert.ok(!a.sicht, 'Siegel bleibt nach dem Tod stehen');
    // Direkt in einen anderen Sonderraum (Rundgang): das Siegel gehoert zum alten Raum.
    H.run('window.__ziel.setActive(true)');
    H.step(1);
    assert.ok(lage().sicht, 'Aufbau: Siegel nicht wieder sichtbar');
    H.run(`window.__mv = { id: 'defend', state: { mode: 'defend', seconds: 30, hp: 100, maxHp: 100, x: 0, y: 0 } }`);
    H.step(1);
    assert.strictEqual(lage().n, 0, 'Siegel bleibt im naechsten Sonderraum liegen');
    H.run('window.__mv = null');
    H.step(1);
    assert.strictEqual(lage().n, 0, 'Siegel bleibt nach dem Raum liegen');
  });

  test('Durchhalten: Bannkreis-Siegel mit Sanduhr statt Zeichnung; stop raeumt beides', () => {
    const r = H.run(`(function () {
      var sc = ${SC}; var m = window.RoomMode.create('survival', {});
      var p = m.arm(sc);
      var s = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'raummodus_siegel_bannkreis'; });
      var u = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'raummodus_sanduhr'; });
      var alt = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'roommode_survival_bannkreis'; });
      var r = { s: s.length, u: u.length, alt: alt.length, sx: s[0] && s[0].x, sy: s[0] && s[0].y, tiefe: s[0] && s[0].depth,
        uhrX: u[0] && u[0].x, anim: !!(s[0] && s[0].anims && s[0].anims.isPlaying), px: p.x, py: p.y };
      m.stop();
      r.nachStop = sc.children.list.filter(function (o) { return o.texture && /raummodus_(siegel_bannkreis|sanduhr)/.test(o.texture.key); }).length;
      return r;
    })()`);
    assert.strictEqual(r.s + '/' + r.u + '/' + r.alt, '1/1/0', JSON.stringify(r));
    assert.ok(r.sx === r.px && r.sy === r.py, 'Siegel nicht am Anker: ' + JSON.stringify(r));
    assert.strictEqual(r.tiefe, -2, 'Bodenring soll wie bisher auf -2 liegen');
    assert.ok(r.anim, 'Siegel ist nicht animiert');
    assert.strictEqual(r.uhrX, r.px);
    assert.strictEqual(r.nachStop, 0);
  });

  test('Flucht: Fluchtsiegel und Pfeil an jeder Treppe; stop raeumt', () => {
    const r = H.run(`(function () {
      var sc = ${SC}; var m = window.RoomMode.create('escape', {});
      var treppen = sc.stairsGroup.getChildren().filter(function (s) { return s.active; });
      window.__echtSpawn = window.spawnEnemy; window.spawnEnemy = function () {};
      m.start(sc, {});
      window.spawnEnemy = window.__echtSpawn;
      var s = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'raummodus_siegel_flucht'; });
      var p = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'raummodus_fluchtpfeil'; });
      var r = { treppen: treppen.length, s: s.length, p: p.length,
        dx: s[0] ? Math.abs(s[0].x - treppen[0].x) : -1, unter: s[0] ? s[0].depth < treppen[0].depth : false,
        dauer: m.getState().duration };
      m.stop();
      r.nachStop = sc.children.list.filter(function (o) { return o.texture && /raummodus_(siegel_flucht|fluchtpfeil)/.test(o.texture.key); }).length;
      return r;
    })()`);
    assert.ok(r.treppen > 0, 'Aufbau: keine Treppe');
    assert.strictEqual(r.s, r.treppen, JSON.stringify(r));
    assert.strictEqual(r.p, r.treppen, JSON.stringify(r));
    assert.ok(r.dx < 1 && r.unter, 'Siegel nicht unter der Treppe: ' + JSON.stringify(r));
    assert.strictEqual(r.nachStop, 0);
  });

  function toastNach(H) {
    return H.run(`(function () { var e = ${SC}._activeEventToast;
      if (!e) return null;
      var bild = e.teile.filter(function (t) { return t.type === 'Image' && /symbol/.test(t.texture.key); })[0];
      return { art: e.art, bild: bild ? bild.texture.key : null, text: e.label.text }; })()`);
  }

  test('Start-Toast: Messing-Banner mit Modus-Symbol und Text, kein alter Kasten', () => {
    for (const [id, sym, wort] of [['defend', 'verteidigung', 'Altar'], ['hunt', 'jagd', 'Rudelführer'],
      ['escape', 'flucht', 'Flucht'], ['survival', 'durchhalten', 'Überlebe']]) {
      H.run(`window.__mv = null`); H.step(1);
      H.run(`window.__mv = { id: '${id}', state: { mode: '${id}', seconds: 30, remaining: 30, hp: 100, maxHp: 100, x: 0, y: 0 } }`);
      H.step(1);
      const t = toastNach(H);
      assert.ok(t, id + ': kein Toast');
      assert.strictEqual(t.art, 'raummodus_symbol_' + sym, id);
      assert.strictEqual(t.bild, 'raummodus_symbol_' + sym, id + ': im Banner steht ein anderes Medaillon');
      assert.ok(t.text.indexOf(wort) >= 0, id + ': Text fehlt: ' + t.text);
      const alt = H.run(`${SC}.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 1649 && o.visible; }).length`);
      assert.strictEqual(alt, 0, id + ': alter Banner-Kasten sichtbar');
    }
  });

  test('Fortschritt: noch 10 Sekunden und der Altar broeckelt — je einmal', () => {
    H.run(`window.__mv = null`); H.step(1);
    H.run(`window.__mv = { id: 'defend', state: { mode: 'defend', seconds: 30, hp: 100, maxHp: 100, x: 0, y: 0 } }`);
    H.step(1);
    H.run(`window.__mv.state = { mode: 'defend', seconds: 9, hp: 100, maxHp: 100, x: 0, y: 0 }`);
    H.step(1);
    assert.match(toastNach(H).text, /10 Sekunden/);
    H.run(`${SC}._activeEventToast.teile.forEach(function (t) { t.destroy(); }); ${SC}._activeEventToast = null;`);
    H.step(1);
    assert.strictEqual(toastNach(H), null, 'zweiter 10-Sekunden-Toast');
    H.run(`window.__mv.state = { mode: 'defend', seconds: 8, hp: 30, maxHp: 100, x: 0, y: 0 }`);
    H.step(1);
    const t = toastNach(H);
    assert.match(t.text, /Altar bröckelt/);
    assert.strictEqual(t.art, 'raummodus_symbol_verteidigung');
  });

  test('HUD-Zeile auf Messingplatte mit Symbol; Kontrast >= 4,5 in allen Zustaenden', () => {
    H.run(`${SC}._activeEventToast && ${SC}._activeEventToast.teile.forEach(function (t) { t.destroy(); }); ${SC}._activeEventToast = null;`);
    for (const [st, done] of [[{ hp: 80, failed: false }, false], [{ hp: 80, failed: false }, true], [{ hp: 0, failed: true }, true]]) {
      H.run(`window.__mv = { id: 'defend', done: ${done}, state: { mode: 'defend', seconds: 12, hp: ${st.hp}, maxHp: 100, failed: ${st.failed}, x: 0, y: 0 } }`);
      H.step(1);
      const r = H.run(`(function () { var sc = ${SC};
        // Titel und Info des alten Banners liegen auch auf 1650, aber unsichtbar.
        var t = sc.children.list.filter(function (o) { return o.type === 'Text' && o.depth === 1650 && o.visible; })[0];
        var p = sc.children.list.filter(function (o) { return o.texture && /^ui_leiste@/.test(o.texture.key) && o.depth === 1649 && o.visible; });
        var s = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'raummodus_symbol_verteidigung' && o.depth === 1650 && o.visible; });
        return { platte: p.length, symbol: s.length, text: t.text, symRechts: s[0] && s[0].x + s[0].displayWidth / 2, links: t.x - t.width / 2, rechts: t.x + t.width / 2,
          pl: p[0] && p[0].x - p[0].displayWidth / 2, pr: p[0] && p[0].x + p[0].displayWidth / 2 }; })()`);
      assert.strictEqual(r.platte, 1, 'keine Messingplatte: ' + JSON.stringify(r));
      assert.strictEqual(r.symbol, 1, 'kein Symbol auf der Platte');
      assert.ok(r.links > r.pl && r.rechts < r.pr, 'Text ragt aus der Platte: ' + JSON.stringify(r));
      assert.ok(r.symRechts <= r.links, 'Symbol liegt auf dem Text: ' + JSON.stringify(r));
      // Der Text steht mittig im Feld RECHTS vom Symbol, nicht mittig auf der Platte.
      const mitteFeld = (r.symRechts + r.pr) / 2, mitteText = (r.links + r.rechts) / 2;
      assert.ok(Math.abs(mitteFeld - mitteText) < 8, 'Text nicht neben dem Symbol zentriert: ' + JSON.stringify(r));
      alleLesbar(kontraste(H, `${SC}.children.list.filter(function (o) { return o.type === 'Text' && o.depth === 1650; })`),
        'HUD ' + JSON.stringify(st) + (done ? ' erfuellt' : ''));
    }
  });

  test('Erfolg und Misserfolg: markRoomCleared zeigt den Modus-Toast statt des alten Textes', () => {
    for (const [failed, wort] of [[false, '✓ Der Altar hat gehalten!'], [true, '✗ Der Altar ist zerbrochen.']]) {
      H.run(`window.__mv = { id: 'defend', done: true, state: { mode: 'defend', seconds: 0, hp: 50, maxHp: 100, x: 0, y: 0 } }`);
      H.step(1);
      H.run(`window.markRoomCleared({ objective: true, failed: ${failed} })`);
      H.step(2);
      const t = toastNach(H);
      assert.ok(t && t.text === wort, 'kein Ziel-Toast: ' + JSON.stringify(t));
      assert.strictEqual(t.art, 'raummodus_symbol_verteidigung');
      const alt = H.run(`${SC}.children.list.filter(function (o) { return o.type === 'Text' && o.depth === 2200; }).length`);
      assert.strictEqual(alt, 0, 'alter Ziel-Text erscheint zusaetzlich');
    }
    H.run('window.__mv = null');
  });

  test('Rueckfall: fehlt ein Bild, zeichnet der Modus wie bisher', () => {
    const r = H.run(`(function () { var sc = ${SC};
      sc.textures.remove('raummodus_altar'); sc.textures.remove('raummodus_siegel_bannkreis');
      var d = window.RoomMode.create('defend', {}); d.arm(sc);
      var s = window.RoomMode.create('survival', {}); s.arm(sc);
      var k = sc.children.list.filter(function (o) { return o.texture && /^roommode_(defend_altar|survival_bannkreis)$/.test(o.texture.key); }).length;
      var uhr = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'raummodus_sanduhr'; }).length;
      d.stop(); s.stop(); return { alt: k, uhr: uhr }; })()`);
    gleich(r, { alt: 2, uhr: 0 });
  });

  test('Rueckfall: ohne Messing-Banner (ui_toast fehlt) steht das alte Start-Banner', () => {
    H.run(`window.__mv = null`); H.step(1);
    H.run(`${SC}._activeEventToast = null; ${SC}.textures.remove('ui_toast');
      window.__mv = { id: 'hunt', state: { mode: 'hunt', targetAlive: false, x: 0, y: 0 } }`);
    // Auch spaeter kein nachgeladener Toast obendrauf (kein halber Messing-Toast).
    H.step(40);
    const r = H.run(`(function () { var sc = ${SC};
      return { toast: !!sc._activeEventToast,
        kasten: sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 1649 && o.visible; }).length }; })()`);
    gleich(r, { toast: false, kasten: 1 });
    H.run('window.__mv = null');
  });
});

describe('Rueckfall: ohne Modus-Bilder alles wie bisher', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 3 });
    vorgabeLegen(H);
    // Alle Modus-Bilder fehlen (z. B. Ladefehler): jede Stelle zeichnet wie frueher.
    H.run(`(function () { var B = window.RoomModeBilder, sc = ${SC};
      Object.keys(B.BILDER).forEach(function (n) { sc.textures.remove(B.BILDER[n]); });
      Object.keys(B.SIEGEL).forEach(function (n) { sc.textures.remove(B.SIEGEL[n].key); });
      Object.keys(B.SYMBOL).forEach(function (n) { sc.textures.remove(B.SYMBOL[n]); }); })()`);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Altar und Bannkreis gezeichnet, keine Fluchtmarke', () => {
    const r = H.run(`(function () { var sc = ${SC};
      var d = window.RoomMode.create('defend', {}); d.arm(sc);
      var s = window.RoomMode.create('survival', {}); s.arm(sc);
      window.__echtSpawn = window.spawnEnemy; window.spawnEnemy = function () {};
      var e = window.RoomMode.create('escape', {}); e.start(sc, {});
      window.spawnEnemy = window.__echtSpawn;
      var keys = sc.children.list.filter(function (o) { return o.texture; }).map(function (o) { return o.texture.key; });
      d.stop(); s.stop(); e.stop();
      return { altar: keys.indexOf('roommode_defend_altar') >= 0, bann: keys.indexOf('roommode_survival_bannkreis') >= 0,
        neu: keys.filter(function (k) { return /^raummodus_/.test(k); }).length,
        geladen: sc.textures.exists('raummodus_altar') }; })()`);
    gleich(r, { altar: true, bann: true, neu: 0, geladen: false });
  });

  test('Mechanik gleich: Altar-Leben faellt genauso wie mit Bildern', () => {
    const r = altarLauf(H, 4, 80);
    assert.strictEqual(r.key, 'roommode_defend_altar');
    assert.strictEqual(r.bw + 'x' + r.bh + '@' + Math.round(r.bx) + ',' + Math.round(r.by), KOERPER);
    // Derselbe Drain wie im Lauf mit Bildern (dort gemessen, hier nachgerechnet).
    const erwartet = [];
    let hp = 100; const n = 4;
    for (let k = 0; k < 80; k++) { hp = Math.max(0, hp - n * 1.5 * (1 + (n - 1) * 0.2) * 0.25); erwartet.push(Math.ceil(hp)); }
    gleich(r.verlauf, erwartet);
  });

  test('Start: altes Banner, kein Messing-Toast; Zeitzeile ohne Symbol mittig auf der Platte', () => {
    H.run(`window.__mv = { id: 'defend', state: { mode: 'defend', seconds: 30, hp: 100, maxHp: 100, x: 0, y: 0 } }`);
    H.step(1);
    const r = H.run(`(function () { var sc = ${SC};
      var p = sc.children.list.filter(function (o) { return o.texture && /^ui_leiste@/.test(o.texture.key) && o.depth === 1649 && o.visible; });
      var t = sc.children.list.filter(function (o) { return o.type === 'Text' && o.depth === 1650 && o.visible && /\\d/.test(o.text); }).pop();
      return { toast: !!sc._activeEventToast,
        kasten: sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 1649 && o.visible; }).length,
        // Die Messingplatte haengt am Rahmen (uiRahmen), nicht an den Modus-Bildern.
        platte: p.length,
        symbol: sc.children.list.filter(function (o) { return o.texture && /^raummodus_symbol/.test(o.texture.key) && o.visible; }).length,
        mittig: !!(p[0] && t && Math.abs(p[0].x - t.x) < 1) }; })()`);
    gleich(r, { toast: false, kasten: 1, platte: 1, symbol: 0, mittig: true });
    H.run('window.__mv = null');
  });
});
