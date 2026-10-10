// tests/kontrastMessung.js — gemessener Textkontrast (WCAG), wie in
// tests/uiRahmen.test.js (#189): alle Texte kurz ausblenden, ein Bild
// rendern und unter jedem Text den Median der Hintergrund-Leuchtdichte mit
// seiner Farbe vergleichen. Ziel 4,5:1.
//
// Texte mit eigenem Hintergrund (backgroundColor) zaehlen nicht: ihr Grund
// ist ihr eigener Kasten, nicht die gemessene Flaeche.

const assert = require('node:assert');

function leucht(r, g, b) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function hexLeucht(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.replace(/./g, '$&$&');
  const n = parseInt(h.slice(0, 6), 16);
  return leucht((n >> 16) & 255, (n >> 8) & 255, n & 255);
}
const kontrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Hintergrund ohne Texte rendern; liefert eine Funktion fuer die Leuchtdichten eines Rechtecks. */
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
    return ${auswahlJs}.filter(function (o) {
      var sichtbar = o.visible, p = o.parentContainer;
      while (p && sichtbar) { sichtbar = p.visible; p = p.parentContainer; }
      return sichtbar && o.alpha > 0.5 && !o.style.backgroundColor && String(o.text || '').trim();
    }).map(function (o) {
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

/** Alle Texte unter einem Objekt (rekursiv durch Container). */
const TEXTE_IN = (wurzelJs) => `(function () { var r = []; (function lauf(l) { l.forEach(function (o) {
  if (o.type === 'Container') return lauf(o.list); if (o.type === 'Text') r.push(o); }); })(${wurzelJs}); return r; })()`;

module.exports = { leucht, hexLeucht, kontrast, hintergrund, kontraste, alleLesbar, TEXTE_IN };
