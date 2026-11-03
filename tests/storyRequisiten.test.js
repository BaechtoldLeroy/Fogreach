// tests/storyRequisiten.test.js — die Story-Raeume zeigen, was ihr Raumtext
// verspricht (Kreidekreis, Ketten, Phiolen, Akten, Zellen, Thron, Siegel),
// und die neuen Requisiten sperren weder Ziel noch Weg.
//
// Gemessen wird im echten Raum: alle festen Koerper (Waende, Props, auch die
// zufaellig dazukommenden Funde) als Rechtecke, darauf eine Flut fuer den
// Spielerkoerper (34x56) auf einem 2-px-Raster. Zweimal: mit den Requisiten
// und mit dem, was vorher an ihrer Stelle stand (VORHER: die Faesser, Kisten
// und Altaere, die sie ersetzen). Jede Kachel, in der die Koerpermitte vorher
// stehen konnte, muss sie auch jetzt erreichen — ausser ein Koerper dort
// wuerde die Requisite selbst beruehren. Dazu bleiben Eingaenge und die
// Gegner-Spawns der Vorlage erreichbar, wenn sie es vorher waren. So faellt
// auf, wenn ein Regal eine Gasse schliesst oder eine Zellentuer die Zelle.
//
// Der Raumaufbau wuerfelt (Funde, Schutt): Math.random ist je Raum geseedet.
//
// Dazu das Kreidezeichen (kreidezeichen.js): es steht als Pixelbild, das
// n-te Zeichen traegt das n-te der drei Bilder.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

const SC = `window.game.scene.getScene('GameScene')`;
const STORY = /^(regal_|thron_rat|sarkophag|streckbank|zellentuer)/;

// Was jeder Raum zeigen muss: feste Requisiten und Deko, je mit Anzahl.
const ERWARTET = {
  RitualVault: { regal_phiolen: 3, deko_kreidekreis: 2, wand_ketten: 6 },
  PrisonDepths: { streckbank: 1, zellentuer: 7, wand_ketten: 9 },
  RathausArchive: { regal_akten: 6 },
  CouncilChamber: { thron_rat: 1, wand_ketten: 6 },
  ForgottenCrypt: { sarkophag: 4, deko_siegel: 4 }
};
const RAEUME = Object.keys(ERWARTET);

// Was die Requisiten ersetzt haben (Typ, Kachel, Bildmass wie graphics.js).
const MASS = { barrel: [24, 32], crate: [32, 32], altar: [48, 32] };
const VORHER = {
  RitualVault: [['barrel', 4, 5], ['barrel', 4, 6], ['barrel', 4, 7], ['barrel', 31, 5], ['barrel', 31, 6],
    ['barrel', 4, 25], ['barrel', 4, 26]],
  PrisonDepths: [['crate', 19, 10], ['crate', 18, 11], ['crate', 20, 11]],
  RathausArchive: [3, 7, 11].reduce((a, x) => a.concat([6, 7, 21, 22].map((y) => ['crate', x, y])), []),
  CouncilChamber: [['altar', 19, 3]],
  ForgottenCrypt: [['altar', 7, 9], ['altar', 28, 9], ['altar', 7, 23], ['altar', 28, 23]]
};

/** Belegung als Praefixsumme: frei(px, py) fragt, ob der Koerper dort steht. */
function karte(rechtecke, koerper, grenzen) {
  const bw = grenzen.w + 1, bh = grenzen.h + 1;
  const belegt = new Uint8Array(grenzen.w * grenzen.h);
  rechtecke.forEach((r) => {
    const x0 = Math.max(0, Math.floor(r.x - grenzen.x)), y0 = Math.max(0, Math.floor(r.y - grenzen.y));
    const x1 = Math.min(grenzen.w, Math.ceil(r.x + r.w - grenzen.x)), y1 = Math.min(grenzen.h, Math.ceil(r.y + r.h - grenzen.y));
    for (let y = y0; y < y1; y++) if (x1 > x0) belegt.fill(1, y * grenzen.w + x0, y * grenzen.w + x1);
  });
  const ps = new Int32Array(bw * bh);
  for (let y = 0; y < grenzen.h; y++) {
    let zeile = 0;
    for (let x = 0; x < grenzen.w; x++) {
      zeile += belegt[y * grenzen.w + x];
      ps[(y + 1) * bw + x + 1] = ps[y * bw + x + 1] + zeile;
    }
  }
  const frei = (px, py) => {
    if (px < 0 || py < 0 || px + koerper.w > grenzen.w || py + koerper.h > grenzen.h) return false;
    const x1 = px + koerper.w, y1 = py + koerper.h;
    return ps[y1 * bw + x1] - ps[py * bw + x1] - ps[y1 * bw + px] + ps[py * bw + px] === 0;
  };
  return { frei, koerper, grenzen };
}

