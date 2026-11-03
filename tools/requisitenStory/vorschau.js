// tools/requisitenStory/vorschau.js — Kontaktbogen: Bilder auf Kellerboden, x4.
//   node tools/requisitenStory/vorschau.js <ausgabe.png> <bild...>
'use strict';
const sharp = require('sharp');
const path = require('path');
(async () => {
  const [aus, ...bilder] = process.argv.slice(2);
  const Z = 4, ZELLE = 80;
  const spalten = Math.min(6, bilder.length), zeilen = Math.ceil(bilder.length / spalten);
  const boden = path.join(__dirname, '..', '..', 'assets', 'tiles', 'floor_stone_dark.png');
  const kacheln = [];
  for (let y = 0; y < zeilen * ZELLE; y += 32) for (let x = 0; x < spalten * ZELLE; x += 32) kacheln.push({ input: boden, left: x, top: y });
  const teile = [];
  for (let i = 0; i < bilder.length; i++) {
    const m = await sharp(bilder[i]).metadata();
    const f = Math.min(1, (ZELLE - 4) / Math.max(m.width, m.height));
    const b = Math.max(1, Math.round(m.width * f)), h = Math.max(1, Math.round(m.height * f));
    const buf = await sharp(bilder[i]).resize(b, h, { kernel: 'nearest' }).png().toBuffer();
    teile.push({ input: buf, left: (i % spalten) * ZELLE + Math.floor((ZELLE - b) / 2), top: Math.floor(i / spalten) * ZELLE + (ZELLE - h - 2) });
  }
  const basis = await sharp({ create: { width: spalten * ZELLE, height: zeilen * ZELLE, channels: 4, background: '#000' } })
    .composite(kacheln.concat(teile)).png().toBuffer();
  await sharp(basis).resize(spalten * ZELLE * Z, zeilen * ZELLE * Z, { kernel: 'nearest' }).toFile(aus);
})();
