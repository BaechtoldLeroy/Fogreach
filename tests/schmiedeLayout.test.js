// tests/schmiedeLayout.test.js — Die linke Spalte der Archivschmiede (#141).
//
// Gemeldet: die Nebenhand ueberlappt die Inventarliste. Die Ueberschrift
// "Inventar (Equipment)" wurde aus einer festen Platzanzahl berechnet:
//
//     const invHeaderY = slotStartY + 4 * (slotH + 4) + 8;
//
// Die 4 stammte aus der Zeit vor der Nebenhand. Seit #124 sind es fuenf
// Kaesten, die Ueberschrift landete deshalb 28 px INNERHALB des Stiefel-
// Platzes, und der graue Kasten der Liste verdeckte den Rest.
//
// Der Test misst die echten y-Werte der gebauten Szene, nicht die Formel —
// eine nachgebaute Rechnung wuerde denselben Denkfehler noch einmal machen.
// Zwei Zusicherungen tragen ihn:
//
//   1. Nichts aus dem Inventarblock ragt in den letzten Ausruestungsplatz.
//      Diese faellt sofort, wenn die feste Zahl zurueckkehrt — und sie faellt
//      auch beim SECHSTEN Platz, denn sie prueft den gemessenen Abstand, nicht
//      die Zahl.
//   2. Die Spalte bleibt bis zu den Knoepfen im Bild. Der fuenfte Platz kostet
//      40 px, die Bildhoehe von 480 waechst aber nicht mit; ohne Ausgleich
//      rutschen Verbessern/Zerlegen unter den Rand.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  const imHub = await H.waitForScene('HubSceneV2', { maxRounds: 250 });
  assert.ok(imHub, 'HubSceneV2 wurde nicht erreicht');
  H.run("window.game.scene.getScene('HubSceneV2').scene.start('CraftingScene')");
  const inDerSchmiede = await H.waitForScene('CraftingScene', { maxRounds: 250 });
  assert.ok(inDerSchmiede, 'CraftingScene wurde nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

/**
 * Fuellt das Inventar mit Ausruestung und misst die gezeichneten Balken.
 *
 * Ohne Ausruestung im Inventar zeichnet die Szene gar keine Zeile — der Test
 * waere dann gruen, ohne je einen Balken gesehen zu haben.
 */
function balken() {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('CraftingScene');
    for (var i = 0; i < 6; i++) inventory.push(window.LootSystem.rollItem(null, 5));
    sc._refreshInventoryList();
    return {
      kasten: {
        links: sc.invListBg.x - sc.invListBg.width / 2,
        rechts: sc.invListBg.x + sc.invListBg.width / 2,
        oben: sc.invListBg.y - sc.invListBg.height / 2,
        unten: sc.invListBg.y + sc.invListBg.height / 2
      },
      zeilen: sc.invRows.map(function (r) {
        return { links: r.bg.x - r.bg.width / 2, rechts: r.bg.x + r.bg.width / 2,
                 oben: r.bg.y - r.bg.height / 2, unten: r.bg.y + r.bg.height / 2 };
      }),
      maxZeilen: sc.invMaxRows,
      werkbankLinks: sc.werkbankRahmen.x - sc.werkbankRahmen.width / 2,
      bildHoehe: sc.scale.height
    };
  })()`);
}

/** Misst den Inventarblock gegen den untersten Ausruestungsplatz. */
function messen() {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('CraftingScene');
    var ueberschrift = window.i18n.t('crafting.section.inventory');

    var plaetze = Object.keys(sc.equipSlots).map(function (k) {
      var bg = sc.equipSlots[k].bg;
      return { name: k, oben: bg.y - bg.height / 2, unten: bg.y + bg.height / 2 };
    });
    var letzterPlatz = Math.max.apply(null, plaetze.map(function (p) { return p.unten; }));

    var kopf = null;
    sc.children.list.forEach(function (o) {
      if (o.type === 'Text' && String(o.text || '') === ueberschrift) kopf = o;
    });

    return {
      anzahlPlaetze: plaetze.length,
      plaetze: plaetze,
      letzterPlatz: letzterPlatz,
      kopfGefunden: !!kopf,
      kopfOben: kopf ? kopf.y - kopf.height * (kopf.originY || 0) : null,
      kopfUnten: kopf ? kopf.y + kopf.height * (1 - (kopf.originY || 0)) : null,
      listeOben: sc.invListBg.y - sc.invListBg.height / 2,
      listeUnten: sc.invListBg.y + sc.invListBg.height / 2,
      sichtbareZeilen: sc.invMaxRows,
      bildHoehe: sc.scale.height
    };
  })()`);
}

