/**
 * tools/schriftstueckeBauen.js — die ausgesuchten Schriftstueck-Bilder einsetzen.
 *
 * Rohbilder: PixelLab create_1_direction_object, 48x48, zwei Auftraege mit
 * je sechzehn item_descriptions (welt_00..15 = Bodenfunde, symbol_00..15 =
 * Medaillons fuer den Toast) unter tools/rohbilder/schriftstuecke/.
 * Die Auswahl steht unten; alle Kandidaten bleiben fuer spaetere Wechsel liegen.
 *
 *   node tools/schriftstueckeBauen.js [--vorschau datei.png]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROH = path.join(__dirname, 'rohbilder', 'schriftstuecke');
const WURZEL = path.join(__dirname, '..');

// Ziel -> Rohbild. Die Rolle mit rotem Siegel (welt_00) blieb draussen: sie
// gleicht der Treppenrolle im Inventar (itStairScroll) zum Verwechseln.
const AUSWAHL = {
  'assets/tiles/schrift_fragment.png': 'welt_04.png', // angesengter, glimmender Fetzen
  'assets/tiles/schrift_rolle.png': 'welt_01.png',    // Ratsurkunde mit violettem Kettensiegel
  'assets/tiles/schrift_blatt.png': 'welt_06.png',    // Abschrift mit rotem Stempel
  'assets/tiles/schrift_brief.png': 'welt_08.png',    // gefaltet, verschnuert, gesiegelt
  'assets/tiles/schrift_seite.png': 'welt_09.png',    // ausgerissene Tagebuchseite
  'assets/tiles/schrift_stapel.png': 'welt_11.png',   // verschnuerter Papierstapel
  'assets/ui/ui_symbol_schrift.png': 'symbol_00.png'  // Feder ueber Pergament, dunkle Mitte
};

for (const [ziel, roh] of Object.entries(AUSWAHL)) {
  fs.copyFileSync(path.join(ROH, roh), path.join(WURZEL, ziel));
  console.log(roh + ' -> ' + ziel);
}

const iv = process.argv.indexOf('--vorschau');
if (iv !== -1) {
  const { createCanvas, loadImage } = require('canvas');
  (async () => {
    const K = 48, S = 4, ziele = Object.keys(AUSWAHL);
    const c = createCanvas(ziele.length * K * S, K * S);
    const x = c.getContext('2d');
    x.fillStyle = '#2a2420'; x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingEnabled = false;
    for (let i = 0; i < ziele.length; i++) {
      // Puffer statt Pfad: node-canvas scheitert am Umlaut im Benutzerordner.
      const b = await loadImage(fs.readFileSync(path.join(WURZEL, ziele[i])));
      x.drawImage(b, i * K * S, 0, K * S, K * S);
    }
    fs.writeFileSync(process.argv[iv + 1], c.toBuffer('image/png'));
  })();
}
