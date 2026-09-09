// tests/nebenhand.test.js — die zweite Hand hat Gegenstaende (#124).
//
// Der Platz war seit dem Inventar-Umbau da, im Raster angelegt, bespielbar und
// gezeichnet — und blieb leer, weil es keine Basen dafuer gab. Acht Stuecke in
// drei Richtungen fuellen ihn: Schilde (Ruestung gegen Tempo), Lichtquellen
// (Sicht gegen Wehrhaftigkeit), Zweitwaffen (Tempo gegen Reichweite).
//
// Die Tests decken die Stellen ab, an denen ein neuer Gegenstandstyp
// stillschweigend durchfaellt: eine fehlende Erlaubnisliste (dann wuerfelt er
// nie einen Affix), ein fehlender Rastereintrag (dann ist er 1x1), eine
// fehlende Speicherliste (dann ist er nach dem Speichern weg).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=20', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

const SCHLUESSEL = ['OF_BUCHBINDERSCHILD', 'OF_PAVESE', 'OF_WANDSCHIRM', 'OF_TALGLICHT',
  'OF_BANNLATERNE', 'OF_GLUTSCHALE', 'OF_FANGDOLCH', 'OF_KETTENHAKEN'];

test('Acht Basen, jede mit eigenem Symbol', () => {
  const r = H.run(`(function () {
    var basen = window.LootSystem.ITEM_BASES.filter(function (b) { return b.type === 'offhand'; });
    return basen.map(function (b) {
      return { key: b.key, icon: b.iconKey,
               hatTextur: !!(window.game && window.game.textures && window.game.textures.exists(b.iconKey)) };
    });
  })()`);
  assert.strictEqual(r.length, 8, 'erwartet acht Nebenhand-Basen, gefunden ' + r.length);
  const fehlend = r.filter((b) => !b.hatTextur);
  assert.strictEqual(fehlend.length, 0,
    'ohne Textur faellt das Symbol auf itMat zurueck: '
    + fehlend.map((b) => b.key + '/' + b.icon).join(', '));
  const symbole = r.map((b) => b.icon);
  assert.strictEqual(new Set(symbole).size, 8, 'zwei Basen teilen sich ein Symbol: ' + symbole.join(', '));
});

test('Ein Nebenhand-Stueck wuerfelt Affixe — sonst waere jedes grau', () => {
  // appliesTo ist eine ERLAUBNISLISTE. Stand 'offhand' nirgends, bekam jedes
  // Stueck null Affixe und stand fuer immer auf Gewoehnlich.
  const r = H.run(`(function () {
    window.DUNGEON_DEPTH = 20; window.currentWave = 20;
    var zaehl = {}, ohne = 0;
    for (var i = 0; i < 400; i++) {
      var it = window.LootSystem.rollItem('OF_PAVESE', 20, 2);
      if (!it.affixes || !it.affixes.length) { ohne++; continue; }
      it.affixes.forEach(function (a) { zaehl[a.defId] = (zaehl[a.defId] || 0) + 1; });
    }
    return { zaehl: zaehl, ohne: ohne };
  })()`);
  assert.strictEqual(r.ohne, 0, r.ohne + ' von 400 magischen Stuecken hatten keinen Affix');
  assert.ok(Object.keys(r.zaehl).length >= 5,
    'nur ' + Object.keys(r.zaehl).length + ' verschiedene Affixe erreichbar: ' + JSON.stringify(r.zaehl));
});