test('Die Inventar-Ueberschrift liegt UNTER dem letzten Ausruestungsplatz', () => {
  const m = messen();
  assert.strictEqual(m.anzahlPlaetze, 5,
    'erwartet fuenf Ausruestungsplaetze (mit Nebenhand), waren ' + m.anzahlPlaetze);
  assert.ok(m.kopfGefunden, 'die Ueberschrift "Inventar (Equipment)" wurde nicht gefunden');

  assert.ok(m.kopfOben >= m.letzterPlatz,
    'die Ueberschrift beginnt bei y=' + m.kopfOben
    + ', der letzte Ausruestungsplatz endet aber erst bei y=' + m.letzterPlatz
    + ' — sie liegt ' + (m.letzterPlatz - m.kopfOben) + ' px darin');

  // Der Abstand darf auch nicht ins Leere laufen: eine zu grosse Zahl waere
  // derselbe Fehler mit umgekehrtem Vorzeichen.
  const luft = m.kopfOben - m.letzterPlatz;
  assert.ok(luft <= 24,
    'zwischen letztem Platz und Ueberschrift klaffen ' + luft + ' px');
});

test('Der graue Kasten der Liste verdeckt keinen Ausruestungsplatz', () => {
  const m = messen();
  assert.ok(m.listeOben >= m.kopfUnten,
    'die Liste beginnt bei y=' + m.listeOben + ', die Ueberschrift endet erst bei y=' + m.kopfUnten);
  assert.ok(m.listeOben >= m.letzterPlatz,
    'die Liste beginnt bei y=' + m.listeOben
    + ' und schneidet damit den letzten Ausruestungsplatz (Unterkante y='
    + m.letzterPlatz + ')');
});

test('Die drei Handlungen bleiben im Bild und laufen nicht in den Text', () => {
  // Der laengste Fall ist NICHT das legendaere Stueck, sondern das
  // gewoehnliche: nur dort steht zusaetzlich die Zeile "Verbessern: -> Magisch",
  // und der Preisblock wird am hoechsten.
  //
  // Seit dem Umbau liegen alle drei Handlungen nebeneinander am Werktisch
  // rechts. Vorher lagen Verbessern und Zerlegen unten links und der Ausbau
  // rechts — man musste zwischen zwei Haelften schauen, um eine Entscheidung
  // zu treffen.
  const res = H.run(`(function () {
    var sc = window.game.scene.getScene('CraftingScene');
    var it = window.LootSystem.rollItem('WPN_EISENKLINGE', 40, 0);
    it.tier = 0;
    window.equipment.weapon = it;
    sc._refreshAll();
    sc._selectEquip('weapon');
    function kasten(b) {
      return { oben: b.bg.y - b.bg.height / 2, unten: b.bg.y + b.bg.height / 2,
               links: b.bg.x - b.bg.width / 2, rechts: b.bg.x + b.bg.width / 2,
               sichtbar: b.container.visible };
    }
    return {
      preiseUnten: sc.werkbankKosten.y + sc.werkbankKosten.height,
      aufwerten: kasten(sc.enhanceBtn),
      ausbauen: kasten(sc.ausbauBtn),
      zerlegen: kasten(sc.salvageBtn),
      massen: kasten(sc.massSalvageBtn),
      bildHoehe: sc.scale.height, bildBreite: sc.scale.width
    };
  })()`);

  ['aufwerten', 'ausbauen', 'zerlegen', 'massen'].forEach((k) => {
    const b = res[k];
    assert.strictEqual(b.sichtbar, true, k + ' ist versteckt');
    assert.ok(b.unten <= res.bildHoehe,
      k + ' endet bei y=' + b.unten + ', das Bild ist nur ' + res.bildHoehe + ' px hoch');
    assert.ok(b.rechts <= res.bildBreite,
      k + ' endet bei x=' + b.rechts + ', das Bild ist nur ' + res.bildBreite + ' px breit');
    assert.ok(b.links >= 0, k + ' beginnt links ausserhalb: x=' + b.links);
  });
  assert.ok(res.preiseUnten <= res.aufwerten.oben,
    'der Preisblock reicht bis y=' + res.preiseUnten
    + ' und laeuft in die Knopfreihe (Oberkante y=' + res.aufwerten.oben + ')');
  // Und sie ueberlappen sich nicht gegenseitig.
  assert.ok(res.aufwerten.rechts <= res.ausbauen.links,
    'Verbessern und Ausbauen ueberlappen');
  assert.ok(res.ausbauen.rechts <= res.zerlegen.links,
    'Ausbauen und Zerlegen ueberlappen');
});

