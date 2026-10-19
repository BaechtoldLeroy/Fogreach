// tests/laufZusammenfassung.test.js — Laufzusammenfassung nach der Rueckkehr
// in den Hub (HubSceneV2._showRunSummary) im Messing-Stil (b418):
// Platte aus ui_rahmen, Medaillon neben dem Titel (Laterne = geschafft,
// Totenkopf = gefallen), Tiefe und Dauer als Plaketten, die Werte als
// Raster aus Messingfeldern mit Pixel-Symbol; Weiter als Messingknopf.
//
// Geprueft: alle Werte richtig (auch nach dem Hochzaehlen), keine
// Schriftzeichen-Symbole und keine eckigen Klammern, kein Text ueberlappt
// einen anderen oder ragt aus der Platte (DE + EN, Erfolg + Tod), Kontrast
// >= 4,5:1, Schliessen per Taste/Klick ohne Reste, bildschirmfest
// (scrollFactor 0, rekursiv), Rueckfall auf den alten Kasten, Debug-Flagge.
// Am echten Spiel (headless, Canvas).

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');
const { kontraste, alleLesbar, TEXTE_IN } = require('./kontrastMessung');

function run(H, js) {
  const v = H.run(js);
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

const HUB = `window.game.scene.getScene('HubSceneV2')`;
const DLG = `${HUB}.children.list.filter(function (o) { return o.name === 'runSummaryDialog'; })[0]`;
const NAMEN = (name) => `${DLG}.list.filter(function (o) { return o.name === '${name}'; })`;

const VOLL = {
  durationMs: 754000, startDepth: 4, deepestDepth: 9,
  goldGained: 1284, fragmentsGained: 2, xpGained: 3460,
  enemiesKilled: 87, elitesKilled: 5, bossesKilled: 1, roomsEntered: 14
};
const KNAPP = {
  durationMs: 65000, startDepth: 3, deepestDepth: 3,
  goldGained: 0, fragmentsGained: 0, xpGained: 120,
  enemiesKilled: 9, elitesKilled: 0, bossesKilled: 0, roomsEntered: 2
};

// Grosse Zahlen: die Namen muessen vor der Zahl schmaler werden.
const GROSS = {
  durationMs: 7384000, startDepth: 12, deepestDepth: 28,
  goldGained: 2345678, fragmentsGained: 1234567, xpGained: 9876543,
  enemiesKilled: 1234567, elitesKilled: 123456, bossesKilled: 12, roomsEntered: 99999
};

async function hub(search) {
  const H = await launch({ search: search || '?autostart=1&debug=1', renderer: 'canvas' });
  await H.waitForScene('HubSceneV2', { maxRounds: 600 });
  run(H, `(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')`);
  H.step(30);
  return H;
}

/** Zusammenfassung oeffnen (vorher eine offene schliessen). */
function oeffnen(H, werte, tod, lang) {
  run(H, `(function () { var s = ${HUB};
    var d = ${DLG}; if (d) s.input.keyboard.emit('keydown-ESC');
    window.i18n.setLanguage('${lang || 'de'}');
    s._showRunSummary(Object.assign({ reason: '${tod ? 'death' : 'portal'}' }, ${JSON.stringify(werte)})); })()`);
  H.step(1);
}
const UEBERSPRINGEN = `${NAMEN('laufHintergrund')}[0].emit('pointerdown')`;

/** Erwartete Werte je Feld, wie das alte Fenster sie zeigte. */
function erwartet(w) {
  const e = { raeume: String(w.roomsEntered), gegner: String(w.enemiesKilled) };
  if (w.elitesKilled > 0) e.elite = String(w.elitesKilled);
  if (w.bossesKilled > 0) e.bosse = String(w.bossesKilled);
  e.xp = '+' + w.xpGained;
  e.gold = '+' + w.goldGained;
  if (w.fragmentsGained > 0) e.fragmente = '+' + w.fragmentsGained;
  return e;
}
const WERTE = `(function () { var r = {}; ${DLG}.list.forEach(function (o) {
  if (o.type === 'Text' && /^laufWert_/.test(o.name)) r[o.name.slice(9)] = o.text; }); return r; })()`;

const ALLE_TEXTE = `(function () { var t = []; (function lauf(l) { l.forEach(function (x) {
  if (x.type === 'Container') lauf(x.list); else if (x.type === 'Text') t.push(x.text); }); })(${DLG}.list); return t; })()`;
// Pfeile, Dingbats, Emojis, Ersatzzeichen — erscheinen je nach Schrift als Kaestchen.
const SYMBOL_RE = /[←-⯿\u{1F000}-\u{1FFFF}�]/u;

/** Textrechtecke paarweise ueberlappungsfrei und innerhalb der Platte. */
function ueberlappungsfrei(H, was) {
  const r = run(H, `(function () { var d = ${DLG};
    var platte = d.list.filter(function (o) { return o.type === 'Image' && o.texture.key === 'ui_rahmen'; });
    var px = platte.length ? Math.min.apply(null, platte.map(function (o) { return o.getBounds().x; })) : null;
    var pr = platte.length ? Math.max.apply(null, platte.map(function (o) { return o.getBounds().right; })) : null;
    var py = platte.length ? Math.min.apply(null, platte.map(function (o) { return o.getBounds().y; })) : null;
    var pu = platte.length ? Math.max.apply(null, platte.map(function (o) { return o.getBounds().bottom; })) : null;
    var teile = d.list.filter(function (o) { return o.type === 'Text' || (o.type === 'Image' && /^(ui_lauf_symbole|ui_symbol_)/.test(o.texture.key)); })
      .map(function (o) { var b = o.getBounds(); return { was: o.type === 'Text' ? o.text : o.texture.key, typ: o.type, x: b.x, y: b.y, r: b.right, u: b.bottom }; });
    return { platte: { x: px, y: py, r: pr, u: pu }, teile: teile }; })()`);
  const texte = r.teile.filter((t) => t.typ === 'Text');
  assert.ok(texte.length >= 8, was + ': zu wenige Texte');
  for (const t of r.teile) {
    assert.ok(t.x >= r.platte.x && t.r <= r.platte.r && t.y >= r.platte.y && t.u <= r.platte.u,
      was + ': "' + t.was + '" ragt aus der Platte');
  }
  // Text gegen Text (jedes Paar einmal) und Text gegen Symbol/Medaillon.
  const bilder = r.teile.filter((t) => t.typ === 'Image');
  const paare = [];
  texte.forEach((a, i) => texte.slice(i + 1).concat(bilder).forEach((b) => paare.push([a, b])));
  for (const [a, b] of paare) {
    const schneiden = a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.u - 0.5 && b.y < a.u - 0.5;
    assert.ok(!schneiden, was + ': "' + a.was + '" ueberlappt "' + b.was + '"');
  }
}

describe('Laufzusammenfassung im Messing-Stil', () => {
  let H;
  before(async () => { H = await hub(); });
  after(async () => { if (H) await H.shutdown(); });

  test('Aufbau: Platte, Medaillon, Plaketten, Raster mit Symbolen, Messingknopf', () => {
    oeffnen(H, VOLL, false);
    const a = run(H, `(function () { var d = ${DLG}, s = ${HUB};
      var bilder = d.list.filter(function (o) { return o.type === 'Image'; }).map(function (o) { return o.texture.key; });
      var sym = ${NAMEN('laufSymbol')}.map(function (o) { return o.frame.name; });
      var w = ${NAMEN('laufWeiter')}[0];
      return { platte: bilder.filter(function (k) { return k === 'ui_rahmen'; }).length,
        med: ${NAMEN('laufMedaillon')}.map(function (o) { return o.texture.key; }),
        felder: ${NAMEN('laufFeld')}.length, sym: sym,
        plaketten: ${NAMEN('laufTiefenPlakette')}.length + ${NAMEN('laufDauerPlakette')}.length,
        pfeil: ${NAMEN('laufTiefePfeil')}.length,
        knopf: !!w._uiTextKnopf, knopfText: w.text, knopfH: w.input.hitArea.height, knopfBg: w.style.backgroundColor,
        titel: ${NAMEN('laufTitel')}[0].text, titelFarbe: ${NAMEN('laufTitel')}[0].style.color,
        tod: ${NAMEN('laufTodTon')}.length }; })()`);
    assert.strictEqual(a.platte, 9, 'Platte aus neun Teilen');
    assert.deepStrictEqual(a.med, ['ui_symbol_laterne']);
    assert.strictEqual(a.felder, 7);
    // Dauer (Sanduhr, Feld 7) + je Wert sein Symbol in Anzeige-Reihenfolge.
    assert.deepStrictEqual(a.sym, [7, 0, 1, 2, 3, 4, 5, 6]);
    assert.strictEqual(a.plaketten, 2);
    assert.strictEqual(a.pfeil, 1, 'Abstieg 4 -> 9 als Pixelpfeil');
    assert.ok(a.knopf, 'Weiter liegt auf dem Messingknopf');
    assert.strictEqual(a.knopfText, 'Weiter');
    assert.ok(a.knopfH >= 44, 'Weiter nur ' + a.knopfH + ' px hoch');
    assert.ok(!a.knopfBg, 'kein Farbkasten mehr hinter Weiter');
    assert.strictEqual(a.titel, 'Lauf abgeschlossen');
    assert.strictEqual(a.titelFarbe, '#ffd166');
    assert.strictEqual(a.tod, 0);

    oeffnen(H, VOLL, true);
    const t = run(H, `({ med: ${NAMEN('laufMedaillon')}.map(function (o) { return o.texture.key; }),
      titel: ${NAMEN('laufTitel')}[0].text, tod: ${NAMEN('laufTodTon')}.length })`);
    assert.deepStrictEqual(t, { med: ['ui_symbol_tod'], titel: 'In den Kellern gefallen', tod: 1 });
  });

  test('alle Werte richtig; Hochzaehlen endet bei der Zahl und laesst sich ueberspringen', () => {
    oeffnen(H, VOLL, false);
    // Gleich nach dem Oeffnen zaehlen die Zahlen noch.
    const frueh = run(H, WERTE);
    assert.notStrictEqual(frueh.gold, '+1284', 'Gold zaehlt hoch');
    run(H, UEBERSPRINGEN);
    assert.deepStrictEqual(run(H, WERTE), erwartet(VOLL));
    const p = run(H, `({ a: ${NAMEN('laufTiefeStart')}[0].text, b: ${NAMEN('laufTiefeZiel')}.map(function (o) { return o.text; }),
      d: ${NAMEN('laufDauer')}[0].text, sym: ${NAMEN('laufSymbol')}.map(function (o) { return o.alpha; }) })`);
    assert.deepStrictEqual(p, { a: '4', b: ['9'], d: '12:34', sym: [1, 1, 1, 1, 1, 1, 1, 1] });

    // Ohne Ueberspringen: nach der kurzen Zeit stehen dieselben Zahlen da.
    oeffnen(H, VOLL, true, 'en');
    for (let i = 0; i < 200 && JSON.stringify(run(H, WERTE)) !== JSON.stringify(erwartet(VOLL)); i++) H.step(5);
    assert.deepStrictEqual(run(H, WERTE), erwartet(VOLL));

    // Ohne Elite, Bosse, Fragmente und ohne Abstieg: nur die Felder, die es gab.
    oeffnen(H, KNAPP, false);
    run(H, UEBERSPRINGEN);
    assert.deepStrictEqual(run(H, WERTE), erwartet(KNAPP));
    const k = run(H, `({ felder: ${NAMEN('laufFeld')}.length, ziel: ${NAMEN('laufTiefeZiel')}.length,
      pfeil: ${NAMEN('laufTiefePfeil')}.length, a: ${NAMEN('laufTiefeStart')}[0].text, d: ${NAMEN('laufDauer')}[0].text })`);
    assert.deepStrictEqual(k, { felder: 4, ziel: 0, pfeil: 0, a: '3', d: '1:05' });
  });

  test('keine Schriftzeichen-Symbole, keine eckigen Klammern; ueberlappungsfrei (DE + EN, Erfolg + Tod, grosse Zahlen)', () => {
    for (const lang of ['de', 'en']) {
      for (const tod of [false, true]) {
        for (const w of [VOLL, KNAPP, GROSS]) {
          oeffnen(H, w, tod, lang);
          run(H, UEBERSPRINGEN);
          const was = lang + (tod ? ' Tod' : ' Erfolg') + (w === VOLL ? ' voll' : w === KNAPP ? ' knapp' : ' gross');
          const texte = run(H, ALLE_TEXTE);
          for (const t of texte) {
            assert.ok(!SYMBOL_RE.test(t), was + ': Symbolzeichen in "' + t + '"');
            assert.ok(!/[[\]]/.test(t), was + ': eckige Klammer in "' + t + '"');
          }
          ueberlappungsfrei(H, was);
        }
      }
    }
  });

  test('Kontrast >= 4,5:1 (Erfolg + Tod)', () => {
    for (const tod of [false, true]) {
      oeffnen(H, VOLL, tod, 'de');
      run(H, UEBERSPRINGEN);
      H.step(2);
      alleLesbar(kontraste(H, TEXTE_IN(DLG + '.list')), tod ? 'Tod' : 'Erfolg');
    }
  });

  test('bildschirmfest: alles scrollFactor 0, auch bei verschobener Kamera', () => {
    oeffnen(H, VOLL, false);
    const r = run(H, `(function () { var falsch = [];
      (function lauf(o) { if (o.scrollFactorX !== 0 || o.scrollFactorY !== 0) falsch.push(o.type + ':' + (o.name || ''));
        if (o.list) o.list.forEach(lauf); })(${DLG}); return falsch; })()`);
    assert.deepStrictEqual(r, []);
    // Tipp auf Weiter trifft auch bei weit verschobener Hub-Kamera.
    const treffer = run(H, `(function () { var s = ${HUB}, cam = s.cameras.main, d = ${DLG};
      var w = ${NAMEN('laufWeiter')}[0];
      var altX = cam.scrollX, altY = cam.scrollY; cam.setScroll(altX + 420, altY + 260);
      var p = s.input.activePointer; p.position.set(d.x + w.x, d.y + w.y);
      var t = s.input.manager.hitTest(p, [w], cam).length;
      cam.setScroll(altX, altY); return t; })()`);
    assert.strictEqual(treffer, 1);
  });

  test('Schliessen per Enter, Leertaste, ESC und Klick auf Weiter ohne Reste', () => {
    const basis = run(H, `(function () { var s = ${HUB}; var d = ${DLG}; if (d) s.input.keyboard.emit('keydown-ESC');
      return { kinder: s.children.list.length, esc: s.input.keyboard.listenerCount('keydown-ESC'),
        enter: s.input.keyboard.listenerCount('keydown-ENTER'), space: s.input.keyboard.listenerCount('keydown-SPACE'),
        shutdown: s.events.listenerCount('shutdown') }; })()`);
    const wege = {
      Enter: `${HUB}.input.keyboard.emit('keydown-ENTER')`,
      Leertaste: `${HUB}.input.keyboard.emit('keydown-SPACE')`,
      ESC: `${HUB}.input.keyboard.emit('keydown-ESC')`,
      Klick: `${NAMEN('laufWeiter')}[0].emit('pointerdown', {}, 0, 0, { stopPropagation: function () {} })`
    };
    for (const [weg, js] of Object.entries(wege)) {
      for (const tod of [false, true]) {
        oeffnen(H, VOLL, tod);
        assert.ok(run(H, `!!${DLG}`), weg + ': offen');
        run(H, js);
        H.step(1);
        const nach = run(H, `(function () { var s = ${HUB};
          return { kinder: s.children.list.length, esc: s.input.keyboard.listenerCount('keydown-ESC'),
            enter: s.input.keyboard.listenerCount('keydown-ENTER'), space: s.input.keyboard.listenerCount('keydown-SPACE'),
            shutdown: s.events.listenerCount('shutdown') }; })()`);
        assert.ok(!run(H, `!!${DLG}`), weg + ': geschlossen');
        assert.deepStrictEqual(nach, basis, weg + ': Reste');
      }
    }
  });

  test('Rueckfall ohne Messing-Bilder: alter Kasten, gleiche Werte, schliesst', () => {
    run(H, `window.__urBereit = window.uiRahmen.bereit; window.__urNach = window.uiRahmen.nachladen;
      window.uiRahmen.bereit = function () { return false; }; window.uiRahmen.nachladen = function () {}; 0`);
    try {
      for (const lang of ['de', 'en']) {
        oeffnen(H, VOLL, true, lang);
        const r = run(H, `(function () { var d = ${DLG}; return {
          bilder: d.list.filter(function (o) { return o.type === 'Image'; }).length,
          kasten: d.list.filter(function (o) { return o.type === 'Graphics'; }).length,
          weiter: ${NAMEN('laufWeiter')}[0].input.hitArea.height }; })()`);
        assert.deepStrictEqual({ bilder: r.bilder, kasten: r.kasten }, { bilder: 0, kasten: 1 });
        assert.ok(r.weiter >= 44, 'Weiter im Kasten nur ' + r.weiter + ' px');
        const w = run(H, WERTE);
        const soll = Object.assign({ tiefe: '4 – 9' }, erwartet(VOLL), { dauer: '12:34' });
        assert.deepStrictEqual(w, soll);
        for (const t of run(H, ALLE_TEXTE)) assert.ok(!SYMBOL_RE.test(t) && !/[[\]]/.test(t), 'Rueckfall: "' + t + '"');
        alleLesbar(kontraste(H, TEXTE_IN(DLG + '.list')), 'Rueckfall ' + lang);
        run(H, `${HUB}.input.keyboard.emit('keydown-ENTER')`);
        H.step(1);
        assert.ok(!run(H, `!!${DLG}`));
      }
    } finally {
      run(H, `window.uiRahmen.bereit = window.__urBereit; window.uiRahmen.nachladen = window.__urNach; 0`);
    }
  });
});

describe('Debug-Abkuerzung ?lauf=', () => {
  test('?lauf=tod oeffnet die Zusammenfassung mit Beispielwerten', async () => {
    const H = await hub('?autostart=1&debug=1&lauf=tod');
    try {
      for (let i = 0; i < 60 && !run(H, `!!${DLG}`); i++) H.step(5);
      assert.ok(run(H, `!!${DLG}`), 'Zusammenfassung offen');
      assert.ok(run(H, `${NAMEN('laufTodTon')}.length === 1`), 'als Tod');
      assert.strictEqual(run(H, 'window.lastRunSummary'), null);
    } finally { await H.shutdown(); }
  });
});
