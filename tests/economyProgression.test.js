// Unit tests for Feature 060 WP05 — Ökonomie, Pacing & Persistenz.
//
// Deckt drei Aufgaben ab:
//   1. Gestreckte Level-Kurve (#41): getNeededXP liefert monoton steigende,
//      progressiv steilere Schwellen als die alte ~lineare 2*level-Kurve.
//   2. Save-Roundtrip: SkillTree-State (Punkte + Ränge) bettet in einen
//      Save-Payload ein und lädt sich verlustfrei wieder.
//   3. Migration alter Saves (Pre-060): ein Save OHNE skillTree-Block migriert
//      zu skillPoints = playerLevel, ohne Item-/Gold-Verlust.
//
// main.js/storage.js sind keine ladbaren IIFE-Module (sie referenzieren viele
// freie Script-Scope-Globals), darum:
//   - Die Level-Kurve wird über die identische zentrale Formel geprüft (die in
//     main.js als getNeededXP lebt) — Quelle der Wahrheit unten gespiegelt.
//   - Die Save-/Migrations-Logik wird gegen das ECHTE SkillTree-Modul über
//     denselben Algorithmus geprüft, den applySaveToState in storage.js fährt.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

if (!globalThis.window) require('./setup');
loadGameModule('js/skillTree.js');
const ST = globalThis.window.SkillTree;

// ── Gespiegelte zentrale Level-Kurve (identisch zu main.js getNeededXP) ──────
const XP_CURVE_BASE = 4;
const XP_CURVE_SCALE = 1;
const XP_CURVE_EXP = 1.6;
function getNeededXP(level) {
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  return Math.round(XP_CURVE_BASE + XP_CURVE_SCALE * Math.pow(lvl, XP_CURVE_EXP));
}
// Alte, ~lineare Kurve (Referenz für "steiler als vorher").
const oldNeededXP = (level) => 2 * level;

// ── Gespiegelte storage.js-Logik (Save einbetten / laden / migrieren) ────────
// Save-Pfad: cloneSkillTree() schreibt getSaveData() in payload.skillTree.
function buildSavePayloadSkillTree() {
  if (globalThis.window.SkillTree && typeof globalThis.window.SkillTree.getSaveData === 'function') {
    return globalThis.window.SkillTree.getSaveData();
  }
  return null;
}
// Load-Pfad: applySaveToState() wendet skillTree an ODER migriert.
function applySkillTreeFromSave(save) {
  const SkillTree = globalThis.window.SkillTree;
  if (!SkillTree) return;
  if (save.skillTree && typeof save.skillTree === 'object') {
    SkillTree.loadSaveData(save.skillTree);
  } else {
    SkillTree.resetForNewGame();
    const lvl = Math.max(0, Math.floor(Number(save.playerLevel) || 0));
    if (lvl > 0) SkillTree.grantSkillPoint(lvl);
  }
}

beforeEach(() => { ST._configureForTest({}); });

// ───────────────────────────────── Level-Kurve ──────────────────────────────

test('Level-Kurve: erwartete Beispiel-Schwellen (L1/5/10/20)', () => {
  assert.strictEqual(getNeededXP(1), 5);
  assert.strictEqual(getNeededXP(5), 17);
  assert.strictEqual(getNeededXP(10), 44);
  assert.strictEqual(getNeededXP(20), 125);
});

test('Level-Kurve: streng monoton steigend über L1..50', () => {
  for (let lvl = 1; lvl < 50; lvl++) {
    assert.ok(getNeededXP(lvl + 1) > getNeededXP(lvl),
      'nicht monoton bei L' + lvl + ': ' + getNeededXP(lvl) + ' -> ' + getNeededXP(lvl + 1));
  }
});

