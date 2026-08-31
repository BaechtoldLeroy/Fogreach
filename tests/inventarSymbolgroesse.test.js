// tests/inventarSymbolgroesse.test.js — Die Symbole im Inventarraster duerfen
// nicht wieder schrumpfen.
//
// Rueckmeldung des Projektinhabers: "die icons werden im inventar raster zu
// klein dargestellt". Gemessen war die Ursache ein FESTER Deckel:
//
//   slotScale = Math.min(slotScaleX, slotScaleY, 0.65)
//               Math.min(0.95,       1.19,       0.65)  -> immer 0.65
//
// Das Fach blieb damit 62x42 px in einer 96x80-Zelle, das Symbol darin 25x25
// bei einer 48x48-Textur. Nicht die Zelle war zu klein, sondern der Deckel zu
// niedrig.
//
// Geprueft wird die Rechnung, nicht die Optik: aus den Konstanten der Quelle
// werden Fach- und Symbolgroesse nachgerechnet und gegen Untergrenzen sowie
// gegen Ueberlappung der Nachbarfaecher gestellt.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const QUELLE = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'inventory.js'), 'utf8');

function zahl(muster, name) {
  const m = QUELLE.match(muster);
  assert.ok(m, name + ' nicht gefunden');
  return Number(m[1]);
}

test('Inventar: das Symbol fuellt das Fach spuerbar aus', () => {
  const PANEL_W = zahl(/PANEL_W = (\d+)/, 'PANEL_W');
  const PANEL_H = zahl(/PANEL_H = (\d+)/, 'PANEL_H');
  const SLOT_W = zahl(/SLOT_W = (\d+)/, 'SLOT_W');
  const SLOT_H = zahl(/SLOT_H = ([0-9]+)/, 'SLOT_H');
  const deckel = zahl(/slotScale = Math\.min\(slotScaleX, slotScaleY, ([0-9.]+)\)/, 'Deckel');
  const symbolFaktor = zahl(/setScale\(slotScale \* ([0-9.]+)\)\.setScrollFactor/, 'Symbolfaktor');

  const COLS = 5, ROWS = 4;                 // INV_COLS / INV_ROWS aus main.js
  const cellW = (PANEL_W - 320) / COLS;
  const cellH = (PANEL_H - 160) / ROWS;
  const slotScale = Math.min((cellW * 0.95) / SLOT_W, (cellH * 0.95) / SLOT_H, deckel);
  const symbolPx = 48 * slotScale * symbolFaktor;

  // Vor der Korrektur: 25 px. Die Schwelle liegt bewusst bei 30 — hoch genug,
  // um eine Rueckkehr zum alten Deckel zu fangen, niedrig genug, um bei einer
  // Umgestaltung des Panels nicht grundlos zu reissen.
  assert.ok(symbolPx >= 30,
    'das Symbol ist nur ' + symbolPx.toFixed(0) + ' px gross — vor der Korrektur waren es 25');

  // Und die Faecher duerfen sich dabei nicht beruehren.
  assert.ok(SLOT_W * slotScale < cellW - 6,
    'die Faecher stossen waagerecht aneinander: ' + (SLOT_W * slotScale).toFixed(0)
    + ' px in einer Zelle von ' + cellW);
  assert.ok(SLOT_H * slotScale < cellH - 6,
    'die Faecher stossen senkrecht aneinander: ' + (SLOT_H * slotScale).toFixed(0)
    + ' px in einer Zelle von ' + cellH);
});

test('Inventar: Symbol und Beschriftung haengen an der Fachhoehe, nicht an festen Pixeln', () => {
  // Beide sassen auf -10 bzw. +20 — Werte, die zum alten Deckel 0.65 passten.
  // Bleiben sie fest, waehrend das Fach waechst, verrutscht die Anordnung:
  // das Symbol wandert in die obere Kante, die Stueckzahl mitten ins Fach.
  assert.ok(/scene\.add\.image\(x, y - slotScale \* SLOT_H \* [0-9.]+, 'itMat'\)/.test(QUELLE),
    'der Symbolversatz haengt nicht an der Fachhoehe');
  assert.ok(/scene\.add\.text\(x, y \+ slotScale \* SLOT_H \* [0-9.]+, ''/.test(QUELLE),
    'die Beschriftung haengt nicht an der Fachhoehe');
});
