// tests/affixBudget.test.js — jeder Affix ist gleich viel wert (#122/#114/#104).
//
// Vorher hing der Wert eines Affixes allein an seiner eigenen Zahlenspanne.
// Gemessen ueber die abgeleiteten Werte war ein einzelner Affix zwischen 0 und
// 97 % wert:
//
//   Tiefe 20, mittlerer Wurf, Summe aus dDPS und dEHP
//     of_health      +97 %      sturdy_armor   +11 %
//     attr_vitality  +83 %      of_precision    +6 %
//     swift_speed    +20 %      29 weitere       0 %
//
// +LP war neunmal so viel wert wie Ruestung, und der Abstand WUCHS mit der
// Tiefe (63 % auf Tiefe 1, 117 % auf Tiefe 30) — weil die Zahl flach war und
// die Basis-Lebenspunkte kaum mitwachsen.
//
// Jetzt wuerfelt jeder Affix einen ANTEIL zwischen 8 und 12 Prozent, der in
// absolute Punkte fuer seine Fundtiefe umgerechnet wird. Dieser Test misst,
// was am Ende WIRKT — nicht die Zahl im Tooltip.
//
// Der Test laeuft gegen die echte Szene: recalcDerived, die Attributwirkungen
// und die Deckelungen gibt es ohne Spiel nicht.

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
 * Wirkung je Affix auf einer Tiefe, in Prozent von DPS bzw. EHP.
 *
 * Wichtig: window.equipment wird NICHT ersetzt, sondern nur befuellt — es ist
 * dasselbe Objekt wie das script-scoped `equipment` in main.js:981, und ein
 * Ersetzen kappt die Verbindung. Genau daran ist die erste Messung gescheitert
 * (sie las durchgehend Nullen).
 */
function messeAufTiefe(tiefe) {
  return H.run(`(function () {
    var LS = window.LootSystem, T = ${tiefe};
    window.DUNGEON_DEPTH = T; window.currentWave = T;
    // #114: Der Testkopf steht immer auf Stufe 1 mit 30 Lebenspunkten. Der
    // +LP-Affix rechnet aber gegen eine Referenzkurve nach TIEFE (30 + 2 * T),
    // weil er nicht davon abhaengen soll, wie viel man vorher gegrindet hat.
    // Gemessen an einem Stufe-1-Charakter auf Tiefe 30 saehe er deshalb wie
    // 30 % aus statt wie 10. Hier also ein Charakter, dessen Stufe zur Tiefe
    // passt — die Basis waechst mit +2 je Stufe (player.js:3644).
    baseStats.maxHP = 30 + 2 * (T - 1);
    function leere(){ ['weapon','offhand','head','body','boots','amulet']
      .forEach(function(k){ window.equipment[k]=null; }); }
    function werte(){
      LS.recomputeBonuses(); recalcDerived(0,0);
      var tempo = Math.max(0.2, weaponAttackSpeed || 1);
      var proSek = 1000 / Math.max(320, 650 / tempo);
      return { dps: weaponDamage * proSek * (1 + playerCritChance * 0.5),
               ehp: (window.playerMaxHealth || 30) / Math.max(0.15, 1 - playerArmor) };
    }
    // FESTE Traeger, einmal gerollt: nur die Affixliste wird getauscht, sonst
    // misst man die Streuung der Grundwerte statt den Affix.
    var fest = {
      weapon: LS.rollItem('WPN_EISENKLINGE', T, 0),
      head:   LS.rollItem('HD_KETTENHAUBE', T, 0),
      body:   LS.rollItem('BD_LEDERHARNISCH', T, 0),
      boots:  LS.rollItem('BT_LEDERSTIEFEL', T, 0)
    };
    function anlegen(affix, slot) {
      leere();
      ['weapon','head','body','boots'].forEach(function (s) { window.equipment[s] = fest[s]; });
      if (affix) { fest[slot].affixes = [affix]; }
      var w = werte();
      fest[slot].affixes = [];
      return w;
    }
    var grund = anlegen(null, 'weapon');
    var raus = {};
    LS.AFFIX_DEFS.forEach(function (def) {
      var slot = (def.appliesTo && def.appliesTo.length) ? def.appliesTo[0] : 'body';
      if (['weapon','head','body','boots'].indexOf(slot) < 0) slot = 'body';
      // affixWert liefert die Zahl in der Einheit, die DIESER Affix braucht —
      // fuer Lebenspunkte eine flache Zahl, sonst Punkte. Ohne den Helfer
      // fuetterte die Messung Punkte in einen flachen Affix und las 34 %.
      var mit = anlegen({ defId: def.id, value: LS.affixWert(def, 0.10, T) }, slot);
      raus[def.id] = (mit.dps / grund.dps - 1) * 100 + (mit.ehp / grund.ehp - 1) * 100;
    });
    baseStats.maxHP = 30;
    return raus;
  })()`);
}

