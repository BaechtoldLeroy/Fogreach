// tests/spionageFiguren.test.js: Spionage-Raeume sind nicht mehr nur mit
// Wachen besetzt (Wunsch: "das braucht noch andere NPCs oder Gegner").
//
// Je Spionage-Quest nennt die Vorlage weitere Figuren: Schreiber am Pult,
// Ritualdiener, Spitzel, Ratsbote, Traeger, Geleerte, Ratten/Brut. Hier wird
// geprueft, dass jede Quest gemischt besetzt ist, dass die Figuren auf Boden
// stehen, und dass jeder Typ sich so verhaelt, wie er soll: wer steht, wer
// geht, wer Dich bemerkt, wer zur Wache rennt und was daraus folgt.

const { test, beforeEach, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadGameModule } = require('./loadGameModule');

// Spionage-Quest -> Raum (wie ESP_MISSIONS in js/roomManager.js).
const QUEST_RAUM = {
  espionage_convoy: 'CouncilWarehouse',
  espionage_archive: 'SealedArchive',
  espionage_informant: 'InformantDen',
  garde_night_escort: 'Umschlagstelle',
  council_collusion_reveal: 'CouncilChamber'
};

function vorlage(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'js', 'roomTemplates', name + '.json'), 'utf8'));
}

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
  const p = { x, y, tint: null, setTint(t) { this.tint = t; }, clearTint() { this.tint = null; },
    setPosition(nx, ny) { this.x = nx; this.y = ny; } };
  globalThis.window.player = p;
  return p;
}

// Spielzeit in 100-ms-Schritten (die Mission rechnet ohnehin im 60-ms-Takt).
function takt(E, sekunden, jeSchritt) {
  for (let t = 0; t < sekunden * 10; t++) { E.update(null, 0, 100); if (jeSchritt) jeSchritt(); }
}

// Eine einzelne Figur des Typs bei (0,0), Blick nach rechts (+x); eine Wache
// weit unten, die vom Spieler wegschaut.
function mitFigur(E, typ, extra) {
  const ort = Object.assign({ x: 0, y: 0, facing: 0 }, extra || {});
  const def = ort.route ? { type: typ, count: 1, routes: [ort.route] } : { type: typ, count: 1, spots: [ort] };
  E.startMission(null, {
    missionId: 'test', seed: 7,
    guards: [{ x: 0, y: 320, range: 150, facing: Math.PI / 2, scanArc: 0.2 }],
    actors: [def]
  });
  E.setDisguise(true);
  return E.getState().actors[0];
}

describe('Besetzung je Spionage-Quest', () => {
  beforeEach(() => { fresh(); });

  Object.keys(QUEST_RAUM).forEach((qid) => {
    const name = QUEST_RAUM[qid];
    test(qid + ' (' + name + '): gemischt, mit Figuren, die Dich bemerken, und solchen, die es nicht tun', () => {
      const E = globalThis.window.EspionageSystem;
      const esp = vorlage(name).espionage;
      const typen = (esp.actors || []).map((a) => a.type);
      assert.ok(typen.length >= 2, name + ': nur ' + typen.join(',') + ' neben den Wachen');
      assert.ok(typen.every((t) => E.ACTOR_TYPES[t]), name + ': unbekannter Typ in ' + typen.join(','));
      assert.ok(typen.some((t) => E.ACTOR_TYPES[t].watcher), name + ': niemand ausser den Wachen bemerkt Dich');
      assert.ok(typen.some((t) => !E.ACTOR_TYPES[t].watcher), name + ': jede Figur ist ein Aufpasser, keiner arbeitet nur');
      assert.ok(typen.some((t) => E.ACTOR_TYPES[t].informer || t === 'schreiber' || t === 'diener'),
        name + ': keine Figur meldet Dich einer Wache');
    });

    test(qid + ' (' + name + '): jede Aufstellung (Zufall des Raums) ist gemischt', () => {
      const E = globalThis.window.EspionageSystem;
      const esp = vorlage(name).espionage;
      const soll = esp.actors.reduce((n, a) => n + Math.min(a.count, (a.routes || a.spots).length), 0);
      const punkt = (w) => ({ x: w.x * 32, y: w.y * 32 });
      for (let seed = 1; seed <= 25; seed++) {
        E.startMission(null, {
          missionId: name, seed,
          guards: esp.guards.map(punkt),
          actors: esp.actors.map((a) => ({ type: a.type, count: a.count,
            spots: (a.spots || []).map((s) => Object.assign(punkt(s), s.facing != null ? { facing: s.facing } : {})),
            routes: (a.routes || []).map((r) => r.map(punkt)) }))
        });
        const st = E.getState();
        assert.strictEqual(st.actors.length, soll, name + ' seed ' + seed + ': Anzahl Figuren');
        assert.ok(new Set(st.actors.map((a) => a.type)).size >= 2, name + ' seed ' + seed + ': nur ein Typ');
        assert.ok(st.guards.length >= 2, name + ': Wachen fehlen');
      }
    });

    test(qid + ' (' + name + '): Figuren stehen und gehen nur auf Boden', () => {
      const t = vorlage(name);
      const wand = (x, y) => { const r = t.layout.walls[Math.floor(y)]; return !r || r[Math.floor(x)] !== '.'; };
      (t.espionage.actors || []).forEach((a) => {
        (a.spots || []).forEach((s) => assert.ok(!wand(s.x, s.y), name + ' ' + a.type + ' steht in der Wand bei ' + s.x + ',' + s.y));
        (a.routes || []).forEach((r) => {
          for (let i = 0; i < r.length; i++) {
            const p = r[i], q = r[(i + 1) % r.length];
            for (let k = 0; k <= 20; k++) {
              const x = p.x + (q.x - p.x) * k / 20, y = p.y + (q.y - p.y) * k / 20;
              assert.ok(!wand(x, y), name + ' ' + a.type + ': Weg ' + JSON.stringify(r) + ' kreuzt die Wand bei ' + x.toFixed(1) + ',' + y.toFixed(1));
            }
          }
        });
      });
    });
  });
});

