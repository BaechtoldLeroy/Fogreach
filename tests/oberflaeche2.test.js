// tests/oberflaeche2.test.js — dritte Runde Messing-Oberflaeche (#193) hinter
// ?debug=1&oberflaeche2=neu: Inventar-Tooltip (samt Vergleich), Inventar-
// knoepfe, Charakterwerte- und Menue-Overlay des HUD, Wissensbaum (Kacheln und
// Tooltip) und die Inventarzeilen der Schmiede.
//
// Mit Flagge: Messing-Bilder, Kontrast aller Texte mind. 4,5:1, Tooltips
// legen pro Hover nichts neu an, Overlays bleiben bildschirmfest, in der
// Schmiede steht die Schrift innerhalb der Beschlaege.
// Ohne Flagge: exakt die bisherige Zeichnung. Rueckfall (Flagge an, Bilder
// fehlen): ebenfalls die bisherige Zeichnung. Geprueft am echten Spiel
// (headless, Canvas).

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');
const { kontraste, alleLesbar, TEXTE_IN } = require('./kontrastMessung');

function run(H, js) {
  const v = H.run(js);
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

const HUB = `window.game.scene.getScene('HubSceneV2')`;
const SCHMIEDE = `window.game.scene.getScene('CraftingScene')`;

async function hub(flagge) {
  const H = await launch({ search: '?autostart=1&debug=1' + (flagge ? '&oberflaeche2=neu' : ''), renderer: 'canvas' });
  await H.waitForScene('HubSceneV2', { maxRounds: 600 });
  // Der Einfuehrungstext des Hubs laege sonst ueber allem.
  run(H, `(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')`);
  H.step(30);
  return H;
}

/** Laden gescheitert nachstellen (wie tests/oberflaeche.test.js). */
function bilderWeg(H) {
  run(H, `(function () { var UR = window.uiRahmen;
    UR.vorladen = function () {}; UR.nachladen = function () {};
    UR.ALLE.forEach(function (k) { window.game.textures.remove(k); }); })()`);
}

/** Vier Klingen ins Raster, eine legendaere anlegen, Inventar auf, Tooltip mit Vergleich. */
function inventarMitTooltip(H) {
  run(H, `(function () {
    var LS = window.LootSystem;
    [0, 1, 2, 3].forEach(function (t) { window.InventoryGrid.einlagern(LS.rollItem('WPN_EISENKLINGE', 8, t)); });
    equipment.weapon = LS.rollItem('WPN_EISENKLINGE', 8, 3);
    window.materialCounts.PORTAL_SCROLL = 2; window.materialCounts.STAIR_SCROLL = 0;
    openInventory(); invSelected = 1; refreshInventoryUI();
    window._refreshPortalButton(); window._refreshStairButton();
    var blau = inventory.filter(function (it) { return it && getItemTier(it) === 1; })[0];
    invUI.showTooltip({ x: 330, y: 120 }, blau, equipment.weapon);
  })()`);
  H.step(2);
}

/** Zustand der beiden Tooltip-Kaesten. */
const TOOLTIP = `(function () {
  function box(b) {
    var cmds = b.bg.commandBuffer || [];
    return { platte: !!b.platte, teile: b.platte ? b.platte.teile.filter(function (t) { return t.visible; }).length : 0,
      keys: b.platte ? b.platte.teile.map(function (t) { return t.texture.key; }) : [],
      // Der alte Kasten fuellt mit Alpha 0,92 — der Wert steht nur dann im Befehlspuffer.
      gefuellt: cmds.indexOf(0.92) >= 0,
      titelFarbe: b.title.style.color, tier: b._tierColor,
      linie: cmds.indexOf(b._tierColor) >= 0,
      w: b._width, h: b._height, x: b.x, y: b.y, sichtbar: b.visible };
  }
  return { haupt: box(tooltip), vergleich: box(tooltip.compareBox) };
})()`;

/** Objekte und gebackene Texturen zaehlen (Leistung: pro Hover nichts Neues). */
const ZAEHLEN = (szene) => `(function () { var n = 0; (function lauf(l) { l.forEach(function (o) { n++; if (o.list) lauf(o.list); }); })(${szene}.children.list);
  return { objekte: n, texturen: window.game.textures.getTextureKeys().length }; })()`;

/** Alle Objekte des HUD-Overlays (Tiefe 2500..2509), samt Containerinhalt. */
const OVERLAY = `(function () { var r = []; ${HUB}.children.list.forEach(function (o) {
  if (o.depth >= 2500 && o.depth < 2510) { r.push(o); if (o.list) o.list.forEach(function (k) { r.push(k); }); } }); return r; })()`;

/**
 * Kleinster Abstand der Schrift (und Knoepfe) eines Overlays zum Plattenrand.
 * Der Beschlag der Platte (Massstab 0,6) ist rund 15 px breit.
 */
const RANDABSTAND = `(function () { var l = ${OVERLAY};
  var p = l.filter(function (o) { return o.type === 'Image' && o.texture.key.indexOf('ui_rahmen@') === 0; })[0].getBounds();
  var m = 99; l.forEach(function (o) {
    if (o.type !== 'Text' && !o._uiKnopf && !(o.type === 'Image' && o.texture.key.indexOf('ui_knopf') === 0)) return;
    if (o.mask || (o.parentContainer && o.parentContainer.mask)) return;
    var b = o.getBounds();
    m = Math.min(m, b.x - p.x, b.y - p.y, p.right - b.right, p.bottom - b.bottom); });
  return Math.round(m); })()`;

/** Wissensbaum-Kacheln: Zustand und Bild je Kachel. */
const KACHELN = `(function () { var r = [];
  ${HUB}._ktCardLayer.list.forEach(function (c) { if (c.type !== 'Container') return;
    var bild = c.list.filter(function (o) { return o.type === 'Image' && o._ktZustand; })[0];
    r.push(bild ? { zustand: bild._ktZustand, key: bild.texture.key, alpha: bild.alpha }
      : { grund: c.list.filter(function (o) { return o.type === 'Graphics'; }).length }); });
  return r; })()`;

/** Tinte (oberste und unterste Pixelzeile mit Schrift) eines Textes in Bildschirm-y. */
const TINTE = `function tinte(t) { var c = t.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, lo = -1, hi = -1;
  for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (lo < 0) lo = y; hi = y; break; }
  var s = t.style.resolution || 1; return lo < 0 ? null : [t.y - t.originY * t.height + lo / s, t.y - t.originY * t.height + (hi + 1) / s]; }`;

describe('mit ?oberflaeche2=neu', () => {
  let H = null;
  before(async () => { H = await hub(true); });
  after(async () => { if (H) await H.shutdown(); });

  test('Flagge erkannt und als bekannte Debug-Flagge gefuehrt', () => {
    assert.strictEqual(run(H, 'window.uiRahmen.oberflaeche2()'), true);
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'debugGate.js'), 'utf8');
    assert.ok(/'oberflaeche2'/.test(src), 'oberflaeche2 fehlt in BEKANNTE_FLAGGEN');
  });

  test('Inventar-Tooltip und Vergleich auf Messing-Platte, Seltenheit im Titel und als Linie', () => {
    inventarMitTooltip(H);
    const r = run(H, TOOLTIP);
    for (const [name, b] of Object.entries(r)) {
      assert.ok(b.sichtbar, name + ' unsichtbar');
      assert.ok(b.platte, name + ': keine Platte');
      assert.strictEqual(b.teile, 9, name + ': Platte nicht neunteilig sichtbar');
      assert.ok(b.keys.every((k) => k === 'ui_rahmen'), name + ': ' + b.keys.join(','));
      assert.strictEqual(b.gefuellt, false, name + ': der schwarze Kasten liegt noch darunter');
      assert.ok(b.linie, name + ': keine Linie in der Seltenheitsfarbe');
    }
    // Die Linie steht wirklich im Bild (gemessen ohne Schrift).
    run(H, `[tooltip, tooltip.compareBox].forEach(function (b) { b.title.visible = false; b.body.visible = false; })`);
    H.step(1);
    const ctx = H.window.game.canvas.getContext('2d');
    for (const [name, b] of Object.entries(r)) {
      const d = ctx.getImageData(Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h)).data;
      const R = (b.tier >> 16) & 255, G = (b.tier >> 8) & 255, B = b.tier & 255;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - R) + Math.abs(d[i + 1] - G) + Math.abs(d[i + 2] - B) < 60) n++;
      assert.ok(n >= b.w * 0.8, name + ': Seltenheitslinie kaum im Bild (' + n + ' Pixel)');
    }
    run(H, `[tooltip, tooltip.compareBox].forEach(function (b) { b.title.visible = true; b.body.visible = true; })`);
    assert.strictEqual(r.haupt.titelFarbe, '#88aaff', 'Titel nicht in der Seltenheitsfarbe (magisch = blau)');
    assert.strictEqual(r.vergleich.titelFarbe, '#ff8844', 'Vergleich nicht in der Seltenheitsfarbe (legendaer)');
  });

  test('Inventar-Tooltip: Schrift innerhalb der Beschlaege, lesbar', () => {
    const r = run(H, `(function () { var b = tooltip, t = b.title.getBounds(), k = b.body.getBounds();
      return { links: Math.min(t.x, k.x) - b.x, oben: t.y - b.y, rechts: b.x + b._width - Math.max(t.right, k.right), unten: b.y + b._height - k.bottom }; })()`);
    // Der Beschlag der Platte ist bei Massstab 0,4 gut 10 px breit; 14 px Abstand.
    Object.entries(r).forEach(([seite, abstand]) => assert.ok(abstand >= 14, seite + ': ' + abstand + ' px'));
    alleLesbar(kontraste(H, TEXTE_IN('[tooltip, tooltip.compareBox]')), 'Inventar-Tooltip');
  });

  test('Inventar-Tooltip: ein weiterer Hover legt weder Objekte noch Texturen an', () => {
    const vorher = run(H, ZAEHLEN(HUB));
    run(H, `(function () { var it = inventory.filter(function (x) { return x && getItemTier(x) === 2; })[0];
      for (var i = 0; i < 5; i++) { invUI.showTooltip({ x: 300 + i * 7, y: 140 }, i % 2 ? it : inventory[1], equipment.weapon); } })()`);
    H.step(1);
    assert.deepStrictEqual(run(H, ZAEHLEN(HUB)), vorher);
  });

  test('Inventarknoepfe: Messing, Zustaende normal / hover / gedrueckt / aus, lesbar', () => {
    run(H, 'invUI.hideTooltip()');
    const k = run(H, `(function () { var B = { portal: invUI.portalBtn, treppe: invUI.stairBtn, werte: invUI.statsBtn, an: invUI.btnEquip, weg: invUI.btnDrop }, r = {};
      Object.keys(B).forEach(function (n) { var b = B[n], i = b._uiTextKnopf;
        // Gebacken wird auf ganze Pixel: bis 0,5 px Abweichung ist Rundung.
        var g = function (v) { return Math.round(v); };
        r[n] = i ? { key: i.texture.key, kasten: b.style.backgroundColor || null, w: g(i.displayWidth - b.width), h: g(i.displayHeight - b.height), mitte: [g(i.x - (b.x + (0.5 - b.originX) * b.width)), g(i.y - (b.y + (0.5 - b.originY) * b.height))] } : null; });
      return r; })()`);
    Object.entries(k).forEach(([n, x]) => {
      assert.ok(x, n + ': kein Messingknopf');
      assert.strictEqual(x.kasten, null, n + ': Farbkasten noch da');
      assert.deepStrictEqual([x.w, x.h, x.mitte], [0, 0, [0, 0]], n + ': Bild deckt den Knopf nicht');
    });
    assert.ok(k.portal.key.startsWith('ui_knopf@') && k.portal.key.endsWith('_#486c1d'), k.portal.key);
    assert.ok(k.treppe.key.startsWith('ui_knopf_aus@'), 'ohne Rolle nicht gesperrt: ' + k.treppe.key);
    assert.ok(k.an.key.endsWith('_#2f4f7a') && k.weg.key.endsWith('_#7a3434'), 'Bedeutungsfarben verloren');
    const z = run(H, `(function () { var b = invUI.btnEquip, i = b._uiTextKnopf, r = [];
      b.emit('pointerover'); r.push(i.texture.key); b.emit('pointerdown'); r.push(i.texture.key);
      b.emit('pointerup'); r.push(i.texture.key); b.emit('pointerout'); r.push(i.texture.key);
      var t = invUI.stairBtn; t.emit('pointerover'); r.push(t._uiTextKnopf.texture.key);
      return r.map(function (k) { return k.split('@')[0]; }); })()`);
    assert.deepStrictEqual(z, ['ui_knopf_hover', 'ui_knopf_gedrueckt', 'ui_knopf_hover', 'ui_knopf', 'ui_knopf_aus']);
    // Rolle gefunden: der Knopf wird wieder aktiv und passt sich der neuen Beschriftung an.
    const neu = run(H, `(function () { window.materialCounts.STAIR_SCROLL = 12; window._refreshStairButton();
      var b = invUI.stairBtn, i = b._uiTextKnopf; return { key: i.texture.key, dw: i.displayWidth - b.width, text: b.text }; })()`);
    assert.ok(neu.key.startsWith('ui_knopf@') && neu.dw === 0, JSON.stringify(neu));
    run(H, 'window.materialCounts.STAIR_SCROLL = 0; window._refreshStairButton()');
    H.step(1);
    alleLesbar(kontraste(H, '[invUI.portalBtn, invUI.stairBtn, invUI.statsBtn, invUI.btnEquip, invUI.btnDrop]'), 'Inventarknoepfe');
    run(H, 'closeInventory()');
    H.step(2);
  });

  test('Charakterwerte: Messing-Platte, Messingknopf, alles bildschirmfest und lesbar', () => {
    run(H, `${HUB}.cameras.main.scrollX = 140; ${HUB}.cameras.main.scrollY = 90; window.HUDv2.openStats(${HUB})`);
    H.step(2);
    const r = run(H, `(function () { var l = ${OVERLAY};
      return { platte: l.filter(function (o) { return o.type === 'Image' && o.texture.key.indexOf('ui_rahmen@') === 0; }).length,
        graphics: l.filter(function (o) { return o.type === 'Graphics'; }).length,
        knopf: l.filter(function (o) { return o._uiTextKnopf; }).map(function (o) { return o._uiTextKnopf.texture.key.split('@')[0]; }),
        rollend: l.filter(function (o) { return o.scrollFactorX !== 0 || o.scrollFactorY !== 0; }).length }; })()`);
    assert.deepStrictEqual(r, { platte: 1, graphics: 0, knopf: ['ui_knopf'], rollend: 0 });
    const rand = run(H, RANDABSTAND);
    assert.ok(rand >= 15, 'Schrift oder Knopf auf dem Beschlag: ' + rand + ' px vom Rand');
    alleLesbar(kontraste(H, `${OVERLAY}.filter(function (o) { return o.type === 'Text'; })`), 'Charakterwerte');
    run(H, 'window.HUDv2._statsContainer.close()');
    H.step(1);
    assert.strictEqual(run(H, `${OVERLAY}.length`), 0, 'Teile ueberleben das Schliessen');
  });

  test('Menue: Platte, Messingknoepfe mit Hover, bildschirmfest, lesbar, sauber abgebaut', () => {
    run(H, `window.HUDv2.openMenu(${HUB})`);
    H.step(2);
    const r = run(H, `(function () { var l = ${OVERLAY};
      var knoepfe = l.filter(function (o) { return o.type === 'Rectangle' && o._uiKnopf; });
      var b = knoepfe[0]; b.emit('pointerover'); var hover = b._uiKnopf.teile[4].texture.key; b.emit('pointerout');
      return { platte: l.filter(function (o) { return o.type === 'Image' && o.texture.key.indexOf('ui_rahmen@') === 0; }).length,
        graphics: l.filter(function (o) { return o.type === 'Graphics'; }).length,
        knoepfe: knoepfe.length, hover: hover, ruhe: b._uiKnopf.teile[4].texture.key,
        schliessen: l.filter(function (o) { return o._uiTextKnopf; }).length,
        rollend: l.filter(function (o) { return o.scrollFactorX !== 0 || o.scrollFactorY !== 0; }).length }; })()`);
    assert.deepStrictEqual(r, { platte: 1, graphics: 0, knoepfe: 6, hover: 'ui_knopf_hover', ruhe: 'ui_knopf', schliessen: 1, rollend: 0 });
    const rand = run(H, RANDABSTAND);
    assert.ok(rand >= 15, 'Schrift oder Knopf auf dem Beschlag: ' + rand + ' px vom Rand');
    alleLesbar(kontraste(H, `${OVERLAY}.filter(function (o) { return o.type === 'Text'; })`), 'Menue');
    run(H, `window.HUDv2._menuContainer.close(); ${HUB}.cameras.main.scrollX = 0; ${HUB}.cameras.main.scrollY = 0`);
    H.step(1);
    assert.strictEqual(run(H, `${OVERLAY}.length`), 0, 'Teile ueberleben das Schliessen');
  });

  test('Wissensbaum: Kacheln auf Messingfeldern, gelernt / lernbar / gesperrt am Bild unterscheidbar', () => {
    run(H, `(function () { var KT = window.KnowledgeTree; KT.addFragments(3); KT.invest(KT.getCatalog()[0].id); })()`);
    run(H, `${HUB}._showKnowledgeTreeUI()`);
    H.step(3);
    const k = run(H, KACHELN);
    assert.ok(k.length >= 15, 'zu wenige Kacheln: ' + k.length);
    assert.ok(k.every((x) => x.zustand), 'Kacheln ohne Messingbild: ' + k.filter((x) => !x.zustand).length);
    const je = (z) => k.filter((x) => x.zustand === z);
    assert.ok(je('gelernt').length >= 1 && je('lernbar').length >= 3 && je('gesperrt').length >= 3,
      'nicht alle drei Zustaende im Test: ' + JSON.stringify(k.map((x) => x.zustand)));
    // gelernt: heller Beschlag mit getoenter Mitte; lernbar: volles Feld; gesperrt: zurueckgenommen.
    je('gelernt').forEach((x) => assert.ok(/^ui_(feld_gewaehlt|rahmen)@.*_#/.test(x.key) && x.alpha === 1, JSON.stringify(x)));
    je('lernbar').forEach((x) => assert.ok(/^ui_(feld|rahmen)@/.test(x.key) && !/gewaehlt/.test(x.key) && x.alpha === 1, JSON.stringify(x)));
    je('gesperrt').forEach((x) => assert.ok(x.alpha < 0.6 && !/gewaehlt/.test(x.key), JSON.stringify(x)));
    // Gezeichnet unterscheidbar: mittlere Helligkeit des Beschlags je Zustand.
    const hell = run(H, `(function () { var sc = ${HUB}, r = {};
      sc._ktCardLayer.list.forEach(function (c) { if (c.type !== 'Container') return;
        var bild = c.list.filter(function (o) { return o._ktZustand; })[0]; if (!bild || r[bild._ktZustand]) return;
        var m = bild.getWorldTransformMatrix(); r[bild._ktZustand] = { x: m.tx - bild.displayWidth / 2, y: m.ty - bild.displayHeight / 2, w: bild.displayWidth, h: bild.displayHeight }; });
      return r; })()`);
    run(H, `${HUB}._ktCardLayer.list.forEach(function (c) { if (c.list) c.list.forEach(function (o) { if (o.type === 'Text') { o._war = o.visible; o.visible = false; } }); })`);
    H.step(1);
    const ctx = H.window.game.canvas.getContext('2d');
    const leucht = {};
    for (const [z, b] of Object.entries(hell)) {
      // Nur der obere Rand (Beschlag), 3 px hoch.
      const d = ctx.getImageData(Math.round(b.x + 8), Math.round(b.y), Math.round(b.w - 16), 3).data;
      let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
      leucht[z] = s / (d.length / 4) / 3;
    }
    run(H, `${HUB}._ktCardLayer.list.forEach(function (c) { if (c.list) c.list.forEach(function (o) { if (o.type === 'Text') o.visible = o._war; }); })`);
    console.log('# Beschlag-Helligkeit je Zustand: ' + JSON.stringify(leucht));
    assert.ok(leucht.gelernt > leucht.lernbar + 20, 'gelernt nicht heller als lernbar');
    assert.ok(leucht.lernbar > leucht.gesperrt + 20, 'gesperrt nicht dunkler als lernbar');
  });

  test('Wissensbaum: aktive Knoepfe in den Kacheln sind Messing, Texte lesbar, alles bildschirmfest', () => {
    const r = run(H, `(function () { var sc = ${HUB}, knoepfe = [], alle = [];
      (function lauf(o) { alle.push(o); if (o.list) o.list.forEach(lauf); })(sc._dialogContainer);
      sc._ktCardLayer.list.forEach(function (c) { if (c.list) c.list.forEach(function (o) { if (o._uiTextKnopf) knoepfe.push(o._uiTextKnopf.texture.key.split('@')[0]); }); });
      return { knoepfe: knoepfe, kaesten: alle.filter(function (o) { return o.type === 'Text' && o.input && o.input.cursor && o.style.backgroundColor && o.parentContainer !== sc._ktFooterLayer; }).length,
        rollend: alle.filter(function (o) { return o.scrollFactorX !== 0 || o.scrollFactorY !== 0; }).length }; })()`);
    assert.ok(r.knoepfe.length >= 3 && r.knoepfe.every((k) => k === 'ui_knopf'), r.knoepfe.join(','));
    assert.strictEqual(r.rollend, 0, 'Teile scrollen mit der Kamera (Mobile-Taps treffen daneben)');
    alleLesbar(kontraste(H, TEXTE_IN(`${HUB}._dialogContainer.list`)), 'Wissensbaum');
  });

  test('Wissensbaum-Tooltip: Messing-Platte, Schrift innen, lesbar, kein Neuaufbau je Hover', () => {
    const treffer = `${HUB}._ktCardLayer.list.filter(function (o) { return o.type === 'Container'; })`;
    run(H, `${treffer}[1].list[0].emit('pointerover')`);
    H.step(1);
    const r = run(H, `(function () { var t = ${HUB}._ktTip, p = t.platte;
      var sicht = p.teile.filter(function (o) { return o.visible; });
      var xs = sicht.map(function (o) { return o.x; }), ys = sicht.map(function (o) { return o.y; });
      var re = sicht.map(function (o) { return o.x + o.displayWidth; }), un = sicht.map(function (o) { return o.y + o.displayHeight; });
      var box = { l: Math.min.apply(0, xs), o: Math.min.apply(0, ys), r: Math.max.apply(0, re), u: Math.max.apply(0, un) };
      return { teile: sicht.length, bg: t.bg.visible, keys: p.teile.map(function (o) { return o.texture.key; }),
        abstand: [t.kopf.x - box.l, t.kopf.y - box.o, box.r - (t.kopf.x + Math.max(t.kopf.width, t.txt.width)), box.u - (t.txt.y + t.txt.height)],
        imContainer: p.teile.every(function (o) { return o.parentContainer === ${HUB}._dialogContainer && o.scrollFactorX === 0; }) }; })()`);
    assert.strictEqual(r.teile, 9);
    assert.strictEqual(r.bg, false, 'der gezeichnete Kasten steht noch');
    assert.ok(r.keys.every((k) => k === 'ui_rahmen'));
    assert.ok(r.imContainer, 'Platte nicht im Dialog oder nicht bildschirmfest');
    r.abstand.forEach((a) => assert.ok(a >= 14, 'Schrift auf dem Beschlag: ' + r.abstand.join(',')));
    alleLesbar(kontraste(H, `[${HUB}._ktTip.kopf, ${HUB}._ktTip.txt]`), 'Wissensbaum-Tooltip');
    const vorher = run(H, ZAEHLEN(HUB));
    run(H, `(function () { var l = ${treffer}; for (var i = 2; i < 8; i++) { l[i].list[0].emit('pointerover'); l[i].list[0].emit('pointerout'); } })()`);
    H.step(1);
    assert.deepStrictEqual(run(H, ZAEHLEN(HUB)), vorher);
    run(H, `${treffer}[1].list[0].emit('pointerout')`);
    assert.strictEqual(run(H, `${HUB}._ktTip.platte.teile.filter(function (o) { return o.visible; }).length`), 0, 'Platte bleibt nach dem Hover stehen');
    run(H, `${HUB}._ktCloseModal()`);
    H.step(2);
  });

  test('Schmiede: Inventarzeilen hoeher, Schrift innerhalb der Beschlaege, lesbar', async () => {
    run(H, `(function () { var LS = window.LootSystem;
      [1, 2, 3].forEach(function (t) { window.InventoryGrid.einlagern(LS.rollItem('WPN_EISENKLINGE', 8, t)); });
      ${HUB}.scene.start('CraftingScene'); })()`);
    await H.waitForScene('CraftingScene', { maxRounds: 200 });
    H.step(3);
    const r = run(H, `(function () { var sc = ${SCHMIEDE}; ${TINTE}
      return { hoehe: sc.invRowH, zeilen: sc.invMaxRows, n: sc.invRows.length, zeilenDaten: sc.invRows.map(function (z) { var f = z.bg._uiFeld;
        var ctx = window.game.textures.get(f.texture.key).getSourceImage().getContext('2d');
        var spalte = ctx.getImageData(Math.round(f.width / 2), 0, 1, f.height).data, innen = [];
        for (var y = 0; y < f.height; y++) if (spalte[y * 4] + spalte[y * 4 + 1] + spalte[y * 4 + 2] < 120) innen.push(y);
        var oben = f.y - f.height / 2;
        return { innen: [oben + innen[0], oben + innen[innen.length - 1] + 1], tinte: [tinte(z.nameText), tinte(z.statsText)], stats: z.statsText.text }; }) }; })()`);
    assert.deepStrictEqual([r.hoehe, r.zeilen], [36, 3]);
    assert.ok(r.n >= 2, 'zu wenige Zeilen: ' + r.n);
    r.zeilenDaten.forEach((z, i) => {
      assert.ok(z.stats.trim(), 'Zeile ' + i + ' ohne Wertezeile');
      z.tinte.forEach((t) => assert.ok(t && t[0] >= z.innen[0] && t[1] <= z.innen[1],
        'Zeile ' + i + ': Schrift ' + (t || []).join('..') + ' ragt ueber den Beschlag (innen ' + z.innen.join('..') + ')'));
      // Und mittig: oben und unten gleich viel Luft (die alte Lage klebte unten).
      const oben = z.tinte[0][0] - z.innen[0], unten = z.innen[1] - z.tinte[1][1];
      assert.ok(Math.abs(oben - unten) <= 3, 'Zeile ' + i + ': Schrift nicht mittig, oben ' + oben + ' / unten ' + unten);
    });
    alleLesbar(kontraste(H, `(function () { var r = []; ${SCHMIEDE}.invRows.forEach(function (z) { r.push(z.nameText, z.statsText); }); return r; })()`), 'Schmiede-Zeilen');
  });
});

