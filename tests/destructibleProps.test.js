// Zerstoerbare Props: welcher Prop-Typ bricht, und mit welchem lootTier.
//
// Der lootTier steuert in main.js breakDestructibleObstacle() Gold, Ausruestung,
// Traenke und Rollen. Statuen/Saeulen stehen zu Dutzenden in den Templates —
// bekaemen sie versehentlich 'minor' (Fass-Tier), wuerde jeder Raum still
// Beute ausschuetten. Darum die Zuordnung festnageln.

const { test } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

// Minimaler Stub der statischen Obstacle-Gruppe, die createObstacle erwartet.
function stubObstacles() {
  const created = [];
  const group = {
    scene: {
      textures: { exists: () => true },
      add: { graphics: () => ({ destroy() {} }) }
    },
    create(x, y, textureKey) {
      const data = {};
      const o = {
        x, y, textureKey, active: true,
        setOrigin() { return o; },
        refreshBody() { return o; },
        setDepth() { return o; },
        setData(k, v) { data[k] = v; return o; },
        getData(k) { return data[k]; },
        destroy() { o.active = false; }
      };
      created.push(o);
      return o;
    }
  };
  return { group, created };
}

function make(key) {
  if (!globalThis.window) require('./setup');
  const { group } = stubObstacles();
  globalThis.window.obstacles = group;
  globalThis.obstacles = group;
  delete globalThis.window.RoomTemplates;
  loadGameModule('js/roomTemplates.js');
  return globalThis.window.RoomTemplates.spawnObstacle(100, 100, key);
}

test('Statuen und Saeulen sind zerstoerbar und tragen den stone-Tier', () => {
  ['statue_knight', 'pillar_large', 'pillar_small'].forEach((key) => {
    const o = make(key);
    assert.strictEqual(o.getData('destructible'), true, key + ' ist zerstoerbar');
    assert.strictEqual(o.getData('lootTier'), 'stone', key + ' ist Kulisse, kein Behaelter');
  });
});

test('Braziers und Altare sind zerstoerbar und tragen den stone-Tier (Kulisse)', () => {
  ['brazier', 'altar'].forEach((key) => {
    const o = make(key);
    assert.strictEqual(o.getData('destructible'), true, key + ' ist zerstoerbar');
    assert.strictEqual(o.getData('lootTier'), 'stone', key + ' ist Kulisse, kein Behaelter');
  });
});

test('Behaelter behalten ihre bisherigen Loot-Tiers', () => {
  const cases = {
    chest_large: 'large',
    chest_medium: 'medium',
    chest_small: 'small',
    barrel: 'minor',
    crate: 'minor',
    rubble: 'minor'
  };
  Object.keys(cases).forEach((key) => {
    const o = make(key);
    assert.strictEqual(o.getData('destructible'), true, key + ' ist zerstoerbar');
    assert.strictEqual(o.getData('lootTier'), cases[key], key + ' -> ' + cases[key]);
  });
});

test('Waende und Boden bleiben unzerstoerbar', () => {
  ['wall', 'floor', 'door_closed'].forEach((key) => {
    const o = make(key);
    assert.ok(!o.getData('destructible'), key + ' darf nicht zerbrechen');
    assert.strictEqual(o.getData('lootTier'), undefined, key + ' hat keinen Loot-Tier');
  });
});
