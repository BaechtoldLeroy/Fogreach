// tests/spawnPlatz.test.js — Spieler- und Gegner-Spawn im echten Spiel.
//
// A) "Der Player spawnt manchmal auf Mauern und kann sich dann nicht mehr
//    bewegen." B) "In der Ritual Chamber spawnen die Gegner fast immer beim
//    Spawn des Players."
//
// Gemessen vor dem Fix (280 Raeume, Tiefen 1-30): in der Ritual Chamber
// standen 32 von 32 Gegnern naeher als 260 px am Spieler (Median 32 px). Die
// Ursache war die Erreichbarkeitskarte: sie pruefte den Koerper nur auf der
// Zellmitte, und Kohlebecken/Saeulen/Statue sperrten den Spawn in eine Tasche
// von 20 Zellen — jede Welle zog ihren Platz aus dieser Tasche.
// Die reinen Regeln prueft tests/spawnRegeln.test.js.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { launch, launchDungeon } = require('../tools/headless/index.js');

const SC = `window.game.scene.getScene('GameScene')`;
const TIEFE = `window.SpawnRegeln.eindringtiefe({ x: player.body.x, y: player.body.y, w: player.body.width, h: player.body.height },
  window.SpawnRegeln.festeRechtecke([obstacles]))`;

/** Der dickste Wandblock des Raums (der Koerper passt ganz hinein). */
const DICKSTE_WAND = `(function () {
  var best = null;
  obstacles.getChildren().forEach(function (o) {
    if (!o || !o.active || !o.body || o.body.enable === false) return;
    var b = o.body;
    if (b.width < 64 || b.height < 96) return;
    if (!best || b.width * b.height > best.w * best.h) best = { x: b.x, y: b.y, w: b.width, h: b.height };
  });
  return best;
})()`;

