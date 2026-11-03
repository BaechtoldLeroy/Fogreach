// tools/tiefenBilderBauen.js — Bilder fuer Harrens Abstieg und Aldrics Ende (b501).
//
// Aus tools/rohbilder/abstieg/ und tools/rohbilder/aldricende/ (PixelLab):
//   - Tableaus (384x192, create_image_pro) unveraendert nach
//     assets/sprites/abstieg/abstieg_<name>.png bzw. assets/sprites/aldricende/
//   - sitzende Raumfiguren (create_character_state, Richtung south-east wie
//     right0.png): lose Pixelsplitter weg, auf den Inhalt zugeschnitten, nach
//     assets/npc/harren/sitzend.png bzw. assets/npc/aldric/sitzend.png
// Geschrieben wird ohne Text-Metadaten (canvas.toBuffer schreibt keine).
//   node tools/tiefenBilderBauen.js
'use strict';
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const WURZEL = path.join(__dirname, '..');
const ROH = path.join(__dirname, 'rohbilder');

const TABLEAUS = [
  ['abstieg/wand1.png', 'assets/sprites/abstieg/abstieg_wand.png'],
  ['abstieg/stufe1.png', 'assets/sprites/abstieg/abstieg_stufe.png'],
  ['abstieg/schacht1.png', 'assets/sprites/abstieg/abstieg_schacht.png'],
  ['aldricende/biegung1.png', 'assets/sprites/aldricende/aldricende_biegung.png'],
  ['aldricende/leer1.png', 'assets/sprites/aldricende/aldricende_leer.png'],
  ['aldricende/erzaehlt1.png', 'assets/sprites/aldricende/aldricende_erzaehlt.png'],
  ['aldricende/geschwiegen1.png', 'assets/sprites/aldricende/aldricende_geschwiegen.png']
];
const FIGUREN = [
  ['abstieg/harren_sitzend_south-east.png', 'assets/npc/harren/sitzend.png'],
  ['aldricende/aldric_sitzend_south-east.png', 'assets/npc/aldric/sitzend.png']
];

/** Nur die groesste zusammenhaengende Flaeche behalten (Splitter weg), dann zuschneiden. */
function figurSaeubern(img) {
  const w = img.width, h = img.height;
  const c = createCanvas(w, h), x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, w, h);
  const deckend = (i) => d.data[i * 4 + 3] > 0;
  const gruppe = new Int32Array(w * h).fill(-1);
  const groessen = [];
  for (let s = 0; s < w * h; s++) {
    if (!deckend(s) || gruppe[s] >= 0) continue;
    const g = groessen.length; let n = 0; const stapel = [s]; gruppe[s] = g;
    while (stapel.length) {
      const p = stapel.pop(); n++;
      const px = p % w, py = (p - px) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const qx = px + dx, qy = py + dy;
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        const q = qy * w + qx;
        if (deckend(q) && gruppe[q] < 0) { gruppe[q] = g; stapel.push(q); }
      }
    }
    groessen.push(n);
  }
  const haupt = groessen.indexOf(Math.max.apply(null, groessen));
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let p = 0; p < w * h; p++) {
    if (gruppe[p] !== haupt) { d.data[p * 4 + 3] = 0; continue; }
    const px = p % w, py = (p - px) / w;
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minY = Math.min(minY, py); maxY = Math.max(maxY, py);
  }
  x.putImageData(d, 0, 0);
  const aus = createCanvas(maxX - minX + 1, maxY - minY + 1);
  aus.getContext('2d').drawImage(c, minX, minY, aus.width, aus.height, 0, 0, aus.width, aus.height);
  return aus;
}

(async () => {
  for (const [von, nach] of TABLEAUS) {
    const img = await loadImage(fs.readFileSync(path.join(ROH, von)));
    const c = createCanvas(img.width, img.height);
    c.getContext('2d').drawImage(img, 0, 0);
    fs.mkdirSync(path.dirname(path.join(WURZEL, nach)), { recursive: true });
    fs.writeFileSync(path.join(WURZEL, nach), c.toBuffer('image/png'));
    console.log(nach, img.width + 'x' + img.height);
  }
  for (const [von, nach] of FIGUREN) {
    const c = figurSaeubern(await loadImage(fs.readFileSync(path.join(ROH, von))));
    fs.writeFileSync(path.join(WURZEL, nach), c.toBuffer('image/png'));
    console.log(nach, c.width + 'x' + c.height);
  }
})();
