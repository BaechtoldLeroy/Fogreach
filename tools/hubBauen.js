/**
 * tools/hubBauen.js — die Bilder des neuen Hubs auf ihren Inhalt zuschneiden.
 *
 * PixelLab liefert jedes Objekt mittig auf einer quadratischen Flaeche: ein
 * Fass kommt als 85x85 mit viel Luft, ein Haus als 256x256. hubNeuWelt stellt
 * die Bilder ueber ihre BREITE auf den Platz und setzt den Fusspunkt an die
 * Unterkante — beides ist falsch, solange der Rand mitgemessen wird. Ein Fass
 * mit 20 Pixeln Luft unten schwebt, und zwei Haeuser mit verschieden viel Luft
 * stehen verschieden gross da, obwohl dieselbe Breite eingetragen ist.
 *
 * Darum hier EIN Schritt: auf die Alpha-Grenzen zuschneiden, sonst nichts.
 * Kein Skalieren, kein Einpassen — die Masse entscheidet das Spiel.
 *
 *   node tools/hubBauen.js <quellordner> [--nach assets/hub]
 *
 * Jede .png des Quellordners wird unter demselben Namen abgelegt.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function arg(name, vorgabe) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? vorgabe : process.argv[i + 1];
}

/** Inhaltsgrenzen: alles ueber der Alpha-Schwelle. */
async function grenzen(datei) {
  const { data, info } = await sharp(datei).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

(async () => {
  const quelle = process.argv[2];
  const nach = arg('nach', 'assets/hub');
  if (!quelle || !fs.existsSync(quelle)) {
    console.error('Quellordner fehlt: node tools/hubBauen.js <ordner> [--nach assets/hub]');
    process.exit(1);
  }
  fs.mkdirSync(nach, { recursive: true });
  const dateien = fs.readdirSync(quelle).filter((f) => /\.png$/i.test(f));
  for (const f of dateien) {
    const voll = path.join(quelle, f);
    const g = await grenzen(voll);
    if (!g) { console.warn(f + ': leer, uebersprungen'); continue; }
    await sharp(voll).extract(g).png().toFile(path.join(nach, f));
    console.log(f.padEnd(16) + g.width + 'x' + g.height);
  }
})();
