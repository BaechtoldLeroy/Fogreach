// tools/rohbilder/rathausschloss/platteZeichnen.js — macht aus dem
// PixelLab-Kandidaten (create_image_pro 32x40, Kandidat 33) das Rathausschloss
// des Hubs: die Messingplatte des Vorhaengeschlosses traegt danach das Zeichen
// des Kettenrats, drei Ketten. Bei 32 px Breite brachte die KI dort nur
// Gekritzel zustande.
//   node tools/rohbilder/rathausschloss/platteZeichnen.js
'use strict';
const path = require('path');
const sharp = require('sharp');
const ROH = path.join(__dirname, 'schloss_roh_k33.png');
const ZIEL = path.join(__dirname, '..', '..', '..', 'assets', 'hub', 'rathaus_schloss.png');

(async () => {
  const { data, info } = await sharp(ROH).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const set = (x, y, hex) => {
    const i = (y * info.width + x) * 4;
    data[i] = parseInt(hex.slice(0, 2), 16);
    data[i + 1] = parseInt(hex.slice(2, 4), 16);
    data[i + 2] = parseInt(hex.slice(4, 6), 16);
    data[i + 3] = 255;
  };
  // Platte um eine Spalte nach links verbreitert (11..19), damit drei
  // Ketten symmetrisch darauf passen (Spalten 13, 15, 17).
  for (let y = 23; y <= 27; y++) set(10, y, '26221c');
  for (let y = 24; y <= 26; y++) for (let x = 11; x <= 19; x++) set(x, y, 'b8975a');
  for (let x = 11; x <= 19; x++) set(x, 23, 'd9b872');           // Lichtkante oben
  set(10, 23, '2c2a22');
  const DUNKEL = '4a3618', GLIED = '7d6130';
  // Drei senkrechte Straenge: Glied quer (dunkel), Glied laengs (hohl), Glied quer.
  [13, 15, 17].forEach((x) => { set(x, 24, DUNKEL); set(x, 25, GLIED); set(x, 26, DUNKEL); });
  await sharp(data, { raw: info }).png().toFile(ZIEL);
  console.log(ZIEL);
})();
