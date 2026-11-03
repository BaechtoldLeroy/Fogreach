/**
 * tools/finaleBilderBauen.js — die Bilder des Finales an der Esse aus den
 * PixelLab-Rohbildern legen (tools/rohbilder/finale/).
 *
 * Tableaus (create_image_pro 384x192, Stilbild: ein Bruchnacht-Tableau):
 *   <name>_roh.png  ->  assets/sprites/finale/tableau_<name>.png (unbearbeitet)
 *
 * Figuren (Charaktere aus dem Hub, Richtung suedost = "nach rechts"):
 *   harren/        rot, gehen0..7 (Vorlage sad-walk), fall0..6 (falling-back-death)
 *   mara/          rot, gehen0..5 (walking-6-frames)
 *   Beide gehen dazu in den uebrigen sieben Richtungen (dieselbe Vorlage,
 *   dieselbe Animationsgruppe): gehen_<r>0..N, r = s sw w nw n no o;
 *   gehen0..N ohne Kuerzel bleibt suedost.
 *   elara/         rot, besessen0..8 (v3, 92 px)
 *   elara_kniend/  rot (Zustand "Kniend"), atmen0..4 (v3, 88 px)
 *   ->  assets/sprites/finale/figuren/<figur>/<bild>.png
 * Alle Bilder EINER Figur bekommen denselben Ausschnitt (Vereinigung der
 * Umrisse; verschieden grosse Leinwaende mittig uebereinander, so legt
 * PixelLab sie an), damit die Figur beim Wechsel nicht springt. Ausgegeben
 * wird je Figur, wo im Ausschnitt die stehende Figur sitzt: das braucht
 * js/finale.js (FIGUREN) fuer Ursprung und Groesse.
 * Vom Fall bleiben fall2..6: die ersten beiden Vorlagenbilder stehen frontal
 * geduckt und passen nicht an den Stoss.
 *
 * Objekte (create_1_direction_object 48 px, ausgewaehlter Kandidat):
 *   hammer_objekt_roh.png  ->  assets/finale/hammer.png
 *   klinge_objekt_roh.png  ->  assets/finale/klinge.png, dazu die Gravur:
 *                              drei ineinandergreifende Ketten (das Zeichen)
 *                              auf der Klinge ueber der Parierstange.
 *
 * Der Daemon an der Esse (create_image_pro 128x128, animate_image 8 Bilder):
 *   daemon/wabern1..8.png  ->  assets/finale/daemon.png (Streifen, je 128x128)
 *
 *   node tools/finaleBilderBauen.js          (alles)
 *   node tools/finaleBilderBauen.js daemon   (nur der Daemon)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROH = path.join(__dirname, 'rohbilder', 'finale');
const ASSETS = path.join(__dirname, '..', 'assets');
const TABLEAUS = ['hammer', 'lene', 'stoss', 'esse', 'bruch', 'urteil', 'verschonen', 'richten'];
// Die Gehrichtungen neben suedost (Kuerzel wie GEH_RICHTUNGEN in js/finale.js).
const RICHTUNGEN = ['s', 'sw', 'w', 'nw', 'n', 'no', 'o'];
function gehen(n) {
  const raus = [];
  for (let i = 0; i < n; i++) raus.push(['gehen' + i, 'gehen' + i]);
  RICHTUNGEN.forEach((r) => { for (let i = 0; i < n; i++) raus.push(['gehen_' + r + i, 'gehen_' + r + i]); });
  return raus;
}
// Figur -> [Rohbild, Zielname]
const FIGUREN = {
  harren: [['rot', 'stand']].concat(gehen(8), [2, 3, 4, 5, 6].map((i, k) => ['fall' + i, 'fall' + k])),
  mara: [['rot', 'stand']].concat(gehen(6)),
  elara: [['rot', 'stand']].concat([1, 2, 3, 4, 5, 6, 7, 8].map((i, k) => ['besessen' + i, 'besessen' + k])),
  elara_kniend: [['rot', 'stand']].concat([1, 2, 3, 4].map((i, k) => ['atmen' + i, 'atmen' + k]))
};

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
  const P = 96;
  const gross = await sharp(datei).ensureAlpha()
    .extend({ top: P, bottom: P, left: P, right: P, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  await sharp(gross).extract({ left: links + P, top: oben + P, width: w, height: h })
    .png({ compressionLevel: 9 }).toFile(ziel);
}

async function tableau(name) {
  const quelle = path.join(ROH, name + '_roh.png');
  if (!fs.existsSync(quelle)) { console.log('FEHLT', quelle); return; }
  fs.mkdirSync(path.join(ASSETS, 'sprites', 'finale'), { recursive: true });
  // Neu kodiert: gleiche Bildpunkte, keine Text-Metadaten.
  await sharp(quelle).png({ compressionLevel: 9 }).toFile(path.join(ASSETS, 'sprites', 'finale', 'tableau_' + name + '.png'));
}

async function figur(name) {
  const liste = FIGUREN[name].filter(([r]) => fs.existsSync(path.join(ROH, name, r + '.png')));
  const dateien = liste.map(([r]) => path.join(ROH, name, r + '.png'));
  const bilder = await Promise.all(dateien.map(roh));
  const W = Math.max(...bilder.map((b) => b.w)), H = Math.max(...bilder.map((b) => b.h));
  const vers = bilder.map((b) => ({ dx: Math.round((W - b.w) / 2), dy: Math.round((H - b.h) / 2) }));
  const u = bilder.map((b, i) => umriss(b, vers[i].dx, vers[i].dy));
  const x0 = Math.min(...u.map((r) => r.x0)), y0 = Math.min(...u.map((r) => r.y0));
  const x1 = Math.max(...u.map((r) => r.x1)), y1 = Math.max(...u.map((r) => r.y1));
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const ordner = path.join(ASSETS, 'sprites', 'finale', 'figuren', name);
  fs.mkdirSync(ordner, { recursive: true });
  for (let i = 0; i < dateien.length; i++) {
    await schneiden(dateien[i], x0 - vers[i].dx, y0 - vers[i].dy, w, h, path.join(ordner, liste[i][1] + '.png'));
  }
  // Die stehende Figur (Bild 0) im Ausschnitt: Mitte und Hoehe.
  const s = u[0];
  const mitteX = ((s.x0 + s.x1) / 2 - x0 + 0.5) / w, mitteY = ((s.y0 + s.y1) / 2 - y0 + 0.5) / h;
  console.log(name.padEnd(13), w + 'x' + h, 'Bilder', dateien.length,
    '{ ursprung: [' + mitteX.toFixed(3) + ', ' + mitteY.toFixed(3) + '], hoehe: ' + (s.y1 - s.y0 + 1) + ' }');
}

async function objekt(roh_, ziel, nachbearbeiten) {
  const datei = path.join(ROH, roh_);
  const b = await roh(datei);
  if (nachbearbeiten) nachbearbeiten(b);
  const r = umriss(b, 0, 0);
  const buf = await sharp(b.data, { raw: { width: b.w, height: b.h, channels: 4 } }).png().toBuffer();
  await sharp(buf).extract({ left: r.x0, top: r.y0, width: r.x1 - r.x0 + 1, height: r.y1 - r.y0 + 1 })
    .png({ compressionLevel: 9 }).toFile(path.join(ASSETS, 'finale', ziel));
  console.log(ziel.padEnd(13), (r.x1 - r.x0 + 1) + 'x' + (r.y1 - r.y0 + 1));
}

// Die Gravur auf Elaras Klinge: drei Ringe (je 4x4, rund, hohl), zwei unten,
// einer darueber, ineinandergreifend. Klingenbreite im Rohbild: Spalten 21..26.
// Linke obere Ecke je Ring; der obere wird zuletzt gezogen (liegt vorn).
const RINGE = [[21, 13], [23, 13], [22, 10]];
const RING = ['.##.', '#..#', '#..#', '.##.'];
function gravur(b) {
  const setze = (x, y, c) => {
    const i = (y * b.w + x) * 4;
    if (b.data[i + 3] < 10) return;   // nur auf der Klinge
    b.data[i] = c[0]; b.data[i + 1] = c[1]; b.data[i + 2] = c[2]; b.data[i + 3] = 255;
  };
  RINGE.forEach(([x0, y0]) => {
    RING.forEach((zeile, dy) => {
      for (let dx = 0; dx < 4; dx++) {
        if (zeile[dx] !== '#') continue;
        // Oben/links hell, unten/rechts dunkler: eingeschnitten statt aufgemalt.
        setze(x0 + dx, y0 + dy, dy < 2 && dx < 3 ? [236, 200, 108] : [170, 130, 58]);
      }
    });
  });
}

// Der Daemon, der der Esse entweicht (js/finaleHandwerk.js, DAEMON_*):
// daemon/wabern1..N.png (animate_image auf create_image_pro, 128x128; wabern0
// ist das Ausgangsbild und schliesst die Schleife nicht sauber) ->
// ein waagrechter Streifen assets/finale/daemon.png, Bild fuer Bild 128x128
// (ungeschnitten: so bleibt der Schwerpunkt ueber alle Bilder gleich).
async function daemon() {
  const ordner = path.join(ROH, 'daemon');
  const dateien = [];
  for (let i = 1; fs.existsSync(path.join(ordner, 'wabern' + i + '.png')); i++) dateien.push(path.join(ordner, 'wabern' + i + '.png'));
  if (!dateien.length) { console.log('FEHLT', ordner); return; }
  const S = 128;
  const teile = await Promise.all(dateien.map(async (d, i) => ({
    input: await sharp(d).ensureAlpha().resize(S, S, { fit: 'contain', kernel: 'nearest', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
    left: i * S, top: 0
  })));
  await sharp({ create: { width: S * dateien.length, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(teile).png({ compressionLevel: 9 }).toFile(path.join(ASSETS, 'finale', 'daemon.png'));
  console.log('daemon.png'.padEnd(13), (S * dateien.length) + 'x' + S, 'Bilder', dateien.length);
}

(async () => {
  // node tools/finaleBilderBauen.js daemon: nur den Daemon neu legen.
  if (process.argv[2] === 'daemon') { await daemon(); return; }
  for (const t of TABLEAUS) await tableau(t);
  await daemon();
  for (const f of Object.keys(FIGUREN)) await figur(f);
  await objekt('hammer_objekt_roh.png', 'hammer.png');
  await objekt('klinge_objekt_roh.png', 'klinge.png', gravur);
})().catch((e) => { console.error(e); process.exit(1); });
