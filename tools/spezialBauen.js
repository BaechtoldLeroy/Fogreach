/**
 * tools/spezialBauen.js — die Spezialangriffe des Spielers aus PixelLab holen (#174).
 *
 * Gebaut wie tools/schlagBauen.js (#171). Alle Folgen entstehen am
 * Spielercharakter "Archivsmith Leuchtaugen v2"
 * (f0f26be0-6606-4ce6-a467-bb6ee3092241), Modus pixminimax, acht Bilder.
 * Die Beschreibungen stehen unten bei jedem Angriff.
 *
 * PixelLab liefert je Richtung neun Bilder auf 92x92: Bild 0 ist die Ruhepose,
 * 1..8 die Bewegung. Ins Spiel kommen 1..8:
 *   - gerichtet:   spezial_<angriff>_DD_f00..f07 (DD = dir-Nummer des Spiels)
 *   - richtungslos: spezial_<angriff>_f00..f07 (gezeichnet nach Sueden)
 *
 * Die Rohbilder (alle neun je Richtung) liegen unter
 * tools/rohbilder/spezial/<angriff>/<richtung>/<i>.png. Fehlen sie, holt das
 * Werkzeug sie von PixelLab und legt sie dort ab; danach baut es ohne Netz.
 *
 * Wie bei Rolle und Schlag ist die Leinwand nur GEPOLSTERT (ROLLE_RAND in
 * js/player.js). Den Lageversatz der Ruhepose gegenueber Bild 0 des Gehens
 * derselben Richtung schiebt das Werkzeug heraus (richtungslos: gegen das
 * Gehbild nach Sueden, dir06). Weicht die HOEHE ab, bricht es ab.
 *
 *   node tools/spezialBauen.js [--trocken] [--bogen] [angriff ...]
 *     --trocken  nur messen, nichts schreiben
 *     --bogen    Kontaktbogen je Angriff nach vorschau/spezial_<angriff>.png
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadImage, createCanvas } = require('canvas');

const BASIS = 'https://backblaze.pixellab.ai/file/pixellab-characters/729e817f-23cb-4ab4-a630-63be7d880cfa/f0f26be0-6606-4ce6-a467-bb6ee3092241/animations/';
const RAND = 14;
const BILDER = 8;       // 1..8 der Erzeugung

// dir-Nummer des Spiels -> PixelLab-Richtung (tools/pixellabHolen.js).
const PL = {
  '00': 'west', '01': 'north-west', '02': 'north', '03': 'north-east',
  '04': 'east', '05': 'south-east', '06': 'south', '07': 'south-west'
};

/**
 * Je Angriff: Animation je Richtung. Richtungslose Angriffe haben genau
 * einen Eintrag mit dem Schluessel '' (gezeichnet nach Sueden).
 */
