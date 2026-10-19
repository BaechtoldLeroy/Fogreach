// tests/wandSchub.test.js — der Anti-Wand-Schub (js/main.js) befreit, statt
// festzuhalten.
//
// Gemeldet: "Nach einer Rolle stecke ich zwischen Wand und Kiste fest und
// komme nicht mehr weg." Die Ursache: eine schraege Rolle drueckt den 34 px
// breiten Koerper in einen 32 px breiten Spalt zwischen einer Wand und einem
// kleinen Hindernis. Er steckt 2 px tief; der alte Schub schob ihn 2 px aus
// dem Hindernis geradewegs in die Wand, im naechsten Bild zurueck — und
// setzte dabei JEDES Bild die ganze Geschwindigkeit auf 0, auch die von der
// Wand weg. Der Spieler zitterte auf der Stelle (gemessen: 0-6 px Weg in
// jeder Richtung).
//
// Geprueft in einer selbst gebauten Kulisse (Wand + 32x32-Kiste), damit der
// seltene Fall nicht ausgewuerfelt werden muss:
//   - aus dem Spalt kommt der Spieler in jede freie Richtung weg;
//   - bei angehaltener Physik verschiebt der Schub nichts;
//   - ein abgeschalteter Hinderniskoerper ist keine unsichtbare Wand;
//   - normale Waende halten weiter: Laufen und Rollen enden nie in der Wand.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

const SC = `window.game.scene.getScene('GameScene')`;

let H = null;
before(async () => {
  H = await launchDungeon({ depth: 1 });
  H.run('window._playerInvincible = true');
});
after(async () => { if (H) await H.shutdown(); });

/**
 * Raeumt den Raum leer und stellt die Kulisse auf: Rechtecke {x,y,w,h} als
 * feste Hindernisse (Weltkoordinaten der Koerper).
 */
function kulisse(rechtecke) {
  H.input.releaseAll();
  H.run(`(function () {
    var sc = ${SC};
    if (sc.physics.world.isPaused) sc.physics.world.resume();
    enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
    obstacles.clear(true, true);
    if (sc._doorGroup) sc._doorGroup.clear(true, true);
    isRolling = false; rollCooldown = false; isDashing = false;
    window.__kulisse = ${JSON.stringify(rechtecke)}.map(function (r) {
      var o = obstacles.create(r.x + r.w / 2, r.y + r.h / 2, '__WHITE');
      o.setDisplaySize(r.w, r.h);
      o.refreshBody();
      return o;
    });
    player.body.setVelocity(0, 0);
    if (typeof _smoothVelX !== "undefined") { _smoothVelX = 0; _smoothVelY = 0; }
  })()`);
  // Ein Nachgleiten aus dem vorigen Fall abklingen lassen.
  H.step(3);
}

/** Stellt den Koerper (nicht die Figur) mit der linken oberen Ecke auf (bx, by). */
function koerperAuf(bx, by) {
  H.run(`(function () {
    player.body.reset(player.x, player.y);
    player.body.setVelocity(0, 0);
    if (typeof _smoothVelX !== "undefined") { _smoothVelX = 0; _smoothVelY = 0; }
    var dx = player.body.x - player.x, dy = player.body.y - player.y;
    player.setPosition(${bx} - dx, ${by} - dy);
    player.body.reset(player.x, player.y);
  })()`);
}

function lage() {
  return H.run(`({ x: player.x, y: player.y, bx: player.body.x, by: player.body.y,
    w: player.body.width, h: player.body.height,
    tiefe: window.SpawnRegeln.eindringtiefe({ x: player.body.x, y: player.body.y, w: player.body.width, h: player.body.height },
      window.SpawnRegeln.festeRechtecke([obstacles])) })`);
}

const RICHTUNG = {
  hoch: { up: true }, runter: { down: true }, links: { left: true }, rechts: { right: true },
  hochLinks: { up: true, left: true }, hochRechts: { up: true, right: true },
  runterLinks: { down: true, left: true }, runterRechts: { down: true, right: true },
};

