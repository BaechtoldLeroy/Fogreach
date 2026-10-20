// tests/kegelMisstrauen.test.js: Rueckmeldung zur Nachteskorte (b498).
//
// 1. "Die Kegel von den NPCs muessen groesser sein." Reichweite und Oeffnung
//    aller Kegel in den Spionage-Raeumen wachsen (Wachen und Figuren). Am
//    Verhalten: wer am alten Rand steht, wird jetzt bemerkt; knapp hinter dem
//    neuen Rand nicht. Die Zeichnung liest dieselben Felder (range/halfAngle).
// 2. "Waehrend Misstrauen waechst, soll nicht weggelaufen werden." Wer Dich im
//    Kegel hat und Verdacht schoepft, bleibt stehen und dreht den Blick nach
//    Dir; klingt der Verdacht ab, steht er noch kurz und geht dann weiter.

const { test, beforeEach, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadGameModule } = require('./loadGameModule');

function fresh() {
  if (!globalThis.window) require('./setup');
  delete globalThis.window.EspionageSystem;
  delete globalThis.window.player;
  delete globalThis.window.questSystem;
  delete globalThis.window.applyPlayerDamage;
  loadGameModule('js/espionageSystem.js');
  return globalThis.window.EspionageSystem;
}

function spieler(x, y) {
  const p = { x, y, setTint() {}, clearTint() {}, setPosition(nx, ny) { this.x = nx; this.y = ny; } };
  globalThis.window.player = p;
  return p;
}

// Spielzeit in 60-ms-Schritten (der Takt der Mission).
function takt(E, sekunden, jeSchritt) {
  const n = Math.round(sekunden * 1000 / 60);
  for (let i = 0; i < n; i++) { E.update(null, 0, 60); if (jeSchritt) jeSchritt(i); }
}

function winkelAbstand(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

// Eine Wache der Umschlagstelle (Vorlage: range 160, halfAngle 0.55), still, Blick +x.
function umschlagWache() {
  const tpl = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'js', 'roomTemplates', 'Umschlagstelle.json'), 'utf8'));
  const g = tpl.espionage.guards[0];
  return { x: 0, y: 0, range: g.range, halfAngle: g.halfAngle, facing: 0, scanArc: 0, alert: false };
}

describe('Groessere Kegel', () => {
  beforeEach(() => { fresh(); });

  test('Wache: wer am alten Rand der Reichweite steht, wird jetzt bemerkt', () => {
    const E = window.EspionageSystem;
    const w = umschlagWache();
    spieler(w.range + 15, 0);                              // alter Rand 160, jetzt 200
    E.startMission(null, { missionId: 'm', guards: [w] });
    takt(E, 0.5);
    assert.ok(E.getDetection() > 0, 'am alten Rand (175 px) unbemerkt');
  });

  test('Wache: wer am alten Rand des Winkels steht, wird jetzt bemerkt', () => {
    const E = window.EspionageSystem;
    const w = umschlagWache();
    const a = w.halfAngle + 0.08;                          // alter Halbwinkel 0.55, jetzt 0.66
    spieler(Math.cos(a) * 80, Math.sin(a) * 80);
    E.startMission(null, { missionId: 'm', guards: [w] });
    takt(E, 0.5);
    assert.ok(E.getDetection() > 0, 'am alten Winkelrand unbemerkt');
  });

  test('Wache: knapp hinter dem neuen Rand bleibt man unbemerkt (Zeichnung = Erkennung)', () => {
    const E = window.EspionageSystem;
    // Rote Wache: sie zaehlt auch verkleidet (sonst taucht man ohne Verdacht
    // von selbst wieder in die Verkleidung ab).
    const w = Object.assign(umschlagWache(), { alert: true });
    spieler(0, 0);
    E.startMission(null, { missionId: 'm', guards: [w] });
    E.setDisguise(true);
    const g = E.getState().guards[0];
    // Gezeichnet wird bis g.range und +-g.halfAngle (espionageVisuals): knapp
    // innen bemerkt, knapp aussen nicht.
    window.player.setPosition(g.range + 4, 0);
    takt(E, 0.5);
    assert.strictEqual(E.getDetection(), 0, 'hinter dem gezeichneten Rand bemerkt');
    window.player.setPosition(g.range - 6, 0);
    takt(E, 0.5);
    assert.ok(E.getDetection() > 0, 'innerhalb des gezeichneten Rands unbemerkt');
  });

  test('Schreiber: wer am alten Rand vor dem Pult steht, faellt ihm jetzt auf', () => {
    const E = window.EspionageSystem;
    spieler(-2000, 0);
    E.startMission(null, { missionId: 'm', seed: 7, guards: [{ x: 0, y: 900, range: 100, facing: Math.PI / 2, scanArc: 0 }],
      actors: [{ type: 'schreiber', count: 1, spots: [{ x: 0, y: 0, facing: 0 }] }] });
    E.setDisguise(true);
    const a = E.getState().actors[0];
    const alt = E.ACTOR_TYPES.schreiber.range;             // 105
    // Warten, bis er vom Papier aufsieht (voller Kegel), dann an den alten Rand.
    takt(E, 0.06);
    for (let i = 0; i < 200 && a.range < alt * 1.01; i++) takt(E, 0.06);
    assert.ok(a.range > alt, 'der Schreiber sieht nie auf');
    window.player.setPosition(alt + 5, 0);
    takt(E, 0.4);
    assert.ok(E.getNotice() > 0, 'am alten Rand (110 px) unbemerkt');
  });
});

