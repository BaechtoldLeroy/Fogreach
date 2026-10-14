// tools/laufSymboleBauen.js — Bilder fuer die Laufzusammenfassung (b418).
//
// Baut aus vorhandenen Spielbildern und drei PixelLab-Rohbildern
// (tools/rohbilder/laufsymbole/: tuer, sanduhr, laterne — create_image_pixflux 32x32):
//
//   assets/ui/ui_lauf_symbole.png  Streifen aus 32x32-Feldern, ein Symbol je
//                                  Wert der Zusammenfassung (Reihenfolge: REIHE
//                                  in js/scenes/HubSceneV2.js, LAUF_SYMBOLE)
//   assets/ui/ui_symbol_laterne.png  Medaillon "Lauf abgeschlossen": Fassung
//                                  des Fund-Medaillons, Laterne auf Bernstein
//   assets/ui/ui_symbol_tod.png    Medaillon "Im Dungeon gefallen": Fassung des
//                                  Gefahr-Medaillons, Totenkopf auf Dunkelrot
//
//   node tools/laufSymboleBauen.js [--vorschau datei.png]

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const WURZEL = path.join(__dirname, '..');
const ROH = path.join(__dirname, 'rohbilder', 'laufsymbole');
const HUD = path.join(__dirname, 'rohbilder', 'hudicons');
// Puffer statt Pfad: node-canvas scheitert am Umlaut im Benutzerordner.
const lade = (f) => loadImage(fs.readFileSync(f));

const K = 32;
// Muss zu LAUF_SYMBOLE in HubSceneV2 passen.
const REIHE = [
  ['raeume', path.join(ROH, 'tuer.png')],
  ['gegner', path.join(HUD, 'deathBlow.png')],
  ['elite', path.join(HUD, 'berserk.png')],
  ['bosse', path.join(WURZEL, 'assets', 'ui', 'ui_symbol_boss.png')],
  ['xp', path.join(WURZEL, 'assets', 'tiles', 'xpDrop.png')],
  ['gold', path.join(WURZEL, 'assets', 'tiles', 'goldPile3.png')],
  ['fragmente', path.join(WURZEL, 'assets', 'tiles', 'schrift_fragment.png')],
  ['dauer', path.join(ROH, 'sanduhr.png')]
];

/** Bild in ein KxK-Feld: kleine ganzzahlig vergroessern, grosse glatt verkleinern, Alpha hart. */
function einpassen(ctx, bild, ox, oy, kante) {
  const w = bild.width, h = bild.height;
  let s = Math.min(kante / w, kante / h);
  if (s >= 1) s = Math.floor(s);
  const zw = Math.round(w * s), zh = Math.round(h * s);
  const c = createCanvas(kante, kante), x = c.getContext('2d');
  x.imageSmoothingEnabled = s < 1;
  if (s < 1) x.imageSmoothingQuality = 'high';
  x.drawImage(bild, Math.floor((kante - zw) / 2), Math.floor((kante - zh) / 2), zw, zh);
  // Halbtransparente Kanten aus dem Verkleinern hart schneiden — Pixelkunst.
  const d = x.getImageData(0, 0, kante, kante);
  for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] >= 110 ? 255 : 0;
  x.putImageData(d, 0, 0);
  ctx.drawImage(c, ox, oy);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Medaillon: Fassung aus quelle, Mitte neu gefuellt, Motiv darauf. */
async function medaillon(quelle, motiv, hell, dunkel, ziel) {
  const fassung = await lade(quelle);
  const W = fassung.width, H = fassung.height;
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  ctx.drawImage(fassung, 0, 0);
  const daten = ctx.getImageData(0, 0, W, H), d = daten.data;
  const MX = 23.5, MY = 23.5, R = 12;
  const a = hex(hell), b = hex(dunkel);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x - MX) * (x - MX) + (y - MY) * (y - MY) > R * R) continue;
    const f = y < MY - 3 ? a : b, i = (y * W + x) * 4;
    d[i] = f[0]; d[i + 1] = f[1]; d[i + 2] = f[2]; d[i + 3] = 255;
  }
  ctx.putImageData(daten, 0, 0);
  einpassen(ctx, await lade(motiv), 12, 12, 24);
  fs.writeFileSync(ziel, c.toBuffer('image/png'));
  return c;
}

(async () => {
  const strip = createCanvas(K * REIHE.length, K), sctx = strip.getContext('2d');
  for (let n = 0; n < REIHE.length; n++) einpassen(sctx, await lade(REIHE[n][1]), n * K, 0, K);
  const ZS = path.join(WURZEL, 'assets', 'ui', 'ui_lauf_symbole.png');
  fs.writeFileSync(ZS, strip.toBuffer('image/png'));

  const ui = (n) => path.join(WURZEL, 'assets', 'ui', n);
  const lat = await medaillon(ui('ui_symbol_fund.png'), path.join(ROH, 'laterne.png'), '#6a4a1c', '#3e2a12', ui('ui_symbol_laterne.png'));
  const tod = await medaillon(ui('ui_symbol_gefahr.png'), path.join(HUD, 'deathBlow.png'), '#7a2a24', '#4a1a18', ui('ui_symbol_tod.png'));
  console.log('geschrieben: ui_lauf_symbole.png, ui_symbol_laterne.png, ui_symbol_tod.png');

  const v = process.argv.indexOf('--vorschau');
  if (v > 0) {
    const S = 4, out = createCanvas(strip.width * S, K * S + 48 * S + 8), o = out.getContext('2d');
    o.fillStyle = '#1c191f'; o.fillRect(0, 0, out.width, out.height);
    o.imageSmoothingEnabled = false;
    o.drawImage(strip, 0, 0, strip.width * S, K * S);
    o.drawImage(lat, 0, K * S + 8, 48 * S, 48 * S);
    o.drawImage(tod, 48 * S + 16, K * S + 8, 48 * S, 48 * S);
    fs.writeFileSync(process.argv[v + 1], out.toBuffer('image/png'));
  }
})();
