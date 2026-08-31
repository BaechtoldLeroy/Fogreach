// tests/treppenPlatzierung.test.js — Treppenplatzierung (#99).
//
// BEFUND, den diese Tests festhalten: die regulaere Platzierung verfehlte ihr
// Ziel praktisch immer und wurde von Notfallpfaden aufgefangen. Gemessen ueber
// 40 Raeume (`node tools/headless.js --soak 40`):
//     "zu nah an bestehender Treppe"  24-35 Meldungen
//     "Notfall-Treppe erzwungen"       6-11 Raeume  (15-27 %)
//
// URSACHE (im Generator gemessen, nicht am fertigen Raster):
//   1) Die Mindestabstaende kamen aus der RAUM-BOUNDINGBOX. In 30 von 30
//      gemessenen Raeumen war der Spawn-Ausschlusskreis (pi*r^2) GROESSER als
//      die gesamte begehbare Flaeche — im Mittel 3x, im Extremfall 13,5x. Kein
//      Punkt konnte die Regel erfuellen.
//   2) Der Ausweichschritt setzte die Treppe pauschal auf
//      "Spawn + Wandnormale * Schub" — ein einziger, UNGEPRUEFTER Sprung. Da
//      der Spawn am Eingang liegt, schob das jede Treppe in die Raummitte,
//      also auf die Treppe der gegenueberliegenden Tuer. Zwei Tueren derselben
//      Wand landeten sogar auf demselben Punkt. Von 102 Treppen wurden so 33
//      als "zu nah" verworfen, 23 lagen ausserhalb der begehbaren Flaeche und
//      22 in einem Hindernis.
//
// Geprueft werden beide Ursachen einzeln (reine Funktionen) plus die Wirkung
// ueber echt erzeugte Raeume.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');
const { launchDungeon } = require('../tools/headless/index.js');

let spacing;    // stairSpacingForRoom
let candidates; // stairCandidatesFromDoor

before(() => {
  if (!globalThis.window) require('./setup');
  loadGameModule('js/roomManager.js');
  spacing = globalThis.window.stairSpacingForRoom;
  candidates = globalThis.window.stairCandidatesFromDoor;
});

// ---------------------------------------------------------------------------
// Ursache 1: Abstaende muessen von der begehbaren Flaeche gedeckt sein
// ---------------------------------------------------------------------------

test('Abstand: der Spawn-Ausschlusskreis bleibt unter der begehbaren Flaeche', () => {
  // Genau die gemessenen Extremfaelle aus dem Dauerlauf: grosse Raeume mit
  // wenig tatsaechlich begehbarer Flaeche. Vor dem Fix ergab 1280x1024 einen
  // Mindestabstand von 492 px -> Kreis 760 466 px^2 bei 56 320 px^2 begehbar
  // (13,5x). Kein Kandidat konnte die Regel je erfuellen.
  const faelle = [
    { roomW: 1280, roomH: 1024, walkablePx: 56320, doorCount: 4 },
    { roomW: 1216, roomH: 960, walkablePx: 148480, doorCount: 4 },
    { roomW: 1408, roomH: 768, walkablePx: 111616, doorCount: 2 },
    { roomW: 2048, roomH: 1632, walkablePx: 364544, doorCount: 2 },
  ];
  faelle.forEach((f) => {
    const s = spacing(f);
    const kreis = Math.PI * s.minDistance * s.minDistance;
    assert.ok(kreis <= f.walkablePx,
      `${f.roomW}x${f.roomH}: Ausschlusskreis ${Math.round(kreis)} px^2 `
      + `> begehbar ${f.walkablePx} px^2 (Mindestabstand ${Math.round(s.minDistance)})`);
  });
});

test('Abstand: mit N Tueren passen N Treppen in die begehbare Flaeche', () => {
  // Packungsgrenze: N Punkte mit paarweisem Abstand s brauchen grob N*s^2
  // Flaeche. Ist s zu gross gewaehlt, MUSS die Platzierung Treppen verwerfen —
  // genau der "zu nah"-Dauerzustand.
  const faelle = [
    { roomW: 1280, roomH: 1024, walkablePx: 56320, doorCount: 4 },
    { roomW: 1344, roomH: 896, walkablePx: 135168, doorCount: 4 },
    { roomW: 1408, roomH: 896, walkablePx: 264192, doorCount: 2 },
  ];
  faelle.forEach((f) => {
    const s = spacing(f);
    assert.ok(f.doorCount * s.separation * s.separation <= f.walkablePx,
      `${f.roomW}x${f.roomH}: ${f.doorCount} Treppen mit Abstand `
      + `${Math.round(s.separation)} passen nicht in ${f.walkablePx} px^2`);
  });
});

