/**
 * tools/ruestungsquellen.js — woher kommt die Ruestung?
 *
 * Liest die Ruestung Schicht fuer Schicht aus dem LAUFENDEN Spiel und zeigt,
 * welcher Anteil aus der Ausruestung, aus den Affixen und aus welchem
 * Buff-Stapel kommt. Gedacht fuer #152 (Ruestung erreicht den 85-%-Deckel zu
 * frueh), taugt aber fuer jede Balance-Frage an derselben Zahl.
 *
 * Warum am laufenden Spiel und nicht nachgerechnet: recalcDerived setzt
 * playerArmor in SECHS Schritten (Basis + Affixe, dann vier Buff-Schichten),
 * und jeder Schritt klemmt erneut bei 0,85. Eine nachgebaute Rechnung wuerde
 * genau diese Klemmung uebersehen — bei 85 % ist der Deckel ja der Punkt.
 *
 * Aufruf:
 *   node tools/ruestungsquellen.js                  aktueller Spielstand
 *   node tools/ruestungsquellen.js 10 3 5           Tiefe 10, legendaer, Baumrang 5
 *   node tools/ruestungsquellen.js 10 3 5 40        dazu 40 Saetze fuer den Schnitt
 *
 * Seltenheit: 0 gewoehnlich, 1 magisch, 2 selten, 3 legendaer.
 */
const { launch } = require('./headless/index.js');

const [, , argTiefe, argStufe, argBaum, argSaetze] = process.argv;
const TIEFE = Number(argTiefe) || 10;
const STUFE = argStufe === undefined ? null : Number(argStufe);
const BAUM = Number(argBaum) || 0;
const SAETZE = Number(argSaetze) || 1;
const NAMEN = ['gewoehnlich', 'magisch', 'selten', 'legendaer'];

/**
 * Liest die Ruestung an den sechs Stellen, an denen recalcDerived sie setzt.
 *
 * Der Trick: jede Buff-Schicht wird einmal einzeln abgeschaltet und
 * recalcDerived neu gerufen. Die Differenz ist ihr echter Beitrag — inklusive
 * dessen, was die Klemmung ihr wegnimmt. Deshalb koennen die Beitraege in
 * Summe kleiner sein als der Endwert: was ueber den Deckel ragt, zaehlt nicht.
 */
