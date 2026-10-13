/**
 * tools/hudIconsBauen.js — Icon-Streifen fuer die Faehigkeitsleiste und die HUD-Knoepfe (#195).
 *
 * Rohbilder: PixelLab create_1_direction_object, 48x48, unter
 * tools/rohbilder/hudicons/<name>.png (Name = Eintrag in hudLeiste.REIHE).
 * Ergebnis: assets/ui/hud_icons.png — oben die farbigen Icons in der
 * Reihenfolge von REIHE, darunter dieselben entsaettigt und abgedunkelt
 * (gesperrt / ohne Trank). Eine Zeile Grau statt Tint, weil Tint im
 * Canvas-Renderer nicht wirkt.
 *
 *   node tools/hudIconsBauen.js [--vorschau datei.png]
 *
 * Mit ROH=<ordner> und --vorschau nur eine Vorschau der Rohbilder dieses
 * Ordners (zum Aussuchen), ohne den Streifen zu schreiben.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { REIHE } = require('../js/hudLeiste.js');

const K = 48;
const ROH_EIGEN = process.env.ROH;
const ROH = ROH_EIGEN || path.join(__dirname, 'rohbilder', 'hudicons');
const ZIEL = path.join(__dirname, '..', 'assets', 'ui', 'hud_icons.png');

// Puffer statt Pfad: node-canvas scheitert am Umlaut im Benutzerordner.
const lade = (f) => loadImage(fs.readFileSync(path.join(ROH, f)));

function grau(ctx, x, y) {
  const d = ctx.getImageData(x, y, K, K);
  for (let i = 0; i < d.data.length; i += 4) {
    const l = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
    d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.round(l * 0.7);
  }
  ctx.putImageData(d, x, y);
}

function vorschau(bilder, datei) {
  const S = 4, spalten = 6, zeilen = Math.ceil(bilder.length / spalten);
  const v = createCanvas(spalten * K * S, zeilen * K * S);
  const vc = v.getContext('2d');
  vc.fillStyle = '#2a2420'; vc.fillRect(0, 0, v.width, v.height);
  vc.imageSmoothingEnabled = false;
  bilder.forEach((b, k) => vc.drawImage(b, (k % spalten) * K * S, Math.floor(k / spalten) * K * S, K * S, K * S));
  fs.writeFileSync(datei, v.toBuffer('image/png'));
}

async function main() {
  const iv = process.argv.indexOf('--vorschau');
  if (ROH_EIGEN) {
    const namen = fs.readdirSync(ROH).filter((f) => f.endsWith('.png')).sort();
    const bilder = [];
    for (const f of namen) bilder.push(await lade(f));
    if (iv !== -1) vorschau(bilder, process.argv[iv + 1]);
    return;
  }
  const c = createCanvas(REIHE.length * K, 2 * K);
  const ctx = c.getContext('2d');
  const bilder = [];
  for (let i = 0; i < REIHE.length; i++) {
    const img = await lade(REIHE[i] + '.png');
    ctx.drawImage(img, i * K, 0, K, K);
    ctx.drawImage(img, i * K, K, K, K);
    grau(ctx, i * K, K);
    bilder.push(img);
  }
  fs.writeFileSync(ZIEL, c.toBuffer('image/png'));
  console.log(REIHE.length + ' Icons -> ' + ZIEL);
  if (iv !== -1) vorschau(bilder, process.argv[iv + 1]);
}
main();
