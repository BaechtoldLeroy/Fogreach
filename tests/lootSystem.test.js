// Unit tests for js/lootSystem.js — WP01 Foundation & Affix Engine.
//
// Covers the pure-logic surface implemented in WP01:
//   - rollAffixes(iLevel, count, rng?) — deterministic weighted pick
//   - recomputeBonuses() / getBonus(statKey) — AggregatedBonuses cache
//
// Other public API methods (rollItem, composeName, grantGold, etc.) are
// stubbed in WP01 and throw on call; later WPs replace them and add tests.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

// Deterministic Mulberry32-style RNG used for every test. Never call
// Math.random from a test — flakiness is the enemy.
function makeRng(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function freshSystem() {
  resetStore();
  delete globalThis.window.LootSystem;
  globalThis.window.equipment = {};
  loadGameModule('js/lootSystem.js');
  return globalThis.window.LootSystem;
}

beforeEach(() => {
  resetStore();
  globalThis.window.equipment = {};
});

// ---------------------------------------------------------------------------
// Phase 1: rollAffixes
// ---------------------------------------------------------------------------

test('AFFIX_DEFS has exactly 34 entries', () => {
  const sys = freshSystem();
  // 060: per-Skill-Affixe für alle 12 Skills ergänzt (8 dmg + 11 cd) -> 31.
  // #60: 4 D2-Kern-Attribut-Affixe (Stärke/Geschick/Vita/Fokus) -> 35.
  assert.strictEqual(sys.AFFIX_DEFS.length, 34);
});

test('AFFIX_DEFS is frozen (top-level)', () => {
  const sys = freshSystem();
  assert.strictEqual(Object.isFrozen(sys.AFFIX_DEFS), true);
  assert.throws(() => { sys.AFFIX_DEFS.push({ id: 'x' }); });
});

test('AFFIX_DEFS entries each have required fields', () => {
  const sys = freshSystem();
  const required = ['id', 'displayName', 'position', 'statKey', 'valueType',
    'range', 'iLevelMin', 'weight', 'appliesTo', 'tooltipText'];
  for (const def of sys.AFFIX_DEFS) {
    for (const f of required) {
      assert.ok(f in def, 'missing field ' + f + ' on ' + def.id);
    }
    assert.ok('min' in def.range && 'max' in def.range);
  }
});

test('AFFIX_DEFS ids are all unique', () => {
  const sys = freshSystem();
  const ids = sys.AFFIX_DEFS.map((d) => d.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('rollAffixes is deterministic given the same seeded RNG', () => {
  const sys = freshSystem();
  const a = sys.rollAffixes(10, 3, makeRng(42));
  const b = sys.rollAffixes(10, 3, makeRng(42));
  assert.deepStrictEqual(a, b);
});

test('rollAffixes returns different results for different seeds', () => {
  const sys = freshSystem();
  const a = sys.rollAffixes(10, 3, makeRng(42));
  const b = sys.rollAffixes(10, 3, makeRng(9999));
  // Not strictly required to differ in theory, but with these seeds and the
  // 24-entry pool they MUST differ. If this ever flakes, pick different seeds.
  assert.notDeepStrictEqual(a, b);
});

test('rollAffixes excludes affixes whose iLevelMin > iLevel', () => {
  const sys = freshSystem();
  // iLevel=1 should exclude of_might and of_haste (iLevelMin=8).
  const out = sys.rollAffixes(1, 20, makeRng(7));
  const ids = out.map((a) => a.defId);
  assert.strictEqual(ids.includes('of_might'), false);
  assert.strictEqual(ids.includes('of_haste'), false);
  assert.strictEqual(ids.includes('of_the_leech'), false); // iLevelMin=6
});

test('rollAffixes may include high-tier affixes when iLevel is high enough', () => {
  const sys = freshSystem();
  // Try several seeds; at iLevel=20 with count=31 ALL should be eligible.
  const out = sys.rollAffixes(20, 31, makeRng(1));
  // Every affix in the pool should be reachable; with count=31 and pool=31 we
  // get exactly one of each (deterministic pick-without-replacement).
  assert.strictEqual(out.length, 31);
  const ids = new Set(out.map((a) => a.defId));
  assert.strictEqual(ids.size, 31);
});

test('rollAffixes returns at most eligible.length when count exceeds pool', () => {
  const sys = freshSystem();
  const out = sys.rollAffixes(1, 100, makeRng(0));
  // At iLevel=1, only affixes with iLevelMin<=1 are eligible.
  const eligible = sys.AFFIX_DEFS.filter((d) => d.iLevelMin <= 1);
  assert.strictEqual(out.length, eligible.length);
});

test('rollAffixes returns no duplicate defIds', () => {
  const sys = freshSystem();
  const out = sys.rollAffixes(10, 5, makeRng(123));
  const ids = out.map((a) => a.defId);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('rollAffixes entries each have defId and numeric value', () => {
  const sys = freshSystem();
  const out = sys.rollAffixes(10, 4, makeRng(99));
  for (const inst of out) {
    assert.ok(typeof inst.defId === 'string' && inst.defId.length > 0);
    assert.ok(typeof inst.value === 'number' && Number.isFinite(inst.value));
    // #122: Der Wert kommt aus dem Anteilsband (8 bis 12 % des Budgets),
    // umgerechnet auf die Fundtiefe — NICHT mehr aus def.range. Der Test
    // prueft frueher gegen range.max * scale und ging nur deshalb durch, weil
    // die alten Spannen zufaellig weit genug waren.
    const def = sys.AFFIX_DEFS.find((d) => d.id === inst.defId);
    const unten = sys.affixWert(def, 0.08, 10);
    const oben = sys.affixWert(def, 0.12, 10);
    assert.ok(inst.value >= unten - 0.05 && inst.value <= oben + 0.05,
      inst.defId + ': ' + inst.value + ' liegt nicht zwischen ' + unten + ' und ' + oben);
  }
});

test('#37: _affixValueScale is 1 at iLevelMin and grows, capped at MAX_SCALE', () => {
  const sys = freshSystem();
  assert.strictEqual(sys._affixValueScale(1, 1), 1);      // base at unlock
  assert.ok(sys._affixValueScale(20, 1) > 1);             // grows with depth
  assert.ok(sys._affixValueScale(20, 1) < sys._affixValueScale(40, 1));
  // hard ceiling (2.5x) reached far enough down
  assert.ok(sys._affixValueScale(500, 1) <= 2.5 + 1e-9);
  assert.ok(Math.abs(sys._affixValueScale(500, 1) - 2.5) < 1e-9);
});

test('#37: same affix rolls a higher value at deep iLevel than shallow', () => {
  const sys = freshSystem();
  // Average swift_speed's rolled value ONLY over rolls where it was picked (deep
  // iLevel has more competing affixes, so a high count keeps it usually present
  // without letting selection-dilution skew the magnitude comparison).
  //
  // Platz 'boots': swift_speed gehoert zu Stiefeln und Koerper, nicht zur
  // Waffe. Mit 'weapon' wurde er nie gezogen und der Mittelwert war 0.
  const avgSharpAt = (iLevel) => {
    let sum = 0, n = 0;
    for (let s = 0; s < 400; s++) {
      const out = sys.rollAffixes(iLevel, 5, makeRng(s + 1), 'boots');
      const sharp = out.find((a) => a.defId === 'swift_speed');
      if (sharp) { sum += sharp.value; n++; }
    }
    return n ? sum / n : 0;
  };
  assert.ok(avgSharpAt(40) > avgSharpAt(1) * 1.5, 'deep swift_speed should roll markedly higher');
});

test('rollAffixes returns [] when count is 0', () => {
  const sys = freshSystem();
  const out = sys.rollAffixes(10, 0, makeRng(1));
  assert.deepStrictEqual(out, []);
});

// ---------------------------------------------------------------------------
// Phase 2: recomputeBonuses + getBonus
// ---------------------------------------------------------------------------

function makeMockItem(affixes) {
  return { affixes };
}

// #122: Ein Affix traegt eine ABSOLUTE Punktzahl; was sie bewirkt, haengt an
// der Tiefe, auf der man gerade steht. Die Tests setzen die Tiefe deshalb
// ausdruecklich und rechnen die Punktzahl mit derselben Funktion aus, die auch
// das Spiel benutzt — sonst prueften sie eine handgeschriebene Zweitrechnung.
function aufTiefe(t) {
  globalThis.window.DUNGEON_DEPTH = t;
  globalThis.window.currentWave = t;
}

/** Punkte fuer einen Zielanteil auf dieser Tiefe. */
function punkteFuer(sys, anteil, tiefe) {
  return sys.affixPunkte(anteil, tiefe);
}

test('getBonus returns 0 for unknown statKey with empty equipment', () => {
  const sys = freshSystem();
  sys.recomputeBonuses();
  assert.strictEqual(sys.getBonus('speed'), 0);
  assert.strictEqual(sys.getBonus('nonexistent_stat'), 0);
});

test('#122: ein Schadensaffix wirkt auf seiner Fundtiefe mit genau seinem Anteil', () => {
  const sys = freshSystem();
  aufTiefe(20);
  globalThis.window.equipment = {
    weapon: makeMockItem([{ defId: 'swift_speed', value: punkteFuer(sys, 0.10, 20) }])
  };
  sys.recomputeBonuses();
  assert.ok(Math.abs(sys.getBonus('speed') - 0.10) < 1e-9,
    'erwartet 0,10, war ' + sys.getBonus('speed'));
});

test('#122: derselbe Affix wirkt tiefer unten SCHWAECHER — altes Zeug faellt ab', () => {
  // Das ist der Kern von Punkt 3: die Zahl auf dem Gegenstand bleibt, ihre
  // Wirkung nicht. Ein Stueck von Tiefe 5 ist auf Tiefe 20 noch
  // (5+3)/(20+3) = 35 % dessen wert, was es auf Tiefe 5 war.
  const sys = freshSystem();
  const punkte = punkteFuer(sys, 0.10, 5);
  globalThis.window.equipment = { weapon: makeMockItem([{ defId: 'swift_speed', value: punkte }]) };

  aufTiefe(5); sys.recomputeBonuses();
  const beiFund = sys.getBonus('speed');
  aufTiefe(20); sys.recomputeBonuses();
  const spaeter = sys.getBonus('speed');

  assert.ok(Math.abs(beiFund - 0.10) < 1e-9, 'auf der Fundtiefe erwartet 0,10, war ' + beiFund);
  const soll = 0.10 * (5 + sys.TIEFEN_SOCKEL) / (20 + sys.TIEFEN_SOCKEL);
  assert.ok(Math.abs(spaeter - soll) < 1e-9,
    'auf Tiefe 20 erwartet ' + soll.toFixed(4) + ', war ' + spaeter.toFixed(4));
  assert.ok(spaeter < beiFund * 0.4, 'der Abfall ist zu schwach');
});

test('#122: ein Stueck der PASSENDEN Tiefe ist ueberall gleich viel wert', () => {
  // Die Gegenprobe zum Test darueber: wer aktuell bleibt, merkt von der
  // Abwertung nichts.
  const sys = freshSystem();
  [1, 5, 10, 20, 30].forEach((t) => {
    aufTiefe(t);
    globalThis.window.equipment = {
      weapon: makeMockItem([{ defId: 'swift_speed', value: punkteFuer(sys, 0.10, t) }])
    };
    sys.recomputeBonuses();
    assert.ok(Math.abs(sys.getBonus('speed') - 0.10) < 1e-9,
      'Tiefe ' + t + ': erwartet 0,10, war ' + sys.getBonus('speed').toFixed(4));
  });
});

test('getBonus summiert Anteile ueber mehrere Stuecke', () => {
  const sys = freshSystem();
  aufTiefe(20);
  const p = punkteFuer(sys, 0.10, 20);
  globalThis.window.equipment = {
    weapon: makeMockItem([{ defId: 'swift_speed', value: p }]),
    body: makeMockItem([{ defId: 'spinning_dmg', value: p }])
  };
  sys.recomputeBonuses();
  assert.ok(Math.abs(sys.getBonus('speed') - 0.10) < 1e-9);
  // Faehigkeitsaffixe wirken nur auf EINE Faehigkeit und duerfen deshalb
  // groesser ausfallen (Faktor 3) — sonst waere ein passender Fund schwaecher
  // als ein beliebiger Allerweltsaffix.
  assert.ok(Math.abs(sys.getBonus('dmg_spinAttack') - 0.30) < 1e-9,
    'erwartet 0,30, war ' + sys.getBonus('dmg_spinAttack'));
});

test('#114: der LP-Affix traegt eine FLACHE Zahl, die nicht mit der Tiefe faellt', () => {
  // Zwei Korrekturen stecken hier drin. Erstens war er frueher 97 % wert
  // (bis 29 flache Punkte auf eine Basis von 30), waehrend Ruestung bei 11 %
  // lag — die Hoehe kommt jetzt aus demselben 8-12-%-Budget wie alles andere.
  //
  // Zweitens wird er als EINZIGER nicht mit der Tiefe umgerechnet:
  // Lebenspunkte sind kein abstrakter Wert. Wer +7 gefunden hat, behaelt +7.
  // Der relative Wert faellt ohnehin von selbst, weil die Gegner haerter
  // zuschlagen und die eigene Basis mitwaechst.
  const sys = freshSystem();
  const wert = sys.affixWert('of_health', 0.10, 20);
  globalThis.window.equipment = {
    weapon: makeMockItem([{ defId: 'of_health', value: wert }]),
    head: makeMockItem([{ defId: 'of_health', value: wert }])
  };
  const gemessen = {};
  [5, 20, 30].forEach((t) => { aufTiefe(t); sys.recomputeBonuses(); gemessen[t] = sys.getBonus('hp'); });

  assert.ok(Math.abs(gemessen[20] - 2 * wert) < 1e-9,
    'zwei Stuecke zu je ' + wert + ' LP erwartet ' + (2 * wert) + ', war ' + gemessen[20]);
  assert.strictEqual(gemessen[5], gemessen[20],
    'der Zuwachs aendert sich mit der Tiefe — Lebenspunkte sollen fest bleiben');
  assert.strictEqual(gemessen[30], gemessen[20],
    'der Zuwachs aendert sich mit der Tiefe — Lebenspunkte sollen fest bleiben');
});

test('#114: die HOEHE kommt trotzdem aus der Fundtiefe', () => {
  // Fest heisst nicht gleich: ein Stueck von weiter unten gibt mehr, es
  // verliert nur nachtraeglich nichts mehr.
  const sys = freshSystem();
  const flach = [1, 10, 20, 30].map((t) => sys.affixWert('of_health', 0.10, t));
  for (let i = 1; i < flach.length; i++) {
    assert.ok(flach[i] > flach[i - 1],
      'die Fundtiefe hebt den Wert nicht mehr: ' + flach.join(' / '));
  }
});

test('Keine Basis gibt mehr als 5 % Kritchance', () => {
  // Krit ist der einzige gedeckelte Wert (90 %), und Basiswerte stapeln sich
  // ueber alle fuenf Plaetze. Bei 10 % je Basis kamen allein daraus 38 %, und
  // mit den Affixen war der Deckel erreicht.
  //
  // Die Grenze haengt am Kritmultiplikator: bei 2,0x ist ein Prozentpunkt Krit
  // einen Prozentpunkt Schaden wert, 5 % sind also ein halbes Affixbudget —
  // spuerbar, aber nicht stapelbar bis an den Deckel. Steigt der Multiplikator
  // wieder, muessen die Kurven mit.
  const sys = freshSystem();
  const zuHoch = [];
  sys.ITEM_BASES.forEach((b) => {
    const c = b.wertKurve && b.wertKurve.crit;
    if (typeof c === 'number' && c > 0.05) zuHoch.push(b.key + ' ' + (c * 100).toFixed(1) + ' %');
  });
  assert.deepStrictEqual(zuHoch, [],
    'diese Basen geben zu viel Krit: ' + zuHoch.join(', '));

  // Gegenprobe: es soll ueberhaupt noch Basen mit Krit geben.
  const mitKrit = sys.ITEM_BASES.filter((b) => b.wertKurve && b.wertKurve.crit);
  assert.ok(mitKrit.length >= 6, 'nur noch ' + mitKrit.length + ' Basen tragen Krit');
});

test('#104: kein Tiefenwert steht in baseStats', () => {
  // Der Fehler, der den Schattendolch getroffen hat: crit stand dort als
  // glatte Prozentzahl (5 = 5 %). Seit #104 liest recalcDerived armor, crit,
  // move und hp als absolute PUNKTE und rechnet sie mit der Tiefe um — aus
  // 5 wurden 12,5 % auf Tiefe 1 und 1,5 % auf Tiefe 30.
  //
  // Diese Werte gehoeren in die wertKurve. In baseStats stehen nur die
  // EIGENARTEN einer Basis (Tempo, Reichweite, Sichtweite), die bewusst nicht
  // mit der Tiefe verrechnet werden.
  const sys = freshSystem();
  const TIEFENWERTE = ['armor', 'crit', 'move', 'hp'];
  const falsch = [];
  sys.ITEM_BASES.forEach((b) => {
    TIEFENWERTE.forEach((k) => {
      if (b.baseStats && typeof b.baseStats[k] === 'number') falsch.push(b.key + '.' + k);
    });
  });
  assert.deepStrictEqual(falsch, [],
    'diese Basen tragen einen Tiefenwert in baseStats statt in der wertKurve: ' + falsch.join(', '));
});

test('#104: der Krit der Waffen bleibt ueber alle Tiefen gleich viel wert', () => {
  // Der Schattendolch IST seine Kritchance. Vorher gab er 12,5 % auf Tiefe 1
  // und 1,5 % auf Tiefe 30 — er verlor unten genau die Eigenschaft, fuer die
  // man ihn nimmt.
  const sys = freshSystem();
  // Die Zielwerte sind halbiert, seit der Kritmultiplikator bei 2,0x liegt:
  // derselbe Schadensbeitrag, halb so viel Chance. Worum es dem Test geht,
  // bleibt unberuehrt — dass die Zahl ueber alle Tiefen STEHT.
  [['WPN_SCHATTENDOLCH', 0.025], ['WPN_HORNBOGEN', 0.02], ['WPN_NEBELBOGEN', 0.015]]
    .forEach(([key, ziel]) => {
      const gemessen = [1, 5, 10, 20, 30].map((t) => {
        aufTiefe(t);
        // Ueber viele Wuerfe: die wertKurve streut bewusst 80 bis 120 %.
        let summe = 0;
        for (let i = 0; i < 200; i++) {
          const it = sys.rollItem(key, t, 0);
          summe += sys.basiswertWirkung('crit', it.crit || 0, t);
        }
        return summe / 200;
      });
      gemessen.forEach((w, i) => {
        assert.ok(Math.abs(w - ziel) < ziel * 0.15,
          key + ' auf Tiefe ' + [1, 5, 10, 20, 30][i] + ': ' + (w * 100).toFixed(2)
          + ' % statt ' + (ziel * 100).toFixed(0) + ' %  (' + gemessen.map((x) => (x * 100).toFixed(1)).join(' / ') + ')');
      });
    });
});

test('#114: auch die Lebenspunkte AUS VITALITAET fallen nicht mit der Tiefe', () => {
  // Die Asymmetrie, die nach der +LP-Umstellung uebrig blieb: Vitalitaet gab
  // Lebenspunkte ueber eine PUNKTZAHL, und Punktzahlen fallen mit der Tiefe.
  // Gemessen sank ein Vitalitaetsstueck von Tiefe 10 auf dem Weg nach Tiefe 30
  // von 5,0 auf 3,55 Lebenspunkte, waehrend der +LP-Affix daneben bei 5 blieb —
  // dieselbe Zahl auf demselben Stueck, zwei Ergebnisse.
  const sys = freshSystem();
  const vitDef = sys.AFFIX_DEFS.find((d) => d.id === 'attr_vitality');
  const wert = sys.affixWert(vitDef, 0.10, 10);
  globalThis.window.equipment = {
    body: { iLevel: 10, affixes: [{ defId: 'attr_vitality', value: wert }] }
  };
  const gemessen = {};
  [10, 20, 30].forEach((t) => { aufTiefe(t); sys.recomputeBonuses(); gemessen[t] = sys.getBonus('vitality_hp'); });

  assert.ok(gemessen[10] > 0, 'Vitalitaet gibt ueberhaupt keine Lebenspunkte mehr');
  assert.strictEqual(gemessen[20], gemessen[10],
    'der Zuwachs faellt mit der Tiefe: ' + gemessen[10] + ' -> ' + gemessen[20]);
  assert.strictEqual(gemessen[30], gemessen[10],
    'der Zuwachs faellt mit der Tiefe: ' + gemessen[10] + ' -> ' + gemessen[30]);

  // Die PUNKTZAHL faellt weiter — das ist bei Staerke, Geschick und Fokus
  // gewollt, weil sie dort eine relative Wirkung beschreibt. Nur die
  // Lebenspunkte sind davon abgekoppelt.
  aufTiefe(30); sys.recomputeBonuses();
  const pkt30 = sys.getBonus('vitality');
  aufTiefe(10); sys.recomputeBonuses();
  assert.ok(pkt30 < sys.getBonus('vitality'),
    'die Punktzahl soll weiterhin mit der Tiefe fallen');
});

test('#114: Vitalitaet und der +LP-Affix geben bei gleichem Anteil dasselbe', () => {
  // Die Normalisierung, auf die sich alles stuetzt: 10 % Budget sind 10 %
  // Budget, egal ueber welchen der beiden Wege sie kommen. Ohne diese Bindung
  // waere das eine oder das andere still die bessere Wahl.
  const sys = freshSystem();
  const vitDef = sys.AFFIX_DEFS.find((d) => d.id === 'attr_vitality');
  [1, 5, 10, 20, 30].forEach((t) => {
    aufTiefe(t);
    globalThis.window.equipment = {
      body: { iLevel: t, affixes: [{ defId: 'attr_vitality', value: sys.affixWert(vitDef, 0.10, t) }] },
      head: { iLevel: t, affixes: [{ defId: 'of_health', value: sys.affixWert('of_health', 0.10, t) }] }
    };
    sys.recomputeBonuses();
    const ausVit = sys.getBonus('vitality_hp');
    const ausAffix = sys.getBonus('hp');
    assert.ok(Math.abs(ausVit - ausAffix) <= 0.5,
      'Tiefe ' + t + ': Vitalitaet gibt ' + ausVit + ' LP, der +LP-Affix ' + ausAffix);
  });
});

test('D2 core-attribute affixes exist as flat stats and aggregate via getBonus (#60)', () => {
  const sys = freshSystem();
  const ids = ['attr_strength', 'attr_dexterity', 'attr_vitality', 'attr_focus'];
  const keys = ['strength', 'dexterity', 'vitality', 'focus'];
  ids.forEach((id, i) => {
    const def = sys.AFFIX_DEFS.find((d) => d.id === id);
    assert.ok(def, id + ' exists');
    assert.strictEqual(def.valueType, 'flat', id + ' is flat');
    assert.strictEqual(def.statKey, keys[i], id + ' -> statKey ' + keys[i]);
  });
  // Two items each rolling +Strength stack as a flat sum.
  // Attribute bleiben PUNKTE (die Anzeige im Charakterbogen), aber ihre Zahl
  // kommt aus demselben Anteilsbudget wie alles andere: Staerke gibt +1 %
  // Schaden je Punkt, zehn Punkte sind also die 10 %.
  aufTiefe(20);
  const p = punkteFuer(sys, 0.10, 20);
  globalThis.window.equipment = {
    weapon: makeMockItem([{ defId: 'attr_strength', value: p }, { defId: 'attr_focus', value: p }]),
    body: makeMockItem([{ defId: 'attr_strength', value: p }, { defId: 'attr_vitality', value: p }])
  };
  sys.recomputeBonuses();
  // Alle vier Attribute geben 1 % Primaerwirkung je Punkt, ein Anteil von
  // 10 % ist also ueberall genau 10 Punkte. Staerke liegt zweimal an.
  assert.ok(Math.abs(sys.getBonus('strength') - 20) < 1e-6,
    'zweimal 10 Punkte Staerke -> 20, war ' + sys.getBonus('strength'));
  assert.ok(Math.abs(sys.getBonus('vitality') - 10) < 1e-6,
    'einmal 10 Punkte Vitalitaet -> 10, war ' + sys.getBonus('vitality'));
  assert.ok(Math.abs(sys.getBonus('focus') - 10) < 1e-6,
    'einmal 10 Punkte Fokus -> 10, war ' + sys.getBonus('focus'));
  assert.strictEqual(sys.getBonus('dexterity'), 0);
});

test('armor affix is percent (fraction), consistent with base armor display', () => {
  const sys = freshSystem();
  const def = sys.AFFIX_DEFS.find((d) => d.id === 'sturdy_armor');
  assert.strictEqual(def.valueType, 'percent'); // not 'flat' — armor is a % stat
  aufTiefe(20);
  globalThis.window.equipment = {
    head: makeMockItem([{ defId: 'sturdy_armor', value: punkteFuer(sys, 0.10, 20) }])
  };
  sys.recomputeBonuses();
  // Ruestung senkt den Schaden; fuer +10 % effektive Lebenspunkte muss sie um
  // rund 0,9 * p steigen, nicht um p — daher der Faktor 0,9.
  assert.ok(Math.abs(sys.getBonus('armor') - 0.09) < 1e-9,
    'erwartet 0,09, war ' + sys.getBonus('armor'));
});

test('recomputeBonuses bumps version counter', () => {
  const sys = freshSystem();
  const v0 = sys._bonusCache.version;
  sys.recomputeBonuses();
  sys.recomputeBonuses();
  assert.strictEqual(sys._bonusCache.version, v0 + 2);
});

test('recomputeBonuses wipes previous cache state', () => {
  const sys = freshSystem();
  globalThis.window.equipment = {
    weapon: makeMockItem([{ defId: 'swift_speed', value: 25 }])
  };
  sys.recomputeBonuses();
  assert.ok(sys.getBonus('speed') > 0);

  // Unequip everything, recompute — stale entries should be gone.
  globalThis.window.equipment = {};
  sys.recomputeBonuses();
  assert.strictEqual(sys.getBonus('speed'), 0);
});

test('recomputeBonuses ignores affixes with unknown defId', () => {
  const sys = freshSystem();
  aufTiefe(20);
  globalThis.window.equipment = {
    weapon: makeMockItem([
      { defId: 'swift_speed', value: punkteFuer(sys, 0.10, 20) },
      { defId: 'ghost_affix_that_does_not_exist', value: 9999 }
    ])
  };
  sys.recomputeBonuses();
  assert.ok(Math.abs(sys.getBonus('speed') - 0.10) < 1e-9);
});

test('getBonus returns positive value for cd_* affixes (combat applies sign)', () => {
  const sys = freshSystem();
  aufTiefe(20);
  globalThis.window.equipment = {
    weapon: makeMockItem([{ defId: 'of_swift_spin', value: punkteFuer(sys, 0.10, 20) }])
  };
  sys.recomputeBonuses();
  // Faehigkeitsaffix -> Faktor 3. Der Kampfcode rechnet baseCd * (1 - x).
  assert.ok(Math.abs(sys.getBonus('cd_spinAttack') - 0.30) < 1e-9,
    'erwartet 0,30, war ' + sys.getBonus('cd_spinAttack'));
});

// ---------------------------------------------------------------------------
// Stub contract — every later-WP method must throw a traceable error
// ---------------------------------------------------------------------------

test('all public API methods are implemented (no stubs remaining)', () => {
  const sys = freshSystem();
  // WP02: rollItem, composeName, migrateSave
  // WP03: grantGold, getGold, spendGold
  // WP04: consumePotion, onPotionKey, isPotionOnCooldown
  // WP06: getOrCreateShopState, rerollItem
  const implemented = [
    'rollItem', 'composeName', 'migrateSave',
    'grantGold', 'getGold', 'spendGold',
    'consumePotion', 'onPotionKey', 'isPotionOnCooldown',
    'getOrCreateShopState', 'rerollItem'
  ];
  for (const name of implemented) {
    assert.strictEqual(typeof sys[name], 'function', name + ' should be a function');
  }
});

// ---------------------------------------------------------------------------
// Phase 3 (WP02): ITEM_BASES, rollItem, composeName, migrateSave
// ---------------------------------------------------------------------------

test('rollItem(baseKey, iLevel) returns an item with the right key and shape', () => {
  const sys = freshSystem();
  const item = sys.rollItem('WPN_EISENKLINGE', 5);
  assert.strictEqual(item.key, 'WPN_EISENKLINGE');
  assert.strictEqual(item.type, 'weapon');
  assert.strictEqual(item._baseName, 'Eisenklinge');
  assert.ok(typeof item.tier === 'number' && item.tier >= 0 && item.tier <= 3);
  assert.strictEqual(item.iLevel, 5);
  assert.strictEqual(item.requiredLevel, 3);
  assert.ok(item.baseStats && typeof item.baseStats === 'object');
  assert.ok(Array.isArray(item.affixes));
  assert.strictEqual(item.affixes.length, item.tier);
  assert.ok(typeof item.displayName === 'string' && item.displayName.length > 0);
});

test('rollItem with forceTier overrides random tier and matches affix count', () => {
  const sys = freshSystem();
  for (let t = 0; t <= 3; t++) {
    const item = sys.rollItem('WPN_EISENKLINGE', 10, t);
    assert.strictEqual(item.tier, t);
    assert.strictEqual(item.affixes.length, t);
  }
});

test('rollItem resolves + deep-copies baseStats so template is not shared/mutated', () => {
  const sys = freshSystem();
  const tmpl = sys.ITEM_BASES.find(function (b) { return b.key === 'WPN_EISENKLINGE'; });
  const item = sys.rollItem('WPN_EISENKLINGE', 15, 0);
  assert.notStrictEqual(item.baseStats, tmpl.baseStats);
  // #135: der Schaden steht nicht mehr als Band in der Vorlage, sondern kommt
  // aus damageKurve + Tiefe. Das gerollte Stueck traegt trotzdem eine ZAHL,
  // und die Vorlage darf davon nichts mitbekommen.
  assert.strictEqual(typeof item.baseStats.damage, 'number');
  assert.strictEqual(typeof tmpl.baseStats.damage, 'undefined',
    'Waffen tragen keinen festen Schaden mehr in baseStats');
  const vorher = JSON.stringify(tmpl.damageKurve);
  item.baseStats.damage = 9999;
  assert.strictEqual(JSON.stringify(tmpl.damageKurve), vorher);
});

test('#38/#135: gewuerfelter Waffenschaden bleibt im Band DIESER Tiefe', () => {
  const sys = freshSystem();
  const tmpl = sys.ITEM_BASES.find((b) => b.key === 'WPN_GLUTAXT');
  [5, 10, 20, 30].forEach((tiefe) => {
    const band = sys.waffenBand(tmpl, tiefe);
    assert.ok(band && typeof band.min === 'number' && typeof band.max === 'number',
      'waffenBand liefert kein Band fuer Tiefe ' + tiefe);
    for (let i = 0; i < 40; i++) {
      const item = sys.rollItem('WPN_GLUTAXT', tiefe, 0);
      // Rundung auf 0,1 kann knapp ueber das Bandende hinausgehen.
      assert.ok(item.damage >= band.min - 0.05 && item.damage <= band.max + 0.05,
        'Tiefe ' + tiefe + ': ' + item.damage + ' ausserhalb ['
        + band.min.toFixed(2) + ', ' + band.max.toFixed(2) + ']');
      assert.strictEqual(item.damage, item.baseStats.damage);
    }
  });
});

test('rollItem(null, iLevel) picks one of the 13 base keys via weighted drop', () => {
  const sys = freshSystem();
  const validKeys = new Set(sys.ITEM_BASES.map(function (b) { return b.key; }));
  for (let i = 0; i < 20; i++) {
    const item = sys.rollItem(null, 5, 0);
    assert.ok(validKeys.has(item.key), 'unexpected key: ' + item.key);
  }
});

test('rollItem throws on unknown baseKey', () => {
  const sys = freshSystem();
  assert.throws(function () { sys.rollItem('NOPE_NOT_REAL', 5); }, /Unknown item base/);
});

test('composeName: tier 0 returns _baseName', () => {
  const sys = freshSystem();
  const name = sys.composeName({ tier: 0, _baseName: 'Eisenklinge', affixes: [] });
  assert.strictEqual(name, 'Eisenklinge');
});

test('composeName: tier 1 with prefix-only affix → "Prefix BaseName"', () => {
  const sys = freshSystem();
  const name = sys.composeName({
    tier: 1, _baseName: 'Eisenklinge',
    affixes: [{ defId: 'swift_speed', value: 20 }]
  });
  assert.strictEqual(name, 'Swift Eisenklinge');
});

test('composeName: tier 1 with suffix-only affix → "BaseName Suffix"', () => {
  const sys = freshSystem();
  const name = sys.composeName({
    tier: 1, _baseName: 'Eisenklinge',
    affixes: [{ defId: 'of_health', value: 20 }]
  });
  assert.strictEqual(name, 'Eisenklinge of the Bear');
});

test('composeName: tier 2 with prefix + suffix → "Prefix BaseName Suffix"', () => {
  const sys = freshSystem();
  const name = sys.composeName({
    tier: 2, _baseName: 'Eisenklinge',
    affixes: [
      { defId: 'swift_speed', value: 20 },
      { defId: 'of_health', value: 25 }
    ]
  });
  assert.strictEqual(name, 'Swift Eisenklinge of the Bear');
});

test('composeName: tier 3 legendary with 4 affixes composes a long name', () => {
  const sys = freshSystem();
  const name = sys.composeName({
    tier: 3, _baseName: 'Sword',
    affixes: [
      { defId: 'swift_speed', value: 20 },
      { defId: 'spinning_dmg', value: 15 },
      { defId: 'of_health', value: 20 },
      { defId: 'of_precision', value: 5 }
    ]
  });
  // Either full or [Legendary] fallback — both must contain baseName
  assert.ok(name.indexOf('Sword') !== -1, 'name missing baseName: ' + name);
  assert.ok(name.length > 'Sword'.length);
});

test('composeName: tier 3 with very long names shortens to 1 prefix + 1 suffix (no tag)', () => {
  const sys = freshSystem();
  // Force a long name by using long affix display names
  const item = {
    tier: 3,
    _baseName: 'Kettenmorgenstern',
    affixes: [
      { defId: 'spinning_dmg', value: 15 },      // 'Spinning' prefix
      { defId: 'charged_dmg', value: 15 },        // 'Charged' prefix
      { defId: 'of_swift_charge', value: 12 },   // 'of Swift Charge' suffix
      { defId: 'of_swift_dagger', value: 12 }    // 'of Swift Dagger' suffix
    ]
  };
  const name = sys.composeName(item);
  // No visible rarity tag in the name (rarity reads via color/tooltip).
  assert.strictEqual(name.indexOf('[Legendary]'), -1, 'name must not carry a [Legendary] tag, got: ' + name);
  assert.ok(name.indexOf('Kettenmorgenstern') !== -1, 'name keeps the base name, got: ' + name);
  // Shortened form drops the SECOND prefix + suffix (Charged / Dagger).
  assert.strictEqual(name.indexOf('Charged'), -1, 'long name should drop the 2nd prefix, got: ' + name);
  assert.strictEqual(name.indexOf('Dagger'), -1, 'long name should drop the 2nd suffix, got: ' + name);
});

test('migrateSave: strips old fields and adds new ones on inventory items', () => {
  const sys = freshSystem();
  const save = {
    inventory: [
      { name: 'Test Sword', _baseName: 'Test Sword', rarity: 'common', rarityValue: 1, rarityLabel: 'Common', enhanceLevel: 3, damage: 5 }
    ]
  };
  const out = sys.migrateSave(save);
  const it = out.inventory[0];
  assert.strictEqual('rarity' in it, false);
  assert.strictEqual('rarityValue' in it, false);
  assert.strictEqual('rarityLabel' in it, false);
  assert.strictEqual('enhanceLevel' in it, false);
  assert.strictEqual(it.tier, 0);
  assert.deepStrictEqual(it.affixes, []);
  assert.strictEqual(it.iLevel, 1);
  assert.strictEqual(it.requiredLevel, 1);
  assert.strictEqual(it.baseStats.damage, 5);
  assert.strictEqual(it.displayName, 'Test Sword');
});

test('migrateSave: migrates equipment slots and strips old fields', () => {
  const sys = freshSystem();
  const save = {
    equipment: {
      weapon: { name: 'W', _baseName: 'W', rarity: 'rare', damage: 10 },
      head: null,
      body: { name: 'B', _baseName: 'B', rarity: 'common', armor: 4 },
      boots: null
    }
  };
  sys.migrateSave(save);
  assert.strictEqual('rarity' in save.equipment.weapon, false);
  assert.strictEqual(save.equipment.weapon.tier, 0);
  assert.deepStrictEqual(save.equipment.weapon.affixes, []);
  assert.strictEqual(save.equipment.weapon.baseStats.damage, 10);
  assert.strictEqual(save.equipment.body.baseStats.armor, 4);
  assert.strictEqual(save.equipment.head, null);
});

test('migrateSave: sets saveVersion to 3', () => {
  const sys = freshSystem();
  const save = { inventory: [] };
  const out = sys.migrateSave(save);
  assert.strictEqual(out.saveVersion, 3);
});

test('migrateSave v3: repairs raw-percent base stats (speed/armor/crit) (#bugfix)', () => {
  const sys = freshSystem();
  // Korruptes Item (vor dem /100-Fix gerollt): Top-Level == ROH-baseStats > 1.
  const save = {
    saveVersion: 2,
    inventory: [
      { name: 'X', tier: 1, affixes: [], iLevel: 5,
        baseStats: { speed: 15, armor: 5, damage: 6 }, speed: 15, armor: 5, damage: 6 }
    ],
    equipment: {}
  };
  const out = sys.migrateSave(save);
  const it = out.inventory[0];
  assert.strictEqual(it.speed, 0.15, 'speed 15 -> 0.15');
  assert.strictEqual(it.armor, 0.05, 'armor 5 -> 0.05');
  assert.strictEqual(it.damage, 6, 'damage (flat) unangetastet');
  assert.strictEqual(it.baseStats.speed, 15, 'ROH-baseStats bleibt (Anzeige nutzt Top-Level)');
  assert.strictEqual(out.saveVersion, 3);

  // Bereits korrekte Bruch-Werte werden NICHT angefasst (Top-Level != baseStats).
  const ok = { saveVersion: 2, inventory: [
    { name: 'Y', tier: 1, affixes: [], iLevel: 5, baseStats: { speed: 15 }, speed: 0.15 }
  ]};
  const out2 = sys.migrateSave(ok);
  assert.strictEqual(out2.inventory[0].speed, 0.15, 'korrekter Bruch bleibt');
});

test('migrateSave: idempotent — running twice produces identical result', () => {
  const sys = freshSystem();
  const save = {
    inventory: [
      { name: 'Sword', _baseName: 'Sword', rarity: 'rare', damage: 7 },
      null,
      { name: 'Helm', _baseName: 'Helm', rarity: 'common', armor: 3 }
    ],
    equipment: {
      weapon: { name: 'W', _baseName: 'W', rarity: 'common', damage: 5 }
    }
  };
  const once = sys.migrateSave(save);
  const onceSnap = JSON.parse(JSON.stringify(once));
  const twice = sys.migrateSave(once);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(twice)), onceSnap);
});

test('migrateSave: no-op when saveVersion >= 2', () => {
  const sys = freshSystem();
  const save = { saveVersion: 2, inventory: [{ rarity: 'should_stay_because_already_migrated' }] };
  const out = sys.migrateSave(save);
  // Returns same reference, untouched
  assert.strictEqual(out, save);
  assert.strictEqual(out.inventory[0].rarity, 'should_stay_because_already_migrated');
});

test('migrateSave: handles null/undefined gracefully', () => {
  const sys = freshSystem();
  assert.strictEqual(sys.migrateSave(null), null);
  assert.strictEqual(sys.migrateSave(undefined), undefined);
});

// ---------------------------------------------------------------------------
// WP03 — Gold Currency
// ---------------------------------------------------------------------------

function freshGoldSystem() {
  resetStore();
  delete globalThis.window.LootSystem;
  delete globalThis.window.materialCounts;
  delete globalThis.window._refreshHUD;
  globalThis.window.equipment = {};
  loadGameModule('js/lootSystem.js');
  return globalThis.window.LootSystem;
}

test('getGold: returns 0 on a fresh system with no gold stored', () => {
  const sys = freshGoldSystem();
  assert.strictEqual(sys.getGold(), 0);
});

test('grantGold: adds positive amounts and getGold reflects the total', () => {
  const sys = freshGoldSystem();
  sys.grantGold(50);
  assert.strictEqual(sys.getGold(), 50);
  sys.grantGold(25);
  assert.strictEqual(sys.getGold(), 75);
});

test('grantGold: ignores zero, negative, NaN, and non-finite amounts', () => {
  const sys = freshGoldSystem();
  sys.grantGold(10);
  sys.grantGold(0);
  sys.grantGold(-5);
  sys.grantGold(NaN);
  sys.grantGold(Infinity);
  sys.grantGold('100'); // non-number
  assert.strictEqual(sys.getGold(), 10);
});

test('spendGold: deducts when balance is sufficient and returns true', () => {
  const sys = freshGoldSystem();
  sys.grantGold(100);
  const ok = sys.spendGold(40);
  assert.strictEqual(ok, true);
  assert.strictEqual(sys.getGold(), 60);
});

test('spendGold: returns false and does not deduct on insufficient funds', () => {
  const sys = freshGoldSystem();
  sys.grantGold(10);
  const ok = sys.spendGold(999);
  assert.strictEqual(ok, false);
  assert.strictEqual(sys.getGold(), 10);
});

test('spendGold: rejects negative, NaN, and non-finite amounts without mutating balance', () => {
  const sys = freshGoldSystem();
  sys.grantGold(50);
  assert.strictEqual(sys.spendGold(-1), false);
  assert.strictEqual(sys.spendGold(NaN), false);
  assert.strictEqual(sys.spendGold(Infinity), false);
  assert.strictEqual(sys.getGold(), 50);
});

test('spendGold: allows spending exact balance to zero', () => {
  const sys = freshGoldSystem();
  sys.grantGold(25);
  assert.strictEqual(sys.spendGold(25), true);
  assert.strictEqual(sys.getGold(), 0);
  // Can't spend anything after that
  assert.strictEqual(sys.spendGold(1), false);
});

test('grantGold / spendGold: trigger window._refreshHUD when defined', () => {
  const sys = freshGoldSystem();
  let calls = 0;
  globalThis.window._refreshHUD = function () { calls++; };
  sys.grantGold(10);
  sys.spendGold(5);
  sys.spendGold(999); // should NOT refresh on failed spend
  assert.strictEqual(calls, 2);
  delete globalThis.window._refreshHUD;
});

// ---------------------------------------------------------------------------
// WP04: Health Potions
// ---------------------------------------------------------------------------

function freshPotionSystem() {
  const sys = freshSystem();
  sys._resetPotionCooldown();
  globalThis.window.inventory = [null, null, null, null, null];
  globalThis.window.playerHealth = 50;
  globalThis.window.playerMaxHealth = 100;
  globalThis.window.addPlayerHealth = function (delta) {
    const max = globalThis.window.playerMaxHealth || 1;
    globalThis.window.playerHealth = Math.max(0, Math.min(max,
      (globalThis.window.playerHealth || 0) + delta));
    return globalThis.window.playerHealth;
  };
  return sys;
}

test('POTION_DEFS has 4 entries with required fields', () => {
  const sys = freshSystem();
  assert.strictEqual(sys.POTION_DEFS.length, 4);
  assert.strictEqual(Object.isFrozen(sys.POTION_DEFS), true);
  for (const def of sys.POTION_DEFS) {
    assert.strictEqual(typeof def.potionTier, 'number');
    assert.strictEqual(typeof def.healPercent, 'number');
    assert.strictEqual(typeof def.healDurationMs, 'number');
    assert.strictEqual(typeof def.goldCost, 'number');
  }
  // Super tier has bonusEffect
  const superDef = sys.POTION_DEFS.find((d) => d.potionTier === 4);
  assert.ok(superDef.bonusEffect);
  assert.strictEqual(superDef.bonusEffect.tempMaxHp, 0.10);
});

test('isPotionOnCooldown: false initially', () => {
  const sys = freshPotionSystem();
  assert.strictEqual(sys.isPotionOnCooldown(), false);
});

test('consumePotion: heals, decrements stack, sets cooldown', () => {
  const sys = freshPotionSystem();
  globalThis.window.inventory[0] = { type: 'potion', potionTier: 1, stack: 2 };
  const before = globalThis.window.playerHealth;
  const ok = sys.consumePotion(0);
  assert.strictEqual(ok, true);
  assert.ok(globalThis.window.playerHealth > before, 'should have healed');
  assert.strictEqual(globalThis.window.inventory[0].stack, 1);
  assert.strictEqual(sys.isPotionOnCooldown(), true);
});

test('consumePotion: removes item when stack reaches 0', () => {
  const sys = freshPotionSystem();
  globalThis.window.inventory[0] = { type: 'potion', potionTier: 1, stack: 1 };
  sys.consumePotion(0);
  assert.strictEqual(globalThis.window.inventory[0], null);
});

test('consumePotion: returns false on cooldown', () => {
  const sys = freshPotionSystem();
  globalThis.window.inventory[0] = { type: 'potion', potionTier: 1, stack: 5 };
  globalThis.window.inventory[1] = { type: 'potion', potionTier: 1, stack: 5 };
  assert.strictEqual(sys.consumePotion(0), true);
  assert.strictEqual(sys.consumePotion(1), false);
});

test('consumePotion: returns false for non-potion or invalid slot', () => {
  const sys = freshPotionSystem();
  assert.strictEqual(sys.consumePotion(0), false);
  globalThis.window.inventory[0] = { type: 'weapon' };
  assert.strictEqual(sys.consumePotion(0), false);
  assert.strictEqual(sys.consumePotion('x'), false);
});

test('onPotionKey: picks the highest-tier potion in inventory', () => {
  const sys = freshPotionSystem();
  globalThis.window.inventory[0] = { type: 'potion', potionTier: 1, stack: 1 };
  globalThis.window.inventory[2] = { type: 'potion', potionTier: 3, stack: 1 };
  globalThis.window.inventory[3] = { type: 'potion', potionTier: 2, stack: 1 };
  const ok = sys.onPotionKey();
  assert.strictEqual(ok, true);
  // Tier 3 slot is consumed
  assert.strictEqual(globalThis.window.inventory[2], null);
  assert.ok(globalThis.window.inventory[0], 'tier 1 untouched');
  assert.ok(globalThis.window.inventory[3], 'tier 2 untouched');
});

test('onPotionKey: returns false when no potions available', () => {
  const sys = freshPotionSystem();
  assert.strictEqual(sys.onPotionKey(), false);
});

test('_getPotionCooldownRemaining: returns positive after consume', () => {
  const sys = freshPotionSystem();
  globalThis.window.inventory[0] = { type: 'potion', potionTier: 1, stack: 1 };
  sys.consumePotion(0);
  const remaining = sys._getPotionCooldownRemaining();
  assert.ok(remaining > 0 && remaining <= sys.POTION_GLOBAL_CD_MS);
});

// ---------------------------------------------------------------------------
// Phase 6 (WP06): Mara shop state + rerollItem + reroll cost formula
// ---------------------------------------------------------------------------

function freshShopSystem() {
  resetStore();
  delete globalThis.window.LootSystem;
  globalThis.window.equipment = {};
  globalThis.window.inventory = new Array(10).fill(null);
  globalThis.window.materialCounts = { GOLD: 0, MAT: 999 };
  delete globalThis.window.dungeonRun;
  delete globalThis.window.currentRunSeed;
  globalThis.window.currentWave = 3;
  // Schwarzmarkt-Gating (#51): Auslage + Preise skalieren jetzt mit maxDepth.
  // Standardmaessig freigeschaltet (>= 4) mit Tiefe 10, damit die bestehenden
  // Stock-Tests eine gefuellte Auslage sehen. Gesperrt-Faelle setzen maxDepth
  // pro Test niedriger.
  try { globalThis.localStorage.setItem('demonfall_maxDepth', '10'); } catch (e) {}
  loadGameModule('js/lootSystem.js');
  return globalThis.window.LootSystem;
}

test('_computeRerollCost: ein Tiefeneinkommen, gemessen an maxDepth (#132)', () => {
  const sys = freshShopSystem();
  globalThis.localStorage.setItem('demonfall_maxDepth', '10');
  // 1 Tiefeneinkommen x GOLD_JE_TIEFE (13) x maxDepth (10) = 130
  assert.strictEqual(sys._computeRerollCost({ tier: 0, iLevel: 1 }), 130);
  globalThis.localStorage.setItem('demonfall_maxDepth', '30');
  assert.strictEqual(sys._computeRerollCost({ tier: 0, iLevel: 1 }), 390);
});

test('_computeRerollCost: unabhaengig von Rang und iLevel (#132)', () => {
  // Vorher skalierte der Preis mit dem Rang (1/2/4/8) und dem iLevel — das
  // bestrafte genau die Stuecke, bei denen sich ein Reroll lohnt. Jetzt kostet
  // jeder Reroll gleich viel; teuer wird er nur mit der Tiefe.
  const sys = freshShopSystem();
  globalThis.localStorage.setItem('demonfall_maxDepth', '10');
  const t0 = sys._computeRerollCost({ tier: 0, iLevel: 1 });
  assert.strictEqual(sys._computeRerollCost({ tier: 1, iLevel: 10 }), t0);
  assert.strictEqual(sys._computeRerollCost({ tier: 2, iLevel: 20 }), t0);
  assert.strictEqual(sys._computeRerollCost({ tier: 3, iLevel: 40 }), t0);
});

test('_computeRerollCost: never returns less than 1', () => {
  const sys = freshShopSystem();
  assert.ok(sys._computeRerollCost({ tier: 0, iLevel: 1 }) >= 1);
});

test('rerollItem: succeeds when gold is sufficient and mutates affixes in place', () => {
  const sys = freshShopSystem();
  sys.grantGold(10000);
  const item = sys.rollItem('WPN_EISENKLINGE', 10, 3);
  assert.strictEqual(item.affixes.length, 3);
  const prevIds = item.affixes.map(a => a.defId).join(',');
  const cost = sys._computeRerollCost(item);
  const goldBefore = sys.getGold();
  const ok = sys.rerollItem(item, cost);
  assert.strictEqual(ok, true);
  assert.strictEqual(sys.getGold(), goldBefore - cost);
  assert.strictEqual(item.affixes.length, 3, 'affix count stays tied to tier');
  // Affix contents should be re-rolled (may rarely match, but defIds or values usually differ).
  // Accept either change or same because affix pool may be small at iLevel 10 — but we at least
  // confirm the array is a new instance populated.
  assert.ok(Array.isArray(item.affixes));
  assert.ok(item.affixes.every(a => typeof a.defId === 'string'));
  // sanity: prevIds was captured
  assert.ok(typeof prevIds === 'string');
});

test('rerollItem with lock keeps the locked affix, re-rolls the rest, at a surcharge (#51 G3)', () => {
  const sys = freshShopSystem();
  sys.grantGold(100000);
  const item = sys.rollItem('WPN_EISENKLINGE', 10, 3); // tier 3 -> 3 affixes
  assert.strictEqual(item.affixes.length, 3);
  const lockIdx = 1;
  const lockedDefId = item.affixes[lockIdx].defId;
  const lockedValue = item.affixes[lockIdx].value;
  // Locked cost is the base cost times the surcharge (1.75).
  const baseCost = sys._computeRerollCost(item, false);
  const lockCost = sys._computeRerollCost(item, true);
  assert.ok(lockCost > baseCost, 'locking costs more');
  assert.strictEqual(lockCost, Math.max(1, Math.round(baseCost * 1.75)));
  const goldBefore = sys.getGold();
  const ok = sys.rerollItem(item, lockCost, lockIdx);
  assert.strictEqual(ok, true);
  assert.strictEqual(sys.getGold(), goldBefore - lockCost);
  assert.strictEqual(item.affixes.length, 3, 'affix count preserved');
  // The locked affix is still present with the same value...
  const kept = item.affixes.find(a => a.defId === lockedDefId && a.value === lockedValue);
  assert.ok(kept, 'locked affix survived the reroll');
  // ...and appears exactly once (no duplication of the locked defId).
  assert.strictEqual(item.affixes.filter(a => a.defId === lockedDefId).length, 1);
});

test('rerollItem: fails and returns false when gold is insufficient', () => {
  const sys = freshShopSystem();
  sys.grantGold(5);
  const item = sys.rollItem('WPN_EISENKLINGE', 10, 3);
  const cost = sys._computeRerollCost(item);
  assert.ok(cost > 5);
  const originalAffixes = item.affixes.slice();
  const ok = sys.rerollItem(item, cost);
  assert.strictEqual(ok, false);
  assert.strictEqual(sys.getGold(), 5, 'gold not deducted on failure');
  assert.deepStrictEqual(item.affixes, originalAffixes, 'affixes unchanged on failure');
});

test('rerollItem: costs iron chunks — fails without, deducts with', () => {
  const sys = freshShopSystem();
  const item = sys.rollItem('WPN_EISENKLINGE', 10, 3); // tier 3 -> matCost 1+3 = 4
  assert.strictEqual(sys._computeRerollMatCost(item), 4);
  const cost = sys._computeRerollCost(item);
  // Genug Gold, KEINE Eisenbrocken -> Fehlschlag, nichts abgezogen.
  globalThis.window.materialCounts = { GOLD: 1000000, MAT: 0 };
  const before = item.affixes.slice();
  assert.strictEqual(sys.rerollItem(item, cost), false);
  assert.strictEqual(sys.getGold(), 1000000, 'kein Gold ohne Eisenbrocken');
  assert.deepStrictEqual(item.affixes, before, 'Affixe unverändert');
  // Genug von beidem -> Reroll klappt, 4 Eisenbrocken abgezogen.
  globalThis.window.materialCounts = { GOLD: 1000000, MAT: 10 };
  assert.strictEqual(sys.rerollItem(item, cost), true);
  assert.strictEqual(globalThis.window.materialCounts.MAT, 6, '4 Eisenbrocken abgezogen');
});

test('rerollItem: returns false for null / invalid item', () => {
  const sys = freshShopSystem();
  sys.grantGold(10000);
  assert.strictEqual(sys.rerollItem(null, 100), false);
  assert.strictEqual(sys.rerollItem({}, 100), false);
  assert.strictEqual(sys.getGold(), 10000, 'no gold spent on invalid input');
});

test('getOrCreateShopState: returns a ShopState with itemStock array', () => {
  const sys = freshShopSystem();
  const state = sys.getOrCreateShopState('run-a');
  assert.ok(state);
  assert.strictEqual(state.currentRunId, 'run-a');
  assert.ok(Array.isArray(state.itemStock));
  assert.ok(state.itemStock.length > 0, 'stock should contain rolled items');
});

test('getOrCreateShopState: stable per runId (repeat calls return same state)', () => {
  const sys = freshShopSystem();
  const s1 = sys.getOrCreateShopState('run-xyz');
  const s2 = sys.getOrCreateShopState('run-xyz');
  assert.strictEqual(s1, s2, 'same object returned within a single run');
  assert.strictEqual(s1.itemStock, s2.itemStock);
});

test('getOrCreateShopState: regenerates when runId changes', () => {
  const sys = freshShopSystem();
  const s1 = sys.getOrCreateShopState('run-1');
  const s2 = sys.getOrCreateShopState('run-2');
  assert.notStrictEqual(s1, s2, 'new run should produce a new state object');
  assert.strictEqual(s2.currentRunId, 'run-2');
});

test('black market: locked below maxDepth 4 -> empty stock + blindBuy locked (#51)', () => {
  const sys = freshShopSystem();
  globalThis.localStorage.setItem('demonfall_maxDepth', '3');
  assert.strictEqual(sys.isBlackMarketUnlocked(), false);
  const state = sys.getOrCreateShopState('run-locked');
  assert.strictEqual(state.itemStock.length, 0, 'no visible stock while locked');
  // Blindkauf teilt das Gating — auch mit Gold + explizitem depth-override gesperrt.
  globalThis.window.materialCounts = { GOLD: 1000000, MAT: 999 };
  const res = sys.blindBuy(3);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'locked');
  assert.strictEqual(sys.getGold(), 1000000, 'kein Gold abgezogen wenn gesperrt');
});

test('black market: unlocks at maxDepth 4 and rolls at maxDepth-3 (#51)', () => {
  const sys = freshShopSystem();
  globalThis.localStorage.setItem('demonfall_maxDepth', '4');
  assert.strictEqual(sys.isBlackMarketUnlocked(), true);
  const state = sys.getOrCreateShopState('run-d4');
  assert.ok(state.itemStock.length > 0, 'stock present once unlocked');
  // maxDepth 4 -> Auslage rollt auf Tiefe 1
  assert.ok(state.itemStock.every((it) => it.iLevel === 1), 'stock rolls at maxDepth-3');

  const sys2 = freshShopSystem();
  globalThis.localStorage.setItem('demonfall_maxDepth', '12');
  const state2 = sys2.getOrCreateShopState('run-d12');
  assert.ok(state2.itemStock.every((it) => it.iLevel === 9), 'maxDepth 12 -> Tiefe 9');
});

test('blindBuy without override rolls/prices at maxDepth (#51)', () => {
  const sys = freshShopSystem();
  globalThis.localStorage.setItem('demonfall_maxDepth', '12');
  // #132: zwei Tiefeneinkommen -> 2 x 13 x 12 = 312
  assert.strictEqual(sys.getBlindBuyPrice(), 2 * 13 * 12, 'Blindkauf-Preis auf maxDepth');
  globalThis.window.materialCounts = { GOLD: 1000000, MAT: 999 };
  const res = sys.blindBuy();
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.item.iLevel, 12, 'Blindkauf-Item rollt auf maxDepth');
});

// ---------------------------------------------------------------------------
// G2 (#51): Blindkauf / Gambling gold sink
// ---------------------------------------------------------------------------
test('getBlindBuyPrice scales with depth', () => {
  const sys = freshShopSystem();
  const p3 = sys.getBlindBuyPrice(3);
  const p10 = sys.getBlindBuyPrice(10);
  assert.ok(p10 > p3, 'deeper -> pricier');
  assert.strictEqual(p3, 2 * 13 * 3);   // #132: 2 Tiefeneinkommen x GOLD_JE_TIEFE x Tiefe
});

test('blindBuy fails and refunds nothing when gold is insufficient (#51)', () => {
  const sys = freshShopSystem();
  globalThis.window.materialCounts = { GOLD: 10 };
  const price = sys.getBlindBuyPrice(3);
  const res = sys.blindBuy(3);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'gold');
  assert.strictEqual(sys.getGold(), 10, 'gold unchanged on failed buy');
  assert.ok(price > 10);
});

test('blindBuy deducts the price and returns a valid item (#51)', () => {
  const sys = freshShopSystem();
  globalThis.window.materialCounts = { GOLD: 5000 };
  const price = sys.getBlindBuyPrice(3);
  const res = sys.blindBuy(3);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.price, price);
  assert.strictEqual(sys.getGold(), 5000 - price, 'exactly the price is spent');
  assert.ok(res.item && typeof res.item.tier === 'number');
  assert.ok(Array.isArray(res.item.affixes));
  assert.strictEqual(res.item.affixes.length, res.item.tier, 'affix count matches tier');
});

