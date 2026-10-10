/**
 * tools/teileSchneiden.js — einzelne Teile aus einem PixelLab-Bogen loesen.
 *
 * PixelLab liefert auf Wunsch mehrere kleine Dinge auf einem Bild ("neun
 * Funken im 3x3-Raster"). Das spart Auftraege, aber die Teile liegen nie
 * genau im Raster. Darum hier ueber zusammenhaengende Flaechen statt ueber
 * feste Zellen: was sich beruehrt (oder fast), ist EIN Teil.
 *
 * Gemeinsam genutzt von tools/partikelBauen.js (#183) und
 * (frueher auch fuer die verworfene Boden-Deko #184).
 */
'use strict';

const sharp = require('sharp');

/**
 * @param {string} datei PNG mit Alphakanal
 * @param {{minFlaeche?: number, luecke?: number}} [opt]
 *   minFlaeche: kleinere Krümel fallen weg; luecke: so nah beieinander
 *   liegende Flaechen gelten als ein Teil (Funkenschweif mit Abstand).
 * @returns {Promise<Array<{x:number,y:number,w:number,h:number,data:Buffer,flaeche:number}>>}
 *   in Lesereihenfolge (Zeilen von oben, darin von links)
 */
async function teileSchneiden(datei, opt) {
  opt = opt || {};
  const minFlaeche = opt.minFlaeche || 6;
  const luecke = opt.luecke == null ? 1 : opt.luecke;
  const { data, info } = await sharp(datei).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const voll = (x, y) => data[(y * W + x) * 4 + 3] > 24;
  const marke = new Int32Array(W * H).fill(-1);
  const kisten = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!voll(x, y) || marke[y * W + x] >= 0) continue;
      const id = kisten.length;
      const k = { x0: x, y0: y, x1: x, y1: y, n: 0 };
      const stapel = [[x, y]];
      marke[y * W + x] = id;
      while (stapel.length) {
        const [cx, cy] = stapel.pop();
        k.n++;
        if (cx < k.x0) k.x0 = cx; if (cx > k.x1) k.x1 = cx;
        if (cy < k.y0) k.y0 = cy; if (cy > k.y1) k.y1 = cy;
        for (let dy = -1 - luecke; dy <= 1 + luecke; dy++) {
          for (let dx = -1 - luecke; dx <= 1 + luecke; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            if (marke[ny * W + nx] >= 0 || !voll(nx, ny)) continue;
            marke[ny * W + nx] = id;
            stapel.push([nx, ny]);
          }
        }
      }
      kisten.push(k);
    }
  }
  const teile = [];
  kisten.forEach((k, id) => {
    if (k.n < minFlaeche) return;
    const w = k.x1 - k.x0 + 1, h = k.y1 - k.y0 + 1;
    const out = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const q = ((k.y0 + y) * W + (k.x0 + x));
        if (marke[q] !== id) continue;   // Nachbarteile nicht mitnehmen
        data.copy(out, (y * w + x) * 4, q * 4, q * 4 + 4);
      }
    }
    teile.push({ x: k.x0, y: k.y0, w, h, data: out, flaeche: k.n });
  });
  // Lesereihenfolge: grob nach Zeilen (Mitte), dann nach x.
  const zeile = Math.max(8, Math.round(H / 6));
  teile.sort((a, b) => {
    const za = Math.floor((a.y + a.h / 2) / zeile), zb = Math.floor((b.y + b.h / 2) / zeile);
    return za !== zb ? za - zb : a.x - b.x;
  });
  return teile;
}

/**
 * Ein Teil in ein Feld der Kantenlaenge `feld` einpassen: nur verkleinern,
 * nie vergroessern (Pixelgrafik wird beim Vergroessern nur grober), mittig.
 * @returns {Promise<Buffer>} PNG feld x feld
 */
async function einpassen(teil, feld, opt) {
  opt = opt || {};
  let img = sharp(teil.data, { raw: { width: teil.w, height: teil.h, channels: 4 } });
  let w = teil.w, h = teil.h;
  const f = Math.min(1, (feld - (opt.rand || 0) * 2) / Math.max(w, h));
  if (f < 1) {
    w = Math.max(1, Math.round(w * f)); h = Math.max(1, Math.round(h * f));
    img = img.resize(w, h, { kernel: 'nearest' });
  }
  const buf = await img.png().toBuffer();
  return sharp({ create: { width: feld, height: feld, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: buf, left: Math.floor((feld - w) / 2), top: Math.floor((feld - h) / 2) }])
    .png().toBuffer();
}

module.exports = { teileSchneiden, einpassen };