describe('ohne Flagge: alles wie bisher', () => {
  let H = null;
  before(async () => { H = await hub(false); });
  after(async () => { if (H) await H.shutdown(); });

  test('Inventar: schwarzer Tooltip-Kasten, Farbkaesten als Knoepfe', () => {
    assert.strictEqual(run(H, 'window.uiRahmen.oberflaeche2()'), false);
    assert.strictEqual(run(H, `window.uiRahmen.bereit(${HUB})`), true, 'Bilder geladen — der Unterschied kommt nur von der Flagge');
    inventarMitTooltip(H);
    alteZeichnungInventar(H);
  });

  test('Charakterwerte und Menue: gezeichnete Kaesten, Rechteck-Knoepfe', () => {
    alteOverlays(H);
  });

  test('Wissensbaum: gezeichnete Kacheln und Tooltip', () => {
    alterWissensbaum(H);
  });

  test('Schmiede: vier Zeilen zu 28 px, Schrift an der alten Stelle', async () => {
    await alteSchmiede(H);
  });
});

describe('Rueckfall: Flagge an, aber die Bilder fehlen', () => {
  let H = null;
  before(async () => {
    H = await hub(true);
    bilderWeg(H);
    // Das Inventar wird beim Betreten gebaut; neu bauen wie beim naechsten Szenenwechsel.
    run(H, `destroyInventoryUI(); initInventoryUI.call(${HUB}); null`);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Inventar: schwarzer Tooltip-Kasten, Farbkaesten als Knoepfe', () => {
    assert.strictEqual(run(H, `window.uiRahmen.bereit(${HUB})`), false);
    inventarMitTooltip(H);
    alteZeichnungInventar(H);
  });

  test('Charakterwerte und Menue: gezeichnete Kaesten', () => { alteOverlays(H); });
  test('Wissensbaum: gezeichnete Kacheln und Tooltip', () => { alterWissensbaum(H); });
  test('Schmiede: alte Zeilen', async () => { await alteSchmiede(H); });
});