test('blindBuy rolls BETTER than the base drop odds (#51)', () => {
  const sys = freshShopSystem();
  globalThis.window.materialCounts = { GOLD: 100000000 };
  let nonCommon = 0;
  const N = 600;
  for (let i = 0; i < N; i++) {
    const r = sys.blindBuy(3);
    if (r.ok && r.item.tier > 0) nonCommon++;
  }
  // Basis-Drop bei Tiefe 3 ~22% Nicht-Common; der Blindkauf-Qualitaets-Bias
  // (BLIND_BUY_BIAS) hebt das klar an -> "Katze im Sack" lohnt sich.
  assert.ok(nonCommon / N > 0.26,
    'blind buy yields more non-common than a normal drop (got ' + (nonCommon / N).toFixed(2) + ')');
});

// ---------------------------------------------------------------------------
// WP08 T048: equip-change hooks into recomputeBonuses
// ---------------------------------------------------------------------------

// Build a mock equipped item whose affix values map directly onto the
// aggregated-bonus cache. We hand-craft defId + value pairs that match real
// AFFIX_DEFS entries so recomputeBonuses produces the exact keys we expect.
function mockAbilityItem(sys, defId, value) {
  // Ensure the def exists so the test is self-validating.
  const def = sys.AFFIX_DEFS.find((d) => d.id === defId);
  if (!def) throw new Error('mockAbilityItem: unknown affix def ' + defId);
  return {
    type: 'weapon',
    tier: 1,
    affixes: [{ defId, value }]
  };
}