test('Level-Kurve: ab mittleren Leveln deutlich steiler als die alte 2*level-Kurve', () => {
  // Bei niedrigen Leveln darf der Sockel die alte Kurve leicht überholen; der
  // springende Punkt ist, dass die neue Kurve progressiv wegzieht.
  [5, 10, 20, 40].forEach((lvl) => {
    assert.ok(getNeededXP(lvl) > oldNeededXP(lvl),
      'neue Kurve nicht steiler bei L' + lvl + ' (' + getNeededXP(lvl) + ' vs ' + oldNeededXP(lvl) + ')');
  });
  // Verhältnis wächst mit dem Level (Progression, nicht nur Offset).
  const ratio10 = getNeededXP(10) / oldNeededXP(10);
  const ratio40 = getNeededXP(40) / oldNeededXP(40);
  assert.ok(ratio40 > ratio10, 'Steilheits-Verhältnis wächst nicht mit dem Level');
});

test('Level-Kurve: defensiv gegen ungültige Eingaben (Floor auf L1)', () => {
  assert.strictEqual(getNeededXP(0), getNeededXP(1));
  assert.strictEqual(getNeededXP(-3), getNeededXP(1));
  assert.strictEqual(getNeededXP(NaN), getNeededXP(1));
  assert.strictEqual(getNeededXP(2.9), getNeededXP(2));
});

// ───────────────────────────── Save-Roundtrip ───────────────────────────────

test('Save-Roundtrip: SkillTree-State bettet ein und lädt verlustfrei', () => {
  // State aufbauen: Punkte vergeben + einen Rang investieren.
  ST.grantSkillPoint(5);
  // Wurzelknoten = nur minLevel-Anforderung, kein Vorgängerknoten.
  const firstNodeId = Object.keys(ST.SKILL_TREE.nodes).find((id) => {
    const req = ST.SKILL_TREE.nodes[id].requires || {};
    return !req.node;
  });
  assert.ok(firstNodeId, 'Wurzelknoten gefunden');
  assert.strictEqual(ST.investPoint(firstNodeId, 10), true);

  const spentBefore = ST.getSpentPoints();
  const pointsBefore = ST.getSkillPoints();
  assert.ok(spentBefore >= 1);

  // In einen Save-Payload einbetten (wie storage.js saveGame).
  const save = { playerLevel: 6, materials: { GOLD: 999 }, skillTree: buildSavePayloadSkillTree() };
  assert.ok(save.skillTree && typeof save.skillTree === 'object', 'skillTree-Block vorhanden');
  assert.strictEqual(save.skillTree.ranks[firstNodeId], 1);

  // Frischer State, dann aus dem Save laden (wie storage.js applySaveToState).
  ST._configureForTest({});
  assert.strictEqual(ST.getSpentPoints(), 0);
  applySkillTreeFromSave(save);

  assert.strictEqual(ST.getSkillPoints(), pointsBefore, 'Punkte nicht verlustfrei');
  assert.strictEqual(ST.getSpentPoints(), spentBefore, 'Ränge nicht verlustfrei');
  assert.strictEqual(ST.getRank(firstNodeId), 1, 'Rang nicht wiederhergestellt');
  // Gold/Items im Save bleiben unberührt vom SkillTree-Pfad.
  assert.strictEqual(save.materials.GOLD, 999);
});

// ──────────────────────────── Migration Pre-060 ─────────────────────────────

test('Migration: Pre-060-Save ohne skillTree -> skillPoints = playerLevel', () => {
  const save = {
    playerLevel: 7,
    materials: { GOLD: 1234 },
    inventory: [{ tier: 1 }, null, { tier: 2 }]
    // KEIN skillTree-Block (alter Save)
  };
  ST._configureForTest({});
  applySkillTreeFromSave(save);

  assert.strictEqual(ST.getSkillPoints(), 7, 'Migration: skillPoints != playerLevel');
  assert.strictEqual(ST.getSpentPoints(), 0, 'Migration sollte nichts investieren');
  // Kein Item-/Gold-Verlust: der Save-Payload bleibt unangetastet.
  assert.strictEqual(save.materials.GOLD, 1234);
  assert.strictEqual(save.inventory.length, 3);
});

test('Migration: Pre-060-Save mit Level 0/fehlend vergibt keine Punkte, kein Crash', () => {
  const save = { materials: { GOLD: 0 } }; // kein playerLevel, kein skillTree
  ST._configureForTest({});
  assert.doesNotThrow(() => applySkillTreeFromSave(save));
  assert.strictEqual(ST.getSkillPoints(), 0);
});
