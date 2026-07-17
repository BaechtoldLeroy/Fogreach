// Unit tests for js/dialogChoice.js (Feature 063 WP02).
// Testet die DOM-freien Pfade: resolve (showIf-Filter), pickResult, applyChoice
// (Flag-Setzen via injiziertem window.questSystem). Das Phaser-present-Rendering
// wird im Browser-Boot-Check (WP05) geprueft, nicht hier.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

let setFlagCalls;
function loadWithQuestSystem(flags) {
  setFlagCalls = [];
  global.window = {
    questSystem: {
      setFlag: (name) => { setFlagCalls.push(name); },
      getFlags: () => Object.assign({}, flags || {})
    }
  };
  delete require.cache[require.resolve('../js/dialogChoice.js')];
  require('../js/dialogChoice.js');
  return global.window.DialogChoice;
}

beforeEach(() => { setFlagCalls = []; });

test('resolve: ohne showIf sind alle Optionen sichtbar', () => {
  const DC = loadWithQuestSystem({});
  const r = DC.resolve({ choices: [{ label: 'a' }, { label: 'b' }] }, {});
  assert.strictEqual(r.visibleChoices.length, 2);
});

test('resolve: showIf(flags)===false entfernt die Option', () => {
  const DC = loadWithQuestSystem({});
  const r = DC.resolve({
    choices: [
      { label: 'immer' },
      { label: 'nur wenn x', showIf: (f) => !!f.x }
    ]
  }, { x: false });
  assert.strictEqual(r.visibleChoices.length, 1);
  assert.strictEqual(r.visibleChoices[0].label, 'immer');
});

test('resolve: showIf reagiert auf gesetzten Flag', () => {
  const DC = loadWithQuestSystem({});
  const cfg = { choices: [{ label: 'geheim', showIf: (f) => !!f.seen }] };
  assert.strictEqual(DC.resolve(cfg, { seen: false }).visibleChoices.length, 0);
  assert.strictEqual(DC.resolve(cfg, { seen: true }).visibleChoices.length, 1);
});

test('pickResult: flagsSet entspricht choice.setFlags', () => {
  const DC = loadWithQuestSystem({});
  const res = DC.pickResult({ label: 'x', setFlags: ['flag_a', 'flag_b'] }, 3);
  assert.strictEqual(res.index, 3);
  assert.deepStrictEqual(res.flagsSet, ['flag_a', 'flag_b']);
});

test('pickResult: ohne setFlags leeres flagsSet', () => {
  const DC = loadWithQuestSystem({});
  assert.deepStrictEqual(DC.pickResult({ label: 'x' }, 0).flagsSet, []);
});

test('applyChoice: setzt die Flags ueber questSystem.setFlag', () => {
  const DC = loadWithQuestSystem({});
  const res = DC.applyChoice({ label: 'Siegel setzen', setFlags: ['verification_sealed'] }, 0);
  assert.deepStrictEqual(setFlagCalls, ['verification_sealed']);
  assert.deepStrictEqual(res.flagsSet, ['verification_sealed']);
});

test('applyChoice: mehrere Flags werden alle gesetzt; onPick laeuft', () => {
  const DC = loadWithQuestSystem({});
  let picked = false;
  DC.applyChoice({ label: 'x', setFlags: ['a', 'b'], onPick: () => { picked = true; } }, 1);
  assert.deepStrictEqual(setFlagCalls, ['a', 'b']);
  assert.strictEqual(picked, true);
});

test('applyChoice: ohne setFlags kein setFlag-Aufruf', () => {
  const DC = loadWithQuestSystem({});
  DC.applyChoice({ label: 'nur reden', response: 'ANTWORT' }, 0);
  assert.deepStrictEqual(setFlagCalls, []);
});

test('toPage: liefert _showDialoguePages-kompatibles Objekt mit _choiceConfig', () => {
  const DC = loadWithQuestSystem({});
  const cfg = { prompt: 'FRAGE', choices: [{ label: 'ja' }, { label: 'nein' }] };
  const page = DC.toPage(cfg);
  assert.strictEqual(page.text, 'FRAGE');
  assert.strictEqual(page.choices.length, 2);
  assert.strictEqual(page.choices[0].label, 'ja');
  assert.strictEqual(page._choiceConfig, cfg);
});

test('robust: fehlt questSystem.setFlag, wirft applyChoice nicht', () => {
  global.window = {}; // kein questSystem
  delete require.cache[require.resolve('../js/dialogChoice.js')];
  require('../js/dialogChoice.js');
  const DC = global.window.DialogChoice;
  assert.doesNotThrow(() => DC.applyChoice({ label: 'x', setFlags: ['a'] }, 0));
});
