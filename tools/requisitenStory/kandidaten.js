// tools/requisitenStory/kandidaten.js — Kandidaten eines 1-Richtungs-Objekts holen.
//   node tools/requisitenStory/kandidaten.js <url-mit-{i}> <anzahl> <vorsatz>
// Legt tools/rohbilder/storyrequisiten/<vorsatz>_<i>.png ab.
'use strict';
const fs = require('fs');
const path = require('path');
const ORDNER = path.join(__dirname, '..', 'rohbilder', 'storyrequisiten');
(async () => {
  const [muster, anzahl, vorsatz] = process.argv.slice(2);
  fs.mkdirSync(ORDNER, { recursive: true });
  for (let i = 0; i < Number(anzahl); i++) {
    const r = await fetch(muster.replace('{i}', String(i)));
    if (!r.ok) { console.error(i + ': HTTP ' + r.status); continue; }
    fs.writeFileSync(path.join(ORDNER, vorsatz + '_' + String(i).padStart(2, '0') + '.png'), Buffer.from(await r.arrayBuffer()));
  }
  console.log('fertig');
})();
