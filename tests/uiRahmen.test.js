// tests/uiRahmen.test.js — gestaltete Toasts und Dialoge hinter ?ui=neu (#189, #182).
//
// Mit ?debug=1&ui=neu zeichnen Toast und Wahl-Dialog den Messing-Satz aus
// assets/ui (neunteilig, Symbol je Art, Knopfzustaende). OHNE Flagge muss
// alles exakt wie vorher aussehen: Graphics-Panel, keine ui_*-Bilder.
// Geprueft am echten Hub (headless, Canvas-Renderer) und einmal im Dungeon.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

async function hub(search) {
  const H = await launch({ search, renderer: 'canvas' });
  await H.waitForScene('HubSceneV2', { maxRounds: 600 });
  H.step(30);
  return H;
}

/** Texturschluessel aller sichtbaren Bilder einer Szene. */
function bilder(H, szene) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('${szene}');
    return sc.children.list.filter(function (o) { return o.type === 'Image' && o.visible; })
      .map(function (o) { return o.texture.key; });
  })()`);
}

function toast(H, art) {
  H.run(`window.EventSystem.showEventToast(window.game.scene.getScene('HubSceneV2'), 'Hinterhalt! Die Kettenwache sperrt den Raum.', '${art}')`);
  H.step(40); // das Hereingleiten (420 ms) laeuft ganz durch
}

function dialog(H) {
  H.run(`window.EventSystem.showEventChoiceDialog(window.game.scene.getScene('HubSceneV2'), 'Eine Truhe. Öffnen?', [
    { label: 'Öffnen', callback: function () { window.__wahl = 1; } },
    { label: 'Liegen lassen', callback: function () { window.__wahl = 2; } }
  ])`);
  H.step(5);
}

function schliessen(H) {
  H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2502; })
      .forEach(function (r) { r.emit('pointerdown'); });
  })()`);
  H.step(2);
}