describe('Dungeon (Ritual Chamber, Thronsaal)', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 5, zusatz: '&debug=1&rooms=RitualChamber,ThroneRoom' });
    H.run('window._playerInvincible = true');
  });
  after(async () => { if (H) await H.shutdown(); });

  // Raum betreten und die Welle (delayedCall 0) fallen lassen, damit keine
  // Welle in den naechsten Raum hinueberreicht.
  function betreten(i, ohneTakt) {
    H.run(`enterRoom(${SC}, ${i});`);
    if (!ohneTakt) H.step(3);
  }

  test('die Kammer ist vom Spawn aus erreichbar, nicht nur die Tasche am Eingang', () => {
    betreten(2);
    const r = H.run(`(function () {
      var a = ${SC}._accessibleArea;
      var weit = a.reachableCells.filter(function (c) { return Math.hypot(c.x - player.x, c.y - player.y) >= 300; }).length;
      return { raum: ${SC}.currentRoom.name, zellen: a.reachableCells.length, weit: weit };
    })()`);
    assert.strictEqual(r.raum, 'RitualChamber');
    assert.ok(r.weit > 20, 'nur ' + r.weit + ' erreichbare Zellen mindestens 300 px vom Spawn (von ' + r.zellen + ')');
  });

  test('die Gegner der Welle halten Abstand zum Spieler und stehen verteilt', () => {
    for (let i = 2; i <= 7; i++) {
      betreten(i);
      let n = 0;
      for (let k = 0; k < 30 && n === 0; k++) { H.step(1); n = H.run('enemies.countActive(true)'); }
      const r = H.run(`(function () {
        var sc = ${SC};
        var es = enemies.getChildren().filter(function (e) { return e && e.active; });
        // Ausnahmen mit Absicht: Kriegsschar (Bannertraeger + Gefolge),
        // Hinterhalt, Bosse.
        var reg = es.filter(function (e) {
          var fuehrer = es.some(function (f) { return f._scharFuehrer === e; });
          return !e._scharFuehrer && !fuehrer && !e._hinterhalt && !e.isBoss && e !== window.__climaxEnemy;
        });
        var mind = window.SpawnRegeln.mindestAbstand(sc.currentRoom.w, sc.currentRoom.h);
        var d = reg.map(function (e) { return Math.round(Math.hypot(e.x - player.x, e.y - player.y)); });
        var eng = Infinity;
        for (var a = 0; a < reg.length; a++) for (var b = a + 1; b < reg.length; b++)
          eng = Math.min(eng, Math.hypot(reg[a].x - reg[b].x, reg[a].y - reg[b].y));
        return { raum: sc.currentRoom.name, mind: mind, d: d, eng: Math.round(eng), n: reg.length };
      })()`);
      const was = 'Raum ' + i + ' (' + r.raum + ')';
      assert.ok(r.n >= 2, was + ': zu wenig Gegner zum Pruefen (' + r.n + ')');
      r.d.forEach((x) => assert.ok(x >= r.mind, was + ': Gegner ' + x + ' px vom Spieler, Mindestabstand ' + r.mind + ' — ' + JSON.stringify(r.d)));
      // Der Thronsaal laesst weit vom Spieler nur eine Ecke frei — dort
      // stapelte sich die Welle vorher auf zwei, drei Zellen (0 px). Mehr als
      // eine Zelle Abstand gibt die Ecke nicht immer her.
      const eng = r.raum === 'ThroneRoom' ? 24 : 64;
      assert.ok(r.eng >= eng, was + ': zwei Gegner nur ' + r.eng + ' px auseinander');
    }
  });

  test('ohne weiten Platz nimmt der Spawn den entferntesten der gefuetterten Liste', () => {
    // Die Liste liegt offen: nur die 40 Zellen naechst dem Spieler, alle
    // naeher als der Mindestabstand. Vorher zog spawnEnemy hier einen
    // beliebigen Punkt der Tasche.
    betreten(8);
    const r = H.run(`(function () {
      var sc = ${SC};
      enemies.clear(true, true);
      var a = sc._accessibleArea;
      var mind = window.SpawnRegeln.mindestAbstand(sc.currentRoom.w, sc.currentRoom.h);
      var nah = a.reachableCells.map(function (c) { return { x: c.x, y: c.y, d: Math.hypot(c.x - player.x, c.y - player.y) }; })
        .filter(function (c) { return c.d < mind && c.d >= 64 && !isSpawnPositionBlocked(c.x, c.y, 8); })
        .sort(function (p, q) { return p.d - q.d; }).slice(0, 40);
      var weiteste = nah.reduce(function (m, c) { return Math.max(m, c.d); }, 0);
      a.reachableCells = nah.map(function (c) { return { x: c.x, y: c.y }; });
      a.spawnCandidates = a.reachableCells.slice();
      a.fallbackCandidates = a.reachableCells.slice();
      var g = spawnEnemy.call(sc, 0, 0, 1);
      return { liste: nah.length, gefuettert: sc.__letzteGegnerWahl && sc.__letzteGegnerWahl.kandidaten,
        weiteste: Math.round(weiteste), d: g ? Math.round(Math.hypot(g.x - player.x, g.y - player.y)) : -1 };
    })()`);
    assert.ok(r.liste >= 10, 'zu wenig nahe Zellen fuer den Fall: ' + r.liste);
    assert.strictEqual(r.gefuettert, r.liste, 'die Regel bekam nicht die offengelegte Liste');
    assert.ok(r.d >= r.weiteste - 1, 'Gegner ' + r.d + ' px vom Spieler, der weiteste Platz lag ' + r.weiteste + ' px weg');
  });

  test('liegt der Spawn in einer Wand, steht der Spieler nach dem Aufbau frei und kann laufen', () => {
    // Waehrend des Aufbaus (nach der Vorlage, vor Truhen/Treppen) in die Wand.
    H.run(`window.__altEnter = window.EventSystem.onRoomEnter;
      window.EventSystem.onRoomEnter = function () {
        var w = ${DICKSTE_WAND};
        if (w) { var x = w.x + w.w / 2 - 4, y = w.y + w.h / 2 + 26; player.setPosition(x, y); player.body.reset(x, y); }
        window.__inWand = !!w;
      };`);
    try { betreten(10, true); } finally { H.run('window.EventSystem.onRoomEnter = window.__altEnter;'); }
    assert.strictEqual(H.run('window.__inWand'), true, 'kein dicker Wandblock gefunden');
    assert.strictEqual(Math.round(H.run(TIEFE)), 0, 'der Spieler steht nach dem Aufbau noch in der Wand');
    H.run('enemies.clear(true, true)');
    const start = H.run('({ x: player.x, y: player.y })');
    let frei = 0;
    for (const d of ['left', 'right', 'up', 'down']) {
      H.input.hold({ [d]: true }); H.step(10); H.input.releaseAll();
      const q = H.run('({ x: player.x, y: player.y })');
      if (Math.hypot(q.x - start.x, q.y - start.y) >= 6) frei++;
      H.run(`player.body.reset(${start.x}, ${start.y})`); H.step(1);
    }
    assert.ok(frei >= 1, 'keine Richtung frei');
  });

  test('Sicherheitsnetz: wer in der Wand steckt, ist nach gut 0,5 s frei — ohne Schaden', () => {
    betreten(12);
    H.run('enemies.clear(true, true)');
    H.step(2);
    const hp = H.run('playerHealth');
    H.run(`(function () { var w = ${DICKSTE_WAND}; var x = w.x + w.w / 2 - 4, y = w.y + w.h / 2 + 26;
      player.setPosition(x, y); player.body.reset(x, y); })()`);
    assert.ok(H.run(TIEFE) > 10, 'der Spieler steckt gar nicht');
    let k = 0;
    for (; k < 150 && H.run(TIEFE) > 0.5; k++) H.step(1);
    assert.ok(H.run(TIEFE) <= 0.5, 'nach ' + k + ' Bildern steckt er noch');
    assert.ok(k >= 20, 'zu frueh befreit (' + k + ' Bilder) — die Frist ist 0,5 s');
    assert.strictEqual(H.run('playerHealth'), hp, 'das Freistellen hat Schaden gemacht');
  });
});