// ---- Pruefungen der alten Zeichnung (ohne Flagge und im Rueckfall) ---------

function alteZeichnungInventar(H) {
  const r = run(H, TOOLTIP);
  assert.strictEqual(r.haupt.platte, false);
  assert.strictEqual(r.vergleich.platte, false);
  assert.ok(r.haupt.gefuellt && r.vergleich.gefuellt, 'gezeichneter Kasten fehlt');
  const k = run(H, `[invUI.portalBtn, invUI.stairBtn, invUI.statsBtn, invUI.btnEquip, invUI.btnDrop]
    .map(function (b) { return { kasten: b.style.backgroundColor, messing: !!b._uiTextKnopf }; })`);
  assert.deepStrictEqual(k, [
    { kasten: '#486c1d', messing: false }, { kasten: '#333333', messing: false }, { kasten: '#4a3a1d', messing: false },
    { kasten: '#47a', messing: false }, { kasten: '#a44', messing: false }]);
  run(H, 'invUI.hideTooltip(); closeInventory()');
  H.step(2);
}

function alteOverlays(H) {
  run(H, `window.HUDv2.openStats(${HUB})`);
  H.step(1);
  const s = run(H, `(function () { var l = ${OVERLAY}; return { graphics: l.filter(function (o) { return o.type === 'Graphics' && o.depth === 2501; }).length,
    bilder: l.filter(function (o) { return o.type === 'Image'; }).length,
    kasten: l.filter(function (o) { return o.type === 'Text' && o.style.backgroundColor === '#3a3a3a'; }).length }; })()`);
  assert.deepStrictEqual(s, { graphics: 1, bilder: 0, kasten: 1 });
  run(H, 'window.HUDv2._statsContainer.close()');
  run(H, `window.HUDv2.openMenu(${HUB})`);
  H.step(1);
  const m = run(H, `(function () { var l = ${OVERLAY}; return { graphics: l.filter(function (o) { return o.type === 'Graphics'; }).length,
    bilder: l.filter(function (o) { return o.type === 'Image'; }).length,
    rechtecke: l.filter(function (o) { return o.type === 'Rectangle' && o.isFilled && !o._uiKnopf && o.depth === 2502; }).length }; })()`);
  assert.deepStrictEqual(m, { graphics: 1, bilder: 0, rechtecke: 6 });
  run(H, 'window.HUDv2._menuContainer.close()');
  H.step(1);
}

