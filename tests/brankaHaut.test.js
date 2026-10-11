// tests/brankaHaut.test.js — Branka hat den Hautton der uebrigen Hub-NPC (#187).
//
// Ihr Bild kam aus PixelLab mit steingrauer Haut. Leroy wollte sie "so wie die
// anderen NPCs". Gemessen wird an den Bilddateien selbst, mit EINER Messung
// fuer alle: warme Pixel im Kopfbereich (oberste 35 % des Bildes). Brankas
// Mittelwert muss in der Spanne der anderen liegen — und ihr Gesicht darf
// nicht mehr grau sein.
//
// Und weil nur die Haut wechseln sollte: Umriss (Alpha) und Masse gleich dem
// alten Bild, das unter tools/rohbilder/hubidle/branka/hub_vorher.png liegt.
// Gleiche Leinwand und gleicher Umriss heisst gleicher Fusspunkt und gleiche
// Groessenmessung (figurGrenzen) im Hub.

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const sharp = require('sharp');

const W = (p) => path.join(__dirname, '..', p);
const ANDERE = {
  thom: 'assets/sprites/setzer_thom.png',
  mara: 'assets/sprites/spaeherin.png',
  aldric: 'assets/npc/aldric/right0.png',
  elara: 'assets/npc/elara/right0.png',
  harren: 'assets/npc/harren/right0.png',
  klerus: 'assets/sprites/klerus.png',
  garde: 'assets/sprites/garde.png',
  buerger: 'assets/sprites/buerger.png'
};
const BRANKA = 'assets/sprites/schmiedemeisterin.png';
const VORHER = 'tools/rohbilder/hubidle/branka/hub_vorher.png';

function hsl(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2 / 255;
  const s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
  let h = 0;
  if (mx !== mn) {
    if (mx === r) h = ((g - b) / (mx - mn)) % 6;
    else if (mx === g) h = (b - r) / (mx - mn) + 2;
    else h = (r - g) / (mx - mn) + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s, l };
}

async function roh(p) {
  const { data, info } = await sharp(W(p)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: data, w: info.width, h: info.height };
}

/** Hautton: Mittel der warmen Pixel im Kopfbereich, plus Zahl grauer Mitteltoene dort. */
async function hautton(p) {
  const b = await roh(p);
  let r = 0, g = 0, bl = 0, n = 0, grau = 0;
  for (let y = 0; y < b.h * 0.35; y++) {
    for (let x = 0; x < b.w; x++) {
      const k = (y * b.w + x) * 4;
      if (b.d[k + 3] <= 24) continue;
      const c = hsl(b.d[k], b.d[k + 1], b.d[k + 2]);
      if (c.s < 0.07 && c.l >= 0.3 && c.l <= 0.55) grau++;
      if (c.h < 8 || c.h > 40 || c.s < 0.25 || c.s > 0.8 || c.l < 0.38 || c.l > 0.85) continue;
      r += b.d[k]; g += b.d[k + 1]; bl += b.d[k + 2]; n++;
    }
  }
  return Object.assign(hsl(r / n, g / n, bl / n), { n, grau });
}

test('Brankas Hautton liegt in der Spanne der anderen Hub-NPC', async () => {
  const andere = [];
  for (const k of Object.keys(ANDERE)) andere.push(await hautton(ANDERE[k]));
  const spanne = (f) => [Math.min(...andere.map((a) => a[f])), Math.max(...andere.map((a) => a[f]))];
  const b = await hautton(BRANKA);
  // Genug Hautpixel, dass der Mittelwert etwas sagt (die anderen: 16 bis 93).
  assert.ok(b.n >= 30, 'nur ' + b.n + ' Hautpixel bei Branka — das Gesicht ist nicht hautfarben');
  for (const f of ['h', 's', 'l']) {
    const [lo, hi] = spanne(f);
    assert.ok(b[f] >= lo - 0.01 * (f === 'h' ? 100 : 1) && b[f] <= hi + 0.01 * (f === 'h' ? 100 : 1),
      'Branka ' + f + ' ' + b[f].toFixed(2) + ' ausserhalb der anderen ' + lo.toFixed(2) + '..' + hi.toFixed(2));
  }
  // Das graue Gesicht ist weg: hoechstens so viele graue Mitteltoene im Kopf wie
  // bei der grauesten anderen Figur (Maras Kapuze, die Ruestung der Wache).
  const maxGrau = Math.max(...andere.map((a) => a.grau));
  assert.ok(b.grau <= maxGrau, 'Branka hat ' + b.grau + ' graue Mitteltoene im Kopf (andere hoechstens ' + maxGrau + ')');
});

test('Branka: nur die Farbe gewechselt — Masse und Umriss wie vorher', async () => {
  const neu = await roh(BRANKA);
  const alt = await roh(VORHER);
  assert.strictEqual(neu.w + 'x' + neu.h, alt.w + 'x' + alt.h, 'Bildmass veraendert');
  let anders = 0, farbig = 0;
  for (let i = 0; i < neu.d.length; i += 4) {
    if ((neu.d[i + 3] > 24) !== (alt.d[i + 3] > 24)) anders++;
    if (neu.d[i] !== alt.d[i] || neu.d[i + 1] !== alt.d[i + 1] || neu.d[i + 2] !== alt.d[i + 2]) farbig++;
  }
  assert.strictEqual(anders, 0, anders + ' Pixel mit anderem Umriss — Fusspunkt/Groesse koennten wandern');
  // Nur das Gesicht wechselt: ein paar Dutzend Pixel, nicht die ganze Figur.
  assert.ok(farbig > 30 && farbig < 200, farbig + ' Pixel umgefaerbt — erwartet nur das Gesicht');
});