test('Kein Nebenhand-Stueck gibt rohen Schaden', () => {
  // Die Schadenszahlen kommen seit #135 aus der DPS-Decke, die je WAFFE
  // gerechnet wird. Ein Zuschlag aus der zweiten Hand liefe an ihr vorbei und
  // haette die Decke ausgehebelt.
  const r = H.run(`(function () {
    var raus = [];
    ${JSON.stringify(SCHLUESSEL)}.forEach(function (k) {
      [1, 10, 20, 30].forEach(function (t) {
        window.DUNGEON_DEPTH = t;
        var it = window.LootSystem.rollItem(k, t, 3);
        if (it.damage) raus.push(k + ' T' + t + ': ' + it.damage);
      });
    });
    return raus;
  })()`);
  // Nicht deepStrictEqual: H.run reicht das Feld aus einem anderen Realm
  // zurueck, und der Prototypvergleich schlaegt dann auch bei [] gegen [] fehl.
  assert.strictEqual(r.length, 0, 'diese Stuecke tragen Schaden: ' + r.join(', '));
});

test('Rastermass 1x2 statt des stillen Rueckfalls auf 1x1', () => {
  const r = H.run(`(function () {
    var it = window.LootSystem.rollItem('OF_PAVESE', 20, 0);
    return window.InventoryGrid.groesse(it);
  })()`);
  assert.deepStrictEqual({ b: r.b, h: r.h }, { b: 1, h: 2 },
    'Nebenhand faellt auf ' + r.b + 'x' + r.h + ' zurueck');
});

test('Ein Zweihaender sperrt die zweite Hand', () => {
  const r = H.run(`(function () {
    window.DUNGEON_DEPTH = 20; window.currentWave = 20;
    function leeren() {
      ['weapon','offhand','head','body','boots','amulet']
        .forEach(function (k) { window.equipment[k] = null; });
      for (var i = 0; i < window.inventory.length; i++) window.inventory[i] = null;
    }
    leeren();
    var schild = window.LootSystem.rollItem('OF_PAVESE', 20, 0);
    var zwei   = window.LootSystem.rollItem('WPN_RICHTSCHWERT', 20, 0);
    var ein    = window.LootSystem.rollItem('WPN_EISENKLINGE', 20, 0);

    // a) Schild anlegen, waehrend ein Zweihaender getragen wird -> abgelehnt.
    window.equipment.weapon = zwei;
    window.InventoryGrid.einlagern(schild);
    window.selectInventorySlot(window.inventory.indexOf(schild));
    window.equipSelectedItem();
    var a = !!window.equipment.offhand;

    // b) Einhaender tragen, Schild anlegen -> geht.
    window.equipment.weapon = ein;
    window.selectInventorySlot(window.inventory.indexOf(schild));
    window.equipSelectedItem();
    var b = window.equipment.offhand ? window.equipment.offhand.key : null;

    // c) Jetzt den Zweihaender anlegen -> das Schild wandert ins Inventar.
    window.InventoryGrid.einlagern(zwei);
    window.selectInventorySlot(window.inventory.indexOf(zwei));
    window.equipSelectedItem();
    var c = { hand: window.equipment.offhand,
              waffe: window.equipment.weapon ? window.equipment.weapon.key : null,
              imInventar: window.inventory.indexOf(schild) >= 0 };

    leeren();
    return { a: a, b: b, c: c };
  })()`);
  assert.strictEqual(r.a, false, 'das Schild ging trotz Richtschwert an die Hand');
  assert.strictEqual(r.b, 'OF_PAVESE', 'das Schild ging bei einer Einhandwaffe nicht an die Hand');
  assert.strictEqual(r.c.waffe, 'WPN_RICHTSCHWERT', 'der Zweihaender wurde nicht angelegt');
  assert.strictEqual(r.c.hand, null, 'die zweite Hand blieb belegt');
  assert.strictEqual(r.c.imInventar, true, 'das Schild ist beim Waffenwechsel verschwunden');
});

test('Nebenhand-Ausruestung ueberlebt das Speichern', () => {
  // Ohne Eintrag in PERSISTENT_EQUIP_SLOTS haette storage.js sie stillschweigend
  // weggelassen — dasselbe Loch, das das Amulett ABSICHTLICH hat.
  const r = H.run(`(function () {
    return window.LootSystem.PERSISTENT_EQUIP_SLOTS.slice();
  })()`);
  assert.ok(r.indexOf('offhand') >= 0, 'offhand fehlt in der Speicherliste: ' + r.join(', '));
  assert.ok(r.indexOf('amulet') < 0, 'das Amulett darf weiterhin NICHT gespeichert werden');
});

