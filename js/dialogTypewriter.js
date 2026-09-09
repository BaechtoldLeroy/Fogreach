// js/dialogTypewriter.js — Questtexte bauen sich Wort fuer Wort auf (#139).
//
// Warum WORTWEISE und nicht zeichenweise: der Dialogtext laeuft mit
// `wordWrap` (HubSceneV2). Baut man ihn Zeichen fuer Zeichen auf, springt ein
// Wort in die naechste Zeile, sobald es dort nicht mehr passt — der ganze
// Absatz zuckt. Wortweise umbricht immer an derselben Stelle wie der fertige
// Text, weil jedes Wort vollstaendig gesetzt wird.
//
// Reine Logik, keine Phaser-Aufrufe: die Szene fragt bei jedem Tick nach dem
// aktuellen Textausschnitt. Damit ist der Ablauf ohne Szene pruefbar
// (tests/dialogTypewriter.test.js) — die 233 Dialogzeilen des Spiels haetten
// sonst keine Absicherung ausser dem Augenschein.
(function () {
  'use strict';

  // Millisekunden je Wort. "sofort" ist kein Tempo, sondern das Abschalten.
  var TEMPI = {
    langsam: 90,
    normal: 55,
    sofort: 0
  };
  var STANDARD = 'normal';
  var SPEICHER_SCHLUESSEL = 'demonfall_textTempo';

  function tempoNamen() { return Object.keys(TEMPI); }

  /** Gewaehltes Tempo aus dem Spielstand; faellt weich auf "normal" zurueck. */
  function gewaehltesTempo(speicher) {
    var s = speicher || (typeof window !== 'undefined'
      ? (window.SlotStorage || window.localStorage) : null);
    if (!s || typeof s.getItem !== 'function') return STANDARD;
    try {
      var roh = JSON.parse(s.getItem(SPEICHER_SCHLUESSEL));
      return Object.prototype.hasOwnProperty.call(TEMPI, roh) ? roh : STANDARD;
    } catch (e) { return STANDARD; }
  }

  function setzeTempo(name, speicher) {
    if (!Object.prototype.hasOwnProperty.call(TEMPI, name)) return false;
    var s = speicher || (typeof window !== 'undefined'
      ? (window.SlotStorage || window.localStorage) : null);
    if (s && typeof s.setItem === 'function') {
      try { s.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(name)); } catch (e) {}
    }
    return true;
  }

  function msJeWort(name) {
    return Object.prototype.hasOwnProperty.call(TEMPI, name) ? TEMPI[name] : TEMPI[STANDARD];
  }

  /**
   * Zerlegt einen Text in Stuecke, die einzeln erscheinen.
   *
   * Trennzeichen bleiben AM VORHERGEHENDEN Stueck haengen. Sonst stuende nach
   * dem letzten sichtbaren Wort ein einzelnes Leerzeichen, und bei
   * Zeilenumbruechen im Text (\n\n zwischen Absaetzen) waere der Absatz schon
   * offen, bevor sein erstes Wort da ist — der Kasten wuerde sichtbar zucken.
   */
  function inWorte(text) {
    var s = (typeof text === 'string') ? text : '';
    if (!s) return [];
    var teile = s.split(/(\s+)/);
    var raus = [];
    for (var i = 0; i < teile.length; i++) {
      if (teile[i] === '') continue;
      if (/^\s+$/.test(teile[i])) {
        if (raus.length) raus[raus.length - 1] += teile[i];
        else raus.push(teile[i]);
      } else {
        raus.push(teile[i]);
      }
    }
    return raus;
  }

  /**
   * Ein laufender Aufbau.
   *
   * @param {string} text    der vollstaendige Text
   * @param {object} [opts]  { tempo, jetzt } — jetzt() liefert die Zeit in ms
   */
  function starte(text, opts) {
    var o = opts || {};
    var worte = inWorte(text);
    var voll = worte.join('');
    var tempo = o.tempo || gewaehltesTempo(o.speicher);
    var takt = msJeWort(tempo);
    var jetzt = (typeof o.jetzt === 'function') ? o.jetzt
      : function () { return Date.now(); };
    // Verstrichene Zeit wird AUFSUMMIERT, nicht gegen einen festen Startpunkt
    // gerechnet. Sonst haengt der Aufbau an einer streng steigenden Uhr — und
    // die Szenenuhr springt sehr wohl zurueck (Szenenwechsel, und im Testkopf
    // bei jedem step()). Ein Rueckwaertssprung wuerde den Text einfrieren.
    // Ein einzelner Schritt wird ausserdem gedeckelt: nach einem langen
    // Ruckler soll der Satz weiterlaufen, nicht auf einen Schlag dastehen.
    var MAX_SCHRITT = 250;
    var vorher = jetzt();
    var verstrichen = 0;
    var gezeigt = (takt <= 0) ? worte.length : 0;

    return {
      /** Wie viele Worte stehen? Fuer Tests und den Klang je Wort. */
      wortZahl: function () { return gezeigt; },
      gesamtWorte: function () { return worte.length; },
      fertig: function () { return gezeigt >= worte.length; },
      vollerText: function () { return voll; },

      /**
       * Rechnet den Stand zur aktuellen Zeit aus.
       * @returns {{text:string, neueWorte:number, fertig:boolean}}
       */
      tick: function () {
        if (gezeigt >= worte.length) {
          return { text: voll, neueWorte: 0, fertig: true };
        }
        var nun = jetzt();
        verstrichen += Math.min(MAX_SCHRITT, Math.max(0, nun - vorher));
        vorher = nun;
        var soll = (takt <= 0)
          ? worte.length
          : Math.min(worte.length, Math.floor(verstrichen / takt) + 1);
        var neu = Math.max(0, soll - gezeigt);
        gezeigt = soll;
        return {
          text: worte.slice(0, gezeigt).join(''),
          neueWorte: neu,
          fertig: gezeigt >= worte.length
        };
      },

      /** Sofort alles zeigen — das Ueberspringen. */
      sofortFertig: function () {
        gezeigt = worte.length;
        return voll;
      }
    };
  }

  /**
   * Tonhoehe des Sprechklangs, stabil aus dem Sprechernamen abgeleitet.
   *
   * Damit klingt Aldric ueber das ganze Spiel gleich und anders als Elara —
   * ohne dass irgendwo eine Stimmentabelle gepflegt werden muss. Spanne
   * 0,82 bis 1,30: darunter klingt es dumpf, darueber schrill.
   */
  function tonhoehe(sprecher) {
    var s = (typeof sprecher === 'string') ? sprecher : '';
    var h = 0;
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    var t = Math.abs(h % 1000) / 1000;
    return Math.round((0.82 + t * 0.48) * 1000) / 1000;
  }

  var API = {
    TEMPI: TEMPI,
    STANDARD: STANDARD,
    SPEICHER_SCHLUESSEL: SPEICHER_SCHLUESSEL,
    tempoNamen: tempoNamen,
    gewaehltesTempo: gewaehltesTempo,
    setzeTempo: setzeTempo,
    msJeWort: msJeWort,
    inWorte: inWorte,
    starte: starte,
    tonhoehe: tonhoehe
  };

  if (typeof window !== 'undefined') window.DialogTypewriter = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
