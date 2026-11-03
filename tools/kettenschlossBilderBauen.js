/**
 * tools/kettenschlossBilderBauen.js — die Bilder des Kettenschloss-Minispiels
 * (js/kettenschloss.js) aus den PixelLab-Rohbildern legen
 * (tools/rohbilder/kettenschloss/).
 *
 *   kand_koerper1.png  create_image_pro 160x40 (Kandidat 1): das Schloss von
 *                      der Seite, Eisen mit Messingbaendern, Schluesselkanal.
 *                      Dreiteilig auf KOERPER_B gestreckt: die Enden bleiben,
 *                      die Mitte wird wiederholt. Der Kanal (dunkle Zeilen
 *                      21-26) laeuft danach genau ueber LEISTE_B Pixel.
 *   kand_obj0.png      Dietrich (Hakenspitze oben, Messinggriff unten)
 *   kand_obj4.png      Spanner (L-Winkel)
 *   kand_obj9.png      Stift (Feder, Treibstift, Messing-Kernstift)
 *   kand_obj14.png     Kettenstueck (drei Glieder, kachelbar)
 *   (create_1_direction_object 64 px, sidescroller, eine Sammelanfrage)
 *
 *   ->  assets/kettenschloss/<name>.png  (zugeschnitten, ohne Metadaten)
 *
 *   node tools/kettenschlossBilderBauen.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROH = path.join(__dirname, 'rohbilder', 'kettenschloss');
const ZIEL = path.join(__dirname, '..', 'assets', 'kettenschloss');

// Muss zu js/kettenschloss.js (BILD_KANAL) passen: Kanal von x=31 bis x=128
// im Rohbild, also 31 Pixel Rand je Seite; die Leiste ist 440 breit.
const LEISTE_B = 440;
const RAND = 31;
const KOERPER_B = LEISTE_B + 2 * RAND;
const LINKS = 48, RECHTS = 112;   // Enden bis hier bzw. ab hier unveraendert

async function roh(name) {
  return sharp(path.join(ROH, name)).ensureAlpha();
}

async function zugeschnitten(name, ziel) {
  await (await roh(name)).trim({ threshold: 0 }).png({ compressionLevel: 9 })
    .toFile(path.join(ZIEL, ziel));
}

async function koerper() {
  const quelle = path.join(ROH, 'kand_koerper1.png');
  const teil = (l, w) => sharp(quelle).ensureAlpha().extract({ left: l, top: 0, width: w, height: 40 }).png().toBuffer();
  const links = await teil(0, LINKS);
  const rechts = await teil(RECHTS, 160 - RECHTS);
  const mitte = await teil(LINKS, RECHTS - LINKS);
  const lagen = [{ input: links, left: 0, top: 0 }];
  const mitteBis = KOERPER_B - (160 - RECHTS);
  for (let x = LINKS; x < mitteBis; x += RECHTS - LINKS) {
    const w = Math.min(RECHTS - LINKS, mitteBis - x);
    const stueck = w === RECHTS - LINKS ? mitte
      : await sharp(mitte).extract({ left: 0, top: 0, width: w, height: 40 }).png().toBuffer();
    lagen.push({ input: stueck, left: x, top: 0 });
  }
  lagen.push({ input: rechts, left: mitteBis, top: 0 });
  await sharp({ create: { width: KOERPER_B, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(lagen).png({ compressionLevel: 9 }).toFile(path.join(ZIEL, 'koerper.png'));
}

(async () => {
  fs.mkdirSync(ZIEL, { recursive: true });
  await koerper();
  await zugeschnitten('kand_obj0.png', 'dietrich.png');
  await zugeschnitten('kand_obj4.png', 'spanner.png');
  await zugeschnitten('kand_obj9.png', 'stift.png');
  await zugeschnitten('kand_obj14.png', 'kette.png');
  for (const f of fs.readdirSync(ZIEL)) {
    const m = await sharp(path.join(ZIEL, f)).metadata();
    console.log(f, m.width + 'x' + m.height);
  }
})();
