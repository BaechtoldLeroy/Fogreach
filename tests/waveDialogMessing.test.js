// tests/waveDialogMessing.test.js — Tiefenwahl beim Hinabstieg (Rathauskeller)
// im Messing-Stil: Platte aus ui_rahmen, jede Option als Raster aus
// Medaillon (Pixelbild), Titel + Hinweis und Tiefen-Plakette auf einem
// Messingfeld; Fokus (Hover bzw. Enter-Wahl) = heller Beschlag + Goldrand.
// Abbrechen als rot getoenter Messingknopf ohne eckige Klammern,
// Kontrast >= 4,5:1, alles bildschirmfest (scrollFactor 0, rekursiv).
//
// b417: keine Schriftzeichen-Symbole mehr ("⚔", Pfeile), die je nach
// Schrift als Kaestchen erschienen; kein Text einer Zeile ueberlappt einen
// anderen oder ragt aus der Zeile — DE und EN, mit Boss-Zeilen.
//
// Verhalten wie vorher: Klick, Ziffern, Enter und ESC waehlen dieselben
// Tiefen wie im alten Kasten. Rueckfall ohne Bilder: alter Kasten ohne Symbole.
// Geprueft am echten Spiel (headless, Canvas).

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');
const { kontraste, alleLesbar, TEXTE_IN } = require('./kontrastMessung');

