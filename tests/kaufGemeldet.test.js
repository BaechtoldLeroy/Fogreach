// tests/kaufGemeldet.test.js — jeder Kauf im Laden muss gemeldet werden.
//
// Gemeldet als "die Quest 'Der Alte mit dem Karren' funktioniert nicht, ich
// habe etwas gekauft und es wurde nicht erfuellt". Der Trigger selbst war in
// Ordnung: onSystemUsed('haendler') setzt das Ziel korrekt. Es gab ihn nur
// nicht ueberall — Portalrolle und Treppenrolle gaben Gold aus, lieferten die
// Ware und zeigten eine Meldung, riefen aber _kaufGemeldet() nicht auf. Wer
// beim Alten eine Rolle kaufte, kaufte also "nichts".
//
// Der Fall prueft die Regel allgemein, nicht die zwei Knoepfe: JEDER Knopf,
// der Gold abzieht, muss den Kauf melden. Damit faellt auch ein kuenftiger
// Kaufweg auf, der es vergisst.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
before(async () => { H = await launchDungeon({ depth: 6 }); });
after(async () => { if (H) await H.shutdown(); });

/** Oeffnet den Laden als Dungeon-Haendler und druckt jeden Knopf. */
function alleKaeufe() {
  H.run(`(function () {
    window.LootSystem.grantGold(500000);
    // Das Lager ist im Kopf-Lauf leer (_generateShopStock gibt nichts her),
    // dann hat der Waren-Reiter gar keine Kauf-Knoepfe und der Fall deckt nur
    // die Traenke ab. Also echte Ware hineinlegen.
    var st = window.LootSystem.getOrCreateShopState();
    st.itemStock = [];
    currentWave = 6;
    for (var i = 0; i < 20 && st.itemStock.length < 4; i++) {
      var it = randomLoot(1, { nurAusruestung: true });
      if (it) st.itemStock.push(it);
    }
    window._dungeonMerchant = true;
    window.openShopScene(window.game.scene.getScene('GameScene'));
  })()`);
  // Bis die Szene steht takten, nicht Bilder zaehlen.
  for (let i = 0; i < 200; i++) {
    const da = H.run(`(function () {
      var sh = window.game.scene.getScene('ShopScene');
      return !!(sh && sh.scene.isActive() && sh.tabBody);
    })()`);
    if (da) break;
    H.step(5);
  }
  return H.run(`(function () {
    var sh = window.game.scene.getScene('ShopScene');
    if (!sh || !sh.scene.isActive()) return { fehler: 'der Laden ist nicht aufgegangen' };
    if (!sh.isDungeonMerchant) return { fehler: 'der Laden haelt sich nicht fuer den Dungeon-Haendler' };
    var qs = window.questSystem;
    var gemeldet = [];
    var orig = qs.onSystemUsed;
    qs.onSystemUsed = function (z) { gemeldet.push(z); return orig.apply(this, arguments); };
    var kaeufe = [];
    try {
      ['items', 'potions'].forEach(function (reiter) {
        sh._renderTab(reiter);
        (sh.tabBody || []).filter(function (o) {
          return o && o.input && o.input.enabled && typeof o.emit === 'function';
        }).forEach(function (k, i) {
          var vorGold = window.LootSystem.getGold();
          var vorZahl = gemeldet.length;
          try { k.emit('pointerdown'); } catch (x) {}
          var nachGold = window.LootSystem.getGold();
          if (nachGold < vorGold) {
            kaeufe.push({ reiter: reiter, knopf: i, ausgegeben: vorGold - nachGold,
                          gemeldet: gemeldet.slice(vorZahl) });
          }
        });
      });
    } finally { qs.onSystemUsed = orig; }
    return { kaeufe: kaeufe };
  })()`);
}

