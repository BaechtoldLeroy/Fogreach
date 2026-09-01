// Tests fuer js/roomModeAnchor.js + den scharfgestellten Zustand in
// js/roomModes.js (#112).
//
// Kern der Aenderung: ein Spezialraum startet sein Ziel NICHT mehr beim
// Betreten, sondern erst wenn der Spieler das Ankerobjekt sieht. Bis dahin
// muss sich der Raum in JEDER Hinsicht wie ein normaler Raum verhalten —
// offene Treppe, normale Wellen-Belohnung, normale Gegner-HP.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

function fresh() {
  if (!globalThis.window) require('./setup');
  const w = globalThis.window;
  delete w.RoomMode;
  delete w.RoomModeAnchor;
  delete w.DUNGEON_DEPTH;
  delete w.player;
  delete w.Phaser;
  w.location = { search: '' };
  w.__gesperrt = [];
  w.lockStairs = (scene, lock) => { w.__gesperrt.push(lock); };
  loadGameModule('js/roomModes.js');
  loadGameModule('js/roomModeAnchor.js');
  return w;
}

beforeEach(() => { fresh(); });

// Ein Modus, der stellvertretend fuer defend/survival/hunt steht: er legt
// seinen Anker auf einen festen Punkt und merkt sich, ob start() lief.
function ankerModus(x, y) {
  return function () {
    const s = { gearmt: false, gestartet: false, gestoppt: false };
    return {
      _s: s,
      arm: function () { s.gearmt = true; return { x: x, y: y }; },
      start: function () { s.gestartet = true; },
      stop: function () { s.gestoppt = true; },
      update: function () {},
      isComplete: function () { return false; },
      objectiveFailed: function () { return false; },
      enemyHpMultiplier: function () { return 2; },
      getState: function () { return { mode: 'test' }; }
    };
  };
}

// --- RoomModeAnchor.sichtbar ------------------------------------------------

test('sichtbar: ohne Spieler nie true', () => {
  const A = globalThis.window.RoomModeAnchor;
  assert.strictEqual(A.sichtbar({}, 100, 100), false);
});

test('sichtbar: ohne Sichtpolygon entscheidet der Abstand', () => {
  const w = globalThis.window;
  const A = w.RoomModeAnchor;
  w.player = { x: 0, y: 0 };
  assert.strictEqual(A.sichtbar({}, 100, 0), true, 'in Reichweite');
  assert.strictEqual(A.sichtbar({}, 400, 0), false, 'ausser Reichweite');
  // Genau auf dem Radius liegt noch drin, knapp dahinter nicht mehr.
  assert.strictEqual(A.sichtbar({}, A.SICHT_RADIUS, 0), true);
  assert.strictEqual(A.sichtbar({}, A.SICHT_RADIUS + 1, 0), false);
});

test('sichtbar: ein Punkt hinter der Wand liegt trotz Naehe nicht im Blick', () => {
  const w = globalThis.window;
  const A = w.RoomModeAnchor;
  w.player = { x: 0, y: 0 };
  // Minimal-Phaser: Polygon deckt nur den Bereich x < 50 ab.
  w.Phaser = {
    Geom: {
      Polygon: function (pts) { this.pts = pts; }
    }
  };
  w.Phaser.Geom.Polygon.Contains = (poly, x) => x < 50;
  const scene = { _lastVisionPolygon: [0, 0, 100, 0, 100, 100, 0, 100] };
  assert.strictEqual(A.sichtbar(scene, 20, 0), true, 'vor der Wand');
  assert.strictEqual(A.sichtbar(scene, 80, 0), false, 'hinter der Wand, aber nah');
});

// --- Scharfstellen statt Starten --------------------------------------------

