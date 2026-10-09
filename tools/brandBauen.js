/**
 * tools/brandBauen.js — Flammen fuer brennende Figuren aus dem Bodenfeuer.
 *
 * Der Brandstatus (BURNED) zog Leben ab, war am Getroffenen aber nur als
 * orangener Farbstich zu sehen (#173). Eine eigene Flamme braucht keinen
 * neuen Stil: das Bodenfeuer (floorFire0..8, schon animiert im Spiel) hat
 * oben genau die Flammenzungen, die man auf einem Koerper sehen will.
 * Unten liegt Glut — auf einem Gegner saehe das aus wie ein Lagerfeuer auf
 * seinen Fuessen.
 *
 * Also: die oberen Zungen ausschneiden, fuer alle neun Bilder DENSELBEN
 * Ausschnitt (sonst springt die Flamme von Bild zu Bild), und den unteren
 * Rand weich auslaufen lassen, damit sie in den Koerper uebergeht statt mit
 * einer geraden Kante abzubrechen.
 *
 *   node tools/brandBauen.js            -> assets/tiles/brand0..8.png
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ORDNER = path.join(__dirname, '..', 'assets', 'tiles');
const BILDER = 9;
const SCHNITT = 0.48;   // Anteil der Hoehe, ab dem unten die Glut beginnt
const AUSLAUF = 10;     // Zeilen, ueber die der untere Rand ausblendet

(async () => {
  const roh = [];
  for (let i = 0; i < BILDER; i++) {
    const { data, info } = await sharp(path.join(ORDNER, 'floorFire' + i + '.png'))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    roh.push({ data, w: info.width, h: info.height });
  }
  const W = roh[0].w, H = roh[0].h;
  const unten = Math.round(H * SCHNITT);

  // Gemeinsame Grenzen der Flammenzungen ueber alle Bilder.
  let x0 = W, x1 = -1, y0 = unten;
  roh.forEach((b) => {
    for (let y = 0; y < unten; y++) {
      for (let x = 0; x < W; x++) {
        if (b.data[(y * W + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y;
        }
      }
    }
  });
  const bw = x1 - x0 + 1, bh = unten - y0;

  for (let i = 0; i < BILDER; i++) {
    const b = roh[i];
    const raus = Buffer.alloc(bw * bh * 4);
    for (let y = 0; y < bh; y++) {
      // Weich auslaufen: in den letzten Zeilen nimmt die Deckkraft ab.
      const rest = bh - 1 - y;
      const deck = rest >= AUSLAUF ? 1 : rest / AUSLAUF;
      for (let x = 0; x < bw; x++) {
        const q = ((y + y0) * W + (x + x0)) * 4, z = (y * bw + x) * 4;
        raus[z] = b.data[q]; raus[z + 1] = b.data[q + 1]; raus[z + 2] = b.data[q + 2];
        raus[z + 3] = Math.round(b.data[q + 3] * deck);
      }
    }
    await sharp(raus, { raw: { width: bw, height: bh, channels: 4 } }).png()
      .toFile(path.join(ORDNER, 'brand' + i + '.png'));
  }
  console.log(BILDER + ' Brandflammen ' + bw + 'x' + bh + ' aus floorFire (Zeilen ' + y0 + '-' + unten + ')');
})();