test('jeder Knopf, der Gold abzieht, meldet den Kauf', () => {
  const r = alleKaeufe();
  assert.ok(!r.fehler, r.fehler);
  // Ohne Kaeufe sagt der Fall nichts — das muss auffallen.
  // Sieben: vier Traenke, zwei Rollen und ein Ausruestungsstueck. Mehr Ware
  // laesst sich nicht in einem Durchgang kaufen — nach einem Warenkauf
  // zeichnet der Reiter neu, und die restlichen erfassten Knoepfe sind hin.
  assert.ok(r.kaeufe.length >= 7,
    'nur ' + r.kaeufe.length + ' Kaeufe ausgeloest — der Fall misst zu wenig');
  // Nicht deepStrictEqual gegen []: die Liste kommt aus dem vm-Realm, ihr
  // Array-Prototyp weicht ab, und deepStrictEqual prueft den mit — der Fall
  // fiel dann mit "0 von 6 Kaeufen melden nichts".
  const stumm = Array.prototype.filter.call(r.kaeufe, (k) => k.gemeldet.length === 0);
  assert.strictEqual(stumm.length, 0,
    stumm.length + ' von ' + r.kaeufe.length + ' Kaeufen melden nichts: '
    + stumm.map((k) => k.reiter + '#' + k.knopf + ' (-' + k.ausgegeben + ' Gold)').join(', '));
});

test('beim Dungeon-Haendler zaehlt jeder Kauf auf das Haendler-Ziel', () => {
  // 'markt' allein genuegt nicht: Maras Stand meldet das auch. Der Auftrag
  // 'Der Alte mit dem Karren' haengt an 'haendler'.
  const r = alleKaeufe();
  assert.ok(!r.fehler, r.fehler);
  const ohneHaendler = Array.prototype.filter.call(r.kaeufe,
    (k) => Array.prototype.indexOf.call(k.gemeldet, 'haendler') === -1);
  assert.strictEqual(ohneHaendler.length, 0,
    ohneHaendler.length + ' Kaeufe melden kein "haendler" ('
    + ohneHaendler.map((k) => k.reiter + '#' + k.knopf).join(', ')
    + ') — der Auftrag bleibt offen');
});

test('ein Kauf beim Alten erfuellt seinen Auftrag', () => {
  // Die ganze Kette, vom Knopf bis zum Ziel.
  const r = H.run(`(function () {
    var qs = window.questSystem;
    qs.acceptQuest('einfuehrung_amulett');
    var vorher = qs.isQuestReadyToComplete('einfuehrung_amulett');
    qs.onSystemUsed('haendler');
    return { vorher: vorher, nachher: qs.isQuestReadyToComplete('einfuehrung_amulett') };
  })()`);
  assert.strictEqual(r.vorher, false, 'der Auftrag war schon vor dem Kauf abschlussreif');
  assert.strictEqual(r.nachher, true, 'der Kauf erfuellt den Auftrag nicht');
});

test('der Haendler stuerzt nicht ab, wenn die Szene schon abgebaut ist', () => {
  // spawnMerchant laedt die Textur bei Bedarf nachtraeglich und platziert den
  // Haendler erst im 'complete' des Laders. Wechselt der Spieler in der
  // Zwischenzeit den Raum oder verlaesst den Lauf, ist die Szene abgebaut und
  // Phaser hat scene.physics.add auf null gesetzt. Der Waechter prueft die
  // Fabrik mit — vorher prueft er nur scene.physics und die naechste Zeile
  // benutzte .add.sprite: ungefangener TypeError, selbst im Browser gesehen.
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var ev = window.EventSystem.EVENT_TYPES.filter(function (e) { return e.id === 'wandering_merchant'; })[0];
    var fabrik = sc.physics.add;
    sc.physics.add = null;                  // Szene im Abbau
    var fehler = null;
    try { ev.handler(sc); } catch (x) { fehler = String(x && x.message || x); }
    sc.physics.add = fabrik;
    return { fehler: fehler };
  })()`);
  assert.strictEqual(r.fehler, null,
    'der Haendler ist der abgebauten Szene ins Messer gelaufen: ' + r.fehler);
});
