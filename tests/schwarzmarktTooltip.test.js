// tests/schwarzmarktTooltip.test.js — der Laden zeigt den ganzen Gegenstand.
//
// Bisher stand in einer Ladenzeile nur der Name und eine Affixzeile. Die
// GRUNDWERTE — Ruestung, Schaden, Tempo, Reichweite — fehlten ganz, ebenso die
// Ausbaustufe. Man kaufte also blind das halbe Stueck.
//
// Die Texte kommen aus window.formatItemTooltip, demselben Formatierer, den das
// Inventar benutzt. Genau das prueft der letzte Test: eine zweite Fassung im
// Laden waere beim ersten Nachziehen von der ersten abgewichen, und dann zeigte
// der Laden etwas anderes an als der Rucksack.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=20', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

// Der Laden ist NICHT vorregistriert — openShopScene meldet ihn erst an. Der
// fliegende Haendler (_dungeonMerchant) umgeht dabei die Tiefensperre aus #51.
const OEFFNEN = `
  window._dungeonMerchant = true;
  var sc = window.game.scene.getScene('ShopScene');
  if (!sc) {
    window.openShopScene(window.game.scene.getScene('GameScene'));
    sc = window.game.scene.getScene('ShopScene');
  }
`;

/** Zeigt den Tooltip fuer ein frisch gerolltes Stueck und misst ihn. */
function tipFuer(basis, tier, stufen) {
  return H.run(`(function () {
    var LS = window.LootSystem;
    window.DUNGEON_DEPTH = 20; window.currentWave = 20;
    ${OEFFNEN}
    if (!sc) return { fehler: 'ShopScene nicht erreichbar' };
    var it = LS.rollItem('${basis}', 20, ${tier});
    for (var i = 0; i < ${stufen || 0}; i++) LS.ausbauen(it);
    sc._zeigeItemTip(it, 120);
    var da = !!sc._itemTip;
    var text = da ? String(sc._itemTip.inhalt.text) : '';
    var k = da ? sc._itemTip.kasten : null;
    var kasten = k ? {
      l: Math.round(k.x - k.width / 2), r: Math.round(k.x + k.width / 2),
      o: Math.round(k.y - k.height / 2), u: Math.round(k.y + k.height / 2)
    } : null;
    sc._versteckeItemTip();
    return { da: da, text: text, kasten: kasten, nachher: !!sc._itemTip,
             breite: sc.scale.width, hoehe: sc.scale.height };
  })()`);
}

test('Der Tooltip nennt die Grundwerte, nicht nur die Affixe', () => {
  // Ein Plattenpanzer traegt Ruestung als GRUNDwert. In der Ladenzeile stand
  // davon nichts — nur die Affixe.
  const t = tipFuer('BD_PLATTENPANZER', 2, 0);
  assert.ok(!t.fehler, t.fehler);
  assert.strictEqual(t.da, true, 'es erschien gar kein Tooltip');
  assert.ok(t.text.indexOf('Rüstung') >= 0,
    'die Ruestung fehlt im Tooltip: ' + JSON.stringify(t.text));
  assert.ok(t.text.indexOf('Plattenpanzer') >= 0,
    'der Name fehlt im Tooltip: ' + JSON.stringify(t.text));
});

test('Der Tooltip nennt auch die Ausbaustufe', () => {
  const t = tipFuer('BD_PLATTENPANZER', 3, 2);
  assert.ok(t.text.indexOf('Ausbau') >= 0,
    'die Ausbaustufe fehlt: ' + JSON.stringify(t.text));
});

test('Der Kasten bleibt im Bild', () => {
  // Eine lange Affixliste an einer tiefen Zeile ist der Fall, in dem ein
  // Tooltip unten hinauslaeuft.
  const t = tipFuer('BD_PLATTENPANZER', 3, 5);
  assert.ok(t.kasten.u <= t.hoehe,
    'der Kasten endet bei y=' + t.kasten.u + ', das Bild ist ' + t.hoehe + ' px hoch');
  assert.ok(t.kasten.r <= t.breite,
    'der Kasten endet bei x=' + t.kasten.r + ', das Bild ist ' + t.breite + ' px breit');
  assert.ok(t.kasten.o >= 0 && t.kasten.l >= 0, 'der Kasten beginnt ausserhalb');
});

test('Der Tooltip verschwindet wieder', () => {
  // Ein Kasten, der stehen bleibt, verdeckt die naechste Zeile — und beim
  // Reiterwechsel die ganze neue Liste.
  const t = tipFuer('BD_PLATTENPANZER', 1, 0);
  assert.strictEqual(t.nachher, false, 'der Tooltip blieb nach dem Verstecken stehen');
});

test('Laden und Inventar zeigen fuer dasselbe Stueck dasselbe', () => {
  // Der eigentliche Punkt. Eine zweite Fassung im Laden waere beim ersten
  // Nachziehen von der ersten abgewichen.
  const r = H.run(`(function () {
    var LS = window.LootSystem;
    window.DUNGEON_DEPTH = 20; window.currentWave = 20;
    ${OEFFNEN}
    if (!sc) return { fehler: 'ShopScene nicht erreichbar' };
    var it = LS.rollItem('BD_PLATTENPANZER', 20, 3);
    LS.ausbauen(it);
    sc._zeigeItemTip(it, 120);
    var imLaden = String(sc._itemTip.inhalt.text);
    sc._versteckeItemTip();
    var i = window.formatItemTooltip(it);
    var imInventar = [i.title, i.body].filter(Boolean).join(String.fromCharCode(10));
    return { imLaden: imLaden, imInventar: imInventar };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.imLaden, r.imInventar, 'Laden und Inventar zeigen Verschiedenes');
});
