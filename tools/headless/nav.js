// tools/headless/nav.js — Wegsuche fuer den Spieltest-Bot (#96).
//
// Die Karte besteht aus ZWEI Quellen, und genau daran sind drei fruehere
// Anlaeufe gescheitert:
//
//  1. `scene._minimapWallsGrid` (roomTemplates.js:188) — das Wandlayout der
//     Raumvorlage, '#' = Wand. Das ist die Karte, welche die Minimap zeichnet.
//     Sie beschreibt aber NUR die Vorlage.
//  2. Die Gruppe `obstacles` — alles, was danach in den Raum gestellt wird.
//     Gemessen: 53 Stueck pro Raum (26 fest, 27 zerstoerbar), darunter
//     Saeulen, Becken, Statuen, Faesser, Kisten. Im Wandraster steht davon
//     KEIN einziges.
//
// Ein Weg allein aus dem Wandraster fuehrt deshalb mitten durch eine Saeule.
// Genau das war beobachtbar: der Spieler druckte 380 Runden lang mit voller
// Geschwindigkeit dagegen, ohne einen Gegner im Raum.
//
// Zerstoerbares zaehlt hier NICHT als Wand, sondern als teure Kachel: sich
// durch ein Fass zu schlagen ist ein gangbarer Weg, nur ein langsamerer. Bei
// 27 von 53 Hindernissen ist das die Haelfte aller Blockaden.
//
// Freiraum: der Spieler ist 34x56 px gross; geprueft wird derselbe
// 3x3-Abdruck wie im Spiel (CHAR_CLEAR_HALF_W/H, roomManager.js:2097).

const HALB_B = 17;
const HALB_H = 28;
const KOSTEN_FREI = 1;
const KOSTEN_BRECHBAR = 8;   // ~8 offene Kacheln Umweg lohnen sich noch
const KOSTEN_TUER = 3;       // ein Tastendruck — billiger als sich durchzuschlagen

