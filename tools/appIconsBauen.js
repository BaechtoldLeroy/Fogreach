// tools/appIconsBauen.js — App-Icons fuer "Zum Home-Bildschirm" (Web-App-
// Manifest assets/manifest.webmanifest): die Laterne aus assets/ui/favicon.png
// (64x64, Pixelbild) in ganzen Vielfachen, mittig auf dunklem Grund — mit Rand,
// damit Android sie als "maskable" rund beschneiden darf.
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
(async () => {
  const quelle = await loadImage(fs.readFileSync(path.join(__dirname, '..', 'assets', 'ui', 'favicon.png')));
  for (const [kante, faktor] of [[192, 2], [512, 6]]) {
    const c = createCanvas(kante, kante), x = c.getContext('2d');
    x.fillStyle = '#0b0d12'; x.fillRect(0, 0, kante, kante);
    x.imageSmoothingEnabled = false;
    const g = 64 * faktor;
    x.drawImage(quelle, (kante - g) / 2, (kante - g) / 2, g, g);
    fs.writeFileSync(path.join(__dirname, '..', 'assets', 'ui', 'app_icon_' + kante + '.png'), c.toBuffer('image/png'));
    console.log('app_icon_' + kante + '.png');
  }
})();
