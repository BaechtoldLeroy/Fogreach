/**
 * tools/gegnerLaufBauen.js — Laufbilder eines Gegners deckungsgleich zur Ruhepose ablegen (#170).
 *
 * Die ausgelieferten Bilder (assets/enemy/<typ>/right0..2) sind aus der
 * south-east-Rotation eines PixelLab-Charakters ZUGESCHNITTEN (tools/
 * gegnerBauen.js, gemeinsame Box ueber die drei Posen). Laufbilder kommen aus
 * einer Animation desselben Charakters und liegen auf dessen Leinwand. Damit
 * die Figur beim Wechsel Ruhe -> Lauf nicht springt, muss jedes Laufbild
 * GENAU denselben Ausschnitt bekommen wie right0:
 *
 *   1. right0 wird im ersten Laufbild gesucht (dort steht die Rotation selbst,
 *      PixelLab legt sie als Bild 0 ab) — pixelgenau, sonst Abbruch.
 *   2. Dieser Versatz schneidet ALLE Laufbilder aus, in der Groesse von right0.
 *      Gleiche Groesse heisst: gleicher Ursprung und gleiche Skalierung im
 *      Spiel, der Body verrutscht nicht.
 *   3. Was dabei ueber den Rand ragt, wird gezaehlt und gemeldet.
 *
 *   node tools/gegnerLaufBauen.js <typ> <bild0> <bild1> ... [--nach assets/enemy] [--frei]
 *
 * Geschrieben werden walk_right<N>.png und gespiegelt walk_left<N>.png —
 * left ist auch bei right0..2 die Spiegelung.
 *
 * --frei: Bild 0 muss right0 nicht pixelgenau gleichen (z. B. wenn die
 * Animation aus einem freien Bild entstand); es gilt die beste Lage.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function arg(name, vorgabe) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? vorgabe : process.argv[i + 1];
}

async function roh(bild) {
  const { data, info } = await sharp(bild).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: data, w: info.width, h: info.height };
}

const DECKT = 24;   // Alpha-Schwelle wie in gegnerBauen.js

function linksOben(b) {
  let mx = Infinity, my = Infinity;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (b.d[(y * b.w + x) * 4 + 3] <= DECKT) continue;
      if (x < mx) mx = x;
      if (y < my) my = y;
    }
  }
  return [mx, my];
}

/** Anteil der deckenden Pixel, die in Lage UND Farbe uebereinstimmen. */
function gleichheit(a, b, ox, oy) {
  let gut = 0, n = 0;
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      const ia = (y * a.w + x) * 4;
      const da = a.d[ia + 3] > DECKT;
      const bx = x + ox, by = y + oy;
      let db = false, ib = -1;
      if (bx >= 0 && by >= 0 && bx < b.w && by < b.h) { ib = (by * b.w + bx) * 4; db = b.d[ib + 3] > DECKT; }
      if (!da && !db) continue;
      n++;
      if (da && db && Math.abs(a.d[ia] - b.d[ib]) + Math.abs(a.d[ia + 1] - b.d[ib + 1])
        + Math.abs(a.d[ia + 2] - b.d[ib + 2]) < 12) gut++;
    }
  }
  return n ? gut / n : 0;
}

/** Wo liegt right0 im Laufbild? Grobe Lage ueber die Inhaltsgrenzen, dann fein. */
function lageFinden(ruhe, bild) {
  const [ax, ay] = linksOben(ruhe), [bx, by] = linksOben(bild);
  let beste = { s: -1 };
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const ox = bx - ax + dx, oy = by - ay + dy;
      const s = gleichheit(ruhe, bild, ox, oy);
      if (s > beste.s) beste = { s, ox, oy };
    }
  }
  return beste;
}

/** Deckende Pixel des Bildes ausserhalb des Ausschnitts. */
function ueberstand(b, ox, oy, w, h) {
  let n = 0;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (b.d[(y * b.w + x) * 4 + 3] <= DECKT) continue;
      if (x < ox || y < oy || x >= ox + w || y >= oy + h) n++;
    }
  }
  return n;
}

