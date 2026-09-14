/* =====================================================================
 * ruestungsquellen.js — Dev-Konsole: woher kommt die Ruestung? (#152)
 * ---------------------------------------------------------------------
 * In der Browser-Konsole, immer verfuegbar (auch ohne Debug-Modus):
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
 * Bewusst NICHT hinter DebugGate (#88): der Befehl soll auch auf der
 * ausgelieferten Seite ohne ?debug=1 laufen. Er liest nur und aendert am
 * Spielstand nichts — die Buff-Schichten werden kurz abgeschaltet und sofort
 * zurueckgesetzt, danach wird neu gerechnet. Sichtbar ist er nur fuer wen,
 * der die Konsole oeffnet und den Namen kennt.
 * ===================================================================== */
(function () {
  'use strict';

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

    // ROHWERTE. Die Spalte '%' oben misst jede Buff-Schicht durch Abschalten —
    // am Deckel zaehlt sie also nur, was UNTER 85 % ankommt. Wer wissen will,
    // wie weit er darueber liegt, braucht die ungeklemmten Zahlen. Die Schichten
    // tragen sie als armorAdd (bei eventBuffs/tiefenBuffs zusaetzlich armorMult).
    var rohSumme = ausGrundwerten + prozent(affixTopf);
    SCHICHTEN.forEach(function (s) {
      var b = window[s[1]];
      var add = (b && typeof b.armorAdd === 'number') ? prozent(b.armorAdd) : 0;
      var mult = (b && typeof b.armorMult === 'number' && b.armorMult !== 1) ? b.armorMult : null;
      for (var i = 0; i < quellen.length; i++) {
        if (quellen[i].Quelle === s[0]) {
          quellen[i]['roh %'] = add;
          if (mult) quellen[i]['roh x'] = mult;
        }
      }
      rohSumme += add;
    });
    quellen[0]['roh %'] = Math.round(ausGrundwerten * 10) / 10;
    quellen[1]['roh %'] = prozent(affixTopf);
    rohSumme = Math.round(rohSumme * 10) / 10;

    // Welche Baum-Knoten Ruestung geben: der Rang-Knoten und alle gewaehlten
    // Notables/Keystones mit armorAdd. Gewaehlt heisst getRank(id) > 0 — so
    // fuehrt knowledgeTree.js beides (getActiveKeystone liest dieselbe Zahl).
    var baumKnoten = [];
    var KT = window.KnowledgeTree;
    if (KT && typeof KT.getRank === 'function') {
      if (baumRang) baumKnoten.push('node_armor Rang ' + baumRang + ' (+' + (baumRang * 5) + ')');
      var buendel = []
        .concat(typeof KT.getKeystones === 'function' ? KT.getKeystones() : [])
        .concat(typeof KT.getNotables === 'function' ? KT.getNotables() : []);
      buendel.forEach(function (k) {
        if (!k || !(KT.getRank(k.id) > 0)) return;
        (k.effekte || []).forEach(function (f) {
          if (f.field === 'armorAdd') {
            baumKnoten.push(k.id + ' (' + (f.value > 0 ? '+' : '') + Math.round(f.value * 100) + ')');
          }
        });
      });
    }

    console.log('%cRuestung: ' + prozent(endwert) + ' % von hoechstens ' + prozent(DECKEL) + ' %'
      + '   (Tiefe ' + (window.DUNGEON_DEPTH || 1) + ', Wissensbaum-Rang ' + baumRang + ')',
      'font-weight:bold;font-size:13px');
    console.table(stuecke);
    console.table(quellen);
    console.log('Summe roh (ohne Deckel, ohne armorMult): ' + rohSumme + ' %');
    if (baumKnoten.length) console.log('Ruestung aus dem Wissensbaum: ' + baumKnoten.join(', '));
    if (endwert >= DECKEL - 0.0005) {
      console.warn('Am Deckel: ' + Math.round((rohSumme - prozent(DECKEL)) * 10) / 10
        + ' Punkte verschenkt. Die Spalte "%" zaehlt nur, was unter dem Deckel ankommt; "roh %" zeigt die vollen Werte.');
    }

    return {
      endwert: prozent(endwert),
      deckel: prozent(DECKEL),
      rohSumme: rohSumme,
      stuecke: stuecke,
      quellen: quellen,
      wissensbaumRang: baumRang,
      wissensbaumKnoten: baumKnoten
    };
  };
})();
