// tests/zusatzAngriffstaste.test.js — zusaetzliche Angriffstaste (Einstellungen).
//
// Viele Tastaturen melden Pfeil-hoch + Pfeil-links + Leertaste nicht
// gleichzeitig (Ghosting): im klassischen Schema war der Hieb nach links oben
// dann unmoeglich. In den Einstellungen laesst sich darum eine zweite
// Angriffstaste waehlen (Keine / X / Y / Num 0); die Leertaste bleibt.
//
// Geprueft am echten Dungeon: Wahl im Einstellungsmenue, Speicherung, die
// echte Phaser-Taste loest den Angriff aus, Beschriftung in der Leiste.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launchDungeon({ depth: 1 });
  // Nicht sterben, waehrend die Faelle takten.
  H.run(`window.game.scene.getScene('GameScene').events.on('update', function () {
    window._playerInvincible = true; if (playerHealth < playerMaxHealth) playerHealth = playerMaxHealth; })`);
});
after(async () => { if (H) await H.shutdown(); });

/** Einstellungsmenue oeffnen und den Knopf der Zusatztaste n-mal druecken. */
function waehle(n) {
  H.run(`window.openSettingsScene(window.game.scene.getScene('GameScene'))`);
  H.step(5);
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('SettingsScene');
    var txt = sc.children.list.filter(function (o) { return o.type === 'Text' && o.text.indexOf('Zusätzliche Angriffstaste') === 0; })[0];
    var knopf = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.input
      && Math.abs(o.y - (txt.y + 8)) < 1 && o.x > txt.x + 150; })[0];
    for (var i = 0; i < ${n}; i++) knopf.emit('pointerdown');
    var hinweis = sc.children.list.filter(function (o) { return o.type === 'Text' && o.text.indexOf('Pfeiltasten') !== -1; }).length;
    sc._close();
    return { hinweis: hinweis };
  })()`);
  H.step(5);
  return r;
}

const GESPEICHERT = `JSON.parse((window.SlotStorage || localStorage).getItem('demonfall_settings_v1') || '{}').extraAttackKey`;

/** Taste wie ein echter Druck setzen, ein paar Bilder takten, Angriffe zaehlen. */
function angriffeNachDruck(tasteName) {
  H.run(`(function () {
    window.__angriffe = 0;
    var IS = window.InputScheme;
    if (!IS.__gezaehlt) {
      var orig = IS.isBasicAttackTriggered;
      IS.isBasicAttackTriggered = function () { var r = orig.apply(this, arguments); if (r) window.__angriffe++; return r; };
      IS.__gezaehlt = true;
    }
    var k = window.game.scene.getScene('GameScene').input.keyboard.addKey('${tasteName}', false);
    k.isDown = true; k._justDown = true;
  })()`);
  H.step(4);
  const n = H.run('window.__angriffe');
  H.run(`(function () { var k = window.game.scene.getScene('GameScene').input.keyboard.addKey('${tasteName}', false);
    k.isDown = false; k._justDown = false; })()`);
  H.step(30); // Angriffsabklingzeit auslaufen lassen
  return n;
}

const ANGRIFF_LABEL = `window._getAbilityHUDState().filter(function (f) { return f.key === 'attack'; })[0].keyLabel`;

test('Standard: keine Zusatztaste, X greift nicht an, Leertaste schon', () => {
  H.run(`(window.SlotStorage || localStorage).removeItem('demonfall_settings_v1');
    window.applyGameSettings(window.loadGameSettings())`);
  assert.strictEqual(H.run('window.loadGameSettings().extraAttackKey'), 'none');
  assert.strictEqual(H.run('window.InputScheme.getExtraAttackKey()'), 'none');
  assert.strictEqual(angriffeNachDruck('X'), 0, 'X loest ohne Einstellung einen Angriff aus');
  assert.strictEqual(angriffeNachDruck('SPACE'), 1, 'Leertaste greift nicht an');
  assert.strictEqual(H.run(ANGRIFF_LABEL), 'Leer');
});

test('Menue: Keine -> X -> Y -> Num 0 -> Keine, gespeichert und sofort wirksam', () => {
  const r = waehle(1);
  assert.strictEqual(r.hinweis, 1, 'Hinweiszeile fehlt');
  assert.strictEqual(H.run(GESPEICHERT), 'x');
  assert.strictEqual(H.run('window.InputScheme.getExtraAttackKey()'), 'x');
  assert.strictEqual(H.run(ANGRIFF_LABEL), 'Leer/X', 'Leiste zeigt die Zusatztaste nicht');
  assert.strictEqual(angriffeNachDruck('X'), 1, 'X greift nicht an');
  assert.strictEqual(angriffeNachDruck('SPACE'), 1, 'Leertaste greift mit Zusatztaste nicht mehr an');
  assert.strictEqual(angriffeNachDruck('Y'), 0, 'Y greift an, obwohl X gewaehlt ist');

  waehle(1);
  assert.strictEqual(H.run(GESPEICHERT), 'y');
  assert.strictEqual(angriffeNachDruck('Y'), 1, 'Y greift nicht an');
  assert.strictEqual(angriffeNachDruck('X'), 0);

  waehle(1);
  assert.strictEqual(H.run(GESPEICHERT), 'num0');
  assert.strictEqual(H.run(ANGRIFF_LABEL), 'Leer/N0');
  assert.strictEqual(angriffeNachDruck('NUMPAD_ZERO'), 1, 'Num 0 greift nicht an');

  waehle(1);
  assert.strictEqual(H.run(GESPEICHERT), 'none');
  assert.strictEqual(H.run(ANGRIFF_LABEL), 'Leer');
  assert.strictEqual(angriffeNachDruck('NUMPAD_ZERO'), 0);
});

test('Gespeicherte Wahl gilt nach dem Laden (applyGameSettings beim Start)', () => {
  H.run(`(function () { var st = window.SlotStorage || localStorage;
    var s = window.loadGameSettings(); s.extraAttackKey = 'y'; st.setItem('demonfall_settings_v1', JSON.stringify(s));
    window.__EXTRA_ATTACK_KEY__ = undefined;
    window.applyGameSettings(window.loadGameSettings()); })()`);
  assert.strictEqual(H.run('window.InputScheme.getExtraAttackKey()'), 'y');
  // Unsinn im Speicher faellt auf "Keine" zurueck.
  H.run(`(function () { var st = window.SlotStorage || localStorage;
    var s = window.loadGameSettings(); s.extraAttackKey = 'Z'; st.setItem('demonfall_settings_v1', JSON.stringify(s));
    window.applyGameSettings(window.loadGameSettings()); })()`);
  assert.strictEqual(H.run('window.InputScheme.getExtraAttackKey()'), 'none');
});

test('Offener Ereignis-Dialog unterdrueckt auch die Zusatztaste', () => {
  H.run(`(function () { var st = window.SlotStorage || localStorage;
    var s = window.loadGameSettings(); s.extraAttackKey = 'x'; st.setItem('demonfall_settings_v1', JSON.stringify(s));
    window.applyGameSettings(window.loadGameSettings()); window.eventChoiceOpen = true; })()`);
  const n = angriffeNachDruck('X');
  H.run('window.eventChoiceOpen = false');
  assert.strictEqual(n, 0, 'X greift durch den offenen Dialog hindurch an');
  H.run(`(window.SlotStorage || localStorage).removeItem('demonfall_settings_v1');
    window.applyGameSettings(window.loadGameSettings())`);
});
