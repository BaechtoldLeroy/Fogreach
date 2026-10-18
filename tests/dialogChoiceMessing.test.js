// tests/dialogChoiceMessing.test.js — Story-Wahlen (DialogChoice.present) im
// Messing-Stil: Platte aus ui_rahmen, Sprecher-Zeile in Messing, Wahlen und
// Abbrechen als Messingknoepfe (Hover/Gedrueckt), mind. 44 px hoch,
// Kontrast >= 4,5:1, alles bildschirmfest (scrollFactor 0, rekursiv).
//
// Verhalten wie vorher: dieselbe Wahl setzt dieselben Flags
// (verification_sealed / verification_refused), ESC und Abbrechen setzen
// keines. Rueckfall ohne Bilder: die alte Zeichnung (Graphics + Zonen).
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
const PANEL = `${HUB}.children.list.filter(function (o) { return o.name === 'dialogChoiceContainer'; })[0]`;

async function hub() {
  const H = await launch({ search: '?autostart=1&debug=1', renderer: 'canvas' });
  await H.waitForScene('HubSceneV2', { maxRounds: 600 });
  run(H, `(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')`);
  H.step(30);
  return H;
}

/** Siegel-Wahl (oder eine andere storyDialog-Wahl) oeffnen; Ergebnis landet in window.__dc. */
function oeffnen(H, quelle) {
  // Ein vom vorigen (gescheiterten) Test offenes Panel zuerst weg, sonst
  // greift PANEL das alte und ein Fehler zieht alle folgenden mit.
  zu(H);
  run(H, `${HUB}.children.list.filter(function (o) { return o.name === 'dialogChoiceContainer'; })
    .forEach(function (o) { o.destroy(); })`);
  run(H, `(function () {
    var e = ${quelle || 'window.storyDialog.byQuest.magistrat_verification'};
    window.__dc = { aufgeloest: [], abgebrochen: 0 };
    window.__dcHandle = window.DialogChoice.present(${HUB}, { prompt: e.prompt, choices: e.choices,
      onResolved: function (r) { window.__dc.aufgeloest.push(r ? { index: r.index, flags: r.flagsSet } : null); },
      onCancel: function () { window.__dc.abgebrochen++; } });
  })()`);
  H.step(2);
}

function zu(H) {
  run(H, `(function () { if (window.__dcHandle) window.__dcHandle.destroy(); window.__dcHandle = null; })()`);
  H.step(1);
}

const FLAGS = `(function () { var f = window.questSystem.getFlags();
  return { sealed: !!f.verification_sealed, refused: !!f.verification_refused }; })()`;
const FLAGS_ZURUECK = `(function () { window.questSystem.setFlag('verification_sealed', false);
  window.questSystem.setFlag('verification_refused', false); })()`;

/** Die Knoepfe des Panels: Text mit Knopfbild. */
const KNOEPFE = `(function () { var c = ${PANEL}; if (!c) return null;
  return c.list.filter(function (o) { return o.type === 'Text' && o.input; }).map(function (o) {
    return { text: o.text, name: o.name, bild: o._uiTextKnopf ? o._uiTextKnopf.texture.key : null,
      h: o.input.hitArea.height, w: o.input.hitArea.width,
      bildImPanel: !!(o._uiTextKnopf && o._uiTextKnopf.parentContainer === c) }; }); })()`;