test('Abstand: Treppen ueberlappen nie optisch (Sprite 80 px)', () => {
  // Untergrenze auch dann, wenn die begehbare Flaeche winzig ist.
  const s = spacing({ roomW: 640, roomH: 512, walkablePx: 4096, doorCount: 4 });
  assert.ok(s.separation >= 96, 'Trennabstand unter Sprite-Breite: ' + s.separation);
});

test('Abstand: ohne bekannte Flaeche bleiben die alten Werte stehen', () => {
  // Faellt der BFS aus (walkablePx = 0), darf die Regel nicht auf 0 kippen —
  // sonst klumpen alle Treppen aufeinander.
  const s = spacing({ roomW: 1280, roomH: 1024, walkablePx: 0, doorCount: 4 });
  assert.ok(s.minDistance > 400, 'Rueckfallwert zu klein: ' + s.minDistance);
  assert.ok(s.separation > 400, 'Rueckfallwert zu klein: ' + s.separation);
});

// ---------------------------------------------------------------------------
// Ursache 2: Suchreihe ab der Tuer statt eines ungeprueften Sprungs
// ---------------------------------------------------------------------------

test('Kandidaten: die Reihe beginnt im Rauminneren vor der Tuer', () => {
  const c = candidates({ x: 500, y: 48, dir: 'N' },
    { roomW: 1280, roomH: 1024, inset: 96, step: 48 });
  assert.deepStrictEqual(c[0], { x: 500, y: 144 },
    'erster Kandidat nicht 96 px ins Rauminnere (Wand oben -> nach unten)');
});

test('Kandidaten: die Reihe folgt der Wandnormale jeder Himmelsrichtung', () => {
  const opt = { roomW: 1000, roomH: 1000, inset: 100, step: 48 };
  assert.deepStrictEqual(candidates({ x: 500, y: 20, dir: 'N' }, opt)[0], { x: 500, y: 120 });
  assert.deepStrictEqual(candidates({ x: 500, y: 980, dir: 'S' }, opt)[0], { x: 500, y: 880 });
  assert.deepStrictEqual(candidates({ x: 20, y: 500, dir: 'W' }, opt)[0], { x: 120, y: 500 });
  assert.deepStrictEqual(candidates({ x: 980, y: 500, dir: 'E' }, opt)[0], { x: 880, y: 500 });
});

test('Kandidaten: kein Vorschlag liegt hinter der gegenueberliegenden Wand', () => {
  const c = candidates({ x: 500, y: 48, dir: 'N' },
    { roomW: 1280, roomH: 600, inset: 96, step: 48 });
  c.forEach((p) => assert.ok(p.y <= 600, 'Kandidat ausserhalb des Raums: y=' + p.y));
});

test('Kandidaten: die Reihe reicht ueber den Spawn-Mindestabstand hinaus', () => {
  // DER Regressionspunkt: vorher gab es EINEN Ausweichpunkt. Lag der in einer
  // Wand oder zu nah an der zweiten Treppe, war nichts mehr zu holen. Die Reihe
  // muss deshalb mehrere Punkte jenseits des Mindestabstands anbieten.
  const spawn = { x: 500, y: 48 }; // Spieler steht an der Tuer
  const minDist = 300;
  const c = candidates({ x: 500, y: 48, dir: 'N' },
    { roomW: 1280, roomH: 1024, inset: 96, step: 48, maxDist: 900 });
  const weitGenug = c.filter((p) => Math.hypot(p.x - spawn.x, p.y - spawn.y) >= minDist);
  assert.ok(weitGenug.length >= 10,
    'nur ' + weitGenug.length + ' Kandidaten jenseits des Mindestabstands');
});