// Die Affixe, deren Wirkung sich in DPS oder EHP ausdruecken laesst. Die
// uebrigen (Reichweite, Goldfund, Lebensraub, Faehigkeitsschaden) liegen auf
// eigenen Achsen und werden hier bewusst NICHT gemessen — eine erfundene
// Umrechnung waere schlechter als gar keine.
//
// Die ATTRIBUTE stehen bewusst nicht in dieser Liste. Sie haben zwei
// Wirkungen, und bei Geschick liegen beide auf der DPS-Achse (Tempo als
// Primaeres, Krit als Zweites): zusammen misst es 13,6 % statt 10. Das ist so
// gewollt — vereinbart war, dass die PRIMAERwirkung gleich viele Punkte
// kostet, nicht die Summe. Sie werden deshalb weiter unten ueber die
// Punktzahl geprueft, nicht ueber DPS und EHP.
const MESSBAR = ['swift_speed', 'sturdy_armor', 'of_health', 'swift_speed',
  'of_precision'];

test('Jeder messbare Affix liegt bei rund 10 % — keiner ragt heraus', () => {
  const m = messeAufTiefe(20);
  const ausreisser = [];
  MESSBAR.forEach((id) => {
    const w = m[id];
    assert.strictEqual(typeof w, 'number', id + ' wurde nicht gemessen');
    // Spanne 7 bis 13: der Wurf selbst liegt zwischen 8 und 12, dazu kommt die
    // Rundung der abgeleiteten Werte (Lebenspunkte sind ganzzahlig).
    if (!(w >= 7 && w <= 13)) ausreisser.push(id + ' ' + w.toFixed(1) + ' %');
  });
  assert.strictEqual(ausreisser.length, 0,
    'ausserhalb von 7-13 %: ' + ausreisser.join(', '));
});

test('Der Abstand zwischen staerkstem und schwaechstem Affix ist klein', () => {
  // Das ist die eigentliche Klage: +LP war NEUNMAL so viel wert wie Ruestung.
  const m = messeAufTiefe(20);
  const werte = MESSBAR.map((id) => m[id]);
  const hoch = Math.max.apply(null, werte), tief = Math.min.apply(null, werte);
  assert.ok(hoch / tief < 1.6,
    'Verhaeltnis staerkster/schwaechster ist ' + (hoch / tief).toFixed(2)
    + ' (' + tief.toFixed(1) + ' bis ' + hoch.toFixed(1) + ' %) — vorher waren es 9');
});

test('Alle vier Attribute brauchen gleich viele Punkte fuer dieselbe Wirkung', () => {
  // Vorher kostete dieselbe Primaerwirkung von 10 % je nach Attribut 10, 25,
  // 20 oder 11 Punkte — "+25 Geschick" klang nach mehr als "+10 Staerke" und
  // war dasselbe. Jetzt geben alle vier 1 % je Punkt.
  const r = H.run(`(function () {
    var LS = window.LootSystem, raus = {};
    ['attr_strength', 'attr_dexterity', 'attr_vitality', 'attr_focus'].forEach(function (id) {
      var def = LS.AFFIX_DEFS.find(function (d) { return d.id === id; });
      raus[id] = {};
      [1, 10, 20, 30].forEach(function (t) {
        raus[id][t] = LS.affixWirkung(def, LS.affixPunkte(0.10, t), t);
      });
    });
    return raus;
  })()`);
  const ids = ['attr_strength', 'attr_dexterity', 'attr_vitality', 'attr_focus'];
  ids.forEach((id) => {
    [1, 10, 20, 30].forEach((t) => {
      const p = r[id][t];
      assert.ok(Math.abs(p - 10) < 0.01,
        id + ' auf Tiefe ' + t + ': ' + p.toFixed(1) + ' Punkte, erwartet 10');
    });
  });
});

