/**
 * tools/requisitenBauen.js — Einzelbilder auf die Zielmasse des Spiels bringen.
 *
 * Die Requisiten werden in graphics.js gezeichnet, jede mit eigenem Mass
 * (Fass 24x32, Statue 48x64, Geroell 32x24 ...). Ein Austauschbild ist dagegen
 * quadratisch. Stumpf auf das Ziel zu skalieren wuerde es verzerren.
 *
 * Darum: auf den Inhalt zuschneiden, PROPORTIONSTREU in das Zielrechteck
 * einpassen und mittig auf genau diese Groesse legen. Unten buendig, weil die
 * Objekte auf dem Boden stehen — oben Luft zu lassen sieht richtig aus, unten
 * nicht.
 *
 *   node tools/requisitenBauen.js <liste.json> [--nach assets/tilesNeu]
 *
 * liste.json: [{ "quelle": "...png", "name": "barrel", "b": 24, "h": 32 }, ...]
 *
 * Mit "mitte": true wird senkrecht mittig statt unten buendig eingepasst —
 * fuer alles, was fliegt statt zu stehen.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function arg(name, vorgabe) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? vorgabe : process.argv[i + 1];
}

/** Inhaltsgrenzen (alles ueber der Alpha-Schwelle). */
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
  if (maxX < 0) throw new Error('leeres Bild: ' + datei);
  return { minX, minY, b: maxX - minX + 1, h: maxY - minY + 1 };
}

(async () => {
  const liste = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const nach = arg('nach', 'assets/tilesNeu');
  fs.mkdirSync(nach, { recursive: true });

  for (const e of liste) {
    const g = await grenzen(e.quelle);
    // Proportionstreu einpassen: der kleinere der beiden Faktoren entscheidet.
    const faktor = Math.min(e.b / g.b, e.h / g.h);
    const neuB = Math.max(1, Math.round(g.b * faktor));
    const neuH = Math.max(1, Math.round(g.h * faktor));
    const zugeschnitten = await sharp(e.quelle)
      .ensureAlpha()
      .extract({ left: g.minX, top: g.minY, width: g.b, height: g.h })
      .resize(neuB, neuH, { kernel: 'nearest' })   // nearest: Pixelkanten bleiben hart
      .png()
      .toBuffer();
    // Waagerecht mittig, senkrecht UNTEN buendig — die Dinge stehen auf dem
    // Boden. Mit `"mitte": true` stattdessen auch senkrecht mittig: ein
    // GESCHOSS steht nicht, es fliegt, und es wird um seinen Rahmenmittelpunkt
    // gedreht. Unten buendig sass der Feuerball zehn Pixel zu tief in seinem
    // 28er Rahmen und drehte sich um einen Punkt ueber sich selbst.
    const links = Math.floor((e.b - neuB) / 2);
    const oben = e.mitte ? Math.floor((e.h - neuH) / 2) : (e.h - neuH);
    await sharp({
      create: { width: e.b, height: e.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite([{ input: zugeschnitten, left: links, top: oben }])
      .png()
      .toFile(path.join(nach, e.name + '.png'));
    console.log('  ' + e.name + ': ' + g.b + 'x' + g.h + ' -> ' + neuB + 'x' + neuH
      + ' auf ' + e.b + 'x' + e.h);
  }
  console.log(liste.length + ' Requisiten nach ' + nach);
})().catch((e) => { console.error('Fehler: ' + e.message); process.exit(1); });
