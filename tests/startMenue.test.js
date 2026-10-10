// tests/startMenue.test.js — das neue Startmenue (Kulisse aus PixelLab-Grafik).
//
// Prueft am echten Spiel (headless, Canvas-Renderer), dass
//   - die Kulisse lebt: Held, Laterne, Titelglanz, Nebel, Glut und Fenster
//     veraendern sich, wenn Zeit vergeht (Zeit vergeht NUR ueber H.step),
//   - alle Knoepfe da, sichtbar obenauf und bedienbar sind
//     (Neues Spiel, Fortsetzen nur mit Spielstand, Einstellungen, Slots, ✕),
//   - der Endlos-Knopf fehlt (#190 on hold),
//   - Hover/Druck die Messingplatte umschalten,
//   - hochkant auf dem Handy der Dreh-Hinweis kommt und quer wieder geht.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
before(async () => {
  H = await launch({ renderer: 'canvas', waitFor: 'StartScene' });
});
after(async () => { if (H) await H.shutdown(); });

const start = (h) => (h || H).scene('StartScene');
const T = (h, key) => h.window.i18n.t(key);

/** StartScene neu aufbauen (wie nach einem Reload) und warten, bis sie laeuft. */
async function neuAufbauen(h) {
  start(h).scene.restart();
  h.step(1);
  assert.ok(await h.waitForScene('StartScene'), 'StartScene kam nicht wieder');
  h.step(2);
}

/** Oberstes interaktives Objekt an (x, y) — so, wie ein echter Tap es trifft. */
function oben(s, x, y) {
  const p = s.input.activePointer;
  p.position.x = x; p.position.y = y;
  const treffer = s.input.hitTestPointer(p);
  return s.input.sortGameObjects(treffer, p)[0] || null;
}

/** Groessenwechsel melden, wie es der ScaleManager bei Drehung/Resize tut. */
function resize(s) {
  const sc = s.scale;
  sc.emit('resize', sc.gameSize, sc.baseSize, sc.displaySize, sc.width, sc.height);
}

function alleTexte(s) {
  return s.children.list.filter((o) => o.type === 'Text').map((o) => o.text);
}

test('Startmenue: die Kulisse ist animiert (Bilder, Nebel, Glut, Licht)', () => {
  const k = start().kulisse;
  assert.ok(k, 'keine Kulisse gebaut');
  const gesehen = { held: new Set(), laterne: new Set(), titel: new Set() };
  const nebelVorher = k.nebel.map((n) => n.ts.tilePositionX);
  const fensterVorher = k.fenster.map((f) => f.alpha);
  const ratVorher = k.ratsfenster.alpha;
  const kraehenVorher = k.kraehen.map((c) => c.x);
  const kraehenBilder = new Set();
  // 6 s Spielzeit in kleinen Schritten — der Titelglanz hat 3,8 s Pause.
  for (let i = 0; i < 72; i++) {
    H.step(5);
    gesehen.held.add(k.held.frame.name);
    gesehen.laterne.add(k.laterne.frame.name);
    gesehen.titel.add(start().titel.frame.name);
    kraehenBilder.add(k.kraehen[0].frame.name);
  }
  k.kraehen.forEach((c, i) => assert.ok(c.x > kraehenVorher[i] + 100,
    'Kraehe ' + i + ' fliegt nicht (' + kraehenVorher[i] + ' -> ' + c.x + ')'));
  assert.ok(kraehenBilder.size >= 6, 'Kraehe schlaegt nicht mit den Fluegeln');
  assert.ok(gesehen.held.size >= 6, 'Archivschmied bewegt sich nicht: ' + [...gesehen.held]);
  assert.ok(gesehen.laterne.size >= 6, 'Laterne flackert nicht: ' + [...gesehen.laterne]);
  assert.ok(gesehen.titel.size >= 6, 'Titelglanz laeuft nicht: ' + [...gesehen.titel]);
  assert.ok(![...gesehen.laterne].includes(8), 'Laterne zeigt Bild 8 (Doppel von Bild 0)');
  k.nebel.forEach((n, i) => assert.ok(n.ts.tilePositionX > nebelVorher[i] + 5,
    'Nebelband ' + i + ' zieht nicht (' + nebelVorher[i] + ' -> ' + n.ts.tilePositionX + ')'));
  assert.ok(k.funken.getAliveParticleCount() >= 10,
    'zu wenig Glut in der Luft: ' + k.funken.getAliveParticleCount());
  const geaendert = k.fenster.filter((f, i) => Math.abs(f.alpha - fensterVorher[i]) > 0.02).length;
  assert.ok(geaendert >= 5, 'Fensterlicht flackert nicht (nur ' + geaendert + ' veraendert)');
  assert.notStrictEqual(k.ratsfenster.alpha, ratVorher, 'Ratsfenster pulsiert nicht');
});