test('beginRoom stellt einen Modus mit arm() nur scharf, ohne ihn zu starten', () => {
  const w = globalThis.window;
  const R = w.RoomMode;
  R.register('test', ankerModus(500, 500));
  w.location.search = '?mode=test';

  w.player = { x: 0, y: 0 };            // weit weg vom Anker
  R.beginRoom({}, { roomIndex: 0, depth: 1 });
  assert.strictEqual(R.activeModeId(), 'test');

  assert.strictEqual(R.isArmed(), true, 'scharfgestellt');
  assert.strictEqual(R.isSpecialRoom(), false, 'noch kein laufendes Spezialziel');
  assert.strictEqual(R.allowWaveClearUnlock(), true, 'Welle clearen oeffnet den Raum normal');
  assert.strictEqual(R.enemyHpMultiplier(), 1, 'noch keine zaeheren Gegner');
  assert.deepStrictEqual(w.__gesperrt, [], 'Treppe noch nicht gesperrt');
});

test('Sichtkontakt startet das Ziel und sperrt erst dann die Treppe', () => {
  const w = globalThis.window;
  const R = w.RoomMode;
  const fabrik = ankerModus(500, 500);
  let inst = null;
  R.register('test', function (ctx) { inst = fabrik(ctx); return inst; });
  w.location.search = '?mode=test';

  w.player = { x: 0, y: 0 };
  R.beginRoom({}, { roomIndex: 0, depth: 1 });
  assert.strictEqual(R.activeModeId(), 'test');

  R.updateActive(16);
  assert.strictEqual(inst._s.gestartet, false, 'weit weg -> nichts passiert');

  w.player = { x: 500, y: 500 };        // vor dem Anker
  R.updateActive(16);

  assert.strictEqual(inst._s.gestartet, true, 'Ziel gestartet');
  assert.strictEqual(R.isArmed(), false);
  assert.strictEqual(R.isSpecialRoom(), true);
  assert.strictEqual(R.enemyHpMultiplier(), 2, 'jetzt gilt der Modus-Zuschlag');
  assert.deepStrictEqual(w.__gesperrt, [true], 'Treppe jetzt gesperrt');
});

test('Ein Modus ohne arm() startet weiter sofort beim Betreten', () => {
  const w = globalThis.window;
  const R = w.RoomMode;
  let gestartet = false;
  R.register('sofort', function () {
    return {
      start: function () { gestartet = true; },
      update: function () {}, isComplete: function () { return false; },
      objectiveFailed: function () { return false; },
      getState: function () { return {}; }
    };
  });
  w.location.search = '?mode=sofort';

  R.beginRoom({}, { roomIndex: 0, depth: 1 });
  assert.strictEqual(R.activeModeId(), 'sofort');
  assert.strictEqual(gestartet, true);
  assert.strictEqual(R.isArmed(), false);
  assert.deepStrictEqual(w.__gesperrt, [true], 'Treppe sofort gesperrt');
});

test('Ohne platzierbaren Anker faellt der Modus auf Sofortstart zurueck', () => {
  const w = globalThis.window;
  const R = w.RoomMode;
  let gestartet = false;
  R.register('ohneplatz', function () {
    return {
      arm: function () { return { x: 0, y: 0 }; },   // (0,0) = nichts gefunden
      start: function () { gestartet = true; },
      update: function () {}, isComplete: function () { return false; },
      objectiveFailed: function () { return false; },
      getState: function () { return {}; }
    };
  });
  w.location.search = '?mode=ohneplatz';

  R.beginRoom({}, { roomIndex: 0, depth: 1 });
  assert.strictEqual(R.activeModeId(), 'ohneplatz');
  assert.strictEqual(R.isArmed(), false, 'nicht auf einen Anker im Nirgendwo warten');
  assert.strictEqual(gestartet, true);
});

// --- Das Angebot verfaellt beim normalen Raum-Clear -------------------------

