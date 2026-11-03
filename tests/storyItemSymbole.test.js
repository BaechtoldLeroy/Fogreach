// tests/storyItemSymbole.test.js — Story- und Quest-Gegenstaende tragen eigene Bilder.
//
// Vorher lagen alle Quest-Funde (Helmmarke, Ratssiegel, Phiolensplitter,
// Brunos Halsband, Eichgewicht, Druckplatte) als eingefaerbter Erzbrocken
// (itMat + setTint) da, das Ritualamulett trug die Schlangenmaske, Elaras
// Klinge das Standard-Schwert. Geprueft (headless, Canvas):
//
//  - jedes Bild aus window.STORY_SYMBOLE: 48er-Datei ohne Text-Metadaten,
//    in der Tauschliste, im Dungeon UND im Hub mit dem INHALT der Datei;
//  - jeder Quest-Fund aus loot.js hat ein eigenes Bild (Schriftstueck,
//    Zeichen oder Story-Symbol) — keiner faellt mehr aufs eingefaerbte Erz;
//  - am Boden: eigenes Bild, nicht eingefaerbt, quadratisch;
//  - Lohnstuecke: neue tragen das Story-Symbol, ALTE Spielstaende (iconKey
//    'itSword' / 'itHeadSchlangenmaske') zeigen es im Inventar trotzdem;
//  - fehlt das Bild, bleibt das eingefaerbte Erz (Rueckfall).

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launch, launchDungeon } = require('../tools/headless/index.js');

const WURZEL = path.join(__dirname, '..');

// Fest hier, nicht aus dem Spiel gelesen: sonst wanderte die Zusicherung mit
// einer falschen Zuordnung mit.
const SOLL = {
  HELMMARKE: 'itStoryHelmmarke',
  VERIFICATION_SEAL: 'itStoryRatssiegel',
  MEMORY_SHARD: 'itStoryPhiolensplitter',
  HUNDEHALSBAND: 'itStoryHalsband',
  EICHGEWICHT: 'itStoryEichgewicht',
  QUEST_PLATE: 'itStoryDruckplatte',
  RITUAL_AMULETT: 'itStoryRitualamulett',
  ELARAS_KLINGE: 'itStoryElarasKlinge'
};
// Quest-Funde: Item-Schluessel -> fetch-Ziel.
const FUNDE = {
  HELMMARKE: 'helmmarke',
  VERIFICATION_SEAL: 'verification_seal',
  MEMORY_SHARD: 'memory_shard',
  HUNDEHALSBAND: 'hundehalsband',
  EICHGEWICHT: 'eichgewicht',
  QUEST_PLATE: 'print_plate'
};
// Diese Quest-Funde tragen ihr Bild auf anderem Weg: Schriftstuecke
// (js/schriftstuecke.js) und das Buendel mit dem Zeichen (#156).
const ANDERS_BEBILDERT = ['QUEST_DOC', 'JOURNAL_FRAGMENT', 'SEIZED_WRITINGS',
  'INTERROGATION_RECORD', 'COUNCIL_DOCUMENT', 'SEALED_BUNDLE'];

function datei(k) { return path.join(WURZEL, 'assets', 'tiles', k + '.png'); }

async function sollAbdruck(k) {
  const { data, info } = await sharp(datei(k)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let a = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) {
    a += data[i + 3];
    b += (data[i] + data[i + 1] + data[i + 2]) * (data[i + 3] > 0 ? 1 : 0);
  }
  return info.width + 'x' + info.height + '|' + a + ':' + b;
}

const ABDRUCK_JS = `function (tm, n) {
  if (!tm.exists(n)) return 'fehlt';
  var q = tm.get(n).getSourceImage();
  var c = document.createElement('canvas'); c.width = q.width; c.height = q.height;
  var ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(q, 0, 0);
  var d = ctx.getImageData(0, 0, q.width, q.height).data, a = 0, b = 0;
  for (var i = 0; i < d.length; i += 4) { a += d[i + 3]; b += (d[i] + d[i + 1] + d[i + 2]) * (d[i + 3] > 0 ? 1 : 0); }
  return q.width + 'x' + q.height + '|' + a + ':' + b;
}`;

async function abdrueckeStimmen(H) {
  const ist = JSON.parse(H.run(`(function () {
    var ab = ${ABDRUCK_JS}, out = {};
    ${JSON.stringify(Object.values(SOLL))}.forEach(function (n) { out[n] = ab(window.game.textures, n); });
    return JSON.stringify(out);
  })()`));
  const falsch = [];
  for (const k of Object.values(SOLL)) {
    const soll = await sollAbdruck(k);
    if (ist[k] !== soll) falsch.push(k + ': ' + ist[k] + ' statt ' + soll);
  }
  assert.strictEqual(falsch.length, 0, falsch.join('; '));
}