test('Ein Nebenhand-Stueck ueberlebt Speichern UND Laden', () => {
  // Der gemeldete Fehler: beim Fortsetzen war das Stueck weg. Gespeichert
  // wurde es ueber PERSISTENT_EQUIP_SLOTS, GELADEN aber ueber vier hart
  // notierte Zeilen in storage.js, in denen 'offhand' fehlte.
  //
  // Der Test daneben prueft nur die Liste. Er blieb deshalb gruen, waehrend
  // die Ladeseite das Stueck verwarf — eine Liste zu pruefen sagt nichts
  // darueber, ob beide Seiten sie auch benutzen. Hier also der ganze Weg.
  const r = H.run(`(function () {
    var LS = window.LootSystem;
    window.DUNGEON_DEPTH = 20; window.currentWave = 20;
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function (k) { window.equipment[k] = null; });
    window.equipment.weapon  = LS.rollItem('WPN_EISENKLINGE', 20, 1);
    window.equipment.offhand = LS.rollItem('OF_PAVESE', 20, 1);
    window.equipment.head    = LS.rollItem('HD_BRONZEHELM', 20, 1);

    var sc = window.game.scene.getScene('GameScene');
    window.saveGame(sc);
    // Alles leeren, als waere das Spiel geschlossen worden.
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function (k) { window.equipment[k] = null; });
    // loadGame() liest nur die Datei; angewendet wird sie von
    // applySaveToState — genau dort sass der Fehler.
    applySaveToState(sc, window.loadGame());

    var eq = window.equipment;
    var raus = { waffe: eq.weapon ? eq.weapon.key : null,
                 hand:  eq.offhand ? eq.offhand.key : null,
                 kopf:  eq.head ? eq.head.key : null,
                 amulett: eq.amulet };
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function (k) { window.equipment[k] = null; });
    return raus;
  })()`);
  assert.strictEqual(r.waffe, 'WPN_EISENKLINGE', 'schon die Waffe kam nicht zurueck — Testaufbau pruefen');
  assert.strictEqual(r.hand, 'OF_PAVESE',
    'die Nebenhand ist beim Laden verschwunden (zurueck kam: ' + r.hand + ')');
  assert.strictEqual(r.kopf, 'HD_BRONZEHELM', 'der Helm kam nicht zurueck');
  // Die Gegenprobe: das Amulett gilt nur einen Lauf und darf NICHT zurueckkommen.
  assert.strictEqual(r.amulett, null, 'das Amulett wurde aus dem Spielstand geladen');
});

test('Ein Nebenhand-Stueck darf in die Hub-Truhe', () => {
  // Vier weitere handgeschriebene Aufzaehlungen hatten kein 'offhand'. Ohne
  // sie war das Stueck zwar tragbar, aber nicht einlagerbar, nicht aufwertbar
  // und nicht zerlegbar.
  const r = H.run(`(function () {
    var it = window.LootSystem.rollItem('OF_PAVESE', 20, 1);
    return { darf: window.HubTruhe.darfHinein(it),
             vergleich: window.HubTruhe.darfHinein(window.LootSystem.rollItem('HD_BRONZEHELM', 20, 1)) };
  })()`);
  assert.strictEqual(r.vergleich, true, 'schon der Helm darf nicht hinein — Testaufbau pruefen');
  assert.strictEqual(r.darf, true, 'die Hub-Truhe nimmt keine Nebenhand-Stuecke an');
});

