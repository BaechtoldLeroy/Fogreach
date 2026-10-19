// tests/bossPlatz.test.js — kein Boss steht in der Wand.
//
// Gemeldet (Screenshot): der Kettenmeister stand auf Tiefe 10 halb in der
// rechten Wand, unerreichbar. spawnBoss setzte den Boss auf Spieler +
// Zufallsversatz und pruefte nur die Weltgrenze. Gemessen ueber 3 Laeufe x
// alle Raeume x alle Bosse: der Koerper ueberlappte beim Spawn in 60 %
// (Kettenmeister) bis 90 % (Elara) der Faelle eine Wand oder ein Hindernis,
// bis 96 px tief — so tief trennt Arcade nicht mehr, der Boss steckte.
// Elaras Schattensprung (Ziel nur gegen die Weltgrenze geprueft) landete
// in 129 von 144 Spruengen in der Wand.
//
// Jetzt: spawnRegeln.grosserKoerperPlatz (reine Regel) und grossFreiStellen.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');
const { launchDungeon } = require('../tools/headless/index.js');

loadGameModule('js/spawnRegeln.js');
const SR = globalThis.window.SpawnRegeln;

// ------------------------------------------------------------ reine Regel

test('Regel: nur Plaetze, an denen der ganze Koerper frei steht', () => {
  // Wand rechts von x=200; Koerper 100x100, Mitte = Position (dx/dy -50).
  const masse = { dx: -50, dy: -50, w: 100, h: 100 };
  const feste = [{ x: 200, y: 0, w: 100, h: 400 }];
  const kandidaten = [{ x: 190, y: 200 }, { x: 160, y: 200 }, { x: 120, y: 200 }];
  // Gewuenscht ganz an der Wand: 190 und 160 ragen (mit 12 px Luft) hinein.
  const p = SR.grosserKoerperPlatz(kandidaten, masse, feste, { wunsch: { x: 195, y: 200 } });
  assert.deepStrictEqual(p, { x: 120, y: 200 });
});

test('Regel: Abstand zum Spieler, sonst der entfernteste freie', () => {
  const masse = { dx: -10, dy: -10, w: 20, h: 20 };
  const k = [{ x: 50, y: 0 }, { x: 150, y: 0 }, { x: 300, y: 0 }];
  const nah = SR.grosserKoerperPlatz(k, masse, [], { spieler: { x: 0, y: 0 }, mindest: 100, wunsch: { x: 0, y: 0 } });
  assert.deepStrictEqual(nah, { x: 150, y: 0 }, 'naechster mit Mindestabstand');
  const keiner = SR.grosserKoerperPlatz(k, masse, [], { spieler: { x: 0, y: 0 }, mindest: 1000 });
  assert.deepStrictEqual(keiner, { x: 300, y: 0 }, 'ohne Mindestabstand der entfernteste');
});

test('Regel: passt er nirgends, der erreichbare Platz mit der geringsten Ueberlappung — nie ein freier dahinter', () => {
  const masse = { dx: -50, dy: -50, w: 100, h: 100 };
  const feste = [{ x: 0, y: 0, w: 40, h: 400 }, { x: 120, y: 0, w: 40, h: 400 }];   // Gang 80 px breit
  const p = SR.grosserKoerperPlatz([{ x: 80, y: 200 }, { x: 70, y: 200 }], masse, feste, {});
  assert.deepStrictEqual(p, { x: 80, y: 200 });
});

test('koerperMasse rechnet wie Arcade, nicht wie body.reset', () => {
  // Phaser 3.70: reset() legt den Koerper auf getTopLeft() — ohne Versatz.
  // Jedes Bild setzt Arcade ihn dann auf x + scale * (offset - displayOrigin).
  const sprite = { x: 500, y: 400, scaleX: 2, scaleY: 2, displayOriginX: 40, displayOriginY: 60 };
  sprite.body = { width: 60, height: 100, offset: { x: 10, y: 5 }, x: 0, y: 0,
    reset(x, y) { this.x = x - sprite.displayOriginX * 2; this.y = y - sprite.displayOriginY * 2; } };
  assert.deepStrictEqual(SR.koerperMasse(sprite), { dx: -60, dy: -110, w: 60, h: 100 });
});

// ------------------------------------------------------------ im Spiel

const ARENEN = {
  chainMaster: 'PrisonDepths', ceremonyMaster: 'RitualVault', nachhallEsse: 'CouncilChamber',
  nachhall: 'ForgottenCrypt', elaraBesessen: 'DieQuelle'
};
const IDS = Object.keys(ARENEN);
const SC = `window.game.scene.getScene('GameScene')`;