/** Haelt die Richtung bis zu `bilder` Frames; liefert den zurueckgelegten Weg. */
function laufen(richtung, bilder) {
  const a = lage();
  H.input.hold(RICHTUNG[richtung]);
  let weg = 0;
  for (let i = 0; i < bilder && weg < 20; i++) {
    H.step(1);
    const b = lage();
    weg = Math.hypot(b.x - a.x, b.y - a.y);
  }
  H.input.releaseAll();
  return weg;
}

// Senkrechter Spalt: Wand links (400..432), Kiste rechts (464..496), dazwischen
// 32 px. Der 34 px breite Koerper steckt 2 px in der Kiste.
const SENKRECHT = [{ x: 400, y: 160, w: 32, h: 480 }, { x: 464, y: 384, w: 32, h: 32 }];
// Gespiegelt: Kiste links (304..336), Wand rechts (368..400).
const GESPIEGELT = [{ x: 368, y: 160, w: 32, h: 480 }, { x: 304, y: 384, w: 32, h: 32 }];

for (const r of ['hoch', 'runter', 'hochRechts', 'runterRechts', 'hochLinks', 'runterLinks']) {
  test(`Spalt senkrecht: der Spieler kommt nach ${r} frei`, () => {
    kulisse(SENKRECHT);
    koerperAuf(432, 372);
    H.step(3);
    const weg = laufen(r, 30);
    assert.ok(weg >= 20, `nur ${weg.toFixed(1)} px nach ${r} in 30 Bildern (${JSON.stringify(lage())})`);
  });
}

for (const r of ['hoch', 'runter', 'hochLinks', 'runterRechts']) {
  test(`Spalt gespiegelt: der Spieler kommt nach ${r} frei`, () => {
    kulisse(GESPIEGELT);
    koerperAuf(334, 372);
    H.step(3);
    const weg = laufen(r, 30);
    assert.ok(weg >= 20, `nur ${weg.toFixed(1)} px nach ${r} in 30 Bildern (${JSON.stringify(lage())})`);
  });
}

test('angehaltene Physik: der Schub verschiebt den Spieler nicht', () => {
  kulisse([{ x: 400, y: 160, w: 128, h: 480 }]);
  // 12 px tief von links in der Wand.
  koerperAuf(400 - 34 + 12, 360);
  const vorher = lage();
  H.run(`${SC}.physics.world.pause()`);
  H.step(10);
  const nachher = lage();
  H.run(`${SC}.physics.world.resume()`);
  assert.ok(Math.abs(nachher.x - vorher.x) < 0.5 && Math.abs(nachher.y - vorher.y) < 0.5,
    `bei angehaltener Physik verschoben: ${JSON.stringify(vorher)} -> ${JSON.stringify(nachher)}`);
});

test('der Schub nimmt nur die Bewegung ins Hindernis, nicht die daran entlang', () => {
  kulisse([{ x: 400, y: 160, w: 128, h: 480 }]);
  // 8 px tief von links in der Wand, der Spieler laeuft nach oben-links.
  koerperAuf(400 - 34 + 8, 360);
  H.input.hold({ up: true, left: true });
  H.step(1);
  const v = H.run('({ x: player.body.velocity.x, y: player.body.velocity.y })');
  H.input.releaseAll();
  assert.ok(v.y < -50 && v.x < -50, `Geschwindigkeit nach dem Schub: ${JSON.stringify(v)}`);
});

test('zwei Wandkacheln uebereinander: ein Schub, nicht zwei', () => {
  kulisse([{ x: 400, y: 320, w: 32, h: 32 }, { x: 400, y: 352, w: 32, h: 32 }]);
  // 6 px tief in beiden Kacheln; ohne Eingabe.
  koerperAuf(400 - 34 + 6, 322);
  // Ein Bild fuer den Schub, eins, bis der Koerper der Figur gefolgt ist.
  H.step(2);
  const b = lage();
  assert.ok(Math.abs(b.bx + b.w - 400) < 0.5, `Koerper endet bei ${(b.bx + b.w).toFixed(1)} statt an der Wand (400)`);
});

