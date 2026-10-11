/**
 * tools/brankaHaut.js — Brankas graue Haut in den Hautton der uebrigen Hub-NPC umfaerben (#187).
 *
 * Branka kam aus PixelLab mit steingrauer Haut; Leroy wollte sie "so wie die
 * anderen NPCs". Gemessen (Kopfbereich, warme Pixel, vorschau-Messung in #187):
 *
 *   Thom h22 s.52 l.59   Mara h20 s.46 l.60   Aldric h19 s.46 l.57
 *   Elara h16 s.59 l.64  Harren h22 s.50 l.53 Klerus h21 s.46 l.67
 *   Garde h19 s.50 l.54  Buerger h20 s.36 l.50
 *
 * Mittel h20 s.48 l.58, Spanne der Helligkeit l .38 bis .76. Neu erzeugen
 * haette Pose und Kleidung gewackelt; hier werden NUR die grauen Hautpixel
 * des Kopfes umgefaerbt, jeder Grauwert behaelt seine Stelle in der Rampe
 * (dunkel bleibt Schatten, hell bleibt Licht). Alles andere bleibt Pixel fuer
 * Pixel gleich — Masse, Fusspunkt, Kleidung.
 *
 * Haut heisst: neutrales Grau (Saettigung < 0.07) im Gesichtskasten, siehe
 * umfaerben(). Der Russ auf der Schuerze ist ebenfalls grau, liegt aber
 * ausserhalb des Kastens. Ein PixelLab-edit_image (10 Generationen) zeichnete
 * das Gesicht neu und verschob die Silhouette um einen Pixel — darum dieser Weg.
 *
 *   node tools/brankaHaut.js <ein.png> <aus.png>
 *
 * Quelle ist das alte graue Bild, abgelegt unter
 * tools/rohbilder/hubidle/branka/hub_vorher.png.
 */
'use strict';

const sharp = require('sharp');

// Zielton aus der Messung oben.
const ZIEL = { h: 20, s: 0.48, lMin: 0.38, lMax: 0.76 };
// Grauwerte der Haut in Brankas Bild (gemessen: #373637 .. #808180).
const QUELLE = { lMin: 0.19, lMax: 0.52, sMax: 0.07 };
// Gesichtskasten im Hub-Bild schmiedemeisterin.png (41x59), aus der Grauwert-
// Karte abgelesen: Stirn unter dem Pony bis Hals, rechts vom Haarvorhang.
const KASTEN_HUB = { x0: 17, y0: 6, x1: 28, y1: 22 };

function hsl(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2 / 255;
  const s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
  return { s, l };
}

function rgbAusHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : [x, c, 0];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/**
 * Faerbt die Hautpixel in data (RGBA, w x h) an Ort und Stelle um; liefert die Anzahl.
 *
 * Gesucht wird nur im Gesichtskasten `kasten` ({x0, y0, x1, y1}, einschliesslich).
 * Haar und Gesicht teilen sich Grauwerte — die Lichter im schwarzen Haar sind so
 * hell wie die Gesichtsschatten. Darum: helle Grautoene (l >= .3) im Kasten sind
 * sicher Haut; mittlere (l >= .19) nur, wenn sie an solche Haut grenzen.
 */
function umfaerben(data, w, h, kasten) {
  const grau = (k) => {
    if (data[k + 3] <= 24) return -1;
    const { s, l } = hsl(data[k], data[k + 1], data[k + 2]);
    return s < QUELLE.sMax ? l : -1;
  };
  const haut = new Set();
  for (let y = kasten.y0; y <= kasten.y1; y++) {
    for (let x = kasten.x0; x <= kasten.x1; x++) {
      if (grau((y * w + x) * 4) >= 0.3) haut.add(y * w + x);
    }
  }
  // Schatten anwachsen lassen, die an sicherer Haut liegen (zwei Runden reichen fuer
  // die Schattenkante unter Kinn und Wange).
  for (let runde = 0; runde < 2; runde++) {
    const neu = [];
    for (let y = kasten.y0; y <= kasten.y1; y++) {
      for (let x = kasten.x0; x <= kasten.x1; x++) {
        const i = y * w + x;
        if (haut.has(i)) continue;
        const l = grau(i * 4);
        if (l < 0.19) continue;
        if (haut.has(i - 1) || haut.has(i + 1) || haut.has(i - w) || haut.has(i + w)) neu.push(i);
      }
    }
    neu.forEach((i) => haut.add(i));
  }
  haut.forEach((i) => {
    const k = i * 4;
    const { l } = hsl(data[k], data[k + 1], data[k + 2]);
    const t = Math.max(0, Math.min(1, (l - QUELLE.lMin) / (QUELLE.lMax - QUELLE.lMin)));
    const zl = ZIEL.lMin + t * (ZIEL.lMax - ZIEL.lMin);
    // Rampe wie bei den anderen gemessen: Schatten roetlich und matt
    // (h ~11, s ~.40), Licht gelblicher und satter (h ~25, s ~.75).
    const [r, g, b] = rgbAusHsl(ZIEL.h - 9 + t * 14, 0.40 + t * 0.35, zl);
    data[k] = r; data[k + 1] = g; data[k + 2] = b;
  });
  return haut.size;
}

async function datei(ein, aus, kasten) {
  const { data, info } = await sharp(ein).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = umfaerben(data, info.width, info.height, kasten || KASTEN_HUB);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(aus);
  return n;
}

module.exports = { umfaerben, datei, ZIEL, QUELLE, KASTEN_HUB };

if (require.main === module) {
  datei(process.argv[2], process.argv[3]).then((n) => console.log(n + ' Hautpixel umgefaerbt'));
}