test('Dateien: 48x48, ohne Text-Metadaten, in der Tauschliste', async () => {
  const s = fs.readFileSync(path.join(WURZEL, 'js', 'pixelTexturen.js'), 'utf8');
  const m = /var NAMENSGLEICH = \[([\s\S]*?)\]\);/.exec(s);
  const liste = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  for (const k of Object.values(SOLL)) {
    assert.ok(liste.indexOf(k) >= 0, k + ' nicht in NAMENSGLEICH');
    const meta = await sharp(datei(k)).metadata();
    assert.strictEqual(meta.width + 'x' + meta.height, '48x48', k);
    const b = fs.readFileSync(datei(k));
    let o = 8;
    while (o < b.length) {
      const len = b.readUInt32BE(o), typ = b.toString('latin1', o + 4, o + 8);
      assert.ok(!/^(tEXt|iTXt|zTXt|eXIf)$/.test(typ), k + ' traegt Metadaten: ' + typ);
      o += 12 + len;
      if (typ === 'IEND') break;
    }
  }
});

test('jeder Quest-Fund aus loot.js hat ein eigenes Bild', () => {
  const s = fs.readFileSync(path.join(WURZEL, 'js', 'loot.js'), 'utf8');
  const schluessel = [...s.matchAll(/\{ target: '\w+',[^\n]*?key: '(\w+)'/g)].map((x) => x[1]);
  assert.ok(schluessel.length >= 12, 'nur ' + schluessel.length + ' Quest-Funde gefunden — Muster veraltet?');
  const ohne = schluessel.filter((k) => !SOLL[k] && ANDERS_BEBILDERT.indexOf(k) < 0);
  assert.deepStrictEqual(ohne, [], 'ohne eigenes Bild (faellt aufs Erz): ' + ohne.join(', '));
});

describe('im Dungeon', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 10 });
    H.run('window._playerInvincible = true');
    H.run('(window.enemies && enemies.getChildren ? enemies.getChildren().slice() : []).forEach(function (e) { e.destroy(); })');
  });
  after(async () => { if (H) await H.shutdown(); });

  test('jede Story-Textur zeigt den INHALT ihrer Datei', async () => {
    await abdrueckeStimmen(H);
  });

  /** Nur die Quest mit diesem Ziel aktiv, dann einen Fund gezielt legen. */
  function legeFund(ziel) {
    return JSON.parse(H.run(`(function () {
      var QS = window.questSystem, D = QS.QUEST_DEFINITIONS, d = QS.getQuestSaveData(), id = null;
      Object.keys(d.quests).forEach(function (k) { if (d.quests[k].status === 'active') d.quests[k].status = 'available'; });
      Object.keys(D).forEach(function (k) {
        (D[k].objectives || []).forEach(function (o) { if (o.type === 'fetch' && o.target === '${ziel}') id = k; });
      });
      if (!id) return JSON.stringify({ fehler: 'keine Quest fuer ${ziel}' });
      d.quests[id] = { status: 'active', objectives: D[id].objectives.map(function (o) {
        return { type: o.type, target: o.target, current: 0, required: 99 };
      }) };
      QS.loadQuestSaveData(d);
      if (QS.tiefeErreicht) QS.tiefeErreicht = (function () { return true; });
      var sc = window.game.scene.getScene('GameScene');
      var vorher = lootGroup.getChildren().slice();
      var r = Math.random; Math.random = function () { return 0; };
      // Elite als Quelle: die Helmmarke faellt nur von Elite-Gegnern.
      try { spawnLoot.call(sc, player.x + 150, player.y, null, { isElite: true, x: player.x + 150, y: player.y }); } finally { Math.random = r; }
      var neu = lootGroup.getChildren().filter(function (o) { return vorher.indexOf(o) < 0 && o.getData('questItem'); })[0];
      if (!neu) return JSON.stringify({ fehler: 'kein Fund fuer ${ziel}' });
      var it = neu.getData('item');
      var out = { key: neu.texture.key, item: it.key, iconKey: it.iconKey, tint: neu.isTinted,
        w: neu.displayWidth, h: neu.displayHeight };
      neu.destroy();
      return JSON.stringify(out);
    })()`));
  }

  for (const [key, ziel] of Object.entries(FUNDE)) {
    test('am Boden: ' + key + ' mit eigenem Bild, nicht eingefaerbt', () => {
      const r = legeFund(ziel);
      assert.ok(!r.fehler, r.fehler);
      assert.strictEqual(r.item, key);
      assert.strictEqual(r.key, SOLL[key], 'falsches Bild am Boden');
      assert.strictEqual(r.iconKey, SOLL[key], 'iconKey des Funds');
      assert.strictEqual(r.tint, false, 'noch eingefaerbt');
      assert.ok(r.w >= 26 && Math.abs(r.w - r.h) < 1e-6, 'verzerrt: ' + r.w + 'x' + r.h);
    });
  }

  test('Rueckfall: ohne Bild bleibt das eingefaerbte Erz', () => {
    H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      window.__weg = sc.textures.get('itStoryEichgewicht').getSourceImage();
      sc.textures.remove('itStoryEichgewicht');
    })()`);
    try {
      const r = legeFund('eichgewicht');
      assert.ok(!r.fehler, r.fehler);
      assert.strictEqual(r.key, 'itMat');
      assert.strictEqual(r.tint, true, 'Erz ohne Farbe');
    } finally {
      H.run(`window.game.scene.getScene('GameScene').textures.addImage('itStoryEichgewicht', window.__weg)`);
    }
  });
});

describe('im Hub', () => {
  let H = null;
  before(async () => {
    H = await launch({ renderer: 'canvas', search: '?autostart=1' });
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 600 }), 'Hub nicht erreicht');
    H.step(20);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('schon vor dem ersten Abstieg zeigen die Story-Bilder ihre Datei', async () => {
    await abdrueckeStimmen(H);
  });

  test('Lohnstuecke: die Quest verteilt das Story-Symbol', () => {
    const r = JSON.parse(H.run(`(function () {
      var D = window.questSystem.QUEST_DEFINITIONS, out = {};
      Object.keys(D).forEach(function (id) {
        ((D[id].rewards && D[id].rewards.items) || []).forEach(function (s) { if (s.key) out[s.key] = s.iconKey || null; });
      });
      return JSON.stringify(out);
    })()`));
    assert.strictEqual(r.RITUAL_AMULETT, SOLL.RITUAL_AMULETT);
    assert.strictEqual(r.ELARAS_KLINGE, SOLL.ELARAS_KLINGE);
  });

  test('alte Spielstaende: Klinge und Amulett zeigen im Inventar ihr Story-Bild', () => {
    const r = JSON.parse(H.run(`(function () {
      var LS = window.LootSystem, out = [];
      // So, wie sie vor dieser Aenderung gespeichert wurden.
      var klinge = LS.rollItem('WPN_EISENKLINGE', 5, 3, null, { ohneDeckel: true });
      klinge.key = 'ELARAS_KLINGE'; klinge.iconKey = 'itSword';
      var amulett = LS.rollItem('HD_SCHLANGENMASKE', 5, 2, null, { ohneDeckel: true });
      amulett.key = 'RITUAL_AMULETT'; amulett.iconKey = 'itHeadSchlangenmaske';
      var zweite = LS.rollItem('WPN_EISENKLINGE', 5, 3, null, { ohneDeckel: true });
      zweite.key = 'ELARAS_KLINGE'; zweite.iconKey = 'itSword';
      window.InventoryGrid.einlagern(klinge);
      window.InventoryGrid.einlagern(amulett);
      equipment.weapon = zweite;
      openInventory();
      refreshInventoryUI();
      inventory.forEach(function (it, i) {
        if (it !== klinge && it !== amulett) return;
        var s = invUI.slots[i];
        out.push({ wo: it.key, key: s.icon.texture.key, sx: s.icon.scaleX, sy: s.icon.scaleY });
      });
      var e = invUI.equip.weapon.icon;
      out.push({ wo: 'waffenplatz', key: e.texture.key, sx: e.scaleX, sy: e.scaleY });
      closeInventory();
      return JSON.stringify(out);
    })()`));
    const soll = { ELARAS_KLINGE: SOLL.ELARAS_KLINGE, RITUAL_AMULETT: SOLL.RITUAL_AMULETT, waffenplatz: SOLL.ELARAS_KLINGE };
    assert.strictEqual(r.length, 3, 'nicht alle gefunden: ' + JSON.stringify(r));
    r.forEach((s) => {
      assert.strictEqual(s.key, soll[s.wo], s.wo + ': falsches Bild');
      assert.ok(Math.abs(s.sx - s.sy) < 1e-6, s.wo + ' verzerrt');
    });
  });
});
