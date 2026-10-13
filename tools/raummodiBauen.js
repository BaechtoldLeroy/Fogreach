/**
 * tools/raummodiBauen.js — Bilder der Sonderraum-Modi (Jagd, Verteidigung,
 * Flucht, Durchhalten) aus den PixelLab-Rohbildern bauen.
 *
 * Rohbilder: tools/rohbilder/raummodi/
 *   altar.png, altar_beschaedigt.png   create_image_pixflux 64x64 (beschaedigt: img2img aus altar.png)
 *   siegel_*.png (+ .json)              vfx_workbench, 16 Bilder im 4x4-Raster
 *   sanduhr.png, fluchtpfeil.png        create_image_pixflux 32x32
 *   symbol_*.png                        create_1_direction_object 48x48, Stil = ui_symbol_*
 * Ergebnis: assets/sprites/raummodi/raummodus_*.png
 *
 *   node tools/raummodiBauen.js [--vorschau datei.png]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const ROH = path.join(__dirname, 'rohbilder', 'raummodi');
const ZIEL = path.join(__dirname, '..', 'assets', 'sprites', 'raummodi');
// Puffer statt Pfad: node-canvas scheitert am Umlaut im Benutzerordner.
const lade = (f) => loadImage(fs.readFileSync(path.join(ROH, f)));

// Der Altar muss 64x60 bleiben wie die alte Zeichnung: Koerper (48x22 ab 8,34)
// und Fusspunkt haengen an dieser Groesse. Das Rohbild hat oben und unten je
// zwei leere Zeilen zu viel — ab Zeile 2 ausschneiden.
const ALTAR_Y = 2, ALTAR_W = 64, ALTAR_H = 60;

const KOPIEN = {
  'siegel_jagd.png': 'raummodus_siegel_jagd.png',
  'siegel_bannkreis.png': 'raummodus_siegel_bannkreis.png',
  'siegel_flucht.png': 'raummodus_siegel_flucht.png',
  'sanduhr.png': 'raummodus_sanduhr.png',
  'fluchtpfeil.png': 'raummodus_fluchtpfeil.png',
  'symbol_jagd.png': 'raummodus_symbol_jagd.png',
  'symbol_verteidigung.png': 'raummodus_symbol_verteidigung.png',
  'symbol_flucht.png': 'raummodus_symbol_flucht.png',
  'symbol_durchhalten.png': 'raummodus_symbol_durchhalten.png'
};

async function altar(roh, ziel) {
  const b = await lade(roh);
  const c = createCanvas(ALTAR_W, ALTAR_H);
  c.getContext('2d').drawImage(b, 0, ALTAR_Y, ALTAR_W, ALTAR_H, 0, 0, ALTAR_W, ALTAR_H);
  fs.writeFileSync(path.join(ZIEL, ziel), c.toBuffer('image/png'));
  return c;
}

async function main() {
  fs.mkdirSync(ZIEL, { recursive: true });
  const bilder = [];
  bilder.push(await altar('altar.png', 'raummodus_altar.png'));
  bilder.push(await altar('altar_beschaedigt.png', 'raummodus_altar_rissig.png'));
  for (const [roh, ziel] of Object.entries(KOPIEN)) {
    fs.copyFileSync(path.join(ROH, roh), path.join(ZIEL, ziel));
    bilder.push(await lade(roh));
  }
  const iv = process.argv.indexOf('--vorschau');
  if (iv !== -1) {
    // Kontaktbogen: alles dreifach vergroessert auf Kellergrund.
    const S = 3, B = 420, H = 210;
    const spalten = 4, zeilen = Math.ceil(bilder.length / spalten);
    const v = createCanvas(spalten * B, zeilen * H);
    const vc = v.getContext('2d');
    vc.fillStyle = '#2a2420'; vc.fillRect(0, 0, v.width, v.height);
    vc.imageSmoothingEnabled = false;
    bilder.forEach((b, k) => {
      const s = Math.min(S, (B - 10) / b.width, (H - 10) / b.height);
      vc.drawImage(b, (k % spalten) * B + 5, Math.floor(k / spalten) * H + 5, b.width * s, b.height * s);
    });
    fs.writeFileSync(process.argv[iv + 1], v.toBuffer('image/png'));
  }
  console.log('geschrieben nach', ZIEL);
}

main().catch((e) => { console.error(e); process.exit(1); });
