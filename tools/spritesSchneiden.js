/**
 * tools/spritesSchneiden.js — ein geliefertes Sprite-Blatt in Gegner-Frames zerlegen.
 *
 * Die Gegner-Bilder kommen als EIN Blatt mit mehreren Posen nebeneinander auf
 * weissem Grund. Das Spiel erwartet dagegen einzelne, freigestellte PNGs:
 *
 *   assets/enemy/<typ>/{right0,right1,right2,left0,left1,left2}.png
 *
 * right0 ist die Ruhepose, right1/right2 die zwei Schritte einer Aktion
 * (enemy.js setzt sie nacheinander), left* ist jeweils gespiegelt.
 *
 * Schritte: weissen Grund vom Rand her wegnehmen (Flutfuellung, damit weisse
 * Stellen IM Bild bleiben — die Robe des Priesters ist hell), die Posen an den
 * leeren Spalten dazwischen trennen, jede freistellen, auf eine gemeinsame
 * Hoehe bringen und spiegeln.
 *
 *   node tools/spritesSchneiden.js <blatt> <typ> [--posen 0,2,3] [--hoehe 256]
 *                                  [--nach assets/enemy] [--trocken]
 *
 *   --posen   welche Posen des Blattes (ab 0) zu right0,right1,right2 werden
 *   --anzahl  wie viele Posen auf dem Blatt stehen (Standard 4)
 *   --grenzen Schnittspalten von Hand, z. B. 400,860,1180
 *   --trocken nichts schreiben, nur berichten, was gefunden wurde
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const WEISS = 238;        // ab hier gilt ein Randpixel als Hintergrund
const MIND_PIXEL = 6;      // weniger Inhalt in einer Spalte gilt als leer (Streupixel)

function arg(name, vorgabe) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? vorgabe : process.argv[i + 1];
}

/** Weissen Hintergrund vom Rand her wegnehmen (Flutfuellung ueber 4 Nachbarn). */
function grundEntfernen(daten, b, h) {
  const weg = new Uint8Array(b * h);
  const stapel = [];
  const istWeiss = (i) => daten[i * 4] >= WEISS && daten[i * 4 + 1] >= WEISS && daten[i * 4 + 2] >= WEISS;
  const anstossen = (i) => { if (!weg[i] && (istWeiss(i) || daten[i * 4 + 3] === 0)) { weg[i] = 1; stapel.push(i); } };
  for (let x = 0; x < b; x++) { anstossen(x); anstossen((h - 1) * b + x); }
  for (let y = 0; y < h; y++) { anstossen(y * b); anstossen(y * b + b - 1); }
  while (stapel.length) {
    const i = stapel.pop();
    const x = i % b, y = (i / b) | 0;
    if (x > 0) anstossen(i - 1);
    if (x < b - 1) anstossen(i + 1);
    if (y > 0) anstossen(i - b);
    if (y < h - 1) anstossen(i + b);
  }
  for (let i = 0; i < b * h; i++) if (weg[i]) daten[i * 4 + 3] = 0;
  return daten;
}

/**
 * Spaltenweise nach Inhalt suchen und die Posen trennen.
 */
function posenFinden(daten, b, h, anzahl, grenzen) {
  const voll = new Array(b).fill(0);
  for (let x = 0; x < b; x++) {
    let n = 0;
    for (let y = 0; y < h; y++) if (daten[(y * b + x) * 4 + 3] > 8) n++;
    voll[x] = n;
  }
  let von = 0, bis = b - 1;
  while (von < b && voll[von] < MIND_PIXEL) von++;
  while (bis > von && voll[bis] < MIND_PIXEL) bis--;
  // Die Posen stehen gleichmaessig auf dem Blatt. Geschnitten wird nahe der
  // erwarteten Grenze an der Spalte mit dem WENIGSTEN Inhalt — manche Posen
  // beruehren sich (der springende Hund greift ins naechste Bild), da gibt es
  // gar keine leere Spalte.
  const breite = bis - von + 1;
  // Von Hand gesetzte Schnittkanten haben Vorrang: ueberlappen sich zwei Posen
  // (die Heiligenscheine des Priesters beruehren sich), findet keine Spalte
  // eine saubere Trennung, und ein Stueck fremder Lichtschein ist das kleinere
  // Uebel gegen einen abgeschnittenen Ring.
  const schnitte = [];
  if (grenzen) { String(grenzen).split(',').map(Number).forEach((x) => schnitte.push(x)); }
  if (!schnitte.length) {
    for (let i = 1; i < (anzahl || 4); i++) {
      const mitte = von + Math.round((breite * i) / (anzahl || 4));
      const spanne = Math.round(breite * 0.08);
      let beste = mitte, wenigste = Infinity;
      for (let x = Math.max(von + 1, mitte - spanne); x <= Math.min(bis - 1, mitte + spanne); x++) {
        if (voll[x] < wenigste) { wenigste = voll[x]; beste = x; }
      }
      schnitte.push(beste);
    }
  }
  const posen = [];
  let p0 = von;
  schnitte.forEach((x) => { posen.push([p0, x]); p0 = x + 1; });
  posen.push([p0, bis]);
  // Auf den echten Inhalt zusammenziehen.
  posen.forEach((p) => {
    while (p[0] < p[1] && voll[p[0]] < MIND_PIXEL) p[0]++;
    while (p[1] > p[0] && voll[p[1]] < MIND_PIXEL) p[1]--;
  });
  return posen;
}