describe('Verhalten je Figurentyp', () => {
  beforeEach(() => { fresh(); });

  test('Schreiber und Geleerter bleiben an ihrer Station, die anderen gehen ihren Weg', () => {
    const E = globalThis.window.EspionageSystem;
    const weg = [{ x: 0, y: 0 }, { x: 300, y: 0 }];
    const gemessen = {};
    ['schreiber', 'geleerter', 'diener', 'spitzel', 'ratsbote', 'traeger'].forEach((typ) => {
      fresh();
      const E2 = globalThis.window.EspionageSystem;
      spieler(-600, -600);   // weit weg, hinter allen
      const a = mitFigur(E2, typ, (typ === 'schreiber' || typ === 'geleerter') ? {} : { route: weg });
      const x0 = a.x, y0 = a.y;
      takt(E2, 1.5);
      gemessen[typ] = Math.hypot(a.x - x0, a.y - y0);
    });
    assert.strictEqual(gemessen.schreiber, 0, 'der Schreiber verlaesst sein Pult');
    assert.strictEqual(gemessen.geleerter, 0, 'der Geleerte verlaesst seine Station');
    ['diener', 'spitzel', 'ratsbote', 'traeger'].forEach((t) => assert.ok(gemessen[t] > 30, t + ' geht nicht: ' + gemessen[t]));
    assert.ok(gemessen.ratsbote > gemessen.diener * 1.5, 'der Ratsbote eilt nicht: ' + gemessen.ratsbote + ' vs ' + gemessen.diener);
    assert.ok(E, 'Modul geladen');
  });

  test('Geleerter arbeitet: sieht Dich nicht, auch nicht ohne Verkleidung und direkt vor ihm', () => {
    const E = globalThis.window.EspionageSystem;
    spieler(40, 0);
    const a = mitFigur(E, 'geleerter');
    E.setDisguise(false);
    takt(E, 6, () => { globalThis.window.player.x = 40; globalThis.window.player.y = 0; });
    assert.strictEqual(a._notice, 0, 'der Geleerte bemerkt etwas');
    assert.strictEqual(a._mark, null, 'Marke ueber dem Geleerten');
    assert.ok(a._workT > 5, 'der Geleerte arbeitet nicht (Takt der Arbeit)');
    assert.strictEqual(E.getState().barks.length, 0, 'der Geleerte ruft etwas');
    assert.strictEqual(E.getState().guards[0]._invest, null, 'eine Wache wurde gerufen');
  });

  test('Traeger sieht nichts, aber wer ihn anrempelt, macht sich verdaechtig', () => {
    const E = globalThis.window.EspionageSystem;
    const p = spieler(60, 0);
    const a = mitFigur(E, 'traeger', { route: [{ x: 0, y: 0 }, { x: 0, y: 200 }] });
    takt(E, 0.3, () => { p.x = a.x + 60; p.y = a.y; });
    assert.strictEqual(E.getDetection(), 0, 'Hinsehen allein macht den Traeger misstrauisch');
    let hoechst = 0;
    takt(E, 0.3, () => { hoechst = Math.max(hoechst, E.getDetection()); p.x = a.x + 5; p.y = a.y; });
    assert.ok(hoechst > 0.02, 'Anrempeln bleibt folgenlos: ' + hoechst);
    assert.ok(E.getState().barks.some((b) => b.key === 'rempler'), 'kein "Pass doch auf!"');
  });

  test('Schreiber: wer zu lange vor dem Pult steht, nach dem ruft er die Wache', () => {
    const E = globalThis.window.EspionageSystem;
    const p = spieler(40, 0);
    mitFigur(E, 'schreiber');
    let gerufen = false, hoechst = 0, nachsehen = false;
    takt(E, 10, () => {
      p.x = 40; p.y = 0;
      hoechst = Math.max(hoechst, E.getDetection());
      if (E.getState().guards[0]._invest) nachsehen = true;
      if (E.getState().barks.some((b) => b.key === 'ruf_schreiber')) gerufen = true;
    });
    assert.ok(gerufen, 'der Schreiber ruft nicht');
    assert.ok(hoechst >= 0.4, 'der Ruf treibt den Verdacht nicht: ' + hoechst);
    assert.ok(nachsehen, 'keine Wache geht nachsehen');
  });

  test('Diener auf seinem Weg bemerkt Dich und ruft die Wache', () => {
    const E = globalThis.window.EspionageSystem;
    const p = spieler(60, 0);
    const a = mitFigur(E, 'diener', { route: [{ x: 0, y: 0 }, { x: 0, y: 1 }] });
    let gerufen = false;
    takt(E, 8, () => { a._facing = 0; p.x = a.x + 60; p.y = a.y; if (E.getState().barks.some((b) => b.key === 'ruf_diener')) gerufen = true; });
    assert.ok(gerufen, 'der Diener ruft nicht');
  });

  test('Hinter dem Ruecken bemerken Spitzel und Ratsbote nichts', () => {
    ['spitzel', 'ratsbote'].forEach((typ) => {
      fresh();
      const E = globalThis.window.EspionageSystem;
      const p = spieler(-60, 0);
      const a = mitFigur(E, typ);
      takt(E, 4, () => { a._facing = 0; p.x = a.x - 60; p.y = a.y; });
      assert.strictEqual(a._notice, 0, typ + ' sieht nach hinten');
      assert.strictEqual(a._state, 'idle', typ + ' rennt los');
    });
  });

  test('Spitzel erkennt Dich, rennt zur Wache und enttarnt Dich', () => {
    const E = globalThis.window.EspionageSystem;
    const p = spieler(70, 0);
    const a = mitFigur(E, 'spitzel');
    let rannte = false, enttarnt = false, jagt = false;
    takt(E, 12, () => {
      if (a._state === 'report') rannte = true;
      if (E.isDetected()) enttarnt = true;
      if (E.getState().guards[0].hostile) jagt = true;
      if (!rannte) { a._facing = 0; p.x = a.x + 70; p.y = a.y; } else { p.x = -900; p.y = -900; }
    });
    assert.ok(rannte, 'der Spitzel rennt nie los');
    assert.ok(enttarnt, 'die Meldung des Spitzels enttarnt nicht');
    assert.ok(jagt, 'die gemeldete Wache jagt nicht');
  });

  test('Ratsbote meldet: die Wache wird wachsam, enttarnt bist Du noch nicht', () => {
    const E = globalThis.window.EspionageSystem;
    const p = spieler(50, 0);
    const a = mitFigur(E, 'ratsbote');
    let rannte = false, enttarnt = false, hoechst = 0, ruf = false;
    takt(E, 12, () => {
      if (E.getState().barks.some((b) => b.key === 'bote_meldet')) ruf = true;
      if (a._state === 'report') rannte = true;
      if (E.isDetected()) enttarnt = true;
      hoechst = Math.max(hoechst, E.getDetection());
      if (!rannte) { a._facing = 0; p.x = a.x + 50; p.y = a.y; } else { p.x = -900; p.y = -900; }
    });
    const g = E.getState().guards[0];
    assert.ok(rannte, 'der Ratsbote rennt nie los');
    assert.strictEqual(g.alert, true, 'die Wache ist nach der Meldung nicht wachsam');
    assert.strictEqual(enttarnt, false, 'die Meldung des Boten enttarnt sofort');
    assert.ok(hoechst >= 0.25 && hoechst < 1, 'Verdacht nach der Meldung: ' + hoechst);
    assert.ok(ruf, 'kein Ruf des Boten');
  });

  test('Ratsbote abfangen: wer ihn auf dem Weg erwischt, haelt ihn auf, die Wache bleibt ahnungslos', () => {
    const E = globalThis.window.EspionageSystem;
    const p = spieler(50, 0);
    const a = mitFigur(E, 'ratsbote');
    takt(E, 8, () => {
      if (a._state === 'report' || a.knocked) { p.x = a.x; p.y = a.y; }
      else { a._facing = 0; p.x = a.x + 50; p.y = a.y; }
    });
    assert.strictEqual(a.knocked, true, 'der Bote laesst sich nicht abfangen');
    assert.strictEqual(a.quiet, true, 'das Abfangen ist nicht leise');
    assert.notStrictEqual(E.getState().guards[0].alert, true, 'die Wache wurde trotzdem gewarnt');
  });

  test('Ratte bleibt in ihrer Ecke, bis man ihr zu nahe kommt, dann beisst sie', () => {
    const E = globalThis.window.EspionageSystem;
    let biss = 0;
    globalThis.window.applyPlayerDamage = (n) => { biss += n; };
    const p = spieler(600, 0);
    const a = mitFigur(E, 'ratte');
    takt(E, 3);
    assert.ok(Math.hypot(a.x - a._homeX, a.y - a._homeY) < 40, 'die Ratte laeuft davon');
    assert.strictEqual(biss, 0, 'die Ratte beisst ueber 600 px');
    p.x = 60; p.y = 0;
    takt(E, 3);
    assert.strictEqual(a._state, 'chase', 'die Ratte jagt nicht');
    assert.ok(biss > 0, 'die Ratte beisst nicht');
  });
});