test('Welle gecleart nimmt ein noch nicht ausgeloestes Ereignis zurueck', () => {
  const w = globalThis.window;
  const R = w.RoomMode;
  const fabrik = ankerModus(500, 500);
  let inst = null;
  R.register('test', function (ctx) { inst = fabrik(ctx); return inst; });
  w.location.search = '?mode=test';

  w.player = { x: 0, y: 0 };
  R.beginRoom({}, { roomIndex: 0, depth: 1 });
  assert.strictEqual(R.activeModeId(), 'test');

  R.onWaveCleared();
  assert.strictEqual(R.isArmed(), false, 'entschaerft');
  assert.strictEqual(inst._s.gestoppt, true, 'Ankerobjekt aufgeraeumt');
  assert.strictEqual(R.activeModeId(), 'clear', 'wieder ein normaler Raum');
  assert.strictEqual(R.allowWaveClearUnlock(), true, 'Belohnung/Unlock laufen normal');

  // Und ein spaeterer Blick auf den Anker darf den Raum NICHT wieder zusperren.
  w.player = { x: 500, y: 500 };
  R.updateActive(16);
  assert.strictEqual(inst._s.gestartet, false);
  assert.deepStrictEqual(w.__gesperrt, [], 'Treppe nie gesperrt');
});

// --- Die echten Modi bringen ihren Anker mit --------------------------------

test('defend und survival stellen ein Objekt hin und raeumen es wieder weg', () => {
  const w = globalThis.window;
  loadGameModule('js/roomModeDefend.js');
  loadGameModule('js/roomModeSurvival.js');
  const R = w.RoomMode;
  ['defend', 'survival'].forEach((id) => {
    const m = R.create(id);
    assert.strictEqual(typeof m.arm, 'function', id + ' braucht arm()');
    assert.strictEqual(typeof m.stop, 'function', id + ' muss seinen Anker aufraeumen koennen');
    assert.strictEqual(typeof m.ankerPunkt, 'undefined', id + ' hat einen FESTEN Anker');
  });
});

test('hunt haengt am Rudel statt an einem hingestellten Objekt', () => {
  const w = globalThis.window;
  loadGameModule('js/roomModeHunt.js');
  const m = w.RoomMode.create('hunt');
  assert.strictEqual(typeof m.arm, 'function');
  assert.strictEqual(typeof m.ankerPunkt, 'function', 'beweglicher Anker');
  assert.strictEqual(m.arm(null), true, 'kein fester Punkt, nur scharfgestellt');
  assert.strictEqual(typeof m.stop, 'undefined', 'nichts hingestellt, nichts wegzuraeumen');
});

test('escape bleibt ohne Anker — die Flucht beginnt beim Betreten', () => {
  loadGameModule('js/roomModeEscape.js');
  const m = globalThis.window.RoomMode.create('escape');
  assert.strictEqual(typeof m.arm, 'undefined');
});

test('defend platziert den Altar in arm(), nicht erst in start()', () => {
  const w = globalThis.window;
  loadGameModule('js/roomModeDefend.js');
  w.player = { x: 700, y: 300 };
  const m = w.RoomMode.create('defend');
  const a = m.arm(null);           // ohne Szene -> Rueckfall auf die Spielerpose
  assert.strictEqual(a.x, 700);
  assert.strictEqual(a.y, 180);    // player.y - 120
  // Der Anker steht schon fest, bevor irgendetwas laeuft.
  assert.strictEqual(m.getState().x, 700);
  assert.strictEqual(m.getState().y, 180);
});

test('mitteImRaum nimmt bei versperrter Mitte den Punkt, der ihr am naechsten liegt', () => {
  const A = globalThis.window.RoomModeAnchor;
  // Die Mitte liegt in einer Wand. pickAccessibleSpawnPoint zieht zufaellig aus
  // einem Vorrat — der erste Treffer kann direkt im Eingang liegen. Gemessen im
  // Spiel landete der Altar so schon 180 px vom Startpunkt entfernt und loeste
  // beim Betreten sofort aus.
  const vorrat = [
    { x: 100, y: 100 },   // weit weg
    { x: 620, y: 500 },   // dicht an der Mitte (640, 512)
    { x: 900, y: 900 },
  ];
  let i = 0;
  const scene = {
    physics: { world: { bounds: { centerX: 640, centerY: 512 } } },
    isPointAccessible: () => false,
    pickAccessibleSpawnPoint: () => vorrat[(i++) % vorrat.length],
  };
  const p = A.mitteImRaum(scene);
  assert.deepStrictEqual(p, { x: 620, y: 500 });
});

