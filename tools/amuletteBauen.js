/**
 * tools/amuletteBauen.js — die ausgesuchten Amulett-Bilder einsetzen.
 *
 * Rohbilder: PixelLab create_1_direction_object, 48x48, zwei Auftraege mit
 * je sechzehn item_descriptions (a_00..15, b_00..15; dieselben Amulette in
 * derselben Reihenfolge, zweimal gewuerfelt), mit vier vorhandenen
 * Gegenstandsbildern als Stilvorlage (itPotionSuper, itOffBannlaterne,
 * itHeadBronze, itOffFangdolch). Liegen unter tools/rohbilder/amulette/;
 * alle Kandidaten bleiben fuer spaetere Wechsel liegen.
 *
 *   node tools/amuletteBauen.js [--vorschau datei.png]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROH = path.join(__dirname, 'rohbilder', 'amulette');
const WURZEL = path.join(__dirname, '..');

// Texturschluessel -> Rohbild. Bei zwei gleich guten Fassungen gewann die,
// deren Umriss sich staerker von den Nachbarn abhebt: die Laterne (b_08)
// blieb draussen, sie gleicht der Bannlaterne (itOffBannlaterne).
const AUSWAHL = {
  itAmulet: 'a_00.png',            // Messingmedaillon mit Kettenglied — der Rueckfall fuer alle
  amuZwillingsklinge: 'b_01.png',  // zwei gekreuzte Klingen am Ring
  amuKettenherz: 'a_02.png',       // Herz in Eisenketten
  amuSchnitterband: 'a_03.png',    // Sichelklinge an der Lederschnur
  amuAderlass: 'b_04.png',         // Blutphiole mit Tropfen
  amuBrandmal: 'a_05.png',         // Eisenplatte mit gluehender Rune
  amuSturmschritt: 'a_06.png',     // Feder in Messingdraht
  amuTrabantenstein: 'b_07.png',   // schwarze Kugel mit drei blauen Monden
  amuAschefunke: 'a_08.png',       // Glut im Messingkaefig, Funken
  amuSchattenmantel: 'b_09.png',   // Kapuzengestalt aus Obsidian
  amuSchlaechterkrone: 'b_10.png', // gezackte Eisenkrone mit Blutsteinen
  amuFrostsiegel: 'b_11.png',      // Sechseck aus Eis, Schneeflocke
  amuGlasherz: 'b_12.png',         // zersprungenes Glasherz
  amuZweiterAtem: 'b_13.png',      // Sanduhr
  amuBlutpakt: 'b_14.png'          // Wachssiegel mit Nagel
};

for (const [k, roh] of Object.entries(AUSWAHL)) {
  fs.copyFileSync(path.join(ROH, roh), path.join(WURZEL, 'assets', 'tiles', k + '.png'));
  console.log(roh + ' -> assets/tiles/' + k + '.png');
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
      const b = await loadImage(fs.readFileSync(path.join(WURZEL, 'assets', 'tiles', ziele[i] + '.png')));
      x.drawImage(b, i * K * S, 0, K * S, K * S);
    }
    fs.writeFileSync(process.argv[iv + 1], c.toBuffer('image/png'));
  })();
}
