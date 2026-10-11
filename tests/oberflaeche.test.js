// tests/oberflaeche.test.js — zweite Runde Messing-Oberflaeche (#182), fest
// eingebaut: Inventar, HUD-Leisten (Desktop und Mobile), NPC-Dialoge im Hub,
// Wissensbaum und die Zeilen der Schmiede.
//
// Normalfall: gebackene Messingfelder, Seltenheit weiter klar erkennbar,
// Kontrast aller Texte mind. 4,5:1, und das HUD legt pro Bild nichts neu an.
// Rueckfall: fehlen die Bilder (Laden gescheitert), zeichnet jede Stelle
// ihre alte Form statt leer zu bleiben. Geprueft am echten Spiel (headless,
// Canvas).

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launch, launchDungeon } = require('../tools/headless/index.js');
const { kontraste, alleLesbar, TEXTE_IN } = require('./kontrastMessung');

/** H.run, Ergebnis aus dem vm-Realm geholt (deepStrictEqual vergleicht sonst Prototypen). */
function run(H, js) {
  const v = H.run(js);
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

const HUB = `window.game.scene.getScene('HubSceneV2')`;
const NEUE_BILDER = ['ui_feld', 'ui_feld_gewaehlt', 'ui_ring', 'ui_leiste'];

async function hub() {
  const H = await launch({ search: '?autostart=1&debug=1', renderer: 'canvas' });
  await H.waitForScene('HubSceneV2', { maxRounds: 600 });
  // Der Einfuehrungstext des Hubs laege sonst ueber allem.
  run(H, `(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')`);
  H.step(30);
  return H;
}

/**
 * Laden gescheitert nachstellen: Vor- und Nachladen tun nichts, die Bilder
 * sind weg. Danach muss jede Stelle ihren Rueckfall zeichnen.
 */
function bilderWeg(H) {
  run(H, `(function () { var UR = window.uiRahmen;
    UR.vorladen = function () {}; UR.nachladen = function () {};
    UR.ALLE.forEach(function (k) { window.game.textures.remove(k); }); })()`);
}

/** Vier Gegenstaende je Seltenheit ins Raster, eine Waffe anlegen, Inventar auf. */
function inventarOeffnen(H) {
  run(H, `(function () {
    var LS = window.LootSystem;
    [0, 1, 2, 3].forEach(function (t) { window.InventoryGrid.einlagern(LS.rollItem('WPN_EISENKLINGE', 8, t)); });
    equipment.weapon = LS.rollItem('WPN_EISENKLINGE', 8, 3);
    openInventory();
    invSelected = 1;
    refreshInventoryUI();
  })()`);
  H.step(3);
}
function inventarZu(H) {
  run(H, 'closeInventory()');
  H.step(2);
}

/** Wahlseite eines NPC-Dialogs (annehmen / mehr / ablehnen). */
function wahlDialog(H) {
  run(H, `(function () { var sc = ${HUB}; sc._dialogOpen = true;
    sc._showDialoguePages(sc.npcs.find(function (n) { return n.data.id === 'aldric'; }).data, 'Ratsherr Aldric',
      [{ text: 'Bring mir die Akte aus dem Rathauskeller.', choices: [
        { label: 'Annehmen', action: 'accept' }, { label: 'Mehr erfahren', action: 'info' },
        { label: 'Ablehnen', action: 'decline' }] }], 'offer', null, 0); })()`);
  H.step(3);
}

/** Mobile-Faehigkeitsknopf im Hub schmuecken; liefert die Messingringe der Szene. */
const MOBILE_KNOPF = `var sc = ${HUB};
  var c = sc.add.circle(200, 300, 38, 0xff0000, 0.6).setScrollFactor(0).setDepth(1200);
  var los = function () { window.mobileAbilityButtonsDecorate({ detail: { scene: sc, buttons: [{ spec: { key: 'attack' }, circle: c }] } }); };
  var ringe = function () { return sc.children.list.filter(function (o) { return o.type === 'Image' && o.texture.key === 'ui_ring'; }); };`;

/** Bilder (auch in Containern) einer Szene mit ihrem Texturschluessel. */
const BILDER = (szeneJs) => `(function () { var r = []; (function lauf(l) { l.forEach(function (o) {
  if (o.type === 'Container') return lauf(o.list); if (o.type === 'Image') r.push(o.texture.key); }); })(${szeneJs}.children.list); return r; })()`;

const SCHMIEDE = `window.game.scene.getScene('CraftingScene')`;

describe('Messing-Oberflaeche: Inventar, Dialoge, Wissensbaum, Mobile, Schmiede', () => {
  let H = null;
  before(async () => { H = await hub(); });
  after(async () => { if (H) await H.shutdown(); });

  test('die neuen Bilder sind im Hub vorgeladen, ein zweites Vorladen laedt nichts', () => {
    // Die Flagge gibt es nicht mehr.
    assert.strictEqual(run(H, 'typeof window.uiRahmen.neu'), 'undefined');
    assert.deepStrictEqual(NEUE_BILDER.filter((k) => !run(H, `window.uiRahmen.ALLE.indexOf('${k}') >= 0`)), [],
      'nicht im Satz, den Hub und Dungeon vorladen');
    assert.deepStrictEqual(NEUE_BILDER.filter((k) => !run(H, `window.game.textures.exists('${k}')`)), []);
    assert.strictEqual(run(H, `window.uiRahmen.bereit(${HUB})`), true);
    const n = run(H, `(function () { var sc = ${HUB};
      window.uiRahmen.vorladen(sc); var n = sc.load.list.size; sc.load.reset(); return n; })()`);
    assert.strictEqual(n, 0, 'schon geladene Bilder werden doppelt angefordert');
  });

  test('gebackene Platte stimmt auch, nachdem neunteilig Teil-Frames angelegt hat', () => {
    // Phaser setzt mit dem ersten tex.add() den "ersten Frame" um — ohne
    // __BASE backte gebacken() danach eine aufgeblasene Ecke statt der Platte.
    const r = run(H, `(function () { var sc = ${HUB}, UR = window.uiRahmen;
      UR.platte(sc, -500, -500, 200, 100, 0).forEach(function (t) { t.destroy(); });
      var key = UR.gebacken(sc, 'ui_rahmen', 300, 120, 36, 0.6);
      var ctx = window.game.textures.get(key).getSourceImage().getContext('2d');
      var d = ctx.getImageData(0, 0, 300, 120).data, n = 0;
      for (var i = 0; i < d.length; i += 4) { if (d[i] > 90 && d[i] > d[i + 2] + 30) n++; }
      var m = ctx.getImageData(150, 60, 1, 1).data, e = ctx.getImageData(3, 3, 1, 1).data;
      return { messing: n / (300 * 120), mitte: [m[0], m[1], m[2]], ecke: [e[0], e[1], e[2], e[3]] }; })()`);
    assert.ok(r.mitte.every((c) => c < 50), 'Mitte nicht dunkel: ' + r.mitte);
    assert.ok(r.ecke[3] > 0 && r.ecke[0] > r.ecke[2], 'Ecke nicht Messing: ' + r.ecke);
    // Messing nur am Rand (gemessen 7 %); die aufgeblasene Ecke bedeckte 39 %.
    assert.ok(r.messing < 0.2, 'zu viel Messing, Ecke aufgeblasen? ' + (r.messing * 100).toFixed(0) + ' %');
  });

  test('Inventar: Messing-Platte, Messingzellen, gewaehlte Zelle hell', () => {
    inventarOeffnen(H);
    const r = run(H, `(function () {
      var gewaehlt = invUI.zellen.filter(function (z) { return z.bg.texture.key.indexOf('ui_feld_gewaehlt@') === 0; }).length;
      return { platte: invUI.panel.list[0].texture.key, interaktiv: !!invUI.panel.list[0].input,
        normal: invUI.zellen.filter(function (z) { return z.bg.texture.key.indexOf('ui_feld@') === 0; }).length,
        gewaehlt: gewaehlt, zellen: invUI.zellen.length,
        soll: (function (g) { return g.b * g.h; })(window.InventoryGrid.groesse(inventory[1])),
        platz: invUI.equip.head.slot.texture.key };
    })()`);
    assert.ok(r.platte.indexOf('ui_rahmen@800x480') === 0, 'keine Messing-Platte: ' + r.platte);
    assert.strictEqual(r.interaktiv, true, 'die Platte faengt keine Klicks mehr ab');
    // Das gewaehlte Stueck liegt auf mehreren Zellen; genau die leuchten.
    assert.ok(r.soll >= 1);
    assert.strictEqual(r.gewaehlt, r.soll);
    assert.strictEqual(r.normal + r.gewaehlt, r.zellen);
    assert.strictEqual(r.platz, 'ui_feld@64x64_45');
  });

  test('Inventar: Seltenheit als farbiger Saum, je Stufe deutlich im Bild', () => {
    const saeume = run(H, `(function () {
      return invUI.slots.map(function (s, i) {
        var it = inventory[i];
        if (!it || typeof it.gridX !== 'number') return null;
        var r = s.seltenheit, b = r.getBounds();
        return { tier: getItemTier(it), rahmen: s.bg.texture.key, sichtbar: r.visible, farbe: r.strokeColor,
          ueberSymbol: invUI.panel.getIndex(r) > invUI.panel.getIndex(s.icon),
          soll: parseTintColor(getItemTierColor(it), 0), x: b.x, y: b.y, w: b.width, h: b.height };
      }).filter(Boolean);
    })()`);
    const stufen = saeume.filter((s) => s.tier >= 0 && s.tier <= 3);
    assert.ok(new Set(stufen.map((s) => s.tier)).size >= 4, 'nicht alle vier Seltenheiten im Test: ' + JSON.stringify(stufen.map((s) => s.tier)));
    stufen.forEach((s) => {
      assert.ok(s.sichtbar, 'Saum unsichtbar');
      // Ueber dem Symbol, sonst verdeckt es ihn (und kleiner machen darf
      // man das Symbol nicht, siehe inventarSymbolgroesse.test.js).
      assert.ok(s.ueberSymbol, 'Saum liegt unter dem Symbol');
      assert.strictEqual(s.farbe, s.soll, 'Saum nicht in der Seltenheitsfarbe');
      assert.ok(/^ui_feld(_gewaehlt)?@/.test(s.rahmen), 'Gegenstand nicht auf einem Messingfeld: ' + s.rahmen);
    });
    // Im gerenderten Bild: die Saumfarbe steht wirklich da (Canvas kennt kein
    // setTintFill). Gemessen ohne Symbole und Stapelzahl — eine graue Klinge
    // zaehlte sonst als grauer Saum.
    run(H, `invUI.slots.forEach(function (s) { s._warIcon = s.icon.visible; s._warLabel = s.label.visible; s.icon.visible = false; s.label.visible = false; s.indicator.visible = false; })`);
    H.step(1);
    const c = H.window.game.canvas, ctx = c.getContext('2d');
    const bild = stufen.map((s) => ctx.getImageData(Math.round(s.x), Math.round(s.y), Math.round(s.w), Math.round(s.h)).data);
    run(H, `invUI.slots.forEach(function (s) { s.icon.visible = s._warIcon; s.label.visible = s._warLabel; }); refreshInventoryUI()`);
    stufen.forEach((s, k) => {
      const d = bild[k];
      const R = (s.soll >> 16) & 255, G = (s.soll >> 8) & 255, B = s.soll & 255;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i] - R) + Math.abs(d[i + 1] - G) + Math.abs(d[i + 2] - B) < 60) n++;
      }
      assert.ok(n >= (s.w + s.h) * 0.5, 'Seltenheit ' + s.tier + ' kaum im Bild: ' + n + ' Pixel');
      console.log('# Saum Stufe ' + s.tier + ': ' + n + ' Pixel (Soll ' + Math.round((s.w + s.h) * 0.5) + ')');
    });
  });

  test('Inventar: Ausruestung traegt den Saum, leere Plaetze nicht', () => {
    const r = run(H, `({ waffe: invUI.equip.weapon.seltenheit.visible, farbe: invUI.equip.weapon.seltenheit.strokeColor,
      soll: parseTintColor(getItemTierColor(equipment.weapon), 0), kopf: invUI.equip.head.seltenheit.visible })`);
    assert.deepStrictEqual(r, { waffe: true, farbe: r.soll, soll: r.soll, kopf: false });
    assert.strictEqual(r.soll, 0xff8844, 'die angelegte Waffe ist legendaer (orange)');
  });

  test('Inventar: Texte auf der Platte lesbar', () => {
    alleLesbar(kontraste(H, TEXTE_IN('invUI.panel.list')), 'Inventar');
    inventarZu(H);
  });

  test('NPC-Dialog: Platte und getoente Messingknoepfe, alles bildschirmfest', () => {
    wahlDialog(H);
    const r = run(H, `(function () {
      var c = ${HUB}._dialogContainer, alle = [];
      (function lauf(o) { alle.push(o); if (o.list) o.list.forEach(lauf); })(c);
      var knoepfe = c.list.filter(function (o) { return o._uiTextKnopf; });
      return { graphics: c.list.filter(function (o) { return o.type === 'Graphics'; }).length,
        platte: c.list.filter(function (o) { return o.type === 'Image' && o.texture.key === 'ui_rahmen'; }).length,
        toene: knoepfe.map(function (b) { return b._uiTextKnopf.texture.key.split('_').pop(); }),
        kaesten: knoepfe.filter(function (b) { return b.style.backgroundColor; }).length,
        rollend: alle.filter(function (o) { return o.scrollFactorX !== 0 || o.scrollFactorY !== 0; }).length };
    })()`);
    assert.strictEqual(r.graphics, 0, 'der alte Kasten liegt noch darunter');
    assert.strictEqual(r.platte, 9, 'keine neunteilige Platte');
    assert.deepStrictEqual(r.toene, ['#3d6a3d', '#3d4a6a', '#6a3d3d'], 'Bedeutungsfarben verloren');
    assert.strictEqual(r.kaesten, 0);
    assert.strictEqual(r.rollend, 0, 'Teile scrollen mit der Kamera (Mobile-Taps treffen daneben)');
    const hover = run(H, `(function () { var b = ${HUB}._dialogContainer.list.filter(function (o) { return o._uiTextKnopf; })[0];
      b.emit('pointerover'); var a = b._uiTextKnopf.texture.key; b.emit('pointerout'); return [a, b._uiTextKnopf.texture.key]; })()`);
    assert.ok(hover[0].indexOf('ui_knopf_hover@') === 0 && hover[1].indexOf('ui_knopf@') === 0, hover.join(' / '));
  });

  test('NPC-Dialog: Texte lesbar, Schliessen raeumt alles ab', () => {
    alleLesbar(kontraste(H, TEXTE_IN(`${HUB}._dialogContainer.list`)), 'NPC-Dialog');
    run(H, `${HUB}._closeDialog(null)`);
    H.step(2);
    const rest = run(H, BILDER(HUB)).filter((k) => k.indexOf('ui_knopf') === 0 || k === 'ui_rahmen');
    assert.deepStrictEqual(rest, [], 'Teile ueberleben den Dialog');
  });

  test('Wissensbaum: Platte, Messingknoepfe, Bestaetigung mit gesperrtem Knopf', () => {
    run(H, `${HUB}._showKnowledgeTreeUI()`);
    H.step(3);
    const r = run(H, `(function () { var sc = ${HUB}, c = sc._dialogContainer;
      return { platte: c.list.filter(function (o) { return o.type === 'Image' && o.texture.key.indexOf('ui_rahmen@') === 0; }).length,
        graphics: c.list.filter(function (o) { return o.type === 'Graphics'; }).length,
        knoepfe: sc._ktFooterLayer.list.filter(function (o) { return o._uiTextKnopf; }).length }; })()`);
    assert.strictEqual(r.platte, 1);
    assert.strictEqual(r.graphics, 0, 'alter Kasten oder Kopfleiste noch da');
    assert.ok(r.knoepfe >= 2, 'Fusszeilen-Knoepfe nicht eingekleidet: ' + r.knoepfe);
    alleLesbar(kontraste(H, TEXTE_IN(`${HUB}._dialogContainer.list`)), 'Wissensbaum');
    // Ohne Gold: Zuruecksetzen ist gesperrt und zeigt das entsaettigte Bild.
    run(H, `window.LootSystem.spendGold && window.LootSystem.getGold && window.LootSystem.spendGold(window.LootSystem.getGold()); ${HUB}._ktShowRespecConfirm()`);
    H.step(2);
    const d = run(H, `(function () { var dlg = ${HUB}._ktConfirmDlg;
      var k = dlg.list.filter(function (o) { return o._uiTextKnopf; }).map(function (o) { return o._uiTextKnopf.texture.key.split('@')[0]; });
      return { platte: dlg.list.filter(function (o) { return o.type === 'Image' && o.texture.key.indexOf('ui_rahmen@400x160') === 0; }).length, knoepfe: k,
        preis: window.KnowledgeTree.getRespecCost ? window.KnowledgeTree.getRespecCost() : 0 }; })()`);
    assert.strictEqual(d.platte, 1);
    assert.deepStrictEqual(d.knoepfe, [d.preis > 0 ? 'ui_knopf_aus' : 'ui_knopf', 'ui_knopf']);
    alleLesbar(kontraste(H, TEXTE_IN(`${HUB}._ktConfirmDlg.list`)), 'Wissensbaum-Bestaetigung');
    run(H, `${HUB}._ktCloseConfirm(); ${HUB}._ktCloseModal()`);
    H.step(2);
  });

  test('Mobile-Knopf: Ring folgt dem Knopf, blendet mit aus und wird abgebaut', () => {
    const r = run(H, `(function () { ${MOBILE_KNOPF}
      los();
      var ring = ringe()[0];
      var vorher = { x: ring.x, y: ring.y, b: ring.displayWidth, tiefe: ring.depth };
      c.setPosition(260, 320);
      window.dispatchEvent('demonfall:mobile-layout-changed');   // Testkopf: dispatch(typ)
      var nachher = { x: ring.x, y: ring.y };
      window.mobileAbilityLeisteSichtbar(false); var aus = ring.visible;
      window.mobileAbilityLeisteSichtbar(true); var an = ring.visible;
      los();   // Neuaufbau des Layouts: der alte Ring muss weg
      return { vorher: vorher, nachher: nachher, aus: aus, an: an, anzahl: ringe().length, alt: !!ring.scene };
    })()`);
    assert.deepStrictEqual(r.vorher, { x: 200, y: 300, b: 38 * 2.2, tiefe: 1200.5 });
    assert.deepStrictEqual(r.nachher, { x: 260, y: 320 });
    assert.strictEqual(r.aus, false);
    assert.strictEqual(r.an, true);
    assert.strictEqual(r.anzahl, 1, 'Ringe sammeln sich bei jedem Layout');
    assert.strictEqual(r.alt, false);
  });

  test('Schmiede: Zeilen auf Messingfeldern, Auswahl wechselt das Bild, lesbar', async () => {
    run(H, `(function () { var LS = window.LootSystem;
      [1, 2, 3].forEach(function (t) { window.InventoryGrid.einlagern(LS.rollItem('WPN_EISENKLINGE', 8, t)); });
      ${HUB}.scene.start('CraftingScene'); })()`);
    await H.waitForScene('CraftingScene', { maxRounds: 200 });
    H.step(3);
    const r = run(H, `(function () { var sc = ${SCHMIEDE};
      return { felder: Object.keys(sc.equipSlotBgs).filter(function (k) { return sc.equipSlotBgs[k]._uiFeld; }).length,
        plaetze: Object.keys(sc.equipSlotBgs).length,
        zeilen: sc.invRows.filter(function (z) { return z.bg._uiFeld; }).length, alle: sc.invRows.length,
        liste: sc.invListBg.visible }; })()`);
    assert.strictEqual(r.felder, r.plaetze);
    assert.ok(r.alle >= 2 && r.zeilen === r.alle, r.zeilen + ' von ' + r.alle + ' Zeilen');
    assert.strictEqual(r.liste, false, 'der graue Listenkasten steht noch');
    const wahl = run(H, `(function () { var sc = ${SCHMIEDE};
      sc.invRows[1].bg.emit('pointerdown');
      var z = sc.invRows.map(function (z) { return z.bg._uiFeld.texture.key.split('@')[0]; });
      sc.equipSlotBgs.weapon.emit('pointerdown');
      var p = sc.equipSlotBgs.weapon._uiFeld.texture.key.split('@')[0];
      var z2 = sc.invRows.map(function (z) { return z.bg._uiFeld.texture.key.split('@')[0]; });
      return { z: z, p: p, z2: z2 }; })()`);
    assert.strictEqual(wahl.z[1], 'ui_feld_gewaehlt');
    assert.strictEqual(wahl.z.filter((k) => k === 'ui_feld_gewaehlt').length, 1);
    assert.strictEqual(wahl.p, 'ui_feld_gewaehlt');
    assert.ok(wahl.z2.every((k) => k === 'ui_feld'), 'alte Auswahl bleibt hell: ' + wahl.z2.join(','));
    H.step(2);
    const SZ = `(function () { var sc = ${SCHMIEDE}, r = [];
      Object.keys(sc.equipSlots).forEach(function (k) { var e = sc.equipSlots[k]; r.push(e.label, e.nameText, e.statsText); });
      sc.invRows.forEach(function (z) { r.push(z.nameText, z.statsText); }); return r; })()`;
    alleLesbar(kontraste(H, SZ), 'Schmiede-Zeilen');
  });

  test('Schmiede: die Schrift eines Ausruestungsplatzes bleibt innerhalb der Beschlaege', () => {
    // Gemessen an der Tinte (nicht am Textkasten) gegen das gebackene Feld:
    // die Zeilen in seiner Mitte, die nicht Messing sind. Vorher stand die
    // Zeile "Legendaer · Gst 8" bis zu 6 px auf dem unteren Beschlag.
    const r = run(H, `(function () { var sc = ${SCHMIEDE};
      function tinte(t) { var c = t.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, lo = -1, hi = -1;
        for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (lo < 0) lo = y; hi = y; break; }
        var s = t.style.resolution || 1; return lo < 0 ? null : [t.y - t.originY * t.height + lo / s, t.y - t.originY * t.height + (hi + 1) / s]; }
      return Object.keys(sc.equipSlots).map(function (k) { var e = sc.equipSlots[k], f = e.bg._uiFeld;
        var ctx = window.game.textures.get(f.texture.key).getSourceImage().getContext('2d');
        var spalte = ctx.getImageData(Math.round(f.width / 2), 0, 1, f.height).data, innen = [];
        // Innen = dunkle Mitte (Anthrazit #1c191f, keine Messingfarbe).
        for (var y = 0; y < f.height; y++) if (spalte[y * 4] + spalte[y * 4 + 1] + spalte[y * 4 + 2] < 120) innen.push(y);
        var oben = f.y - f.height / 2;
        return { platz: k, innen: [oben + innen[0], oben + innen[innen.length - 1] + 1],
          tinte: [e.label, e.nameText, e.statsText].map(tinte).filter(Boolean),
          text: e.statsText.text }; }); })()`);
    assert.ok(r.some((p) => p.text.trim()), 'kein Platz traegt eine Seltenheitszeile');
    r.forEach((p) => {
      p.tinte.forEach((t) => {
        assert.ok(t[0] >= p.innen[0] && t[1] <= p.innen[1],
          p.platz + ': Schrift ' + t.join('..') + ' ragt ueber den Beschlag (innen ' + p.innen.join('..') + ')');
      });
    });
  });
});

