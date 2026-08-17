// Regression: Absturz auf zerstoerten Text-Nodes (mobile).
//
// Gemeldet vom Geraet:
//   TypeError: Cannot read properties of null (reading 'glTexture')
//     at initialize.updateText (phaser.min.js)
//     at initialize.setText (phaser.min.js)
//     at mobileAbilityButtons.js:347
//     at _pollEnabledState (mobileAbilityButtons.js:242)
//
// Ursache: die Abfrage prueft `dec.icon && dec.icon.setText(...)`, also nur den
// WAHRHEITSWERT. Ein zerstoertes Phaser-Objekt ist weiterhin truthy (gemessen:
// truthy true, scene false, active false), und setText rendert die Textur neu
// und greift dabei auf frame.source zu — nach destroy() null.
//
// Vor Feature 065 machte die Abfrage nur setVisible/setAlpha; die fassen die
// Textur nicht an und ueberlebten ein totes Objekt klaglos. Erst der
// Kontext-Primaerbutton mit seinen zwei setText-Aufrufen hat aus der latenten
// Luecke einen harten Absturz gemacht.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

/** Text-Node, der sich wie Phaser verhaelt: nach destroy() truthy, aber tot. */
function machText(inhalt) {
  return {
    scene: {},                 // Phaser setzt das in destroy() zurueck
    active: true,
    visible: false,
    text: inhalt,
    alpha: 1,
    setText(v) {
      // Genau der Absturz aus dem Bericht — Phaser rendert die Textur neu.
      if (!this.scene) throw new TypeError("Cannot read properties of null (reading 'glTexture')");
      this.text = v;
      return this;
    },
    setAlpha(a) { this.alpha = a; return this; },
    setColor() { return this; },
    setVisible(v) { this.visible = v; return this; },
    setScale() { return this; },
    destroy() { this.scene = undefined; this.active = false; },
  };
}

function machDeko() {
  return {
    key: 'attack',
    circle: { setFillStyle() {} },
    originalColor: 0x223344,
    icon: machText('⚔️'),
    label: machText('Angr'),
    cdOverlay: machText(''),
    cdText: null,
  };
}

const szene = { time: { now: 0 }, tweens: { add() {} } };

beforeEach(() => {
  resetStore();
  // Das Modul haengt sich beim Laden an Fensterereignisse (Layout-Bereitschaft).
  if (typeof window.addEventListener !== 'function') window.addEventListener = () => {};
  if (typeof window.removeEventListener !== 'function') window.removeEventListener = () => {};
  loadGameModule('js/mobileAbilityButtons.js');
  window.__abilityCooldownMs__ = { attack: 0 };
  // Friedliches Ziel -> der Zweig, der setText aufruft (Glyphenwechsel).
  window.hasPeacefulTarget = () => true;
});

test('lebende Dekoration: der Primaerbutton wechselt auf Aktion', () => {
  const dec = machDeko();
  window.mobileAbilityPoll([dec], szene);
  assert.strictEqual(dec.icon.text, '✋');
  assert.strictEqual(dec.label.text, 'Aktion');
});

test('zerstoerter Icon-Node laesst die Abfrage NICHT abstuerzen (glTexture)', () => {
  const dec = machDeko();
  dec.icon.destroy();
  assert.doesNotThrow(() => window.mobileAbilityPoll([dec], szene));
});

test('zerstoerter Label-Node laesst die Abfrage NICHT abstuerzen', () => {
  const dec = machDeko();
  dec.label.destroy();
  assert.doesNotThrow(() => window.mobileAbilityPoll([dec], szene));
});

test('eine tote Dekoration blockiert die lebenden nicht', () => {
  const tot = machDeko();
  tot.icon.destroy();
  const lebt = machDeko();
  assert.doesNotThrow(() => window.mobileAbilityPoll([tot, lebt], szene));
  assert.strictEqual(lebt.icon.text, '✋', 'die lebende Dekoration wird weiterhin bedient');
});

test('_lebtDeko erkennt genau einen toten Node in der Einheit', () => {
  const dec = machDeko();
  assert.strictEqual(window.mobileAbilityDekoLebt(dec), true);
  dec.cdOverlay.destroy();
  assert.strictEqual(window.mobileAbilityDekoLebt(dec), false,
    'eine Dekoration wird als Einheit erzeugt und zerstoert');
});
