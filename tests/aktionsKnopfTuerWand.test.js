// tests/aktionsKnopfTuerWand.test.js — der Aktionsknopf (Handy) vor einer Tuer.
//
// Spieler meldeten: vor einer geschlossenen Tuer, hinter der Gegner lauern,
// zeigt der Knopf "Kampf" statt der Tuer. Geprueft wurde nur, ob die Tuer
// auf der Linie zum Gegner liegt; stand er schraeg dahinter, lief die Linie
// durch die Wand neben dem Tor und er zaehlte als nah. Jetzt zaehlt nur, wen
// das Sichtfeld zeigt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

const GS = "window.game.scene.getScene('GameScene')";
let H = null;

before(async () => {
  H = await launchDungeon({ depth: 3, zusatz: '&room=bsp' });
  H.step(6); await flush();
  // Raum mit geschlossenem senkrechtem Tor und einem Gegner; die anderen weg.
  // Die Gegner kommen erst ein paar Bilder nach dem Betreten.
  H.run('window._playerInvincible = true');
  let r = -1;
  for (let n = 1; n <= 60 && r < 0; n++) {
    H.run(`enterRoom(${GS}, ${n})`);
    H.step(4); await flush();
    r = H.run(`(function () {
      var sc = ${GS};
      var d = (sc._doors || []).filter(function (x) { return x.active && x.getData('orientation') === 'vertical' && x.getData('doorState') === 'closed'; })[0];
      var ens = window.enemies.getChildren().filter(function (e) { return e.active; });
      if (!d || !ens.length) return -1;
      ens.slice(1).forEach(function (x) { x.destroy(); });
      window.__tor = d; window.__gegner = ens[0];
      return ${n};
    })()`);
  }
  assert.ok(r > 0, 'kein Raum mit Tor und Gegner');
});
after(async () => { if (H) await H.shutdown(); });

// Spieler 40 px links vor dem Tor (py: Hoehe relativ zur Tormitte), Gegner bei
// (dx, dy) relativ zum Tor; ein
// paar Bilder laufen, damit das Sichtfeld nachzieht. Der Gegner wird jedes
// Bild zurueckgestellt, seine KI soll den Fall nicht veraendern.
async function knopf(dx, dy, py) {
  py = py || 0;
  for (let i = 0; i < 8; i++) {
    H.run(`(function () { var d = window.__tor, e = window.__gegner;
      player.setPosition(d.x - 40, d.y + ${py}); e.setPosition(d.x + ${dx}, d.y + ${dy}); e.visible = true;
      if (e.body) e.body.setVelocity(0, 0); })()`);
    H.step(1); await flush();
  }
  return H.run(`(function () { var d = window.__tor, e = window.__gegner;
    player.setPosition(d.x - 40, d.y + ${py}); e.setPosition(d.x + ${dx}, d.y + ${dy}); e.visible = true;
    return window.hasPeacefulTarget(${GS}); })()`);
}

test('Gegner schraeg hinter der Wand neben dem Tor: der Knopf bleibt bei der Tuer', async () => {
  const halb = H.run('window.__tor.displayHeight / 2');
  // Spieler am oberen/unteren Ende des Tors, Gegner jenseits davon hinter
  // der Wand: die Linie kreuzt die Torachse ausserhalb des Riegels.
  assert.ok(Math.hypot(40, halb - 10) < 100, 'Testannahme: [E] erreicht das Tor');
  assert.strictEqual(await knopf(40, -(halb + 150), -(halb - 10)), true, 'Gegner hinter der Wand zwingt den Knopf auf Kampf');
  assert.strictEqual(await knopf(40, halb + 150, halb - 10), true, 'Gegner hinter der Wand (unten) zwingt den Knopf auf Kampf');
});

test('Gegner gerade hinter dem Tor: Tuer', async () => {
  assert.strictEqual(await knopf(100, 0), true);
});

test('Gegenprobe: ein Gegner vor dem Tor, im Blick, heisst Kampf', async () => {
  assert.strictEqual(await knopf(-140, 0), false);
});
