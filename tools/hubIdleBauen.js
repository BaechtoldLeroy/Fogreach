/**
 * tools/hubIdleBauen.js — Idle-Schleife eines Hub-NPC deckungsgleich zum Standbild ablegen (#194).
 *
 * Die Standbilder der Hub-Figuren (assets/sprites/*.png, assets/npc/<x>/right0)
 * sind aus einer PixelLab-Rotation ZUGESCHNITTEN (tools/hubBauen.js). Die
 * Idle-Animation (animate_character, pixminimax) liegt auf der Leinwand des
 * Charakters. Damit die Figur beim Wechsel Standbild -> Schleife weder springt
 * noch waechst, bekommt jedes Bild GENAU den Ausschnitt des Standbilds:
 *
 *   1. Das Standbild wird in Bild 0 der Animation gesucht (dort steht der
 *      Startrahmen selbst) — wie in tools/gegnerLaufBauen.js.
 *   2. Mit diesem Versatz werden die Bilder 0..7 ausgeschnitten, in der Groesse
 *      des Standbilds. Bild 8 ist das Schlussbild = Startbild und faellt weg
 *      (Schleife: erstes = letztes).
 *   3. Bild 0 wird durch das Standbild selbst ersetzt — pixelgleich, auch wenn
 *      der Startrahmen umgefaerbt war (Branka, #187).
 *   4. Was ueber den Ausschnitt ragt, wird gezaehlt und gemeldet.
 *
 * Abgelegt wird EIN Streifen <ziel>.png (Bilder nebeneinander, je so gross wie
 * das Standbild), den der Hub als Spritesheet laedt.
 *
 *   node tools/hubIdleBauen.js --alle      (die ausgelieferte Auswahl, siehe AUSWAHL)
 *   node tools/hubIdleBauen.js <standbild.png> <ordner-mit-f0..f8> <ziel.png> [--praefix v1_f]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DECKT = 24;
const BILDER = 8;

function arg(name, vorgabe) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? vorgabe : process.argv[i + 1];
}

async function roh(bild) {
  const { data, info } = await sharp(bild).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: data, w: info.width, h: info.height };
}

/** Anteil der deckenden Pixel, die in Lage UND Farbe uebereinstimmen. */
function gleichheit(a, b, ox, oy, nurUmriss) {
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
      if (da && db && (nurUmriss || Math.abs(a.d[ia] - b.d[ib]) + Math.abs(a.d[ia + 1] - b.d[ib + 1])
        + Math.abs(a.d[ia + 2] - b.d[ib + 2]) < 12)) gut++;
    }
  }
  return n ? gut / n : 0;
}

/** Wo liegt das Standbild in Bild 0? Erst Farbe, bei Umfaerbung zaehlt der Umriss. */
function lageFinden(still, bild) {
  let beste = { s: -1 };
  for (let oy = -2; oy <= bild.h - still.h + 2; oy++) {
    for (let ox = -2; ox <= bild.w - still.w + 2; ox++) {
      const s = gleichheit(still, bild, ox, oy, false) + 0.001 * gleichheit(still, bild, ox, oy, true);
      if (s > beste.s) beste = { s, ox, oy };
    }
  }
  return beste;
}

/**
 * Kleinster Schub (+-4 px), mit dem das untere Viertel des Bildes (Beine und
 * Fuesse) am besten auf dem des Standbilds liegt. Verglichen wird nur der
 * Umriss: die Farben flackern von Bild zu Bild leicht.
 */
function fussAbgleich(still, b, ox, oy) {
  const ab = Math.floor(still.h * 0.75);
  let beste = { s: -1, dx: 0, dy: 0 };
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      let gut = 0, n = 0;
      for (let y = ab; y < still.h; y++) {
        for (let x = 0; x < still.w; x++) {
          const da = still.d[(y * still.w + x) * 4 + 3] > DECKT;
          const bx = x + ox + dx, by = y + oy + dy;
          const db = bx >= 0 && by >= 0 && bx < b.w && by < b.h && b.d[(by * b.w + bx) * 4 + 3] > DECKT;
          if (!da && !db) continue;
          n++;
          if (da && db) gut++;
        }
      }
      // Bei Gleichstand gewinnt der kleinere Schub.
      const s = (n ? gut / n : 0) - 0.0001 * (Math.abs(dx) + Math.abs(dy));
      if (s > beste.s) beste = { s, dx, dy };
    }
  }
  return beste;
}

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