test('#114: Vitalitaet gibt im SPIEL feste Lebenspunkte, die nicht mit der Tiefe fallen', () => {
  // Dieser Test greift ueber recalcDerived, nicht ueber LootSystem allein.
  // Grund: die Umrechnung Punkte -> Lebenspunkte sitzt in inventory.js, und
  // eine Messung nur am LootSystem haette den Konsumenten offen gelassen —
  // gemutiert (getBonus('vitality') statt getBonus('vitality_hp')) lief die
  // ganze Suite gruen durch.
  const r = H.run(`(function () {
    var LS = window.LootSystem, T = 10;
    var def = LS.AFFIX_DEFS.find(function (d) { return d.id === 'attr_vitality'; });
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function (k) { window.equipment[k] = null; });
    var stueck = LS.rollItem('BD_LEDERHARNISCH', T, 0);
    stueck.affixes = [];
    window.equipment.body = stueck;
    function maxLp() { LS.recomputeBonuses(); recalcDerived(0, 0); return window.playerMaxHealth || 0; }
    var raus = {};
    [10, 20, 30].forEach(function (t) {
      window.DUNGEON_DEPTH = t; window.currentWave = t;
      stueck.affixes = [];               var ohne = maxLp();
      stueck.affixes = [{ defId: 'attr_vitality', value: LS.affixWert(def, 0.10, T) }];
      raus[t] = maxLp() - ohne;
    });
    stueck.affixes = [];
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function (k) { window.equipment[k] = null; });
    return raus;
  })()`);
  assert.ok(r['10'] > 0, 'Vitalitaet gibt gar keine Lebenspunkte mehr');
  assert.strictEqual(r['20'], r['10'],
    'der Zuwachs faellt mit der Tiefe: ' + r['10'] + ' -> ' + r['20']);
  assert.strictEqual(r['30'], r['10'],
    'der Zuwachs faellt mit der Tiefe: ' + r['10'] + ' -> ' + r['30']);
});

test('Attributpunkte fallen mit der Tiefe ab wie alles andere', () => {
  const r = H.run(`(function () {
    var LS = window.LootSystem;
    var def = LS.AFFIX_DEFS.find(function (d) { return d.id === 'attr_strength'; });
    var punkte = LS.affixPunkte(0.10, 10);   // auf Tiefe 10 gefunden
    var raus = {};
    [10, 20, 30].forEach(function (t) { raus[t] = LS.affixWirkung(def, punkte, t); });
    return raus;
  })()`);
  assert.ok(Math.abs(r['10'] - 10) < 0.01, 'auf der Fundtiefe erwartet 10 Punkte');
  assert.ok(r['20'] < r['10'] * 0.7, 'auf Tiefe 20 faellt es zu wenig ab: ' + r['20'].toFixed(1));
  assert.ok(r['30'] < r['20'], 'es faellt nicht weiter');
  assert.ok(r['30'] > 0, 'es soll abfallen, nicht verschwinden');
});

test('Der Wert bleibt ueber alle Tiefen gleich, wenn die Ausruestung mitwaechst', () => {
  // Punkt 2 der Vorgabe: absolute Zahlen wachsen mit der Tiefe. Punkt 3: die
  // Umrechnung faellt im selben Mass. Zusammen heisst das: wer aktuell bleibt,
  // merkt von beidem nichts.
  const je = {};
  [1, 10, 30].forEach((t) => { je[t] = messeAufTiefe(t); });
  const ausreisser = [];
  MESSBAR.forEach((id) => {
    [1, 10, 30].forEach((t) => {
      const w = je[t][id];
      if (!(w >= 6 && w <= 14)) ausreisser.push(id + ' auf Tiefe ' + t + ': ' + w.toFixed(1) + ' %');
    });
  });
  assert.strictEqual(ausreisser.length, 0, ausreisser.join(' | '));
});

test('Ein Stueck von weiter oben faellt mit der Tiefe ab', () => {
  const r = H.run(`(function () {
    var LS = window.LootSystem;
    function leere(){ ['weapon','offhand','head','body','boots','amulet']
      .forEach(function(k){ window.equipment[k]=null; }); }
    leere();
    var helm = LS.rollItem('HD_KETTENHAUBE', 5, 0);
    helm.affixes = [{ defId: 'sturdy_armor', value: LS.affixPunkte(0.10, 5) }];
    window.equipment.head = helm;
    var raus = {};
    [5, 10, 20, 30].forEach(function (t) {
      window.DUNGEON_DEPTH = t; window.currentWave = t;
      LS.recomputeBonuses();
      raus[t] = LS.getBonus('armor');
    });
    return raus;
  })()`);
  // Auf der Fundtiefe voll, danach fallend — (5+3)/(T+3).
  assert.ok(Math.abs(r['5'] - 0.09) < 1e-6, 'auf Tiefe 5 erwartet 0,09, war ' + r['5']);
  // Ruestung ist ein abstrakter Wert und faellt deshalb ab. Lebenspunkte nicht
  // — die haben ihren eigenen Test weiter unten.
  assert.ok(r['10'] < r['5'] * 0.7, 'auf Tiefe 10 faellt es zu wenig ab');
  assert.ok(r['20'] < r['5'] * 0.4, 'auf Tiefe 20 faellt es zu wenig ab');
  assert.ok(r['30'] < r['20'], 'es faellt nicht weiter');
  assert.ok(r['30'] > 0, 'es soll abfallen, nicht verschwinden');
});

