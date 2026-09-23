// js/anschlagtafel.js — das Auftragsbrett am Rathaus (#68).
//
// Die beiden Tafeln neben der Rathaustreppe waren Kulisse: gezeichnet,
// phasenabhaengig vergilbt, aber ohne Inhalt. Jetzt haengen Auftraege daran,
// und sie kippen mit dem Hub — das ist der Reiz, denn die Phase trug bisher
// nur Farbe und Nebel.
//
//   council / doubleAgent  Der Rat haengt aus: ein Kopfgeld, rotierend.
//   broken                 Die Rats-Plakate sind zerfetzt, die Druckerei
//                          haengt ihren Aufruf darueber.
//   epilogue               Nur noch die gedruckte Wahrheit, kein Auftrag mehr.
//
// Welcher der beiden Rats-Aushaenge haengt, entscheidet die erreichte Tiefe.
// Die steigt mit jedem abgeschlossenen Lauf, der Aushang wechselt also von
// Lauf zu Lauf — Vorbeischauen lohnt sich.
//
// Die Auftraege selbst stehen als wiederholbare Quests in questSystem
// (npcId 'anschlagtafel'); hier steht nur, welcher davon gerade haengt.
(function () {
  'use strict';

  var RATS_AUSHAENGE = ['brett_stoerer', 'brett_anfuehrer'];
  var WIDERSTAND_AUFRUF = 'brett_aufruf';

  function _phase() {
    try {
      if (window.HubPhase && typeof window.HubPhase.current === 'function') return window.HubPhase.current();
    } catch (e) {}
    return 'council';
  }

  /** Die erreichte Tiefe — sie steigt mit jedem abgeschlossenen Lauf. */
  function _tiefe() {
    try {
      if (window.Persistence && typeof window.Persistence.getMaxDepth === 'function') {
        return Math.max(1, window.Persistence.getMaxDepth() | 0);
      }
    } catch (e) {}
    return 1;
  }

  /**
   * Haengt dieser Aushang gerade am Brett?
   * @param {string} id  Quest-Id (brett_stoerer | brett_anfuehrer | brett_aufruf)
   * @param {string} [phase]  fuer Tests; sonst die aktuelle Hub-Phase
   * @param {number} [tiefe]  fuer Tests; sonst die erreichte Tiefe
   */
  function haengt(id, phase, tiefe) {
    var p = phase || _phase();
    // Der Epilog braucht keine eigene Abfrage: er ist weder 'broken' noch
    // 'council'/'doubleAgent', faellt also unten von selbst heraus.
    if (id === WIDERSTAND_AUFRUF) return p === 'broken';
    var i = RATS_AUSHAENGE.indexOf(id);
    if (i === -1) return false;
    if (p !== 'council' && p !== 'doubleAgent') return false;
    var t = (typeof tiefe === 'number') ? tiefe : _tiefe();
    return RATS_AUSHAENGE[t % RATS_AUSHAENGE.length] === id;
  }

  /** Was sonst noch am Brett steht (Flavor des Dialogs), je Phase. */
  function zeilen(phase) {
    var p = phase || _phase();
    var keys = ['brett.zeile.' + p + '.0', 'brett.zeile.' + p + '.1'];
    return keys.map(function (k) {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var v = window.i18n.t(k);
        if (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) return v;
      }
      return '';
    }).filter(Boolean);
  }

  if (window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', {
      'brett.zeile.council.0': 'Drei Aushänge, drei Farben, ein Kasten für den Lohn. Daneben eine Preisliste für Brot, zweimal durchgestrichen.',
      'brett.zeile.council.1': 'Ganz unten, klein und handgeschrieben: "Wer meine Tochter gesehen hat, melde sich in der Gasse hinter der Schmiede."',
      'brett.zeile.doubleAgent.0': 'Die Aushänge sind frisch, aber es steht immer weniger darauf. Zwei Zeilen Wahlkampf, dann das Siegel.',
      'brett.zeile.doubleAgent.1': 'Unter dem Rand des Klerus-Plakats lugt ein Zettel hervor, den niemand gedruckt hat. Er ist noch feucht.',
      'brett.zeile.broken.0': 'Die Rats-Plakate hängen in Fetzen. Darüber, quer und ohne Siegel, das Papier aus Thoms Presse.',
      'brett.zeile.broken.1': 'Jemand hat die Namen der Vermissten abgeschrieben und daneben genagelt. Die Liste ist länger als der Aushang.',
      'brett.zeile.epilogue.0': 'Am Brett hängt nur noch, was gedruckt wurde. Die Leute bleiben stehen und lesen, manche laut.',
      'brett.zeile.epilogue.1': 'Ein Kind hat unten in die Ecke ein Wort gekritzelt. Es ist kein Name, es ist ein Datum.'
    });
    window.i18n.register('en', {
      'brett.zeile.council.0': 'Three notices, three colours, one box for the pay. Beside them a price list for bread, crossed out twice.',
      'brett.zeile.council.1': 'At the very bottom, small and handwritten: "Whoever has seen my daughter, come to the alley behind the forge."',
      'brett.zeile.doubleAgent.0': 'The notices are fresh, but there is less and less on them. Two lines of campaign, then the seal.',
      'brett.zeile.doubleAgent.1': "Under the edge of the Clergy's poster a slip of paper peeks out that nobody printed. It is still damp.",
      'brett.zeile.broken.0': "The council posters hang in shreds. Across them, without a seal, the paper from Thom's press.",
      'brett.zeile.broken.1': 'Someone copied out the names of the missing and nailed them up beside it. The list is longer than the notice.',
      'brett.zeile.epilogue.0': 'All that hangs on the board now is what was printed. People stop and read, some of them aloud.',
      'brett.zeile.epilogue.1': 'A child has scratched a word into the bottom corner. It is not a name, it is a date.'
    });
  }

  window.Anschlagtafel = {
    RATS_AUSHAENGE: RATS_AUSHAENGE,
    WIDERSTAND_AUFRUF: WIDERSTAND_AUFRUF,
    haengt: haengt,
    zeilen: zeilen
  };
})();
