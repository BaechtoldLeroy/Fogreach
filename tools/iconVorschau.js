/**
 * tools/iconVorschau.js — die Gegenstands-Symbole ansehen, ohne das Spiel zu starten.
 *
 * Warum das noetig war: die Symbole entstehen in createItemGraphics() als
 * Phaser-Zeichenbefehle und existieren erst als Textur im laufenden Spiel. Wer
 * sie beurteilen oder vergleichen will, musste sie im Inventar suchen. Damit war
 * "vierzehn Amulette sehen gleich aus" (#125) eine Behauptung, die niemand
 * nachrechnen konnte.
 *
 * Hier laeuft dieselbe Zeichenfunktion gegen ein aufzeichnendes Graphics-Objekt.
 * Heraus kommen zwei Dinge:
 *   * eine SVG-Uebersicht (--svg <datei>) zum Ansehen,
 *   * ein grobes Rasterbild je Symbol fuer den Aehnlichkeits-Vergleich, den
 *     tests/itemIcons.test.js nutzt.
 *
 * Aufruf:
 *   node tools/iconVorschau.js --svg vorschau.svg
 *   node tools/iconVorschau.js --aehnlich       (die aehnlichsten Paare)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const GROESSE = 48;

// ---------------------------------------------------------------------------
// Das aufzeichnende Graphics-Objekt
// ---------------------------------------------------------------------------

/**
 * Nimmt genau die Befehle an, die createItemGraphics benutzt, und merkt sie
 * sich als Liste von Formen. Alles andere ist ein leerer Platzhalter — ein
 * fehlender Befehl soll die Aufzeichnung nicht sprengen, sondern auffallen.
 */
function macheAufzeichner() {
  let farbe = 0xffffff;
  let deckung = 1;
  let strichBreite = 1;
  let strichFarbe = 0xffffff;
  let strichDeckung = 1;
  let pfad = [];
  const formen = [];

  const g = {
    __formen: formen,
    clear() { formen.length = 0; return g; },
    fillStyle(f, a) { farbe = f; deckung = (a === undefined ? 1 : a); return g; },
    lineStyle(b, f, a) { strichBreite = b; strichFarbe = f; strichDeckung = (a === undefined ? 1 : a); return g; },
    fillRect(x, y, w, h) { formen.push({ art: 'rect', x, y, w, h, farbe, deckung }); return g; },
    fillRoundedRect(x, y, w, h, r) { formen.push({ art: 'rect', x, y, w, h, r, farbe, deckung }); return g; },
    fillCircle(x, y, r) { formen.push({ art: 'ellipse', x, y, rx: r, ry: r, farbe, deckung }); return g; },
    fillEllipse(x, y, w, h) { formen.push({ art: 'ellipse', x, y, rx: w / 2, ry: h / 2, farbe, deckung }); return g; },
    fillTriangle(x1, y1, x2, y2, x3, y3) {
      formen.push({ art: 'poly', punkte: [[x1, y1], [x2, y2], [x3, y3]], farbe, deckung });
      return g;
    },
    beginPath() { pfad = []; return g; },
    moveTo(x, y) { pfad.push([x, y]); return g; },
    lineTo(x, y) { pfad.push([x, y]); return g; },
    arc(x, y, r, a0, a1) {
      // Grob in Segmente zerlegen — fuer Vorschau und Vergleich reicht das.
      const schritte = 12;
      for (let i = 0; i <= schritte; i++) {
        const a = a0 + (a1 - a0) * (i / schritte);
        pfad.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
      }
      return g;
    },
    closePath() { return g; },
    strokePath() {
      if (pfad.length > 1) {
        formen.push({ art: 'linie', punkte: pfad.slice(), farbe: strichFarbe,
                      deckung: strichDeckung, breite: strichBreite });
      }
      return g;
    },
    fillPath() {
      if (pfad.length > 2) formen.push({ art: 'poly', punkte: pfad.slice(), farbe, deckung });
      return g;
    },
    save() { return g; }, restore() { return g; },
    translate() { return g; }, rotate() { return g; }, scale() { return g; },
    setPosition() { return g; }, setDepth() { return g; }, setScrollFactor() { return g; },
    destroy() { return g; },
    generateTexture() { return g; }
  };
  return g;
}