function alterWissensbaum(H) {
  run(H, `${HUB}._showKnowledgeTreeUI()`);
  H.step(3);
  const k = run(H, KACHELN);
  assert.ok(k.length >= 15);
  assert.ok(k.every((x) => x.grund === 1 && !x.zustand), 'Kachel ohne gezeichneten Grund');
  run(H, `${HUB}._ktCardLayer.list.filter(function (o) { return o.type === 'Container'; })[1].list[0].emit('pointerover')`);
  const t = run(H, `({ platte: !!${HUB}._ktTip.platte, bg: ${HUB}._ktTip.bg.visible })`);
  assert.deepStrictEqual(t, { platte: false, bg: true });
  run(H, `${HUB}._ktCloseModal()`);
  H.step(2);
}

async function alteSchmiede(H) {
  run(H, `(function () { window.InventoryGrid.einlagern(window.LootSystem.rollItem('WPN_EISENKLINGE', 8, 2));
    ${HUB}.scene.start('CraftingScene'); })()`);
  await H.waitForScene('CraftingScene', { maxRounds: 200 });
  H.step(3);
  const r = run(H, `(function () { var sc = ${SCHMIEDE}, z = sc.invRows[0];
    return { hoehe: sc.invRowH, zeilen: sc.invMaxRows, feld: z.bg.height, name: Math.round(z.nameText.y - z.bg.y), werte: Math.round(z.statsText.y - z.bg.y) }; })()`);
  assert.deepStrictEqual(r, { hoehe: 28, zeilen: 4, feld: 24, name: -8, werte: 3 });
}