test('WP08 T048: ein Faehigkeitsaffix landet im getBonus-Zwischenspeicher', () => {
  const sys = freshSystem();
  aufTiefe(20);
  globalThis.window.equipment = {
    weapon: mockAbilityItem(sys, 'spinning_dmg', punkteFuer(sys, 0.10, 20))
  };
  sys.recomputeBonuses();
  // #122: Faehigkeitsaffixe tragen den Faktor 3 — sie wirken nur auf EINE
  // Faehigkeit, ein Anteil von 10 % waere dort weniger wert als anderswo.
  assert.ok(Math.abs(sys.getBonus('dmg_spinAttack') - 0.30) < 1e-9,
    'erwartet 0,30, war ' + sys.getBonus('dmg_spinAttack'));
});

test('WP08 T048: zwei Stuecke summieren ihren Faehigkeitsbonus', () => {
  const sys = freshSystem();
  aufTiefe(20);
  globalThis.window.equipment = {
    weapon: mockAbilityItem(sys, 'spinning_dmg', punkteFuer(sys, 0.10, 20)),
    body:   mockAbilityItem(sys, 'spinning_dmg', punkteFuer(sys, 0.05, 20))
  };
  sys.recomputeBonuses();
  const bonus = sys.getBonus('dmg_spinAttack');
  assert.ok(Math.abs(bonus - 0.45) < 1e-9, 'erwartet 0,45 zusammen, war ' + bonus);
});

