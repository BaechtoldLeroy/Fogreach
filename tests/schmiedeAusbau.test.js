// tests/schmiedeAusbau.test.js — der Ausbau in der Schmiede (#115).
//
// Die Rechnung selbst liegt in tests/ausbau.test.js. Hier geht es um den Weg
// durch die SZENE: dass der Knopf abbucht, was er ansagt, dass er beide
// Vorraete prueft, bevor er einen anfasst, und dass das Zerlegen die Haelfte
// zurueckgibt.
//
// Ausserdem: die Schmiedeplaene sind weg. Gemessen lieferte das Rezept
// "Eisenklinge" festen Schaden 8 auf iLevel 1 — auf Tiefe 1 dreissigmal so viel
// wie ein Fund, an der DPS-Decke aus #135 vorbei.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=20', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

/**
 * Startet die Schmiede, legt ein Stueck in den Koerperplatz, waehlt es aus und
 * gibt die Szene zurueck. Alles Weitere laeuft ueber ihre echten Methoden.
 */
const AUFBAU = `
  var LS = window.LootSystem;
  window.DUNGEON_DEPTH = 20; window.currentWave = 20;
  ['weapon','offhand','head','body','boots','amulet']
    .forEach(function (k) { window.equipment[k] = null; });
  window.equipment.body = LS.rollItem('BD_PLATTENPANZER', 20, 3);
  var sc = window.game.scene.getScene('CraftingScene');
  if (!sc || !sc.scene.isActive()) { window.game.scene.start('CraftingScene'); }
  sc = window.game.scene.getScene('CraftingScene');
`;

test('Die Schmiedeplaene sind weg', () => {
  // Sie liefen an allem vorbei, was seit #104/#122/#135 gilt: feste Zahlen,
  // iLevel 1, keine Affixe.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'scenes', 'CraftingScene.js'), 'utf8');
  ['this.RECIPES', '_craftRecipe', '_getRecipeDesc', 'WPN_CRAFT'].forEach((wort) => {
    assert.ok(quelle.indexOf(wort) < 0, 'Rest der Schmiedeplaene im Code: ' + wort);
  });
});

test('Der Ausbau bucht Gold UND Brocken ab', () => {
  const r = H.run(`(function () {
    ${AUFBAU}
    var LS = window.LootSystem;
    window.materialCounts = window.materialCounts || {};
    window.materialCounts.GOLD = 99999;
    window.materialCounts.MAT = 999;
    sc._selection = { kind: 'equip', key: 'body' };
    var kosten = LS.ausbauKosten(window.equipment.body);
    var vorher = { gold: LS.getGold(), mat: window.materialCounts.MAT,
                   stufe: LS.ausbauStufe(window.equipment.body) };
    sc._ausbauen();
    var nachher = { gold: LS.getGold(), mat: window.materialCounts.MAT,
                    stufe: LS.ausbauStufe(window.equipment.body) };
    return { kosten: kosten, vorher: vorher, nachher: nachher };
  })()`);
  assert.strictEqual(r.nachher.stufe, r.vorher.stufe + 1, 'die Stufe ist nicht gestiegen');
  assert.strictEqual(r.vorher.gold - r.nachher.gold, r.kosten.gold,
    'abgebucht wurden ' + (r.vorher.gold - r.nachher.gold) + ' Gold statt ' + r.kosten.gold);
  assert.strictEqual(r.vorher.mat - r.nachher.mat, r.kosten.brocken,
    'abgebucht wurden ' + (r.vorher.mat - r.nachher.mat) + ' Brocken statt ' + r.kosten.brocken);
});

test('Fehlen die Brocken, bleibt auch das Gold liegen', () => {
  // Der Fehler, der hier am leichtesten passiert: erst zahlen, dann am
  // zweiten Vorrat scheitern. Dann ist das Gold weg und nichts gewonnen.
  const r = H.run(`(function () {
    ${AUFBAU}
    var LS = window.LootSystem;
    window.materialCounts.GOLD = 99999;
    window.materialCounts.MAT = 0;          // reicht nicht
    sc._selection = { kind: 'equip', key: 'body' };
    var vorherGold = LS.getGold();
    var vorherStufe = LS.ausbauStufe(window.equipment.body);
    sc._ausbauen();
    return { goldWeg: vorherGold - LS.getGold(),
             stufe: LS.ausbauStufe(window.equipment.body) - vorherStufe };
  })()`);
  assert.strictEqual(r.goldWeg, 0, 'es wurden ' + r.goldWeg + ' Gold abgebucht, obwohl es scheiterte');
  assert.strictEqual(r.stufe, 0, 'die Stufe stieg trotz fehlender Brocken');
});