function run(H, js) {
  const v = H.run(js);
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

const HUB = `window.game.scene.getScene('HubSceneV2')`;
const DLG = `${HUB}.children.list.filter(function (o) { return o.name === 'waveSelectDialog'; })[0]`;
// Der maskierte Options-Container (einziger Container im Dialog).
const OPTS = `${DLG}.list.filter(function (o) { return o.type === 'Container'; })[0]`;

async function hub() {
  const H = await launch({ search: '?autostart=1&debug=1', renderer: 'canvas' });
  await H.waitForScene('HubSceneV2', { maxRounds: 600 });
  run(H, `(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')`);
  H.step(30);
  return H;
}

/** Tiefenwahl oeffnen; gewaehlte Tiefen landen in window.__wv. akt: Story-Akt (Boss-Zeilen ab 1). */
function oeffnen(H, maxDepth, akt) {
  run(H, `(function () { var s = ${HUB};
    if (s._waveDialogConfirm && ${DLG}) { s.input.keyboard.emit('keydown', { code: 'Escape', preventDefault: function () {} }); }
    (window.SlotStorage || localStorage).setItem('demonfall_maxDepth', '${maxDepth || 12}');
    if (!window.__altAkt) window.__altAkt = window.storySystem.getCurrentActIndex;
    window.storySystem.getCurrentActIndex = ${akt ? `function () { return ${akt}; }` : 'window.__altAkt'};
    s._dialogOpen = false;
    window.__wv = [];
    s._openWaveSelectDialog(function (d) { window.__wv.push(d); }); })()`);
  H.step(2);
}

const TASTE = (code) => `${HUB}.input.keyboard.emit('keydown', { code: '${code}', preventDefault: function () {} })`;
const OFFEN = `(function () { var s = ${HUB}; return { dlg: !!${DLG}, open: !!s._dialogOpen }; })()`;
function zu(H) { run(H, TASTE('Escape')); H.step(1); }

/** Tiefen in Listenreihenfolge, aus den Plaketten. */
const TIEFEN = `${OPTS}.list.filter(function (o) { return o.name === 'waveTiefe'; })
  .map(function (o) { return parseInt(o.text, 10); })`;
const TREFFER = `${OPTS}.list.filter(function (o) { return o.type === 'Rectangle' && o.input; })`;

/**
 * Je Zeile (Trefferflaeche): die Weltrechtecke ihrer Texte und Bilder ausser
 * dem Feld selbst, dazu das Rechteck der Zeile.
 */
const ZEILEN = `(function () { var o = ${OPTS};
  var r = function (b) { return { x: b.x, y: b.y, r: b.right, u: b.bottom }; };
  return ${TREFFER}.map(function (t) { var z = t.getBounds();
    var teile = o.list.filter(function (x) {
      if (x === t || !(x.type === 'Text' || x.type === 'Image')) return false;
      if (x.type === 'Image' && /^ui_feld/.test(x.texture.key)) return false;
      var b = x.getBounds(), m = b.y + b.height / 2;
      return m >= z.y && m <= z.bottom;
    }).map(function (x) { var b = r(x.getBounds()); b.was = x.type === 'Text' ? x.text : x.texture.key; b.typ = x.type; return b; });
    return { zeile: r(z), teile: teile, h: t.input.hitArea.height }; }); })()`;

function ueberlappungsfrei(H, was) {
  const zeilen = run(H, ZEILEN);
  assert.ok(zeilen.length > 0, was + ': keine Zeilen');
  for (const z of zeilen) {
    assert.ok(z.h >= 44, was + ': Trefferflaeche nur ' + z.h + ' px hoch');
    // Bilder (Plakette) umschliessen ihre Texte — gezaehlt werden Text gegen
    // Text und Text gegen Medaillon.
    const texte = z.teile.filter((t) => t.typ === 'Text');
    const symbole = z.teile.filter((t) => t.typ === 'Image' && /^ui_symbol/.test(t.was));
    for (const t of z.teile) {
      assert.ok(t.x >= z.zeile.x - 0.5 && t.r <= z.zeile.r + 0.5 && t.y >= z.zeile.y - 0.5 && t.u <= z.zeile.u + 0.5,
        was + ': "' + t.was + '" ragt aus der Zeile ' + JSON.stringify([t, z.zeile]));
    }
    const paare = [];
    texte.forEach((a, i) => texte.slice(i + 1).concat(symbole).forEach((b) => paare.push([a, b])));
    for (const [a, b] of paare) {
      const schneiden = a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.u - 0.5 && b.y < a.u - 0.5;
      // Plaketten-Wort und Zahl stehen uebereinander: nur echte Schnitte zaehlen.
      assert.ok(!schneiden, was + ': "' + a.was + '" ueberlappt "' + b.was + '"');
    }
  }
  return zeilen;
}

// Pfeile, technische Zeichen, Dingbats (⚔ = U+2694), Emojis — alles, was
// je nach Schrift als Kaestchen erscheint. Gedankenstrich und Mittelpunkt
// (U+2013/2014/00B7) sind gewoehnliche Satzzeichen und bleiben erlaubt.
const SYMBOL_RE = /[←-⯿\u{1F000}-\u{1FFFF}�]/u;
const DIALOG_TEXTE = `(function () { var t = []; (function lauf(l) { l.forEach(function (x) {
  if (x.type === 'Container') lauf(x.list); else if (x.type === 'Text') t.push(x.text); }); })(${DLG}.list); return t; })()`;

/** Verhalten, das in beiden Stilen gleich sein muss. */
function verhalten(H) {
  oeffnen(H, 12);
  const tiefen = run(H, TIEFEN);
  assert.deepStrictEqual(tiefen, [12, 7, 2]);

  // Klick auf jede Zeile waehlt ihre Tiefe.
  for (let i = 0; i < 3; i++) {
    oeffnen(H, 12);
    run(H, `(function () { var t = ${TREFFER}[${i}]; t.emit('pointerover'); t.emit('pointerup'); })()`);
    H.step(1);
    assert.deepStrictEqual(run(H, 'window.__wv.slice()'), [tiefen[i]], 'Klick Zeile ' + i);
    assert.deepStrictEqual(run(H, OFFEN), { dlg: false, open: false });
  }
  // Ziffern 1..3 nach Listenposition.
  ['Digit1', 'Numpad2', 'Digit3'].forEach((code, i) => {
    oeffnen(H, 12);
    run(H, TASTE(code));
    H.step(1);
    assert.deepStrictEqual(run(H, 'window.__wv.slice()'), [tiefen[i]], code);
  });
  // Enter = "Gewohnter Abstieg" (12 - 5), nicht die Grenze.
  oeffnen(H, 12);
  run(H, TASTE('Enter'));
  H.step(1);
  assert.deepStrictEqual(run(H, 'window.__wv.slice()'), [7]);
  // Mit Boss-Zeilen: Liste tief -> flach, Enter weiter der Gewohnte Abstieg.
  oeffnen(H, 22, 2);
  assert.deepStrictEqual(run(H, TIEFEN), [22, 20, 17, 12, 10]);
  run(H, TASTE('Digit2'));
  H.step(1);
  assert.deepStrictEqual(run(H, 'window.__wv.slice()'), [20]);
  // ESC schliesst ohne Wahl.
  oeffnen(H, 12);
  run(H, TASTE('Escape'));
  H.step(1);
  assert.deepStrictEqual(run(H, 'window.__wv.slice()'), []);
  assert.deepStrictEqual(run(H, OFFEN), { dlg: false, open: false });
}

describe('Tiefenwahl: Messing', () => {
  let H = null;
  before(async () => { H = await hub(); });
  after(async () => { if (H) await H.shutdown(); });

  test('Platte aus ui_rahmen, Optionen auf Messingfeldern, keine eckigen Klammern', () => {
    oeffnen(H, 12);
    const r = run(H, `(function () { var c = ${DLG}, o = ${OPTS};
      return { tiefe: c.depth,
        rahmen: c.list.filter(function (x) { return x.type === 'Image' && x.texture.key === 'ui_rahmen'; }).length,
        felder: o.list.filter(function (x) { return x.type === 'Image' && /^ui_feld(_gewaehlt)?@/.test(x.texture.key); }).length,
        titel: c.list.filter(function (x) { return x.type === 'Text'; })[0].style.color }; })()`);
    assert.strictEqual(r.tiefe, 1600);
    assert.strictEqual(r.rahmen, 9, 'neunteilige Platte');
    assert.strictEqual(r.felder, 3, 'je Option ein Messingfeld');
    assert.strictEqual(r.titel, '#ffd166', 'Titel in Messing');
    assert.ok(run(H, DIALOG_TEXTE).every((t) => !/[[\]]/.test(t)), 'eckige Klammern');
    zu(H);
  });

  test('Medaillons statt Schriftzeichen: Boss-Zeilen mit ui_symbol_boss, kein Symbol-Zeichen im Text (DE + EN)', () => {
    for (const sprache of ['de', 'en']) {
      run(H, `window.i18n.setLanguage('${sprache}')`);
      for (const [tiefe, akt] of [[22, 2], [20, 2], [12, 0]]) {
        oeffnen(H, tiefe, akt);
        const texte = run(H, DIALOG_TEXTE);
        const schlecht = texte.filter((t) => SYMBOL_RE.test(t));
        assert.deepStrictEqual(schlecht, [], sprache + ' Tiefe ' + tiefe + ': Symbol-Zeichen im Text');
        const sym = run(H, `${OPTS}.list.filter(function (x) { return x.name === 'waveSymbol'; }).map(function (x) { return x.texture.key; })`);
        const n = run(H, `${TREFFER}.length`);
        assert.strictEqual(sym.length, n, 'jede Zeile hat ein Medaillon');
        if (akt) assert.ok(sym.includes('ui_symbol_boss'), 'Boss-Medaillon fehlt: ' + sym);
        else assert.ok(!sym.includes('ui_symbol_boss'), 'Boss-Medaillon ohne Boss: ' + sym);
        assert.ok(sym.every((k) => run(H, `${HUB}.textures.exists('${k}')`)), 'Medaillon nicht geladen');
        zu(H);
      }
    }
    run(H, `window.i18n.setLanguage('de')`);
  });

  test('Raster ueberlappungsfrei: kein Text schneidet einen anderen oder ragt aus der Zeile (DE + EN, Boss)', () => {
    for (const sprache of ['de', 'en']) {
      run(H, `window.i18n.setLanguage('${sprache}')`);
      for (const [tiefe, akt] of [[22, 2], [20, 2], [12, 0], [5, 0]]) {
        oeffnen(H, tiefe, akt);
        // Auch die weiter unten liegenden Zeilen pruefen: ans Ende rollen.
        ueberlappungsfrei(H, sprache + ' Tiefe ' + tiefe);
        run(H, `${HUB}.input.emit('wheel', null, [], 0, 2000, 0)`);
        H.step(1);
        ueberlappungsfrei(H, sprache + ' Tiefe ' + tiefe + ' gerollt');
        zu(H);
      }
    }
    run(H, `window.i18n.setLanguage('de')`);
  });

  test('Viewport zeigt nur ganze Zeilen, das Panel bleibt im Bild', () => {
    oeffnen(H, 22, 2);
    const r = run(H, `(function () { var c = ${DLG}, cam = ${HUB}.cameras.main;
      var platte = c.list.filter(function (x) { return x.type === 'Image' && x.texture.key === 'ui_rahmen'; });
      var oben = Math.min.apply(null, platte.map(function (x) { return x.getBounds().y; }));
      var unten = Math.max.apply(null, platte.map(function (x) { return x.getBounds().bottom; }));
      var maske = ${OPTS}.mask.geometryMask;
      // Maske = Viewport + je 2 px Rand oben und unten.
      var tr = ${TREFFER}, abstand = tr[1].y - tr[0].y, zeileH = tr[0].height;
      var viewH = maske.commandBuffer[maske.commandBuffer.length - 1];
      return { oben: oben, unten: unten, h: cam.height, abstand: abstand, zeileH: zeileH, n: tr.length,
        viewH: viewH - 4 }; })()`);
    assert.ok(r.oben >= 0 && r.unten <= r.h, 'Panel ragt aus dem Bild: ' + JSON.stringify(r));
    const ganz = (r.viewH + (r.abstand - r.zeileH)) / r.abstand;
    assert.ok(r.n > ganz, 'Testaufbau: Liste sollte scrollen ' + JSON.stringify(r));
    assert.ok(Math.abs(ganz - Math.round(ganz)) < 0.01, 'Viewport schneidet eine Zeile an: ' + JSON.stringify(r));
    zu(H);
  });

  test('Fokus: Enter-Wahl ist hervorgehoben, Hover verschiebt den Fokus, Wegziehen kehrt zurueck', () => {
    oeffnen(H, 12);
    const FOKUS = `(function () { var o = ${OPTS};
      var felder = o.list.filter(function (x) { return x.type === 'Image' && /^ui_feld/.test(x.texture.key); });
      return felder.map(function (x) { return /^ui_feld_gewaehlt@/.test(x.texture.key) ? 1 : 0; }); })()`;
    assert.deepStrictEqual(run(H, FOKUS), [0, 1, 0], 'Gewohnter Abstieg (Enter) hervorgehoben');
    run(H, `${TREFFER}[0].emit('pointerover')`);
    assert.deepStrictEqual(run(H, FOKUS), [1, 0, 0]);
    run(H, `${TREFFER}[0].emit('pointerout')`);
    assert.deepStrictEqual(run(H, FOKUS), [0, 1, 0]);
    zu(H);
  });

  test('Abbrechen: rot getoenter Messingknopf, mind. 44 px hoch, schliesst ohne Wahl', () => {
    oeffnen(H, 12);
    const k = run(H, `(function () { var b = ${DLG}.list.filter(function (o) { return o.name === 'waveSelectAbbrechen'; })[0];
      return b ? { text: b.text, bild: b._uiTextKnopf && b._uiTextKnopf.texture.key, h: b.input.hitArea.height,
        bildImDialog: !!(b._uiTextKnopf && b._uiTextKnopf.parentContainer === ${DLG}) } : null; })()`);
    assert.ok(k, 'Abbrechen-Knopf fehlt');
    assert.strictEqual(k.text, 'Abbrechen');
    assert.ok(k.bild && k.bild.indexOf('ui_knopf@') === 0 && /#4a1e22/.test(k.bild), 'Bild ' + k.bild);
    assert.ok(k.bildImDialog, 'Knopfbild nicht im Dialog-Container');
    assert.ok(k.h >= 44, 'Trefferflaeche nur ' + k.h + ' px hoch');
    run(H, `${DLG}.list.filter(function (o) { return o.name === 'waveSelectAbbrechen'; })[0].emit('pointerdown')`);
    H.step(1);
    assert.deepStrictEqual(run(H, 'window.__wv.slice()'), []);
    assert.deepStrictEqual(run(H, OFFEN), { dlg: false, open: false });
    const rest = run(H, `${HUB}.children.list.filter(function (o) {
      return o.type === 'Image' && o.texture && /^ui_(knopf|rahmen|feld|symbol)/.test(o.texture.key) && o.depth >= 1500 && o.depth <= 1700; }).length`);
    assert.strictEqual(rest, 0, 'Messingteile bleiben nach dem Schliessen liegen');
  });

  test('Klick, Ziffern, Enter und ESC waehlen wie vorher', () => verhalten(H));

  test('Kontrast aller Texte mind. 4,5:1 (auch Boss-Zeilen)', () => {
    oeffnen(H, 22, 2);
    alleLesbar(kontraste(H, TEXTE_IN(`${DLG}.list`)), 'Tiefenwahl');
    zu(H);
    oeffnen(H, 20, 2);
    alleLesbar(kontraste(H, TEXTE_IN(`${DLG}.list`)), 'Tiefenwahl mit Boss-Marke');
    zu(H);
  });

  test('bildschirmfest: scrollFactor 0 rekursiv, auch bei verschobener Kamera', () => {
    run(H, `${HUB}.cameras.main.scrollX += 300`);
    oeffnen(H, 22, 2);
    const schlecht = run(H, `(function () { var r = [];
      (function lauf(o) { if (o.scrollFactorX !== 0 || o.scrollFactorY !== 0) r.push(o.type + ' ' + (o.text || ''));
        (o.list || []).forEach(lauf); })(${DLG}); return r; })()`);
    run(H, `${HUB}.cameras.main.scrollX -= 300`);
    assert.deepStrictEqual(schlecht, []);
    zu(H);
  });
});

describe('Tiefenwahl: Rueckfall ohne Messing-Bilder', () => {
  let H = null;
  before(async () => {
    H = await hub();
    run(H, `(function () { var UR = window.uiRahmen;
      UR.vorladen = function () {}; UR.nachladen = function () {};
      UR.ALLE.concat(UR.ZUSATZ_SYMBOLE).forEach(function (k) { window.game.textures.remove(k); }); })()`);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('alter Kasten: gezeichnete Platte und Zeilen, keine Bilder, keine Symbol-Zeichen', () => {
    oeffnen(H, 22, 2);
    const r = run(H, `(function () { var c = ${DLG}, o = ${OPTS};
      return { bilder: c.list.concat(o.list).filter(function (x) { return x.type === 'Image'; }).length,
        graphicsPlatte: c.list.filter(function (x) { return x.type === 'Graphics'; }).length,
        abbrechen: c.list.filter(function (x) { return x.type === 'Text' && x.text === 'Abbrechen'; })
          .map(function (x) { return x.style.backgroundColor; })[0] }; })()`);
    assert.strictEqual(r.bilder, 0);
    assert.ok(r.graphicsPlatte >= 1);
    assert.strictEqual(r.abbrechen, '#6a3d3d');
    assert.deepStrictEqual(run(H, DIALOG_TEXTE).filter((t) => SYMBOL_RE.test(t)), []);
    ueberlappungsfrei(H, 'Rueckfall');
    zu(H);
  });

  test('Klick, Ziffern, Enter und ESC waehlen wie im Messing-Stil', () => verhalten(H));
});
