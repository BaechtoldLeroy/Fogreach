/* =====================================================================
 * ruestungsquellen.js — Dev-Konsole: woher kommt die Ruestung? (#152)
 * ---------------------------------------------------------------------
 * In der Browser-Konsole, bei aktivem Debug-Modus (lokal oder ?debug=1):
 *
 *   __ruestung()
 *
 * Liest den AKTUELLEN Spielstand und zeigt Schicht fuer Schicht, woher die
 * Ruestung kommt: Grundwerte der Stuecke, der Affix-Topf, die vier
 * Buff-Schichten, und der Endwert gegen den 85-%-Deckel. Gibt dasselbe
 * zusaetzlich als Objekt zurueck.
 *
 * Zwei Fallen, an denen ein nachgebautes Werkzeug scheitert:
 *
 *   - Ruestung steht auf dem Stueck als absolute PUNKTE (#104), nicht als
 *     Bruch. Was davon ankommt, rechnet LootSystem.basiswertWirkung aus.
 *   - Affixe landen NICHT auf it.armor, sondern in einem eigenen Topf
 *     (LootSystem.getBonus), den recalcDerived getrennt addiert. Ein Affix am
 *     Stueck traegt nur { defId, value }; der Statkey steht in AFFIX_DEFS.
 *
 * Die Beitraege der Buff-Schichten werden ermittelt, indem jede einmal
 * abgeschaltet und recalcDerived neu gerufen wird. So zaehlt auch, was die
 * Klemmung bei 0,85 ihnen wegnimmt.
 *
 * Hinter DebugGate wie perfProbe (#88): ein Spieler sieht nichts davon.
 * ===================================================================== */
(function () {
  'use strict';

  try {
    if (!window.DebugGate || !window.DebugGate.aktiv()) return;
  } catch (e) { return; }

  var PLAETZE = ['weapon', 'offhand', 'head', 'body', 'boots'];
  var SCHICHTEN = [
    ['Ereignis-Buffs', 'eventBuffs'],
    ['Brunnen', 'brunnenBuffs'],
    ['Tiefen-Buffs', 'tiefenBuffs'],
    ['Wissensbaum', 'knowledgeTreeBuffs']
  ];
  var DECKEL = 0.85;

  function prozent(x) { return Math.round((x || 0) * 1000) / 10; }

  function neuRechnen() {
    if (typeof recalcDerived === 'function') recalcDerived(0, 0);
    return (typeof playerArmor !== 'undefined') ? playerArmor : 0;
  }

  window.__ruestung = function () {
    var LS = window.LootSystem;
    var eq = window.equipment || {};
    var endwert = neuRechnen();

    var beitrag = {};
    SCHICHTEN.forEach(function (s) {
      var gemerkt = window[s[1]];
      window[s[1]] = null;
      beitrag[s[0]] = prozent(endwert - neuRechnen());
      window[s[1]] = gemerkt;
    });
    neuRechnen();

    var defs = (LS && LS.AFFIX_DEFS) || [];
    function definition(id) {
      for (var i = 0; i < defs.length; i++) {
        if (defs[i] && defs[i].id === id) return defs[i];
      }
      return null;
    }

    var stuecke = [];
    PLAETZE.forEach(function (platz) {
      var it = eq[platz];
      if (!it) {
        stuecke.push({ Platz: platz, Stueck: '(leer)', Punkte: 0, 'wirkt %': 0, Ruestungsaffixe: '' });
        return;
      }
      var wirkt = (LS && typeof LS.basiswertWirkung === 'function')
        ? LS.basiswertWirkung('armor', it.armor || 0) : 0;
      var affixe = [];
      (it.affixes || []).forEach(function (a) {
        var d = a && definition(a.defId);
        if (d && (d.statKey || '').indexOf('armor') >= 0) {
          affixe.push(d.id + ' +' + (Math.round((a.value || 0) * 10) / 10));
        }
      });
      stuecke.push({
        Platz: platz,
        Stueck: (LS && typeof LS.composeName === 'function') ? LS.composeName(it) : (it.name || '?'),
        Punkte: Math.round((it.armor || 0) * 10) / 10,
        'wirkt %': prozent(wirkt),
        Ruestungsaffixe: affixe.join(', ')
      });
    });

    var affixTopf = (LS && typeof LS.getBonus === 'function') ? (LS.getBonus('armor') || 0) : 0;
    var ausGrundwerten = stuecke.reduce(function (s, z) { return s + (z['wirkt %'] || 0); }, 0);

    var quellen = [
      { Quelle: 'Grundwerte der Stuecke', '%': Math.round(ausGrundwerten * 10) / 10 },
      { Quelle: 'Affix-Topf', '%': prozent(affixTopf) }
    ];
    SCHICHTEN.forEach(function (s) { quellen.push({ Quelle: s[0], '%': beitrag[s[0]] }); });

    var baumRang = (window.KnowledgeTree && typeof window.KnowledgeTree.getRank === 'function')
      ? window.KnowledgeTree.getRank('node_armor') : null;

    console.log('%cRuestung: ' + prozent(endwert) + ' % von hoechstens ' + prozent(DECKEL) + ' %'
      + '   (Tiefe ' + (window.DUNGEON_DEPTH || 1) + ', Wissensbaum-Rang ' + baumRang + ')',
      'font-weight:bold;font-size:13px');
    console.table(stuecke);
    console.table(quellen);
    if (endwert >= DECKEL - 0.0005) {
      console.warn('Am Deckel. Was darueber liegt, ist verschenkt, deshalb summieren sich die Quellen nicht auf den Endwert.');
    }

    return {
      endwert: prozent(endwert),
      deckel: prozent(DECKEL),
      stuecke: stuecke,
      quellen: quellen,
      wissensbaumRang: baumRang
    };
  };
})();
