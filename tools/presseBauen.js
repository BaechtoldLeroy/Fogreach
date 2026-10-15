// tools/presseBauen.js — baut aus den PixelLab-Rohbildern (tools/rohbilder/presse/,
// Objekt 6c92c1be…, Animation "stampfen", 9 Bilder 128x128) das Spritesheet
// assets/sprites/presse/druckerpresse.png (eine Zeile, 9 Bilder).
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
(async () => {
  const N = 9, W = 128, H = 128;
  const c = createCanvas(W * N, H), x = c.getContext('2d');
  for (let i = 0; i < N; i++) {
    // Als Puffer: node-canvas oeffnet Pfade mit Umlaut (LeroyBächtold) nicht.
    x.drawImage(await loadImage(fs.readFileSync(path.join(__dirname, 'rohbilder', 'presse', 'stampfen_' + i + '.png'))), i * W, 0);
  }
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'sprites', 'presse', 'druckerpresse.png'), c.toBuffer('image/png'));
  console.log('druckerpresse.png', W * N + 'x' + H);
})();
