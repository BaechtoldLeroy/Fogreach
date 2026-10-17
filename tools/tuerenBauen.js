// tools/tuerenBauen.js — schneidet aus den PixelLab-Rohbildern (tools/rohbilder/tueren/)
// den Bausatz der Kellertore nach assets/sprites/tueren/.
//
//   waag_2.png  Tor von vorn, 128x64   (create_image_pro e4f953ad…, Kandidat 2)
//   senk_*.png  Tor von der Seite      (siehe SENK unten)
//
// Ein Tor ist 4-6 Kacheln lang (128/160/192 px). Damit nichts gestreckt wird,
// besteht es aus Stuecken, die doorSystem.js zur Laufzeit aneinandersetzt:
//
//   links | fuellL* | mitte | fuellR* | rechts
//
// links/rechts tragen die Steinpfosten, mitte das Schloss und die Ketten,
// fuell* sind 16 px Bohlen mit durchlaufenden Baendern — 0, 1 oder 2 je Seite.
// Die Schnitte liegen auf den dunklen Bohlenfugen, dort faellt die Naht nicht auf.
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const ROH = path.join(__dirname, 'rohbilder', 'tueren');
const ZIEL = path.join(__dirname, '..', 'assets', 'sprites', 'tueren');

// Als Puffer: node-canvas oeffnet Pfade mit Umlaut (LeroyBächtold) nicht.
async function bild(name) { return loadImage(fs.readFileSync(path.join(ROH, name))); }

function leinwand(img) {
  const c = createCanvas(img.width, img.height); const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  return c;
}

/** Rechteck (x, y, w, h) aus einer Leinwand als neue Leinwand. */
function schnitt(src, x0, y0, w, h) {
  const c = createCanvas(w, h);
  c.getContext('2d').drawImage(src, x0, y0, w, h, 0, 0, w, h);
  return c;
}

/** Zeilen [von, von+n) innerhalb der Spalten [x0, x1) durch die Zeilen ab quelle ersetzen. */
function zeilenKopieren(c, x0, x1, quelle, von, n) {
  const x = c.getContext('2d');
  const d = x.getImageData(x0, quelle, x1 - x0, n);
  x.putImageData(d, x0, von);
}

function speichern(c, name) {
  fs.writeFileSync(path.join(ZIEL, name), c.toBuffer('image/png'));
  console.log(name, c.width + 'x' + c.height);
}

