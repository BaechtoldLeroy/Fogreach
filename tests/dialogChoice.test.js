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

// --- present(): ESC-Handler-Lifecycle (Leak-Regression) --------------------
// Minimaler Phaser-Ersatz: nur so viel, dass present() rendert und wir das
// keydown-ESC-Listener-Konto sowie das Container-'destroy'-Event verfolgen.
function makeEmitter(o) {
  const h = {};
  o.on = (ev, fn) => { (h[ev] = h[ev] || []).push({ fn, once: false }); return o; };
  o.once = (ev, fn) => { (h[ev] = h[ev] || []).push({ fn, once: true }); return o; };
  o.off = (ev, fn) => { if (h[ev]) h[ev] = h[ev].filter((x) => x.fn !== fn); return o; };
  o.emit = (ev) => { (h[ev] || []).slice().forEach((x) => { if (x.once) o.off(ev, x.fn); x.fn(); }); };
  return o;
}
function makeChild() {
  const o = {};
  const self = () => o;
  ['fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect', 'setOrigin',
   'setPosition', 'setInteractive', 'setScrollFactor', 'setDepth', 'on', 'once', 'off']
    .forEach((m) => { o[m] = self; });
  return o;
}
function makeMockScene() {
  const kb = {
    _l: {},
    on(ev, fn) { (this._l[ev] = this._l[ev] || []).push(fn); },
    off(ev, fn) { if (this._l[ev]) this._l[ev] = this._l[ev].filter((f) => f !== fn); },
    count(ev) { return (this._l[ev] || []).length; },
    fire(ev) { (this._l[ev] || []).slice().forEach((f) => f()); }
  };
  const containers = [];
  const scene = {
    _containers: containers,
    cameras: { main: { width: 800, height: 600 } },
    input: { keyboard: kb },
    add: {
      container() {
        const c = { list: [], _destroyed: false };
        makeEmitter(c);
        c.setDepth = () => c; c.setScrollFactor = () => c; c.setName = () => c;
        c.add = (x) => { c.list.push(x); return c; };
        c.destroy = () => { if (c._destroyed) return; c._destroyed = true; c.emit('destroy'); };
        containers.push(c);
        return c;
      },
      graphics: makeChild, text: makeChild,
      zone: () => makeChild()
    }
  };
  return { scene, kb };
}
function loadDC() {
  global.window = { questSystem: { setFlag() {}, getFlags: () => ({}) } };
  delete require.cache[require.resolve('../js/dialogChoice.js')];
  require('../js/dialogChoice.js');
  return global.window.DialogChoice;
}

test('present: registriert genau einen keydown-ESC-Handler', () => {
  const DC = loadDC();
  const { scene, kb } = makeMockScene();
  DC.present(scene, { prompt: 'F', choices: [{ label: 'a' }], onCancel() {} });
  assert.strictEqual(kb.count('keydown-ESC'), 1);
});

test('present: handle.destroy() haengt den ESC-Handler ab', () => {
  const DC = loadDC();
  const { scene, kb } = makeMockScene();
  const handle = DC.present(scene, { prompt: 'F', choices: [{ label: 'a' }], onCancel() {} });
  handle.destroy();
  assert.strictEqual(kb.count('keydown-ESC'), 0);
});

test('present: EXTERNE Container-Zerstoerung (Sweep) haengt den ESC-Handler ab', () => {
  const DC = loadDC();
  const { scene, kb } = makeMockScene();
  DC.present(scene, { prompt: 'F', choices: [{ label: 'a' }], onCancel() {} });
  // Simuliert HubSceneV2._sweepDialogSurfaces: Container direkt zerstoeren,
  // OHNE handle.destroy() oder ESC/Abbrechen.
  scene._containers[scene._containers.length - 1].destroy();
  assert.strictEqual(kb.count('keydown-ESC'), 0);
});

test('present: wiederholtes Oeffnen+Sweep leakt keine ESC-Handler (Branka-Hang)', () => {
  const DC = loadDC();
  const { scene, kb } = makeMockScene();
  for (let i = 0; i < 20; i++) {
    DC.present(scene, { prompt: 'F', choices: [{ label: 'a' }], onCancel() {} });
    // jedes Mal extern wegsweepen (erneutes Ansprechen)
    scene._containers[scene._containers.length - 1].destroy();
  }
  assert.strictEqual(kb.count('keydown-ESC'), 0);
});

test('present: ESC ruft onCancel und haengt danach den Handler ab', () => {
  const DC = loadDC();
  const { scene, kb } = makeMockScene();
  let cancelled = 0;
  DC.present(scene, { prompt: 'F', choices: [{ label: 'a' }], onCancel() { cancelled++; } });
  kb.fire('keydown-ESC');
  assert.strictEqual(cancelled, 1);
  assert.strictEqual(kb.count('keydown-ESC'), 0);
});

test('present: noCancel unterdrueckt den ESC-Handler', () => {
  const DC = loadDC();
  const { scene, kb } = makeMockScene();
  DC.present(scene, { prompt: 'F', choices: [{ label: 'a' }], noCancel: true, onResolved() {} });
  assert.strictEqual(kb.count('keydown-ESC'), 0);
});