describe('Rueckfall im Hub: fehlen die Bilder, bleibt die alte Zeichnung', () => {
  let H = null;
  before(async () => { H = await hub(); bilderWeg(H); });
  after(async () => { if (H) await H.shutdown(); });

  test('Inventar: alte Platte, alte Zellen und Rahmen, kein Seltenheitssaum', () => {
    assert.strictEqual(run(H, `window.uiRahmen.bereit(${HUB})`), false);
    // Das Inventar wird beim Betreten des Hubs gebaut; neu bauen wie beim
    // naechsten Szenenwechsel.
    run(H, `destroyInventoryUI(); initInventoryUI.call(${HUB}); null`);
    inventarOeffnen(H);
    const r = run(H, `(function () {
      var p = invUI.panel.list;
      return { platte: p[0].texture.key, zelle: invUI.zellen[5].bg.texture.key,
        rahmen: invUI.slots[0].bg.texture.key, saum: invUI.slots.filter(function (s) { return s.seltenheit; }).length,
        platz: invUI.equip.weapon.slot.texture.key, messing: invUI._messing };
    })()`);
    assert.deepStrictEqual(r, { platte: 'uiPanel', zelle: 'uiZelle', rahmen: 'uiSlot', saum: 0, platz: 'uiZelle', messing: false });
    inventarZu(H);
  });

  test('NPC-Dialog: gezeichneter Kasten, Farbkaesten als Knoepfe', () => {
    wahlDialog(H);
    const r = run(H, `(function () {
      var c = ${HUB}._dialogContainer;
      return { graphics: c.list.filter(function (o) { return o.type === 'Graphics'; }).length,
        bilder: c.list.filter(function (o) { return o.type === 'Image'; }).length,
        kasten: c.list.filter(function (o) { return o.type === 'Text' && o.style.backgroundColor === '#3d6a3d'; }).length };
    })()`);
    assert.deepStrictEqual(r, { graphics: 1, bilder: 0, kasten: 1 });
    run(H, `${HUB}._closeDialog(null)`);
    H.step(2);
  });

  test('Wissensbaum: gezeichnete Platte, Farbkaesten unten', () => {
    run(H, `${HUB}._showKnowledgeTreeUI()`);
    H.step(3);
    const r = run(H, `(function () {
      var c = ${HUB}._dialogContainer;
      return { bilder: c.list.filter(function (o) { return o.type === 'Image'; }).length,
        graphics: c.list.filter(function (o) { return o.type === 'Graphics'; }).length,
        knoepfe: ${HUB}._ktFooterLayer.list.filter(function (o) { return o._uiTextKnopf; }).length };
    })()`);
    assert.deepStrictEqual(r, { bilder: 0, graphics: 2, knoepfe: 0 });
    run(H, `${HUB}._ktCloseModal()`);
    H.step(2);
  });

  test('Mobile-Knopf: kein Ring, der Knopf selbst bleibt', () => {
    const r = run(H, `(function () { ${MOBILE_KNOPF} los(); return { ringe: ringe().length, kreis: c.visible && !!c.scene }; })()`);
    assert.deepStrictEqual(r, { ringe: 0, kreis: true });
  });

  // Zuletzt: die Schmiede kleidet ihre Knoepfe ein und laedt dazu nach.
  test('Schmiede: Zeilen bleiben Rechtecke, der Listenkasten steht', async () => {
    run(H, `window.InventoryGrid.einlagern(window.LootSystem.rollItem('WPN_EISENKLINGE', 8, 2)); ${HUB}.scene.start('CraftingScene'); null`);
    await H.waitForScene('CraftingScene', { maxRounds: 200 });
    H.step(3);
    const r = run(H, `(function () { var sc = ${SCHMIEDE};
      return { felder: Object.keys(sc.equipSlotBgs).filter(function (k) { return sc.equipSlotBgs[k]._uiFeld; }).length,
        zeilen: sc.invRows.filter(function (z) { return z.bg._uiFeld; }).length, alle: sc.invRows.length,
        liste: sc.invListBg.visible, deckend: sc.equipSlotBgs.weapon.fillAlpha }; })()`);
    assert.ok(r.alle >= 1);
    assert.deepStrictEqual(r, { felder: 0, zeilen: 0, alle: r.alle, liste: true, deckend: 1 });
  });
});

