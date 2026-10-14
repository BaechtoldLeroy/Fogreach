// tools/bossSymbolBauen.js — Boss-Medaillon fuer die Tiefenwahl (b417).
//
// Baut assets/ui/ui_symbol_boss.png aus dem Gefahr-Medaillon: Fassung
// bleibt Pixel fuer Pixel, die Mitte wird dunkelrot, darauf zwei gekreuzte
// Schwerter (Klingen silbern, Parierstangen in Messing). Ersetzt das
// Zeichen "⚔", das je nach Schrift als Kaestchen erschien.
//
//   node tools/bossSymbolBauen.js

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const QUELLE = path.join(__dirname, '..', 'assets', 'ui', 'ui_symbol_gefahr.png');
const ZIEL = path.join(__dirname, '..', 'assets', 'ui', 'ui_symbol_boss.png');

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const FARBE = {
  grundHell: hex('#7a2a24'), grundDunkel: hex('#4a1a18'),
  klingeHell: hex('#e4e7ea'), klingeDunkel: hex('#8a95a3'),
  messing: hex('#d9b867'), messingDunkel: hex('#9d7a59'),
  griff: hex('#5a3c33'), kontur: hex('#26231f')
};

(async () => {
  // Als Puffer: canvas oeffnet Pfade mit Umlauten (Benutzerordner) nicht.
  const bild = await loadImage(fs.readFileSync(QUELLE));
  const W = bild.width, H = bild.height;
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  ctx.drawImage(bild, 0, 0);
  const daten = ctx.getImageData(0, 0, W, H);
  const d = daten.data;
  const setze = (x, y, rgb) => { const i = (y * W + x) * 4; d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; };

  // Mitte des Medaillons: Kreis um (23.5, 23.5), Radius 12 (innerhalb der Fassung).
  const MX = 23.5, MY = 23.5, R = 12;
  const innen = (x, y) => (x - MX) * (x - MX) + (y - MY) * (y - MY) <= R * R;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // Oben heller, unten dunkler: wie das Licht auf den uebrigen Medaillons.
    if (innen(x, y)) setze(x, y, y < MY - 3 ? FARBE.grundHell : FARBE.grundDunkel);
  }

  // Ein Schwert von links unten (Knauf) nach rechts oben (Spitze).
  const schwert = [];
  for (let k = 0; k <= 10; k++) {
    schwert.push([19 + k, 27 - k, 'klingeHell']);
    if (k < 10) schwert.push([20 + k, 27 - k, 'klingeDunkel']);
  }
  [[16, 26], [17, 27], [18, 28], [19, 29], [20, 30]].forEach(([x, y], i) =>
    schwert.push([x, y, i === 0 || i === 4 ? 'messingDunkel' : 'messing']));
  schwert.push([17, 30, 'griff'], [16, 31, 'griff'], [15, 32, 'messing']);

  const maske = new Set();
  const male = (liste, spiegeln) => liste.forEach(([x, y, f]) => {
    const xx = spiegeln ? 47 - x : x;
    setze(xx, y, FARBE[f]);
    maske.add(xx + ',' + y);
  });
  male(schwert, true);   // hinteres Schwert
  male(schwert, false);  // vorderes Schwert liegt oben

  // Kontur: jedes Mittelpixel neben einem Schwertpixel.
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (maske.has(x + ',' + y) || !innen(x, y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => maske.has((x + a) + ',' + (y + b)))) setze(x, y, FARBE.kontur);
  }

  ctx.putImageData(daten, 0, 0);
  fs.writeFileSync(ZIEL, c.toBuffer('image/png'));
  console.log('geschrieben:', path.relative(process.cwd(), ZIEL));
})();
