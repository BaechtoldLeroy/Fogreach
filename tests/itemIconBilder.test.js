// tests/itemIconBilder.test.js — die Gegenstands-Icons kommen aus Dateien.
//
// Schwester von tests/itemIcons.test.js. Der prueft die GEZEICHNETEN
// Symbole aus graphics.js (#125: keine zwei Basen teilen sich ein Bild,
// keine zwei Silhouetten sind zu aehnlich). Die sind seit b321 nur noch der
// Rueckfall — gesehen werden die Dateien, und fuer die gilt dasselbe.
//
// 41 Icons zeichnete graphics.js von Hand, dazu drei Weltrequisiten und die
// zwei Bodenabwuerfe. Beim Austausch koennen zwei Dinge schiefgehen:
//
// 1. Ein Name in der Liste OHNE Datei dahinter. Der Tausch ueberspringt ihn
//    dann still, und im Inventar steht weiter die gezeichnete Form — ohne
//    dass irgendwo etwas meldet.
// 2. Ein falsches MASS. Die Icons sitzen in 48er Feldern, die Requisiten
//    haben eigene Groessen (Baum 64x64, Fels 48x32, Pfuetze 20x12). Passt
//    das nicht, springt der Gegenstand im Slot oder deckt den Nachbarn zu.
//
// Geprueft wird am Ende am LAUFENDEN Spiel: traegt die Textur wirklich die
// Masse der Datei? Nur das beweist, dass der Tausch stattgefunden hat.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launchDungeon } = require('../tools/headless/index.js');

const WURZEL = path.join(__dirname, '..');
const ORDNER = path.join(WURZEL, 'assets', 'tiles');

/** Die Namensliste aus pixelTexturen.js lesen — EINE Quelle, kein Abschreiben. */
function namen() {
  const s = fs.readFileSync(path.join(WURZEL, 'js', 'pixelTexturen.js'), 'utf8');
  const m = /var NAMENSGLEICH = \[([\s\S]*?)\]\);/.exec(s);
  assert.ok(m, 'NAMENSGLEICH nicht gefunden — heisst die Liste noch so?');
  return Array.prototype.map.call([...m[1].matchAll(/'([^']+)'/g)], (x) => x[1]);
}

// Was graphics.js fuer diese Schluessel zeichnet; alles Uebrige ist 48x48.
const SONDERMASS = {
  obstacleTree: [64, 64], obstacleRock: [48, 32], prop_puddle: [20, 12],
  healthDrop: [16, 16], xpDrop: [16, 16], projectileTexture: [20, 20]
};

test('zu jedem Namen gibt es eine Datei im richtigen Mass', async () => {
  const liste = namen();
  assert.ok(liste.length >= 46, 'nur ' + liste.length + ' Namen — der Fall misst zu wenig');
  const fehler = [];
  for (const n of liste) {
    const f = path.join(ORDNER, n + '.png');
    if (!fs.existsSync(f)) { fehler.push(n + ': keine Datei'); continue; }
    const m = await sharp(f).metadata();
    const [b, h] = SONDERMASS[n] || [48, 48];
    if (m.width !== b || m.height !== h) {
      fehler.push(n + ': ' + m.width + 'x' + m.height + ' statt ' + b + 'x' + h);
    }
  }
  assert.strictEqual(fehler.length, 0, fehler.join('; '));
});

let H = null;
before(async () => { H = await launchDungeon({ depth: 4 }); });
after(async () => { if (H) await H.shutdown(); });

/**
 * Fingerabdruck eines Bildes: Summe aller Farb- und Alphawerte.
 *
 * Das MASS zu vergleichen reicht nicht — die gezeichneten Icons sind
 * ebenfalls 48x48, der Fall blieb deshalb gruen, als der Tausch testweise
 * ausgebaut wurde. Verglichen wird darum der INHALT.
 */
function abdruck(data) {
  let a = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) {
    a += data[i + 3];
    b += (data[i] + data[i + 1] + data[i + 2]) * (data[i + 3] > 0 ? 1 : 0);
  }
  return a + ':' + b;
}

