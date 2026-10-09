/**
 * tools/schlagBauen.js — den Nahkampfschlag des Spielers aus PixelLab holen (#171).
 *
 * Gebaut wie tools/rolleBauen.js (#179). Erzeugt am Spielercharakter
 * "Archivsmith Leuchtaugen v2" (f0f26be0-6606-4ce6-a467-bb6ee3092241),
 * Modus pixminimax, acht Bilder je Richtung, Gruppe schlag_probe_pmm
 * (2119f421-35c6-47d1-a550-c211c25a39a7):
 *   "quick melee attack with the flail in his right hand: brief wind-up
 *    raising the flail back, fast overhead swing forward striking the ground
 *    in front, then returning to the ready stance"
 * Die drei Richtungen von hinten (Nord, Nordost, Nordwest) schlugen damit
 * seitlich neben die Fuesse und endeten in einer anderen Pose. Sie kommen aus
 * Gruppe schlag_probe_nord (30c4a572-d53c-4d5a-b79e-5dc20f850669):
 *   "quick melee attack facing away from the viewer: raises the flail in his
 *    right hand over his shoulder, swings it straight forward in a vertical
 *    overhead arc so the iron ball slams down in front of him (further up the
 *    screen, beyond his head), then pulls it back to the ready stance"
 *
 * PixelLab liefert je Richtung neun Bilder auf 92x92: Bild 0 ist die Ruhepose,
 * 1..8 Ausholen, Schlag und Zurueck. Ins Spiel kommen 1..8 als
 * schlagDD_f00..f07 — die Ruhepose davor liefern die Gehbilder.
 *
 * Die Leinwand ist nur GEPOLSTERT (ROLLE_RAND in js/player.js). Den
 * Lageversatz der Ruhepose gegenueber Bild 0 des Gehens schiebt das Werkzeug
 * je Richtung heraus, damit der Schlag ohne Ruck aus dem Stand anfaengt.
 * Weicht die HOEHE ab, ist es keine Polsterung mehr, und es bricht ab.
 *
 *   node tools/schlagBauen.js [--trocken]
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
  '00': ['west', '9741cd68-1432-4091-807f-f335016ff867'],
  '01': ['north-west', 'd1d843b1-cd9f-4a12-97d0-2e3456e2f876'],
  '02': ['north', '1a22be57-06d8-4cf3-adf3-faf0b82bd8e8'],
  '03': ['north-east', '09cfaccb-6779-4464-b0d0-7167be5dacb8'],
  '04': ['east', '6375a7fd-4ea8-444d-9ae5-7966cbeafa86'],
  '05': ['south-east', '52603f24-27bc-4d33-8dc5-b71a6ea7957c'],
  '06': ['south', '1e42ebfb-2d9b-4865-b001-f78ff93fc16e'],
  '07': ['south-west', '83d70bc6-e0dc-4d41-998e-16eea35de5d4']
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
      fs.writeFileSync(path.join(ZIEL, 'schlag' + dd + '_f' + String(f).padStart(2, '0') + '.png'), c.toBuffer('image/png'));
    }
  }
  if (fehler) { console.error(fehler + ' Richtung(en) passen nicht'); process.exit(1); }
})();