describe('Hub', () => {
  let H = null;
  const HUB = `window.game.scene.getScene('HubSceneV2')`;
  const HUB_TIEFE = `(function () { var sc = ${HUB}, b = sc.player.body;
    return window.SpawnRegeln.eindringtiefe({ x: b.x, y: b.y, w: b.width, h: b.height },
      window.SpawnRegeln.festeRechtecke([sc.colliderGroup])); })()`;
  const GEBAEUDE = `(function () { var best = null;
    ${HUB}.colliderGroup.getChildren().forEach(function (o) {
      if (!o || !o.body || o.body.enable === false) return; var b = o.body;
      if (b.width < 120 || b.height < 120) return;
      if (!best || b.width * b.height > best.w * best.h) best = { x: b.x, y: b.y, w: b.width, h: b.height };
    }); return best; })()`;
  before(async () => {
    H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
    H.step(10);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Sicherheitsnetz im Hub: in einem Gebaeude steckend nach gut 0,5 s frei', () => {
    const g = H.run(GEBAEUDE);
    assert.ok(g, 'kein grosses Gebaeude im Hub');
    H.run(`(function () { var p = ${HUB}.player; var x = ${g.x + g.w / 2}, y = ${g.y + g.h / 2 + 26};
      p.setPosition(x, y); p.body.reset(x, y); })()`);
    assert.ok(H.run(HUB_TIEFE) > 10, 'die Figur steckt gar nicht');
    let k = 0;
    for (; k < 150 && H.run(HUB_TIEFE) > 0.5; k++) H.step(1);
    assert.ok(H.run(HUB_TIEFE) <= 0.5, 'nach ' + k + ' Bildern steckt die Figur noch');
  });
});