describe('mit ?ui=neu', () => {
  let H = null;
  before(async () => { H = await hub('?autostart=1&debug=1&ui=neu'); });
  after(async () => { if (H) await H.shutdown(); });

  test('die Grafiken sind im Hub vorgeladen', () => {
    assert.strictEqual(H.run('window.uiRahmen.an()'), true);
    assert.strictEqual(H.run(`window.uiRahmen.bereit(window.game.scene.getScene('HubSceneV2'))`), true);
  });

  test('Toast: Banner neunteilig, Symbol je Art, voll eingeblendet', () => {
    toast(H, 'hinterhalt');
    const b = bilder(H, 'HubSceneV2');
    assert.strictEqual(b.filter((k) => k === 'ui_toast').length, 9, 'kein neunteiliges Banner: ' + b.join(','));
    assert.ok(b.includes('ui_symbol_gefahr'), 'Hinterhalt zeigt kein Gefahr-Symbol');
    const t = H.run(`(function () { var a = window.game.scene.getScene('HubSceneV2')._activeEventToast;
      return { gestaltet: a.gestaltet, alpha: a.label.alpha, panel: !!a.panel, y: a.label.y }; })()`);
    assert.strictEqual(t.gestaltet, true);
    assert.strictEqual(t.panel, false, 'das alte Graphics-Panel liegt noch darunter');
    assert.ok(t.alpha > 0.99, 'nicht eingeblendet: ' + t.alpha);
    assert.ok(Math.abs(t.y - 80) < 0.5, 'nicht an seinem Platz: ' + t.y);
  });

  test('Toast: Symbol folgt der Art, der vorige Toast verschwindet ganz', () => {
    toast(H, 'treasure_cache');
    let b = bilder(H, 'HubSceneV2');
    assert.ok(b.includes('ui_symbol_fund'));
    assert.ok(!b.includes('ui_symbol_gefahr'), 'der vorige Toast blieb stehen');
    assert.strictEqual(b.filter((k) => k === 'ui_toast').length, 9);
    toast(H, 'quest_objective_done');
    b = bilder(H, 'HubSceneV2');
    assert.ok(b.includes('ui_symbol_quest'));
    toast(H, 'unbekannt');
    assert.ok(bilder(H, 'HubSceneV2').includes('ui_symbol_ereignis'), 'Rueckfall-Symbol fehlt');
  });

  test('Toast: blendet weich ein (nicht sofort voll da) und raeumt sich ab', () => {
    H.run(`window.EventSystem.showEventToast(window.game.scene.getScene('HubSceneV2'), 'Fund', 'treasure_cache')`);
    H.step(3);
    const a = H.run(`window.game.scene.getScene('HubSceneV2')._activeEventToast.label.alpha`);
    assert.ok(a > 0 && a < 0.9, 'kein Einblenden, alpha=' + a);
    H.step(400); // > 0,42 + 3,2 + 0,65 s
    assert.strictEqual(H.run(`window.game.scene.getScene('HubSceneV2')._activeEventToast`), null);
    assert.ok(!bilder(H, 'HubSceneV2').includes('ui_toast'), 'Banner-Teile bleiben liegen');
  });

  test('Wahl-Dialog: Platte und Knoepfe im neuen Stil, Hover wechselt das Bild', () => {
    dialog(H);
    const b = bilder(H, 'HubSceneV2');
    assert.strictEqual(b.filter((k) => k === 'ui_rahmen').length, 9, 'keine Platte: ' + b.join(','));
    assert.strictEqual(b.filter((k) => k === 'ui_knopf').length, 18, 'nicht beide Knoepfe gestaltet');
    const hover = H.run(`(function () {
      var sc = window.game.scene.getScene('HubSceneV2');
      var r = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2502; })[0];
      r.emit('pointerover');
      return { teil: r._uiKnopf.teile[4].texture.key, gefuellt: r.isFilled };
    })()`);
    assert.strictEqual(hover.teil, 'ui_knopf_hover');
    assert.strictEqual(hover.gefuellt, false, 'die alte Hover-Farbe liegt wieder ueber dem Bild');
    schliessen(H);
    const nachher = bilder(H, 'HubSceneV2');
    assert.ok(!nachher.includes('ui_rahmen') && !nachher.includes('ui_knopf') && !nachher.includes('ui_knopf_hover'),
      'Teile ueberleben den Dialog: ' + nachher.join(','));
    assert.strictEqual(H.run('window.eventChoiceOpen'), false);
  });

  test('Einstellungen: Platte statt Graphics, Knoepfe eingekleidet, Abbau beim Schliessen', () => {
    const r = menue(H, 'window.openSettingsScene', 'SettingsScene');
    assert.strictEqual(r.platte, 9, 'keine Platte');
    assert.strictEqual(r.graphics, 0, 'das alte Panel liegt noch darunter');
    assert.ok(r.knoepfe >= 15 && r.knoepfe === r.rechtecke, r.knoepfe + ' von ' + r.rechtecke + ' Knoepfen eingekleidet');
    // Der deaktivierte Tutorial-Knopf (setEnabled) zeigt das entsaettigte Bild.
    const aus = H.run(`(function () {
      var sc = window.game.scene.getScene('SettingsScene');
      var b = sc._tutorialSkipBtn; b.setEnabled(false);
      var a = b.bg._uiKnopf.teile[4].texture.key;
      b.bg.emit('pointerover');
      var nachHover = b.bg._uiKnopf.teile[4].texture.key;
      b.setEnabled(true);
      return [a, nachHover, b.bg._uiKnopf.teile[4].texture.key];
    })()`);
    assert.strictEqual(aus.join(','), 'ui_knopf_aus,ui_knopf_aus,ui_knopf');
    H.run(`window.game.scene.getScene('SettingsScene')._close()`);
    H.step(5);
    assert.strictEqual(H.run(`window.game.scene.isActive('SettingsScene')`), false);
  });

  test('Schwarzmarkt: gewaehlter Reiter hell, Wechsel faerbt um, neue Zeilen-Knoepfe auch', () => {
    H.run('window._dungeonMerchant = true');
    const r = menue(H, 'window.openShopScene', 'ShopScene');
    assert.strictEqual(r.platte, 9);
    const reiter = () => H.run(`(function () {
      var t = window.game.scene.getScene('ShopScene')._tabButtons;
      return Object.keys(t).map(function (k) { return k + ':' + t[k]._uiKnopf.teile[4].texture.key; }).join(' ');
    })()`);
    assert.strictEqual(reiter(), 'items:ui_knopf_hover potions:ui_knopf');
    H.run(`window.game.scene.getScene('ShopScene')._renderTab('potions')`);
    H.step(2);
    assert.strictEqual(reiter(), 'items:ui_knopf potions:ui_knopf_hover');
    const offen = H.run(`(function () {
      var sc = window.game.scene.getScene('ShopScene'); var n = 0;
      (function lauf(l) { l.forEach(function (o) {
        if (o.type === 'Container') return lauf(o.list);
        if (o.type === 'Rectangle' && o.isStroked && o.input && o.input.enabled && o.width <= 320 && o.height <= 48) n++;
      }); })(sc.children.list);
      return n;
    })()`);
    assert.strictEqual(offen, 0, offen + ' Knoepfe des neuen Reiters ohne Rahmen');
    H.run(`window.game.scene.getScene('ShopScene')._close()`);
    H.run('window._dungeonMerchant = false');
    H.step(5);
  });

  test('Druckerei: gesperrte Knoepfe entsaettigt, offene normal', () => {
    const r = menue(H, 'window.openPrintingHouseScene', 'PrintingHouseScene');
    assert.strictEqual(r.platte, 9);
    const k = H.run(`window.game.scene.getScene('PrintingHouseScene').children.list
      .filter(function (o) { return o._uiKnopf; }).map(function (o) { return o._uiKnopf.teile[4].texture.key; }).join(',')`);
    // Ohne Gold: Bestechen und Tauschen gesperrt, Schliessen offen.
    assert.strictEqual(k, 'ui_knopf_aus,ui_knopf_aus,ui_knopf');
    H.run(`window.game.scene.getScene('PrintingHouseScene')._close()`);
    H.step(5);
  });

  test('Journal: Platte im Container statt Graphics', () => {
    H.run(`window.storySystem.showJournalOverlay(window.game.scene.getScene('HubSceneV2'), function () {})`);
    H.step(3);
    const r = H.run(`(function () {
      var c = window.game.scene.getScene('HubSceneV2').children.list.filter(function (o) { return o.type === 'Container' && o.depth === 6001; })[0];
      return { platte: c.list.filter(function (o) { return o.type === 'Image' && o.texture.key === 'ui_rahmen'; }).length,
               graphics: c.list.filter(function (o) { return o.type === 'Graphics'; }).length };
    })()`);
    assert.strictEqual(r.platte, 9);
    assert.strictEqual(r.graphics, 0);
    H.run(`window.game.scene.getScene('HubSceneV2').children.list.filter(function (o) { return o.depth >= 6000 && o.depth < 6100; }).forEach(function (o) { o.destroy(); })`);
    H.run('window.resumeGameClock && window.resumeGameClock()');
    H.step(2);
  });

  test('Schmiede: Werktisch als Platte, Knoepfe im Container eingekleidet', async () => {
    H.run(`window.game.scene.getScene('HubSceneV2').scene.start('CraftingScene')`);
    await H.waitForScene('CraftingScene', { maxRounds: 200 });
    H.step(3);
    const r = H.run(`(function () {
      var sc = window.game.scene.getScene('CraftingScene');
      return { platte: sc.children.list.filter(function (o) { return o.type === 'Image' && o.texture.key === 'ui_rahmen'; }).length,
               rahmenSichtbar: sc.werkbankRahmen.visible,
               zurueck: sc.massSalvageBtn.container.list.filter(function (o) { return o.type === 'Image'; }).length };
    })()`);
    assert.strictEqual(r.platte, 9);
    assert.strictEqual(r.rahmenSichtbar, false);
    assert.strictEqual(r.zurueck, 9, 'der Knopf im Container hat keinen Rahmen');
  });
});

