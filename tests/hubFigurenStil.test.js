// tests/hubFigurenStil.test.js — alle Hub-Figuren kommen aus EINER Werkstatt.
//
// "Auf dem Hub-Bild gibt's immer noch welche mit falscher Grafik": die
// Vorleser waren PixelLab standard (4 Richtungen, 92er Leinwand, frontal),
// die Patrouille stand frontal - neben Figuren aus PixelLab pro (64 px,
// 8 Richtungen, Dreiviertelansicht). Den Stil selbst misst kein Test; den
// Bauweg schon: jede Figur mit Idle-Schleife (tools/hubIdleBauen.js AUSWAHL)
// hat alle acht Richtungen auf 64er Leinwand, und ihr Standbild IST die
// Suedost-Ansicht, auf den Inhalt zugeschnitten (tools/hubBauen.js).

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { AUSWAHL } = require('../tools/hubIdleBauen.js');

const WURZEL = path.join(__dirname, '..');
const RICHTUNGEN = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
// Branka wurde nach dem Bau umgefaerbt (#187, Hautton): Lage und Umriss wie
// die Suedost-Ansicht, die Farben nicht.
const UMGEFAERBT = ['branka'];

async function zuschnitt(datei) {
  const { data, info } = await sharp(datei).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, x1 = -1, y0 = info.height, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] <= 24) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return sharp(datei).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

test('jede Hub-Figur: acht Richtungen auf 64er Leinwand, Standbild = Suedost-Ansicht', async () => {
  assert.ok(AUSWAHL.length >= 17, 'nur ' + AUSWAHL.length + ' Figuren in der Auswahl');
  const daneben = [];
  for (const [ordner, standbild] of AUSWAHL) {
    const roh = path.join(WURZEL, 'tools', 'rohbilder', 'hubidle', ordner);
    const fehlt = RICHTUNGEN.filter((r) => !fs.existsSync(path.join(roh, 'rot_' + r + '.png')));
    if (fehlt.length) { daneben.push(ordner + ': Richtungen fehlen (' + fehlt.join(', ') + ')'); continue; }
    const m = await sharp(path.join(roh, 'rot_south-east.png')).metadata();
    if (m.width !== 64 || m.height !== 64) daneben.push(ordner + ': Leinwand ' + m.width + 'x' + m.height + ' statt 64x64');
    const soll = await zuschnitt(path.join(roh, 'rot_south-east.png'));
    const ist = await sharp(path.join(WURZEL, standbild)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (soll.info.width !== ist.info.width || soll.info.height !== ist.info.height) {
      daneben.push(ordner + ': Standbild ' + ist.info.width + 'x' + ist.info.height + ', Suedost-Ansicht ' + soll.info.width + 'x' + soll.info.height);
    } else if (UMGEFAERBT.indexOf(ordner) < 0 && Buffer.compare(soll.data, ist.data) !== 0) {
      daneben.push(ordner + ': Standbild ist nicht die Suedost-Ansicht');
    }
  }
  assert.deepStrictEqual(daneben, [], daneben.join('; '));
});