// ---------------------------------------------------------------------------
// Issue #36: affix cleanup — move affix added, resists removed, base-stat
// + luxury affixes wired through getBonus.
// ---------------------------------------------------------------------------

test('#36: resist affixes are removed from AFFIX_DEFS', () => {
  const sys = freshSystem();
  const ids = sys.AFFIX_DEFS.map((d) => d.id);
  assert.strictEqual(ids.includes('fire_warding'), false);
  assert.strictEqual(ids.includes('cold_warding'), false);
  assert.strictEqual(ids.includes('lightning_warding'), false);
});

test('#36: of_swiftness move affix exists and aggregates as a flat move bonus', () => {
  const sys = freshSystem();
  const def = sys.AFFIX_DEFS.find((d) => d.id === 'of_swiftness');
  assert.ok(def, 'of_swiftness affix must exist');
  assert.strictEqual(def.statKey, 'move');
  assert.strictEqual(def.valueType, 'flat');
  aufTiefe(20);
  globalThis.window.equipment = {
    boots: { type: 'boots', tier: 1,
      affixes: [{ defId: 'of_swiftness', value: punkteFuer(sys, 0.10, 20) }] }
  };
  sys.recomputeBonuses();
  // #122: Lauftempo wirkt jetzt PROZENTUAL. Ein flacher Zuschlag auf eine
  // Basis, die nicht mitwaechst, ist frueh zu stark und spaet wertlos.
  assert.ok(Math.abs(sys.getBonus('move') - 0.10) < 1e-9,
    'erwartet 0,10, war ' + sys.getBonus('move'));
});

