/**
 * tools/treppenBauen.js — Treppenbilder spielfertig machen.
 *
 * Zwei Dinge passieren hier:
 *
 * 1. DAS LOCH WIRD SCHWARZ. Die Entwuerfe sind Torboegen mit Stufen, und der
 *    Raum hinter dem Bogen kam DURCHSICHTIG zurueck — bei dreizehn von
 *    sechzehn, zwischen 75 und 763 Punkten. Im Spiel liegt die Treppe auf dem
 *    Boden, also schien der Steinboden durch den Bogen, und aus dem Abgang
 *    wurde ein aufgemalter Rahmen.
 *
 *    Gefuellt wird nur, was EINGESCHLOSSEN ist: von den Bildraendern her wird
 *    die Durchsichtigkeit geflutet, alles was dabei erreicht wird bleibt
 *    durchsichtig (das ist das Aussen), und nur die nicht erreichten Loecher
 *    werden schwarz. Ein stumpfes "alles Durchsichtige schwarz" haette einen
 *    schwarzen Kasten um jede Treppe gelegt.
 *
 * 2. ZUGESCHNITTEN wird auf den Inhalt, damit die Groesse am Bild haengt und
 *    nicht am Rand der Leinwand — dieselbe Lehre wie bei den Gegnern (b314).
 *
 *   node tools/treppenBauen.js <ordner-mit-0..15.png> [--nach assets/tiles]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function arg(name, vorgabe) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? vorgabe : process.argv[i + 1];
}

const ALPHA = 16;   // darunter gilt ein Punkt als durchsichtig

/**
 * Fuellt eingeschlossene durchsichtige Flaechen mit Schwarz.
 *
 * @returns {{daten: Buffer, b: number, h: number, gefuellt: number}}
 */
function lochFuellen(daten, b, h) {
  const aussen = new Uint8Array(b * h);
  const stapel = [];
  const anstossen = (x, y) => {
    if (x < 0 || y < 0 || x >= b || y >= h) return;
    const i = y * b + x;
    if (aussen[i] || daten[i * 4 + 3] > ALPHA) return;
    aussen[i] = 1;
    stapel.push(i);
  };
  for (let x = 0; x < b; x++) { anstossen(x, 0); anstossen(x, h - 1); }
  for (let y = 0; y < h; y++) { anstossen(0, y); anstossen(b - 1, y); }
  while (stapel.length) {
    const i = stapel.pop();
    const x = i % b;
    const y = (i - x) / b;
    anstossen(x + 1, y); anstossen(x - 1, y);
    anstossen(x, y + 1); anstossen(x, y - 1);
  }
  let gefuellt = 0;
  for (let i = 0; i < b * h; i++) {
    if (aussen[i] || daten[i * 4 + 3] > ALPHA) continue;
    daten[i * 4] = 0; daten[i * 4 + 1] = 0; daten[i * 4 + 2] = 0; daten[i * 4 + 3] = 255;
    gefuellt++;
  }
  return { daten, b, h, gefuellt };
}

/** Inhaltsgrenzen (nach dem Fuellen, sonst zaehlt das Loch nicht mit). */
function grenzen(daten, b, h) {
  let minX = b, maxX = -1, minY = h, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < b; x++) {
      if (daten[(y * b + x) * 4 + 3] <= ALPHA) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error('leeres Bild');
  return { minX, maxX, minY, maxY };
}

(async () => {
  const von = process.argv[2];
  const nach = arg('nach', 'assets/tiles');
  if (!von || von.startsWith('--')) {
    console.error('Aufruf: node tools/treppenBauen.js <ordner> [--nach <ordner>]');
    process.exit(1);
  }
  fs.mkdirSync(nach, { recursive: true });

  const dateien = fs.readdirSync(von).filter((f) => /^\d+\.png$/.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  if (!dateien.length) { console.error('keine 0.png, 1.png ... in ' + von); process.exit(1); }

  for (let i = 0; i < dateien.length; i++) {
    const quelle = path.join(von, dateien[i]);
    const { data, info } = await sharp(quelle).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    const g = lochFuellen(Buffer.from(data), info.width, info.height);
    const box = grenzen(g.daten, g.b, g.h);
    const breite = box.maxX - box.minX + 1;
    const hoehe = box.maxY - box.minY + 1;
    const ziel = path.join(nach, 'stairDown' + i + '.png');
    await sharp(g.daten, { raw: { width: g.b, height: g.h, channels: 4 } })
      .extract({ left: box.minX, top: box.minY, width: breite, height: hoehe })
      .png().toFile(ziel);
    console.log('stairDown' + i + ': ' + breite + 'x' + hoehe
      + ', ' + g.gefuellt + ' Punkte geschwaerzt');
  }
  console.log(dateien.length + ' Treppen nach ' + nach);
})().catch((e) => { console.error('Fehler: ' + e.message); process.exit(1); });