// ---------------------------------------------------------------------------
// Punkt 4 der Vorgabe: rund 90 % der gezogenen Affixe sollen JEDEM Charakter
// etwas bringen, rund 10 % an eine bestimmte Faehigkeit gebunden sein.
//
// Vorher waren es 31 bis 59 % faehigkeitsspezifisch — auf der Waffe war es
// wahrscheinlicher, einen Affix fuer eine Faehigkeit zu ziehen, die man
// vielleicht gar nicht gewaehlt hat, als einen, der immer wirkt.
//
// Der Anteil laesst sich nicht je Platz exakt einstellen: die Gewichte sind
// fest, aber welche Affixe ueberhaupt in Frage kommen, haengt am Platz. Die
// Waffe hat die meisten faehigkeitsgebundenen zur Auswahl und liegt deshalb
// oben, die Stiefel unten. Gemessen mit Gewicht 6: 14,2 / 8,8 / 9,9 / 4,8 %,
// im Mittel 9,4 %.
// ---------------------------------------------------------------------------

const { test: test2 } = require('node:test');

test2('Rund 90 % der gezogenen Affixe wirken fuer jeden Charakter', () => {
  const r = H.run(`(function () {
    var LS = window.LootSystem;
    var spez = {};
    LS.AFFIX_DEFS.forEach(function (d) {
      if (/^(dmg_|cd_)/.test(d.statKey) && d.statKey.indexOf('all_abilities') < 0) spez[d.id] = true;
    });
    var raus = {}, gesamt = 0, gesamtSpez = 0;
    ['weapon', 'head', 'body', 'boots'].forEach(function (slot) {
      var n = 0, s = 0;
      for (var i = 0; i < 8000; i++) {
        LS.rollAffixes(20, 1, Math.random, slot).forEach(function (a) {
          n++; if (spez[a.defId]) s++;
        });
      }
      raus[slot] = 100 * s / n; gesamt += n; gesamtSpez += s;
    });
    raus.mittel = 100 * gesamtSpez / gesamt;
    return raus;
  })()`);

  assert.ok(r.mittel >= 7 && r.mittel <= 13,
    'ueber alle Plaetze ' + r.mittel.toFixed(1) + ' % faehigkeitsspezifisch, erwartet rund 10');
  // Je Platz darf es streuen, aber nicht zurueck in die alte Groessenordnung.
  ['weapon', 'head', 'body', 'boots'].forEach((slot) => {
    assert.ok(r[slot] < 20,
      slot + ': ' + r[slot].toFixed(1) + ' % faehigkeitsspezifisch — vorher waren es bis 59 %');
  });
});

// ---------------------------------------------------------------------------
// #104: Auch die GRUNDwerte der Ruestung sind jetzt tiefenabhaengig.
//
// Vorher trugen sie feste Zahlen (Kettenhaube armor: 5, Plattenpanzer
// armor: 15). Ein Stueck von Tiefe 1 war auf Tiefe 30 damit genauso gut wie
// ein frisches — und die Basen wuchsen nie mit.
//
// Jetzt: ein Zielanteil je Machtwert, gewuerfelt in einem Band von 80 bis
// 120 %, in Punkte fuer die Fundtiefe umgerechnet und beim Tragen mit der
// AKTUELLEN Tiefe zurueckgerechnet.
//
// NICHT umgestellt sind Tempo und Reichweite: sie sind die EIGENART einer
// Basis (das Minus der Glutaxt aufs Tempo), nicht ihre Macht. Mit der Tiefe
// verrechnet wuerden alle Basen gleich.
// ---------------------------------------------------------------------------

test2('#104: Ruestungsbasen wuerfeln in einem Band, und das Band waechst mit der Tiefe', () => {
  const r = H.run(`(function () {
    var LS = window.LootSystem, raus = {};
    [1, 10, 30].forEach(function (t) {
      var lo = 1e9, hi = -1e9;
      for (var i = 0; i < 300; i++) {
        var it = LS.rollItem('BD_PLATTENPANZER', t, 0);
        if (it.armor < lo) lo = it.armor;
        if (it.armor > hi) hi = it.armor;
      }
      raus[t] = { lo: lo, hi: hi };
    });
    return raus;
  })()`);
  [1, 10, 30].forEach((t) => {
    assert.ok(r[t].hi > r[t].lo * 1.2,
      'Tiefe ' + t + ': das Band ist zu eng (' + r[t].lo + ' bis ' + r[t].hi + ')');
  });
  assert.ok(r['10'].lo > r['1'].hi, 'Tiefe 10 wuerfelt nicht ueber Tiefe 1');
  assert.ok(r['30'].lo > r['10'].hi, 'Tiefe 30 wuerfelt nicht ueber Tiefe 10');
});