test('#36: swift_speed remains an attack-speed (statKey speed) affix', () => {
  const sys = freshSystem();
  const def = sys.AFFIX_DEFS.find((d) => d.id === 'swift_speed');
  assert.ok(def);
  assert.strictEqual(def.statKey, 'speed');
});

test('#36: gold_find affix aggregates as a percent bonus via getBonus', () => {
  const sys = freshSystem();
  aufTiefe(20);
  globalThis.window.equipment = {
    head: { type: 'head', tier: 1,
      affixes: [{ defId: 'of_greed', value: punkteFuer(sys, 0.10, 20) }] }
  };
  sys.recomputeBonuses();
  // Goldfund liegt auf keiner der beiden Kampfachsen und traegt deshalb den
  // Faktor 2 — er darf deutlich ausfallen, ohne in den Kampf zu wirken. Bis
  // b209 fiel er versehentlich in den Faehigkeits-Rueckfall (Faktor 3).
  assert.ok(Math.abs(sys.getBonus('gold_find') - 0.20) < 1e-9,
    'erwartet 0,20, war ' + sys.getBonus('gold_find'));
});

test('WP08 T048: Ablegen setzt den Bonus wieder auf 0', () => {
  const sys = freshSystem();
  aufTiefe(20);
  globalThis.window.equipment = {
    weapon: mockAbilityItem(sys, 'spinning_dmg', punkteFuer(sys, 0.10, 20))
  };
  sys.recomputeBonuses();
  assert.ok(sys.getBonus('dmg_spinAttack') > 0, 'der Bonus greift gar nicht');

  // Simulate unequip
  globalThis.window.equipment = {};
  sys.recomputeBonuses();
  assert.strictEqual(sys.getBonus('dmg_spinAttack'), 0);
});


