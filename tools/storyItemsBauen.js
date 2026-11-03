/**
 * tools/storyItemsBauen.js — die ausgesuchten Bilder der Story-Gegenstaende einsetzen.
 *
 * Rohbilder: PixelLab create_1_direction_object, 48x48, zwei Auftraege mit
 * je sechzehn item_descriptions (a_00..15, b_00..15; meist jeder Gegenstand
 * zweimal gewuerfelt), mit vier vorhandenen Gegenstandsbildern als
 * Stilvorlage (itSword, amuBlutpakt, itPotionSuper, itHeadBronze). Liegen
 * unter tools/rohbilder/storyitems/; alle Kandidaten bleiben fuer spaetere
 * Wechsel liegen.
 *
 * Vorher lagen alle Quest-Funde als eingefaerbter Erzbrocken (itMat + Tint)
 * da, das Ritualamulett trug die Schlangenmaske, Elaras Klinge das
 * Standard-Schwert.
 *
 *   node tools/storyItemsBauen.js [--vorschau datei.png]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROH = path.join(__dirname, 'rohbilder', 'storyitems');
const WURZEL = path.join(__dirname, '..');

// Texturschluessel -> Rohbild.
const AUSWAHL = {
  itStoryHelmmarke: 'b_00.png',        // Messingplatte mit Kettenglied, vier Nieten — keine Pseudo-Schrift
  itStoryRatssiegel: 'b_07.png',       // rotes Wachssiegel mit Kettenabdruck, Messingrand, Baender
  itStoryPhiolensplitter: 'b_12.png',  // Scherbe mit Messinghals: als Phiole erkennbar, nicht als Eis
  itStoryHalsband: 'a_06.png',         // Lederhalsband mit Messingschnalle und Marke
  itStoryEichgewicht: 'a_08.png',      // Glockengewicht mit Waage-Stempel
  itStoryDruckplatte: 'b_04.png',      // spiegelverkehrte Fraktur-Lettern im Holzrahmen
  itStoryRitualamulett: 'a_12.png',    // Eisenmedaillon mit milchigem Nebelstein (nicht Messing wie itAmulet)
  itStoryElarasKlinge: 'b_08.png'      // schlanke Klinge, goldene Dreiketten-Gravur ueber der Parierstange
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
