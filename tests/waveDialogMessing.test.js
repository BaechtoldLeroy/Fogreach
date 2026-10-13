// tests/waveDialogMessing.test.js — Tiefenwahl beim Hinabstieg (Rathauskeller)
// im Messing-Stil: Platte aus ui_rahmen, jede Option auf einem Messingfeld
// (Hover = heller Beschlag), Abbrechen als rot getoenter Messingknopf ohne
// eckige Klammern, Kontrast >= 4,5:1, alles bildschirmfest (scrollFactor 0,
// rekursiv). Verhalten wie vorher: Klick, Ziffern, Enter und ESC waehlen
// dieselben Tiefen wie im alten Kasten. Rueckfall ohne Bilder: alter Kasten.
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

/** Tiefenwahl oeffnen; gewaehlte Tiefen landen in window.__wv. */
function oeffnen(H, maxDepth) {
  run(H, `(function () { var s = ${HUB};
    if (s._waveDialogConfirm && ${DLG}) { s.input.keyboard.emit('keydown', { code: 'Escape', preventDefault: function () {} }); }
    (window.SlotStorage || localStorage).setItem('demonfall_maxDepth', '${maxDepth || 12}');
    s._dialogOpen = false;
    window.__wv = [];
    s._openWaveSelectDialog(function (d) { window.__wv.push(d); }); })()`);
  H.step(2);
}

const TASTE = (code) => `${HUB}.input.keyboard.emit('keydown', { code: '${code}', preventDefault: function () {} })`;
const OFFEN = `(function () { var s = ${HUB}; return { dlg: !!${DLG}, open: !!s._dialogOpen }; })()`;

/** Tiefen in Listenreihenfolge, aus der Zeilenbeschriftung "Tiefe N". */
const TIEFEN = `${OPTS}.list.filter(function (o) { return o.type === 'Text' && /^(Tiefe|Depth) \\d+$/.test(o.text); })
  .map(function (o) { return parseInt(o.text.replace(/\\D+/g, ''), 10); })`;
const TREFFER = `${OPTS}.list.filter(function (o) { return o.type === 'Rectangle' && o.input; })`;