test2('#104: ein Satz der passenden Tiefe ist ueberall gleich stark', () => {
  const r = H.run(`(function () {
    var LS = window.LootSystem, raus = {};
    [1, 10, 20, 30].forEach(function (t) {
      window.DUNGEON_DEPTH = t; window.currentWave = t;
      ['weapon','offhand','head','body','boots','amulet']
        .forEach(function(k){ window.equipment[k]=null; });
      window.equipment.head  = LS.rollItem('HD_BRONZEHELM', t, 0);
      window.equipment.body  = LS.rollItem('BD_PLATTENPANZER', t, 0);
      window.equipment.boots = LS.rollItem('BT_STAHLSOHLEN', t, 0);
      LS.recomputeBonuses(); recalcDerived(0, 0);
      raus[t] = playerArmor;
    });
    return raus;
  })()`);
  const werte = [1, 10, 20, 30].map((t) => r[t]);
  const hoch = Math.max.apply(null, werte), tief = Math.min.apply(null, werte);
  assert.ok(hoch / tief < 1.35,
    'die Ruestung eines passenden Satzes schwankt zu stark ueber die Tiefen: '
    + werte.map((x) => Math.round(x * 100) + ' %').join(' / '));
});

test2('#104: ein alter Satz faellt mit der Tiefe ab', () => {
  const r = H.run(`(function () {
    var LS = window.LootSystem;
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function(k){ window.equipment[k]=null; });
    window.equipment.head  = LS.rollItem('HD_BRONZEHELM', 5, 0);
    window.equipment.body  = LS.rollItem('BD_PLATTENPANZER', 5, 0);
    window.equipment.boots = LS.rollItem('BT_STAHLSOHLEN', 5, 0);
    var raus = {};
    [5, 10, 20, 30].forEach(function (t) {
      window.DUNGEON_DEPTH = t; window.currentWave = t;
      LS.recomputeBonuses(); recalcDerived(0, 0);
      raus[t] = playerArmor;
    });
    return raus;
  })()`);
  assert.ok(r['10'] < r['5'] * 0.75, 'auf Tiefe 10 faellt der alte Satz zu wenig ab');
  assert.ok(r['20'] < r['5'] * 0.45, 'auf Tiefe 20 faellt er zu wenig ab');
  assert.ok(r['30'] > 0, 'er soll abfallen, nicht verschwinden');
});

test2('#122: der Gegenstands-Tooltip zeigt die absolute Punktzahl, ohne Prozentzeichen', () => {
  // Der Tooltip vergleicht zwei FUNDE; die aktuelle Tiefe darf da nicht
  // hineinspielen. Was die Punkte hier bewirken, steht im Charakterbogen.
  const r = H.run(`(function () {
    var LS = window.LootSystem;
    window.DUNGEON_DEPTH = 20; window.currentWave = 20;
    var punkte = Math.round(LS.affixPunkte(0.10, 20) * 10) / 10;
    var raus = {};
    ['swift_speed', 'sturdy_armor', 'of_health'].forEach(function (id) {
      var def = LS.AFFIX_DEFS.find(function (d) { return d.id === id; });
      raus[id] = LS.getAffixTooltipText(def, punkte);
    });
    raus.punkte = punkte;
    return raus;
  })()`);
  ['swift_speed', 'sturdy_armor', 'of_health'].forEach((id) => {
    assert.ok(r[id].indexOf(String(r.punkte)) >= 0,
      id + ': die Punktzahl ' + r.punkte + ' steht nicht im Tooltip — "' + r[id] + '"');
    assert.strictEqual(r[id].indexOf('%'), -1,
      id + ': ein Prozentzeichen hinter einer Punktzahl waere falsch — "' + r[id] + '"');
  });
});