test('mitteImRaum nimmt die Raummitte, wenn sie begehbar ist', () => {
  const A = globalThis.window.RoomModeAnchor;
  let gezogen = 0;
  const scene = {
    physics: { world: { bounds: { centerX: 640, centerY: 512 } } },
    isPointAccessible: () => true,
    pickAccessibleSpawnPoint: () => { gezogen++; return { x: 0, y: 0 }; },
  };
  assert.deepStrictEqual(A.mitteImRaum(scene), { x: 640, y: 512 });
  assert.strictEqual(gezogen, 0, 'gar nicht erst nach Ersatz suchen');
});

// --- Rundgang: ?modes=a,b,c ------------------------------------------------

function tourModus(id) {
  globalThis.window.RoomMode.register(id, function () {
    return {
      start: function () {}, update: function () {},
      isComplete: function () { return false; },
      objectiveFailed: function () { return false; },
      getState: function () { return { mode: id }; }
    };
  });
}

test('Rundgang verteilt die Modi der Reihe nach auf die Raeume', () => {
  const w = globalThis.window;
  const R = w.RoomMode;
  ['a', 'b', 'c'].forEach(tourModus);
  w.location.search = '?dungeon=1&modes=a,b,c';

  const gesehen = [];
  for (let raum = 0; raum < 7; raum++) {
    R.beginRoom({}, { roomIndex: raum, depth: 1 });
    gesehen.push(R.activeModeId());
  }
  assert.deepStrictEqual(gesehen, ['a', 'b', 'c', 'a', 'b', 'c', 'a']);
});

test('Rundgang laesst den Bossraum in Ruhe', () => {
  const w = globalThis.window;
  const R = w.RoomMode;
  ['a'].forEach(tourModus);
  w.location.search = '?modes=a';
  R.beginRoom({}, { roomIndex: 3, depth: 1, isBoss: true });
  assert.strictEqual(R.activeModeId(), 'clear');
});

test('Rundgang verwirft unbekannte Namen, statt sie durchzuwinken', () => {
  const w = globalThis.window;
  const R = w.RoomMode;
  ['a'].forEach(tourModus);
  w.location.search = '?modes=gibtsnicht,a';
  // Raum 0 -> erster GUELTIGER Eintrag, Raum 1 -> wieder von vorn.
  R.beginRoom({}, { roomIndex: 0, depth: 1 });
  assert.strictEqual(R.activeModeId(), 'a');
  R.beginRoom({}, { roomIndex: 1, depth: 1 });
  assert.strictEqual(R.activeModeId(), 'a');
});

test('Ist kein Name der Liste bekannt, greift der Rundgang gar nicht', () => {
  const w = globalThis.window;
  const R = w.RoomMode;
  w.location.search = '?modes=quatsch';
  R.beginRoom({}, { roomIndex: 0, depth: 1 });
  assert.strictEqual(R.activeModeId(), 'clear');
});

test('?modes= wird nicht versehentlich als ?mode= gelesen', () => {
  const w = globalThis.window;
  const R = w.RoomMode;
  ['a', 'b'].forEach(tourModus);
  // Beide Schalter stehen im selben Suchstring. Dass sie sich nicht in die
  // Quere kommen, haengt am '=' im Muster ([?&]mode=) — ein Umbau auf
  // Teilstring-Suche waere der wahrscheinlichste Weg, das zu brechen.
  w.location.search = '?modes=a,b';
  R.beginRoom({}, { roomIndex: 1, depth: 1 });
  assert.strictEqual(R.activeModeId(), 'b');
});

test('?mode= gilt weiter nur fuer den ersten Raum', () => {
  const w = globalThis.window;
  const R = w.RoomMode;
  ['a'].forEach(tourModus);
  w.location.search = '?mode=a';
  R.beginRoom({}, { roomIndex: 0, depth: 1 });
  assert.strictEqual(R.activeModeId(), 'a');
  R.beginRoom({}, { roomIndex: 1, depth: 1 });
  assert.notStrictEqual(R.activeModeId(), 'a', 'ab Raum 1 wieder die normale Auswahl');
});

// --- Beweglicher Anker (hunt haengt an einem Gegner, der laeuft) ------------

