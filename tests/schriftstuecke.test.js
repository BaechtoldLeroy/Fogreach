// tests/schriftstuecke.test.js — eigene Bilder und Aufsammel-Toast fuer Schriftstuecke.
//
// Gemeldet: "Schriftstuecke brauchen noch eine neue Grafik und auch der Toast
// beim Aufsammeln." Vorher lag das Wissensfragment als gezeichnete Rolle
// (proc_scroll) im gelben Kreis, die Quest-Schriften als eingefaerbter
// Erzbrocken (itMat) — und beim Aufheben einer Quest-Schrift kam gar kein
// Toast. Geprueft am laufenden Spiel (headless, Canvas):
//
//  - jede Art zeigt den INHALT ihrer Datei (Fingerabdruck wie
//    tests/itemIconBilder.test.js), mit warmem Schein darunter;
//  - Aufheben zeigt den Schriftstueck-Toast (Symbol, Titel, Hinweis) und
//    loest weiter dasselbe aus (Fragment zaehlt, XP, Quest-Fortschritt);
//  - der Lese-Dialog des Fragments steht auf der Messing-Platte, der Text
//    dunkel auf Pergament;
//  - Kontrast >= 4,5:1;
//  - fehlen die Bilder, bleibt die alte Darstellung.
//
// Zeit nur per H.step; Funde werden gezielt gesetzt (Math.random fuer den
// einen Wurf festgehalten), nicht dem Zufallsraum ueberlassen.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launch, launchDungeon } = require('../tools/headless/index.js');
const { kontraste, alleLesbar } = require('./kontrastMessung');

const WURZEL = path.join(__dirname, '..');
const DATEIEN = {
  schrift_fragment: 'assets/tiles/schrift_fragment.png',
  schrift_rolle: 'assets/tiles/schrift_rolle.png',
  schrift_blatt: 'assets/tiles/schrift_blatt.png',
  schrift_brief: 'assets/tiles/schrift_brief.png',
  schrift_seite: 'assets/tiles/schrift_seite.png',
  schrift_stapel: 'assets/tiles/schrift_stapel.png',
  ui_symbol_schrift: 'assets/ui/ui_symbol_schrift.png'
};
// Questziel -> erwartetes Bild. Fest hier, nicht aus dem Spiel gelesen: sonst
// wanderte die Zusicherung mit einer falschen Zuordnung mit.
const ZIELE = {
  document: 'schrift_blatt',
  council_document: 'schrift_rolle',
  journal_fragment: 'schrift_seite',
  seized_writings: 'schrift_stapel',
  interrogation_record: 'schrift_brief'
};

/** Nur mit VORSCHAU=1: ein Bild des Spiels nach vorschau/ (Vorher/Nachher-Abgleich). */
function vorschau(H, datei) {
  if (!process.env.VORSCHAU) return;
  H.step(1); // die Kontrastmessung blendet die Texte kurz aus; frisch zeichnen
  fs.mkdirSync(path.join(WURZEL, 'vorschau'), { recursive: true });
  fs.writeFileSync(path.join(WURZEL, 'vorschau', datei), H.window.game.canvas.toBuffer('image/png'));
}

function abdruck(data) {
  let a = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) {
    a += data[i + 3];
    b += (data[i] + data[i + 1] + data[i + 2]) * (data[i + 3] > 0 ? 1 : 0);
  }
  return a + ':' + b;
}

// Im Spiel: Fingerabdruck einer Textur (gleiche Rechnung wie abdruck()).
const ABDRUCK_JS = `function (sc, n) {
  if (!sc.textures.exists(n)) return 'fehlt';
  var q = sc.textures.get(n).getSourceImage();
  var c = document.createElement('canvas'); c.width = q.width; c.height = q.height;
  var ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(q, 0, 0);
  var d = ctx.getImageData(0, 0, q.width, q.height).data, a = 0, b = 0;
  for (var i = 0; i < d.length; i += 4) { a += d[i + 3]; b += (d[i] + d[i + 1] + d[i + 2]) * (d[i + 3] > 0 ? 1 : 0); }
  return q.width + 'x' + q.height + '|' + a + ':' + b;
}`;

