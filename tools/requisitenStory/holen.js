// tools/requisitenStory/holen.js — PixelLab-Kartenobjekte als Rohbild holen.
//   node tools/requisitenStory/holen.js <name>=<objekt-id> ...
// Legt tools/rohbilder/storyrequisiten/<name>.png ab.
'use strict';
const fs = require('fs');
const path = require('path');
const ORDNER = path.join(__dirname, '..', 'rohbilder', 'storyrequisiten');
(async () => {
  fs.mkdirSync(ORDNER, { recursive: true });
  for (const a of process.argv.slice(2)) {
    const [name, id] = a.split('=');
    const r = await fetch('https://api.pixellab.ai/mcp/map-objects/' + id + '/download');
    if (!r.ok) { console.error(name + ': HTTP ' + r.status); continue; }
    fs.writeFileSync(path.join(ORDNER, name + '.png'), Buffer.from(await r.arrayBuffer()));
    console.log('  ' + name);
  }
})();
