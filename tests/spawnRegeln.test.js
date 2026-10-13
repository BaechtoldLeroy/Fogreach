// tests/spawnRegeln.test.js — die reinen Spawn-Regeln (js/spawnRegeln.js).
//
// Zwei Meldungen von Leroy:
//  A) "Der Player spawnt manchmal auf Mauern und kann sich dann nicht mehr
//     bewegen."
//  B) "In der Ritual Chamber spawnen die Gegner fast immer beim Spawn des
//     Players, das sollte mehr entfernt sein und mehr verteilt."
//
// Hier nur die Regeln, gefuettert mit offengelegten Listen — ohne Spiel, ohne
// Zufall (Memory: "Statistische Tests vermeiden"). Das Verhalten im echten
// Spiel prueft tests/spawnPlatz.test.js.

const { test } = require('node:test');
const assert = require('node:assert');
const R = require('../js/spawnRegeln.js');

/** Kleiner, fester Zufall (LCG), damit jede Ziehung reproduzierbar ist. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('Mindestabstand haengt an der Raumgroesse (220..300 px)', () => {
  assert.strictEqual(R.mindestAbstand(640, 512), 220, 'kleiner Raum (Treasure_Small)');
  assert.strictEqual(R.mindestAbstand(700, 600), 240);
  assert.strictEqual(R.mindestAbstand(896, 896), 300, 'Ritual Chamber');
  assert.strictEqual(R.mindestAbstand(3000, 2000), 300, 'grosse Raeume wie bisher');
  assert.strictEqual(R.mindestAbstand(0, 0), 300, 'ohne Raummass der alte Wert');
});

test('ein Gegnerplatz haelt den Mindestabstand zum Spieler', () => {
  // 40 Plaetze nah am Spieler, 3 weit weg: die nahen duerfen nie gewinnen.
  const spieler = { x: 400, y: 400 };
  const nah = [];
  for (let i = 0; i < 40; i++) nah.push({ x: 400 + (i % 8) * 16 - 64, y: 400 + Math.floor(i / 8) * 16 - 32 });
  const weit = [{ x: 400, y: 80 }, { x: 760, y: 420 }, { x: 60, y: 700 }];
  const zufall = lcg(7);
  for (let n = 0; n < 20; n++) {
    const p = R.waehleGegnerPlatz(nah.concat(weit), spieler, [], { mindest: 300, zufall });
    assert.ok(d(p, spieler) >= 300, 'Platz ' + JSON.stringify(p) + ' liegt ' + Math.round(d(p, spieler)) + ' px vom Spieler');
  }
});

test('haelt kein Platz den Abstand, wird der entfernteste genommen', () => {
  // So eine Tasche lieferte vorher Gegner auf 0 px (PrisonCells, Ritual Chamber).
  const spieler = { x: 100, y: 100 };
  const liste = [{ x: 110, y: 100 }, { x: 132, y: 132 }, { x: 100, y: 230 }, { x: 140, y: 100 }];
  const p = R.waehleGegnerPlatz(liste, spieler, [], { mindest: 300, zufall: lcg(3) });
  assert.deepStrictEqual(p, { x: 100, y: 230 });
});

test('eine Welle verteilt sich, statt sich zu ballen', () => {
  // 90 Plaetze in einem Haufen, 10 weit gestreut — alle weit genug vom
  // Spieler. Wer nur zufaellig zieht, landet fast immer im Haufen.
  const spieler = { x: 0, y: 0 };
  const zufall = lcg(11);
  const liste = [];
  for (let i = 0; i < 90; i++) liste.push({ x: 1000 + (i % 10) * 6, y: 1000 + Math.floor(i / 10) * 6 });
  const streu = [[400, 1200], [700, 400], [1500, 300], [1800, 1100], [600, 1800],
    [1300, 1700], [2000, 1900], [300, 600], [1700, 600], [900, 2000]];
  streu.forEach(([x, y]) => liste.push({ x, y }));
  const stehen = [];
  for (let n = 0; n < 6; n++) {
    const p = R.waehleGegnerPlatz(liste, spieler, stehen, { mindest: 300, trennung: 140, zufall });
    stehen.push(p);
  }
  let engste = Infinity;
  for (let i = 0; i < stehen.length; i++) for (let j = i + 1; j < stehen.length; j++) engste = Math.min(engste, d(stehen[i], stehen[j]));
  assert.ok(engste >= 140, 'zwei Gegner stehen nur ' + Math.round(engste) + ' px auseinander: ' + JSON.stringify(stehen));
});

test('naechster freier Punkt: Ringsuche, naechster zuerst', () => {
  // Frei ist alles rechts von x = 200.
  const p = R.naechsterFreierPunkt(150, 300, (x) => x > 200, { schritt: 8, maxRadius: 400 });
  assert.ok(p && p.x > 200 && p.x <= 216, 'erwartet knapp hinter der Kante, war ' + JSON.stringify(p));
  assert.strictEqual(p.y, 300, 'quer zur Kante darf er nicht wandern');
  assert.deepStrictEqual(R.naechsterFreierPunkt(10, 10, () => true), { x: 10, y: 10 }, 'freier Start bleibt');
  assert.strictEqual(R.naechsterFreierPunkt(10, 10, () => false, { maxRadius: 40 }), null);
});

test('festgesteckt heisst: in der Wand UND keine Richtung frei', () => {
  const koerper = { x: 100, y: 100, w: 34, h: 56 };
  // Mitten in einem dicken Block.
  assert.strictEqual(R.stecktFest(koerper, [{ x: 0, y: 0, w: 400, h: 400 }]), true);
  // Nur gestreift (2 px): kein Feststecken.
  assert.strictEqual(R.stecktFest(koerper, [{ x: 132, y: 0, w: 100, h: 400 }]), false);
  // 5 px drin, aber ein Ruck nach links befreit: kein Feststecken.
  assert.strictEqual(R.stecktFest(koerper, [{ x: 129, y: 0, w: 100, h: 400 }]), false);
  // Zwischen zwei Waenden eingeklemmt, beide 5 px tief.
  assert.strictEqual(R.stecktFest(koerper, [{ x: 0, y: 0, w: 105, h: 400 }, { x: 129, y: 0, w: 100, h: 400 }]), true);
});

/** Figur wie im Spiel: Koerper 34x56, Fuesse auf der Position. */
function figur(x, y) {
  const s = {
    x, y,
    setPosition(nx, ny) { this.x = nx; this.y = ny; },
    body: { x: 0, y: 0, width: 34, height: 56, reset(nx, ny) { this.x = nx - 13; this.y = ny - 54; } },
  };
  s.body.reset(x, y);
  return s;
}

