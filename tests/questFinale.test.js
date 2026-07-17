// Unit tests for js/questFinale.js (Feature 063 WP01).
// computeFinaleState(flags) ist rein — wir laden das Modul mit global.window={}.

const { test } = require('node:test');
const assert = require('node:assert');

function load() {
  delete require.cache[require.resolve('../js/questFinale.js')];
  global.window = {};
  require('../js/questFinale.js');
  return global.window.QuestFinale.computeFinaleState;
}

const compute = load();

// --- Regler 1: betrayalForeseen (Maulwurf- ODER Handschriften-Spur) ---------
test('R1: mole_evidence => betrayalForeseen true', () => {
  assert.strictEqual(compute({ mole_evidence: true }).betrayalForeseen, true);
});
test('R1: three_hands_seen => betrayalForeseen true', () => {
  assert.strictEqual(compute({ three_hands_seen: true }).betrayalForeseen, true);
});
test('R1: ohne Spur => betrayalForeseen false', () => {
  assert.strictEqual(compute({}).betrayalForeseen, false);
});

// --- Regler 4: remembered / namelessEnding ----------------------------------
test('R4: self_remembered => remembered true, namelessEnding false', () => {
  const s = compute({ self_remembered: true });
  assert.strictEqual(s.remembered, true);
  assert.strictEqual(s.namelessEnding, false);
});
test('R4: ohne self_remembered => remembered false, namelessEnding true', () => {
  const s = compute({});
  assert.strictEqual(s.remembered, false);
  assert.strictEqual(s.namelessEnding, true);
});

// --- Regler 2: allies -------------------------------------------------------
test('R2: petitions_kept => mara present', () => {
  assert.strictEqual(compute({ petitions_kept: true }).allies.mara, true);
});
test('R2: mole_evidence => mara present', () => {
  assert.strictEqual(compute({ mole_evidence: true }).allies.mara, true);
});
test('R2: petitions_surrendered allein => mara NICHT present', () => {
  assert.strictEqual(compute({ petitions_surrendered: true }).allies.mara, false);
});
test('R2: convoy_blown ueberschreibt mara auf false', () => {
  assert.strictEqual(compute({ petitions_kept: true, convoy_blown: true }).allies.mara, false);
});
test('R2: branka_ally => branka present, thom_ally => thom present', () => {
  const s = compute({ branka_ally: true, thom_ally: true });
  assert.strictEqual(s.allies.branka, true);
  assert.strictEqual(s.allies.thom, true);
});
test('R2: ohne Flags => aloneAtEnd true', () => {
  assert.strictEqual(compute({}).aloneAtEnd, true);
});
test('R2: mit einem Verbuendeten => aloneAtEnd false', () => {
  assert.strictEqual(compute({ branka_ally: true }).aloneAtEnd, false);
});

// --- Regler 3: elara lebt nur bei Vertrauen UND Beweis -----------------------
test('R3: elara_trust + Beweis => lives', () => {
  assert.strictEqual(compute({ elara_trust: true, mole_evidence: true }).elara, 'lives');
  assert.strictEqual(compute({ elara_trust: true, three_hands_seen: true }).elara, 'lives');
});
test('R3: Vertrauen ohne Beweis => dies', () => {
  assert.strictEqual(compute({ elara_trust: true }).elara, 'dies');
});
test('R3: Beweis ohne Vertrauen => dies', () => {
  assert.strictEqual(compute({ mole_evidence: true }).elara, 'dies');
});
test('R3: nichts => dies', () => {
  assert.strictEqual(compute({}).elara, 'dies');
});

// --- Default / Robustheit ---------------------------------------------------
test('Default: leeres Objekt liefert konservativen Zustand', () => {
  assert.deepStrictEqual(compute({}), {
    betrayalForeseen: false,
    allies: { branka: false, mara: false, thom: false },
    elara: 'dies',
    remembered: false,
    aloneAtEnd: true,
    namelessEnding: true
  });
});
test('Default: null/undefined werfen nicht', () => {
  assert.doesNotThrow(() => compute(null));
  assert.doesNotThrow(() => compute(undefined));
  assert.strictEqual(compute(null).elara, 'dies');
});

// --- Reinheit ---------------------------------------------------------------
test('Reinheit: deterministisch + kein Mutieren des Eingabeobjekts', () => {
  const input = { elara_trust: true, mole_evidence: true, self_remembered: true, petitions_kept: true };
  const snapshot = JSON.stringify(input);
  const a = compute(input);
  const b = compute(input);
  assert.deepStrictEqual(a, b);
  assert.strictEqual(JSON.stringify(input), snapshot, 'Eingabeobjekt darf nicht mutiert werden');
  // Sanity: dieser reiche Flag-Satz ergibt den guenstigen Ausgang.
  assert.strictEqual(a.betrayalForeseen, true);
  assert.strictEqual(a.elara, 'lives');
  assert.strictEqual(a.remembered, true);
  assert.strictEqual(a.allies.mara, true);
});
