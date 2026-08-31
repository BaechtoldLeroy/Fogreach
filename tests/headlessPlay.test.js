// tests/headlessPlay.test.js — Stufe 2 des Headless-Testsystems (#96).
//
// Stufe 1 (headlessBoot.test.js) prueft nur, dass das Spiel hochkommt. Hier
// wird es tatsaechlich GESPIELT: Einstieg in einen Dungeon-Run, Bewegung und
// Kampf ueber dieselben Codepfade wie echte Eingaben.
//
// Damit ist erstmals automatisiert pruefbar, was bisher nur von Hand ging —
// genau die Klasse Fehler, die zuletzt manuell gefunden wurde (Boss-HP,
// wirkungslose Elite-Affixe, haengende Buttons).
//
// Laufzeit: ~4 s fuer den Dungeon-Einstieg. Ein einziger Run wird von allen
// Faellen geteilt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => { H = await launchDungeon({ depth: 1 }); });
after(async () => { if (H) await H.shutdown(); });

test('play: der Dungeon-Einstieg landet in einer laufenden GameScene', () => {
  assert.ok(H.activeScenes().includes('GameScene'),
    'aktive Szenen: ' + H.activeScenes().join(', '));
});

test('play: die Welt ist bevoelkert (Spieler, Gegner, Tiefe)', () => {
  const w = H.world();
  assert.ok(w.player, 'kein Spieler in der Welt');
  assert.ok(w.hp > 0, 'Spieler ohne Lebenspunkte: ' + w.hp);
  assert.ok(w.enemies > 0, 'keine Gegner gespawnt');
  assert.strictEqual(w.depth, 1, 'unerwartete Tiefe: ' + w.depth);
});

test('play: Richtungseingabe erreicht die Bewegungslogik', async () => {
  // Geprueft wird die GESCHWINDIGKEIT, nicht die zurueckgelegte Strecke:
  // Der Spieler kann zufaellig an einer Wand stehen (prozedurale Raeume), dann
  // bleibt die Position trotz korrekter Eingabe gleich. Die Velocity zeigt
  // dagegen unabhaengig von Kollisionen, ob handlePlayerMovement die Eingabe
  // gelesen hat.
  const vel = () => H.run('(player && player.body) ? { x: player.body.velocity.x, y: player.body.velocity.y } : null');

  H.input.hold({ right: true });
  H.step(4);
  await H.flush();
  const right = vel();
  H.input.releaseAll();
  H.step(4);
  await H.flush();
  const idle = vel();

  assert.ok(right && right.x > 0, 'keine Rechts-Geschwindigkeit: ' + JSON.stringify(right));
  assert.ok(idle && Math.abs(idle.x) < Math.abs(right.x),
    'Geschwindigkeit faellt nach dem Loslassen nicht ab: ' + JSON.stringify(idle));
});

// Der Kampfpfad wird DETERMINISTISCH geprueft: der Spieler wird neben einen
// Gegner gesetzt und schlaegt zu. Bewusst NICHT ueber den Bot — dessen Erfolg
// haengt am prozeduralen Raumlayout (er bleibt an Hindernissen haengen, weil er
// keine Wegfindung hat). Ein Test, der von Raum-Zufall abhaengt, waere flaky.
test('play: ein Nahkampfangriff toetet einen benachbarten Gegner', async () => {
  const before2 = H.world();
  assert.ok(before2.enemyList.length > 0, 'keine Gegner zum Testen da');

  // Spieler direkt neben den ersten Gegner setzen.
  H.run(`(function () {
    var e = enemies.getChildren().filter(function (x) { return x && x.active; })[0];
    if (e && player) { player.x = e.x - 18; player.y = e.y; }
  })()`);

  const killsBefore = H.kills();
  // Mehrere Schlaege: attack() hat eine Sperre (isAttacking/attackCooldown),
  // die zwischen den Versuchen ablaufen muss.
  for (let i = 0; i < 25; i++) {
    H.input.attack();
    H.step(8);
    await H.flush();
    if (H.kills() > killsBefore) break;
  }

  assert.ok(H.kills() > killsBefore,
    'Angriff aus 18 px Entfernung toetete nichts — Kampfpfad defekt?');
});

test('play: der Bot laeuft eine Jagd-Schleife ohne Fehler durch', async () => {
  // Kein Kill-Anspruch (siehe oben) — hier geht es darum, dass Bewegung,
  // Angriff und die Spiel-Loop ueber viele Runden stabil zusammenspielen.
  const res = await H.bot.hunt({ rounds: 60 });
  assert.ok(res.rounds > 0);
  assert.strictEqual(H.hardErrors().length, 0,
    'Fehler waehrend der Bot-Schleife:\n' + H.hardErrors().map((e) => '  ' + e.msg).join('\n'));
});