test('freiStellen holt die Figur aus der Wand auf den naechsten freien Platz', () => {
  // Wand von x 0..300, die Figur steht mit dem Koerper darin.
  const wand = [{ x: 0, y: 0, w: 300, h: 600 }];
  const s = figur(280, 300);
  const p = R.freiStellen(s, wand, { welt: { x: 0, y: 0, w: 1000, h: 1000 } });
  assert.ok(p, 'die Figur wurde nicht versetzt');
  assert.strictEqual(R.eindringtiefe(R.koerperBei(s.x, s.y), wand), 0, 'steht noch in der Wand');
  assert.ok(s.x - 280 <= 40, 'zu weit versetzt: ' + s.x);
  // Freie Figur bleibt, wo sie ist.
  const frei = figur(500, 300);
  assert.strictEqual(R.freiStellen(frei, wand), null);
  assert.strictEqual(frei.x, 500);
});

test('freiStellen nimmt einen ERREICHBAREN Platz, wenn es einen gibt', () => {
  // Links der Wand waere naeher, aber nur rechts ist erreichbar.
  const wand = [{ x: 100, y: 0, w: 60, h: 600 }];
  const s = figur(120, 300);
  R.freiStellen(s, wand, { welt: { x: 0, y: 0, w: 1000, h: 1000 }, erreichbar: (x) => x > 160 });
  assert.ok(s.x > 160, 'auf die unerreichbare Seite gestellt: ' + s.x);
});

test('der Waechter greift erst nach der Frist, und nur beim Feststecken', () => {
  const wand = [{ x: 0, y: 0, w: 400, h: 400 }];
  const s = figur(200, 200);
  s.active = true;
  assert.strictEqual(R.steckWaechter(s, wand, 1000, { grenzeMs: 500 }), null, 'erster Blick: nur merken');
  assert.strictEqual(R.steckWaechter(s, wand, 1400, { grenzeMs: 500 }), null, 'vor der Frist');
  const p = R.steckWaechter(s, wand, 1600, { grenzeMs: 500, welt: { x: 0, y: 0, w: 1000, h: 1000 } });
  assert.ok(p, 'nach 600 ms nicht freigestellt');
  assert.strictEqual(R.eindringtiefe(R.koerperBei(s.x, s.y), wand), 0);
  // Wer frei steht, wird nie bewegt.
  const frei = figur(700, 700); frei.active = true;
  R.steckWaechter(frei, wand, 0); R.steckWaechter(frei, wand, 5000);
  assert.strictEqual(frei.x, 700);
});
