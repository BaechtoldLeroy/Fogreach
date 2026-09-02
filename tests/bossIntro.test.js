// tests/bossIntro.test.js — der Vorkampf-Beat des Kettenmeisters (#77).
//
// Die Optik ist headless nicht pruefbar. Pruefbar — und das ist hier das
// Riskante — ist der ZUSTAND: das Spiel wird angehalten, der Boss stillgelegt,
// die Kamera von der Spielerverfolgung geloest. Bleibt eines davon haengen,
// steht der Spieler in einem toten Spiel. Genau darum geht es hier.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;
loadGameModule('js/bossIntro.js');

// Szenen-Attrappe, die Tweens SAMMELT statt sie laufen zu lassen — so laesst
// sich die Sequenz Schritt fuer Schritt von Hand weiterschalten.
function szene() {
  const tweens = [];
  const objekt = () => ({
    x: 0, y: 0, alpha: 1, scale: 1,
    setScrollFactor() { return this; }, setDepth() { return this; },
    setOrigin() { return this; }, setAlpha() { return this; },
    setScale() { return this; }, destroy() { this._weg = true; },
  });
  const kam = {
    zoom: 1, _folgt: 'player', _gestoppt: false,
    stopFollow() { this._folgt = null; this._gestoppt = true; },
    startFollow(z) { this._folgt = z; },
    setZoom(z) { this.zoom = z; },
    zoomTo(z) { this.zoom = z; },
    pan() {},
  };
  return {
    _tweens: tweens, _kam: kam,
    scale: { width: 800, height: 600 },
    cameras: { main: kam },
    add: { rectangle: () => objekt(), text: () => objekt() },
    tweens: { add: (cfg) => { tweens.push(cfg); return cfg; } },
    input: {
      _tasten: {}, _zeiger: [],
      keyboard: {
        on(ev, fn) { (this._t = this._t || {})[ev] = fn; },
        off(ev) { if (this._t) delete this._t[ev]; },
      },
      on(ev, fn) { if (ev === 'pointerdown') this._pd = fn; },
      off(ev) { if (ev === 'pointerdown') this._pd = null; },
    },
    time: { now: 0 },
    physics: { world: { pause() {}, resume() {} } },
  };
}

function boss() { return { x: 100, y: 100, body: { setVelocity() {} } }; }

/** Leertaste druecken, so wie Phaser es meldet. */
function leertaste(sc) {
  const fn = sc.input.keyboard._t && sc.input.keyboard._t['keydown-SPACE'];
  assert.ok(fn, 'auf die Leertaste wird gar nicht gehoert');
  fn();
}

// Die Sequenz laeuft auf ECHTER Zeit (setTimeout), nicht auf Tween-Ketten —
// der erste Entwurf haengte daran und blieb im Spiel bei 5,3 s stehen. Mit
// _TEMPO 0.01 dauert der ganze Ablauf ~40 ms statt ~3,8 s.
async function sequenzAbwarten(faktor) {
  await new Promise((r) => setTimeout(r, Math.max(60, 4200 * faktor + 40)));
}

function frisch() {
  W.__GAME_PAUSE = { offset: 0, since: null, _scene: null };
  const figur = { x: 0, y: 0 };
  W.player = figur;
  let pausiert = false;
  W.pauseGameClock = () => { pausiert = true; W.__GAME_PAUSE.since = 0; };
  W.resumeGameClock = () => { pausiert = false; W.__GAME_PAUSE.since = null; };
  const q = () => pausiert;
  q.figur = figur;
  return q;
}

test('Der Beat haelt das Spiel an und legt den Boss still', () => {
  const istPausiert = frisch();
  const sc = szene();
  const b = boss();

  const laeuft = W.BossIntro.inszeniere(sc, b, 'Kettenmeister', 'Die Siegel...');
  assert.strictEqual(laeuft, true);
  assert.strictEqual(istPausiert(), true, 'Spiel angehalten');
  assert.ok(b._introHaltBis > 0, 'Boss stillgelegt');
  assert.strictEqual(sc._kam._gestoppt, true, 'Kamera folgt nicht mehr dem Spieler');
});

test('Ohne Bestaetigung geht es NICHT weiter', async () => {
  const istPausiert = frisch();
  const sc = szene();
  const b = boss();
  const echt = W.BossIntro._TEMPO;
  W.BossIntro._TEMPO = 0.01;
  try {
    W.BossIntro.inszeniere(sc, b, 'Kettenmeister', 'Die Siegel...');
    await sequenzAbwarten(0.01);
    // Eine feste Lesezeit gibt es nicht mehr — der Spieler entscheidet.
    assert.strictEqual(istPausiert(), true, 'Spiel wartet weiter');
    assert.strictEqual(sc.__bossIntroLaeuft, true);
  } finally { W.BossIntro._TEMPO = echt; }
});

