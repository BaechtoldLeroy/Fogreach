/**
 * tools/partikelBauen.js — die Partikeltafel fuer ?partikel=neu (#183).
 *
 *   node tools/partikelBauen.js <rohordner> [--bogen vorschau/partikel_bogen.png]
 *
 * Der Rohordner haelt die PixelLab-Boegen (je Zweck ein Bild mit neun
 * kleinen Teilen, 96x96, Name = Zweck, z. B. funken.png). Heraus kommt
 * assets/tiles/partikel_atlas.png: eine Zeile je Zweck, 16x16 je Bild,
 * acht Spalten. Reihenfolge und Anzahl muessen zu PARTIKEL_ZWECKE in
 * js/particleEffects.js passen.
 *
 * WAHL: welche Teile eines Bogens genommen werden (Lesereihenfolge). Ohne
 * Eintrag die ersten. Krümel und Zusammengewachsenes sortiert man so aus.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { teileSchneiden, einpassen } = require('./teileSchneiden.js');

const FELD = 16, SPALTEN = 8, ANZAHL = 6;
const ZWECKE = ['funken', 'blut', 'daemonenblut', 'splitter', 'glut', 'staub', 'magie', 'frost', 'glanz'];
const WAHL = {};

(async () => {
  const roh = process.argv[2];
  if (!roh) { console.error('Rohordner fehlt'); process.exit(1); }
  const bogenArg = process.argv.indexOf('--bogen');
  const ziel = path.join(__dirname, '..', 'assets', 'tiles', 'partikel_atlas.png');
  const teile = [];
  for (let z = 0; z < ZWECKE.length; z++) {
    const datei = path.join(roh, ZWECKE[z] + '.png');
    if (!fs.existsSync(datei)) throw new Error(datei + ' fehlt');
    const alle = (await teileSchneiden(datei, { minFlaeche: 4, luecke: 1 }))
      .filter((t) => t.flaeche >= 4);
    // Abgerissene Flammenzungen und Spritzer sind eigene Flaechen, aber kein
    // eigenes Teilchen: was kleiner ist als ein Viertel des groessten, faellt weg.
    const groesste = Math.max.apply(null, alle.map((t) => t.flaeche));
    for (let i = alle.length - 1; i >= 0; i--) if (alle[i].flaeche < groesste / 4) alle.splice(i, 1);
    const wahl = WAHL[ZWECKE[z]] || alle.map((_, i) => i);
    const gewaehlt = wahl.map((i) => alle[i]).filter(Boolean).slice(0, ANZAHL);
    if (gewaehlt.length < ANZAHL) throw new Error(ZWECKE[z] + ': nur ' + gewaehlt.length + ' Teile');
    for (let i = 0; i < ANZAHL; i++) {
      teile.push({ input: await einpassen(gewaehlt[i], FELD), left: i * FELD, top: z * FELD });
    }
    console.log(ZWECKE[z] + ': ' + alle.length + ' Teile, genommen ' + wahl.slice(0, ANZAHL).join(','));
  }
  await sharp({ create: { width: SPALTEN * FELD, height: ZWECKE.length * FELD, channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(teile).png().toFile(ziel);
  console.log('geschrieben: ' + ziel);
  if (bogenArg > 0) {
    // Vorschau achtfach auf dunklem Grund — so dunkel wie der Kellerboden.
    const m = await sharp(ziel).metadata();
    await sharp(ziel).resize(m.width * 6, m.height * 6, { kernel: 'nearest' })
      .flatten({ background: '#2a2a30' }).png().toFile(process.argv[bogenArg + 1]);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