test2('#122: der Bogen zeigt den Wirkwert und die Punkte vom Stueck daneben', () => {
  // Die oberen Zeilen zeigen beides: "16% (36.3 Pkt.)". Vorn, was der Wert
  // BEWIRKT; in Klammern die Punkte, die auf der Ausruestung stehen — dieselbe
  // Zahl wie im Tooltip, also unmittelbar vergleichbar.
  //
  // Die Attributzeilen zeigen NUR die Punkte, weil dort die Wirkung eine
  // Zeile tiefer ausgeschrieben steht ("+5 Max-LP").
  const r = H.run(`(function () {
    var LS = window.LootSystem;
    window.DUNGEON_DEPTH = 20; window.currentWave = 20;
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function(k){ window.equipment[k]=null; });
    // Die Traeger sind so gewaehlt, dass JEDE der fuenf Zeilen Punkte hat:
    // Schlangenmaske bringt Krit, Windlaeufer Lauftempo, Plattenpanzer
    // Ruestung, die Eisenklinge unten Tempo und Reichweite.
    window.equipment.head  = LS.rollItem('HD_SCHLANGENMASKE', 20, 1);
    window.equipment.body  = LS.rollItem('BD_PLATTENPANZER', 20, 1);
    window.equipment.boots = LS.rollItem('BT_WINDLAEUFER', 20, 1);
    // Eine Waffe mit Reichweitenaffix: ohne sie steht die Reichweite auf
    // glatten 100, und ob gerundet wird oder nicht, sieht man nicht.
    var waffe = LS.rollItem('WPN_EISENKLINGE', 20, 1);
    waffe.affixes = [{ defId: 'of_reach', value: LS.affixWert('of_reach', 0.10, 20) },
                     { defId: 'swift_speed', value: LS.affixWert('swift_speed', 0.10, 20) }];
    window.equipment.weapon = waffe;
    LS.recomputeBonuses(); recalcDerived(0, 0);
    var sc = window.game.scene.getScene('GameScene');
    window.HUDv2.openStats(sc);
    var zeilen = [];
    (function geh(o) {
      if (!o) return;
      if (o.type === 'Text') zeilen.push(String(o.text));
      if (o.list) o.list.forEach(geh);
    })(window.HUDv2._statsInhalt || { list: [] });
    if (window.HUDv2._statsContainer) window.HUDv2._statsContainer.close();
    return zeilen;
  })()`);
  const ruestung = r[r.indexOf('Rüstung:') + 1];
  assert.ok(/^[0-9]+%\s+\([0-9.]+ Pkt\.\)$/.test(ruestung || ''),
    'die Ruestungszeile zeigt nicht Prozent UND Punkte: "' + ruestung + '"');
  const reichweite = r[r.indexOf('Reichweite:') + 1];
  assert.ok(/^[0-9]+(\s|$)/.test(reichweite || ''),
    'die Reichweite zeigt Nachkommastellen: "' + reichweite + '"');
  ['Angriffstempo:', 'Krit. Chance:', 'Lauftempo:'].forEach((L) => {
    const z = r[r.indexOf(L) + 1];
    assert.ok((z || '').indexOf('Pkt.') > 0, L + ' zeigt keine Punkte: "' + z + '"');
  });
  // Die Fusszeile ueber die Tiefenumrechnung ist weg: sie erklaerte eine
  // Darstellung, die es nicht mehr gibt.
  assert.ok(!r.some((z) => z.indexOf('wirken je nach Tiefe') >= 0),
    'die Fusszeile ueber die Tiefe steht wieder im Bogen');
});

test('Die Lebensregeneration aus Vitalitaet ersetzt keine Traenke', () => {
  // Sie lag bei 0,1 LP/s je Punkt. Zwei tiefengerechte Vitalitaetsstuecke
  // geben 20 Punkte, also 2 LP/s auf einen Vorrat von 32 bis 90 — ein voller
  // Balken in 16 bis 45 Sekunden. Der kleinste Heiltrank gibt 30 % in drei
  // Sekunden; die Regeneration war damit ein Dauertrank.
  //
  // Der Test misst gegen den TRANK, nicht gegen eine feste Zahl: eine Grenze
  // wie "unter 0,5 LP/s" saehe hier gleich aus, sagte aber nichts darueber,
  // ob sie noch im Verhaeltnis steht.
  const r = H.run(`(function () {
    var LS = window.LootSystem;
    var def = LS.AFFIX_DEFS.find(function (d) { return d.id === 'attr_vitality'; });
    var raus = {};
    [1, 10, 30].forEach(function (t) {
      window.DUNGEON_DEPTH = t; window.currentWave = t;
      ['weapon','offhand','head','body','boots','amulet']
        .forEach(function (k) { window.equipment[k] = null; });
      var wert = LS.affixWert(def, 0.10, t);
      ['body', 'head'].forEach(function (s) {
        var it = LS.rollItem(s === 'body' ? 'BD_LEDERHARNISCH' : 'HD_KETTENHAUBE', t, 0);
        it.affixes = [{ defId: 'attr_vitality', value: wert }];
        window.equipment[s] = it;
      });
      LS.recomputeBonuses(); recalcDerived(0, 0);
      raus[t] = { regen: window.PLAYER_HEALTH_REGEN || 0,
                  maxLp: window.playerMaxHealth || 0 };
    });
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function (k) { window.equipment[k] = null; });
    return raus;
  })()`);
  [1, 10, 30].forEach((t) => {
    const a = r[t];
    assert.ok(a.regen > 0, 'Tiefe ' + t + ': Vitalitaet regeneriert gar nicht mehr');
    // Ein kleiner Trank gibt 30 % des Vorrats in 3 s. Die Regeneration soll
    // deutlich darunter liegen — gemessen sind es 11 % auf Tiefe 1 und 4 %
    // auf Tiefe 30, weil der Vorrat waechst und die Rate flach bleibt.
    const trankProSek = a.maxLp * 0.30 / 3;
    assert.ok(a.regen < trankProSek * 0.15,
      'Tiefe ' + t + ': ' + a.regen.toFixed(2) + ' LP/s sind '
      + (100 * a.regen / trankProSek).toFixed(0) + ' % der Trankheilung je Sekunde');
    // Und ein voller Balken soll laenger dauern als ein Raum.
    assert.ok(a.maxLp / a.regen > 60,
      'Tiefe ' + t + ': voller Balken in ' + (a.maxLp / a.regen).toFixed(0) + ' s');
  });
});

