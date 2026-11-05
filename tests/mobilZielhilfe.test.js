// tests/mobilZielhilfe.test.js — die Zielhilfe des Schlags auf dem Handy
// (js/mobileAutoAim.js).
//
// Spieler wuenschten eine leichte Zielhilfe auch im Nahkampf: bisher half sie
// nur im Stand (Joystick los). Beim Laufen dreht der Schlag jetzt zum Gegner
// vor einem (bis 70 Grad neben der Laufrichtung); wer wegrennt, schlaegt
// weiter in Laufrichtung. Gegner hinter Wand/Tuer zaehlen nicht.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

let W = null;
function richtung() {
  const v = { x: 1, y: 0,
    set(x, y) { this.x = x; this.y = y; return this; },
    normalize() { const l = Math.hypot(this.x, this.y) || 1; this.x /= l; this.y /= l; return this; } };
  return v;
}
function gegner(liste) {
  return { children: { iterate(fn) { liste.forEach(fn); } } };
}
function tippen() {
  W.dispatchEvent(new W.CustomEvent('demonfall:ability-tap', { detail: { ability: 'attack' } }));
}
const winkel = (v) => Math.round(Math.atan2(v.y, v.x) * 180 / Math.PI);

beforeEach(() => {
  if (!globalThis.window) require('./setup');
  W = globalThis.window;
  // Der Test-Window hat keine Ereignisse: Node bringt EventTarget mit.
  if (typeof W.addEventListener !== 'function') {
    const et = new EventTarget();
    W.addEventListener = et.addEventListener.bind(et);
    W.dispatchEvent = et.dispatchEvent.bind(et);
  }
  if (!W.CustomEvent) W.CustomEvent = CustomEvent;
  if (!W.mobileAutoAim) loadGameModule('js/mobileAutoAim.js');
  W.isMobile = true;
  W.__MOBILE_AUTO_AIM__ = true;
  W.player = { x: 0, y: 0 };
  W.lastMoveDirection = richtung();
  W.joystick = { force: 0 };
  delete W.hasLineOfSightToTarget;
});

test('beim Laufen: der Schlag dreht zum Gegner schraeg vorn', () => {
  W.joystick.force = 0.8;
  W.lastMoveDirection.set(1, 0);
  W.enemies = gegner([{ active: true, x: 70, y: 50 }]);
  tippen();
  assert.strictEqual(winkel(W.lastMoveDirection), winkel({ x: 70, y: 50 }));
});

test('beim Laufen: ein Gegner hinter einem zieht den Schlag nicht herum', () => {
  W.joystick.force = 0.8;
  W.lastMoveDirection.set(1, 0);
  W.enemies = gegner([{ active: true, x: -60, y: 10 }, { active: true, x: 10, y: 90 }]);
  tippen();
  assert.strictEqual(winkel(W.lastMoveDirection), 0, 'Schlag verlaesst die Laufrichtung');
});

test('beim Laufen: von zwei Gegnern vorn gewinnt der in Laufrichtung', () => {
  W.joystick.force = 0.8;
  W.lastMoveDirection.set(0, 1);
  W.enemies = gegner([{ active: true, x: 50, y: 40 }, { active: true, x: 5, y: 90 }]);
  tippen();
  assert.strictEqual(winkel(W.lastMoveDirection), winkel({ x: 5, y: 90 }));
});

test('Gegner hinter der Wand oder unsichtbar zaehlen nicht', () => {
  W.joystick.force = 0;
  W.lastMoveDirection.set(1, 0);
  const wand = { active: true, x: 0, y: 40 }, versteckt = { active: true, visible: false, x: 0, y: -40 };
  W.hasLineOfSightToTarget = (e) => e !== wand;
  W.enemies = gegner([wand, versteckt]);
  tippen();
  assert.strictEqual(winkel(W.lastMoveDirection), 0);
});

test('im Stand wie bisher: der naechste Gegner, egal wo', () => {
  W.joystick.force = 0;
  W.lastMoveDirection.set(1, 0);
  W.enemies = gegner([{ active: true, x: -50, y: 0 }]);
  tippen();
  assert.strictEqual(winkel(W.lastMoveDirection), 180);
});

test('aus in den Einstellungen: keine Hilfe', () => {
  W.__MOBILE_AUTO_AIM__ = false;
  W.joystick.force = 0.8;
  W.lastMoveDirection.set(1, 0);
  W.enemies = gegner([{ active: true, x: 60, y: 40 }]);
  tippen();
  assert.strictEqual(winkel(W.lastMoveDirection), 0);
});