test('zu enger Spalt: kein Hin und Her zwischen Wand und Kiste', () => {
  // Spalt 30 px: 4 px in der Kiste, und der kuerzeste Schub fuehrte 4 px in
  // die Wand. Statt zu pendeln, steht der Spieler nach wenigen Bildern frei.
  kulisse([{ x: 400, y: 160, w: 32, h: 480 }, { x: 462, y: 384, w: 32, h: 32 }]);
  koerperAuf(432, 372);
  H.step(10);
  const xs = [];
  for (let i = 0; i < 4; i++) { H.step(1); xs.push(lage()); }
  const tief = Math.max(...xs.map((l) => l.tiefe));
  const pendel = Math.max(...xs.map((l) => l.bx)) - Math.min(...xs.map((l) => l.bx));
  assert.ok(tief <= 2 && pendel < 0.5, `steckt ${tief.toFixed(1)} px, pendelt ${pendel.toFixed(1)} px`);
});

test('abgeschalteter Hinderniskoerper ist keine unsichtbare Wand', () => {
  kulisse([{ x: 400, y: 160, w: 64, h: 480 }]);
  H.run('window.__kulisse[0].body.enable = false');
  koerperAuf(300, 360);
  H.step(2);
  const a = lage();
  H.input.hold({ right: true });
  H.step(60);
  H.input.releaseAll();
  const b = lage();
  assert.ok(b.bx > 420, `blieb vor dem abgeschalteten Koerper stehen: ${a.bx.toFixed(1)} -> ${b.bx.toFixed(1)}`);
});

test('Laufen gegen Wand und Kiste: von allen Seiten, nie hindurch und nie darin', () => {
  // Wand 400..464 x 240..400, Kiste 640..672 x 300..332
  const ziele = [{ x: 400, y: 240, w: 64, h: 160 }, { x: 640, y: 300, w: 32, h: 32 }];
  for (const z of ziele) {
    const anlauf = {
      rechts: [z.x - 34 - 60, z.y + z.h / 2 - 28],
      links: [z.x + z.w + 60, z.y + z.h / 2 - 28],
      runter: [z.x + z.w / 2 - 17, z.y - 56 - 60],
      hoch: [z.x + z.w / 2 - 17, z.y + z.h + 60],
    };
    for (const [r, [bx, by]] of Object.entries(anlauf)) {
      kulisse(ziele);
      koerperAuf(bx, by);
      H.step(2);
      H.input.hold(RICHTUNG[r]);
      H.step(60);
      H.input.releaseAll();
      H.step(2);
      const l = lage();
      assert.ok(l.tiefe <= 2, `${r} gegen ${JSON.stringify(z)}: ${l.tiefe.toFixed(1)} px tief`);
      const durch = (r === 'rechts' && l.bx >= z.x + z.w) || (r === 'links' && l.bx + l.w <= z.x)
        || (r === 'runter' && l.by >= z.y + z.h) || (r === 'hoch' && l.by + l.h <= z.y);
      assert.ok(!durch, `${r} durch ${JSON.stringify(z)} hindurch: ${JSON.stringify(l)}`);
    }
  }
});

test('Rollen gegen die Wand, auch schraeg: endet nie in der Wand', () => {
  const wand = { x: 400, y: 160, w: 64, h: 480 };
  for (const r of ['rechts', 'hochRechts', 'runterRechts', 'links', 'hochLinks', 'runterLinks']) {
    for (const abstand of [4, 20, 40]) {
      kulisse([wand, { x: 368, y: 384, w: 32, h: 32 }, { x: 464, y: 288, w: 32, h: 32 }]);
      const x = r.includes('Rechts') || r === 'rechts' ? wand.x - 34 - abstand : wand.x + wand.w + abstand;
      koerperAuf(x, 330);
      H.step(2);
      H.input.hold(RICHTUNG[r]);
      H.run(`window.performRoll.call(${SC})`);
      H.step(20);
      H.input.releaseAll();
      H.step(3);
      const l = lage();
      assert.ok(l.tiefe <= 2, `Rolle ${r} aus ${abstand} px: ${l.tiefe.toFixed(1)} px tief (${JSON.stringify(l)})`);
    }
  }
});