const AUSLESEN = `(function () {
  function jetzt() {
    if (typeof recalcDerived === 'function') recalcDerived(0, 0);
    return (typeof playerArmor !== 'undefined' ? playerArmor : 0);
  }

  var voll = jetzt();

  // Beitrag je Schicht: einmal ohne sie rechnen.
  var schichten = [
    ['Ereignis-Buffs',  'eventBuffs'],
    ['Brunnen',         'brunnenBuffs'],
    ['Tiefen-Buffs',    'tiefenBuffs'],
    ['Wissensbaum',     'knowledgeTreeBuffs']
  ];
  var beitrag = {};
  schichten.forEach(function (s) {
    var merk = window[s[1]];
    window[s[1]] = null;
    beitrag[s[0]] = Math.round((voll - jetzt()) * 1000) / 10;
    window[s[1]] = merk;
  });

  // Ausruestung: einmal ohne alles am Koerper.
  var merkAus = {};
  ['weapon', 'offhand', 'head', 'body', 'boots'].forEach(function (sl) {
    merkAus[sl] = window.equipment ? window.equipment[sl] : null;
    if (window.equipment) window.equipment[sl] = null;
  });
  var ohneAlles = jetzt();
  ['weapon', 'offhand', 'head', 'body', 'boots'].forEach(function (sl) {
    if (window.equipment) window.equipment[sl] = merkAus[sl];
  });
  jetzt();

  // Je Platz: Grundwert und Affixanteil getrennt.
  var plaetze = [];
  ['weapon', 'offhand', 'head', 'body', 'boots'].forEach(function (sl) {
    var it = window.equipment ? window.equipment[sl] : null;
    if (!it) { plaetze.push({ platz: sl, leer: true }); return; }
    var grund = (it.baseStats && it.baseStats.armor) || 0;
    // Ein Affix am Stueck traegt NUR { defId, value }. Welchen Wert er
    // beeinflusst, steht in AFFIX_DEFS — ohne diesen Umweg findet man keinen
    // einzigen Ruestungsaffix, und das Werkzeug meldet stumm 0.
    var DEFS = (window.LootSystem && window.LootSystem.AFFIX_DEFS) || [];
    var affix = 0;
    var affixNamen = [];
    (it.affixes || []).forEach(function (a) {
      if (!a) return;
      var def = null;
      for (var d = 0; d < DEFS.length; d++) {
        if (DEFS[d] && DEFS[d].id === a.defId) { def = DEFS[d]; break; }
      }
      if (!def || (def.statKey || '').indexOf('armor') < 0) return;
      affix += (a.value || 0);
      affixNamen.push(def.id);
    });
    // Ruestung steht auf dem Stueck als absolute PUNKTE (#104). Was sie auf der
    // aktuellen Tiefe bewirkt, rechnet LootSystem.basiswertWirkung aus — genau
    // diese Umrechnung laesst altes Zeug von selbst abfallen. Beides zeigen:
    // die Punkte, die im Tooltip stehen, und den Anteil, der ankommt.
    var LS2 = window.LootSystem;
    var wirkung = (LS2 && typeof LS2.basiswertWirkung === 'function')
      ? LS2.basiswertWirkung('armor', it.armor || 0) : (it.armor || 0);
    plaetze.push({
      platz: sl, leer: false,
      name: (window.LootSystem && window.LootSystem.composeName)
        ? window.LootSystem.composeName(it) : (it.name || '?'),
      affixNamen: affixNamen,
      punkte: Math.round((it.armor || 0) * 10) / 10,
      wirkung: Math.round(wirkung * 1000) / 10,
      grund: Math.round(grund * 10) / 10,
      affix: Math.round(affix * 10) / 10
    });
  });

  // Affixe landen NICHT auf it.armor, sondern in einem eigenen Topf, den
  // LootSystem.recomputeBonuses fuellt und den recalcDerived als zweiten
  // Summanden addiert (inventory.js: playerArmor + _gb('armor')). Wer nur die
  // Punkte der Stuecke zaehlt, uebersieht die groessere Haelfte.
  var LS3 = window.LootSystem;
  var affixTopf = (LS3 && typeof LS3.getBonus === 'function') ? (LS3.getBonus('armor') || 0) : 0;

  var kb = window.knowledgeTreeBuffs || {};
  return {
    affixTopf: Math.round(affixTopf * 1000) / 10,
    endwert: Math.round(voll * 1000) / 10,
    ohneAlles: Math.round(ohneAlles * 1000) / 10,
    beitrag: beitrag,
    plaetze: plaetze,
    baumRang: (window.KnowledgeTree && window.KnowledgeTree.getRank)
      ? window.KnowledgeTree.getRank('node_armor') : -1,
    baumAdd: Math.round(((kb.armorAdd) || 0) * 1000) / 10,
    deckel: 85
  };
})()`;

function balken(prozent, breite) {
  const n = Math.max(0, Math.min(breite, Math.round((prozent / 85) * breite)));
  return '#'.repeat(n) + '.'.repeat(breite - n);
}