// ---------------------------------------------------------------------------
// Die Zeichenfunktion aus dem Spiel holen und laufen lassen
// ---------------------------------------------------------------------------

function sammleSymbole() {
  const quelle = fs.readFileSync(path.join(WURZEL, 'js', 'graphics.js'), 'utf8');

  const fensterStub = { devicePixelRatio: 1 };
  const stilleKonsole = { log() {}, warn() {}, error() {}, info() {} };

  // graphics.js ist ein klassisches Skript: die Funktionen landen im
  // aeusseren Geltungsbereich, nicht auf window. Darum wird der Code in eine
  // Function gepackt und die gesuchte Funktion am Ende zurueckgegeben.
  // eslint-disable-next-line no-new-func
  const holen = new Function('window', 'console', 'Phaser',
    quelle + '\n; return { createItemGraphics: typeof createItemGraphics === "function" ? createItemGraphics : null };');

  const phaserStub = { BlendModes: { ADD: 1, NORMAL: 0 }, Math: { DegToRad: (d) => d * Math.PI / 180 } };
  const { createItemGraphics } = holen(fensterStub, stilleKonsole, phaserStub);
  if (!createItemGraphics) throw new Error('createItemGraphics nicht gefunden');

  const symbole = [];
  const g = macheAufzeichner();
  const szene = {
    add: { graphics: () => g },
    textures: { exists: () => false }
  };
  // generateTexture ist der Moment, in dem ein Symbol fertig ist.
  g.generateTexture = function (key) {
    symbole.push({ key, formen: g.__formen.map((f) => Object.assign({}, f)) });
    return g;
  };
  createItemGraphics.call(szene);
  return symbole;
}

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------

function hex(farbe) {
  return '#' + Number(farbe >>> 0).toString(16).padStart(6, '0').slice(-6);
}

function alsSvgGruppe(symbol) {
  const teile = [];
  for (const f of symbol.formen) {
    const fuell = ' fill="' + hex(f.farbe) + '" fill-opacity="' + f.deckung + '"';
    if (f.art === 'rect') {
      teile.push('<rect x="' + f.x + '" y="' + f.y + '" width="' + f.w + '" height="' + f.h + '"'
        + (f.r ? ' rx="' + f.r + '"' : '') + fuell + '/>');
    } else if (f.art === 'ellipse') {
      teile.push('<ellipse cx="' + f.x + '" cy="' + f.y + '" rx="' + f.rx + '" ry="' + f.ry + '"' + fuell + '/>');
    } else if (f.art === 'poly') {
      teile.push('<polygon points="' + f.punkte.map((p) => p[0] + ',' + p[1]).join(' ') + '"' + fuell + '/>');
    } else if (f.art === 'linie') {
      teile.push('<polyline points="' + f.punkte.map((p) => p[0] + ',' + p[1]).join(' ')
        + '" fill="none" stroke="' + hex(f.farbe) + '" stroke-opacity="' + f.deckung
        + '" stroke-width="' + (f.breite || 1) + '"/>');
    }
  }
  return teile.join('');
}

function svgBlatt(symbole, spalten) {
  const sp = spalten || 8;
  const zelle = GROESSE + 26;
  const zeilen = Math.ceil(symbole.length / sp);
  const teile = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + (sp * zelle)
    + '" height="' + (zeilen * zelle + 6) + '" viewBox="0 0 ' + (sp * zelle) + ' ' + (zeilen * zelle + 6) + '">'];
  teile.push('<rect width="100%" height="100%" fill="#171420"/>');
  symbole.forEach((s, i) => {
    const x = (i % sp) * zelle + 5;
    const y = Math.floor(i / sp) * zelle + 4;
    teile.push('<rect x="' + x + '" y="' + y + '" width="' + GROESSE + '" height="' + GROESSE
      + '" fill="#231f2e" stroke="#3a3446"/>');
    teile.push('<g transform="translate(' + x + ',' + y + ')">' + alsSvgGruppe(s) + '</g>');
    teile.push('<text x="' + (x + GROESSE / 2) + '" y="' + (y + GROESSE + 13)
      + '" font-family="monospace" font-size="8" fill="#9a94a8" text-anchor="middle">'
      + s.key + '</text>');
  });
  teile.push('</svg>');
  return teile.join('\n');
}

