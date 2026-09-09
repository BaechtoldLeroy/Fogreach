// tests/gegnerToenung.test.js — kein Gegner wird nach einem Treffer schwarz.
//
// Gemeldet: "der Standardangriff gibt dem Gegner manchmal einen schwarzen
// Tint". Das "manchmal" war der KRIT — nur der blitzt ueber setTintFill und
// ruft danach _toenungNachBlitz.
//
// Ursache: _clearVisual stellte den Grundton mit
//   if (target._originalTint !== undefined) target.setTint(target._originalTint)
// wieder her. Bei allen Sprite-Gegnern ist _originalTint aber NULL (nur die
// Rechteck-Rueckfaelle tragen eine Farbe), und null besteht diese Pruefung.
// Phaser macht aus setTint(null) Schwarz: der Standardwert 0xffffff greift nur
// bei undefined, GetColorFromValue(null) ist 0.
//
// Der Test faehrt eine Toenungs-Attrappe mit derselben Regel wie Phaser, damit
// die Frage nicht an einer geratenen Semantik haengt.

const { test } = require('node:test');
const assert = require('node:assert');

const WEISS = 0xffffff;

/** Ein Sprite, das setTint genau wie Phaser auslegt. */
function sprite(grundton) {
  return {
    active: true, tint: WEISS, _originalTint: grundton,
    setTint(c) { this.tint = (c === undefined) ? WEISS : (Number(c) & 0xffffff); return this; },
    setTintFill(c) { this.setTint(c); this.fill = true; return this; },
    clearTint() { this.tint = WEISS; this.fill = false; return this; }
  };
}

function frisch() {
  delete require.cache[require.resolve('../js/statusEffects.js')];
  global.window = global.window || {};
  global.player = global.player || { id: 'spieler' };
  require('../js/statusEffects.js');
  return {
    mgr: global.window.statusEffectManager,
    Typ: global.window.StatusEffectType,
    cfg: global.window.STATUS_EFFECT_CONFIG
  };
}

test('Ein Gegner ohne Grundton bleibt nach dem Blitz weiss, nicht schwarz', () => {
  const { mgr } = frisch();
  const g = sprite(null);           // so sieht JEDER Sprite-Gegner aus
  g.setTintFill(0xffffff);          // der Krit-Blitz
  g.clearTint();
  mgr.refreshVisual(g);             // das tut _toenungNachBlitz
  assert.notStrictEqual(g.tint, 0x000000, 'der Gegner ist schwarz geblieben');
  assert.strictEqual(g.tint, WEISS, 'der Gegner traegt eine fremde Farbe: ' + g.tint);
});

test('Ein Gegner MIT Grundton bekommt ihn zurueck', () => {
  // Die Gegenprobe: alles auf clearTint umzustellen waere die einfachste Art,
  // den Test oben zu bestehen — und wuerde den Ratten ihr Braun nehmen.
  const { mgr } = frisch();
  const g = sprite(0x8B4513);
  g.setTintFill(0xffffff);
  g.clearTint();
  mgr.refreshVisual(g);
  assert.strictEqual(g.tint, 0x8B4513, 'der Grundton kam nicht zurueck');
});

test('Gift faerbt gruen und tickt', () => {
  // Die zweite Haelfte der Meldung: "das soll eher gruen sein und ticken".
  const { mgr, Typ, cfg } = frisch();
  assert.strictEqual(cfg[Typ.POISON].tint, 0x44ff44, 'Gift ist nicht gruen');
  assert.ok(cfg[Typ.POISON].tickInterval > 0, 'Gift tickt nicht');
  assert.ok(cfg[Typ.POISON].damage > 0, 'Gift macht keinen Schaden');

  const g = sprite(null);
  mgr.applyEffect(g, Typ.POISON, 'test');
  assert.strictEqual(g.tint, 0x44ff44, 'ein vergifteter Gegner ist nicht gruen');
  // Und die Farbe ueberlebt einen Trefferblitz.
  g.setTintFill(0xffffff); g.clearTint();
  mgr.refreshVisual(g);
  assert.strictEqual(g.tint, 0x44ff44, 'das Gift verliert nach einem Treffer seine Farbe');
});

test('Jeder Statuseffekt hat eine Farbe, die den Blitz ueberlebt', () => {
  // BURNED fehlte in der Prioritaetenliste von _refreshVisual: ein brennender
  // Gegner fiel durch die Schleife und landete in _clearVisual. Die Glutschale
  // (#124) faerbte damit nie.
  const { mgr, Typ, cfg } = frisch();
  Object.keys(Typ).forEach((name) => {
    const typ = Typ[name];
    const g = sprite(null);
    mgr.applyEffect(g, typ, 'test');
    g.setTintFill(0xffffff); g.clearTint();
    mgr.refreshVisual(g);
    assert.strictEqual(g.tint, cfg[typ].tint,
      name + ': erwartet ' + cfg[typ].tint.toString(16) + ', war ' + g.tint.toString(16));
  });
});