test('Blockchance vereitelt Treffer GANZ statt sie zu daempfen', () => {
  // Der Unterschied zu mehr Ruestung: ein geblockter Treffer gibt 0 zurueck,
  // ein durchgekommener den vollen Betrag. Es gibt nichts dazwischen — daran
  // erkennt man, dass der Block an der Ruestungsrechnung vorbeigeht.
  //
  // Nicht auf 100 % pruefen: die Anlege-Rechnung deckelt bei 40 %, die
  // Schadensfunktion nochmals bei 60 %. Ein Test gegen 1,0 pruefte den
  // Deckel, nicht den Block.
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var alt = window.playerBlockChance, altDodge = window.PLAYER_DODGE_CHANCE;
    window.PLAYER_DODGE_CHANCE = 0;
    var raus = { werte: {} };
    window.playerBlockChance = 0;
    raus.ohne = window.applyPlayerDamage(20, sc);
    window.playerBlockChance = 0.5;
    var geblockt = 0;
    for (var i = 0; i < 400; i++) {
      var w = window.applyPlayerDamage(20, sc);
      raus.werte[w] = (raus.werte[w] || 0) + 1;
      if (w === 0) geblockt++;
    }
    raus.anteil = geblockt / 400;
    window.playerBlockChance = alt; window.PLAYER_DODGE_CHANCE = altDodge;
    return raus;
  })()`);
  assert.ok(r.ohne > 0, 'ohne Block kam gar kein Schaden durch — Testaufbau kaputt');
  assert.ok(Math.abs(r.anteil - 0.5) < 0.08,
    'bei 50 % Blockchance wurden ' + (r.anteil * 100).toFixed(0) + ' % geblockt');
  // Genau zwei Ergebnisse: 0 oder der volle Betrag.
  const werte = Object.keys(r.werte).map(Number).sort((a, b) => a - b);
  assert.deepStrictEqual(werte, [0, r.ohne],
    'der Block daempft, statt zu vereiteln — gemessene Schadenswerte: ' + werte.join(', '));
});

test('Sichtweite hebt den Erkundungsradius der Minikarte', () => {
  // Das ist die Sichtweite, die es im Spiel WIRKLICH gibt. FOW_RADIUS in
  // main.js ist eine tote Konstante (nirgends gelesen) — eine Laterne daran
  // zu haengen haette eine Zahl ohne Wirkung ergeben.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'minimap.js'), 'utf8');
  assert.ok(/playerSichtBonus/.test(quelle),
    'minimap.js liest den Sichtbonus nicht — die Lichtquellen tun nichts');
  const zeile = quelle.split(/\r?\n/).find((z) => z.includes('const visionRadius'));
  assert.ok(zeile && /playerSichtBonus|_sicht/.test(zeile),
    'der Radius haengt nicht am Bonus: ' + (zeile || '(keine Zeile gefunden)'));
});

test('Die Glutschale entzuendet Gegner bei Nahkampftreffern', () => {
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'player.js'), 'utf8');
  assert.ok(/playerBrandChance/.test(quelle),
    'player.js liest die Brandchance nicht — die Glutschale brennt nie');
  assert.ok(/StatusEffectType\.BURNED/.test(quelle),
    'der Brand nutzt nicht den vorhandenen BURNED-Effekt');
});

test('recalcDerived traegt die drei Wirkungen nach aussen', () => {
  // Ohne diesen Schritt stehen die Zahlen auf dem Stueck und wirken nirgends.
  const r = H.run(`(function () {
    window.DUNGEON_DEPTH = 20; window.currentWave = 20;
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function (k) { window.equipment[k] = null; });
    function lies() {
      window.LootSystem.recomputeBonuses(); recalcDerived(0, 0);
      return { block: window.playerBlockChance, brand: window.playerBrandChance,
               sicht: window.playerSichtBonus };
    }
    var leer = lies();
    window.equipment.offhand = window.LootSystem.rollItem('OF_WANDSCHIRM', 20, 0);
    var block = lies();
    window.equipment.offhand = window.LootSystem.rollItem('OF_GLUTSCHALE', 20, 0);
    var glut = lies();
    window.equipment.offhand = null;
    var wieder = lies();
    return { leer: leer, block: block, glut: glut, wieder: wieder };
  })()`);
  assert.strictEqual(r.leer.block, 0, 'ohne Nebenhand gibt es schon Block');
  assert.ok(r.block.block > 0, 'der Wandschirm blockt nicht: ' + r.block.block);
  assert.ok(r.glut.brand > 0, 'die Glutschale entzuendet nicht: ' + r.glut.brand);
  assert.ok(r.glut.sicht > 0, 'die Glutschale leuchtet nicht: ' + r.glut.sicht);
  // Der haeufigste Fehler bei abgeleiteten Globals: sie bleiben stehen.
  assert.strictEqual(r.wieder.block, 0, 'der Block bleibt nach dem Ablegen haengen');
  assert.strictEqual(r.wieder.brand, 0, 'der Brand bleibt nach dem Ablegen haengen');
  assert.strictEqual(r.wieder.sicht, 0, 'die Sicht bleibt nach dem Ablegen haengen');
});

test('Die Werte liegen im selben Band wie der Rest der Ausruestung', () => {
  // Punkt 6 der Itemization-Vorgabe: das Balancing zwischen den Werten soll
  // stimmen. Ein Schild, das aus der Reihe faellt, waere Pflichtausruestung.
  const r = H.run(`(function () {
    var LS = window.LootSystem, raus = {};
    [['OF_WANDSCHIRM','block',19],['OF_GLUTSCHALE','brand',17],
     ['OF_PAVESE','armor',10],['OF_BUCHBINDERSCHILD','armor',1]].forEach(function (e) {
      var k = e[0], stat = e[1], t = e[2];
      window.DUNGEON_DEPTH = t; window.currentWave = t;
      var summe = 0;
      for (var i = 0; i < 200; i++) {
        var it = LS.rollItem(k, t, 0);
        summe += LS.basiswertWirkung(stat, it[stat] || 0, t);
      }
      raus[k + '.' + stat] = summe / 200;
    });
    return raus;
  })()`);
  Object.keys(r).forEach((k) => {
    const w = r[k] * 100;
    assert.ok(w >= 4 && w <= 18,
      k + ' liegt bei ' + w.toFixed(1) + ' % — ausserhalb des Bandes (Wurf 8-12 %, Basen 6-16 %)');
  });
});

test('Die Nebenhand verdraengt die Ruestungsplaetze nicht aus dem Beutepool', () => {
  // Acht neue Basen gegen je drei pro Ruestungsplatz: mit den ersten
  // Droptabellen nahm die Nebenhand auf Tiefe 20 rund 28 %, waehrend Kopf,
  // Koerper und Fuesse auf 11-14 % fielen.
  const r = H.run(`(function () {
    var raus = {};
    [1, 20].forEach(function (t) {
      window.DUNGEON_DEPTH = t; window.currentWave = t;
      var z = {}, N = 600;
      for (var i = 0; i < N; i++) {
        var ty = window.LootSystem.rollItem(null, t, 0).type;
        z[ty] = (z[ty] || 0) + 1;
      }
      raus[t] = { offhand: 100 * (z.offhand || 0) / N, head: 100 * (z.head || 0) / N,
                  body: 100 * (z.body || 0) / N, boots: 100 * (z.boots || 0) / N };
    });
    return raus;
  })()`);
  [1, 20].forEach((t) => {
    const a = r[t];
    assert.ok(a.offhand > 3,
      'auf Tiefe ' + t + ' faellt praktisch nie ein Nebenhand-Stueck: ' + a.offhand.toFixed(1) + ' %');
    assert.ok(a.offhand < 22,
      'auf Tiefe ' + t + ' nimmt die Nebenhand ' + a.offhand.toFixed(1) + ' % des Pools');
    ['head', 'body', 'boots'].forEach((s) => {
      assert.ok(a[s] > 7,
        s + ' faellt auf Tiefe ' + t + ' nur noch zu ' + a[s].toFixed(1) + ' % — die Nebenhand verdraengt es');
    });
  });
});
