/**
 * tools/bodenAngleichen.js — die Bodenkacheln des Hubs auf eine Helligkeit.
 *
 * Gemeldet (b511): "Kacheln mit zu grossem Kontrast nebeneinander" und
 * "die Abdunklung verlaeuft in Quadraten". Zwei Ursachen in den Bildern:
 *
 *  1. Jede Kachel trug ein eigenes Licht: oben hell, unten dunkel (boden2
 *     oben 51, unten 29; das Pflaster oben 70, unten 59). Gekachelt wird
 *     daraus ein Gitter aus Quadraten, jedes mit eigenem Schatten.
 *  2. Die Varianten einer Flaeche und die Arten untereinander lagen weit
 *     auseinander: Platte 45..51 je nach Variante, Pflaster 60 neben
 *     Platte 47 und Erde 28.
 *
 * Verfahren je Kachel: eine Ebene (a + b*x + c*y) durch die Helligkeit legen
 * und jeden Bildpunkt so skalieren, dass die Ebene flach auf der Zielhelligkeit
 * der Art liegt. Die Zeichnung (Fugen, Steine, Halme) bleibt, nur das
 * Gefaelle und der Pegel gehen.
 *
 * Die Uebergangskacheln sind aus EINER Grundkachel geschnitten
 * (tools/uebergangBauen.js). Sie bekommen genau deren Korrektur, Punkt fuer
 * Punkt — sonst saehe man an der Grenze wieder eine Kante.
 *
 * Schreibt die PNG an Ort und Stelle. Zweimal laufen lassen schadet nicht:
 * die Ebene ist danach flach und auf dem Ziel.
 *
 *   node tools/bodenAngleichen.js [--nach assets/hub]
 */
'use strict';

const path = require('path');
const sharp = require('sharp');

// Zielhelligkeit (Luma 0..255) je Art. Dunkel bleibt dunkel; die Abstaende
// sind nur so weit verkleinert, dass die Arten noch unterscheidbar sind.
const ARTEN = [
  { name: 'erde', ziel: 30, flaechen: ['boden9'] },
  { name: 'gras', ziel: 32, flaechen: ['boden12', 'boden13'], uebergang: 'boden12' },
  { name: 'platte', ziel: 45, flaechen: ['boden0', 'boden1', 'boden2', 'boden3'], uebergang: 'boden2' },
  { name: 'pflaster', ziel: 50, flaechen: ['flaeche_pflaster0'], uebergang: 'flaeche_pflaster0' }
];

const luma = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

/** Kleinste Quadrate: Helligkeit = a + b*x + c*y ueber die deckenden Punkte. */
function ebene(data, W, H) {
  let n = 0, sx = 0, sy = 0, sl = 0, sxx = 0, syy = 0, sxy = 0, sxl = 0, syl = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 128) continue;
      const l = luma(data, i);
      n++; sx += x; sy += y; sl += l; sxx += x * x; syy += y * y; sxy += x * y; sxl += x * l; syl += y * l;
    }
  }
  // Normalgleichungen 3x3, nach Cramer.
  const M = [[n, sx, sy], [sx, sxx, sxy], [sy, sxy, syy]];
  const r = [sl, sxl, syl];
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  const loese = (k) => det(M.map((z, zi) => z.map((v, si) => (si === k ? r[zi] : v)))) / D;
  return { a: loese(0), b: loese(1), c: loese(2) };
}

/** Faktor je Bildpunkt, der die Ebene auf das Ziel hebt bzw. senkt. */
function faktoren(data, W, H, ziel) {
  const e = ebene(data, W, H);
  const f = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[y * W + x] = ziel / Math.max(1, e.a + e.b * x + e.c * y);
  }
  return f;
}

function anwenden(data, f) {
  const raus = Buffer.from(data);
  for (let p = 0; p < f.length; p++) {
    const i = p * 4;
    for (let k = 0; k < 3; k++) raus[i + k] = Math.max(0, Math.min(255, Math.round(data[i + k] * f[p])));
  }
  return raus;
}

async function lade(datei) {
  const { data, info } = await sharp(datei).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}
async function schreibe(datei, data, W, H) {
  await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toFile(datei);
}

if (require.main === module) {
  const i = process.argv.indexOf('--nach');
  const nach = i === -1 ? 'assets/hub' : process.argv[i + 1];
  (async () => {
    for (const art of ARTEN) {
      let quellFaktor = null;
      for (const n of art.flaechen) {
        const datei = path.join(nach, n + '.png');
        const b = await lade(datei);
        const f = faktoren(b.data, b.W, b.H, art.ziel);
        if (n === art.uebergang) quellFaktor = f;
        await schreibe(datei, anwenden(b.data, f), b.W, b.H);
      }
      for (let m = 1; art.uebergang && m < 15; m++) {
        const datei = path.join(nach, 'ueber_' + art.name + m + '.png');
        const b = await lade(datei);
        await schreibe(datei, anwenden(b.data, quellFaktor), b.W, b.H);
      }
      console.log(art.name + ': ' + art.flaechen.length + ' Flaechen'
        + (art.uebergang ? ' + 14 Uebergaenge' : '') + ' auf ' + art.ziel);
    }
  })();
}

module.exports = { ARTEN, ebene, luma };