(async () => {
  fs.mkdirSync(ZIEL, { recursive: true });

  // ── Von vorn (waagerechte Wand) ─────────────────────────────────────────
  // Gemessen in waag_2: Pfosten 0..19 und 108..127, Bohlenfugen bei 24, 32, …,
  // 56 | Naht 63/64 | 71, 79, …, 103. Baender in den Zeilen 10-15, 31-36,
  // 52-57; dazwischen Bohlen (16-30 und 37-51, je 15 Zeilen). Die Kette haengt
  // im unteren Bohlenfeld. Ein Fuellstueck traegt sie nicht — dort wird das
  // untere Feld aus dem oberen kopiert (gleiche Bohlen, gleiche Nieten).
  const w = leinwand(await bild('waag_2.png'));
  const ohneKette = (c, x0, x1) => zeilenKopieren(c, x0, x1, 10, 31, 21);

  const links = schnitt(w, 0, 0, 24, 64);
  ohneKette(links, 20, 24);              // Kettenstummel am Pfosten weg
  const mitte = schnitt(w, 24, 0, 79, 64);
  const rechts = schnitt(w, 103, 0, 25, 64);
  ohneKette(rechts, 1, 5);
  const fuellL = schnitt(w, 40, 0, 16, 64); ohneKette(fuellL, 0, 16);
  const fuellR = schnitt(w, 71, 0, 16, 64); ohneKette(fuellR, 0, 16);

  // Die Kette endet jetzt an der Schnittkante: ein Messingnagel haelt sie dort.
  const nagel = (c, x0, y0) => {
    const x = c.getContext('2d');
    x.fillStyle = '#1a120a'; x.fillRect(x0 - 1, y0 - 1, 4, 4);
    x.fillStyle = '#b08a3e'; x.fillRect(x0, y0, 2, 2);
    x.fillStyle = '#e0c070'; x.fillRect(x0, y0, 1, 1);
  };
  nagel(mitte, 1, 36);
  nagel(mitte, 76, 36);

  speichern(links, 'tor_waag_links.png');
  speichern(mitte, 'tor_waag_mitte.png');
  speichern(rechts, 'tor_waag_rechts.png');
  speichern(fuellL, 'tor_waag_fuell_l.png');
  speichern(fuellR, 'tor_waag_fuell_r.png');

  // ── Von der Seite (senkrechte Wand) ─────────────────────────────────────
  // Die Kamera schaut die Torflaeche hier von der Kante an: zu sehen ist nur
  // die Oberkante der Fluegel als Balken, daneben die Kette. Aus senkB_0
  // (create_image_pro 214de5a7…, Kandidat 0) kommt dieser Balken (Spalten
  // 26-33, Kette 34-37, Naht der Fluegel bei Zeile 64). Die Schwellsteine des
  // Rohbilds fallen weg — offen soll man den Boden des Raums sehen, und
  // geklappt sahen sie wie dunkle Riegel quer im Durchgang aus.
  //
  // Das Tor fuellt die Wandtiefe trotzdem: die Pfosten sind dieselben Steine
  // wie von vorn, um 90 Grad gedreht, also 64 breit und 20 tief.
  const roh = leinwand(await bild('senkB_0.png'));
  const s = createCanvas(64, 128); const sx = s.getContext('2d');

  // Balken doppelt so dick wie im Rohbild (ein schweres Tor): Aussenkante,
  // Innenleben zweimal, Aussenkante und Kette. Laengs gemasert, darum faellt
  // die Wiederholung nicht auf. Zeilen 21..108 -> Naht genau auf Zeile 63/64.
  const spalten = [26, 27, 28, 29, 30, 31, 32, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38];
  spalten.forEach((q, i) => sx.drawImage(roh, q, 21, 1, 88, 22 + i, 20, 1, 88));

  // Pfosten: oben der linke, unten der rechte Pfosten des Tors von vorn,
  // im Uhrzeigersinn gedreht — die freie Kante zeigt jeweils nach aussen.
  const pfosten = (x0, yZiel) => {
    sx.save(); sx.translate(64, yZiel); sx.rotate(Math.PI / 2);
    sx.drawImage(w, x0, 0, 20, 64, 0, 0, 20, 64);
    sx.restore();
  };
  pfosten(0, 0);
  pfosten(108, 108);

  // Messing von Hand: das Rohbild hat keins, das Tor von vorn schon. Zwei
  // Baender ueber der Naht (das Schloss von oben gesehen) und Nieten laengs
  // des Balkens im Abstand der Bohlen.
  const messing = (x0, y0, w0, h0) => {
    sx.fillStyle = '#1a120a'; sx.fillRect(x0 - 1, y0 - 1, w0 + 2, h0 + 2);
    sx.fillStyle = '#8a6a2e'; sx.fillRect(x0, y0, w0, h0);
    sx.fillStyle = '#c9a24f'; sx.fillRect(x0, y0, w0, 1);
  };
  messing(23, 57, 13, 3);
  messing(23, 67, 13, 3);
  messing(23, 21, 13, 2);   // Beschlag am Pfosten
  messing(23, 105, 13, 2);
  for (let y = 28; y < 104; y += 8) {
    if (y >= 52 && y <= 74) continue;
    sx.fillStyle = '#c9a24f'; sx.fillRect(25, y, 1, 1); sx.fillRect(33, y, 1, 1);
  }

  speichern(schnitt(s, 0, 0, 64, 24), 'tor_senk_oben.png');
  speichern(schnitt(s, 0, 24, 64, 79), 'tor_senk_mitte.png');
  speichern(schnitt(s, 0, 103, 64, 25), 'tor_senk_unten.png');
  speichern(schnitt(s, 0, 24, 64, 16), 'tor_senk_fuell_o.png');
  speichern(schnitt(s, 0, 87, 64, 16), 'tor_senk_fuell_u.png');
})().catch((e) => { console.error(e); process.exit(1); });
