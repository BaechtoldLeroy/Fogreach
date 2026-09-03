// tests/opferstein.test.js — Der Opferstein wirft ein ANGELEGTES Stueck neu (#71).
//
// Tiefe 1 kannte nur Schatz und Lore-Fragment, beide ohne Entscheidung. Der
// erste Entwurf gab fuer ein Stueck aus dem INVENTAR ein besseres derselben Art
// zurueck — ein garantierter Aufstieg fuer etwas, das man ohnehin nicht traegt.
// Das war kein Preis.
//
// Jetzt nimmt der Stein, was man traegt, und gibt einen Umwurf: dieselbe Basis,
// dieselbe Seltenheit, frisch gewuerfelt auf Tiefe + 2. Gemessen ueber 400 Wuerfe
// je Tiefe: rund 52 % besser, 47 % schlechter, 1-2 % gleichwertig — ein echter
// Muenzwurf mit hauchduennem Vorteil, damit er ueberhaupt lohnt.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;

W.i18n = W.i18n || { register() {}, t(k) { return k; }, onChange() {} };
W.Phaser = W.Phaser || {
  Math: { Clamp: (v, a, b) => Math.max(a, Math.min(b, v)) },
  Utils: { Array: { GetRandom: (a) => a[0] } },
};

// Die Item-Staerke kommt sonst aus inventory.js. Die ganze Datei zu laden
// braucht Phaser-Anzeigeobjekte; geprueft wird hier der UMWURF, nicht die
// Staerkeformel — darum ein einfacher Ersatz mit derselben Aufgabe: aus einem
// Stueck eine vergleichbare Zahl machen.
W.computeItemPower = (it) => {
  if (!it) return 0;
  return Math.round(
    (it.damage || 0) * 10 + (it.hp || 0) + (it.armor || 0) * 100
    + (it.crit || 0) * 100 + (it.speed || 0) * 100 + (it.range || 0) * 0.1
    + (Array.isArray(it.affixes) ? it.affixes.length : 0) * 5
  );
};

loadGameModule('js/lootSystem.js');
loadGameModule('js/eventSystem.js');
const E = W.EventSystem;
const LS = W.LootSystem;

function ausruesten(stueck) {
  W.equipment = { weapon: null, offhand: null, head: null, body: null, boots: null, amulet: null };
  W.equipment.weapon = stueck;
  return W.equipment;
}

test('Der Stein sieht nur ANGELEGTE Stuecke, nicht das Inventar', () => {
  ausruesten(LS.rollItem('WPN_SCHATTENDOLCH', 5, 1));
  W.inventory = [LS.rollItem('WPN_GLUTAXT', 5, 2)];
  const k = E.opferKandidaten();
  assert.strictEqual(k.length, 1, 'genau das angelegte Stueck');
  assert.strictEqual(k[0].slot, 'weapon');
  assert.strictEqual(k[0].item.key, 'WPN_SCHATTENDOLCH');
});

test('Amulette bleiben aussen vor', () => {
  // Sie tragen keine Werte, nur einen Effekt — ein Umwurf haette nichts zu
  // wuerfeln und wuerde den Lauf-Bonus stillschweigend austauschen.
  W.equipment = { weapon: null, amulet: { key: 'AMU_X', isAmulet: true, effect: 'glasherz' } };
  assert.strictEqual(E.opferKandidaten().length, 0);
});

test('Ohne Ausruestung gibt es nichts herzugeben', () => {
  W.equipment = { weapon: null, head: null, body: null, boots: null };
  assert.strictEqual(E.opferKandidaten().length, 0);
  W.equipment = null;
  assert.strictEqual(E.opferKandidaten().length, 0, 'auch ohne equipment-Objekt');
});

test('Der Umwurf behaelt Basis und Seltenheit', () => {
  // Sonst waere es kein Umwurf, sondern ein Aufstieg — und genau das war am
  // ersten Entwurf zu stark.
  W.recalcDerived = () => {};
  for (let i = 0; i < 200; i++) {
    const alt = LS.rollItem('WPN_SCHATTENDOLCH', 6, 2);
    ausruesten(alt);
    const r = E.opferUmwurf('weapon', 6);
    assert.ok(r, 'kein Ergebnis');
    assert.strictEqual(r.item.key, alt.key, 'andere Basis');
    assert.strictEqual(r.item.tier, alt.tier, 'andere Seltenheit');
    assert.strictEqual(W.equipment.weapon, r.item, 'das neue Stueck ist nicht angelegt');
  }
});

test('Der Umwurf ist ein Wagnis, kein garantierter Aufstieg', () => {
  W.recalcDerived = () => {};
  let besser = 0, schlechter = 0;
  for (let i = 0; i < 600; i++) {
    ausruesten(LS.rollItem('WPN_SCHATTENDOLCH', 8, 1));
    const r = E.opferUmwurf('weapon', 8);
    if (!r) continue;
    if (r.neu > r.alt) besser++; else if (r.neu < r.alt) schlechter++;
  }
  const gesamt = besser + schlechter;
  assert.ok(gesamt > 500, 'zu wenige Wuerfe: ' + gesamt);
  // Beide Seiten muessen spuerbar vorkommen. Ohne diese Schranke waere ein
  // still eingebauter Aufstieg (100 % besser) ein bestandener Test.
  assert.ok(schlechter / gesamt > 0.30,
    'zu selten schlechter (' + Math.round(100 * schlechter / gesamt) + ' %) — kein Wagnis');
  assert.ok(besser / gesamt > 0.30,
    'zu selten besser (' + Math.round(100 * besser / gesamt) + ' %) — lohnt nicht');
});

test('Ein leerer Platz wirft nichts um', () => {
  W.equipment = { weapon: null };
  assert.strictEqual(E.opferUmwurf('weapon', 5), null);
  assert.strictEqual(E.opferUmwurf('body', 5), null, 'auch ein unbekannter Platz');
});

test('Der Stein steht ab Tiefe 1 und ist nicht das haeufigste Ereignis', () => {
  const def = E.EVENT_TYPES.filter((e) => e.id === 'sacrifice_altar')[0];
  assert.ok(def, 'Opferstein ist nicht registriert');
  assert.strictEqual(def.minDepth, 1, 'er soll gerade den duennen Einstieg fuellen');
  const groesste = Math.max.apply(null, E.EVENT_TYPES.map((e) => e.weight || 0));
  assert.ok(def.weight < groesste, 'ein neues Ereignis soll nicht das haeufigste sein');
});
