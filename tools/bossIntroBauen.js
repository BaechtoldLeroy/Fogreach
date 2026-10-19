/**
 * tools/bossIntroBauen.js — Bilder der Boss-Zwischenszenen (?bossintro=neu).
 *
 * Rohbilder: tools/rohbilder/bossintro/
 *   siegel_*.png    create_1_direction_object 48x48, Stil = ui_symbol_* (ein
 *                   Lauf, 16 Kandidaten; je Boss der dunklere der vier)
 *   vfx_*.png/json  vfx_workbench, Bilder im Raster gleicher Groesse
 * Ergebnis: assets/sprites/bossintro/bossintro_*.png
 *
 * Die Bilder bleiben unveraendert; das Werkzeug haelt nur fest, welches
 * Rohbild wohin gehoert, und prueft, dass die Raster zu js/bossZwischenszene.js
 * passen (Bildgroesse und Anzahl).
 *
 *   node tools/bossIntroBauen.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROH = path.join(__dirname, 'rohbilder', 'bossintro');
const ZIEL = path.join(__dirname, '..', 'assets', 'sprites', 'bossintro');

const SIEGEL = ['ketten', 'kerze', 'maske', 'ring', 'stimmen'];
// Muss zu VFX in js/bossZwischenszene.js passen.
const VFX = { ketten: [91, 56, 8], kerzen: [144, 74, 12], schatten: [72, 116, 16], nebel: [174, 56, 24] };

fs.mkdirSync(ZIEL, { recursive: true });
SIEGEL.forEach((n) => {
  fs.copyFileSync(path.join(ROH, 'siegel_' + n + '.png'), path.join(ZIEL, 'bossintro_siegel_' + n + '.png'));
});
Object.keys(VFX).forEach((n) => {
  const json = JSON.parse(fs.readFileSync(path.join(ROH, 'vfx_' + n + '.json'), 'utf8'));
  const [w, h, anzahl] = VFX[n];
  const f0 = json.frames[0].frame;
  if (f0.w !== w || f0.h !== h || json.frames.length !== anzahl) {
    throw new Error('vfx_' + n + ': erwartet ' + w + 'x' + h + ' x' + anzahl + ', ist '
      + f0.w + 'x' + f0.h + ' x' + json.frames.length);
  }
  fs.copyFileSync(path.join(ROH, 'vfx_' + n + '.png'), path.join(ZIEL, 'bossintro_vfx_' + n + '.png'));
});
console.log('geschrieben:', fs.readdirSync(ZIEL).join(', '));