function grenzen(b) {
  let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (b.d[(y * b.w + x) * 4 + 3] <= DECKT) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Kleinste Verschiebung, mit der der Inhalt [lo, hi] ins Fenster [a, a+n)
 * passt. Passt er ohnehin, bleibt es bei 0 — die Figur steht dann genau wie
 * in der Animation. Ist er groesser als das Fenster, bleibt die Lage — nur
 * mit `unten` wird die Unterkante (die Fuesse) hereingeholt; was dann oben
 * ueberragt (Funken, Haarspitzen), faellt weg. Mittig setzen hiesse, die
 * Figur gegen die Ruhepose zu verschieben.
 */
function schubFuer(lo, hi, a, n, unten) {
  if (hi - lo + 1 > n) return (unten && hi > a + n - 1) ? hi - (a + n - 1) : 0;
  if (lo < a) return lo - a;
  if (hi > a + n - 1) return hi - (a + n - 1);
  return 0;
}

async function ausschneiden(datei, ox, oy, w, h) {
  // Rand anfuegen, damit ein Ausschnitt ueber die Leinwand hinaus moeglich ist.
  // Zwei Schritte: sharp zieht extract sonst VOR extend vor.
  const R = Math.max(w, h);
  const weit = await sharp(datei).ensureAlpha()
    .extend({ left: R, right: R, top: R, bottom: R, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  return sharp(weit).extract({ left: ox + R, top: oy + R, width: w, height: h }).png().toBuffer();
}

(async () => {
  const typ = process.argv[2];
  const bilder = [];
  for (let i = 3; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--frei') continue;
    if (a.startsWith('--')) { i++; continue; }
    bilder.push(a);
  }
  const nach = arg('nach', 'assets/enemy');
  const frei = process.argv.includes('--frei');
  if (!typ || bilder.length < 2) {
    console.error('Aufruf: node tools/gegnerLaufBauen.js <typ> <bild0> <bild1> ... [--nach <ordner>] [--frei]');
    process.exit(1);
  }
  const ordner = path.join(nach, typ);
  const ruhe = await roh(path.join(ordner, 'right0.png'));
  const erstes = await roh(bilder[0]);
  const lage = lageFinden(ruhe, erstes);
  console.log(typ + ': right0 ' + ruhe.w + 'x' + ruhe.h + ' liegt bei ' + lage.ox + ',' + lage.oy
    + ' (Gleichheit ' + lage.s.toFixed(3) + ')');
  if (lage.s < 0.98 && !frei) {
    throw new Error('Bild 0 gleicht right0 nicht — falscher Charakter? (--frei erzwingt)');
  }

  // Alle Laufbilder auf derselben Leinwand? Sonst stimmt der Versatz nicht.
  for (const b of bilder) {
    const m = await sharp(b).metadata();
    if (m.width !== erstes.w || m.height !== erstes.h) {
      throw new Error(b + ' hat ' + m.width + 'x' + m.height + ', Bild 0 aber ' + erstes.w + 'x' + erstes.h);
    }
  }

  // Alte Laufbilder entfernen: ein kuerzerer Satz liesse sonst Reste stehen.
  for (const f of fs.readdirSync(ordner)) {
    if (/^walk_(right|left)\d+\.png$/.test(f)) fs.unlinkSync(path.join(ordner, f));
  }

  // Ragt ein Laufbild ueber den Ausschnitt (die Figur wippt nach unten, ein
  // Bein greift weiter aus als jede Pose), wird das Fenster fuer DIESES Bild
  // gerade so weit geschoben, dass alles hineinpasst — sonst fehlten Fuesse.
  // Der Rahmen selbst darf nicht wachsen: eine andere Bildgroesse verschoebe
  // im Spiel Ursprung und Body gegen die Ruhepose.
  // Animationen zeichnen die Figur manchmal mitten im Gang groesser. Das
  // faellt im Bogen kaum auf, im Spiel als Pumpen — darum hier melden.
  const g0 = grenzen(erstes);
  const h0 = g0.maxY - g0.minY + 1, b0 = g0.maxX - g0.minX + 1;
  for (let i = 0; i < bilder.length; i++) {
    const r = await roh(bilder[i]);
    const g = grenzen(r);
    const h = g.maxY - g.minY + 1, b = g.maxX - g.minX + 1;
    if (Math.abs(h - h0) / h0 > 0.08) {
      console.log('  WARNUNG Bild ' + i + ': Hoehe ' + h + ' statt ' + h0 + ' (Breite ' + b + ' statt ' + b0 + ')');
    }
    const sx = schubFuer(g.minX, g.maxX, lage.ox, ruhe.w);
    const sy = schubFuer(g.minY, g.maxY, lage.oy, ruhe.h, true);
    const ab = ueberstand(r, lage.ox + sx, lage.oy + sy, ruhe.w, ruhe.h);
    const stueck = await ausschneiden(bilder[i], lage.ox + sx, lage.oy + sy, ruhe.w, ruhe.h);
    fs.writeFileSync(path.join(ordner, 'walk_right' + i + '.png'), stueck);
    fs.writeFileSync(path.join(ordner, 'walk_left' + i + '.png'), await sharp(stueck).flop().png().toBuffer());
    if (sx || sy) console.log('  Bild ' + i + ': um ' + sx + ',' + sy + ' nachgefuehrt');
    if (ab) console.log('  Bild ' + i + ': ' + ab + ' Pixel ragen trotzdem ueber und fallen weg');
  }
  console.log(typ + ': ' + (bilder.length * 2) + ' Laufbilder nach ' + ordner);
})().catch((e) => { console.error('Fehler: ' + e.message); process.exit(1); });
