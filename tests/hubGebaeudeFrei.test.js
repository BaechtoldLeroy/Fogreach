// tests/hubGebaeudeFrei.test.js â€” nichts steht unter oder in einem Haus.
//
// Bis b352 standen am Rathaus Baeume HINTER dem Gebaeude: das Rathausbild
// ist breiter und viel hoeher als seine 'R'-Zellen, die Baeume wurden auf
// jede Waldzelle ('g') gestreut, auch die direkt neben und ueber dem Rathaus.
// Sie lugten unter dem Sockel hervor. Diese Pruefung rechnet mit den echten
// Bildmassen (aus den PNG-Dateien), genau wie hubNeuWelt die Bilder stellt â€”
// reine Datenpruefung, ohne Szene.
//
// Dazu der Kettenbrunnen (Drachenbrunnen seit b358): er fuellt sein Becken,
// und der Spieler startet nicht darin.

const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const WURZEL = path.join(__dirname, '..');

function laden(datei, fenster) {
  const q = fs.readFileSync(path.join(WURZEL, 'js', 'scenes', 'hub', datei), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'module', q)(fenster, {});
}
const fenster = { console: { warn() {}, log() {} } };
fenster.window = fenster;
laden('hubNeuKarte.js', fenster);
laden('hubNeuWelt.js', fenster);
const K = fenster.HUB_NEU_KARTE;
const W = fenster.HubNeuWelt;

// Bildmasse aller hub_*-Bilder, wie Phaser sie nach dem Laden kennt.
const MASSE = {};
const masse = (key) => MASSE[key] || null;
before(async () => {
  const keys = new Set(['hub_baum', 'hub_kiefer']);
  (K.haeuser || []).concat(K.requisiten || []).forEach((r) => keys.add(r.bild));
  for (const key of keys) {
    if (key.indexOf('hub_') !== 0) continue;
    const datei = path.join(WURZEL, 'assets', 'hub', key.slice(4) + '.png');
    if (!fs.existsSync(datei)) continue;
    const m = await sharp(datei).metadata();
    MASSE[key] = { w: m.width, h: m.height };
  }
});

const schneiden = (a, b) => a.x < b.x + b.b && a.x + a.b > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const fmt = (f) => [f.x, f.y, f.b, f.h].map((v) => v.toFixed(2)).join('/');

test('kein Baum reicht in ein Haus hinein (auch nicht hinter das Rathaus)', () => {
  const haeuser = W.gebaeudeFlaechen(K, masse);
  assert.strictEqual(haeuser.length, K.haeuser.length, 'nicht alle Hausbilder vermessen');
  const baeume = W.baeume(K, masse);
  // Der Wald bleibt ein Wald: die Pruefung darf nicht dadurch gruen werden,
  // dass gar keine Baeume mehr stehen.
  assert.ok(baeume.length > 150, 'nur ' + baeume.length + ' Baeume');
  const falsch = [];
  baeume.forEach((t) => {
    const f = W.bildFlaeche(K, t.bild, t.x, t.y, t.breite, masse);
    haeuser.forEach((h) => { if (schneiden(f, h)) falsch.push(t.bild + ' ' + fmt(f) + ' in ' + h.bild); });
  });
  assert.deepStrictEqual(falsch, [], falsch.length + ' Baeume im Haus:\n' + falsch.join('\n'));
});

test('keine Requisite und kein Vorleser steht mit dem Fuss in einem Haus', () => {
  const haeuser = W.gebaeudeFlaechen(K, masse);
  // Vor der Fassade (Feuerkorb, Banner) ist erlaubt: der Fuss liegt dann auf
  // oder unter der Standlinie des Hauses. Darueber steht er DARIN.
  const falsch = [];
  const fuss = (name, x, y) => haeuser.forEach((h) => {
    if (x > h.x && x < h.x + h.b && y > h.y && y < h.y + h.h - 0.01) falsch.push(name + ' ' + x + '/' + y + ' in ' + h.bild);
  });
  (K.requisiten || []).forEach((r) => fuss(r.bild, r.x, r.y));
  (K.vorleser || []).forEach((v) => fuss(v.bild, v.x, v.y));
  (K.npcs || []).forEach((n) => fuss(n.id, n.x, n.y));
  assert.deepStrictEqual(falsch, [], falsch.join('\n'));
});

test('der Kettenbrunnen ist der Drachenbrunnen, gleich zugeschnitten und belebt', async () => {
  const bilder = [];
  for (let i = 0; i < 8; i++) {
    const datei = path.join(WURZEL, 'assets', 'hub', 'kettenbrunnen' + i + '.png');
    const m = await sharp(datei).metadata();
    bilder.push({ w: m.width, h: m.height, sha: crypto.createHash('sha256').update(fs.readFileSync(datei)).digest('hex') });
  }
  // Gemeinsamer Zuschnitt (tools/hubBauen.js --gemeinsam), sonst zittert er.
  assert.strictEqual(new Set(bilder.map((b) => b.w + 'x' + b.h)).size, 1, 'Bilder verschieden gross');
  assert.strictEqual(new Set(bilder.map((b) => b.sha)).size, 8, 'das Wasser bewegt sich nicht');
  // Fingerabdruck des ersten Bildes: PixelLab-Objekt c49f8225 (Kandidat 1
  // von e95e35c1, Saeule mit Drachenkoepfen), Animation "Wasserspiel Drachen".
  // Bis b352 stand hier der Brunnen mit der gedrehten Saeule (2e7b77c9).
  assert.strictEqual(bilder[0].sha.slice(0, 16), DRACHENBRUNNEN_0,
    'kettenbrunnen0.png ist nicht der Drachenbrunnen');
});

test('der Brunnen fuellt sein Becken, und der Spieler startet davor', () => {
  // Beckenzellen 'B' aus der Karte.
  let x0 = 99, x1 = -1, y0 = 99, y1 = -1;
  K.zeilen.forEach((z, y) => { for (let x = 0; x < z.length; x++) if (z[x] === 'B') {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1);
  } });
  const r = K.requisiten.find((q) => q.anim === 'brunnen');
  const f = W.bildFlaeche(K, r.bild, r.x, r.y, r.breite, masse);
  assert.ok(f.x >= x0 - 0.5 && f.x + f.b <= x1 + 0.5, 'Brunnenbild ' + fmt(f) + ' breiter als das Becken ' + x0 + '..' + x1);
  assert.ok(Math.abs(f.y + f.h - y1) <= 0.5, 'Brunnenfuss ' + (f.y + f.h) + ' nicht an der Beckenkante ' + y1);
  // Spielerkoerper 34x56 Weltpixel, Fuesse am Startpunkt.
  const k = { x: K.start.x - 17 / K.kachel, y: K.start.y - 56 / K.kachel, b: 34 / K.kachel, h: 56 / K.kachel };
  assert.ok(!schneiden(k, { x: x0, y: y0, b: x1 - x0, h: y1 - y0 }), 'der Spieler startet im Becken');
});

// sha256 (erste 16 Zeichen) von assets/hub/kettenbrunnen0.png seit b358.
var DRACHENBRUNNEN_0 = 'cbef044d7c56c541';