async function ausschneiden(datei, ox, oy, w, h) {
  // Rand anfuegen, damit ein Ausschnitt ueber die Leinwand hinaus moeglich ist.
  const R = Math.max(w, h);
  const weit = await sharp(datei).ensureAlpha()
    .extend({ left: R, right: R, top: R, bottom: R, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  return sharp(weit).extract({ left: ox + R, top: oy + R, width: w, height: h }).png().toBuffer();
}

async function bauen(standbild, ordner, ziel, praefix) {
  const still = await roh(standbild);
  const datei = (i) => path.join(ordner, praefix + i + '.png');
  const lage = lageFinden(still, await roh(datei(0)));
  const teile = [{ input: await sharp(standbild).ensureAlpha().png().toBuffer(), left: 0, top: 0 }];
  const ueber = [];
  const schub = [];
  for (let i = 1; i < BILDER; i++) {
    const b = await roh(datei(i));
    // pixminimax laesst die Figur gern ein paar Pixel wandern. Im Idle stehen
    // die Fuesse still: jedes Bild an den Beinen des Standbilds ausrichten.
    const f = fussAbgleich(still, b, lage.ox, lage.oy);
    schub.push(f.dx + '/' + f.dy);
    ueber.push(ueberstand(b, lage.ox + f.dx, lage.oy + f.dy, still.w, still.h));
    teile.push({ input: await ausschneiden(datei(i), lage.ox + f.dx, lage.oy + f.dy, still.w, still.h), left: i * still.w, top: 0 });
  }
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  await sharp({ create: { width: still.w * BILDER, height: still.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(teile).png().toFile(ziel);
  return { lage, ueber, schub, w: still.w, h: still.h };
}

/**
 * Die ausgelieferte Auswahl (#194): Rohbilder unter tools/rohbilder/hubidle/<ordner>/,
 * v1 = erster Wurf, v2 = neu gewuerfelt mit Endbild = Startbild (schliesst die
 * Schleife). PixelLab-Charaktere und Gesten stehen im Commit zu #194.
 */
const AUSWAHL = [
  // ordner, Standbild, Streifen, Wurf
  ['branka', 'assets/sprites/schmiedemeisterin.png', 'schmiedemeisterin', 'v2_f'],
  ['thom', 'assets/sprites/setzer_thom.png', 'setzer_thom', 'v1_f'],
  ['mara', 'assets/sprites/spaeherin.png', 'spaeherin', 'v1_f'],
  ['aldric', 'assets/npc/aldric/right0.png', 'aldric', 'v2_f'],
  ['elara', 'assets/npc/elara/right0.png', 'elara', 'v2_f'],
  ['harren', 'assets/npc/harren/right0.png', 'harren', 'v1_f'],
  ['klerus', 'assets/sprites/klerus.png', 'klerus', 'v1_f'],
  ['garde', 'assets/sprites/garde.png', 'garde', 'v2_f'],
  ['buerger', 'assets/sprites/buerger.png', 'buerger', 'v2_f'],
  ['patrouille', 'assets/sprites/patrouille.png', 'patrouille', 'v2_f'],
  ['vorleser_frau', 'assets/sprites/vorleser_frau.png', 'vorleser_frau', 'v2_f'],
  ['vorleser_alter', 'assets/sprites/vorleser_alter.png', 'vorleser_alter', 'v1_f'],
  ['vorleser_junge', 'assets/sprites/vorleser_junge.png', 'vorleser_junge', 'v2_f']
];

module.exports = { bauen, AUSWAHL };

function melden(ziel, r) {
  console.log(path.basename(ziel) + ': ' + r.w + 'x' + r.h + ' x' + BILDER
    + ', Lage ' + r.lage.ox + '/' + r.lage.oy + ' (Treffer ' + (r.lage.s * 100).toFixed(1) + ' %)'
    + ', Fussabgleich ' + r.schub.join(' ') + ', ueber dem Rand je Bild: ' + r.ueber.join(' '));
}

if (require.main === module) {
  (async () => {
    if (process.argv.includes('--alle')) {
      for (const [ordner, standbild, name, praefix] of AUSWAHL) {
        const ziel = 'assets/sprites/hubidle/' + name + '_idle.png';
        melden(ziel, await bauen(standbild, path.join('tools/rohbilder/hubidle', ordner), ziel, praefix));
      }
      return;
    }
    const [standbild, ordner, ziel] = process.argv.slice(2);
    melden(ziel, await bauen(standbild, ordner, ziel, arg('praefix', 'v1_f')));
  })();
}