test('Startmenue: die Laterne sitzt auf einem Stab auf der Bruestung, nicht in der Luft', async () => {
  // Bis b352 hing sie an einem Wandhalter neben dem Wasserspeier, dessen
  // Platte in die Luft griff. Dann stand sie ohne Halter auf einer Zinne, mit
  // ihrem spitzen Fuss sah sie aber schwebend aus. Jetzt sitzt sie auf einem
  // kurzen Stab, der auf der Zinne steht.
  const sharp = require('sharp');
  const path = require('path');
  const pfad = (n) => path.join(__dirname, '..', 'assets', 'start', n + '.png');
  const lat = await sharp(pfad('start_laterne')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const br = await sharp(pfad('start_bruestung')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = (b, x, y) => b.data[(y * b.info.width + x) * 4 + 3];
  // Kein Halter mehr: links der Laterne (Spalten 0..6 jedes Bildes) ist alles leer.
  let halter = 0;
  for (let f = 0; f < 8; f++) for (let y = 0; y < 64; y++) for (let x = 0; x < 7; x++) if (alpha(lat, f * 32 + x, y) > 24) halter++;
  assert.strictEqual(halter, 0, 'die Laterne traegt noch ihren Wandhalter (' + halter + ' Pixel)');

  // Inhalt von Bild 0: Spalten und unterste Zeile.
  let x0 = 99, x1 = -1, unten = -1;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 32; x++) if (alpha(lat, x, y) > 24) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); unten = Math.max(unten, y);
  }
  const s = start(), l = s.kulisse.laterne, S = l.scaleX;
  const ch = s.cameras.main.height;
  const links = l.x - l.originX * l.displayWidth, oben0 = l.y - l.originY * l.displayHeight;
  const fuss = oben0 + (unten + 1) * S;
  // Oberkante der Bruestung unter jeder Spalte der Laterne: ueberall gleich
  // hoch (sie steht auf EINER Zinne, nicht ueber einer Luecke) und am Fuss.
  const kanten = [];
  for (let x = x0; x <= x1; x++) {
    const bx = Math.floor((links + (x + 0.5) * S) / S);
    let r = 0;
    while (r < br.info.height && alpha(br, bx, r) <= 24) r++;
    kanten.push(ch - (br.info.height - r) * S);
  }
  const hoechste = Math.min(...kanten), tiefste = Math.max(...kanten);
  assert.ok(tiefste - hoechste <= 2 * S, 'die Laterne steht ueber einer Zinnenluecke: Kanten ' + hoechste + '..' + tiefste);
  const stab = s.kulisse.laternenStab;
  assert.ok(stab && stab.visible, 'kein Stab unter der Laterne');
  const st = stab.data.getAll();
  assert.ok(Math.abs(st.x - l.x) <= S, 'der Stab steht nicht unter der Laterne: ' + st.x + ' / ' + l.x);
  assert.ok(st.unten - st.oben >= 4 * S, 'der Stab ist zu kurz: ' + (st.unten - st.oben) + ' px');
  assert.ok(st.unten >= hoechste && st.unten <= hoechste + 5 * S,
    'Fuss des Stabs bei ' + st.unten + ', Oberkante der Zinne bei ' + hoechste + ' — er schwebt oder versinkt');
  assert.ok(Math.abs(fuss - st.oben) <= S,
    'Fuss der Laterne bei ' + fuss + ', Oberkante des Stabs bei ' + st.oben + ' — sie sitzt nicht auf ihm');
  // Der Schein sitzt auf dem Glas, nicht daneben.
  const sch = s.kulisse.laternenSchein;
  assert.ok(Math.abs(sch.x - l.x) <= 4 && sch.y > oben0 && sch.y < fuss, 'der Schein liegt nicht auf der Laterne');
});

test('Startmenue ohne Spielstand: Start + Einstellungen, kein Fortsetzen, kein Endlos', () => {
  const s = start();
  const m = s.menuKnoepfe;
  assert.ok(m.neuesSpiel, 'kein Start-Knopf');
  assert.strictEqual(m.neuesSpiel.text.text, T(H, 'start.btn.start_game'));
  assert.ok(m.einstellungen, 'kein Einstellungen-Knopf');
  assert.ok(!m.fortsetzen, 'FORTSETZEN ohne Spielstand');
  assert.ok(!m.endlos, 'Endlos-Knopf da, obwohl #190 on hold');
  assert.ok(!alleTexte(s).includes(T(H, 'endless.btn.start')), 'Endlos-Beschriftung sichtbar');
  for (const n of [1, 2, 3]) assert.ok(m['slot' + n], 'Slot-Zeile ' + n + ' fehlt');
  // Jeder Knopf liegt obenauf: ein Tap auf seine Mitte trifft genau seine Platte.
  for (const [name, kn] of Object.entries(m)) {
    assert.ok(oben(s, kn.platte.x, kn.platte.y) === kn.platte, name + ' ist verdeckt');
    assert.ok(kn.platte.displayHeight >= 36, name + ' zu klein fuer Touch: ' + kn.platte.displayHeight);
    assert.ok(kn.platte.x + kn.platte.displayWidth / 2 <= 960 && kn.platte.y + kn.platte.displayHeight / 2 <= 480,
      name + ' ragt aus dem Bild');
  }
});