test('Geschick gibt Krit als ZWEITwirkung, nicht als zweite Hauptquelle', () => {
  // Geschick lief neben seiner Primaerwirkung (Angriffstempo, 1 % je Punkt)
  // mit 0,67 % Krit je Punkt auch noch als zweitbeste Kritquelle mit. Jetzt
  // 80 % davon.
  //
  // Der Test misst gegen das TEMPO, nicht gegen eine feste Zahl: das Verhaeltnis
  // der beiden Wirkungen ist die Aussage, die absolute Zahl nur ihre Folge.
  const r = H.run(`(function () {
    var LS = window.LootSystem;
    window.DUNGEON_DEPTH = 20; window.currentWave = 20;
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function (k) { window.equipment[k] = null; });
    var def = LS.AFFIX_DEFS.find(function (d) { return d.id === 'attr_dexterity'; });
    var it = LS.rollItem('BT_LEDERSTIEFEL', 20, 0);
    it.affixes = [{ defId: 'attr_dexterity', value: LS.affixWert(def, 0.10, 20) }];
    window.equipment.boots = it;
    LS.recomputeBonuses(); recalcDerived(0, 0);
    var raus = { punkte: window.playerDexterity, krit: window.playerDexCrit };
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function (k) { window.equipment[k] = null; });
    return raus;
  })()`);
  assert.ok(r.punkte > 0, 'Testaufbau: kein Geschick angelegt');
  const jePunkt = r.krit / r.punkte;
  // Primaerwirkung ist 1 % Tempo je Punkt. Krit soll gut die Haelfte davon sein.
  assert.ok(jePunkt > 0.004 && jePunkt < 0.006,
    'Krit je Geschickpunkt liegt bei ' + (jePunkt * 100).toFixed(3) + ' %');
  assert.ok(Math.abs(jePunkt / 0.0067 - 0.8) < 0.05,
    'das sind ' + (100 * jePunkt / 0.0067).toFixed(0) + ' % der alten Kurve, erwartet rund 80');
});

test('Anzeige und Wirkung des Geschick-Krits lesen dieselbe Zahl', () => {
  // Derselbe Fehler wie bei der Regeneration: der Faktor stand doppelt im
  // Code, einmal in recalcDerived und einmal im Charakterbogen.
  const inv = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'inventory.js'), 'utf8');
  const hud = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'hudV2.js'), 'utf8');
  assert.ok(/DEX_KRIT_JE_PUNKT/.test(inv), 'die Konstante fehlt in inventory.js');
  assert.ok(/playerDexCrit/.test(hud),
    'der Charakterbogen rechnet den Geschick-Krit selbst aus statt ihn zu lesen');
  assert.ok(!/_d * 0.67/.test(hud),
    'im Charakterbogen steht noch eine zweite Kopie des Faktors');
});