(async () => {
  const H = await launch({ search: '?autostart=1&dungeon=' + TIEFE, renderer: 'canvas', waitFor: 'StartScene' });
  await H.waitForScene('GameScene', { maxRounds: 400 });

  if (BAUM > 0) {
    H.run(`(function () {
      var KT = window.KnowledgeTree;
      try { KT.addFragments(500); } catch (e) {}
      for (var i = 0; i < ${BAUM}; i++) { try { KT.invest('node_armor'); } catch (e) {} }
    })()`);
  }

  // Mehrere Saetze: nur der Schnitt interessiert, der Einzelwurf schwankt stark.
  if (SAETZE > 1) {
    const s = H.run(`(function () {
      var LS = window.LootSystem;
      window.DUNGEON_DEPTH = ${TIEFE}; window.currentWave = ${TIEFE};
      var werte = [];
      for (var d = 0; d < ${SAETZE}; d++) {
        ['weapon','offhand','head','body','boots'].forEach(function (sl) {
          var it = null;
          for (var t = 0; t < 60 && !it; t++) {
            var k = LS.rollItem(null, ${TIEFE}, ${STUFE === null ? 'undefined' : STUFE});
            if (k && k.type === sl) it = k;
          }
          if (it) window.equipment[sl] = it;
        });
        if (typeof recalcDerived === 'function') recalcDerived(0, 0);
        werte.push((typeof playerArmor !== 'undefined' ? playerArmor : 0) * 100);
      }
      werte.sort(function (a, b) { return a - b; });
      return {
        n: werte.length,
        min: Math.round(werte[0] * 10) / 10,
        mitte: Math.round(werte[Math.floor(werte.length / 2)] * 10) / 10,
        max: Math.round(werte[werte.length - 1] * 10) / 10,
        amDeckel: werte.filter(function (v) { return v >= 84.9; }).length
      };
    })()`);
    console.log('');
    console.log('Tiefe ' + TIEFE + ', ' + (STUFE === null ? 'gewuerfelte Seltenheit' : NAMEN[STUFE])
      + ', Baumrang ' + BAUM + ', ' + s.n + ' Saetze');
    console.log('  schlechtester  ' + String(s.min).padStart(6) + ' %');
    console.log('  mittlerer      ' + String(s.mitte).padStart(6) + ' %');
    console.log('  bester         ' + String(s.max).padStart(6) + ' %');
    console.log('  am Deckel      ' + s.amDeckel + ' von ' + s.n);
  } else if (STUFE !== null) {
    H.run(`(function () {
      var LS = window.LootSystem;
      window.DUNGEON_DEPTH = ${TIEFE}; window.currentWave = ${TIEFE};
      ['weapon','offhand','head','body','boots'].forEach(function (sl) {
        var it = null;
        for (var t = 0; t < 60 && !it; t++) {
          var k = LS.rollItem(null, ${TIEFE}, ${STUFE});
          if (k && k.type === sl) it = k;
        }
        if (it) window.equipment[sl] = it;
      });
    })()`);
  }

  const r = H.run(AUSLESEN);

  console.log('');
  console.log('=== Ruestung: ' + r.endwert + ' % von hoechstens ' + r.deckel + ' % ===');
  console.log('    [' + balken(r.endwert, 46) + ']');
  console.log('');
  console.log('Grundwerte der Stuecke        Punkte    wirkt   Ruestungsaffixe darauf');
  var summePunkte = 0, summeWirkung = 0;
  r.plaetze.forEach((p) => {
    if (p.leer) {
      console.log('  ' + p.platz.padEnd(28) + '   leer');
      return;
    }
    summePunkte += p.punkte; summeWirkung += p.wirkung;
    console.log('  ' + (p.platz + ' ' + p.name).slice(0, 28).padEnd(28)
      + String(p.punkte).padStart(7)
      + String(p.wirkung).padStart(8) + ' %'
      + (p.affixNamen && p.affixNamen.length
        ? '   ' + p.affixNamen.join(', ') + ' (+' + p.affix + ')'
        : '   —'));
  });
  console.log('  ' + 'aus Grundwerten'.padEnd(28) + String(Math.round(summePunkte * 10) / 10).padStart(7)
    + String(Math.round(summeWirkung * 10) / 10).padStart(8) + ' %');
  console.log('');
  console.log('  Punkte sind absolut (#104). Was davon ankommt, entscheidet die aktuelle');
  console.log('  Tiefe (' + TIEFE + ') — deshalb faellt altes Zeug von selbst ab.');
  console.log('');
  console.log('Affix-Topf (alle Ruestungsaffixe zusammen)');
  console.log('  ' + 'LootSystem.getBonus(armor)'.padEnd(28) + ' '.repeat(7)
    + String(r.affixTopf).padStart(8) + ' %   ' + balken(r.affixTopf, 24));

  console.log('');
  console.log('Buff-Schichten (Beitrag zum Endwert)');
  Object.keys(r.beitrag).forEach((k) => {
    const v = r.beitrag[k];
    console.log('  ' + k.padEnd(20) + String(v).padStart(6) + ' %'
      + (v > 0 ? '   ' + balken(v, 24) : ''));
  });
  console.log('  ' + 'Wissensbaum-Rang'.padEnd(20) + String(r.baumRang).padStart(6)
    + '     (roh +' + r.baumAdd + ' Punkte)');

  console.log('');
  console.log('Ohne jede Ausruestung: ' + r.ohneAlles + ' %');
  if (r.endwert >= 84.9) {
    console.log('');
    console.log('ACHTUNG: am Deckel. Was darueber liegt, ist verschenkt —');
    console.log('die Beitraege oben summieren sich dann nicht auf den Endwert.');
  }

  await H.shutdown();
})();