test('Die Ausruestungsplaetze stehen nur an EINER Stelle in der Datei', () => {
  // #124 musste 'offhand' in zwoelf Listen nachtragen; vier davon lagen in
  // dieser Datei. Genau daran ist #141 haengengeblieben — die Listen wuchsen,
  // die Layoutrechnung daneben nicht. Eine Liste, ein Ort.
  const quelle = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'scenes', 'CraftingScene.js'), 'utf8');
  const treffer = quelle.split("'weapon', 'offhand', 'head', 'body', 'boots'").length - 1;
  assert.strictEqual(treffer, 1,
    'die Platzliste steht ' + treffer + '-mal in CraftingScene.js — '
    + 'beim naechsten Platz wird wieder eine davon vergessen');
});

test('Die Balken der Inventarliste bleiben in ihrem Kasten', () => {
  // Gemeldet: "die Balken fuers Equipment im Inventar sind zu breit".
  // Gemessen ragte jeder Balken 97 px ueber seinen eigenen grauen Kasten
  // hinaus und damit bis x 457 — der Werktisch beginnt bei x 384, die Liste
  // lag also unter ihm.
  //
  // Der Grund: die Breite wurde an ZWEI Stellen gerechnet. Der Kasten nahm
  // panelW (330), die Balken rechneten sich Bildbreite / 2 minus 50 (430)
  // selbst aus. Der Test prueft deshalb den Balken gegen den Kasten, nicht
  // gegen eine Zahl.
  const m = balken();
  assert.ok(m.zeilen.length > 0, "es wurde keine Zeile gezeichnet");
  m.zeilen.forEach((z, i) => {
    assert.ok(z.links >= m.kasten.links,
      'Balken ' + (i + 1) + ' beginnt bei x=' + z.links
      + ', sein Kasten erst bei x=' + m.kasten.links);
    assert.ok(z.rechts <= m.kasten.rechts,
      'Balken ' + (i + 1) + ' endet bei x=' + z.rechts
      + ', sein Kasten schon bei x=' + m.kasten.rechts
      + ' — er ragt ' + (z.rechts - m.kasten.rechts) + ' px hinaus');
    assert.ok(z.rechts <= m.werkbankLinks,
      'Balken ' + (i + 1) + ' reicht bis x=' + z.rechts
      + ' und liegt damit unter dem Werktisch (beginnt bei x=' + m.werkbankLinks + ')');
  });
});

test('Die Liste nutzt den Platz unter der Spalte, ohne aus dem Bild zu laufen', () => {
  // Beide Richtungen. Zu kurz: der Platz unter der Spalte bleibt leer, obwohl
  // die Werte nach rechts gewandert sind. Zu lang: die Liste schiebt sich
  // ueber die Rueckmeldung und den Zurueck-Knopf am unteren Rand.
  const m = balken();
  assert.ok(m.maxZeilen >= 4,
    'die Liste zeigt nur ' + m.maxZeilen + ' Zeilen, unter ihr bleiben '
    + Math.round(m.bildHoehe - m.kasten.unten) + ' px ungenutzt');
  assert.ok(m.kasten.unten <= m.bildHoehe - 50,
    'die Liste endet bei y=' + m.kasten.unten + ' und laesst nur noch '
    + Math.round(m.bildHoehe - m.kasten.unten) + ' px fuer die untere Knopfreihe');
  // Und die gezeichneten Zeilen bleiben in ihrem Kasten.
  m.zeilen.forEach((z, i) => {
    assert.ok(z.unten <= m.kasten.unten,
      'Balken ' + (i + 1) + ' endet bei y=' + z.unten
      + ', sein Kasten schon bei y=' + m.kasten.unten);
  });
});
