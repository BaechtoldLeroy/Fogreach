/**
 * tools/bodenDekoBauen.js — die Tafel der Boden-Deko fuer ?boden=neu (#184).
 *
 *   node tools/bodenDekoBauen.js <rohordner> [--bogen vorschau/bodendeko_bogen.png]
 *
 * Der Rohordner haelt je Art vier PixelLab-Bilder (32x32, freigestellt),
 * benannt <art>0.png .. <art>3.png. Heraus kommt
 * assets/tiles/bodendeko_atlas.png: eine Zeile je Art, vier Spalten, 32x32.
 * Reihenfolge = ARTEN in js/bodenDeko.js.
 *
 * Die Rohbilder kommen satter und heller aus PixelLab, als der Kellerboden
 * es vertraegt (Moos leuchtete giftgruen). Darum werden alle gleich
 * gedaempft — EINE Stelle, damit die Arten untereinander stimmig bleiben.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { teileSchneiden, einpassen } = require('./teileSchneiden.js');

const FELD = 32, SPALTEN = 4;
const ARTEN = [
  'knochen', 'asche', 'kreide', 'fliesen', 'wachs', 'pergament', 'blaetter', 'schlamm',
  'moos', 'pfuetze', 'kette', 'blut', 'brand', 'salz', 'reif', 'stroh'
];
const DAEMPFUNG = { brightness: 0.82, saturation: 0.7 };

// Kreide zeichnet PixelLab zu kraeftig (dicke weisse Ringe, Pfeile wie
// Schilder). Abgerieben wirkt sie erst, wenn sie halb durchscheint und
// Luecken hat. Fester Wuerfel, damit ein Neubau dasselbe Bild ergibt.
const VERBLASSEN = { kreide: { alpha: 0.6, luecken: 0.25 } };

async function verblassen(buf, opt, saat) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let s = saat;
  const wuerfel = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 3; i < data.length; i += 4) {
    if (!data[i]) continue;
    data[i] = wuerfel() < opt.luecken ? 0 : Math.round(data[i] * opt.alpha);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/** Alles Sichtbare eines Bilds als EIN Teil (Knochen und Splitter gehoeren zusammen). */
async function ganzesBild(datei) {
  const teile = await teileSchneiden(datei, { minFlaeche: 1, luecke: 40 });
  teile.sort((a, b) => b.flaeche - a.flaeche);
  return teile[0];
}

(async () => {
  const roh = process.argv[2];
  if (!roh) { console.error('Rohordner fehlt'); process.exit(1); }
  const bogenArg = process.argv.indexOf('--bogen');
  const ziel = path.join(__dirname, '..', 'assets', 'tiles', 'bodendeko_atlas.png');
  const teile = [];
  for (let z = 0; z < ARTEN.length; z++) {
    for (let v = 0; v < SPALTEN; v++) {
      const datei = path.join(roh, ARTEN[z] + v + '.png');
      if (!fs.existsSync(datei)) throw new Error(datei + ' fehlt');
      let gedaempft = await sharp(datei).ensureAlpha().modulate(DAEMPFUNG).png().toBuffer();
      if (VERBLASSEN[ARTEN[z]]) gedaempft = await verblassen(gedaempft, VERBLASSEN[ARTEN[z]], 7 + z * 4 + v);
      const tmp = path.join(roh, '.tmp_' + ARTEN[z] + v + '.png');
      fs.writeFileSync(tmp, gedaempft);
      const t = await ganzesBild(tmp);
      fs.unlinkSync(tmp);
      if (!t) throw new Error(datei + ' ist leer');
      teile.push({ input: await einpassen(t, FELD), left: v * FELD, top: z * FELD });
    }
  }
  await sharp({ create: { width: SPALTEN * FELD, height: ARTEN.length * FELD, channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(teile).png().toFile(ziel);
  console.log('geschrieben: ' + ziel);
  if (bogenArg > 0) {
    // Vorschau auf dem echten Kellerboden, vierfach.
    const boden = path.join(__dirname, '..', 'assets', 'tiles', 'floor_stone.png');
    const kacheln = [];
    for (let y = 0; y < ARTEN.length; y++) for (let x = 0; x < SPALTEN; x++) kacheln.push({ input: boden, left: x * FELD, top: y * FELD });
    const grund = await sharp({ create: { width: SPALTEN * FELD, height: ARTEN.length * FELD, channels: 4,
      background: '#000' } }).composite(kacheln.concat([{ input: ziel, left: 0, top: 0 }])).png().toBuffer();
    await sharp(grund).resize(SPALTEN * FELD * 3, ARTEN.length * FELD * 3, { kernel: 'nearest' })
      .png().toFile(process.argv[bogenArg + 1]);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
