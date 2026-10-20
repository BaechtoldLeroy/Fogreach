// tests/abgabeHinweisStill.test.js: Auftraege ohne abgabeHinweis warnen nicht.
//
// Der Tracker fragt getAbgabeHinweis fuer jeden laufenden Auftrag in jedem
// Bild ab. Hatte ein Auftrag kein Feld, lag trotzdem ein Sprach-Getter darauf,
// und jeder Zugriff schrieb "[i18n] missing key" (live rund 500 Mal je Lauf).
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let h;
before(async () => { h = await launch({ renderer: 'canvas', waitFor: 'StartScene' }); });
after(async () => { if (h) await h.shutdown(); });

test('getAbgabeHinweis ohne Feld bleibt still, mit Feld liefert es den Text', () => {
  const W = h.window;
  const echt = W.console.warn;
  const warnungen = [];
  W.console.warn = function (...a) { warnungen.push(a.join(' ')); return echt.apply(this, a); };
  try {
    const ohne = Object.keys(W.questSystem.QUEST_DEFINITIONS)
      .filter((id) => !Object.getOwnPropertyDescriptor(W.questSystem.QUEST_DEFINITIONS[id], 'abgabeHinweis'));
    assert.ok(ohne.indexOf('klerus_brueder') !== -1, 'klerus_brueder hat ploetzlich einen Abgabe-Hinweis');
    ohne.forEach((id) => W.questSystem.getAbgabeHinweis(id));
  } finally { W.console.warn = echt; }
  const hinweis = warnungen.filter((t) => /abgabeHinweis/.test(t));
  assert.deepStrictEqual(hinweis, [], 'Warnungen fuer fehlende Abgabe-Hinweise');
  // Gegenprobe: ein Auftrag MIT Hinweis behaelt seinen Sprach-Getter.
  const d = Object.getOwnPropertyDescriptor(W.questSystem.QUEST_DEFINITIONS.elara_ritual, 'abgabeHinweis');
  assert.ok(d && typeof d.get === 'function', 'elara_ritual verlor den Sprach-Getter');
});