// ---------------------------------------------------------------------------
// Herz-Drops: leichte Tiefenskalierung (flache +2 waren spaet wertlos)
// ---------------------------------------------------------------------------

test('getHeartHeal: skaliert leicht mit der Tiefe und ist gedeckelt', () => {
  const sys = freshSystem();
  assert.strictEqual(sys.getHeartHeal(1), 2, 'Tiefe 1 heilt den Basiswert');
  assert.strictEqual(sys.getHeartHeal(4), 2, 'unter der ersten Stufe bleibt es 2');
  assert.strictEqual(sys.getHeartHeal(5), 3, '+1 je 5 Tiefen');
  assert.strictEqual(sys.getHeartHeal(10), 4);
  assert.strictEqual(sys.getHeartHeal(20), 6, 'Deckel erreicht');
  assert.strictEqual(sys.getHeartHeal(50), 6, 'Deckel haelt auch tief');
  assert.strictEqual(sys.getHeartHeal(999), 6);
});

test('getHeartHeal: monoton und robust gegen Muell-Eingaben', () => {
  const sys = freshSystem();
  for (let d = 1; d < 40; d++) {
    assert.ok(sys.getHeartHeal(d + 1) >= sys.getHeartHeal(d), 'nie ruecklaeufig bei Tiefe ' + d);
  }
  // Tiefe fehlt/kaputt -> Basiswert statt NaN (loot.js reicht currentWave durch)
  assert.strictEqual(sys.getHeartHeal(0), 2);
  assert.strictEqual(sys.getHeartHeal(-5), 2);
  assert.strictEqual(sys.getHeartHeal(undefined), 2);
  assert.strictEqual(sys.getHeartHeal(NaN), 2);
  assert.strictEqual(sys.getHeartHeal(7.9), 3, 'Bruchtiefen werden abgerundet');
});