test('Nach der Bestaetigung ist ALLES zurueckgedreht', async () => {
  const istPausiert = frisch();
  const sc = szene();
  const b = boss();
  const echt = W.BossIntro._TEMPO;
  W.BossIntro._TEMPO = 0.01;
  await new Promise((r) => setTimeout(r, 5));
  W.BossIntro.inszeniere(sc, b, 'Kettenmeister', 'Die Siegel...');
  await new Promise((r) => setTimeout(r, 30));   // Eingabe-Sperre abwarten
  leertaste(sc);
  await new Promise((r) => setTimeout(r, 40));
  W.BossIntro._TEMPO = echt;

  assert.strictEqual(istPausiert(), false, 'Spiel laeuft wieder');
  assert.strictEqual(b._introHaltBis, 0, 'Boss darf wieder');
  assert.strictEqual(sc._kam._folgt, istPausiert.figur, 'Kamera folgt wieder dem Spieler');
  assert.strictEqual(sc._kam.zoom, 1, 'Zoom zurueckgesetzt');
  assert.strictEqual(sc.__bossIntroLaeuft, false);
});

test('Zwei Beats gleichzeitig gibt es nicht', () => {
  frisch();
  const sc = szene();
  assert.strictEqual(W.BossIntro.inszeniere(sc, boss(), 'A', 'x'), true);
  assert.strictEqual(W.BossIntro.inszeniere(sc, boss(), 'B', 'y'), false,
    'der zweite Aufruf muss abgelehnt werden');
});

test('Ohne brauchbare Szene beginnt gar nichts — der Aufrufer faellt zurueck', () => {
  frisch();
  assert.strictEqual(W.BossIntro.inszeniere(null, boss(), 'A', 'x'), false);
  assert.strictEqual(W.BossIntro.inszeniere({}, boss(), 'A', 'x'), false);
});

test('Der Notausgang dreht alles zurueck, wenn kein Tween je fertig wird', async () => {
  const istPausiert = frisch();
  const sc = szene();
  const b = boss();

  // Frist kurz setzen, damit der Notausgang im Test wirklich zuschlaegt.
  const echt = W.BossIntro._NOTAUSGANG_MS;
  W.BossIntro._NOTAUSGANG_MS = 30;
  try {
    W.BossIntro.inszeniere(sc, b, 'Kettenmeister', 'Die Siegel...');
    sc._tweens.length = 0;               // kein einziger Tween wird je fertig
    assert.strictEqual(istPausiert(), true, 'vorher haengt es');
    assert.notStrictEqual(sc._kam.zoom, 1, 'Kamera ist herangefahren');

    await new Promise((r) => setTimeout(r, 80));

    assert.strictEqual(istPausiert(), false, 'Notausgang hat das Spiel freigegeben');
    assert.strictEqual(b._introHaltBis, 0, 'Boss darf wieder');
    assert.strictEqual(sc._kam._folgt, istPausiert.figur, 'Kamera folgt wieder');
    assert.strictEqual(sc.__bossIntroLaeuft, false, 'Sperre geloest');
    // Der Rueckweg wird hier NIE animiert — nur das harte Zuruecksetzen
    // im Aufraeumen bringt den Zoom zurueck.
    assert.strictEqual(sc._kam.zoom, 1, 'Zoom hart zurueckgesetzt');
  } finally {
    W.BossIntro._NOTAUSGANG_MS = echt;
  }
});

test('Der Notausgang laesst dem Spieler wirklich Zeit', () => {
  // Er ist KEINE Lesezeit-Obergrenze mehr, sondern der Fall "Eingabe kommt
  // nicht an". Eine knappe Frist wuerde den Beat mitten im Lesen abschneiden.
  assert.ok(W.BossIntro._NOTAUSGANG_MS >= 30000,
    'Frist ' + W.BossIntro._NOTAUSGANG_MS + ' ms schneidet Lesende ab');
  assert.ok(W.BossIntro._EINGABE_AB >= 150,
    'ohne Sperre beendet ein noch fliegender Tastendruck den Beat sofort');
});

test('Ein Tipp auf den Schirm bestaetigt genauso', async () => {
  const istPausiert = frisch();
  const sc = szene();
  const echt = W.BossIntro._TEMPO;
  W.BossIntro._TEMPO = 0.01;
  try {
    W.BossIntro.inszeniere(sc, boss(), 'Kettenmeister', 'Die Siegel...');
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(sc.input._pd, 'auf Tippen wird gar nicht gehoert');
    sc.input._pd();
    await new Promise((r) => setTimeout(r, 40));
    assert.strictEqual(istPausiert(), false, 'Tippen gibt das Spiel frei');
  } finally { W.BossIntro._TEMPO = echt; }
});

