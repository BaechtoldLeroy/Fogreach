/**
 * tools/rolleBauen.js — die Ausweichrolle des Spielers aus PixelLab holen (#179).
 *
 * Erzeugt am Spielercharakter "Archivsmith Leuchtaugen v2"
 * (f0f26be0-6606-4ce6-a467-bb6ee3092241), Gruppe rolle_probe_pmm
 * (0ebf8e8e-f472-45d5-973a-b0d38fde7719), Modus pixminimax, acht Richtungen:
 *   "dodge roll: ducks low, rolls forward along the ground in a tight ball,
 *    and comes back up onto his feet"
 *
 * PixelLab liefert je Richtung neun Bilder auf 92x92: Bild 0 ist die Ruhepose
 * (die Drehansicht des Charakters), 1..8 die Rolle bis zum Wiederaufstehen. Ins Spiel
 * kommen 1..8 als rolleDD_f00..f07 — die Ruhepose davor liefern die Gehbilder.
 *
 * Die Leinwand ist nur GEPOLSTERT (ROLLE_RAND in js/player.js): die Figur
 * ist gleich hoch gezeichnet wie im Gehbild. Ihre Lage weicht aber um ein
 * paar Pixel ab — Bild 0 des Gehens steht mitten im Schritt, die Ruhepose
 * der Rolle aufrecht (gemessen bis 4,5 px nach Norden). Diesen Versatz
 * schiebt das Werkzeug je Richtung heraus, damit die Rolle ohne Ruck aus
 * dem Gehen anfaengt. Weicht die HOEHE ab, ist es keine Polsterung mehr,
 * und es bricht ab.
 *
 *   node tools/rolleBauen.js [--trocken]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadImage, createCanvas } = require('canvas');

const BASIS = 'https://backblaze.pixellab.ai/file/pixellab-characters/729e817f-23cb-4ab4-a630-63be7d880cfa/f0f26be0-6606-4ce6-a467-bb6ee3092241/animations/';
const RAND = 14;
const BILDER = 8;       // 1..8 der Erzeugung

// dir-Nummer des Spiels (tools/pixellabHolen.js) -> PixelLab-Richtung und Animation.
const RICHTUNGEN = {
  '00': ['west', '991cf78a-b752-4985-b128-0fac2e5d90fb'],
  '01': ['north-west', '10036f96-02d0-483f-992a-8fde750c3c76'],
  '02': ['north', '4c42cda5-7068-411c-98a7-56c1d4edd6fe'],
  '03': ['north-east', '98045bb2-3c8b-4889-8291-f63a6eb53895'],
  '04': ['east', '45602b23-accf-4ecf-8476-d00b2a638195'],
  '05': ['south-east', 'f8a1431e-3885-403d-a4b7-17ed9ba57f1d'],
  '06': ['south', 'a6f4b9e8-3d72-44c7-b29e-6391f4cde8d9'],
  '07': ['south-west', 'baa5fa0b-058c-4815-bbc7-13def33bba47']
};

const ZIEL = path.join(__dirname, '..', 'assets', 'PlayerSprites');

async function bild(url) {
  const antwort = await fetch(url);
  if (!antwort.ok) throw new Error(antwort.status + ' ' + url);
  return loadImage(Buffer.from(await antwort.arrayBuffer()));
}

/** Grenzen der Figur (Alpha > 40). */
function grenzen(img) {
  const c = createCanvas(img.width, img.height);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, img.width, img.height).data;
  let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let X = 0; X < img.width; X++) {
      if (d[(y * img.width + X) * 4 + 3] > 40) {
        minX = Math.min(minX, X); maxX = Math.max(maxX, X);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  return { mitteX: (minX + maxX) / 2, fuss: maxY, hoehe: maxY - minY + 1 };
}

(async () => {
  const trocken = process.argv.includes('--trocken');
  let fehler = 0;
  for (const [dd, [richtung, anim]] of Object.entries(RICHTUNGEN)) {
    const ruhe = await bild(BASIS + anim + '/' + richtung + '/0.png');
    // Ueber den Puffer: node-canvas oeffnet unter Windows keine Pfade mit Umlaut.
    const geh = await loadImage(fs.readFileSync(path.join(ZIEL, 'dir' + dd + '_f00.png')));
    if (ruhe.width !== geh.width + 2 * RAND) {
      console.log(dd, 'Leinwand', ruhe.width, 'statt', geh.width + 2 * RAND); fehler++; continue;
    }
    const r = grenzen(ruhe), g = grenzen(geh);
    const dx = r.mitteX - g.mitteX - RAND, dy = r.fuss - g.fuss - RAND;
    const ok = Math.abs(r.hoehe - g.hoehe) <= 3 && Math.abs(dx) <= 6 && Math.abs(dy) <= 6;
    const sx = -Math.round(dx), sy = -Math.round(dy);
    console.log(dd, richtung.padEnd(10), 'Hoehe', r.hoehe, '/', g.hoehe, 'verschoben um', sx, sy, ok ? 'ok' : 'PASST NICHT');
    if (!ok) { fehler++; continue; }
    if (trocken) continue;
    for (let f = 0; f < BILDER; f++) {
      const img = await bild(BASIS + anim + '/' + richtung + '/' + (f + 1) + '.png');
      const c = createCanvas(img.width, img.height);
      c.getContext('2d').drawImage(img, sx, sy);
      fs.writeFileSync(path.join(ZIEL, 'rolle' + dd + '_f' + String(f).padStart(2, '0') + '.png'), c.toBuffer('image/png'));
    }
  }
  if (fehler) { console.error(fehler + ' Richtung(en) passen nicht'); process.exit(1); }
})();
