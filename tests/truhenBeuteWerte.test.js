// tests/truhenBeuteWerte.test.js — Beute aus Truhen, Belohnungen und Ereignissen
// darf ihre Basiswerte nicht verlieren.
//
// GEMESSEN am Spiel (Bildschirmfoto des Nutzers): ein magischer Schattendolch
// zeigte nur "Schaden +0.7" und "Reichweite -25.0". Angriffstempo (+15 %) und
// Krit (+5 %) fehlten — und zwar nicht bloss in der Anzeige: die Oberwerte
// standen wirklich auf 0, der Dolch war also gar nicht schnell.
//
// Die Ursache lag in normalizeItemStatsForTier: die Deckelung behaelt die
// betragsmaessig groessten Werte. Reichweite zaehlt aber in PIXELN (25),
// Tempo und Krit als Bruch (0.15 / 0.05) — die Reichweite gewinnt damit
// IMMER, unabhaengig davon, was die Waffe ausmacht. Gemessen vor dem Fix:
//
//   Tier 0: {dmg 2, spd 0.15, rng -25, crit 0.05} -> {dmg 0, spd 0, rng -25, crit 0}
//   Tier 1: {dmg 1.4, ...}                        -> {dmg 1.4, spd 0, rng -25, crit 0}
//
// Bei Gewoehnlich fiel also sogar der Schaden weg. Betroffen war ausgerechnet
// der Zweig fuer die BESSEREN Wege — Truhen, Elite-Garantien, Ereignisse,
// Questbelohnungen —, waehrend der gewoehnliche Gegner-Drop die Deckelung
// laengst umging.
//
// Die Deckelung ist inzwischen ganz entfernt. Die Regel lautet: die Seltenheit
// steuert die ANZAHL DER AFFIXE, und die liegen additiv obendrauf. Die
// Basiswerte eines Stuecks zaehlen nie gegen diese Grenze — sie SIND das Stueck.
//
// Geprueft wird die ABGELEGTE Beute, nicht der Quelltext: spawnLoot bekommt ein
// fertiges Item und muss es mit allen Werten wieder herausgeben.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;

// setBlendMode im Seltenheits-Leuchten braucht Phasers Konstanten.
globalThis.Phaser = globalThis.Phaser || { BlendModes: { ADD: 1 } };
if (!W.Phaser) W.Phaser = globalThis.Phaser;

W.gameNow = () => 0;
W.inventory = new Array(20).fill(null);
globalThis.inventory = W.inventory;
W.player = { x: 0, y: 0 };
W.materialCounts = {};
// spawnLoot sucht die Szene ueber `obstacles.scene`, bevor es auf
// window.currentScene ausweicht — ohne die Bindung wirft es beim Einstieg.
globalThis.obstacles = { scene: null };
W.currentScene = {};
globalThis.currentWave = 6;
W.currentWave = 6;

// Die zuletzt abgelegte Beute einsammeln. spawnLoot legt ueber lootGroup.create
// ab; mehr braucht der Pfad von uns nicht.
let zuletzt = null;
const lootGroup = {
  create() {
    const daten = {};
    zuletzt = {
      setDisplaySize() { return this; },
      setDepth() { return this; },
      setData(k, v) { daten[k] = v; return this; },
      getData(k) { return daten[k]; },
      setTint() { return this; },
      setAlpha() { return this; },
      setBlendMode() { return this; },
      setScale() { return this; },
      on() { return this; }, once() { return this; },
      destroy() {},
      x: 0, y: 0, active: true, scene: null,
    };
    return zuletzt;
  },
  getChildren() { return zuletzt ? [zuletzt] : []; },
};
W.lootGroup = lootGroup;
globalThis.lootGroup = lootGroup;

loadGameModule('js/inventoryGrid.js');
loadGameModule('js/loot.js');

// Ein Schattendolch, wie ihn LootSystem.rollItem liefert: Oberwerte gespiegelt,
// baseStats in Prozentschreibweise. Genau diese Form bekommt spawnLoot von den
// Truhen- und Belohnungspfaden uebergeben.
function macheDolch(tier) {
  return {
    key: 'WPN_SCHATTENDOLCH', type: 'weapon', name: 'Schattendolch',
    displayName: 'Schattendolch', iconKey: 'itDagger',
    tier: tier, iLevel: 6, itemLevel: 18,
    // So viele Affixe wie die Stufe hergibt — genau das legt rollItem an.
    affixes: Array.from({ length: tier }, function (_, i) {
      return { defId: 'affix' + i, value: 1 };
    }),
    baseStats: { damage: 2.1, speed: 15, range: -25, crit: 5 },
    damage: 2.1, speed: 0.15, range: -25, crit: 0.05,
  };
}