describe('Bosse in ihren Arenen (gesaete Zufallsfolge)', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 10, zusatz: '&debug=1&rooms=' + IDS.map((i) => ARENEN[i]).join(',') });
    // Buehnen und Kampfskripte aus: gemessen wird nur, wo der Boss steht.
    H.run(`window._playerInvincible = true; window.Finale = null; window.ElaraKampf = null; window.BossIntro = null;
      var s = 20261019;
      Math.random = function () { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      window.__mess = function (b) {
        var sc = ${SC};
        var r = window.SpawnRegeln.koerperBei(b.x, b.y, window.SpawnRegeln.koerperMasse(b));
        var tief = window.SpawnRegeln.eindringtiefe(r, window.SpawnRegeln.festeRechtecke([obstacles]));
        var wb = sc.physics.world.bounds;
        var drin = r.x >= wb.x && r.y >= wb.y && r.x + r.w <= wb.x + wb.width && r.y + r.h <= wb.y + wb.height;
        return { raum: sc.currentRoom && sc.currentRoom.name, tief: Math.round(tief), drin: drin,
          erreichbar: !!sc.isPointAccessible(r.x + r.w / 2, r.y + r.h / 2), x: Math.round(b.x), y: Math.round(b.y) };
      };`);
  });
  after(async () => { if (H) await H.shutdown(); });

  function spawnen(i, id) {
    H.run(`enterRoom(${SC}, ${i});`);
    H.step(2);
    return H.run(`(function () {
      enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
      window.debugForcedBoss = function () { return BOSS_DEFINITIONS['${id}']; };
      window.__b = spawnBoss.call(${SC});
      return window.__mess(window.__b);
    })()`);
  }

  test('Spawn: Koerper frei, in der Welt, erreichbar', () => {
    const schlecht = [];
    IDS.forEach((id, i) => {
      for (let k = 0; k < 12; k++) {
        const r = spawnen(i, id);
        assert.strictEqual(r.raum, ARENEN[id], 'falscher Raum');
        if (r.tief > 0 || !r.drin || !r.erreichbar) schlecht.push(id + ' ' + JSON.stringify(r));
      }
    });
    assert.deepStrictEqual(schlecht, []);
  });

  test('Elaras Schattensprung landet nicht in der Wand', () => {
    const i = IDS.indexOf('elaraBesessen');
    const schlecht = [];
    for (let k = 0; k < 6; k++) {
      spawnen(i, 'elaraBesessen');
      for (let d = 0; d < 4; d++) {
        // Spieler an einen erreichbaren Platz (auch an die Wand), dann springen.
        H.run(`(function () { var sc = ${SC}; var c = sc._accessibleArea.reachableCells;
          var z = c[Math.floor(Math.random() * c.length)]; player.setPosition(z.x, z.y + 20); player.body.reset(z.x, z.y + 20);
          bossShadowDash.call(sc, window.__b); })()`);
        H.step(25);
        const r = H.run('window.__mess(window.__b)');
        if (r.tief > 0 || !r.drin || !r.erreichbar) schlecht.push(JSON.stringify(r));
      }
    }
    assert.deepStrictEqual(schlecht, []);
  });

  test('Der Nachhall tauscht mit seinem Echo, ohne in der Wand zu landen', () => {
    // Das Echo ist klein, der Nachhall 158x150: auf dessen Platz ragte er
    // gemessen in 85 von 144 Taeuschen in Wand oder Hindernis.
    const i = IDS.indexOf('nachhall');
    const schlecht = [];
    for (let k = 0; k < 4; k++) {
      spawnen(i, 'nachhall');
      H.run(`BOSS_ATTACK_MAP.chorTausch.call(${SC}, window.__b)`);   // ruft erst die Echos
      H.step(40);
      for (let d = 0; d < 4; d++) {
        H.run(`BOSS_ATTACK_MAP.chorTausch.call(${SC}, window.__b)`);
        H.step(20);   // 300 ms bis zum Tausch, kaum Zeit zum Laufen
        const r = H.run('window.__mess(window.__b)');
        // Bis 4 px: Arcade-Kontakt eines Koerpers, der an die Wand laeuft.
        if (r.tief > 4 || !r.drin || !r.erreichbar) schlecht.push(JSON.stringify(r));
      }
    }
    assert.deepStrictEqual(schlecht, []);
  });
});