test('play: der Bot betritt die Treppe, statt sie anzugreifen', async () => {
  // Gezielt aufgesetzt statt einen ganzen Bot-Lauf abzuwarten: ob der Bot in
  // 1500 Runden zufaellig eine Treppe findet, schwankt stark (gemessen: 0 bis
  // 5 Raumwechsel je Lauf) und waere als Zusicherung flaky. Hier wird nur der
  // Treppen-Zweig geprueft, und der ist deterministisch.
  //
  // Der Fehler, den dieser Test festhaelt: die Treppen-Schwelle lag mit 44 px
  // INNERHALB der Angriffsreichweite von 60 px. Der Bot fiel dadurch in den
  // Angriffs-Zweig und drosch auf die Treppe ein, statt sie zu betreten —
  // ueber 600 Runden unveraendert an derselben Stelle, Geschwindigkeit 0.
  const aufbau = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    // Treppen greifen erst ohne Gegner — sonst ist der Bot im Kampf.
    // Erst sammeln, dann zerstoeren: waehrend der Iteration aus der Gruppe zu
    // entfernen ueberspringt Eintraege (dieselbe Falle wie in
    // player.js breakDestructiblesInRange).
    if (enemies && enemies.children) {
      var weg = enemies.getChildren().slice();
      weg.forEach(function (e) { if (e && e.destroy) e.destroy(); });
    }
    if (!sc.stairsGroup || !sc.stairsGroup.children) return { fehler: 'keine Treppengruppe' };
    var s = sc.stairsGroup.getChildren().filter(function (x) { return x && x.active; })[0];
    if (!s) return { fehler: 'keine aktive Treppe' };
    // Knapp ausserhalb der Treppe absetzen — in der Zone zwischen 44 und 60 px,
    // in der die alte Fassung haengen blieb. body.reset() statt x/y zu setzen:
    // sonst bleibt der Physikkoerper an der alten Stelle stehen.
    if (player.body && player.body.reset) player.body.reset(s.x + 55, s.y);
    else { player.x = s.x + 55; player.y = s.y; }
    return { raum: sc.currentRoom ? String(sc.currentRoom.id) : null,
      treppe: { x: Math.round(s.x), y: Math.round(s.y) },
      gegnerUebrig: (enemies && enemies.children)
        ? enemies.getChildren().filter(function (e) { return e && e.active; }).length : -1 };
  })()`);
  assert.ok(!aufbau.fehler, aufbau.fehler);
  assert.strictEqual(aufbau.gegnerUebrig, 0,
    'Aufbau unvollstaendig: noch ' + aufbau.gegnerUebrig + ' Gegner aktiv');

  await H.bot.play({ rounds: 80 });

  const danach = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    return { raum: sc.currentRoom ? String(sc.currentRoom.id) : null,
      p: player ? { x: Math.round(player.x), y: Math.round(player.y) } : null };
  })()`);

  assert.notStrictEqual(danach.raum, aufbau.raum,
    'Raum wechselte nicht — der Bot steht bei ('
    + (danach.p ? danach.p.x + ',' + danach.p.y : '?') + '), Treppe bei ('
    + aufbau.treppe.x + ',' + aufbau.treppe.y + ')');
});

test('play: ein gespielter Run erzeugt keine Konsolenfehler', () => {
  const errs = H.hardErrors();
  assert.strictEqual(errs.length, 0,
    'Fehler waehrend des Spielens:\n' + errs.map((e) => '  ' + e.msg).join('\n'));
});

