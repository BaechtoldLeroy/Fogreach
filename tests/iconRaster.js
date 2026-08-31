// Rasterisierer fuer die prozeduralen Item-Symbole aus js/graphics.js.
//
// WARUM: Die Symbole sind Zeichenbefehle, keine Bilddateien. Ob eines die
// 48x48-Kachel ausfuellt oder als Briefmarke in der Mitte klebt, laesst sich
// deshalb nur beantworten, indem man die Befehle wirklich AUSFUEHRT und den
// Umriss ausmisst. Ein Textscan ueber die Zahlen im Quelltext wuerde jede
// Verschiebung uebersehen, sobald sich zwei Formen ueberlappen.
//
// Verfahren: jeder Zeichenbefehl wird als Form mit Deckkraft aufgezeichnet;
// danach wird pro Pixel der MITTELPUNKT (i + 0.5) gegen die Formen getestet
// und von hinten nach vorne komponiert. Ein Pixel gehoert zum Umriss, sobald
// irgendeine Form ihn auch nur schwach einfaerbt (Schatten mit 0.30 und der
// Schattenschleier des Dolchs mit 0.20 zaehlen also mit) — genau das sieht der
// Spieler als Silhouette.
//
// Linien (strokePath/lineStyle) werden mit runden Enden angenaehert: Abstand
// Punkt-zu-Strecke <= Linienbreite/2. Phaser zeichnet stumpfe Enden; der
// Unterschied betraegt hoechstens eine halbe Linienbreite an den Endpunkten
// und ist fuer die Frage "fuellt das Symbol die Kachel" ohne Belang.

const fs = require('fs');
const path = require('path');

const SIZE = 48;
const REPO = path.join(__dirname, '..');

// --- Formen: jede liefert true, wenn der Punkt (px, py) bedeckt ist ---------

function inRect(s, px, py) {
  return px >= s.x && px < s.x + s.w && py >= s.y && py < s.y + s.h;
}

function inCircle(s, px, py) {
  const dx = px - s.x, dy = py - s.y;
  return dx * dx + dy * dy < s.r * s.r;
}

function inEllipse(s, px, py) {
  const rx = s.w / 2, ry = s.h / 2;
  if (rx <= 0 || ry <= 0) return false;
  const dx = (px - s.x) / rx, dy = (py - s.y) / ry;
  return dx * dx + dy * dy < 1;
}

function inTriangle(s, px, py) {
  const d = (ax, ay, bx, by) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const d1 = d(s.x1, s.y1, s.x2, s.y2);
  const d2 = d(s.x2, s.y2, s.x3, s.y3);
  const d3 = d(s.x3, s.y3, s.x1, s.y1);
  const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(neg && pos);
}

