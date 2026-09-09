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
      var mit = anlegen({ defId: def.id, value: LS.affixPunkte(0.10, T) }, slot);
      raus[def.id] = (mit.dps / grund.dps - 1) * 100 + (mit.ehp / grund.ehp - 1) * 100;
    });
    return raus;
  })()`);
}

// Die Affixe, deren Wirkung sich in DPS oder EHP ausdruecken laesst. Die
// uebrigen (Reichweite, Goldfund, Lebensraub, Faehigkeitsschaden) liegen auf
// eigenen Achsen und werden hier bewusst NICHT gemessen — eine erfundene
// Umrechnung waere schlechter als gar keine.
const MESSBAR = ['sharp_dmg', 'sturdy_armor', 'of_health', 'swift_speed',
  'of_precision', 'attr_strength', 'attr_dexterity', 'attr_vitality'];

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
