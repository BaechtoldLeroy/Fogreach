// tests/seltenheitLeuchten.test.js — Was am Boden leuchtet, und in welcher Farbe.
//
// Gold und Orange leuchteten, Blau nicht: ein magischer Fund lag unscheinbar
// da wie ein gewoehnlicher (#123). Geprueft wird nicht der Quelltext, sondern
// WAS die Szene zu zeichnen bekommt — eine Attrappe protokolliert jeden Kreis
// und jeden Ton mit.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;
W.gameNow = () => 0;
W.inventory = new Array(20).fill(null);
globalThis.inventory = W.inventory;
W.player = { x: 0, y: 0 };
W.materialCounts = {};

// setBlendMode braucht Phasers Konstanten; mehr nutzt das Leuchten nicht.
globalThis.Phaser = globalThis.Phaser || { BlendModes: { ADD: 1 } };
if (!W.Phaser) W.Phaser = globalThis.Phaser;

loadGameModule('js/inventoryGrid.js');
loadGameModule('js/loot.js');

// Minimal-Szene, die nur mitschreibt. spawnLoot legt ueber sie das Sprite und
// den Leuchtkreis an; uns interessieren Farbe, Radius und ob ein Ton faellt.
function szene() {
  const p = { kreise: [], toene: [], tweens: [] };
  const objekt = () => ({
    x: 0, y: 0, alpha: 1, scale: 1, angle: 0,
    setDepth() { return this; }, setBlendMode() { return this; },
    setStrokeStyle() { return this; }, setScale() { return this; },
    setAlpha() { return this; }, setOrigin() { return this; },
    setTint() { return this; }, setDisplaySize() { return this; },
    setData() { return this; }, getData() { return undefined; },
    setInteractive() { return this; }, on() { return this; },
    destroy() {},
  });
  return {
    _p: p,
    add: {
      circle: (x, y, r, farbe, alpha) => { p.kreise.push({ r, farbe, alpha }); return objekt(); },
      sprite: () => objekt(),
      image: () => objekt(),
      text: () => Object.assign(objekt(), { setText() { return this; } }),
      graphics: () => Object.assign(objekt(), {
        fillStyle() { return this; }, fillCircle() { return this; },
        lineStyle() { return this; }, strokeCircle() { return this; },
        clear() { return this; }, generateTexture() { return this; },
      }),
    },
    tweens: { add: (cfg) => { p.tweens.push(cfg); return { remove() {}, stop() {} }; } },
    time: { addEvent: () => ({ remove() {} }), delayedCall: () => ({ remove() {} }) },
    physics: { add: { existing() {}, sprite: () => objekt() } },
    events: { on() {}, off() {}, once() {} },
    textures: { exists: () => true },
    children: { list: [] },
  };
}

function leuchten(tier) {
  const sc = szene();
  W.soundManager = { playSFX: (k) => sc._p.toene.push(k) };
  const fx = W.attachRarityFx;
  const daten = {};
  const beute = { x: 0, y: 0, active: true, scene: sc,
    setData: (k, v) => { daten[k] = v; }, getData: (k) => daten[k],
    on() {}, once() {}, destroy() {} };
  fx(sc, beute, { tier });
  return sc._p;
}

test('Jede Seltenheit ueber gewoehnlich leuchtet in IHRER Farbe', () => {
  const erwartet = { 1: 0x88aaff, 2: 0xffdd44, 3: 0xff8844 };
  [1, 2, 3].forEach((tier) => {
    const p = leuchten(tier);
    assert.ok(p.kreise.length > 0, 'Tier ' + tier + ' muss leuchten');
    assert.strictEqual(p.kreise[0].farbe, erwartet[tier],
      'Tier ' + tier + ' in der falschen Farbe');
  });
});

test('Gewoehnliche Funde leuchten gar nicht', () => {
  const p = leuchten(0);
  assert.strictEqual(p.kreise.length, 0);
  assert.strictEqual(p.toene.length, 0);
});

test('Blau ist das leiseste Signal: kleiner, blasser, ohne Ton', () => {
  const blau = leuchten(1);
  const gold = leuchten(2);
  const orange = leuchten(3);

  assert.ok(blau.kreise[0].r < gold.kreise[0].r, 'blau kleiner als gold');
  assert.ok(gold.kreise[0].r < orange.kreise[0].r, 'gold kleiner als orange');
  assert.ok(blau.kreise[0].alpha < gold.kreise[0].alpha, 'blau blasser als gold');

  assert.deepStrictEqual(blau.toene, [], 'magische Funde sind haeufig — kein Jingle');
  assert.deepStrictEqual(gold.toene, ['loot_rare']);
  assert.deepStrictEqual(orange.toene, ['loot_legendary']);
});