// Vorzeichenbehafteter Abstand zum abgerundeten Rechteck (negativ = innen).
function sdRoundedRect(s, px, py) {
  const hw = s.w / 2, hh = s.h / 2;
  const r = Math.min(s.r, hw, hh);
  const qx = Math.abs(px - (s.x + hw)) - (hw - r);
  const qy = Math.abs(py - (s.y + hh)) - (hh - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const len2 = vx * vx + vy * vy;
  let t = len2 === 0 ? 0 : ((px - x1) * vx + (py - y1) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (x1 + t * vx), dy = py - (y1 + t * vy);
  return Math.sqrt(dx * dx + dy * dy);
}

function covers(s, px, py) {
  switch (s.kind) {
    case 'rect': return inRect(s, px, py);
    case 'circle': return inCircle(s, px, py);
    case 'ellipse': return inEllipse(s, px, py);
    case 'triangle': return inTriangle(s, px, py);
    case 'roundedRect': return sdRoundedRect(s, px, py) < 0;
    case 'strokeRoundedRect': return Math.abs(sdRoundedRect(s, px, py)) <= s.lw / 2;
    case 'stroke':
      for (let i = 0; i < s.segs.length; i++) {
        const g = s.segs[i];
        if (distToSegment(px, py, g[0], g[1], g[2], g[3]) <= s.lw / 2) return true;
      }
      return false;
    default: return false;
  }
}

// --- Aufzeichnende Graphics-Attrappe ---------------------------------------

function recorder() {
  const shapes = [];
  let fill = { color: 0xffffff, alpha: 1 };
  let line = { color: 0xffffff, alpha: 1, width: 1 };
  let pts = [];
  const push = (s) => { shapes.push(Object.assign(s, { color: fill.color, alpha: fill.alpha })); };

  const g = {
    shapes,
    clear() { return g; },
    fillStyle(color, alpha) { fill = { color, alpha: alpha === undefined ? 1 : alpha }; return g; },
    lineStyle(width, color, alpha) {
      line = { width, color, alpha: alpha === undefined ? 1 : alpha };
      return g;
    },
    fillRect(x, y, w, h) { push({ kind: 'rect', x, y, w, h }); return g; },
    fillRoundedRect(x, y, w, h, r) { push({ kind: 'roundedRect', x, y, w, h, r: r || 0 }); return g; },
    strokeRoundedRect(x, y, w, h, r) {
      shapes.push({
        kind: 'strokeRoundedRect', x, y, w, h, r: r || 0,
        lw: line.width, color: line.color, alpha: line.alpha
      });
      return g;
    },
    fillCircle(x, y, r) { push({ kind: 'circle', x, y, r }); return g; },
    fillEllipse(x, y, w, h) { push({ kind: 'ellipse', x, y, w, h }); return g; },
    fillTriangle(x1, y1, x2, y2, x3, y3) {
      push({ kind: 'triangle', x1, y1, x2, y2, x3, y3 });
      return g;
    },
    beginPath() { pts = []; return g; },
    closePath() { if (pts.length > 1) pts.push(pts[0]); return g; },
    moveTo(x, y) { pts.push([x, y]); return g; },
    lineTo(x, y) { pts.push([x, y]); return g; },
    arc(x, y, r, a0, a1, anti) {
      // In Polygonzug zerlegen — fein genug, dass der Fehler unter 1/10 Pixel bleibt.
      let von = a0, bis = a1;
      if (anti) { while (bis > von) bis -= Math.PI * 2; } else { while (bis < von) bis += Math.PI * 2; }
      const schritte = Math.max(8, Math.ceil(Math.abs(bis - von) / 0.05));
      for (let i = 0; i <= schritte; i++) {
        const a = von + (bis - von) * (i / schritte);
        pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
      }
      return g;
    },
    strokePath() {
      const segs = [];
      for (let i = 1; i < pts.length; i++) {
        segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
      }
      if (segs.length) {
        shapes.push({ kind: 'stroke', segs, lw: line.width, color: line.color, alpha: line.alpha });
      }
      return g;
    },
    fillPath() { return g; },
    generateTexture() { return g; },
    setDepth() { return g; },
    destroy() { return g; }
  };
  return g;
}

// --- createItemGraphics ausfuehren und die Zeichenbefehle einsammeln --------

// Liefert { key: [Formen] } fuer alle Symbole. Die Funktion haengt nicht an
// window, deshalb wird sie ueber ein angehaengtes `return` herausgereicht.
// Phaser wird als Attrappe hineingereicht — der Bogen ruft Phaser.Math.DegToRad
// und wuerde sonst mit "Phaser is not defined" ausfallen.
function symbolFormen() {
  const code = fs.readFileSync(path.join(REPO, 'js', 'graphics.js'), 'utf8');
  const je = {};
  let g = recorder();
  const szene = {
    add: { graphics: () => g },
    textures: { exists: () => false }
  };
  // Die Zeichenroutine nutzt EIN Graphics-Objekt fuer alle Symbole und ruft
  // zwischendurch clear(). Deshalb wird bei jedem generateTexture() der
  // bisherige Formenstand abgeschnitten.
  let gesehen = 0;
  g.generateTexture = (key) => {
    je[key] = g.shapes.slice(gesehen);
    gesehen = g.shapes.length;
    return g;
  };
  g.clear = () => { gesehen = g.shapes.length; return g; };
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', 'Phaser', 'console', 'document',
    code + '\n;return { createItemGraphics };');
  const api = fn({}, { Math: { DegToRad: (d) => d * Math.PI / 180 } }, console, undefined);
  api.createItemGraphics.call(szene);
  return je;
}

// --- Messen und Rastern -----------------------------------------------------

// Umriss-Rahmen eines Symbols in Pixeln der 48x48-Kachel.
function rahmen(formen) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const px = x + 0.5, py = y + 0.5;
      let getroffen = false;
      for (let i = 0; i < formen.length; i++) {
        if (formen[i].alpha > 0 && covers(formen[i], px, py)) { getroffen = true; break; }
      }
      if (!getroffen) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (minX === Infinity) return { breite: 0, hoehe: 0, x0: 0, y0: 0, x1: 0, y1: 0 };
  return {
    x0: minX, y0: minY, x1: maxX, y1: maxY,
    breite: maxX - minX + 1,
    hoehe: maxY - minY + 1
  };
}

// Alle Rahmen auf einmal.
function alleRahmen() {
  const formen = symbolFormen();
  const out = {};
  Object.keys(formen).forEach((k) => { out[k] = rahmen(formen[k]); });
  return out;
}

// Farbraster fuer die Bildausgabe (RGBA, ueberabgetastet).
function pixel(formen, ss) {
  const n = ss || 4;
  const buf = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let r = 0, gg = 0, b = 0, a = 0;
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const px = x + (sx + 0.5) / n, py = y + (sy + 0.5) / n;
          let cr = 0, cg = 0, cb = 0, ca = 0;
          for (let i = 0; i < formen.length; i++) {
            const s = formen[i];
            if (s.alpha <= 0 || !covers(s, px, py)) continue;
            const sr = (s.color >> 16) & 255, sg = (s.color >> 8) & 255, sb = s.color & 255;
            const al = s.alpha;
            cr = sr * al + cr * (1 - al);
            cg = sg * al + cg * (1 - al);
            cb = sb * al + cb * (1 - al);
            ca = al + ca * (1 - al);
          }
          r += cr; gg += cg; b += cb; a += ca;
        }
      }
      const m = n * n, o = (y * SIZE + x) * 4;
      buf[o] = Math.round(r / m);
      buf[o + 1] = Math.round(gg / m);
      buf[o + 2] = Math.round(b / m);
      buf[o + 3] = Math.round((a / m) * 255);
    }
  }
  return buf;
}

module.exports = { SIZE, symbolFormen, rahmen, alleRahmen, pixel };