describe('Messing: Bilder geladen', () => {
  let H = null;
  before(async () => { H = await hub(); });
  after(async () => { if (H) await H.shutdown(); });

  test('Platte aus ui_rahmen, Sprecher in Messing, Rede in Pergament, keine eckigen Klammern', () => {
    oeffnen(H);
    const r = run(H, `(function () { var c = ${PANEL};
      return { tiefe: c.depth,
        rahmen: c.list.filter(function (o) { return o.type === 'Image' && o.texture.key === 'ui_rahmen'; }).length,
        graphics: c.list.filter(function (o) { return o.type === 'Graphics'; }).length,
        zonen: c.list.filter(function (o) { return o.type === 'Zone'; }).length,
        texte: c.list.filter(function (o) { return o.type === 'Text'; }).map(function (o) { return [o.text, o.style.color]; }) }; })()`);
    assert.strictEqual(r.tiefe, 1600);
    assert.strictEqual(r.rahmen, 9, 'neunteilige Platte');
    assert.strictEqual(r.graphics, 0, 'keine gezeichneten Kaesten mehr');
    assert.strictEqual(r.zonen, 0);
    assert.deepStrictEqual(r.texte[0], ['ALDRIC', '#ffd166']);
    assert.deepStrictEqual(r.texte[1], ['Das Siegel. Eine Formalie.', '#efe6d2']);
    assert.ok(r.texte.every((t) => !/[[\]]/.test(t[0])), 'eckige Klammern: ' + JSON.stringify(r.texte));
    zu(H);
  });

  test('Wahlen und Abbrechen sind Messingknoepfe, mind. 44 px hoch, Bild im Panel', () => {
    oeffnen(H);
    const k = run(H, KNOEPFE);
    assert.deepStrictEqual(k.map((b) => b.text), ['Das Siegel abliefern', 'Es unbemerkt beschädigen', 'Abbrechen (ESC)']);
    for (const b of k) {
      assert.ok(b.bild && b.bild.indexOf('ui_knopf@') === 0, b.text + ': Bild ' + b.bild);
      assert.ok(b.bildImPanel, b.text + ': Knopfbild nicht im Panel-Container');
      assert.ok(b.h >= 44, b.text + ': Trefferflaeche nur ' + b.h + ' px hoch');
      assert.ok(b.w >= 200, b.text + ': Trefferflaeche nur ' + b.w + ' px breit');
    }
    assert.ok(/#4a1e22/.test(k[2].bild), 'Abbrechen rot getoent: ' + k[2].bild);
    zu(H);
  });

  test('Hover und Druck wechseln das Knopfbild', () => {
    oeffnen(H);
    const r = run(H, `(function () { var b = ${PANEL}.list.filter(function (o) { return o.text === 'Es unbemerkt beschädigen'; })[0];
      var bild = b._uiTextKnopf, z = [bild.texture.key];
      b.emit('pointerover'); z.push(bild.texture.key);
      b.emit('pointerdown'); z.push(bild.texture.key);
      b.emit('pointerout'); z.push(bild.texture.key);
      return z; })()`);
    assert.ok(r[0].indexOf('ui_knopf@') === 0);
    assert.ok(r[1].indexOf('ui_knopf_hover@') === 0, r[1]);
    assert.ok(r[2].indexOf('ui_knopf_gedrueckt@') === 0, r[2]);
    assert.ok(r[3].indexOf('ui_knopf@') === 0, r[3]);
    zu(H);
  });

  test('Klick auf "Das Siegel abliefern" setzt verification_sealed und loest auf', () => {
    run(H, FLAGS_ZURUECK);
    oeffnen(H);
    run(H, `${PANEL}.list.filter(function (o) { return o.text === 'Das Siegel abliefern'; })[0].emit('pointerup')`);
    H.step(1);
    assert.deepStrictEqual(run(H, FLAGS), { sealed: true, refused: false });
    const dc = run(H, 'window.__dc');
    assert.deepStrictEqual(dc.aufgeloest, [{ index: 0, flags: ['verification_sealed'] }]);
    assert.strictEqual(dc.abgebrochen, 0);
    assert.strictEqual(run(H, `!!${PANEL}`), false, 'Panel bleibt offen');
  });

  test('Klick auf "Es unbemerkt beschädigen" setzt verification_refused', () => {
    run(H, FLAGS_ZURUECK);
    oeffnen(H);
    run(H, `${PANEL}.list.filter(function (o) { return o.text === 'Es unbemerkt beschädigen'; })[0].emit('pointerup')`);
    H.step(1);
    assert.deepStrictEqual(run(H, FLAGS), { sealed: false, refused: true });
    assert.deepStrictEqual(run(H, 'window.__dc.aufgeloest'), [{ index: 1, flags: ['verification_refused'] }]);
  });

  test('Abbrechen-Knopf und ESC: kein Flag, onCancel, Panel weg', () => {
    run(H, FLAGS_ZURUECK);
    oeffnen(H);
    run(H, `${PANEL}.list.filter(function (o) { return o.name === 'dialogChoiceAbbrechen'; })[0].emit('pointerup')`);
    H.step(1);
    assert.strictEqual(run(H, 'window.__dc.abgebrochen'), 1);
    assert.strictEqual(run(H, `!!${PANEL}`), false);
    oeffnen(H);
    run(H, `${HUB}.input.keyboard.emit('keydown-ESC')`);
    H.step(1);
    assert.strictEqual(run(H, 'window.__dc.abgebrochen'), 1);
    assert.deepStrictEqual(run(H, 'window.__dc.aufgeloest'), []);
    assert.strictEqual(run(H, `!!${PANEL}`), false);
    assert.deepStrictEqual(run(H, FLAGS), { sealed: false, refused: false });
  });

  test('Kontrast aller Texte mind. 4,5:1', () => {
    oeffnen(H);
    alleLesbar(kontraste(H, TEXTE_IN(`${PANEL}.list`)), 'Siegel-Wahl');
    zu(H);
    oeffnen(H, 'window.storyDialog.byScene.edikt_anschlag');
    alleLesbar(kontraste(H, TEXTE_IN(`${PANEL}.list`)), 'Edikt-Wahl');
    zu(H);
  });

  test('bildschirmfest: scrollFactor 0 rekursiv, auch bei verschobener Kamera ganz im Bild', () => {
    run(H, `${HUB}.cameras.main.scrollX += 300`);
    oeffnen(H, 'window.storyDialog.byScene.edikt_anschlag');
    const r = run(H, `(function () { var c = ${PANEL}, cam = ${HUB}.cameras.main, schlecht = [];
      (function lauf(o) { if (o.scrollFactorX !== 0 || o.scrollFactorY !== 0) schlecht.push(o.type + ' ' + (o.text || ''));
        (o.list || []).forEach(lauf); })(c);
      var b = c.getBounds();
      return { schlecht: schlecht, oben: b.y, unten: b.bottom, links: b.x, rechts: b.right, h: cam.height, w: cam.width }; })()`);
    run(H, `${HUB}.cameras.main.scrollX -= 300`);
    assert.deepStrictEqual(r.schlecht, []);
    assert.ok(r.oben >= 0 && r.unten <= r.h, 'Panel ragt aus dem Bild: ' + JSON.stringify(r));
    assert.ok(r.links >= 0 && r.rechts <= r.w);
    zu(H);
  });

  test('Englisch: "Cancel (ESC)" ohne Klammern', () => {
    run(H, `window.i18n.setLanguage('en')`);
    oeffnen(H);
    const k = run(H, KNOEPFE);
    run(H, `window.i18n.setLanguage('de')`);
    assert.strictEqual(k[k.length - 1].text, 'Cancel (ESC)');
    zu(H);
  });

  test('Hub-Weg: Siegel-Seite im NPC-Dialog, Wahl zeigt Aldrics Antwort als naechste Seite', () => {
    run(H, FLAGS_ZURUECK);
    run(H, `(function () { var s = ${HUB};
      var e = window.storyDialog.byQuest.magistrat_verification;
      s._dialogOpen = true;
      s._showDialoguePages({ id: 'aldric' }, 'Aldric', [s._storyChoicePage(e)], 'flavor', null, 0); })()`);
    H.step(2);
    assert.strictEqual(run(H, `${PANEL}.list.filter(function (o) { return o.type === 'Image' && o.texture.key === 'ui_rahmen'; }).length`), 9);
    run(H, `${PANEL}.list.filter(function (o) { return o.text === 'Das Siegel abliefern'; })[0].emit('pointerup')`);
    H.step(2);
    assert.deepStrictEqual(run(H, FLAGS), { sealed: true, refused: false });
    const seite = run(H, `(function () { var c = ${HUB}._dialogContainer; return c ? c.list.filter(function (o) { return o.type === 'Text'; })
      .map(function (o) { return o._dialogVoll || o.text; }).join(' | ') : null; })()`);
    assert.ok(seite && seite.indexOf('ALDRIC') >= 0, 'Antwortseite fehlt: ' + seite);
    run(H, `${HUB}._closeDialog(null)`);
    H.step(1);
  });

  test('Hub-Abraeumen (Sweep) nimmt Panel samt Knopfbildern mit', () => {
    oeffnen(H);
    run(H, `${HUB}._sweepDialogSurfaces()`);
    H.step(1);
    const rest = run(H, `${HUB}.children.list.filter(function (o) {
      return o.type === 'Image' && o.texture && /^ui_(knopf|rahmen)/.test(o.texture.key) && o.depth >= 1500 && o.depth < 1700; }).length`);
    assert.strictEqual(run(H, `!!${PANEL}`), false);
    assert.strictEqual(rest, 0);
  });
});

describe('Rueckfall: Bilder fehlen', () => {
  let H = null;
  before(async () => {
    H = await hub();
    run(H, `(function () { var UR = window.uiRahmen;
      UR.vorladen = function () {}; UR.nachladen = function () {};
      UR.ALLE.forEach(function (k) { window.game.textures.remove(k); }); })()`);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('alte Zeichnung (Graphics + Zonen), Wahl setzt dasselbe Flag', () => {
    run(H, FLAGS_ZURUECK);
    oeffnen(H);
    const r = run(H, `(function () { var c = ${PANEL};
      return { bilder: c.list.filter(function (o) { return o.type === 'Image'; }).length,
        graphics: c.list.filter(function (o) { return o.type === 'Graphics'; }).length,
        zonen: c.list.filter(function (o) { return o.type === 'Zone'; }).length,
        texte: c.list.filter(function (o) { return o.type === 'Text'; }).map(function (o) { return o.text; }) }; })()`);
    assert.strictEqual(r.bilder, 0);
    assert.strictEqual(r.graphics, 4);
    assert.strictEqual(r.zonen, 3);
    assert.strictEqual(r.texte[0], 'ALDRIC: Das Siegel. Eine Formalie.');
    assert.strictEqual(r.texte[r.texte.length - 1], 'Abbrechen (ESC)');
    run(H, `${PANEL}.list.filter(function (o) { return o.type === 'Zone'; })[0].emit('pointerup')`);
    H.step(1);
    assert.deepStrictEqual(run(H, FLAGS), { sealed: true, refused: false });
    assert.deepStrictEqual(run(H, 'window.__dc.aufgeloest'), [{ index: 0, flags: ['verification_sealed'] }]);
  });
});
