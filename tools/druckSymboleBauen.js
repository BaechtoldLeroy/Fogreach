// tools/druckSymboleBauen.js — Bilder fuer die Druckerei (b435).
//
// Baut aus vorhandenen Spielbildern und einem PixelLab-Rohbild
// (tools/rohbilder/druckerei/auge.png — create_image_pixflux 32x32):
//
//   assets/ui/ui_druck_symbole.png  Streifen aus 32x32-Feldern (Reihenfolge:
//                                   DRUCK_SYMBOLE in js/scenes/PrintingHouseScene.js)
//   assets/ui/ui_symbol_thom.png    Medaillon "Setzer Thom": Fassung des
//                                   Fund-Medaillons, Thoms Brustbild auf Bernstein
//
//   node tools/druckSymboleBauen.js [--vorschau datei.png]

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const WURZEL = path.join(__dirname, '..');
const ROH = path.join(__dirname, 'rohbilder', 'druckerei');
// Puffer statt Pfad: node-canvas scheitert am Umlaut im Benutzerordner.
const lade = (f) => loadImage(fs.readFileSync(f));

const K = 32;
// Muss zu DRUCK_SYMBOLE in PrintingHouseScene passen.
const REIHE = [
  ['papier', path.join(WURZEL, 'assets', 'tiles', 'schrift_stapel.png')],
  ['verdacht', path.join(ROH, 'auge.png')],
  ['gold', path.join(WURZEL, 'assets', 'tiles', 'goldPile3.png')],
  ['schloss', path.join(WURZEL, 'assets', 'ui', 'talent_schloss.png')]
];

/** Bild in ein KxK-Feld: kleine ganzzahlig vergroessern, grosse glatt verkleinern, Alpha hart. */
function einpassen(ctx, bild, ox, oy, kante, quelle) {
  const q = quelle || { x: 0, y: 0, w: bild.width, h: bild.height };
  let s = Math.min(kante / q.w, kante / q.h);
  if (s >= 1) s = Math.floor(s);
  const zw = Math.round(q.w * s), zh = Math.round(q.h * s);
  const c = createCanvas(kante, kante), x = c.getContext('2d');
  x.imageSmoothingEnabled = s < 1;
  if (s < 1) x.imageSmoothingQuality = 'high';
  x.drawImage(bild, q.x, q.y, q.w, q.h, Math.floor((kante - zw) / 2), Math.floor((kante - zh) / 2), zw, zh);
  const d = x.getImageData(0, 0, kante, kante);
  for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] >= 110 ? 255 : 0;
  x.putImageData(d, 0, 0);
  ctx.drawImage(c, ox, oy);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Medaillon: Fassung des Fund-Medaillons, Mitte Bernstein, Thoms Brustbild darauf (im Kreis beschnitten). */
async function thom(ziel) {
  const fassung = await lade(path.join(WURZEL, 'assets', 'ui', 'ui_symbol_fund.png'));
  const W = fassung.width, H = fassung.height;
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  ctx.drawImage(fassung, 0, 0);
  const daten = ctx.getImageData(0, 0, W, H), d = daten.data;
  const MX = 23.5, MY = 23.5, R = 12;
  const a = hex('#6a4a1c'), b = hex('#3e2a12');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x - MX) * (x - MX) + (y - MY) * (y - MY) > R * R) continue;
    const f = y < MY - 3 ? a : b, i = (y * W + x) * 4;
    d[i] = f[0]; d[i + 1] = f[1]; d[i + 2] = f[2]; d[i + 3] = 255;
  }
  ctx.putImageData(daten, 0, 0);
  // Brustbild: Kopf und Schultern aus der Vorderansicht (64x64, Figur mittig).
  const figur = await lade(path.join(WURZEL, 'tools', 'rohbilder', 'hubidle', 'thom', 'rot_south.png'));
  const bust = createCanvas(24, 24), bx = bust.getContext('2d');
  einpassen(bx, figur, 0, 0, 24, { x: 20, y: 4, w: 24, h: 24 });
  // Nur innerhalb des Kreises zeichnen, sonst ragen die Schultern ueber die Fassung.
  const bd = bx.getImageData(0, 0, 24, 24);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    if ((x + 12 - MX) * (x + 12 - MX) + (y + 12 - MY) * (y + 12 - MY) > R * R) bd.data[(y * 24 + x) * 4 + 3] = 0;
  }
  bx.putImageData(bd, 0, 0);
  ctx.drawImage(bust, 12, 12);
  fs.writeFileSync(ziel, c.toBuffer('image/png'));
  return c;
}

(async () => {
  const strip = createCanvas(K * REIHE.length, K), sctx = strip.getContext('2d');
  for (let n = 0; n < REIHE.length; n++) einpassen(sctx, await lade(REIHE[n][1]), n * K, 0, K);
  fs.writeFileSync(path.join(WURZEL, 'assets', 'ui', 'ui_druck_symbole.png'), strip.toBuffer('image/png'));
  const med = await thom(path.join(WURZEL, 'assets', 'ui', 'ui_symbol_thom.png'));
  console.log('geschrieben: ui_druck_symbole.png, ui_symbol_thom.png');

  const v = process.argv.indexOf('--vorschau');
  if (v > 0) {
    const S = 4, out = createCanvas(Math.max(strip.width, 48) * S, K * S + 48 * S + 8), o = out.getContext('2d');
    o.fillStyle = '#1c191f'; o.fillRect(0, 0, out.width, out.height);
    o.imageSmoothingEnabled = false;
    o.drawImage(strip, 0, 0, strip.width * S, K * S);
    o.drawImage(med, 0, K * S + 8, 48 * S, 48 * S);
    fs.writeFileSync(process.argv[v + 1], out.toBuffer('image/png'));
  }
})();
