// Regression: Absturz auf zerstoerten Text-Nodes (mobile), jetzt in hudLeiste.
//
// Gemeldet vom Geraet (damals in mobileAbilityButtons.js, das die Knoepfe vor
// #195 mit Emoji schmueckte):
//   TypeError: Cannot read properties of null (reading 'glTexture')
//     at initialize.updateText (phaser.min.js)
//     at initialize.setText (phaser.min.js)
//
// Ursache: eine Abfrage prueft nur den WAHRHEITSWERT eines Nodes. Ein
// zerstoertes Phaser-Objekt ist weiterhin truthy (scene undefined, active
// false), und setText rendert die Textur neu -> Absturz. Die Ringe mit Icon
// (hudLeiste.taktMobil) rufen je Bild setText/setFrame auf und muessen eine
// tote Dekoration als Einheit erkennen und uebergehen.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

/** Phaser-artiges Objekt: nach destroy() truthy, aber tot. */
function machNode(extra) {
  const o = Object.assign({
    scene: {}, active: true, visible: true, alpha: 1, text: '', x: 0, y: 0, frame: null,
    destroy() { this.scene = undefined; this.active = false; },
    pruefe() { if (!this.scene) throw new TypeError("Cannot read properties of null (reading 'glTexture')"); },
    setText(v) { this.pruefe(); this.text = v; return this; },
    setFrame(f) { this.pruefe(); this.frame = f; return this; },
    setVisible(v) { this.visible = v; return this; },
    setAlpha(a) { this.alpha = a; return this; },
    setColor() { return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setFillStyle() { return this; },
    clear() { this.pruefe(); return this; },
    fillStyle() { return this; },
    fillPoints() { return this; },
  }, extra || {});
  return o;
}

function machDeko(key) {
  return {
    key: key || 'attack', abilityId: null, modus: null,
    kreis: machNode({ x: 10, y: 20 }), c: machNode(),
    a: { form: 'kreis', r: 30, mitBild: true, icon: machNode(), ersatz: machNode(), sweep: machNode(),
      blitz: machNode(), zahl: machNode(), id: null, grau: null, anteil: 0, rest: 0, dauer: 0, zahlText: '', zeichnungen: 0 },
  };
}

const szene = { time: { now: 0 }, tweens: { add() {} } };

beforeEach(() => {
  resetStore();
  loadGameModule('js/hudLeiste.js');
  window.__abilityCooldownMs__ = { attack: 0 };
  // Friedliches Ziel -> der Zweig, der das Icon wechselt (Aktion).
  window.hasPeacefulTarget = () => true;
});

test('lebende Dekoration: der Primaerknopf wechselt auf das Aktions-Icon', () => {
  const d = machDeko();
  window.hudLeiste.taktMobil([d], szene);
  assert.strictEqual(d.modus, 'interact');
  assert.strictEqual(d.a.icon.frame, window.hudLeiste.frame('interact'));
  assert.strictEqual(d.c.x, 10, 'der Ring folgt seinem Kreis nicht');
});

test('zerstoertes Icon laesst den Takt NICHT abstuerzen (glTexture)', () => {
  const d = machDeko();
  d.a.icon.destroy();
  assert.doesNotThrow(() => window.hudLeiste.taktMobil([d], szene));
});

test('zerstoerte Restsekunden lassen den Takt NICHT abstuerzen', () => {
  const d = machDeko();
  d.a.zahl.destroy();
  window.hasPeacefulTarget = () => false;
  window.__abilityCooldownMs__.attack = 500;
  assert.doesNotThrow(() => window.hudLeiste.taktMobil([d], szene));
});

test('eine tote Dekoration blockiert die lebenden nicht', () => {
  const tot = machDeko();
  tot.a.ersatz.destroy();
  const lebt = machDeko();
  assert.doesNotThrow(() => window.hudLeiste.taktMobil([tot, lebt], szene));
  assert.strictEqual(lebt.a.icon.frame, window.hudLeiste.frame('interact'), 'die lebende wird weiterhin bedient');
});

test('lebtDeko erkennt genau einen toten Node in der Einheit', () => {
  const d = machDeko('potion');
  d.anzahl = machNode();
  d.pips = [machNode(), machNode()];
  assert.strictEqual(window.hudLeiste.lebtDeko(d), true);
  d.pips[1].destroy();
  assert.strictEqual(window.hudLeiste.lebtDeko(d), false, 'eine Dekoration wird als Einheit erzeugt und zerstoert');
});
