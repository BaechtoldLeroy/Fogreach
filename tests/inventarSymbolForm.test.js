// tests/inventarSymbolForm.test.js — Waffen im Inventar nicht gestaucht.
//
// Gemeldet: "gewisse Bilder von Ausruestungen werden zu schmal dargestellt,
// zum Beispiel Boegen und Schwerter." Die Pixel-Icons (seit b321) sind
// quadratische 48er-Texturen, die Waffe steht darin schmal und senkrecht.
// Ein 1x3-Gegenstand zog das Quadrat auf ein hohes, schmales Rechteck — die
// Waffe wurde dreimal so lang wie breit gestreckt. Jetzt wird ihr sichtbarer
// Umriss GLEICHMAESSIG ins Rechteck gepasst (symbolEinpassen).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
before(async () => {
  H = await launch({ renderer: 'canvas', search: '?autostart=1' });
  assert.ok(await H.waitForScene('HubSceneV2'), 'Hub nicht erreicht');
  H.step(20);
});
after(async () => { if (H) await H.shutdown(); });

test('Schwert und Bogen: gleichmaessig skaliert, Umriss fuellt die Hoehe, mittig im Rechteck', () => {
  const r = H.run(`(function () {
    var LS = window.LootSystem, out = [];
    ['WPN_EISENKLINGE', 'WPN_ESCHENBOGEN'].forEach(function (k) {
      window.InventoryGrid.einlagern(LS.rollItem(k, 8, 1));
    });
    equipment.weapon = LS.rollItem('WPN_ESCHENBOGEN', 8, 1);
    openInventory();
    refreshInventoryUI();
    inventory.forEach(function (it, i) {
      if (!it || (it.key !== 'WPN_EISENKLINGE' && it.key !== 'WPN_ESCHENBOGEN') || typeof it.gridX !== 'number') return;
      var s = invUI.slots[i], g = window.InventoryGrid.groesse(it);
      var u = symbolUmriss(s.icon.scene, s.icon.texture.key);
      var r = { width: s.bg.displayWidth, height: s.bg.displayHeight, centerX: s.bg.x, centerY: s.bg.y };   // im Panel-Container
      out.push({ key: it.key, b: g.b, h: g.h, sx: s.icon.scaleX, sy: s.icon.scaleY,
        umrissH: u.h * s.icon.scaleY, umrissB: u.w * s.icon.scaleX, rechteckH: r.height, rechteckB: r.width,
        mitteX: s.icon.x - (u.x + u.w / 2 - u.tw / 2) * s.icon.scaleX - r.centerX,
        mitteY: s.icon.y - (u.y + u.h / 2 - u.th / 2) * s.icon.scaleY - r.centerY });
    });
    var e = invUI.equip.weapon.icon;
    out.push({ key: 'equip', sx: e.scaleX, sy: e.scaleY });
    closeInventory();
    return JSON.stringify(out);
  })()`);
  const liste = JSON.parse(r);
  assert.ok(liste.length >= 3, 'zu wenig Symbole: ' + r);
  liste.forEach((s) => {
    assert.ok(Math.abs(s.sx - s.sy) < 1e-6, s.key + ' verzerrt: ' + s.sx.toFixed(2) + ' x ' + s.sy.toFixed(2));
  });
  liste.filter((s) => s.key !== 'equip').forEach((s) => {
    assert.ok(s.h > s.b, s.key + ' liegt nicht hochkant (' + s.b + 'x' + s.h + ') — der Fall misst nichts');
    // Der Umriss nutzt die Hoehe (bei hohen Teilen bestimmt sie die Groesse).
    assert.ok(s.umrissH >= s.rechteckH * 0.75, s.key + ': nur ' + Math.round(s.umrissH) + ' von ' + Math.round(s.rechteckH) + ' px hoch');
    assert.ok(s.umrissB <= s.rechteckB + 0.5, s.key + ' ragt seitlich heraus');
    assert.ok(Math.abs(s.mitteX) < 1.5 && Math.abs(s.mitteY) < 1.5, s.key + ' nicht mittig: ' + s.mitteX.toFixed(1) + '/' + s.mitteY.toFixed(1));
  });
});