describe('Misstrauen: stehenbleiben und hinsehen', () => {
  beforeEach(() => { fresh(); });

  test('Wache auf Patrouille bleibt stehen, folgt Dir mit dem Blick und geht nach dem Abklingen weiter', () => {
    const E = window.EspionageSystem;
    spieler(-3000, 0);
    E.startMission(null, { missionId: 'm', guards: [{ x: 0, y: 0, range: 160, halfAngle: 0.55, speed: 50, patrol: [{ x: 0, y: 0 }, { x: 600, y: 0 }] }] });
    const g = E.getState().guards[0];
    takt(E, 2);                                             // losgegangen, Richtung +x
    assert.ok(g.x > 20, 'die Wache geht nicht los');
    E.setDisguise(false);                                   // unverkleidet zaehlt jede Wache
    // Schraeg vor sie: der Verdacht steigt.
    window.player.setPosition(g.x + 110, g.y + 40);
    takt(E, 0.12);
    const x0 = g.x;
    takt(E, 0.5);
    assert.ok(E.getDetection() > 0 && E.getDetection() < 1, 'Verdacht steigt nicht (oder schon enttarnt)');
    assert.ok(Math.abs(g.x - x0) < 0.5, 'die Wache laeuft weiter: ' + (g.x - x0).toFixed(1) + ' px');
    const p = window.player;
    assert.ok(winkelAbstand(g._facing, Math.atan2(p.y - g.y, p.x - g.x)) < 0.1, 'sie sieht Dich nicht an');
    // Ein Stueck zur Seite: der Kegel folgt.
    p.setPosition(g.x + 60, g.y + 70);
    takt(E, 0.4);
    assert.ok(winkelAbstand(g._facing, Math.atan2(p.y - g.y, p.x - g.x)) < 0.1, 'der Kegel folgt Dir nicht');
    assert.ok(Math.abs(g.x - x0) < 0.5, 'die Wache laeuft weiter');
    // Weg aus dem Kegel: sie steht noch, solange der Verdacht abklingt ...
    p.setPosition(-3000, 0);
    takt(E, 0.3);
    assert.ok(E.getDetection() > 0, 'der Verdacht ist sofort weg');
    assert.ok(Math.abs(g.x - x0) < 0.5, 'sie geht schon, waehrend der Verdacht noch abklingt');
    // ... dann verweilt sie kurz und setzt ihren Weg fort.
    takt(E, 4);
    assert.strictEqual(E.getDetection(), 0);
    assert.ok(g.x > x0 + 20, 'die Wache setzt ihren Weg nicht fort');
  });

  test('Diener auf seinem Weg bleibt stehen, solange sein Verdacht waechst, und geht danach weiter', () => {
    const E = window.EspionageSystem;
    spieler(-3000, 0);
    E.startMission(null, { missionId: 'm', seed: 3, guards: [{ x: 0, y: 2000, range: 100, facing: Math.PI / 2, scanArc: 0 }],
      actors: [{ type: 'diener', count: 1, routes: [[{ x: 0, y: 0 }, { x: 800, y: 0 }]] }] });
    E.setDisguise(true);
    const a = E.getState().actors[0];
    // Unterwegs abpassen (nicht an einem Wegpunkt).
    for (let i = 0; i < 400 && !(a.x > 150 && a.x < 650); i++) takt(E, 0.06);
    assert.ok(a.x > 150 && a.x < 650, 'der Diener ist nicht unterwegs');
    const p = window.player;
    p.setPosition(a.x + Math.cos(a._facing + 0.3) * 50, a.y + Math.sin(a._facing + 0.3) * 50);
    takt(E, 0.12);
    const x0 = a.x;
    takt(E, 0.6);
    assert.ok(a._notice > 0 && a._notice < 1, 'sein Verdacht steigt nicht');
    assert.ok(Math.abs(a.x - x0) < 0.5, 'der Diener laeuft weiter: ' + (a.x - x0).toFixed(1) + ' px');
    assert.ok(winkelAbstand(a._facing, Math.atan2(p.y - a.y, p.x - a.x)) < 0.1, 'er sieht Dich nicht an');
    // Zur Seite: der Kegel folgt.
    const seite = a._facing + 0.9;
    p.setPosition(a.x + Math.cos(seite) * 50, a.y + Math.sin(seite) * 50);
    takt(E, 0.4);
    assert.ok(winkelAbstand(a._facing, Math.atan2(p.y - a.y, p.x - a.x)) < 0.1, 'der Kegel folgt Dir nicht');
    // Noch etwas stehenbleiben: der Verdacht waechst weiter, er bleibt dabei.
    takt(E, 1.0);
    assert.ok(a._notice > 0.6 && a._notice < 1, 'Verdacht ' + a._notice.toFixed(2));
    assert.ok(Math.abs(a.x - x0) < 0.5, 'der Diener laeuft weiter');
    // Weg: erst abklingen (laenger als das Verweilen) ...
    p.setPosition(-3000, 0);
    takt(E, 1.4);
    assert.ok(a._notice > 0, 'schon abgeklungen: der Test misst das Abwarten nicht');
    assert.ok(Math.abs(a.x - x0) < 0.5, 'er geht schon, waehrend der Verdacht noch abklingt');
    // ... dann kurz verweilen und weiter.
    takt(E, 4);
    assert.strictEqual(a._notice, 0);
    assert.ok(Math.abs(a.x - x0) > 20, 'der Diener setzt seinen Weg nicht fort');
  });

  test('ohne Verdacht laeuft die Patrouille wie immer (verkleidet an einer normalen Wache vorbei)', () => {
    const E = window.EspionageSystem;
    spieler(-3000, 0);
    E.startMission(null, { missionId: 'm', guards: [{ x: 0, y: 0, range: 160, halfAngle: 0.55, speed: 50, patrol: [{ x: 0, y: 0 }, { x: 600, y: 0 }] }] });
    E.setDisguise(true);
    const g = E.getState().guards[0];
    takt(E, 2);
    window.player.setPosition(g.x + 100, g.y + 30);
    const x0 = g.x;
    takt(E, 0.6);
    assert.strictEqual(E.getDetection(), 0);
    assert.ok(g.x > x0 + 15, 'die Wache bleibt ohne Verdacht stehen');
  });
});
