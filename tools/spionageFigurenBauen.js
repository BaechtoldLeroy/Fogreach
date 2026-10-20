/**
 * tools/spionageFigurenBauen.js — die eigenen Figuren und Requisiten der
 * Spionage-Raeume und der Nachteskorte aus den PixelLab-Rohbildern schneiden.
 *
 * Rohbilder: tools/rohbilder/nachteskorte/
 *   <figur>_rot_south-east.png   Standbild (Rotation suedost = "nach rechts")
 *   <figur>_walk<i>.png          Gehbilder (animate_character, suedost)
 *   <requisit>_roh.png           Einzelobjekte (create_1_direction_object)
 *
 * Ziel: assets/sprites/spionage/figuren/<figur>/right0.png, walk_right<i>.png
 *       assets/sprites/spionage/requisiten/<requisit>.png
 *
 * Alle Bilder EINER Figur bekommen denselben Ausschnitt (Vereinigung der
 * Umrisse, Fuesse unten buendig), damit die Figur beim Gehen nicht springt.
 * Leinwaende verschiedener Groesse (v3-Animation 88 px, Rotation 64 px) werden
 * dafuer mittig uebereinandergelegt — so legt PixelLab sie selbst an.
 *
 *   node tools/spionageFigurenBauen.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROH = path.join(__dirname, 'rohbilder', 'nachteskorte');
const ZIEL = path.join(__dirname, '..', 'assets', 'sprites', 'spionage');
const FIGUREN = ['fuhrmann', 'geleerter', 'ratsbote', 'schreiber', 'traeger'];
const REQUISITEN = ['phiolenkiste', 'pult', 'karren', 'waage', 'schacht'];

async function roh(datei) {
  const { data, info } = await sharp(datei).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function umriss(b, dx, dy) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (b.data[(y * b.w + x) * 4 + 3] > 8) {
        x0 = Math.min(x0, x + dx); x1 = Math.max(x1, x + dx);
        y0 = Math.min(y0, y + dy); y1 = Math.max(y1, y + dy);
      }
    }
  }
  return { x0, y0, x1, y1 };
}

async function schneiden(datei, links, oben, w, h, ziel) {
  // Mit Rand auffuellen, damit der Ausschnitt nie ueber die Leinwand ragt.
  const P = 64;
  const gross = await sharp(datei).ensureAlpha()
    .extend({ top: P, bottom: P, left: P, right: P, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  await sharp(gross).extract({ left: links + P, top: oben + P, width: w, height: h })
    .png({ compressionLevel: 9 })
    .toFile(ziel);
}

async function figur(name) {
  const dateien = [path.join(ROH, name + '_rot_south-east.png')];
  for (let i = 0; fs.existsSync(path.join(ROH, name + '_walk' + i + '.png')); i++) dateien.push(path.join(ROH, name + '_walk' + i + '.png'));
  const bilder = await Promise.all(dateien.map(roh));
  const W = Math.max(...bilder.map((b) => b.w)), H = Math.max(...bilder.map((b) => b.h));
  const vers = bilder.map((b) => ({ dx: Math.round((W - b.w) / 2), dy: Math.round((H - b.h) / 2) }));
  const u = bilder.map((b, i) => umriss(b, vers[i].dx, vers[i].dy));
  const x0 = Math.min(...u.map((r) => r.x0)), y0 = Math.min(...u.map((r) => r.y0));
  const x1 = Math.max(...u.map((r) => r.x1)), y1 = Math.max(...u.map((r) => r.y1));
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const ordner = path.join(ZIEL, 'figuren', name);
  fs.mkdirSync(ordner, { recursive: true });
  for (let i = 0; i < dateien.length; i++) {
    const ziel = path.join(ordner, i === 0 ? 'right0.png' : 'walk_right' + (i - 1) + '.png');
    await schneiden(dateien[i], x0 - vers[i].dx, y0 - vers[i].dy, w, h, ziel);
  }
  console.log(name.padEnd(10), w + 'x' + h, 'Gehbilder', dateien.length - 1,
    'Fusslinie', u.map((r) => r.y1).join(','));
}

async function requisit(name) {
  const datei = path.join(ROH, name + '_roh.png');
  const b = await roh(datei);
  const r = umriss(b, 0, 0);
  fs.mkdirSync(path.join(ZIEL, 'requisiten'), { recursive: true });
  await schneiden(datei, r.x0, r.y0, r.x1 - r.x0 + 1, r.y1 - r.y0 + 1, path.join(ZIEL, 'requisiten', name + '.png'));
  console.log(name.padEnd(10), (r.x1 - r.x0 + 1) + 'x' + (r.y1 - r.y0 + 1));
}

(async () => {
  for (const f of FIGUREN) await figur(f);
  for (const r of REQUISITEN) await requisit(r);
})().catch((e) => { console.error(e); process.exit(1); });