// Minimal-Szene: spawnLoot legt darueber das Sprite und den Seltenheits-
// Leuchtkreis an. Nichts davon wird geprueft, es darf nur nicht werfen.
function szene() {
  const o = () => ({
    x: 0, y: 0, alpha: 1,
    setDepth() { return this; }, setBlendMode() { return this; },
    setScale() { return this; }, setAlpha() { return this; },
    setOrigin() { return this; }, setTint() { return this; },
    setDisplaySize() { return this; }, setStrokeStyle() { return this; },
    setData() { return this; }, getData() { return undefined; },
    on() { return this; }, once() { return this; }, destroy() {},
  });
  return {
    add: { circle: o, sprite: o, image: o },
    tweens: { add: () => ({ remove() {}, stop() {} }) },
    time: { addEvent: () => ({ remove() {} }), delayedCall: () => ({ remove() {} }) },
    physics: { world: {}, add: { existing() {}, sprite: o } },
    events: { on() {}, off() {}, once() {} },
    textures: { exists: () => true },
    children: { list: [] },
  };
}

function legeAb(item) {
  zuletzt = null;
  W.spawnLoot.call(szene(), 100, 100, item, null);
  return zuletzt ? zuletzt.getData('item') : null;
}

test('Ein Dolch aus der Truhe behaelt Tempo und Krit — auf jeder Seltenheit', () => {
  for (let tier = 0; tier <= 3; tier++) {
    const abgelegt = legeAb(macheDolch(tier));
    assert.ok(abgelegt, 'Tier ' + tier + ': nichts abgelegt');
    assert.strictEqual(abgelegt.speed, 0.15,
      'Tier ' + tier + ': Angriffstempo verloren — der Schattendolch IST sein Tempo');
    assert.strictEqual(abgelegt.crit, 0.05, 'Tier ' + tier + ': Krit verloren');
    assert.strictEqual(abgelegt.damage, 2.1, 'Tier ' + tier + ': Schaden verloren');
    assert.strictEqual(abgelegt.range, -25, 'Tier ' + tier + ': Reichweite verloren');
    // Und die Affixe der Seltenheitsstufe kommen ZUSAETZLICH mit — sie sind
    // der Zuwachs, den die Seltenheit bringt, nicht ein Tausch gegen Basiswerte.
    assert.strictEqual(abgelegt.affixes.length, tier,
      'Tier ' + tier + ': Affixe verloren oder verdoppelt');
  }
});

test('Auch von Hand gebaute Queststuecke behalten alle Werte', () => {
  // Elaras Klinge und das Ritualamulett stehen als Literal in questSystem.js:
  // ohne baseStats UND ohne tier. Sie liefen deshalb als Tier 0 durch die
  // Deckelung — von vier Werten waere EINER geblieben, und zwar der mit dem
  // groessten Rohbetrag: die Reichweite. Aus einer legendaeren Klinge waere
  // "+120 Reichweite und sonst nichts" geworden.
  const klinge = {
    type: 'weapon', key: 'ELARAS_KLINGE', name: 'Elaras Klinge',
    damage: 7, speed: 1.3, range: 120, crit: 0.15, hp: 0,
  };
  const abgelegt = legeAb(klinge);
  assert.ok(abgelegt, 'nichts abgelegt');
  assert.strictEqual(abgelegt.damage, 7, 'Schaden verloren');
  assert.strictEqual(abgelegt.speed, 1.3, 'Angriffstempo verloren');
  assert.strictEqual(abgelegt.range, 120, 'Reichweite verloren');
  assert.strictEqual(abgelegt.crit, 0.15, 'Krit verloren');
});

test('Es gibt keine Werte-Deckelung mehr', () => {
  // Die Seltenheit steuert die ANZAHL DER AFFIXE, nicht die Anzahl der
  // Basiswerte. Wer die Deckelung wieder einfuehrt, faellt hier auf — auch
  // dann, wenn er sie nur "vorsichtig" an einer Stelle wieder aufruft.
  assert.strictEqual(typeof W.normalizeItemStatsForTier, 'undefined',
    'die Deckelung ist wieder exportiert');
  assert.strictEqual(typeof W.normalizeItemStatsForRarity, 'undefined',
    'der Alt-Name der Deckelung ist wieder exportiert');
});