/** Verhalten, das in beiden Stilen gleich sein muss. */
function verhalten(H) {
  oeffnen(H, 12);
  const tiefen = run(H, TIEFEN);
  assert.deepStrictEqual(tiefen, [12, 7, 2]);

  // Klick auf jede Zeile waehlt ihre Tiefe.
  for (let i = 0; i < 2; i++) {
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

  test('Platte aus ui_rahmen, Optionen auf Messingfeldern, keine gezeichneten Kaesten', () => {
    oeffnen(H, 12);
    const r = run(H, `(function () { var c = ${DLG}, o = ${OPTS};
      return { tiefe: c.depth,
        rahmen: c.list.filter(function (x) { return x.type === 'Image' && x.texture.key === 'ui_rahmen'; }).length,
        felder: o.list.filter(function (x) { return x.type === 'Image' && x.texture.key.indexOf('ui_feld@') === 0; }).length,
        graphicsInListe: o.list.filter(function (x) { return x.type === 'Graphics'; }).length,
        titel: c.list.filter(function (x) { return x.type === 'Text'; })[0].style.color,
        texte: (function () { var t = []; (function lauf(l) { l.forEach(function (x) {
          if (x.type === 'Container') lauf(x.list); else if (x.type === 'Text') t.push(x.text); }); })(c.list); return t; })() }; })()`);
    assert.strictEqual(r.tiefe, 1600);
    assert.strictEqual(r.rahmen, 9, 'neunteilige Platte');
    assert.strictEqual(r.felder, 3, 'je Option ein Messingfeld');
    assert.strictEqual(r.graphicsInListe, 0, 'keine gezeichneten Optionskaesten mehr');
    assert.strictEqual(r.titel, '#ffd166', 'Titel in Messing');
    assert.ok(r.texte.every((t) => !/[[\]]/.test(t)), 'eckige Klammern: ' + JSON.stringify(r.texte));
    run(H, TASTE('Escape'));
    H.step(1);
  });

  test('Hover zeigt den hellen Beschlag, Wegziehen den normalen', () => {
    oeffnen(H, 12);
    const z = run(H, `(function () { var o = ${OPTS}, t = ${TREFFER}[1];
      var feld = o.list.filter(function (x) { return x.type === 'Image'; })[1], k = [feld.texture.key];
      t.emit('pointerover'); k.push(feld.texture.key); t.emit('pointerout'); k.push(feld.texture.key); return k; })()`);
    assert.ok(z[0].indexOf('ui_feld@') === 0, z[0]);
    assert.ok(z[1].indexOf('ui_feld_gewaehlt@') === 0, z[1]);
    assert.ok(z[2].indexOf('ui_feld@') === 0, z[2]);
    run(H, TASTE('Escape'));
    H.step(1);
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
      return o.type === 'Image' && o.texture && /^ui_(knopf|rahmen|feld)/.test(o.texture.key) && o.depth >= 1500 && o.depth <= 1700; }).length`);
    assert.strictEqual(rest, 0, 'Messingteile bleiben nach dem Schliessen liegen');
  });

  test('Klick, Ziffern, Enter und ESC waehlen wie vorher', () => verhalten(H));

  test('Kontrast aller Texte mind. 4,5:1 (auch Boss-Zeilen)', () => {
    run(H, `(function () { window.__altAkt = window.storySystem.getCurrentActIndex;
      window.storySystem.getCurrentActIndex = function () { return 2; }; })()`);
    try {
      oeffnen(H, 22);
      alleLesbar(kontraste(H, TEXTE_IN(`${DLG}.list`)), 'Tiefenwahl');
    } finally {
      run(H, `(function () { window.storySystem.getCurrentActIndex = window.__altAkt; })()`);
    }
    run(H, TASTE('Escape'));
    H.step(1);
  });

  test('bildschirmfest: scrollFactor 0 rekursiv, auch bei verschobener Kamera', () => {
    run(H, `${HUB}.cameras.main.scrollX += 300`);
    oeffnen(H, 12);
    const schlecht = run(H, `(function () { var r = [];
      (function lauf(o) { if (o.scrollFactorX !== 0 || o.scrollFactorY !== 0) r.push(o.type + ' ' + (o.text || ''));
        (o.list || []).forEach(lauf); })(${DLG}); return r; })()`);
    // Tap auf die erste Zeile ueber die echte Eingabe (Bildschirmkoordinaten).
    const p = run(H, `(function () { var t = ${TREFFER}[0], m = t.getWorldTransformMatrix();
      return { x: m.tx, y: m.ty }; })()`);
    const getroffen = run(H, `${HUB}.input.hitTestPointer({ x: ${p.x}, y: ${p.y}, camera: ${HUB}.cameras.main,
      worldX: ${p.x}, worldY: ${p.y}, updateWorldPoint: function () { return this; },
      positionToCamera: function (c, out) { out = out || {}; out.x = ${p.x}; out.y = ${p.y}; return out; } })
      .filter(function (o) { return o.type === 'Rectangle'; }).length`);
    run(H, `${HUB}.cameras.main.scrollX -= 300`);
    assert.deepStrictEqual(schlecht, []);
    assert.ok(getroffen >= 1, 'Tap verfehlt die Zeile bei verschobener Kamera');
    run(H, TASTE('Escape'));
    H.step(1);
  });
});

describe('Tiefenwahl: Rueckfall ohne Messing-Bilder', () => {
  let H = null;
  before(async () => {
    H = await hub();
    run(H, `(function () { var UR = window.uiRahmen;
      UR.vorladen = function () {}; UR.nachladen = function () {};
      UR.ALLE.forEach(function (k) { window.game.textures.remove(k); }); })()`);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('alter Kasten: gezeichnete Platte und Zeilen, keine Bilder', () => {
    oeffnen(H, 12);
    const r = run(H, `(function () { var c = ${DLG}, o = ${OPTS};
      return { bilder: c.list.concat(o.list).filter(function (x) { return x.type === 'Image'; }).length,
        graphicsPlatte: c.list.filter(function (x) { return x.type === 'Graphics'; }).length,
        graphicsZeilen: o.list.filter(function (x) { return x.type === 'Graphics'; }).length,
        abbrechen: c.list.filter(function (x) { return x.type === 'Text' && x.text === 'Abbrechen'; })
          .map(function (x) { return x.style.backgroundColor; })[0] }; })()`);
    assert.strictEqual(r.bilder, 0);
    assert.ok(r.graphicsPlatte >= 1);
    assert.strictEqual(r.graphicsZeilen, 3);
    assert.strictEqual(r.abbrechen, '#6a3d3d');
    run(H, TASTE('Escape'));
    H.step(1);
  });

  test('Klick, Ziffern, Enter und ESC waehlen wie im Messing-Stil', () => verhalten(H));
});
