// js/dialogSeiten.js — zu lange Dialogseiten auf mehrere Seiten verteilen.
//
// Gemeldet: "Der Dialog von «Wer du warst» ist so lang, dass es eine
// Scrollbar braucht." Brankas Abgabetext hat drei Absaetze und lief unten aus
// dem Kasten (und aus dem Bild). Statt einer Bildlaufleiste blaettert man:
// der Text wird an Absaetzen geteilt, reicht das nicht, an Saetzen — nie
// mitten im Wort. Nur ein einzelner Satz, der allein nicht passt, bekommt eine
// Seite zum Rollen (Seite.scrollen).
//
// Reine Logik: OB ein Text passt, entscheidet der Aufrufer (passt(text)), der
// ihn mit dem echten Textobjekt vermisst. So ist die Teilung ohne Szene
// pruefbar (tests/dialogSeiten.test.js), und Hub und Dungeon-Dialog teilen
// dieselbe Regel.
(function () {
  'use strict';

  // "BRANKA: ..." — der Sprecher steht auf JEDER Teilseite, sonst spricht ab
  // Seite 2 niemand mehr. Dieselbe Form wie DialogChoice.sprecherTeilen.
  var SPRECHER = /^([A-ZÄÖÜ][A-ZÄÖÜ .'-]*[A-ZÄÖÜ]):[ \t]+/;

  function sprecher(text) {
    var m = SPRECHER.exec(text);
    return m ? m[0] : '';
  }

  /** Absaetze; der Trenner (\n\n) haengt am vorigen Stueck. */
  function absaetze(text) {
    var teile = text.split(/(\n[ \t]*\n\s*)/);
    var raus = [];
    for (var i = 0; i < teile.length; i += 2) {
      var stueck = teile[i] + (teile[i + 1] || '');
      if (stueck) raus.push(stueck);
    }
    return raus;
  }

  // Abkuerzungen beenden keinen Satz ("z. B.", "Nr. 3").
  var KEIN_SATZENDE = /^(?:[a-zäöü]|z|B|bzw|ca|Nr|Dr|St|usw|etc|vgl|Mr|Mrs|Ms)\.$/;

  /** Saetze; Leerraum haengt am vorigen Stueck, schliessende Klammer/Zeichen auch. */
  function saetze(absatz) {
    var worte = absatz.split(/(\s+)/);
    var raus = [];
    var aktuell = '';
    for (var i = 0; i < worte.length; i++) {
      aktuell += worte[i];
      var wort = worte[i];
      if (i % 2 === 0 && wort && /[.!?…][)\]"'»«“”’]*$/.test(wort) && !KEIN_SATZENDE.test(wort)) {
        if (i + 1 < worte.length) { aktuell += worte[i + 1]; i++; }
        raus.push(aktuell);
        aktuell = '';
      }
    }
    if (aktuell) raus.push(aktuell);
    return raus;
  }

  function ohneEnde(s) { return s.replace(/\s+$/, ''); }

  /**
   * Teilt einen Text so, dass jede Seite passt.
   *
   * @param {string} text
   * @param {function(string):boolean} passt  vermisst eine Seite (inkl. Sprecher)
   * @returns {Array<{text:string, scrollen:boolean}>}  mindestens eine Seite;
   *   passt der Text, genau eine mit dem unveraenderten Text
   */
  function teilen(text, passt) {
    var s = (typeof text === 'string') ? text : '';
    if (!s || passt(s)) return [{ text: s, scrollen: false }];

    var vor = sprecher(s);
    var seiten = [];
    var aktuell = '';
    var mit = function (rumpf) { return vor + ohneEnde(rumpf); };
    var abschliessen = function () {
      if (aktuell.trim()) seiten.push({ text: mit(aktuell), scrollen: false });
      aktuell = '';
    };
    // Haengt ein Stueck an die laufende Seite, wenn es passt.
    var anhaengen = function (stueck) {
      if (passt(mit(aktuell + stueck))) { aktuell += stueck; return true; }
      return false;
    };

    absaetze(s.slice(vor.length)).forEach(function (absatz) {
      if (anhaengen(absatz)) return;
      abschliessen();
      if (anhaengen(absatz)) return;
      saetze(absatz).forEach(function (satz) {
        if (anhaengen(satz)) return;
        abschliessen();
        if (anhaengen(satz)) return;
        // Ein einzelner Satz ist laenger als der ganze Kasten: eigene Seite,
        // die rollt. Weiter zerschneiden hiesse mitten im Satz blaettern.
        seiten.push({ text: mit(satz), scrollen: true });
      });
    });
    abschliessen();
    return seiten.length ? seiten : [{ text: s, scrollen: false }];
  }

  var API = {
    teilen: teilen,
    sprecher: sprecher,
    absaetze: absaetze,
    saetze: saetze
  };
  if (typeof window !== 'undefined') window.DialogSeiten = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
