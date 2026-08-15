// tests/headlessNormalStart.test.js — der GANZ normale Spielweg (#96).
//
// Alle bisherigen headless-Tests steigen ueber den Debug-Einstieg `?dungeon=N`
// direkt in den Dungeon ein. Damit blieb der Weg, den ein echter Spieler geht —
// Startbildschirm, Hub, zu Fuss zum Rathauskeller, [E] — vollstaendig
// ungetestet. Genau dort lagen zwei Luecken im Testwerkzeug, die in zwei
// Spieltests wie ein Spielfehler aussahen ("der Hub ist blockiert"):
//
//   1. HubSceneV2 legt sich ein eigenes `this.cursors` an und liest nur dieses.
//      h.input.hold() schrieb aber nur das globale `cursors` der GameScene.
//   2. Der Hub loest [E] ueber `keydown-E` aus, nicht ueber die Mobile-Flagge.
//
// Dieser Test haelt beide Wege offen: er bewegt den Spieler ueber h.input und
// betritt den Dungeon ueber h.input.interact() — schlaegt also fehl, sobald
// eine der beiden Bruecken wieder wegfaellt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await H.waitForScene('HubSceneV2', { maxRounds: 250 });
  assert.ok(ok, 'HubSceneV2 wurde nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

/** Position der Spielfigur im Hub. */
function hubPos() {
  return H.run(`(function () {
    var s = window.game.scene.getScene('HubSceneV2');
    return s && s.player ? { x: s.player.x, y: s.player.y } : null;
  })()`);
}

/** Liegt der EINGANG an — nicht irgendein NPC? */
function entranceActive() {
  return H.run(`(function () {
    var s = window.game.scene.getScene('HubSceneV2');
    var a = s && s._activeInteractable;
    return !!(a && a.type === 'entrance');
  })()`);
}

test('normaler Start: h.input.hold bewegt die Figur AUCH im Hub', async () => {
  const vorher = hubPos();
  assert.ok(vorher, 'kein Spieler im Hub');

  H.input.hold({ up: true });
  await H.settle(() => false, { maxRounds: 6, framesPerRound: 6 });
  H.input.releaseAll();

  const nachher = hubPos();
  const weg = Math.hypot(nachher.x - vorher.x, nachher.y - vorher.y);
  // Ohne die Bruecke auf scene.cursors bewegt sich hier NICHTS (weg === 0).
  assert.ok(weg > 10,
    'Figur bewegte sich im Hub nicht (' + weg.toFixed(1) + 'px) — '
    + 'h.input.hold() erreicht scene.cursors nicht');
});

test('normaler Start: zu Fuss zum Rathauskeller und hinein', async () => {
  const ziel = Array.from(H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    return (sc.entranceLabels || []).map(function (e) {
      var b = e.zone.getBounds();
      return { id: e.data && (e.data.id || e.data.locationId),
        x: Math.round(b.centerX), y: Math.round(b.centerY) };
    });
  })()`)).find((e) => /rathaus/i.test(String(e.id)));
  assert.ok(ziel, 'kein Rathaus-Eingang im Hub gefunden');

  // Hinlaufen, bis das Spiel selbst den Eingang meldet. NICHT auf einen festen
  // Abstand pruefen: die Zone ist 90x42 px gross, ihr Mittelpunkt liegt rund
  // 80 px entfernt, wenn die Figur schon richtig steht.
  // Ausweichen DETERMINISTISCH: quer zur Hauptrichtung, Seite abwechselnd,
  // Dauer wachsend. Eine zufaellige Richtungswahl macht den Test flaky (in
  // einem von drei Laeufen kam die Figur nicht an) — hier soll er entweder
  // immer bestehen oder verlaesslich fehlschlagen.
  let stuck = 0; let detour = null; let detourLeft = 0; let ausweichNr = 0;
  let last = hubPos();
  let angekommen = false;
  for (let i = 0; i < 900 && !angekommen; i++) {
    if (entranceActive()) { angekommen = true; break; }
    const p = hubPos();
    if (!p) break;
    if (detourLeft > 0) {
      H.input.hold(detour); detourLeft--;
    } else if (stuck >= 5) {
      const dx = ziel.x - p.x;
      const dy = ziel.y - p.y;
      const zurSeite = ausweichNr % 2 === 0;
      detour = Math.abs(dy) >= Math.abs(dx)
        ? { left: zurSeite, right: !zurSeite }     // will hoch/runter -> seitlich
        : { up: zurSeite, down: !zurSeite };       // will seitlich   -> hoch/runter
      detourLeft = 10 + (ausweichNr % 4) * 8;      // 10, 18, 26, 34, dann von vorn
      ausweichNr++; stuck = 0;
      H.input.hold(detour);
    } else {
      H.input.hold({
        left: p.x - ziel.x > 4, right: ziel.x - p.x > 4,
        up: p.y - ziel.y > 4, down: ziel.y - p.y > 4,
      });
    }
    await H.settle(() => false, { maxRounds: 1, framesPerRound: 4 });
    const jetzt = hubPos();
    if (jetzt && last && Math.hypot(jetzt.x - last.x, jetzt.y - last.y) < 2) stuck++; else stuck = 0;
    last = jetzt;
  }
  H.input.releaseAll();
  assert.ok(angekommen, 'Rathauskeller-Eingang wurde zu Fuss nicht erreicht');

  H.input.interact();
  const drin = await H.settle(() => H.activeScenes().includes('GameScene'),
    { maxRounds: 150, framesPerRound: 10 });
  assert.ok(drin, 'Dungeon startete nach [E] nicht — aktive Szenen: '
    + H.activeScenes().join(', '));

  const w = H.world();
  assert.ok(w.hp > 0, 'Spieler ohne Lebenspunkte im Dungeon');
  assert.strictEqual(H.hardErrors().length, 0,
    'Konsolenfehler auf dem normalen Weg: '
    + H.hardErrors().map((e) => String(e.msg).slice(0, 120)).join(' | '));
});