/**
 * Flut fuer den Koerper ab start (linke obere Ecke, px), 2-px-Raster.
 * kacheln: Kachel der Koerpermitte -> kuerzester Weg dorthin in px.
 */
function flut(k, start, suchRadius) {
  const S = 2, { frei, koerper, grenzen } = k;
  const W = Math.ceil(grenzen.w / S), Hh = Math.ceil(grenzen.h / S);
  const gesehen = new Uint8Array(W * Hh);
  const sx = Math.round((start.x - grenzen.x) / S), sy = Math.round((start.y - grenzen.y) / S);
  const liste = [];
  // Der Start liegt selten genau auf dem Raster: den naechsten freien Punkt nehmen.
  for (let d = 0; d <= (suchRadius || 6) && !liste.length; d++) {
    for (let dy = -d; dy <= d && !liste.length; dy++) for (let dx = -d; dx <= d && !liste.length; dx++) {
      if (frei((sx + dx) * S, (sy + dy) * S)) { gesehen[(sy + dy) * W + sx + dx] = 1; liste.push(sx + dx, sy + dy, 0); }
    }
  }
  const kacheln = new Map();
  for (let i = 0; i < liste.length; i += 3) {
    const x = liste[i], y = liste[i + 1], d = liste[i + 2];
    const schl = Math.floor((x * S + koerper.w / 2) / 32) + ',' + Math.floor((y * S + koerper.h / 2) / 32);
    if (!kacheln.has(schl)) kacheln.set(schl, d);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= Hh || gesehen[ny * W + nx]) continue;
      if (!frei(nx * S, ny * S)) continue;
      gesehen[ny * W + nx] = 1; liste.push(nx, ny, d + S);
    }
  }
  return { kacheln, anzahl: liste.length / 3 };
}

const erreicht = (menge, tx, ty, rad) => {
  for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    if (menge.has((tx + dx) + ',' + (ty + dy))) return true;
  }
  return false;
};