// ---------------------------------------------------------------------------
// Rasterung fuer den Aehnlichkeits-Vergleich
// ---------------------------------------------------------------------------

/**
 * Zeichnet ein Symbol in ein n x n grosses Graustufenfeld (0..1).
 *
 * Bewusst grob: verglichen werden soll die SILHOUETTE, nicht der letzte
 * Glanzpunkt. Zwei Symbole, die sich nur in der Farbe unterscheiden, sollen
 * hier als gleich auffallen.
 */
function rastere(symbol, n) {
  const feld = new Float64Array(n * n);
  const s = n / GROESSE;
  const setze = (x, y, wert) => {
    const px = Math.floor(x * s), py = Math.floor(y * s);
    if (px < 0 || py < 0 || px >= n || py >= n) return;
    feld[py * n + px] = Math.max(feld[py * n + px], wert);
  };
  for (const f of symbol.formen) {
    const w = Math.min(1, f.deckung);
    if (f.art === 'rect') {
      for (let y = f.y; y < f.y + f.h; y += 0.5) for (let x = f.x; x < f.x + f.w; x += 0.5) setze(x, y, w);
    } else if (f.art === 'ellipse') {
      for (let y = f.y - f.ry; y <= f.y + f.ry; y += 0.5) {
        for (let x = f.x - f.rx; x <= f.x + f.rx; x += 0.5) {
          const dx = (x - f.x) / (f.rx || 1), dy = (y - f.y) / (f.ry || 1);
          if (dx * dx + dy * dy <= 1) setze(x, y, w);
        }
      }
    } else if (f.art === 'poly' || f.art === 'linie') {
      // Grob: die Kanten abtasten. Fuer den Silhouetten-Vergleich genuegt das.
      for (let i = 0; i < f.punkte.length; i++) {
        const a = f.punkte[i], b = f.punkte[(i + 1) % f.punkte.length];
        const schritte = Math.max(4, Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
        for (let t = 0; t <= schritte; t++) {
          setze(a[0] + (b[0] - a[0]) * (t / schritte), a[1] + (b[1] - a[1]) * (t / schritte), w);
        }
      }
    }
  }
  return feld;
}

/** Anteil der Rasterzellen, in denen sich zwei Symbole unterscheiden (0..1). */
function unterschied(a, b) {
  let summe = 0;
  for (let i = 0; i < a.length; i++) summe += Math.abs(a[i] - b[i]);
  return summe / a.length;
}

// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const symbole = sammleSymbole();

  const svgIdx = args.indexOf('--svg');
  if (svgIdx >= 0) {
    const ziel = args[svgIdx + 1] || 'icons.svg';
    fs.writeFileSync(ziel, svgBlatt(symbole));
    console.log(symbole.length + ' Symbole -> ' + ziel);
    return;
  }

  if (args.includes('--aehnlich')) {
    const n = 24;
    const raster = symbole.map((s) => ({ key: s.key, feld: rastere(s, n) }));
    const paare = [];
    for (let i = 0; i < raster.length; i++) {
      for (let j = i + 1; j < raster.length; j++) {
        paare.push({ a: raster[i].key, b: raster[j].key, d: unterschied(raster[i].feld, raster[j].feld) });
      }
    }
    paare.sort((x, y) => x.d - y.d);
    console.log('Die zehn aehnlichsten Paare (0 = identisch):');
    paare.slice(0, 10).forEach((p) => {
      console.log('  ' + p.d.toFixed(4) + '  ' + p.a + '  /  ' + p.b);
    });
    return;
  }

  console.log(symbole.length + ' Symbole:');
  symbole.forEach((s) => console.log('  ' + s.key + '  (' + s.formen.length + ' Formen)'));
}

if (require.main === module) main();

module.exports = { sammleSymbole, rastere, unterschied, svgBlatt, GROESSE };
