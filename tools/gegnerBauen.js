/**
 * tools/gegnerBauen.js — Einzelbilder in die Gegner-Konvention des Spiels bringen.
 *
 * Das Spiel erwartet je Gegner sechs freigestellte PNGs:
 *
 *   <ziel>/<typ>/{right0,right1,right2,left0,left1,left2}.png
 *
 * right0 ist die Ruhepose, right1/right2 die zwei Schritte; left* ist gespiegelt.
 *
 * Zugeschnitten wird auf eine GEMEINSAME Box ueber alle drei Phasen, nicht je
 * Bild einzeln: schnitte man einzeln, haette jede Phase eine andere Groesse,
 * und der Gegner zappelte beim Wechsel. Die Box ist die Vereinigung der
 * Inhalte, damit nichts abgeschnitten wird.
 *
 *   node tools/gegnerBauen.js <typ> <bild0> <bild1> <bild2> [--nach assets/enemyNeu]
 *
 * Beispiel:
 *   node tools/gegnerBauen.js wolf /tmp/w0.png /tmp/w1.png /tmp/w2.png
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function arg(name, vorgabe) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? vorgabe : process.argv[i + 1];
}

/** Inhaltsgrenzen eines Bildes (Pfad ODER Puffer), alles ueber der Alpha-Schwelle. */
async function grenzen(bild) {
  const { data, info } = await sharp(bild).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, maxX = -1, minY = info.height, maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] <= 24) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error('leeres Bild');
  return { minX, maxX, minY, maxY, b: info.width, h: info.height };
}

(async () => {
  const typ = process.argv[2];
  const bilder = [process.argv[3], process.argv[4], process.argv[5]];
  const nach = arg('nach', 'assets/enemyNeu');
  if (!typ || bilder.some((b) => !b || b.startsWith('--'))) {
    console.error('Aufruf: node tools/gegnerBauen.js <typ> <bild0> <bild1> <bild2> [--nach <ordner>]');
    process.exit(1);
  }

  // Posen koennen auf verschieden grossen Leinwaenden liegen: eine erhobene
  // Waffe braucht Platz ueber dem Kopf, den die enge Ruhe-Leinwand nicht hat,
  // und wird sonst an der Kante abgeschnitten. PixelLab setzt die Figur dabei
  // MITTIG auf die groessere Flaeche — nachgemessen am Priester: 64 -> 96
  // verschob die Fusslinie um genau 16 Pixel, also (96-64)/2.
  //
  // Zuerst alle mittig auf die groesste Leinwand bringen. Ohne das verrutschen
  // die Phasen gegeneinander, und der Gegner springt beim Schlag zur Seite.
  const roh = [];
  for (const b of bilder) roh.push(await sharp(b).ensureAlpha().metadata());
  const LB = Math.max(...roh.map((m) => m.width));
  const LH = Math.max(...roh.map((m) => m.height));
  const gleich = [];
  for (let i = 0; i < 3; i++) {
    if (roh[i].width === LB && roh[i].height === LH) {
      gleich.push(await sharp(bilder[i]).ensureAlpha().png().toBuffer());
      continue;
    }
    gleich.push(await sharp(bilder[i]).ensureAlpha().extend({
      left: Math.round((LB - roh[i].width) / 2),
      right: LB - roh[i].width - Math.round((LB - roh[i].width) / 2),
      top: Math.round((LH - roh[i].height) / 2),
      bottom: LH - roh[i].height - Math.round((LH - roh[i].height) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }).png().toBuffer());
  }

  const g = [];
  for (const b of gleich) g.push(await grenzen(b));

  // Gemeinsame Box ueber alle drei Phasen.
  const box = {
    minX: Math.min(...g.map((x) => x.minX)),
    maxX: Math.max(...g.map((x) => x.maxX)),
    minY: Math.min(...g.map((x) => x.minY)),
    maxY: Math.max(...g.map((x) => x.maxY))
  };
  const breite = box.maxX - box.minX + 1;
  const hoehe = box.maxY - box.minY + 1;

  const ordner = path.join(nach, typ);
  fs.mkdirSync(ordner, { recursive: true });

  for (let i = 0; i < 3; i++) {
    const zugeschnitten = await sharp(gleich[i])
      .extract({ left: box.minX, top: box.minY, width: breite, height: hoehe })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(ordner, 'right' + i + '.png'), zugeschnitten);
    // left* ist die Spiegelung — so haelt es auch tools/spritesSchneiden.js.
    const gespiegelt = await sharp(zugeschnitten).flop().png().toBuffer();
    fs.writeFileSync(path.join(ordner, 'left' + i + '.png'), gespiegelt);
  }

  console.log(typ + ': 6 Bilder nach ' + ordner + ', je ' + breite + 'x' + hoehe);
})().catch((e) => { console.error('Fehler: ' + e.message); process.exit(1); });
