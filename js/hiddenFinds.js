/* =====================================================================
 * hiddenFinds.js — Funde abseits des Wegs (#113)
 * ---------------------------------------------------------------------
 * Der schnellste Weg durch einen Raum war auch der beste: von der Tuer zur
 * Treppe, fertig. In eine Seitenkammer zu gehen kostete Zeit und brachte
 * nichts — Erkundung war damit reine Zeitkosten, und die grossen Raumlayouts
 * blieben Kulisse.
 *
 * Ein verborgener Fund ist das Gegenangebot. Der Kern ist NICHT das Objekt
 * (das kann eventSystem.spawnEventObject) sondern die PLATZIERUNG: er muss
 * dort liegen, wo man beim Durchqueren nicht vorbeikommt.
 *
 * Deshalb ist `abseitsWert` hier die eigentliche Arbeit und rein gehalten:
 * ohne Phaser, ohne Szene, ohne Zufall — und damit pruefbar. Was ein Fund
 * hergibt, entscheidet der Aufrufer.
 * ===================================================================== */
(function () {
  'use strict';

  // Naeher als das am Durchgangsweg gilt nicht als abseits. 160 px sind gut
  // zwei Spielerbreiten neben der Laufspur — nah genug, dass man den Fund im
  // Vorbeigehen SIEHT, weit genug, dass man dafuer abbiegen muss.
  var MIN_ABSTAND = 160;

  /**
   * Kuerzester Abstand eines Punktes zur Strecke von A nach B.
   *
   * Nicht der Abstand zu A oder B: ein Fund genau in der Mitte zwischen Tuer
   * und Treppe waere von beiden weit weg und trotzdem mitten auf dem Weg.
   */
  function abstandZurStrecke(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var laengeQ = dx * dx + dy * dy;
    if (laengeQ === 0) return Math.hypot(px - ax, py - ay);   // A und B gleich
    // Projektion auf die Strecke, auf [0,1] beschnitten -> Lot faellt ausserhalb
    // der Strecke, dann zaehlt der naehere Endpunkt.
    var t = ((px - ax) * dx + (py - ay) * dy) / laengeQ;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /**
   * Wie gut liegt ein Punkt abseits? Groesser ist besser, 0 heisst "auf dem Weg".
   *
   * @param {{x:number,y:number}} punkt
   * @param {{x:number,y:number}} eingang  wo der Spieler den Raum betritt
   * @param {{x:number,y:number}} ausgang  wo die Treppe liegt
   */
  function abseitsWert(punkt, eingang, ausgang) {
    if (!punkt || !eingang || !ausgang) return 0;
    return abstandZurStrecke(punkt.x, punkt.y, eingang.x, eingang.y, ausgang.x, ausgang.y);
  }

  /**
   * Waehlt aus Kandidaten die Punkte, die am weitesten abseits liegen.
   *
   * Zusaetzlich wird ein Mindestabstand ZWISCHEN den gewaehlten Punkten
   * gewahrt: zwei Funde nebeneinander sind ein Fund, kein zweiter Grund
   * abzubiegen.
   *
   * @param {Array<{x:number,y:number}>} kandidaten
   * @param {{x:number,y:number}} eingang
   * @param {{x:number,y:number}} ausgang
   * @param {number} anzahl  wie viele Punkte hoechstens
   * @param {number} [mindestAbstand] zwischen zwei Funden (Standard 240)
   * @returns {Array<{x:number,y:number}>} kann kuerzer sein als `anzahl`
   */
  function waehleAbseits(kandidaten, eingang, ausgang, anzahl, mindestAbstand) {
    if (!Array.isArray(kandidaten) || !kandidaten.length || anzahl <= 0) return [];
    var trenn = (typeof mindestAbstand === 'number') ? mindestAbstand : 240;

    var bewertet = [];
    for (var i = 0; i < kandidaten.length; i++) {
      var k = kandidaten[i];
      if (!k || typeof k.x !== 'number' || typeof k.y !== 'number') continue;
      var w = abseitsWert(k, eingang, ausgang);
      if (w < MIN_ABSTAND) continue;          // liegt am Weg -> kein Fund
      bewertet.push({ p: k, w: w });
    }
    bewertet.sort(function (a, b) { return b.w - a.w; });

    var gewaehlt = [];
    for (var j = 0; j < bewertet.length && gewaehlt.length < anzahl; j++) {
      var p = bewertet[j].p;
      var zuNah = false;
      for (var g = 0; g < gewaehlt.length; g++) {
        if (Math.hypot(p.x - gewaehlt[g].x, p.y - gewaehlt[g].y) < trenn) { zuNah = true; break; }
      }
      if (!zuNah) gewaehlt.push(p);
    }
    return gewaehlt;
  }

  /**
   * Wie viele Funde bekommt ein Raum?
   *
   * Bewusst hoechstens einer je Raum und nicht in jedem: Erkundung soll ein
   * Angebot bleiben. Wer in jedem Raum absuchen MUSS, erlebt keine Entdeckung
   * mehr, sondern eine Pflichtaufgabe — das ist die offene Frage aus #113,
   * hier mit dem vorsichtigen Wert beantwortet.
   *
   * ACHTUNG, das ist nicht die Rate, die im Spiel ankommt: danach muss noch
   * ein Platz weit genug abseits gefunden werden. Am laufenden Spiel
   * gemessen (Tiefe 3, 12 Raeume, Chance auf 1 gesetzt) gelingt das in 9 von
   * 12 Raeumen — die tatsaechliche Rate liegt also bei rund 0.35 * 0.75 =
   * ~26 %. Wer hier dreht, sollte den Trichter neu messen statt zu rechnen.
   */
  var CHANCE = 0.35;

  function anzahlFuerRaum(rng) {
    var r = (typeof rng === 'function') ? rng : Math.random;
    // Chance ueber das Modul-Objekt, nicht die Konstante: so laesst sich die
    // Haeufigkeit messen und nachjustieren, ohne den Code anzufassen.
    return r() < HiddenFinds.CHANCE ? 1 : 0;
  }

  var HiddenFinds = {
    MIN_ABSTAND: MIN_ABSTAND,
    CHANCE: CHANCE,
    abstandZurStrecke: abstandZurStrecke,
    abseitsWert: abseitsWert,
    waehleAbseits: waehleAbseits,
    anzahlFuerRaum: anzahlFuerRaum
  };
  if (typeof window !== 'undefined') window.HiddenFinds = HiddenFinds;
  if (typeof module !== 'undefined' && module.exports) module.exports = HiddenFinds;
})();