/** Oeffnet ein Menue ueber dem Hub und zaehlt Platte, Graphics und Knoepfe. */
function menue(H, oeffner, key) {
  H.run(`${oeffner}(window.game.scene.getScene('HubSceneV2'))`);
  H.step(5);
  return H.run(`(function () {
    var sc = window.game.scene.getScene('${key}');
    var l = sc.children.list;
    return {
      platte: l.filter(function (o) { return o.type === 'Image' && o.texture.key === 'ui_rahmen'; }).length,
      graphics: l.filter(function (o) { return o.type === 'Graphics' && o.depth === 2001; }).length,
      knoepfe: l.filter(function (o) { return o._uiKnopf; }).length,
      rechtecke: l.filter(function (o) { return o.type === 'Rectangle' && o.input && o.input.enabled && o.width <= 320 && o.height <= 48 && (o.isStroked || o._uiKnopf); }).length
    };
  })()`);
}

describe('ohne Flagge: alles wie vorher', () => {
  let H = null;
  before(async () => { H = await hub('?autostart=1&debug=1'); });
  after(async () => { if (H) await H.shutdown(); });

  test('nichts geladen, Toast mit Graphics-Panel', () => {
    assert.strictEqual(H.run('window.uiRahmen.an()'), false);
    assert.strictEqual(H.run(`window.game.textures.exists('ui_toast')`), false, 'Grafiken ohne Flagge geladen');
    toast(H, 'hinterhalt');
    const t = H.run(`(function () { var a = window.game.scene.getScene('HubSceneV2')._activeEventToast;
      return { gestaltet: !!a.gestaltet, panel: a.panel && a.panel.type }; })()`);
    assert.strictEqual(t.gestaltet, false);
    assert.strictEqual(t.panel, 'Graphics');
    assert.ok(!bilder(H, 'HubSceneV2').some((k) => /^ui_/.test(k)));
  });

  test('Wahl-Dialog mit grauen Rechtecken wie gehabt', () => {
    dialog(H);
    assert.ok(!bilder(H, 'HubSceneV2').some((k) => /^ui_/.test(k)));
    const r = H.run(`(function () {
      var sc = window.game.scene.getScene('HubSceneV2');
      var r = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2502; })[0];
      r.emit('pointerover');
      return { gefuellt: r.isFilled, farbe: r.fillColor, rand: r.isStroked };
    })()`);
    assert.strictEqual(r.gefuellt, true);
    assert.strictEqual(r.farbe, 0x555555);
    assert.strictEqual(r.rand, true);
    schliessen(H);
  });

  test('Einstellungen, Schwarzmarkt, Druckerei, Journal: altes Panel, keine ui-Bilder', () => {
    for (const [o, k] of [['window.openSettingsScene', 'SettingsScene'], ['window.openPrintingHouseScene', 'PrintingHouseScene']]) {
      const r = menue(H, o, k);
      assert.strictEqual(r.platte, 0, k);
      assert.ok(r.graphics >= 1, k + ': altes Panel fehlt');
      assert.strictEqual(r.knoepfe, 0, k);
      H.run(`window.game.scene.getScene('${k}')._close()`);
      H.step(5);
    }
    H.run('window._dungeonMerchant = true');
    const s = menue(H, 'window.openShopScene', 'ShopScene');
    assert.strictEqual(s.platte + s.knoepfe, 0);
    assert.strictEqual(s.graphics, 1);
    assert.strictEqual(H.run(`window.game.scene.getScene('ShopScene')._tabButtons.items.strokeColor`), 0xffd166);
    H.run(`window.game.scene.getScene('ShopScene')._close()`);
    H.run('window._dungeonMerchant = false');
    H.step(5);
    H.run(`window.storySystem.showJournalOverlay(window.game.scene.getScene('HubSceneV2'), function () {})`);
    H.step(3);
    const j = H.run(`(function () {
      var c = window.game.scene.getScene('HubSceneV2').children.list.filter(function (o) { return o.type === 'Container' && o.depth === 6001; })[0];
      return c.list.filter(function (o) { return o.type === 'Graphics'; }).length + ':' + c.list.filter(function (o) { return o.type === 'Image'; }).length;
    })()`);
    assert.strictEqual(j, '1:0');
    H.run(`window.game.scene.getScene('HubSceneV2').children.list.filter(function (o) { return o.depth >= 6000 && o.depth < 6100; }).forEach(function (o) { o.destroy(); })`);
    H.run('window.resumeGameClock && window.resumeGameClock()');
    H.step(2);
  });

  // Fehler, unabhaengig von der Flagge behoben: Hinweise blieben stumm.

  test('beide Namen zeigen denselben Toast', () => {
    assert.strictEqual(H.run(`typeof window.EventSystem.showEventToast`), 'function');
    assert.strictEqual(H.run(`window.EventSystem.showEventToast === window.EventSystem.showToast`), true);
    assert.strictEqual(H.run(`window.showEventToast === window.EventSystem.showToast`), true);
  });

  test('der Edikt-Hinweis im Hub erscheint jetzt wirklich', () => {
    H.run(`window.game.scene.getScene('HubSceneV2')._hubHinweis('Das Edikt gilt.')`);
    H.step(2);
    assert.strictEqual(H.run(`window.game.scene.getScene('HubSceneV2')._activeEventToast.label.text`), 'Das Edikt gilt.');
  });
});