const NACHBARN = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function attachNav(h, sceneKey) {
  const SCENE = sceneKey || 'GameScene';

  /**
   * Kachelkarte des aktuellen Raums.
   * @returns {{tile:number,cols:number,rows:number,art:number[][]}|null}
   *          art: 0 = frei, 1 = zerstoerbar, 2 = blockiert
   */
  function grid() {
    return h.run(`(function () {
      var sc = window.game.scene.getScene('${SCENE}');
      var w = sc && sc._minimapWallsGrid;
      if (!w || !w.length) return null;
      var T = sc._minimapTileSize || 32;
      var rows = w.length;
      var cols = String(w[0]).length;

      // Schritt 1: Wandkacheln aus der Vorlage.
      var wand = [];
      for (var y = 0; y < rows; y++) {
        var zeile = String(w[y]);
        var r = [];
        for (var x = 0; x < cols; x++) r.push(zeile[x] === '#' ? 1 : 0);
        wand.push(r);
      }

      // Schritt 2: platzierte Hindernisse eintragen — sie fehlen im Raster
      // vollstaendig. Eine Kachel gilt als betroffen, wenn der Spieler-
      // Mittelpunkt dort mit dem Koerper des Hindernisses kollidieren wuerde;
      // deshalb wird dessen Rechteck um die halbe Spielergroesse aufgeblasen.
      var hind = [];
      for (var y2 = 0; y2 < rows; y2++) { var r2 = []; for (var x2 = 0; x2 < cols; x2++) r2.push(0); hind.push(r2); }

      if (typeof obstacles !== 'undefined' && obstacles && obstacles.children) {
        obstacles.getChildren().forEach(function (o) {
          if (!o || !o.active || !o.body) return;
          var brechbar = !!(o.getData && o.getData('destructible'));
          var bx = o.body.x - ${HALB_B};
          var by = o.body.y - ${HALB_H};
          var bw = o.body.width + ${HALB_B} * 2;
          var bh = o.body.height + ${HALB_H} * 2;
          var tx0 = Math.floor(bx / T), tx1 = Math.floor((bx + bw) / T);
          var ty0 = Math.floor(by / T), ty1 = Math.floor((by + bh) / T);
          for (var ty = Math.max(0, ty0); ty <= Math.min(rows - 1, ty1); ty++) {
            for (var tx = Math.max(0, tx0); tx <= Math.min(cols - 1, tx1); tx++) {
              // Fest schlaegt zerstoerbar: liegt beides auf derselben Kachel,
              // kommt man dort auch nach dem Zerschlagen nicht durch.
              if (brechbar) { if (hind[ty][tx] === 0) hind[ty][tx] = 1; }
              else hind[ty][tx] = 2;
            }
          }
        });
      }

      // Schritt 2b: TUEREN. Sie liegen in scene._doorGroup (statische
      // Physikgruppe mit Spieler-Kollider, doorSystem.js:163) — NICHT in der
      // obstacles-Gruppe. Ohne sie fuehrt der Weg mitten durch eine
      // geschlossene Tuer, und der Bot drueckt dagegen, statt sie zu oeffnen.
      // Eine geschlossene Tuer ist kein Hindernis, sondern ein DURCHGANG mit
      // einem Tastendruck: begehbar, aber teurer als offener Boden.
      // 3 = Tuer.
      var tueren = (sc._doors && sc._doors.length)
        ? sc._doors
        : ((sc._doorGroup && sc._doorGroup.getChildren) ? sc._doorGroup.getChildren() : []);
      tueren.forEach(function (d) {
        if (!d || !d.active || !d.body) return;
        // Offene Tueren blockieren nicht — nur geschlossene eintragen.
        if (!(d.getData && d.getData('doorState') === 'closed')) return;
        var bx = d.body.x - ${HALB_B};
        var by = d.body.y - ${HALB_H};
        var bw = d.body.width + ${HALB_B} * 2;
        var bh = d.body.height + ${HALB_H} * 2;
        var tx0 = Math.floor(bx / T), tx1 = Math.floor((bx + bw) / T);
        var ty0 = Math.floor(by / T), ty1 = Math.floor((by + bh) / T);
        for (var ty = Math.max(0, ty0); ty <= Math.min(rows - 1, ty1); ty++) {
          for (var tx = Math.max(0, tx0); tx <= Math.min(cols - 1, tx1); tx++) {
            if (hind[ty][tx] === 0) hind[ty][tx] = 3;
          }
        }
      });

      // Schritt 3: zusammenfuehren, inklusive Spieler-Abdruck gegen Waende.
      var art = [];
      for (var y3 = 0; y3 < rows; y3++) {
        var r3 = [];
        for (var x3 = 0; x3 < cols; x3++) {
          var cx = x3 * T + T / 2, cy = y3 * T + T / 2;
          var blockiert = 0;
          for (var i = -1; i <= 1 && !blockiert; i++) {
            for (var j = -1; j <= 1 && !blockiert; j++) {
              var sx = Math.floor((cx + i * ${HALB_B}) / T);
              var sy = Math.floor((cy + j * ${HALB_H}) / T);
              if (sx < 0 || sy < 0 || sx >= cols || sy >= rows || wand[sy][sx]) blockiert = 1;
            }
          }
          r3.push(blockiert ? 2 : hind[y3][x3]);
        }
        art.push(r3);
      }
      return { tile: T, cols: cols, rows: rows, art: art };
    })()`);
  }

  const spielerPos = () => h.run(
    '(typeof player !== "undefined" && player && player.active) ? { x: player.x, y: player.y } : null'
  );

  /**
   * Guenstigster Weg zum Zielpunkt.
   * @returns {Array<{x:number,y:number,brechen:boolean}>|null}
   */
  function path(zx, zy, opts) {
    opts = opts || {};
    const g = (opts.grid && opts.grid.art) ? opts.grid : grid();
    if (!g) return null;
    const p = spielerPos();
    if (!p) return null;

    const art = Array.from(g.art).map((r) => Array.from(r));
    const T = g.tile;
    const cols = g.cols;
    const rows = g.rows;
    const drin = (tx, ty) => tx >= 0 && ty >= 0 && tx < cols && ty < rows;
    const offen = (tx, ty) => drin(tx, ty) && art[ty][tx] !== 2;
    const kosten = (tx, ty) => (art[ty][tx] === 1 ? KOSTEN_BRECHBAR
      : (art[ty][tx] === 3 ? KOSTEN_TUER : KOSTEN_FREI));

    const einrasten = (tx, ty) => {
      if (offen(tx, ty)) return { tx, ty };
      let best = null;
      let bd = Infinity;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!offen(x, y)) continue;
          const d = (x - tx) ** 2 + (y - ty) ** 2;
          if (d < bd) { bd = d; best = { tx: x, ty: y }; }
        }
      }
      return best;
    };

    const von = einrasten(Math.floor(p.x / T), Math.floor(p.y / T));
    const ziel = einrasten(Math.floor(zx / T), Math.floor(zy / T));
    if (!von || !ziel) return null;

    const key = (tx, ty) => tx + '|' + ty;
    const dist = new Map([[key(von.tx, von.ty), 0]]);
    const vor = new Map();
    const rand = [{ tx: von.tx, ty: von.ty, d: 0 }];
    let gefunden = (von.tx === ziel.tx && von.ty === ziel.ty);

    while (rand.length && !gefunden) {
      let bi = 0;
      for (let i = 1; i < rand.length; i++) if (rand[i].d < rand[bi].d) bi = i;
      const cur = rand.splice(bi, 1)[0];
      if (cur.d > (dist.get(key(cur.tx, cur.ty)) ?? Infinity)) continue;
      if (cur.tx === ziel.tx && cur.ty === ziel.ty) { gefunden = true; break; }
      for (const [dx, dy] of NACHBARN) {
        const tx = cur.tx + dx;
        const ty = cur.ty + dy;
        if (!offen(tx, ty)) continue;
        const nd = cur.d + kosten(tx, ty);
        const k = key(tx, ty);
        if (nd < (dist.get(k) ?? Infinity)) {
          dist.set(k, nd);
          vor.set(k, { tx: cur.tx, ty: cur.ty });
          rand.push({ tx, ty, d: nd });
        }
      }
    }
    if (!dist.has(key(ziel.tx, ziel.ty))) return null;

    const kacheln = [];
    let cur = ziel;
    const gesehen = new Set();
    while (cur) {
      const k = key(cur.tx, cur.ty);
      if (gesehen.has(k)) break;
      gesehen.add(k);
      kacheln.push(cur);
      if (cur.tx === von.tx && cur.ty === von.ty) break;
      cur = vor.get(k);
    }
    kacheln.reverse();

    // Gerade Stuecke zusammenfassen — Kacheln mit Zerstoerbarem bleiben
    // IMMER erhalten, dort muss der Bot zuschlagen.
    const punkte = [];
    for (let i = 1; i < kacheln.length; i++) {
      const a = kacheln[i - 1];
      const b = kacheln[i];
      const c = kacheln[i + 1];
      const brechen = art[b.ty][b.tx] === 1;
      const tuer = art[b.ty][b.tx] === 3;
      const knick = !c || (c.tx - b.tx) !== (b.tx - a.tx) || (c.ty - b.ty) !== (b.ty - a.ty);
      if (brechen || tuer || knick) {
        punkte.push({ x: b.tx * T + T / 2, y: b.ty * T + T / 2, brechen, tuer });
      }
    }
    punkte.push({ x: zx, y: zy, brechen: false, tuer: false });
    return punkte;
  }

  h.nav = { grid, path, spielerPos };
  return h.nav;
}

module.exports = { attachNav };
