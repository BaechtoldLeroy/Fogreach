// tools/makeBuergerSprite.js — macht aus dem (bereits freigestellten, transparenten)
// Roh-Render das spielfertige NPC-Sprite: transparente Raender wegschneiden und
// auf ~153px Breite skalieren (wie assets/sprites/setzer_thom.png). Der Alpha-
// Kanal des Originals bleibt erhalten — KEIN Hintergrund-Entfernen.
//
// Aufruf:  node tools/makeBuergerSprite.js [input] [output]
const sharp = require('sharp');
const path = require('path');

const IN = process.argv[2] || 'reference/buerger_raw.png';
const OUT = process.argv[3] || 'assets/sprites/buerger.png';
const TARGET_W = 153;

sharp(path.resolve(IN))
  .trim()                       // transparente Raender weg (respektiert Alpha)
  .resize({ width: TARGET_W })
  .png()
  .toFile(path.resolve(OUT))
  .then(() => sharp(path.resolve(OUT)).metadata())
  .then((m) => console.log('geschrieben:', OUT, m.width + 'x' + m.height, '| RGBA:', m.channels === 4))
  .catch((e) => { console.error('Fehler:', e.message); process.exit(1); });