/** Alle HUD-Bilder (Szene und Kachel-Container) mit Tiefe. */
const HUD_BILDER = `(function () { var sc = window.game.scene.getScene('GameScene'), r = [];
  (function lauf(l, tiefe) { l.forEach(function (o) {
    if (o.type === 'Container') return lauf(o.list, o.depth);
    if (o.type === 'Image') r.push({ key: o.texture.key, tiefe: tiefe === null ? o.depth : tiefe, sichtbar: o.visible });
  }); })(sc.children.list, null); return r; })()`;

/** Erstes Element jeder Faehigkeitskachel (Bild-Schluessel oder Typ). */
const KACHEL_GRUND = `(function () { var sc = window.game.scene.getScene('GameScene');
  return sc.children.list.filter(function (o) { return o.type === 'Container' && o.depth === 1001; })
    .map(function (c) { return c.list[0].type === 'Image' ? c.list[0].texture.key : c.list[0].type; }); })()`;

describe('HUD im Dungeon', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 3, zusatz: '&debug=1' });
    run(H, 'window._playerInvincible = true');
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Ringe um Portraet und Knoepfe, Messingleiste um den Lebensbalken', () => {
    const b = run(H, HUD_BILDER);
    assert.strictEqual(b.filter((x) => x.key === 'ui_ring' && x.tiefe === 1600.5).length, 3);
    assert.strictEqual(b.filter((x) => x.key.indexOf('ui_leiste@230x28') === 0).length, 1);
    assert.strictEqual(run(H, `window.HUDv2.elements.hpFill.visible`), true);
  });

  test('Faehigkeitskacheln auf einer gebackenen Messing-Platte', () => {
    const r = run(H, KACHEL_GRUND);
    assert.ok(r.length >= 3, 'zu wenige Kacheln: ' + r.length);
    assert.ok(r.every((k) => k.indexOf('ui_rahmen@220x42') === 0), r.join(','));
    // Eine Textur fuer alle Kacheln.
    assert.strictEqual(new Set(r).size, 1);
  });

  test('pro Bild wird nichts neu angelegt (nur die Fuellung waechst)', () => {
    const zaehlen = () => run(H, `(function () { var sc = window.game.scene.getScene('GameScene');
      return { hud: sc.children.list.filter(function (o) { return o.depth >= 1600 && o.depth < 1700; }).length,
        texturen: window.game.textures.getTextureKeys().filter(function (k) { return k.indexOf('@') > 0; }).length }; })()`);
    const vorher = zaehlen();
    const breite0 = run(H, 'window.HUDv2.elements.hpFill.width');
    run(H, 'window.playerHealth = Math.max(1, Math.floor(window.playerMaxHealth / 3)); window.HUDv2.update()');
    H.step(60);
    const nachher = zaehlen();
    assert.deepStrictEqual(nachher, vorher);
    assert.ok(run(H, 'window.HUDv2.elements.hpFill.width') < breite0, 'die Fuellung folgt dem Leben nicht mehr');
  });

  test('HUD-Texte auf Leiste und Kacheln lesbar', () => {
    const auswahl = `(function () { var sc = window.game.scene.getScene('GameScene'), r = [];
      sc.children.list.forEach(function (o) {
        if (o.type === 'Text' && o.depth >= 1600 && o.depth < 1700) r.push(o);
        if (o.type === 'Container' && o.depth === 1001 && o.visible) o.list.forEach(function (t) { if (t.type === 'Text') r.push(t); });
      }); return r; })()`;
    alleLesbar(kontraste(H, auswahl), 'HUD');
  });

  test('Rueckfall: ohne Bilder baut das HUD Goldraender und Kachel-Rechtecke', async () => {
    // Laden gescheitert nachstellen und die Spielszene neu aufbauen lassen.
    bilderWeg(H);
    run(H, `window.game.scene.getScene('GameScene').scene.restart(); null`);
    H.step(2);
    await H.waitForScene('GameScene', { maxRounds: 250 });
    H.step(10);
    const b = run(H, HUD_BILDER);
    assert.strictEqual(b.filter((x) => x.key === 'ui_ring' || x.key.indexOf('ui_leiste') === 0).length, 0);
    const grund = run(H, KACHEL_GRUND);
    assert.ok(grund.length >= 3 && grund.every((t) => t === 'Rectangle'), grund.join(','));
    // Die gezeichneten Goldraender der runden Knoepfe stehen wieder.
    const e = run(H, `({ menue: window.HUDv2.elements.burgerBg.lineWidth, inv: window.HUDv2.elements.invBg.lineWidth, hp: window.HUDv2.elements.hpFill.visible })`);
    assert.ok(e.menue > 0 && e.inv > 0, JSON.stringify(e));
    assert.strictEqual(e.hp, true);
  });
});