test('Anzeige und Wirkung der Regeneration lesen dieselbe Zahl', () => {
  // Die 0,1 standen doppelt im Code — einmal in recalcDerived, einmal im
  // Charakterbogen. Beim Nachziehen waere nur eine der beiden mitgekommen.
  const inv = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'inventory.js'), 'utf8');
  const hud = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'hudV2.js'), 'utf8');
  assert.ok(/VIT_REGEN_JE_PUNKT\s*=\s*[0-9.]+/.test(inv),
    'die Konstante fehlt in inventory.js');
  assert.ok(/playerVitalityRegen/.test(hud),
    'der Charakterbogen rechnet die Regeneration selbst aus statt sie zu lesen');
  assert.ok(!/_v \* 0\.1/.test(hud),
    'im Charakterbogen steht noch eine zweite Kopie des Faktors');

  // Und die Spiegelung muss WIRKLICH stattfinden: eine Quelltextpruefung
  // allein liess sich austricksen, indem man die Zeile in recalcDerived
  // loeschte — der Bogen las dann undefined und zeigte 0,00.
  const g = H.run(`(function () {
    var LS = window.LootSystem;
    window.DUNGEON_DEPTH = 10; window.currentWave = 10;
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function (k) { window.equipment[k] = null; });
    var def = LS.AFFIX_DEFS.find(function (d) { return d.id === 'attr_vitality'; });
    var it = LS.rollItem('BD_LEDERHARNISCH', 10, 0);
    it.affixes = [{ defId: 'attr_vitality', value: LS.affixWert(def, 0.10, 10) }];
    window.equipment.body = it;
    LS.recomputeBonuses(); recalcDerived(0, 0);
    var raus = { angezeigt: window.playerVitalityRegen, gewirkt: window.PLAYER_HEALTH_REGEN };
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function (k) { window.equipment[k] = null; });
    return raus;
  })()`);
  assert.ok(g.gewirkt > 0, 'Testaufbau: die Vitalitaet regeneriert gar nicht');
  assert.strictEqual(g.angezeigt, g.gewirkt,
    'der Bogen zeigt ' + g.angezeigt + ' LP/s, gewirkt werden ' + g.gewirkt);
});

test('#104: die Attributzeile zeigt die Punkte vom Stueck, nicht die Umrechnung', () => {
  // Gemeldet: "+7,5 Vitalitaet" im Tooltip, "18.75" im Charaktermenue. Die
  // Zahl stimmte — ein Stueck von Tiefe 5 wirkt auf Tiefe 1 staerker —, aber
  // die umgerechnete Punktzahl ist eine Zwischengroesse, die fuer sich
  // genommen nichts aussagt. In der Zeile steht deshalb dieselbe Zahl wie im
  // Tooltip; was sie bewirkt, sagt die Beschreibung darunter in Einheiten,
  // die man kennt.
  const r = H.run(`(function () {
    var LS = window.LootSystem;
    window.DUNGEON_DEPTH = 1; window.currentWave = 1;
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function(k){ window.equipment[k]=null; });
    var def = LS.AFFIX_DEFS.find(function (d) { return d.id === 'attr_vitality'; });
    var stueck = LS.rollItem('BD_LEDERHARNISCH', 5, 0);
    stueck.affixes = [{ defId: 'attr_vitality', value: 7.5 }];
    window.equipment.body = stueck;
    LS.recomputeBonuses(); recalcDerived(0, 0);
    var sc = window.game.scene.getScene('GameScene');
    window.HUDv2.openStats(sc);
    var zeilen = [];
    (function geh(o) {
      if (!o) return;
      if (o.type === 'Text') zeilen.push(String(o.text));
      if (o.list) o.list.forEach(geh);
    })(window.HUDv2._statsInhalt || { list: [] });
    if (window.HUDv2._statsContainer) window.HUDv2._statsContainer.close();
    ['weapon','offhand','head','body','boots','amulet']
      .forEach(function(k){ window.equipment[k]=null; });
    return { zeilen: zeilen, punkte: window.playerVitality };
  })()`);
  // 7,5 Punkte auf Tiefe 1: 7,5 / (10 * (1+3)) * 100 = 18,75.
  assert.ok(Math.abs(r.punkte - 18.75) < 0.01,
    'Testannahme verfehlt: gemessen wurden ' + r.punkte + ' statt 18,75 Punkte');
  const zeile = r.zeilen.find((z) => z.indexOf('7.5 Pkt.') === 0 || z.indexOf('7,5 Pkt.') === 0);
  assert.ok(zeile,
    'keine Attributzeile mit den 7,5 Punkten vom Stueck: '
    + JSON.stringify(r.zeilen.slice(0, 30)));
  assert.ok(zeile.indexOf('18.8') < 0 && zeile.indexOf('18.75') < 0,
    'die umgerechnete Punktzahl steht noch in der Zeile: ' + zeile);
  // Die WIRKUNG bleibt sichtbar — nur eben in Lebenspunkten statt in Punkten.
  const wirkung = r.zeilen.find((z) => z.indexOf('Max-LP') >= 0);
  assert.ok(wirkung, 'die Wirkzeile unter dem Attribut fehlt: '
    + JSON.stringify(r.zeilen.slice(0, 30)));
});