test('Ein beweglicher Anker wird pro Frame neu erfragt', () => {
  const w = globalThis.window;
  const R = w.RoomMode;
  const mob = { x: 900, y: 900, active: true };
  let gestartet = false, abfragen = 0;
  R.register('jagd', function () {
    return {
      arm: function () { return true; },
      ankerPunkt: function () { abfragen++; return { x: mob.x, y: mob.y }; },
      start: function () { gestartet = true; },
      update: function () {}, isComplete: function () { return false; },
      objectiveFailed: function () { return false; },
      getState: function () { return {}; }
    };
  });
  w.location.search = '?mode=jagd';
  w.player = { x: 0, y: 0 };

  R.beginRoom({}, { roomIndex: 0, depth: 1 });
  assert.strictEqual(R.isArmed(), true, 'scharf, obwohl arm() keinen Punkt lieferte');
  R.updateActive(16);
  assert.strictEqual(gestartet, false, 'Mob weit weg');
  assert.ok(abfragen > 0, 'der Punkt wird ueberhaupt erfragt');

  // Der Mob laeuft heran — ohne dass sich am Raum etwas aendert.
  mob.x = 100; mob.y = 0;
  R.updateActive(16);
  assert.strictEqual(gestartet, true, 'Sichtkontakt zum Mob startet die Jagd');
});

test('Ohne sichtbares Ziel wartet die Jagd, statt loszulaufen', () => {
  const w = globalThis.window;
  const R = w.RoomMode;
  let gestartet = false;
  R.register('jagd', function () {
    return {
      arm: function () { return true; },
      ankerPunkt: function () { return null; },   // Welle noch nicht gespawnt
      start: function () { gestartet = true; },
      update: function () {}, isComplete: function () { return false; },
      objectiveFailed: function () { return false; },
      getState: function () { return {}; }
    };
  });
  w.location.search = '?mode=jagd';
  w.player = { x: 0, y: 0 };

  R.beginRoom({}, { roomIndex: 0, depth: 1 });
  for (let i = 0; i < 5; i++) R.updateActive(16);
  assert.strictEqual(gestartet, false);
  assert.strictEqual(R.isArmed(), true, 'bleibt scharf und wartet');
});

test('hunt: der GESEHENE Gegner wird der Rudelfuehrer', () => {
  const w = globalThis.window;
  loadGameModule('js/roomModeHunt.js');
  const naher = { x: 60, y: 0, active: true, hp: 10, maxHp: 10 };
  const ferner = { x: 900, y: 900, active: true, hp: 10, maxHp: 10 };
  // _pickTarget nimmt ohne EliteEnemies den ersten aktiven Gegner.
  w.enemies = { getChildren: () => [naher, ferner] };

  const m = w.RoomMode.create('hunt');
  assert.strictEqual(m.arm(null), true);
  const p = m.ankerPunkt();
  assert.deepStrictEqual(p, { x: 60, y: 0 }, 'der Kandidat ist der Anker');

  m.start(null);
  assert.strictEqual(naher.__huntTarget, true, 'genau dieser Gegner tritt hervor');
  assert.ok(naher.hp > 10, 'und wird zum Mini-Boss aufgewertet');
  assert.notStrictEqual(ferner.__huntTarget, true);
  assert.strictEqual(m.getState().picked, true);
  delete w.enemies;
});

test('hunt: faellt der Kandidat vor dem Sichtkontakt, rueckt ein anderer nach', () => {
  const w = globalThis.window;
  loadGameModule('js/roomModeHunt.js');
  const erster = { x: 60, y: 0, active: true, hp: 10 };
  const zweiter = { x: 70, y: 0, active: true, hp: 10 };
  w.enemies = { getChildren: () => [erster, zweiter].filter((e) => e.active) };

  const m = w.RoomMode.create('hunt');
  m.arm(null);
  assert.deepStrictEqual(m.ankerPunkt(), { x: 60, y: 0 });
  erster.active = false;
  assert.deepStrictEqual(m.ankerPunkt(), { x: 70, y: 0 }, 'nachgerueckt');
  delete w.enemies;
});