test('im laufenden Spiel zeigt jedes Icon den INHALT seiner Datei', async () => {
  const liste = namen();
  const imSpiel = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var out = {};
    ${JSON.stringify(liste)}.forEach(function (n) {
      if (!sc.textures.exists(n)) { out[n] = 'fehlt'; return; }
      var q = sc.textures.get(n).getSourceImage();
      if (!q) { out[n] = 'ohne Bild'; return; }
      var c = document.createElement('canvas');
      c.width = q.width; c.height = q.height;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(q, 0, 0);
      var d = ctx.getImageData(0, 0, q.width, q.height).data;
      var a = 0, b = 0;
      for (var i = 0; i < d.length; i += 4) {
        a += d[i + 3];
        b += (d[i] + d[i + 1] + d[i + 2]) * (d[i + 3] > 0 ? 1 : 0);
      }
      out[n] = q.width + 'x' + q.height + '|' + a + ':' + b;
    });
    return out;
  })()`);

  const falsch = [];
  for (const n of liste) {
    const f = path.join(ORDNER, n + '.png');
    const { data, info } = await sharp(f).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    const soll = info.width + 'x' + info.height + '|' + abdruck(data);
    if (imSpiel[n] !== soll) falsch.push(n + ': ' + imSpiel[n] + ' statt ' + soll);
  }
  assert.strictEqual(falsch.length, 0,
    falsch.length + ' von ' + liste.length + ' Texturen zeigen nicht ihre Datei: '
    + falsch.slice(0, 5).join('; '));
});

test('das Inventar findet zu jedem Ausruestungstyp ein Icon', () => {
  // resolveItemIconKey faellt ueber FALLBACK_ITEM_ICONS auf itWeapon, itHead
  // und so weiter zurueck. Fehlte einer davon, truege der Gegenstand gar
  // nichts — der Grund, warum diese sechs in der Liste stehen muessen.
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var noetig = ['itWeapon', 'itHead', 'itBody', 'itBoots', 'itAmulet', 'itConsumable', 'itMat'];
    return noetig.filter(function (k) { return !sc.textures.exists(k); });
  })()`);
  assert.strictEqual(r.length, 0, 'es fehlen: ' + Array.prototype.join.call(r, ', '));
});

/** Silhouette eines Bildes als 12x12-Raster aus Deckungsgraden. */
async function silhouette(datei) {
  const { data, info } = await sharp(datei).ensureAlpha()
    .resize({ width: 12, height: 12, fit: 'fill' }).raw()
    .toBuffer({ resolveWithObject: true });
  const out = [];
  for (let i = 0; i < info.width * info.height; i++) out.push(data[i * 4 + 3] / 255);
  return out;
}

/** Mittlerer Abstand zweier Silhouetten, 0 = gleich. */
function abstand(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

test('keine zwei Ausruestungsbilder sind zu aehnlich', async () => {
  // Dieselbe Sorge wie in tests/itemIcons.test.js, nur an den Dateien:
  // vierzehn Amulette, die im Raster gleich aussehen, machen das Bild
  // nutzlos — es bliebe der Name.
  //
  // BEWUSSTE PAARE bleiben draussen: die vier Traenke sind eine Familie
  // (vier Stufen desselben Gegenstands), und itConsumable ist der allgemeine
  // Rueckfall fuer Verbrauchbares und teilt sich das Bild des normalen
  // Tranks — dafuer wurde kein eigenes erzeugt.
  const FAMILIE = [
    ['itPotionMinor', 'itPotionNormal', 'itPotionMajor', 'itPotionSuper', 'itConsumable']
  ];
  const gleicheFamilie = (a, b) =>
    FAMILIE.some((f) => f.indexOf(a) >= 0 && f.indexOf(b) >= 0);

  const liste = namen().filter((n) => n.startsWith('it'));
  const sil = {};
  for (const n of liste) sil[n] = await silhouette(path.join(ORDNER, n + '.png'));

  // 0.01 ist der Massstab, den tests/itemIcons.test.js schon fuer die
  // gezeichneten Symbole setzt. Ein eigener, strengerer Wert hier waere
  // willkuerlich: die beiden Faelle messen dasselbe, nur an verschiedenen
  // Quellen. (Gemessen: die gezeichneten Boegen lagen untereinander bei
  // 0.0386 bis 0.0853, die Dateien bei 0.0319 bis 0.0567 — beide Saetze
  // also deutlich ueber der Schwelle, die Dateien etwas enger.)
  const SCHWELLE = 0.01;
  const zuNah = [];
  for (let i = 0; i < liste.length; i++) {
    for (let j = i + 1; j < liste.length; j++) {
      if (gleicheFamilie(liste[i], liste[j])) continue;
      const d = abstand(sil[liste[i]], sil[liste[j]]);
      if (d < SCHWELLE) zuNah.push(liste[i] + ' / ' + liste[j] + ' (' + d.toFixed(4) + ')');
    }
  }
  assert.strictEqual(zuNah.length, 0,
    zuNah.length + ' Paare sind im Umriss nicht zu unterscheiden: ' + zuNah.slice(0, 6).join('; '));
});