test('play: eine geschlossene Tuer hat Vorrang vor der Treppe dahinter', async () => {
  // Sonst oeffnet ein einziger E-Druck die Tuer UND nimmt im selben Moment die
  // Treppe dahinter — der Spieler sieht den Raum hinter der Tuer nie.
  // Gegner entfernen und ein paar Frames takten: Treppen werden erst im
  // naechsten Update entsperrt. Ohne diese Pause ist die Treppe im
  // Kontroll-Zweig noch `locked` und der Test schlug sporadisch fehl.
  //
  // Der Fall flatterte danach WEITER (#110). Die dritte und letzte Ursache
  // steckte in der Tuerliste des Raums — siehe die Begruendung unten bei
  // `sc._doors`.
  H.run(`(function () {
    if (enemies && enemies.children) {
      enemies.getChildren().slice().forEach(function (e) { if (e && e.destroy) e.destroy(); });
    }
  })()`);
  await H.settle(() => false, { maxRounds: 8, framesPerRound: 8 });

  const res = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    if (!sc.stairsGroup || !sc.stairsGroup.children) return { fehler: 'keine Treppengruppe' };
    var s = sc.stairsGroup.getChildren().filter(function (x) { return x && x.active; })[0];
    if (!s) return { fehler: 'keine aktive Treppe' };
    // Sperre im Aufbau aufheben: geprueft wird der VORRANG der Tuer, nicht die
    // Entsperr-Regel. Ob eine Treppe gerade entsperrt ist, haengt am Raum, in
    // dem der vorherige Fall gelandet ist — davon darf dieser Test nicht
    // abhaengen (er schlug sonst sporadisch fehl).
    s.setData('locked', false);

    player.body.reset(s.x, s.y);
    window.__MOBILE_INTERACT_ACTIVE__ = true;
    var vorher = String(sc.currentRoom.id);

    // FLATTER-URSACHE (#110), belegt: frueher haengte der Test seine Tuer nur
    // an die ECHTE Tuerliste des Raums an (push/pop). Prozedurale Raeume
    // tragen aber bis zu 21 geschlossene Tueren, und ihr Abstand zur Treppe
    // ist Zufall — gemessen ueber vier Laeufe x sieben Raeume: 190, 365, 93
    // und 210 px. Liegt eine ECHTE Tuer unter 100 px (= DoorSystem.INTERACT_DIST,
    // hier 93 px), blockiert sie die Treppe auch im Kontroll-Zweig, und der
    // Test meldete "Treppe wirkte auch ohne Tuer nicht". Die Tuerliste wird
    // deshalb fuer die Messung KOMPLETT ersetzt, statt nur ergaenzt.
    //
    // Kein Zurueckschreiben noetig: der Kontroll-Zweig wechselt den Raum, und
    // enterRoom leert die Liste ueber DoorSystem.clearDoors an Ort und Stelle
    // und fuellt sie mit den Tueren des neuen Raums.
    var echteTueren = Array.isArray(sc._doors) ? sc._doors : [];
    var naechste = -1;
    for (var i = 0; i < echteTueren.length; i++) {
      var t = echteTueren[i];
      if (!t || !t.active || !t.getData) continue;
      if (t.getData('doorState') !== 'closed') continue;
      var d = Math.hypot(t.x - player.x, t.y - player.y);
      if (naechste < 0 || d < naechste) naechste = Math.round(d);
    }

    // Genau EINE geschlossene Tuer in Reichweite (100 px).
    var tuer = { active: true, x: s.x + 40, y: s.y,
      getData: function (k) { return k === 'doorState' ? 'closed' : null; } };
    sc._doors = [tuer];
    onStairOverlap(player, s);
    var mitTuer = String(sc.currentRoom.id);

    // Ohne JEDE Tuer muss dieselbe Treppe wirken — sonst prueft der Test nichts.
    sc._doors = [];
    onStairOverlap(player, s);
    var ohneTuer = String(sc.currentRoom.id);

    return { vorher: vorher, mitTuer: mitTuer, ohneTuer: ohneTuer,
      raumIndex: (typeof currentRoomId === 'number') ? currentRoomId : null,
      gesamtRaeume: (typeof dungeonRun !== 'undefined' && dungeonRun) ? dungeonRun.totalRooms : null,
      echteTuerenZu: echteTueren.length, naechsteTuerDist: naechste };
  })()`);

  assert.ok(!res.fehler, res.fehler);
  const lage = ` [Raum ${res.vorher} -> ${res.raumIndex} von ${res.gesamtRaeume}, `
    + `${res.echteTuerenZu} echte Tueren im Raum, naechste geschlossene ${res.naechsteTuerDist} px]`;

  // Vorbedingung: hinter dem aktuellen Raum MUSS noch einer liegen. Im letzten
  // Raum fuehrt die Treppe in den Hub statt in den naechsten Raum, dann kann
  // der Kontroll-Zweig die Raum-Nummer gar nicht aendern. Bei Tiefe 1 sind es
  // sieben Raeume und die Vortests stehen bei ~2 — faellt das je auseinander,
  // soll hier eine klare Meldung stehen statt eines Raetsels.
  assert.ok(Number(res.vorher) + 1 < res.gesamtRaeume,
    'Aufbau untauglich: die Treppe fuehrt aus dem letzten Raum in den Hub' + lage);

  assert.strictEqual(res.mitTuer, res.vorher,
    'Treppe loeste trotz geschlossener Tuer in Reichweite aus (' + res.vorher + ' -> ' + res.mitTuer + ')' + lage);
  assert.notStrictEqual(res.ohneTuer, res.vorher,
    'Treppe wirkte auch ohne Tuer nicht — der Test prueft nichts' + lage);
});