describe('Story-Raeume', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 12, zusatz: '&debug=1&rooms=' + RAEUME.join(',') });
    H.run('window._playerInvincible = true; window.__echtRandom = Math.random;');
  });
  after(async () => { if (H) await H.shutdown(); });

  // ?rooms= erzwingt Raum i = RAEUME[i % 5]; jeder Aufruf nimmt eine frische Nummer.
  let runde = 1;
  /** Raum mit dieser Vorlage (geseedet) betreten und vermessen. */
  function vermessen(name, seed) {
    const id = RAEUME.length * runde++ + RAEUME.indexOf(name);
    H.run(`(function () {
      var r = ${(seed || 1) >>> 0};
      Math.random = function () { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; };
    })()`);
    try {
      H.run(`enterRoom(${SC}, ${id}); enemies.clear(true, true);`);
      H.step(2);
      H.run('enemies.clear(true, true)');
    } finally {
      H.run('Math.random = window.__echtRandom');
    }
    const r = H.run(`JSON.stringify((function () {
      var sc = ${SC}, tpl = window.RoomTemplates.TEMPLATES[${JSON.stringify(name)}];
      var koerper = [];
      obstacles.getChildren().forEach(function (o) {
        if (!o || !o.active || !o.body || o.body.enable === false) return;
        koerper.push({ x: o.body.x, y: o.body.y, w: o.body.width, h: o.body.height,
          typ: String(o.getData('type') || ''), bild: o.texture && o.texture.key });
      });
      var deko = sc.children.list.filter(function (c) {
        return c && c.active && c.texture && /^(deko_|wand_)/.test(c.texture.key);
      }).map(function (c) { return { bild: c.texture.key, x: c.x, y: c.y, tiefe: c.depth, quelle: c.texture.getSourceImage().width }; });
      return { name: sc.currentRoom.name, koerper: koerper, deko: deko,
        spieler: { x: player.body.x, y: player.body.y, w: player.body.width, h: player.body.height },
        walls: tpl.layout.walls, eingaenge: tpl.entrances || [], gegner: (tpl.spawns && tpl.spawns.enemies) || [] };
    })())`);
    return JSON.parse(r);
  }

  /** Flut mit den Requisiten und mit dem, was vorher dort stand. Die Vorlage liegt am Ursprung. */
  function beideFluten(name, r) {
    const rows = r.walls.length, cols = r.walls[0].length;
    const grenzen = { x: 0, y: 0, w: cols * 32, h: rows * 32 };
    const koerper = { w: Math.round(r.spieler.w), h: Math.round(r.spieler.h) };
    const vorher = VORHER[name].map(([typ, x, y]) => {
      const [w, h] = MASS[typ];
      return { x: x * 32 + 16 - w / 2, y: y * 32 + 16 - h / 2, w, h, typ };
    });
    const story = r.koerper.filter((k) => STORY.test(k.typ));
    const kMit = karte(r.koerper, koerper, grenzen);
    const kAlt = karte(r.koerper.filter((k) => !STORY.test(k.typ)).concat(vorher), koerper, grenzen);
    return {
      story, koerper, kMit, kAlt,
      mit: flut(kMit, r.spieler),
      alt: flut(kAlt, r.spieler)
    };
  }

  for (const name of RAEUME) {
    test(name + ': die Requisiten des Raumtexts stehen mit ihrem Bild da', () => {
      const r = vermessen(name, 7);
      assert.strictEqual(r.name, name);
      Object.keys(ERWARTET[name]).forEach((typ) => {
        const soll = ERWARTET[name][typ];
        if (/^(deko_|wand_)/.test(typ)) {
          const da = r.deko.filter((d) => d.bild === typ);
          assert.strictEqual(da.length, soll, name + ': ' + typ + ' ' + da.length + ' statt ' + soll
            + ' ' + JSON.stringify(da.map((d) => [d.x, d.y])));
          da.forEach((d) => assert.ok(d.quelle > 1, typ + ': kein Bild geladen'));
          // Wandketten haengen vor der Wand, hinter den Props.
          if (typ === 'wand_ketten') da.forEach((d) => assert.ok(d.tiefe > 39.5 && d.tiefe < 40, 'Ketten-Tiefe ' + d.tiefe));
        } else {
          const da = r.koerper.filter((k) => k.typ === typ);
          assert.strictEqual(da.length, soll, name + ': ' + typ + ' ' + da.length + ' statt ' + soll);
          // Das eigene Bild, nicht der Rueckfall auf obstacleWall.
          da.forEach((k) => assert.strictEqual(k.bild, typ, typ + ' zeigt ' + k.bild));
        }
      });
    });

    test(name + ': die Requisiten sperren keine Ziele und machen keinen Weg enger', () => {
      for (let seed = 1; seed <= 3; seed++) {
        const r = vermessen(name, seed * 7919);
        const { story, koerper, kMit, kAlt, mit, alt } = beideFluten(name, r);
        assert.ok(mit.anzahl > 1000, name + ': der Spieler steht eingesperrt (' + mit.anzahl + ' Lagen)');
        // Ein Koerper mit der Mitte in dieser Kachel beruehrte die Requisite.
        const anRequisite = (tx, ty) => story.some((k) => {
          const x0 = tx * 32 - koerper.w / 2, x1 = tx * 32 + 32 + koerper.w / 2;
          const y0 = ty * 32 - koerper.h / 2, y1 = ty * 32 + 32 + koerper.h / 2;
          return x0 < k.x + k.w && x1 > k.x && y0 < k.y + k.h && y1 > k.y;
        });
        const verloren = [];
        alt.kacheln.forEach((_, schl) => {
          if (mit.kacheln.has(schl)) return;
          const [tx, ty] = schl.split(',').map(Number);
          if (!anRequisite(tx, ty)) verloren.push(schl);
        });
        assert.strictEqual(verloren.join(' '), '', name + ' (Seed ' + seed + '): Kacheln nur vorher erreichbar');

        // Ziele: Eingaenge und Gegner-Spawns, soweit sie vorher erreichbar waren.
        r.eingaenge.concat(r.gegner).forEach((z) => {
          if (!erreicht(alt.kacheln, z.x, z.y, 1)) return;
          assert.ok(erreicht(mit.kacheln, z.x, z.y, 1), name + ': Ziel ' + z.x + ',' + z.y + ' nicht mehr erreichbar');
        });

        // Kein Umweg: von Spieler, Eingaengen und Gegner-Spawns aus wird
        // keine Kachel mehr als drei Kacheln weiter als vorher (gemessen
        // hoechstens 82 px). Ein Regal, das eine offene Gasse zustellt,
        // faellt hier auf, auch wenn man aussen herum noch hinkommt. Beide
        // Fluten starten am selben Punkt (frei mit und ohne Requisiten);
        // Kacheln an einer Requisite zaehlen nicht (der Weg in die Zellenecke
        // hinter der Tuer wird natuerlich laenger).
        const gemeinsam = (q) => {
          const sx = Math.round(q.x / 2), sy = Math.round(q.y / 2);
          for (let d = 0; d <= 16; d++) {
            for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
              const px = (sx + dx) * 2, py = (sy + dy) * 2;
              if (kAlt.frei(px, py) && kMit.frei(px, py)) return { x: px, y: py };
            }
          }
          return null;
        };
        const quellen = [{ x: r.spieler.x, y: r.spieler.y }].concat(r.eingaenge.concat(r.gegner)
          .map((z) => ({ x: z.x * 32 + 16 - koerper.w / 2, y: z.y * 32 + 16 - koerper.h / 2 })));
        const umwege = [];
        quellen.forEach((q) => {
          const start = gemeinsam(q);
          if (!start) return;
          const a = flut(kAlt, start, 0), m = flut(kMit, start, 0);
          if (a.anzahl < 1000 || m.anzahl < 1000) return;   // Quelle in einer Tasche
          a.kacheln.forEach((da, schl) => {
            const dm = m.kacheln.get(schl);
            const [tx, ty] = schl.split(',').map(Number);
            if (dm !== undefined && dm > da + 96 && !anRequisite(tx, ty)) umwege.push(schl + ' ' + da + '->' + dm);
          });
        });
        assert.strictEqual(umwege.slice(0, 8).join(', '), '', name + ' (Seed ' + seed + '): Umwege');
      }
    });
  }

  test('Kerkertiefen: jede Zelle bleibt hinter ihrer offenen Tuer begehbar', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const r = vermessen('PrisonDepths', seed * 104729);
      const { mit, alt } = beideFluten('PrisonDepths', r);
      // Die Zellen: Innenraum 3x3 Kacheln, x 5/12/19/26, Zeilen 6-8 und 16-18.
      // Steht die Koerpermitte in den oberen zwei Zeilen, ist der Koerper
      // ganz in der Zelle. War sie vorher betretbar, muss sie es bleiben —
      // die Tuer allein darf das nicht aendern (ein Schutt in der Zellenmitte
      // plus Tuer daneben laesst nur 32 px, der Koerper ist 34 breit).
      const drin = (menge, x, y) => [0, 1, 2].some((dx) => [0, 1].some((dy) => menge.has((x + dx) + ',' + (y + dy))));
      const fehlt = [];
      [5, 12, 19, 26].forEach((x) => [6, 16].forEach((y) => {
        if (drin(alt.kacheln, x, y) && !drin(mit.kacheln, x, y)) fehlt.push(x + ',' + y);
      }));
      assert.strictEqual(fehlt.join(' '), '', 'Zellen ohne Zugang (Seed ' + seed + ')');
    }
  });

  test('Kreidezeichen: drei Pixelbilder, das n-te Zeichen traegt das n-te', () => {
    const r = JSON.parse(H.run(`JSON.stringify((function () {
      var sc = ${SC}, K = window.Kreidezeichen;
      return { bilder: K.BILDER.map(function (k) { return sc.textures.exists(k) ? sc.textures.get(k).getSourceImage().width : 0; }),
        wahl: [0, 1, 2, 3].map(function (n) { return K.bildFuer(sc, n); }) };
    })())`));
    assert.deepStrictEqual(r.bilder, [32, 32, 32], 'Kreidebilder nicht geladen');
    assert.deepStrictEqual(r.wahl, ['evt_kreide0', 'evt_kreide1', 'evt_kreide2', 'evt_kreide0']);
  });
});
