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

// ---- Lesbarkeit (#189) ----------------------------------------------------
// Gemessen wird, was der Spieler sieht: alle Texte kurz ausblenden, ein Bild
// rendern und unter jedem Text den Median der Hintergrund-Leuchtdichte mit
// seiner Farbe vergleichen (WCAG-Kontrast). Ziel 4,5:1.

function leucht(r, g, b) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function hexLeucht(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.replace(/./g, '$&$&');
  const n = parseInt(h, 16);
  return leucht((n >> 16) & 255, (n >> 8) & 255, n & 255);
}
const kontrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Hintergrund ohne Texte rendern; liefert die Leuchtdichten eines Rechtecks. */
function hintergrund(H) {
  H.run(`(function () { window.__versteckt = [];
    window.game.scene.scenes.forEach(function (s) { (function lauf(l) { l.forEach(function (o) {
      if (o.type === 'Container') return lauf(o.list);
      if (o.type === 'Text' && o.visible) { o.visible = false; window.__versteckt.push(o); } }); })(s.children ? s.children.list : []); });
  })()`);
  H.step(1);
  const c = H.window.game.canvas;
  const bild = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  H.run('window.__versteckt.forEach(function (o) { o.visible = true; })');
  const sx = c.width / 960, sy = c.height / 480;
  return function bereich(x, y, w, h) {
    const L = [];
    const x0 = Math.max(0, Math.floor(x * sx)), y0 = Math.max(0, Math.floor(y * sy));
    const x1 = Math.min(c.width, Math.ceil((x + w) * sx)), y1 = Math.min(c.height, Math.ceil((y + h) * sy));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = (yy * c.width + xx) * 4;
      L.push(leucht(bild.data[i], bild.data[i + 1], bild.data[i + 2]));
    }
    return L.sort((a, b) => a - b);
  };
}

/** Kontrast je Text; auswahlJs liefert ein Array von Text-Objekten. */
function kontraste(H, auswahlJs) {
  const texte = H.run(`(function () {
    return ${auswahlJs}.filter(function (o) { return o.visible && o.alpha > 0.5 && String(o.text || '').trim(); }).map(function (o) {
      var b = o.getBounds();
      return { text: String(o.text).slice(0, 30), farbe: o.style.color, x: b.x, y: b.y, w: b.width, h: b.height };
    });
  })()`);
  const bereich = hintergrund(H);
  return texte.map((t) => {
    const L = bereich(t.x, t.y, t.w, t.h);
    return Object.assign(t, { k: kontrast(hexLeucht(t.farbe), L[Math.floor(L.length / 2)]) });
  });
}

function alleLesbar(liste, was) {
  assert.ok(liste.length > 0, was + ': keine Texte gemessen');
  const schlecht = liste.filter((t) => t.k < 4.5);
  assert.strictEqual(schlecht.map((t) => `"${t.text}" ${t.farbe} ${t.k.toFixed(2)}:1`).join(', '), '', was + ': unter 4,5:1');
}

const SZENE_TEXTE = (key) => `(function () { var r = []; (function lauf(l) { l.forEach(function (o) {
  if (o.type === 'Container') return lauf(o.list); if (o.type === 'Text') r.push(o); }); })(window.game.scene.getScene('${key}').children.list); return r; })()`;
const HUB_TEXTE = (minDepth) => `(function () { var r = []; (function lauf(l, tief) { l.forEach(function (o) {
  if (o.type === 'Container') { if (o.visible && o.alpha > 0.5 && (tief || o.depth >= ${minDepth})) lauf(o.list, true); return; }
  if (o.type === 'Text' && (tief || o.depth >= ${minDepth})) r.push(o); }); })(window.game.scene.getScene('HubSceneV2').children.list, false); return r; })()`;