test('Startmenue: Hover/Druck schalten die Messingplatte, Einstellungen oeffnen sich', async () => {
  const s = start();
  const e = s.menuKnoepfe.einstellungen;
  e.platte.emit('pointerover');
  assert.strictEqual(e.platte.frame.name, 1, 'Hover-Bild fehlt');
  e.platte.emit('pointerdown');
  assert.strictEqual(e.platte.frame.name, 2, 'Druck-Bild fehlt');
  assert.strictEqual(e.text.y, e.platte.y + 2, 'Beschriftung sinkt beim Druck nicht ein');
  const offen = await H.settle(() => H.activeScenes().includes('SettingsScene'), { maxRounds: 20, framesPerRound: 2 });
  assert.ok(offen, 'Einstellungen oeffnen sich nicht');
  H.window.game.scene.stop('SettingsScene');
  H.step(2);
  e.platte.emit('pointerout');
  assert.strictEqual(e.platte.frame.name, 0, 'Platte kehrt nicht in Ruhe zurueck');
});

test('Startmenue: hochkant auf dem Handy kommt der Dreh-Hinweis, quer geht er', () => {
  const s = start();
  const dev = s.sys.game.device.input;
  const vorher = { touch: dev.touch, w: H.window.innerWidth, h: H.window.innerHeight };
  try {
    dev.touch = true;
    H.window.innerWidth = 390; H.window.innerHeight = 844;
    resize(s);
    assert.strictEqual(s.drehHinweis.visible, true, 'kein Hinweis hochkant');
    H.window.innerWidth = 844; H.window.innerHeight = 390;
    resize(s);
    assert.strictEqual(s.drehHinweis.visible, false, 'Hinweis bleibt quer stehen');
    // Quer darf nichts die Knoepfe verdecken (der Schleier liegt ganz oben).
    const kn = s.menuKnoepfe.neuesSpiel;
    assert.ok(oben(s, kn.platte.x, kn.platte.y) === kn.platte, 'Schleier schluckt Taps');
    // Mit Drehsperre: Antippen blendet den Hinweis weg, er kommt nicht wieder.
    H.window.innerWidth = 390; H.window.innerHeight = 844;
    resize(s);
    assert.strictEqual(s.drehHinweis.visible, true, 'Hinweis kommt beim Zurueckdrehen nicht');
    s.drehSchleier.emit('pointerdown');
    assert.strictEqual(s.drehHinweis.visible, false, 'Hinweis laesst sich nicht wegtippen');
    resize(s);
    assert.strictEqual(s.drehHinweis.visible, false, 'weggetippter Hinweis kommt zurueck');
  } finally {
    dev.touch = vorher.touch; H.window.innerWidth = vorher.w; H.window.innerHeight = vorher.h;
    resize(s);
  }
});

test('Startmenue mit Spielstand: FORTSETZEN erscheint und startet den Hub', async () => {
  H.run('(function () { window.playerLevel = 7; saveGame(); })()');
  await neuAufbauen(H);
  const s = start();
  const m = s.menuKnoepfe;
  assert.ok(m.fortsetzen, 'FORTSETZEN fehlt trotz Spielstand');
  assert.strictEqual(m.fortsetzen.text.text, T(H, 'start.btn.continue'));
  assert.strictEqual(m.neuesSpiel.text.text, T(H, 'start.btn.new_game'));
  assert.ok(m.loeschen1, 'kein ✕ am belegten Slot');
  assert.ok(/Lv 7/.test(m.slot1.text.text), 'Slot-Zeile zeigt den Stand nicht: ' + m.slot1.text.text);
  assert.ok(!m.endlos, 'Endlos-Knopf da');
  assert.ok(m.fortsetzen.platte.y < m.neuesSpiel.platte.y && m.neuesSpiel.platte.y < m.einstellungen.platte.y,
    'Reihenfolge Fortsetzen / Neues Spiel / Einstellungen stimmt nicht');
  for (const [name, kn] of Object.entries(m)) {
    assert.ok(oben(s, kn.platte.x, kn.platte.y) === kn.platte, name + ' ist verdeckt');
  }
  m.fortsetzen.platte.emit('pointerdown');
  assert.ok(await H.waitForScene('HubSceneV2'), 'FORTSETZEN fuehrt nicht in den Hub');
  assert.strictEqual(H.window.playerLevel, 7, 'Spielstand nicht geladen');
});
