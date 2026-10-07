// tests/treppenBilder.test.js — die sechzehn Treppen.
//
// Zwei Dinge, die beide schon falsch waren:
//
// 1. DER BOGEN WAR DURCHSICHTIG. Die Entwuerfe sind Torboegen mit Stufen, und
//    der Raum hinter dem Bogen kam ohne Fuellung zurueck — bei dreizehn von
//    sechzehn. Die Treppe liegt im Spiel AUF dem Boden, also schien der
//    Steinboden durch den Abgang, und aus der Treppe wurde ein aufgemalter
//    Rahmen. tools/treppenBauen.js schwaerzt die eingeschlossenen Loecher.
//
// 2. DIE GROESSE HING AN EINER FESTEN ZAHL. setDisplaySize(80, 80) war auf
//    die alte quadratische Zeichnung geeicht; die neuen Treppen sind hochkant
//    (etwa 48x61) und waeren in die Breite gequetscht worden — dieselbe Falle
//    wie bei Spieler und Tieren in b313.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launchDungeon } = require('../tools/headless/index.js');

const ORDNER = path.join(__dirname, '..', 'assets', 'tiles');
const ALPHA = 16;

/**
 * Zaehlt durchsichtige Punkte, die von opaken EINGESCHLOSSEN sind.
 *
 * Von den Bildraendern her wird die Durchsichtigkeit geflutet; was dabei
 * erreicht wird, ist das Aussen und darf durchsichtig bleiben. Alles andere
 * ist ein Loch, durch das der Boden scheinen wuerde.
 */
async function eingeschlosseneLoecher(datei) {
  const { data, info } = await sharp(datei).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = info.width, h = info.height;
  const aussen = new Uint8Array(b * h);
  const stapel = [];
  const anstossen = (x, y) => {
    if (x < 0 || y < 0 || x >= b || y >= h) return;
    const i = y * b + x;
    if (aussen[i] || data[i * 4 + 3] > ALPHA) return;
    aussen[i] = 1;
    stapel.push(i);
  };
  for (let x = 0; x < b; x++) { anstossen(x, 0); anstossen(x, h - 1); }
  for (let y = 0; y < h; y++) { anstossen(0, y); anstossen(b - 1, y); }
  while (stapel.length) {
    const i = stapel.pop();
    const x = i % b;
    const y = (i - x) / b;
    anstossen(x + 1, y); anstossen(x - 1, y);
    anstossen(x, y + 1); anstossen(x, y - 1);
  }
  let n = 0;
  for (let i = 0; i < b * h; i++) if (!aussen[i] && data[i * 4 + 3] <= ALPHA) n++;
  return { loecher: n, b, h };
}

test('kein Treppenbild hat ein durchsichtiges Loch', async () => {
  const dateien = fs.readdirSync(ORDNER).filter((f) => /^stairDown\d*\.png$/.test(f));
  assert.ok(dateien.length >= 16,
    'nur ' + dateien.length + ' Treppenbilder gefunden — der Fall misst zu wenig');
  const durchsichtig = [];
  for (const f of dateien) {
    const m = await eingeschlosseneLoecher(path.join(ORDNER, f));
    if (m.loecher > 0) durchsichtig.push(f + ' (' + m.loecher + ' Punkte)');
  }
  assert.strictEqual(durchsichtig.length, 0,
    durchsichtig.length + ' Treppen lassen den Boden durchscheinen: ' + durchsichtig.join(', '));
});

let H = null;
before(async () => { H = await launchDungeon({ depth: 5 }); });
after(async () => { if (H) await H.shutdown(); });

test('der Raum nimmt eine der sechzehn und laesst sie nicht quadratisch werden', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var geladen = 0;
    for (var i = 0; i < 16; i++) if (sc.textures.exists('stairDown' + i)) geladen++;
    var t = sc.stairsGroup ? sc.stairsGroup.getChildren() : [];
    return { geladen: geladen, treppen: t.map(function (s) {
      var q = s.texture.getSourceImage();
      return { bild: s.texture.key, b: s.displayWidth, h: s.displayHeight,
        qb: q ? q.width : 0, qh: q ? q.height : 0 };
    }) };
  })()`);
  assert.strictEqual(r.geladen, 16, 'nur ' + r.geladen + ' von 16 Treppenbildern geladen');
  assert.ok(r.treppen.length > 0, 'der Raum hat gar keine Treppe');
  r.treppen.forEach((s) => {
    assert.match(s.bild, /^stairDown\d+$/, 'die Treppe traegt noch ' + s.bild);
    // Das Verhaeltnis muss das des Bildes sein, nicht 1:1.
    const sollB = s.h * (s.qb / s.qh);
    assert.ok(Math.abs(s.b - sollB) <= 1.5,
      s.bild + ' wird ' + Math.round(s.b) + ' breit angezeigt statt ' + Math.round(sollB)
      + ' (Bild ' + s.qb + 'x' + s.qh + ')');
  });
});

test('ueber viele Raeume kommen verschiedene Treppen', () => {
  // Nicht die Bilder im EINEN Raum zaehlen: ein Raum hat manchmal nur eine
  // Treppe, und dann sagt der Fall nichts.
  const gesehen = new Set();
  for (let i = 0; i < 40 && gesehen.size < 4; i++) {
    gesehen.add(H.run("window.treppenBild(window.game.scene.getScene('GameScene'), 80).bild"));
  }
  assert.ok(gesehen.size >= 4,
    'vierzig Wuerfe ergaben nur ' + gesehen.size + ' verschiedene Treppen: '
    + [...gesehen].join(', '));
});