const ANGRIFFE = {
  // Gruppe spezial_wirbel (cc81932b-d319-4631-b70c-604c96040ca3):
  //   "whirlwind spin attack: turns in place one full 360 degree rotation
  //    around his own vertical axis, flail held out at arm's length sweeping
  //    around him; feet stay on the same spot, the last frame faces the
  //    viewer again like the first"
  wirbel: { '': 'ce295a23-1a78-4a9a-b005-00f0ba265f49' },
  // Gruppe spezial_frost (cd0bed86-b650-4874-99fc-99a637b95b7d):
  //   "ground stomp: lifts one knee high, stomps the foot down hard on the
  //    ground while thrusting both arms down and outward to release a
  //    shockwave, holds the low pose briefly, then straightens back up"
  frost: { '': 'c4910c82-fc46-45ce-ba2b-07f990dad806' },
  // Gruppe spezial_zyklon (f64962a8-e4dc-48b4-b391-1c8a0e315a94):
  //   "pulling vortex: spreads both arms wide to the sides, then sweeps them
  //    inward in a circular pulling motion toward his chest ..."
  zyklon: { '': '20b2901d-7af2-4e31-949b-1bf572cfabd2' },
  // Gruppe spezial_hammer (dd94d2cf-85a3-452c-a0a1-f02649c6cb68)
  hammer: {
    '00': '84cefc40-56ce-4509-bce3-534101684b27',
    '01': 'd4d30e7f-623f-442f-b20b-b0850b74efe4',   // spezial_hammer_nord
    '02': 'abc41ea5-54b2-4105-aeb9-d97032ed93ca',   // spezial_hammer_nord2
    '03': '9aa8fbd8-8de4-4a5f-ac6f-3dfb6c1cb1f8',
    '04': 'a9765b09-8411-4047-b439-97211cf45c15',
    '05': 'e392dbe1-ca77-4bd6-be33-1a96e32a7b6c',
    '06': '4864efb0-f8bf-435e-a326-ab2b069f6342',
    '07': 'db3004b7-9a87-4ea0-b446-5c8d835489ec'
  },
  sturm: {
    '00': 'dfa7bc0f-4084-4470-bf10-3d2e93d9ffa1',
    '01': '013e6e82-3d4b-4946-8512-e973418ececb',
    '02': '0a71d0e7-f08e-4739-8e59-ffff64ea673a',
    '03': 'd2a52714-20cb-4f5b-b9c0-52944ae7636b',
    '04': '5a6aaf78-bbcd-44eb-ab6f-8a750a5de9a0',
    '05': '52742a18-90b8-4064-9f1c-bb8a262d6b2e',
    '06': '7cd78001-0519-4ef0-bb93-e41609bbc32b',
    '07': '9d5ed032-1051-410f-b7a1-b9d825801264'
  },
  sprung: {
    '00': 'de056457-aab5-4824-aebf-89c0a1f31626',
    '01': '68fa9540-b7e8-4c0c-abfa-5f64bad52801',
    '02': 'ba7768b0-bd7a-4aab-97ee-136b71862a48',
    '03': '61e6dbba-a03b-4055-b934-5dcce3cb9587',
    '04': '6cb634e5-7468-4dc7-9c61-56de675e8931',
    '05': '0481fca9-2a6a-471e-ad7a-368e0abeee41',
    '06': '85561f97-7fca-4749-b1d4-d3434091de2b',
    '07': '9523a9ab-d10a-49af-8e78-b64dbfaef0bf'
  }
};

const ZIEL = path.join(__dirname, '..', 'assets', 'PlayerSprites');
const ROH = path.join(__dirname, 'rohbilder', 'spezial');
const VORSCHAU = path.join(__dirname, '..', 'vorschau');

/** Rohbild aus dem Lager, sonst von PixelLab (und ins Lager legen). */
async function rohbild(angriff, richtung, anim, i) {
  const datei = path.join(ROH, angriff, richtung, i + '.png');
  // quelle.txt haelt fest, aus welcher Animation die Rohbilder stammen: neu
  // gewuerfelt (andere Animation) heisst neu holen.
  const quelle = path.join(ROH, angriff, richtung, 'quelle.txt');
  const alt = fs.existsSync(quelle) ? fs.readFileSync(quelle, 'utf8').trim() : null;
  if (anim && alt !== anim) {
    fs.rmSync(path.dirname(datei), { recursive: true, force: true });
    fs.mkdirSync(path.dirname(datei), { recursive: true });
    fs.writeFileSync(quelle, anim + '\n');
  }
  if (!fs.existsSync(datei)) {
    if (!anim) throw new Error(angriff + ' ' + richtung + ': weder Rohbild noch Animation');
    const antwort = await fetch(BASIS + anim + '/' + richtung + '/' + i + '.png');
    if (!antwort.ok) throw new Error(antwort.status + ' ' + anim + '/' + richtung + '/' + i);
    fs.mkdirSync(path.dirname(datei), { recursive: true });
    fs.writeFileSync(datei, Buffer.from(await antwort.arrayBuffer()));
  }
  // Ueber den Puffer: node-canvas oeffnet unter Windows keine Pfade mit Umlaut.
  return loadImage(fs.readFileSync(datei));
}