/** Senkrechte Grenzen des Inhalts in einem Spaltenbereich. */
function zeilenGrenzen(daten, b, h, von, bis) {
  let oben = h, unten = -1;
  for (let y = 0; y < h; y++) {
    for (let x = von; x <= bis; x++) {
      if (daten[(y * b + x) * 4 + 3] > 8) { if (y < oben) oben = y; if (y > unten) unten = y; break; }
    }
  }
  return [oben, unten];
}

async function schneiden(blatt, typ, opts) {
  const roh = sharp(blatt).ensureAlpha();
  const { data, info } = await roh.raw().toBuffer({ resolveWithObject: true });
  const b = info.width, h = info.height;
  const daten = grundEntfernen(Buffer.from(data), b, h);
  const posen = posenFinden(daten, b, h, opts.anzahl, opts.grenzen);
  console.log(path.basename(blatt) + ': ' + posen.length + ' Posen gefunden');
  posen.forEach((p, i) => {
    const [o, u] = zeilenGrenzen(daten, b, h, p[0], p[1]);
    console.log('  Pose ' + i + ': x ' + p[0] + '-' + p[1] + ', y ' + o + '-' + u);
  });
  const wahl = String(opts.posen).split(',').map(Number);
  if (wahl.some((i) => !posen[i])) throw new Error('Pose fehlt: ' + opts.posen + ' bei ' + posen.length + ' Posen');
  if (opts.trocken) return;

  const ziel = path.join(opts.nach, typ);
  fs.mkdirSync(ziel, { recursive: true });
  const ganz = sharp(daten, { raw: { width: b, height: h, channels: 4 } });
  for (let n = 0; n < wahl.length; n++) {
    const p = posen[wahl[n]];
    const [o, u] = zeilenGrenzen(daten, b, h, p[0], p[1]);
    const rand = 4;
    const links = Math.max(0, p[0] - rand), oben = Math.max(0, o - rand);
    const breite = Math.min(b - links, p[1] - p[0] + 1 + rand * 2);
    const hoehe = Math.min(h - oben, u - o + 1 + rand * 2);
    const bild = await ganz.clone()
      .extract({ left: links, top: oben, width: breite, height: hoehe })
      .resize({ height: opts.hoehe, fit: 'inside' })
      .png().toBuffer();
    fs.writeFileSync(path.join(ziel, 'right' + n + '.png'), bild);
    fs.writeFileSync(path.join(ziel, 'left' + n + '.png'), await sharp(bild).flop().png().toBuffer());
  }
  console.log('  geschrieben: ' + ziel + '/{right,left}0-' + (wahl.length - 1) + '.png');
}

const blatt = process.argv[2], typ = process.argv[3];
if (!blatt || !typ || blatt.startsWith('--')) {
  console.log('Aufruf: node tools/spritesSchneiden.js <blatt> <typ> [--posen 0,2,3] [--hoehe 256]');
  process.exit(1);
}
schneiden(blatt, typ, {
  posen: arg('posen', '0,2,3'),
  anzahl: Number(arg('anzahl', 4)),
  grenzen: arg('grenzen', null),
  hoehe: Number(arg('hoehe', 256)),
  nach: arg('nach', 'assets/enemy'),
  trocken: process.argv.includes('--trocken')
}).catch((e) => { console.error(e.message); process.exit(2); });
