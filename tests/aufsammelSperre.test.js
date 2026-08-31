// tests/aufsammelSperre.test.js — Waffen und Ruestung lassen sich erst nach
// 1500 ms aufheben.
//
// Zweck der Sperre: ein Fund, der dem Spieler direkt vor die Fuesse faellt,
// verschwindet sonst im selben Bild im Inventar — gesehen hat er ihn dann nie.
// Traenke, Material, Gold und Questgegenstaende sind bewusst ausgenommen; die
// sammelt man im Vorbeilaufen ein.
//
// Geprueft wird die ENTSCHEIDUNG, nicht der Quelltext: collectLoot wird mit
// einer Beute-Attrappe aufgerufen und muss vor Ablauf der Frist ohne Wirkung
// zurueckkehren. Ein reiner Textabgleich haette eine falsch verdrahtete
// Zeitbasis durchgelassen.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;

// gameNow ist steuerbar: die Sperre muss an der SPIELUHR haengen, nicht an
// Date.now — sonst laeuft die Frist waehrend einer Pause weiter.
let uhr = 0;
W.gameNow = () => uhr;

W.inventory = new Array(20).fill(null);
globalThis.inventory = W.inventory;
W.player = { x: 0, y: 0 };
W.materialCounts = {};

loadGameModule('js/loot.js');

function macheBeute(item, frei) {
  const daten = { item: item };
  if (frei !== null) daten.aufsammelbarAb = frei;
  let zerstoert = false;
  return {
    x: 0, y: 0, scene: null,
    getData: (k) => daten[k],
    setData: (k, v) => { daten[k] = v; },
    destroy: () => { zerstoert = true; },
    istZerstoert: () => zerstoert,
  };
}

test('Aufsammel-Sperre: eine Waffe bleibt vor Ablauf der Frist liegen', () => {
  W.inventory.fill(null);
  uhr = 1000;
  const beute = macheBeute({ type: 'weapon', name: 'Testklinge' }, 1000 + 1500);
  W.collectLoot.call({}, W.player, beute);
  assert.ok(!W.inventory.some((s) => s && s.name === 'Testklinge'),
    'die Waffe wurde trotz laufender Sperre eingesammelt');
  assert.ok(!beute.istZerstoert(), 'die Beute wurde trotz laufender Sperre entfernt');
});

test('Aufsammel-Sperre: nach Ablauf wird dieselbe Waffe aufgehoben', () => {
  W.inventory.fill(null);
  uhr = 1000;
  const beute = macheBeute({ type: 'weapon', name: 'Testklinge' }, 1000 + 1500);
  W.collectLoot.call({}, W.player, beute);          // zu frueh
  uhr = 1000 + 1500;                                 // Frist genau abgelaufen
  W.collectLoot.call({}, W.player, beute);
  assert.ok(W.inventory.some((s) => s && s.name === 'Testklinge'),
    'die Waffe wurde nach Ablauf der Sperre nicht aufgehoben');
});

test('Aufsammel-Sperre: Traenke sind ausgenommen', () => {
  W.inventory.fill(null);
  uhr = 0;
  // Ohne Stempel — genau so spawnt spawnLoot alles ausser Ausruestung.
  const beute = macheBeute({ type: 'potion', name: 'Testtrank', potionTier: 1 }, null);
  W.collectLoot.call({}, W.player, beute);
  assert.ok(W.inventory.some((s) => s && s.name === 'Testtrank'),
    'der Trank wurde nicht sofort aufgehoben — die Sperre greift zu weit');
});

test('Aufsammel-Sperre: die Frist betraegt 1500 ms und gilt fuer alle vier Slots', () => {
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'loot.js'), 'utf8');
  const m = quelle.match(/AUFSAMMEL_SPERRE_MS\s*=\s*(\d+)/);
  assert.ok(m, 'AUFSAMMEL_SPERRE_MS nicht gefunden');
  assert.strictEqual(Number(m[1]), 1500, 'die Frist ist nicht mehr 1500 ms');

  const g = quelle.match(/AUFSAMMEL_GESPERRT\s*=\s*\{([^}]*)\}/);
  assert.ok(g, 'AUFSAMMEL_GESPERRT nicht gefunden');
  ['weapon', 'head', 'body', 'boots'].forEach((slot) => {
    assert.ok(g[1].includes(slot), 'Slot fehlt in der Sperrliste: ' + slot);
  });
});

test('Aufsammel-Sperre: die Frist haengt an der Spieluhr, nicht an Date.now', () => {
  // Ohne das wuerde eine Pause die Frist verbrauchen — dieselbe Falle wie bei
  // den Faehigkeiten-Abklingzeiten.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'loot.js'), 'utf8');
  const i = quelle.indexOf('function collectLoot');
  const block = quelle.slice(i, i + 700);
  assert.ok(block.includes('window.gameNow'),
    'collectLoot prueft die Frist nicht gegen die Spieluhr');
});

test('Aufsammel-Sperre: spawnLoot stempelt die Waffe beim Ablegen', () => {
  // OHNE diesen Fall waren die Tests oben wertlos: sie liefern den Stempel
  // selbst mit und pruefen nie, ob spawnLoot ihn ueberhaupt setzt. Genau das
  // ist in der Mutationspruefung durchgerutscht — die Sperre haette entfernt
  // werden koennen, ohne dass ein Test rot wurde.
  const abgelegt = [];
  W.lootGroup = {
    scene: null,
    create: (x, y, key) => {
      const daten = {};
      const s = {
        x: x, y: y, key: key, scene: null,
        setDisplaySize: () => s, setDepth: () => s, setScale: () => s,
        setData: (k, v) => { daten[k] = v; return s; },
        getData: (k) => daten[k],
        setOrigin: () => s, setAlpha: () => s, setTint: () => s,
        destroy: () => s, daten: daten,
      };
      abgelegt.push(s);
      return s;
    },
  };
  globalThis.lootGroup = W.lootGroup;
  // spawnLoot liest mehrere Globale lexikalisch (klassisches Skript).
  W.currentWave = 1; globalThis.currentWave = 1;
  W.dungeonDepth = 1; globalThis.dungeonDepth = 1;
  W.obstacles = null;
  globalThis.obstacles = null;
  W.currentScene = null;
  uhr = 5000;

  W.spawnLoot(10, 10, { type: 'weapon', name: 'Stempelklinge', iconKey: 'itSword', tier: 0 });
  const waffe = abgelegt.find((s) => s.getData('item') && s.getData('item').name === 'Stempelklinge');
  assert.ok(waffe, 'spawnLoot hat die Waffe gar nicht abgelegt');
  assert.strictEqual(waffe.getData('aufsammelbarAb'), 5000 + 1500,
    'spawnLoot setzt keinen (oder einen falschen) Freigabe-Zeitpunkt');

  // Gegenprobe: ein Trank darf KEINEN Stempel bekommen.
  abgelegt.length = 0;
  W.spawnLoot(10, 10, { type: 'potion', name: 'Stempeltrank', potionTier: 1, iconKey: 'itPotionMinor' });
  const trank = abgelegt.find((s) => s.getData('item') && s.getData('item').name === 'Stempeltrank');
  assert.ok(trank, 'spawnLoot hat den Trank gar nicht abgelegt');
  assert.strictEqual(trank.getData('aufsammelbarAb'), undefined,
    'der Trank bekam eine Sperre — sie greift zu weit');
});