/** Nur diese eine Quest aktiv, mit hohem Soll (kein "Ziel erfuellt"-Toast dazwischen). */
function aktiviere(H, ziel, soll) {
  return H.run(`(function () {
    var QS = window.questSystem, D = QS.QUEST_DEFINITIONS, d = QS.getQuestSaveData(), id = null;
    Object.keys(d.quests).forEach(function (k) { if (d.quests[k].status === 'active') d.quests[k].status = 'available'; });
    Object.keys(D).forEach(function (k) {
      (D[k].objectives || []).forEach(function (o) { if (o.type === 'fetch' && o.target === '${ziel}') id = k; });
    });
    d.quests[id] = { status: 'active', objectives: D[id].objectives.map(function (o) {
      return { type: o.type, target: o.target, current: 0, required: ${soll} };
    }) };
    QS.loadQuestSaveData(d);
    return id;
  })()`);
}

/** Einen Quest-Fund gezielt neben den Spieler legen (der 10-%-Wurf festgehalten). */
function legeQuestFund(H) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var vorher = lootGroup.getChildren().slice();
    var r = Math.random; Math.random = function () { return 0; };
    try { spawnLoot.call(sc, player.x + 150, player.y, null, null); } finally { Math.random = r; }
    var neu = lootGroup.getChildren().filter(function (o) { return vorher.indexOf(o) < 0 && o.getData('questItem'); })[0];
    if (!neu) return null;
    window.__fund = neu; window.__fundItem = neu.getData('item');
    var schein = neu.getData('schriftSchein');
    return { key: neu.texture.key, w: neu.displayWidth, h: neu.displayHeight, tint: neu.isTinted,
      schein: schein ? schein.texture.key : null, scheinDa: !!(schein && schein.scene) };
  })()`);
}

/** Den gelegten Fund unter den Spieler schieben und die Ueberlappung laufen lassen. */
function aufheben(H) {
  H.run(`(function () { var f = window.__fund; f.body.reset(player.x, player.y); f.setPosition(player.x, player.y); })()`);
  H.step(3);
}

function toastStand(H) {
  return H.run(`(function () {
    var a = window.game.scene.getScene('GameScene')._activeEventToast;
    if (!a) return null;
    return { art: a.art, text: a.label.text, unter: a.unter ? a.unter.text : null };
  })()`);
}

test('Dateien: jede Art hat ihr Bild, 48x48', async () => {
  for (const [k, f] of Object.entries(DATEIEN)) {
    const m = await sharp(path.join(WURZEL, f)).metadata();
    assert.strictEqual(m.width + 'x' + m.height, '48x48', k);
  }
});

describe('im Dungeon', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 4 });
    H.run('window._playerInvincible = true');
    // Kein Gegner soll dazwischenfunken.
    H.run('(window.enemies && enemies.getChildren ? enemies.getChildren().slice() : []).forEach(function (e) { e.destroy(); })');
  });
  after(async () => { if (H) await H.shutdown(); });

  test('jede Textur zeigt den INHALT ihrer Datei', async () => {
    const imSpiel = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene'), f = ${ABDRUCK_JS}, out = {};
      ${JSON.stringify(Object.keys(DATEIEN))}.forEach(function (n) { out[n] = f(sc, n); });
      return out;
    })()`);
    for (const [k, f] of Object.entries(DATEIEN)) {
      const { data, info } = await sharp(path.join(WURZEL, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.strictEqual(imSpiel[k], info.width + 'x' + info.height + '|' + abdruck(data), k);
    }
  });

  test('Wissensfragment: eigenes Bild mit Schein, Aufheben zaehlt, Messing-Dialog, dann der Toast', () => {
    const vor = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      window.EventSystem.EVENT_TYPES.filter(function (e) { return e.id === 'lore_fragment'; })[0].handler(sc);
      var r = sc.children.getByName('wissensfragment');
      var schein = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'schrift_schein'; })[0];
      window.__rolle = r;
      return { key: r && r.texture.key, w: r && r.displayWidth,
        schein: !!schein, scheinNah: schein ? Math.hypot(schein.x - r.x, schein.y - r.y) : -1,
        frag: window.KnowledgeTree.getFragments(), xp: playerXP + playerLevel * 1e6 };
    })()`);
    assert.strictEqual(vor.key, 'schrift_fragment');
    assert.ok(vor.w >= 30 && vor.w <= 40, 'Groesse ' + vor.w);
    assert.ok(vor.schein && vor.scheinNah < 1, 'kein warmer Schein unter der Rolle');

    H.run(`(function () { var r = window.__rolle; r.body.reset(player.x, player.y); })()`);
    // Ein Stufenaufstieg durch die XP blitzt die Kamera kurz gold; ausklingen lassen.
    H.step(30);
    const d = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene'), ld = sc._loreDialog;
      if (!ld) return null;
      var texte = ld.teile.filter(function (o) { return o.type === 'Text'; }).map(function (o) { return o.text; });
      var blatt = ld.teile.filter(function (o) { return o.type === 'Rectangle'; })[0];
      return { messing: ld.messing, platte: ld.teile.filter(function (o) { return o.texture && o.texture.key === 'ui_rahmen'; }).length,
        bild: ld.teile.some(function (o) { return o.texture && o.texture.key === 'schrift_fragment'; }),
        blatt: blatt ? blatt.fillColor : null, texte: texte,
        frag: window.KnowledgeTree.getFragments(), xp: playerXP + playerLevel * 1e6,
        rolleWeg: !window.__rolle.scene };
    })()`);
    assert.ok(d, 'kein Lese-Dialog');
    assert.strictEqual(d.messing, true);
    assert.strictEqual(d.platte, 9, 'keine Messing-Platte');
    assert.ok(d.bild, 'das Fragment-Bild fehlt im Dialog');
    assert.strictEqual(d.blatt, 0xe8d6ab, 'kein Pergament unter dem Text');
    assert.ok(d.rolleWeg, 'Rolle liegt noch');
    assert.strictEqual(d.frag, vor.frag + 1, 'Fragment nicht gezaehlt');
    assert.ok(d.xp > vor.xp, 'keine XP');
    assert.ok(d.texte.some((t) => /\+\d+ XP/.test(t)), 'XP-Zeile fehlt');

    // Kontrast im Dialog (auch der Text auf dem Pergament).
    const k = kontraste(H, `window.game.scene.getScene('GameScene')._loreDialog.teile.filter(function (o) { return o.type === 'Text'; })`);
    vorschau(H, 'nachher_dialog.png');

    // Schliessen -> der Toast kommt. (Vor der Kontrast-Zusicherung, damit ein
    // Fehlschlag nicht das pausierte Spiel an die naechsten Faelle weitergibt.)
    H.run(`(function () { var sc = window.game.scene.getScene('GameScene');
      sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2500; }).forEach(function (r) { r.emit('pointerdown'); }); })()`);
    H.step(40);
    alleLesbar(k, 'Lese-Dialog');
    const t = toastStand(H);
    assert.ok(t, 'kein Toast nach dem Lesen');
    assert.strictEqual(t.art, 'ui_symbol_schrift');
    assert.ok(t.text && !/MISSING/.test(t.text) && t.text.length > 3, 'Titel: ' + t.text);
    assert.ok(/Branka/.test(t.unter) && /Wissensbaum/.test(t.unter), 'Hinweis: ' + t.unter);
  });

  for (const [ziel, bild] of Object.entries(ZIELE)) {
    test('Quest-Schrift ' + ziel + ': ' + bild + ' mit Schein, Toast mit Auftrag, Fortschritt zaehlt', () => {
      const id = aktiviere(H, ziel, 5);
      assert.ok(id, 'keine Quest fuer ' + ziel);
      const f = legeQuestFund(H);
      assert.ok(f, 'kein Fund gelegt');
      assert.strictEqual(f.key, bild);
      assert.strictEqual(f.tint, false, 'noch eingefaerbt');
      assert.strictEqual(f.schein, 'schrift_schein');
      aufheben(H);
      const s = H.run(`(function () {
        var q = window.questSystem.getActiveQuests().filter(function (q) { return q.id === '${id}'; })[0];
        return { stand: q.objectives.filter(function (o) { return o.target === '${ziel}'; })[0].current,
          fundWeg: !window.__fund.scene };
      })()`);
      assert.strictEqual(s.stand, 1, 'Quest-Fortschritt fehlt');
      assert.ok(s.fundWeg, 'Fund liegt noch');
      const schein = H.run(`window.game.scene.getScene('GameScene').children.list.filter(function (o) { return o.texture && o.texture.key === 'schrift_schein'; }).length`);
      assert.strictEqual(schein, 0, 'der Schein bleibt nach dem Aufheben liegen');
      const t = toastStand(H);
      assert.ok(t, 'kein Toast beim Aufheben');
      assert.strictEqual(t.art, 'ui_symbol_schrift');
      const name = H.run(`window.i18n.t('loot.quest_item.' + window.__fundItem.key)`);
      assert.strictEqual(t.text, name);
      const titel = H.run(`window.questSystem.getQuestField(window.questSystem.QUEST_DEFINITIONS['${id}'], 'title')`);
      assert.ok(t.unter.indexOf(titel) >= 0 && /Journal/.test(t.unter), 'Hinweis: ' + t.unter);
    });
  }

  test('das fest platzierte Ratsdokument (Elaras Keller) traegt ebenfalls sein Bild', () => {
    const r = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene'), vorher = lootGroup.getChildren().slice();
      _spawnCouncilDocument(sc);
      var neu = lootGroup.getChildren().filter(function (o) { return vorher.indexOf(o) < 0; })[0];
      var s = neu.getData('schriftSchein');
      var out = { key: neu.texture.key, schein: !!(s && s.scene) };
      neu.destroy();
      return out;
    })()`);
    assert.strictEqual(r.key, 'schrift_rolle');
    assert.ok(r.schein, 'kein Schein');
  });

  test('erfuellt der Fund das Ziel, uebernimmt der Quest-Toast', () => {
    aktiviere(H, 'journal_fragment', 1);
    legeQuestFund(H);
    aufheben(H);
    assert.strictEqual(toastStand(H).art, 'ui_symbol_quest');
  });

  test('Nicht-Geschriebenes bleibt, wie es war (Ratssiegel)', () => {
    aktiviere(H, 'verification_seal', 5);
    const f = legeQuestFund(H);
    assert.strictEqual(f.key, 'itMat');
    assert.strictEqual(f.tint, true);
    assert.strictEqual(f.schein, null);
    H.run(`window.game.scene.getScene('GameScene')._activeEventToast = null`);
    aufheben(H);
    assert.strictEqual(toastStand(H), null, 'Siegel zeigt einen Schriftstueck-Toast');
  });

  test('Rueckfall: ohne die Bilder die alte Darstellung', () => {
    H.run(`(function () { var sc = window.game.scene.getScene('GameScene');
      ${JSON.stringify(Object.keys(DATEIEN))}.forEach(function (k) { sc.textures.remove(k); }); })()`);
    // Fragment: gezeichnete Rolle, gelbe Kreise.
    const r = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      window.EventSystem.EVENT_TYPES.filter(function (e) { return e.id === 'lore_fragment'; })[0].handler(sc);
      var r = sc.children.getByName('wissensfragment');
      return { key: r.texture.key, schein: sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'schrift_schein'; }).length };
    })()`);
    assert.strictEqual(r.key, 'proc_scroll');
    assert.strictEqual(r.schein, 0);
    // Quest-Schrift: eingefaerbtes Erz wie vorher.
    aktiviere(H, 'document', 5);
    const f = legeQuestFund(H);
    assert.strictEqual(f.key, 'itMat');
    assert.strictEqual(f.tint, true);
    // Toast: Ereignis-Medaillon statt des fehlenden Federsymbols.
    aufheben(H);
    assert.strictEqual(toastStand(H).art, 'ui_symbol_ereignis');
  });
});