test('Kandidaten: zwei Tueren derselben Wand liefern verschiedene Vorschlaege', () => {
  // Vorher landeten beide auf "Spawn + Normale * Schub" — demselben Punkt; die
  // zweite Treppe wurde daher IMMER als "zu nah" verworfen.
  const opt = { roomW: 1472, roomH: 960, inset: 96, step: 48 };
  const a = candidates({ x: 528, y: 912, dir: 'S' }, opt);
  const b = candidates({ x: 1040, y: 912, dir: 'S' }, opt);
  assert.notDeepStrictEqual(a[0], b[0]);
  assert.ok(Math.abs(a[0].x - b[0].x) === 512,
    'die Vorschlaege behalten den Tuerabstand nicht bei');
});

// ---------------------------------------------------------------------------
// Wirkung: echte Raeume durchspielen
// ---------------------------------------------------------------------------

let H = null;
const RAEUME = 12;

test('Raeume: jeder erzeugte Raum hat eine ERREICHBARE Treppe ohne Notfallpfad', async (t) => {
  H = await launchDungeon({ depth: 1 });
  t.after(async () => { if (H) { await H.shutdown(); H = null; } });

  const marke = H.errors.length;
  const berichte = [];
  for (let i = 0; i < RAEUME; i++) {
    H.run(`window.enterRoom(window.game.scene.getScene('GameScene'));`);
    berichte.push(JSON.parse(H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var st = sc.stairsGroup ? sc.stairsGroup.getChildren() : [];
      var erreichbar = 0;
      for (var i = 0; i < st.length; i++) {
        if (typeof sc.isPointAccessible !== 'function'
            || sc.isPointAccessible(st[i].x, st[i].y)) erreichbar++;
      }
      return JSON.stringify({ treppen: st.length, erreichbar: erreichbar });
    })()`)));
    await H.settle(() => false, { maxRounds: 2 });
  }
  const warnungen = H.errors.slice(marke)
    .filter((e) => e.level === 'warn').map((e) => String(e.msg));
  const zahl = (n) => warnungen.filter((w) => w.indexOf(n) >= 0).length;

  berichte.forEach((b, i) => {
    assert.ok(b.treppen > 0, 'Raum ' + i + ' ohne Treppe');
    assert.ok(b.erreichbar > 0, 'Raum ' + i + ' ohne ERREICHBARE Treppe');
  });
  // Der Notfallpfad darf existieren — aber er darf nicht der Normalfall sein.
  assert.strictEqual(zahl('Notfall-Treppe'), 0,
    'Notfall-Treppe feuerte in ' + zahl('Notfall-Treppe') + ' von ' + RAEUME + ' Raeumen');
  // "zu nah" war vorher in ~95 % der Raeume der Normalfall.
  assert.ok(zahl('too close') <= RAEUME * 0.25,
    '"zu nah" ist immer noch der Normalfall: ' + zahl('too close') + ' in ' + RAEUME + ' Raeumen');
  assert.strictEqual(H.hardErrors().length, 0, 'Konsolenfehler waehrend der Raumfolge');
});

test('Raeume: keine Treppe liegt ausserhalb der begehbaren Flaeche', async (t) => {
  const h = await launchDungeon({ depth: 1 });
  t.after(async () => { await h.shutdown(); });
  let gesamt = 0, erreichbar = 0;
  for (let i = 0; i < RAEUME; i++) {
    h.run(`window.enterRoom(window.game.scene.getScene('GameScene'));`);
    const r = JSON.parse(h.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var st = sc.stairsGroup ? sc.stairsGroup.getChildren() : [];
      var ok = 0;
      for (var i = 0; i < st.length; i++) {
        if (typeof sc.isPointAccessible !== 'function'
            || sc.isPointAccessible(st[i].x, st[i].y)) ok++;
      }
      return JSON.stringify({ n: st.length, ok: ok });
    })()`));
    gesamt += r.n;
    erreichbar += r.ok;
    await h.settle(() => false, { maxRounds: 2 });
  }
  // Vor dem Fix: 48 von 68 erreichbar (29 % lagen in Wand oder abgeschnittener
  // Tasche). Die Platzierung zieht jetzt AUS der begehbaren Flaeche.
  assert.strictEqual(erreichbar, gesamt,
    'nur ' + erreichbar + ' von ' + gesamt + ' Treppen erreichbar');
});
