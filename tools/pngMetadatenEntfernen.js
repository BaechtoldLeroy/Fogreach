// tools/pngMetadatenEntfernen.js — entfernt Text-Metadaten (tEXt, iTXt, zTXt,
// eXIf) aus allen PNGs unter assets/. Die Bilddaten bleiben Byte fuer Byte
// gleich. Anlass: Canva-Exporte trugen "pdf:Author" mit dem Namen des
// Entwicklers, und die Dateien sind oeffentlich abrufbar.
//   node tools/pngMetadatenEntfernen.js        (ruft nichts, meldet nur bei Treffern)
const fs = require('fs');
const path = require('path');
const WEG = /^(tEXt|iTXt|zTXt|eXIf)$/;
let dateien = 0, bloecke = 0;
function bearbeite(p) {
  const b = fs.readFileSync(p);
  const teile = [b.subarray(0, 8)];
  let o = 8, raus = 0;
  while (o < b.length) {
    const len = b.readUInt32BE(o), typ = b.toString('latin1', o + 4, o + 8);
    const ende = o + 12 + len;
    if (WEG.test(typ)) raus++; else teile.push(b.subarray(o, ende));
    o = ende;
    if (typ === 'IEND') break;
  }
  if (!raus) return;
  fs.writeFileSync(p, Buffer.concat(teile));
  dateien++; bloecke += raus;
}
(function geh(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) geh(p); else if (/\.png$/i.test(e.name)) bearbeite(p);
  }
})(path.join(__dirname, '..', 'assets'));
console.log(dateien + ' Dateien, ' + bloecke + ' Metadaten-Bloecke entfernt');
