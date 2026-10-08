/**
 * tools/uebergangBauen.js — Uebergangskacheln aus unseren EIGENEN Kacheln.
 *
 * Zwei Bodenarten stossen im Hub auf Stoss aneinander: Platte an Erde, Gras an
 * Erde, Pflaster an Platte. Jede dieser Grenzen ist eine kerzengerade Linie
 * alle 32 Pixel, und genau das sieht man.
 *
 * Der uebliche Weg waere ein Wang-Satz vom Bildgenerator. Zwei Versuche sind
 * daran gescheitert: beide kamen mit einer hellen Konturlinie auf der Grenze
 * (die harte Kante in neuem Gewand) und in einer Palette, die neben unseren
 * Kacheln fremd aussieht. Also hier selbst gebaut — deterministisch, in
 * unserer Palette, aus den Kacheln, die schon im Spiel liegen.
 *
 * Verfahren: fuer jede der 16 Eckbelegungen (NW/NE/SW/SE, je unten oder oben)
 * ein Feld ueber die Kachel interpolieren und mit einer GESTREUTEN Schwelle
 * binarisieren — geordnetes Rastern (Bayer) plus etwas Rauschen. Das ergibt
 * den ausgefransten, von Hand gewirkt aussehenden Rand, den Pixelgrafik fuer
 * Uebergaenge benutzt, statt einer sauberen Kurve.
 *
 * Die beiden reinen Faelle (alle Ecken unten / alle oben) entstehen NICHT: die
 * zeichnet das Spiel weiter aus seinen Varianten, damit die Flaeche gestreut
 * bleibt. Es entstehen also 14 Dateien je Grenze.
 *
 *   node tools/uebergangBauen.js --unten boden9 --oben boden2 --name platte
 *        [--flaechen boden10,boden11]
 *        [--dunkler 0.7] [--aus assets/hub] [--nach assets/hub]
 *
 * Ergebnis: <nach>/ueber_<name><maske>.png, Maske = NW*8 + NE*4 + SW*2 + SE.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function arg(name, vorgabe) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? vorgabe : process.argv[i + 1];
}

// Geordnetes Rastern. Ohne das waere die Grenze eine glatte Kurve — richtig
// gerechnet, aber in Pixelgrafik ein Fremdkoerper.
const BAYER = [
  [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]
];

/** Fester Wuerfel je Bildpunkt: derselbe Rand bei jedem Bauen. */
function rauschen(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

(async () => {
  const unten = arg('unten'), oben = arg('oben'), name = arg('name');
  if (!unten || !oben || !name) {
    console.error('node tools/uebergangBauen.js --unten boden9 --oben boden2 --name platte');
    process.exit(1);
  }
  const aus = arg('aus', 'assets/hub');
  const nach = arg('nach', 'assets/hub');
  const dunkler = Number(arg('dunkler', '1'));
  fs.mkdirSync(nach, { recursive: true });

  const lade = async (n) => {
    let b = sharp(path.join(aus, n + '.png')).ensureAlpha();
    if (dunkler !== 1 && n === oben) b = b.linear(dunkler, 0);
    const { data, info } = await b.raw().toBuffer({ resolveWithObject: true });
    return { data, w: info.width, h: info.height };
  };
  const U = await lade(unten), O = await lade(oben);
  if (U.w !== O.w || U.h !== O.h) throw new Error('die Kacheln sind verschieden gross');
  const W = U.w, H = U.h;

  let geschrieben = 0;
  for (let maske = 0; maske < 16; maske++) {
    if (maske === 0 || maske === 15) continue;        // die reinen Faelle bleiben beim Spiel
    const nw = (maske >> 3) & 1, ne = (maske >> 2) & 1, sw = (maske >> 1) & 1, se = maske & 1;
    const raus = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) {
      const v = (y + 0.5) / H;
      for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / W;
        // Bilinear zwischen den vier Ecken: 1 heisst "obere Art".
        const f = nw * (1 - u) * (1 - v) + ne * u * (1 - v) + sw * (1 - u) * v + se * u * v;
        const schwelle = 0.5
          + (BAYER[y & 3][x & 3] / 15 - 0.5) * 0.58
          + (rauschen(x, y) - 0.5) * 0.30;
        const q = (f >= schwelle) ? O : U;
        const i = (y * W + x) * 4;
        raus[i] = q.data[i]; raus[i + 1] = q.data[i + 1];
        raus[i + 2] = q.data[i + 2]; raus[i + 3] = q.data[i + 3];
      }
    }
    const datei = path.join(nach, 'ueber_' + name + maske + '.png');
    await sharp(raus, { raw: { width: W, height: H, channels: 4 } }).png().toFile(datei);
    geschrieben++;
  }
  // Mit --dunkler wird die obere Art abgedunkelt. Die Uebergangskacheln
  // enthalten sie dann abgedunkelt, die FLAECHE aber zeichnet das Spiel aus
  // den Grundkacheln — die waeren heller und die Grenze doppelt sichtbar.
  // Darum die Flaechenvarianten hier gleich mitschreiben.
  var flaechen = (arg('flaechen', '') || '').split(',').filter(Boolean);
  for (var fi = 0; fi < flaechen.length; fi++) {
    await sharp(path.join(aus, flaechen[fi] + '.png')).ensureAlpha().linear(dunkler, 0)
      .png().toFile(path.join(nach, 'flaeche_' + name + fi + '.png'));
  }
  console.log(name + ': ' + geschrieben + ' Uebergaenge aus ' + unten + ' -> ' + oben
    + (dunkler !== 1 ? ' (oben x' + dunkler + ')' : '')
    + (flaechen.length ? ', ' + flaechen.length + ' Flaechen' : ''));
})();