describe('im Hub', () => {
  let H = null;
  before(async () => {
    H = await launch({ search: '?autostart=1', renderer: 'canvas' });
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 600 }), 'Hub nicht erreicht');
    H.step(30);
    // Der Einstiegsdialog des Hubs (Tiefe 2300) laege ueber dem Toast und verfaelschte die Messung.
    H.run(`window.game.scene.getScene('HubSceneV2').children.list.forEach(function (o) { if (o.type === 'Container' && o.depth >= 2100) o.setVisible(false); })`);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Toast: Federsymbol, zwei Zeilen, lesbar', () => {
    H.run(`window.Schriftstuecke.toast(window.game.scene.getScene('HubSceneV2'), window.i18n.t('loot.quest_item.INTERROGATION_RECORD'),
      window.i18n.t('schrift.hinweis.auftrag', { title: 'Brankas Abschriften' }))`);
    H.step(40);
    const t = H.run(`(function () { var a = window.game.scene.getScene('HubSceneV2')._activeEventToast;
      return { art: a.art, text: a.label.text, unter: a.unter && a.unter.text, ly: a.label.y, uy: a.unter && a.unter.y,
        bild: window.game.scene.getScene('HubSceneV2').children.list.some(function (o) { return o.type === 'Image' && o.visible && o.texture.key === 'ui_symbol_schrift'; }) }; })()`);
    assert.strictEqual(t.art, 'ui_symbol_schrift');
    assert.ok(t.bild, 'Federsymbol nicht zu sehen');
    assert.ok(t.uy > t.ly + 10, 'die Hinweiszeile steht nicht unter dem Titel');
    alleLesbar(kontraste(H, `(function () { var a = window.game.scene.getScene('HubSceneV2')._activeEventToast; return [a.label, a.unter]; })()`), 'Schriftstueck-Toast');
    vorschau(H, 'nachher_toast_hub.png');
  });
});
