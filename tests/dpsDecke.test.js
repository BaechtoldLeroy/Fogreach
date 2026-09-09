// tests/dpsDecke.test.js — Die Decke, aus der alle Waffenbaender kommen (#135).
//
// Sie hat einen Knick bei Tiefe 8. Darueber gilt Tiefe/2,5, darunter laeuft
// sie gleichmaessig von 2,17 auf Tiefe 1 dorthin hoch.
//
// Der Knick ist kein Schoenheitsfehler, sondern noetig: der Spieler macht ohne
// Waffe schon 1,54 DPS (1 Schaden bei Tempo 1,0). Tiefe/2,5 liegt bis Tiefe 4
// darunter — gemessen zeigte JEDE Waffe auf den Tiefen 1 bis 3 einen Schaden
// von 0, und mit ihr waren auch die Prozent-Affixe wirkungslos.
//
// Zwei Dinge sind hier festgenagelt, weil beide leicht wieder herausfallen:
//   1. ab Tiefe 8 wird an der Kurve NICHTS mehr gerechnet
//   2. unterhalb steht keine Basis auf 0

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;
W.i18n = W.i18n || { register() {}, t: (k) => k, onChange() {} };
loadGameModule('js/lootSystem.js');
const LS = W.LootSystem;

const WAFFEN = LS.ITEM_BASES.filter((b) => b.type === 'weapon' && b.damageKurve);

test('Ab dem Knick gilt genau Tiefe / Teiler', () => {
  [8, 9, 10, 15, 20, 25, 30, 40, 60].forEach((t) => {
    assert.ok(Math.abs(LS.dpsDecke(t) - t / LS.DPS_DECKE_TEILER) < 1e-9,
      'Tiefe ' + t + ': ' + LS.dpsDecke(t).toFixed(3) + ' statt '
      + (t / LS.DPS_DECKE_TEILER).toFixed(3));
  });
});

test('Unterhalb des Knicks steigt sie gleichmaessig — gleiche Stufe je Tiefe', () => {
  const stufen = [];
  for (let t = 1; t < LS.DPS_DECKE_KNICK; t++) {
    stufen.push(LS.dpsDecke(t + 1) - LS.dpsDecke(t));
  }
  const erste = stufen[0];
  stufen.forEach((s, i) => {
    assert.ok(Math.abs(s - erste) < 1e-9,
      'Stufe ' + (i + 1) + ' ist ' + s.toFixed(4) + ' statt ' + erste.toFixed(4));
  });
  assert.ok(erste > 0, 'die Decke steigt gar nicht');
});

test('Der Uebergang am Knick ist stetig — kein Sprung', () => {
  const k = LS.DPS_DECKE_KNICK;
  assert.ok(Math.abs(LS.dpsDecke(k) - k / LS.DPS_DECKE_TEILER) < 1e-9);
  const davor = LS.dpsDecke(k - 1), danach = LS.dpsDecke(k);
  const stufe = LS.dpsDecke(2) - LS.dpsDecke(1);
  assert.ok(Math.abs((danach - davor) - stufe) < 1e-9,
    'am Knick springt die Kurve: ' + davor.toFixed(3) + ' -> ' + danach.toFixed(3));
});

test('KEINE Waffe steht auf irgendeiner Tiefe bei 0 Schaden', () => {
  // Das war der Befund, der zum Knick gefuehrt hat. Gerundet wird auf 0,1 —
  // alles unter 0,05 erscheint dem Spieler als 0.
  const tot = [];
  for (let t = 1; t <= 40; t++) {
    WAFFEN.forEach((b) => {
      const max = Math.round(LS.waffenBand(b, t).max * 10) / 10;
      if (max <= 0) tot.push(b.key + ' auf Tiefe ' + t);
    });
  }
  assert.strictEqual(tot.length, 0, 'ohne Wirkung: ' + tot.slice(0, 8).join(', '));
});

test('Die schwaechste Basis startet bei 0,1 — dafuer ist der Startwert gewaehlt', () => {
  const werte = WAFFEN.map((b) => ({
    key: b.key, max: Math.round(LS.waffenBand(b, 1).max * 10) / 10
  }));
  const kleinster = werte.reduce((m, x) => (x.max < m.max ? x : m), werte[0]);
  assert.strictEqual(kleinster.max, 0.1,
    kleinster.key + ' zeigt auf Tiefe 1 ' + kleinster.max + ' statt 0,1');
});

test('Die Decke waechst ueber jede Tiefe — sie friert nirgends ein', () => {
  // Das war der urspruengliche Fehler aus #135: ab Tiefe 26 stand der
  // Basisschaden still, weil alle dropWeight-Kurven dort endeten.
  for (let t = 1; t < 60; t++) {
    assert.ok(LS.dpsDecke(t + 1) > LS.dpsDecke(t),
      'zwischen Tiefe ' + t + ' und ' + (t + 1) + ' waechst nichts mehr');
  }
});