/** Grenzen der Figur (Alpha > 40). */
function grenzen(img) {
  const c = createCanvas(img.width, img.height);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, img.width, img.height).data;
  let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let X = 0; X < img.width; X++) {
      if (d[(y * img.width + X) * 4 + 3] > 40) {
        minX = Math.min(minX, X); maxX = Math.max(maxX, X);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  return { mitteX: (minX + maxX) / 2, fuss: maxY, hoehe: maxY - minY + 1 };
}

function schluessel(angriff, dd, f) {
  return 'spezial_' + angriff + (dd ? '_' + dd : '') + '_f' + String(f).padStart(2, '0');
}

/** Kontaktbogen: je Richtung eine Zeile mit allen neun Rohbildern, doppelt gross. */
function bogen(angriff, zeilen) {
  const Z = 2, S = 92 * Z;
  const c = createCanvas(S * 9 + 60, S * zeilen.length);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.fillStyle = '#26232b'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#e8dcc0'; x.font = '16px monospace';
  zeilen.forEach(({ name, bilder }, r) => {
    x.fillText(name, 4, r * S + 20);
    bilder.forEach((img, i) => {
      x.fillStyle = i ? '#332f38' : '#3d3328';
      x.fillRect(60 + i * S + 1, r * S + 1, S - 2, S - 2);
      x.drawImage(img, 60 + i * S, r * S, S, S);
    });
    x.fillStyle = '#e8dcc0';
  });
  fs.mkdirSync(VORSCHAU, { recursive: true });
  fs.writeFileSync(path.join(VORSCHAU, 'spezial_' + angriff + '.png'), c.toBuffer('image/png'));
}

(async () => {
  const trocken = process.argv.includes('--trocken');
  const mitBogen = process.argv.includes('--bogen');
  const nur = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  let fehler = 0;
  for (const [angriff, richtungen] of Object.entries(ANGRIFFE)) {
    if (nur.length && !nur.includes(angriff)) continue;
    const zeilen = [];
    for (const [dd, anim] of Object.entries(richtungen)) {
      const richtung = PL[dd || '06'];
      let bilder;
      try {
        bilder = [];
        for (let i = 0; i <= BILDER; i++) bilder.push(await rohbild(angriff, richtung, anim, i));
      } catch (e) { console.log(angriff, dd || '--', e.message); fehler++; continue; }
      zeilen.push({ name: dd || 'S', bilder });
      const ruhe = bilder[0];
      const geh = await loadImage(fs.readFileSync(path.join(ZIEL, 'dir' + (dd || '06') + '_f00.png')));
      if (ruhe.width !== geh.width + 2 * RAND) {
        console.log(angriff, dd, 'Leinwand', ruhe.width, 'statt', geh.width + 2 * RAND); fehler++; continue;
      }
      const r = grenzen(ruhe), g = grenzen(geh);
      const dx = r.mitteX - g.mitteX - RAND, dy = r.fuss - g.fuss - RAND;
      const ok = Math.abs(r.hoehe - g.hoehe) <= 3 && Math.abs(dx) <= 6 && Math.abs(dy) <= 6;
      const sx = -Math.round(dx), sy = -Math.round(dy);
      console.log(angriff.padEnd(7), (dd || '--'), richtung.padEnd(10), 'Hoehe', r.hoehe, '/', g.hoehe,
        'verschoben um', sx, sy, ok ? 'ok' : 'PASST NICHT');
      if (!ok) { fehler++; continue; }
      if (trocken) continue;
      for (let f = 0; f < BILDER; f++) {
        const img = bilder[f + 1];
        const c = createCanvas(img.width, img.height);
        c.getContext('2d').drawImage(img, sx, sy);
        fs.writeFileSync(path.join(ZIEL, schluessel(angriff, dd, f) + '.png'), c.toBuffer('image/png'));
      }
    }
    if (mitBogen && zeilen.length) bogen(angriff, zeilen);
  }
  if (fehler) { console.error(fehler + ' Richtung(en) passen nicht'); process.exit(1); }
})();