test('Reicht das Gold nicht, passiert gar nichts', () => {
  const r = H.run(`(function () {
    ${AUFBAU}
    var LS = window.LootSystem;
    window.materialCounts.GOLD = 1;
    window.materialCounts.MAT = 999;
    sc._selection = { kind: 'equip', key: 'body' };
    var vorherMat = window.materialCounts.MAT;
    var vorherStufe = LS.ausbauStufe(window.equipment.body);
    sc._ausbauen();
    return { matWeg: vorherMat - window.materialCounts.MAT,
             stufe: LS.ausbauStufe(window.equipment.body) - vorherStufe };
  })()`);
  assert.strictEqual(r.matWeg, 0, 'es wurden Brocken abgebucht, obwohl das Gold fehlte');
  assert.strictEqual(r.stufe, 0, 'die Stufe stieg trotz fehlenden Goldes');
});

test('Der Ausbau wirkt sofort, nicht erst im naechsten Raum', () => {
  const r = H.run(`(function () {
    ${AUFBAU}
    var LS = window.LootSystem;
    window.materialCounts.GOLD = 99999;
    window.materialCounts.MAT = 999;
    sc._selection = { kind: 'equip', key: 'body' };
    LS.recomputeBonuses(); recalcDerived(0, 0);
    var vorher = playerArmor;
    sc._ausbauen();
    return { vorher: vorher, nachher: playerArmor };
  })()`);
  assert.ok(r.nachher > r.vorher,
    'die Ruestung blieb bei ' + (r.vorher * 100).toFixed(1) + ' % — recalcDerived lief nicht');
});

test('Zerlegen gibt die halben Ausbau-Brocken zurueck', () => {
  const r = H.run(`(function () {
    ${AUFBAU}
    var LS = window.LootSystem;
    window.materialCounts.GOLD = 999999;
    window.materialCounts.MAT = 9999;
    sc._selection = { kind: 'equip', key: 'body' };
    // Zwei Stufen kaufen.
    sc._ausbauen(); sc._ausbauen();
    var it = window.equipment.body;
    var erwartet = sc._salvageValue(it.tier) + LS.ausbauRueckgabe(it);
    var nurGrund = sc._salvageValue(it.tier);
    var vorher = window.materialCounts.MAT;
    sc._salvageItem();
    return { bekommen: window.materialCounts.MAT - vorher,
             erwartet: erwartet, nurGrund: nurGrund };
  })()`);
  assert.ok(r.erwartet > r.nurGrund, 'Testaufbau: der Ausbau gibt gar nichts zurueck');
  assert.strictEqual(r.bekommen, r.erwartet,
    'zurueck kamen ' + r.bekommen + ' statt ' + r.erwartet
    + ' (Grundwert allein waere ' + r.nurGrund + ')');
});

test('Das rechte Panel sagt, was die naechste Stufe kostet', () => {
  const r = H.run(`(function () {
    ${AUFBAU}
    var LS = window.LootSystem;
    sc._selection = { kind: 'equip', key: 'body' };
    sc._refreshAusbau();
    var kosten = LS.ausbauKosten(window.equipment.body);
    return { text: String(sc.ausbauInfo.text),
             knopf: !!(sc.ausbauBtn && sc.ausbauBtn.container.visible),
             gold: kosten ? kosten.gold : 0 };
  })()`);
  assert.ok(r.text.indexOf(String(r.gold)) >= 0,
    'der Goldpreis steht nicht im Panel: ' + JSON.stringify(r.text));
  assert.strictEqual(r.knopf, true, 'der Ausbau-Knopf ist unsichtbar');
});

test('Ein voll ausgebautes Stueck zeigt keinen Knopf mehr', () => {
  const r = H.run(`(function () {
    ${AUFBAU}
    var LS = window.LootSystem;
    window.materialCounts.GOLD = 999999;
    window.materialCounts.MAT = 9999;
    sc._selection = { kind: 'equip', key: 'body' };
    while (LS.ausbauKosten(window.equipment.body)) sc._ausbauen();
    sc._refreshAusbau();
    return { knopf: !!(sc.ausbauBtn && sc.ausbauBtn.container.visible),
             stufe: LS.ausbauStufe(window.equipment.body) };
  })()`);
  assert.strictEqual(r.stufe, 5, 'ein legendaeres Stueck kam nicht auf fuenf Stufen');
  assert.strictEqual(r.knopf, false, 'der Knopf bleibt sichtbar, obwohl nichts mehr geht');
});
