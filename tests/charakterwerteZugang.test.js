// tests/charakterwerteZugang.test.js — Wege zu den Charakterwerten.
//
// Die Werteansicht (_openStatsMenu) existierte laenger, war aber NUR hinter
// dem Portrait im HUD erreichbar: ein Kreis ohne Beschriftung, dessen Tooltip
// man erst sieht, wenn man schon draufzeigt. Dieser Test haelt die beiden
// beschrifteten Wege fest — Burger-Menue und Inventar —, weil beide leicht
// wieder herausfallen: das Menue baut seine Liste aus einem Array, und der
// Inventarknopf ist eines von vielen Textobjekten im Panel.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await H.waitForScene('HubSceneV2', { maxRounds: 250 });
  assert.ok(ok, 'HubSceneV2 wurde nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });



test('HUDv2 bietet einen oeffentlichen Einstieg in die Werteansicht', () => {
  assert.strictEqual(H.run('typeof window.HUDv2.openStats'), 'function',
    'HUDv2.openStats fehlt — das Inventar kaeme nicht an _openStatsMenu heran');
});

test('Burger-Menue fuehrt zu den Charakterwerten', () => {
  const res = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    window.HUDv2.openMenu(sc);
    var raus = [];
    sc.children.list.forEach(function (o) { if (o.type === 'Text') raus.push(String(o.text || '')); });
    return raus;
  })()`);
  assert.ok(res.indexOf('Charakterwerte') >= 0,
    'kein Menueeintrag "Charakterwerte": ' + JSON.stringify(res));
});

test('Menuepanel waechst mit der Zahl der Eintraege', () => {
  // Der sechste Knopf lag bei fester Panelhoehe 400 auf der Schliessen-Zeile.
  const res = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var knoepfe = [], schliessen = null;
    sc.children.list.forEach(function (o) {
      if (o.type === 'Rectangle' && o.width > 200 && o.width < 260 && o.height === 44) {
        knoepfe.push(o.y);
      }
      if (o.type === 'Text' && String(o.text || '').indexOf('ESC') >= 0) schliessen = o;
    });
    if (!schliessen) return { fehler: 'kein Schliessen-Knopf gefunden' };
    return {
      anzahl: knoepfe.length,
      untersterKnopf: Math.max.apply(null, knoepfe) + 22,
      schliessenOben: schliessen.y - schliessen.height / 2
    };
  })()`);

  assert.ok(!res.fehler, res.fehler);
  assert.strictEqual(res.anzahl, 6, 'erwartet sechs Menueknoepfe, waren ' + res.anzahl);
  assert.ok(res.untersterKnopf < res.schliessenOben,
    'unterster Knopf endet bei ' + res.untersterKnopf
    + ', Schliessen beginnt schon bei ' + res.schliessenOben);
});

test('Werteansicht laesst sich ueber HUDv2.openStats oeffnen und wieder schliessen', () => {
  const res = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    if (window.HUDv2._menuContainer) window.HUDv2._menuContainer.close();
    window.HUDv2.openStats(sc);
    var offen = !!window.HUDv2._statsContainer;
    var titel = false;
    sc.children.list.forEach(function (o) {
      if (o.type === 'Text' && String(o.text || '') === 'Charakterwerte') titel = true;
    });
    if (window.HUDv2._statsContainer) window.HUDv2._statsContainer.close();
    return { offen: offen, titel: titel, zu: !window.HUDv2._statsContainer };
  })()`);

  assert.strictEqual(res.offen, true, 'openStats hat nichts geoeffnet');
  assert.strictEqual(res.titel, true, 'die Werteansicht zeigt keine Ueberschrift');
  assert.strictEqual(res.zu, true, 'die Werteansicht liess sich nicht schliessen');
});

test('Inventar hat einen Knopf zu den Charakterwerten — im Panel und ohne Ueberdeckung', () => {
  const res = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var ui = window.invUI || (typeof invUI !== 'undefined' ? invUI : null);
    if (!ui || !ui.statsBtn) return { fehler: 'invUI.statsBtn fehlt' };
    var b = ui.statsBtn;
    var panel = ui.panel;
    // Origin (1, 0): x ist die RECHTE Kante.
    var rechts = b.x, links = b.x - b.width, oben = b.y, unten = b.y + b.height;
    var andere = [];
    panel.list.forEach(function (o) {
      if (o === b || o.type !== 'Text') return;
      var oL = o.x - o.width * (o.originX || 0), oR = oL + o.width;
      var oO = o.y - o.height * (o.originY || 0), oU = oO + o.height;
      if (oR > links && oL < rechts && oU > oben && oO < unten) andere.push(String(o.text || ''));
    });
    return {
      text: String(b.text || ''),
      imPanel: panel.list.indexOf(b) >= 0,
      links: links, rechts: rechts, oben: oben, unten: unten,
      ueberlappt: andere
    };
  })()`);

  assert.ok(!res.fehler, res.fehler);
  assert.strictEqual(res.text, 'Charakterwerte');
  assert.strictEqual(res.imPanel, true, 'der Knopf haengt nicht am Inventarpanel');
  // Panel ist 800 x 480, Ursprung mittig.
  assert.ok(res.links > -400 && res.rechts < 400,
    'waagerecht ausserhalb des Panels: ' + res.links + '..' + res.rechts);
  assert.ok(res.oben > -240 && res.unten < 240,
    'senkrecht ausserhalb des Panels: ' + res.oben + '..' + res.unten);
  // Ueber die Bruecke kommt kein echtes Array-Prototyp zurueck, deshalb
  // die Laenge pruefen statt deepStrictEqual.
  assert.strictEqual(res.ueberlappt.length, 0,
    'der Knopf liegt auf anderem Text: ' + res.ueberlappt.join(', '));
});