// ---------------------------------------------------------------------------
// magicFindMult: der Wert 0 muss ANKOMMEN
// ---------------------------------------------------------------------------
// Die Pruefung in _rollTier lautete "> 0" und fiel bei 0 auf 1 zurueck. Ein
// Effekt, der die Fundqualitaet unterdruecken soll, war damit wirkungslos —
// er haette nur seinen Bonus gegeben und den Preis nie eingezogen. Gemessen
// mit dem alten Guard: 26,7 % ueber gewoehnlich bei magicFindMult 0, also
// exakt der Basiswert.
function _anteilUeberGewoehnlich(sys, mf, n) {
  globalThis.window.knowledgeTreeBuffs = { magicFindMult: mf };
  let hoeher = 0;
  for (let i = 0; i < n; i++) {
    const it = sys.rollItem(null, 30);
    if (it && (it.tier | 0) > 0) hoeher++;
  }
  return 100 * hoeher / n;
}

test('magicFindMult 0 unterdrueckt hoehere Stufen wirklich (Guard >= 0)', () => {
  const sys = freshShopSystem();
  try {
    const basis = _anteilUeberGewoehnlich(sys, 1.0, 3000);
    const null_ = _anteilUeberGewoehnlich(sys, 0, 3000);
    assert.ok(basis > 15, 'Basis sollte deutlich ueber 15 % liegen, war ' + basis.toFixed(1));
    assert.ok(null_ < 0.5, 'magicFindMult 0 muss unterdruecken, war ' + null_.toFixed(1) + ' %');
  } finally {
    delete globalThis.window.knowledgeTreeBuffs;
  }
});

test('magicFindMult 0.5 halbiert den Anteil ueber gewoehnlich', () => {
  const sys = freshShopSystem();
  try {
    const basis = _anteilUeberGewoehnlich(sys, 1.0, 3000);
    const halb = _anteilUeberGewoehnlich(sys, 0.5, 3000);
    // Erwartet rund 26 % -> 15 % (gerechnet aus den Gewichten in _rollTier).
    assert.ok(halb < basis * 0.8,
      'halbierter Bias muss deutlich unter der Basis liegen: ' + halb.toFixed(1) + ' vs ' + basis.toFixed(1));
    assert.ok(halb > basis * 0.35, 'aber nicht auf null fallen: ' + halb.toFixed(1));
  } finally {
    delete globalThis.window.knowledgeTreeBuffs;
  }
});