describe('Lesbarkeit mit ?ui=neu (gemessener Kontrast)', () => {
  let H = null;
  before(async () => {
    H = await launch({ search: '?autostart=1&debug=1&ui=neu', renderer: 'canvas' });
    await H.waitForScene('HubSceneV2', { maxRounds: 600 });
    // Der Einfuehrungstext des Hubs laege sonst ueber allem.
    H.run(`(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')`);
    H.step(30);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Toast-Text auf dem Banner', () => {
    toast(H, 'hinterhalt');
    const k = kontraste(H, `[window.game.scene.getScene('HubSceneV2')._activeEventToast.label]`);
    alleLesbar(k, 'Toast');
    H.step(400);
  });

  test('Wahl-Dialog: Titel und Knopftexte in allen vier Knopfzustaenden', () => {
    dialog(H);
    // Klick auf die Abdunklung: der Titel steht sofort ganz da.
    H.run(`window.game.scene.getScene('HubSceneV2').children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2500; }).forEach(function (r) { r.emit('pointerdown'); })`);
    H.step(2);
    for (const z of ['normal', 'hover', 'gedrueckt', 'aus']) {
      H.run(`window.game.scene.getScene('HubSceneV2').children.list.filter(function (o) { return o._uiKnopf; }).forEach(function (r) { r._uiKnopf.setze('${z}'); })`);
      alleLesbar(kontraste(H, HUB_TEXTE(2500)), 'Dialog (' + z + ')');
    }
    schliessen(H);
  });

  test('Einstellungen: jeder Text, auch "AUS" und der gesperrte Knopf', () => {
    H.run(`window.openSettingsScene(window.game.scene.getScene('HubSceneV2'))`);
    H.step(5);
    H.run(`window.game.scene.getScene('SettingsScene')._tutorialSkipBtn.setEnabled(false)`);
    H.step(2);
    const k = kontraste(H, SZENE_TEXTE('SettingsScene'));
    assert.ok(k.some((t) => t.text === 'AUS'), 'kein "AUS" gemessen');
    alleLesbar(k, 'Einstellungen');
    H.run(`window.game.scene.getScene('SettingsScene')._tutorialSkipBtn.setEnabled(true)`);
    H.run(`window.game.scene.getScene('SettingsScene')._close()`);
    H.step(5);
  });

  test('Schwarzmarkt: lesbar, und der enge Blindkauf-Knopf umschliesst seine Beschriftung', () => {
    H.run('window._dungeonMerchant = true');
    H.run(`window.openShopScene(window.game.scene.getScene('HubSceneV2'))`);
    H.step(5);
    alleLesbar(kontraste(H, SZENE_TEXTE('ShopScene')), 'Schwarzmarkt');
    const eng = H.run(`(function () {
      var sc = window.game.scene.getScene('ShopScene');
      return sc.children.list.filter(function (o) { return o._uiKnopf; }).map(function (r) {
        var t = sc.children.list.filter(function (x) { return x.type === 'Text' && Math.abs(x.x - r.x) < 2 && Math.abs(x.y - r.y) < r.height / 2; })[0];
        return t ? { text: t.text, luft: r.width - t.width, treffer: r.input.hitArea.width - t.width } : null;
      }).filter(function (e) { return e && e.luft < 12; });
    })()`);
    assert.strictEqual(JSON.stringify(eng), '[]', 'Knopf zu eng fuer seinen Text');
    H.run(`window.game.scene.getScene('ShopScene')._close()`);
    H.run('window._dungeonMerchant = false');
    H.step(5);
  });

  test('Journal: Kleinschrift lesbar, Plattenmitte dunkel und ruhig', () => {
    H.run(`window.storySystem.showJournalOverlay(window.game.scene.getScene('HubSceneV2'), function () {})`);
    H.step(3);
    alleLesbar(kontraste(H, HUB_TEXTE(6000)), 'Journal');
    // Leere Flaeche unter den Aufgaben: frueher Mauve mit rosa Schlieren.
    const L = hintergrund(H)(300, 330, 360, 60);
    const median = L[Math.floor(L.length / 2)];
    const spanne = L[Math.floor(L.length * 0.95)] - L[Math.floor(L.length * 0.05)];
    assert.ok(median < 0.02, 'Plattenmitte zu hell: ' + median.toFixed(4));
    assert.ok(spanne < 0.01, 'Plattenmitte fleckig: ' + spanne.toFixed(4));
    H.run(`window.game.scene.getScene('HubSceneV2').children.list.filter(function (o) { return o.depth >= 6000 && o.depth < 6100; }).forEach(function (o) { o.destroy(); })`);
    H.run('window.resumeGameClock && window.resumeGameClock()');
    H.step(2);
  });
});

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
      // Textfarben bleiben unangetastet (graues "AUS" bleibt #888888).
      const gehoben = H.run(`window.game.scene.getScene('${k}').children.list.filter(function (o) { return o._uiLesbar; }).length`);
      assert.strictEqual(gehoben, 0, k + ': Texte ohne Flagge umgefaerbt');
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
